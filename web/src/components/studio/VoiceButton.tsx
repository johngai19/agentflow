'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Agent, Zone } from '@/data/studioData'

interface VoiceButtonProps {
  agent: Agent
  zone?: Zone
  recentContext: string
  onTranscript: (corrected: string, raw: string) => void
  disabled?: boolean
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'error'
type VoiceEngine = 'whisper' | 'webspeech' | 'none'

// ── Audio preprocessing helpers ─────────────────────────────────────────────
// Pick the best supported MIME type for the current browser
function getBestMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type
  }
  return 'audio/webm'
}

// Simple voice-activity detection: check if the blob is mostly silence by
// sampling the audio buffer energy. Returns true if there is audible content.
async function hasAudioContent(blob: Blob): Promise<boolean> {
  try {
    const ctx = new (window.AudioContext ?? (window as any).webkitAudioContext)()
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    const data = audioBuffer.getChannelData(0)
    let rms = 0
    for (let i = 0; i < data.length; i++) rms += data[i] * data[i]
    rms = Math.sqrt(rms / data.length)
    ctx.close()
    return rms > 0.004 // threshold ≈ -48 dBFS
  } catch {
    return true // if we can't check, assume there's content
  }
}

export default function VoiceButton({
  agent, zone, recentContext, onTranscript, disabled,
}: VoiceButtonProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [interimText, setInterimText] = useState('')
  const [engine, setEngine] = useState<VoiceEngine>('none')
  const [errorMsg, setErrorMsg] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Detect available engines on mount
  useEffect(() => {
    const hasWhisper = !!(
      process.env.NEXT_PUBLIC_WHISPER_ENABLED !== 'false' &&
      typeof navigator !== 'undefined' && navigator.mediaDevices
    )
    const hasWebSpeech = typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

    if (hasWhisper) setEngine('whisper')
    else if (hasWebSpeech) setEngine('webspeech')
    else setEngine('none')
  }, [])

  // ── LLM context-aware correction ──────────────────────────────────────────
  const correctTranscript = useCallback(async (raw: string): Promise<string> => {
    if (!raw.trim()) return raw
    try {
      const res = await fetch('/api/voice-correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawTranscript: raw,
          agentName: agent.name,
          agentRole: agent.role,
          agentTools: agent.tools,
          zoneName: zone?.name ?? '待命区',
          recentContext,
        }),
      })
      const data = await res.json()
      return data.corrected?.trim() || raw
    } catch {
      return raw
    }
  }, [agent, zone, recentContext])

  // ── Whisper engine ─────────────────────────────────────────────────────────
  const startWhisper = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = getBestMimeType()
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null

        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []

        if (blob.size < 512) { setVoiceState('idle'); return }

        setVoiceState('processing')
        setInterimText('检查音频...')

        // VAD pre-check — skip silent recordings
        const hasContent = await hasAudioContent(blob)
        if (!hasContent) {
          setVoiceState('idle')
          setInterimText('')
          return
        }

        setInterimText('Whisper 识别中...')

        // Build context hint for Whisper prompt
        const agentContext = `${agent.name} ${agent.role} ${agent.tools.slice(0, 4).join(' ')}`

        const form = new FormData()
        form.append('audio', blob, `recording.${mimeType.includes('webm') ? 'webm' : 'ogg'}`)
        form.append('lang', 'zh')
        form.append('agentContext', agentContext)

        try {
          const res = await fetch('/api/voice-transcribe', { method: 'POST', body: form })
          const data = await res.json()

          if (data.text?.trim()) {
            setInterimText('AI 纠错中...')
            const corrected = await correctTranscript(data.text)
            onTranscript(corrected, data.text)
          } else if (data.filtered) {
            // Silent / no-speech — do nothing
          } else if (data.error) {
            // Whisper failed — fall back to Web Speech API if available
            setEngine('webspeech')
            setErrorMsg('Whisper 暂不可用，已切换到浏览器识别')
          }
        } catch {
          setEngine('webspeech')
          setErrorMsg('Whisper 请求失败，已切换到浏览器识别')
        } finally {
          setVoiceState('idle')
          setInterimText('')
        }
      }

      recorder.start(100) // collect in 100 ms chunks
      setVoiceState('listening')
      setErrorMsg('')
    } catch (err: any) {
      setVoiceState('error')
      setErrorMsg(err?.name === 'NotAllowedError' ? '请允许麦克风权限' : '麦克风初始化失败')
    }
  }, [agent, correctTranscript, onTranscript])

  const stopWhisper = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop())
      setVoiceState('idle')
    }
  }, [])

  // ── Web Speech API engine (fallback) ───────────────────────────────────────
  const startWebSpeech = useCallback(() => {
    const w = window as any
    const API = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!API) return

    const r = new API()
    recognitionRef.current = r
    r.lang = 'zh-CN'
    r.continuous = false
    r.interimResults = true
    r.maxAlternatives = 1

    r.onstart = () => { setVoiceState('listening'); setErrorMsg('') }
    r.onend = () => setVoiceState(s => s === 'listening' ? 'idle' : s)

    r.onresult = async (event: any) => {
      const results = Array.from(event.results) as any[]
      const last = results[results.length - 1]
      const text: string = last[0].transcript
      if (last.isFinal) {
        setVoiceState('processing')
        setInterimText('')
        const corrected = await correctTranscript(text)
        onTranscript(corrected, text)
        setVoiceState('idle')
      } else {
        setInterimText(text)
      }
    }

    r.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        setVoiceState('error')
        setErrorMsg('请允许麦克风权限')
      } else {
        setVoiceState('idle')
      }
      setInterimText('')
    }

    r.start()
  }, [correctTranscript, onTranscript])

  const stopWebSpeech = useCallback(() => {
    recognitionRef.current?.stop()
    setVoiceState('idle')
    setInterimText('')
  }, [])

  // ── Unified start / stop ───────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (disabled || voiceState !== 'idle') return
    if (engine === 'whisper') startWhisper()
    else if (engine === 'webspeech') startWebSpeech()
  }, [disabled, voiceState, engine, startWhisper, startWebSpeech])

  const handleStop = useCallback(() => {
    if (voiceState !== 'listening') return
    if (engine === 'whisper') stopWhisper()
    else if (engine === 'webspeech') stopWebSpeech()
  }, [voiceState, engine, stopWhisper, stopWebSpeech])

  // ── Not supported at all ───────────────────────────────────────────────────
  if (engine === 'none') {
    return (
      <button disabled className="p-2 rounded-lg text-muted-foreground bg-muted/50 cursor-not-allowed" title="浏览器不支持麦克风">
        🎤
      </button>
    )
  }

  const engineLabel = engine === 'whisper' ? 'Whisper' : '浏览器'

  return (
    <div className="relative flex flex-col items-center gap-1">
      {/* Interim / status bubble */}
      <AnimatePresence>
        {(interimText || errorMsg) && (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap max-w-[220px]
              text-white text-xs px-2 py-1 rounded-lg z-20 text-center
              ${errorMsg ? 'bg-amber-600/90' : 'bg-black/80'}`}
          >
            {errorMsg || interimText}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onPointerDown={handleStart}
        onPointerUp={handleStop}
        onPointerLeave={voiceState === 'listening' ? handleStop : undefined}
        disabled={disabled || voiceState === 'processing'}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative p-2 rounded-lg transition-all duration-150 focus:outline-none
          ${voiceState === 'listening'
            ? 'bg-red-500 text-white shadow-lg shadow-red-500/40'
            : voiceState === 'processing'
              ? 'bg-indigo-500 text-white cursor-wait'
              : voiceState === 'error'
                ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={
          voiceState === 'listening' ? '松开停止录音'
            : engine === 'whisper' ? `按住录音（${engineLabel} 识别 · AI 纠错）`
            : '按住说话（浏览器识别 · AI 纠错）'
        }
      >
        {/* Pulse rings when listening */}
        {voiceState === 'listening' && (
          <>
            <motion.span className="absolute inset-0 rounded-lg bg-red-400 opacity-40"
              animate={{ scale: [1, 1.7, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 1, repeat: Infinity }} />
            <motion.span className="absolute inset-0 rounded-lg bg-red-400 opacity-20"
              animate={{ scale: [1, 2.2, 1], opacity: [0.2, 0, 0.2] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.3 }} />
          </>
        )}
        <span className="relative text-base">
          {voiceState === 'listening' ? '🔴'
            : voiceState === 'processing' ? '⚙️'
            : voiceState === 'error' ? '⚠️'
            : '🎤'}
        </span>
      </motion.button>

      {/* Engine indicator */}
      <span className="text-[9px] text-muted-foreground/70">
        {voiceState === 'listening' ? '录音中'
          : voiceState === 'processing' ? '识别中'
          : engineLabel}
      </span>
    </div>
  )
}
