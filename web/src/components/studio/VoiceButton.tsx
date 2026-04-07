'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Agent, Zone } from '@/data/studioData'

interface VoiceButtonProps {
  agent: Agent
  zone?: Zone
  recentContext: string
  onTranscript: (text: string, raw: string) => void
  disabled?: boolean
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'error'

export default function VoiceButton({ agent, zone, recentContext, onTranscript, disabled }: VoiceButtonProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [interimText, setInterimText] = useState('')
  const recognitionRef = useRef<any>(null)

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const correctTranscript = useCallback(async (raw: string): Promise<string> => {
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
      return data.corrected ?? raw
    } catch {
      return raw
    }
  }, [agent, zone, recentContext])

  const startListening = useCallback(() => {
    if (!isSupported || disabled) return

    const w = window as any
    const SpeechRecognitionAPI = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) return

    const recognition = new SpeechRecognitionAPI()
    recognitionRef.current = recognition

    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => setVoiceState('listening')
    recognition.onend = () => setVoiceState(vs => vs === 'listening' ? 'idle' : vs)

    recognition.onresult = async (event: any) => {
      const results = Array.from(event.results) as any[]
      const last = results[results.length - 1]
      const transcript: string = last[0].transcript

      if (last.isFinal) {
        setVoiceState('processing')
        setInterimText('')
        const corrected = await correctTranscript(transcript)
        onTranscript(corrected, transcript)
        setVoiceState('idle')
      } else {
        setInterimText(transcript)
      }
    }

    recognition.onerror = (e: any) => {
      setVoiceState(e.error === 'not-allowed' ? 'error' : 'idle')
      setInterimText('')
    }

    recognition.start()
  }, [isSupported, disabled, correctTranscript, onTranscript])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setVoiceState('idle')
    setInterimText('')
  }, [])

  if (!isSupported) {
    return (
      <button
        disabled
        className="p-2 rounded-lg text-muted-foreground bg-muted/50 cursor-not-allowed"
        title="语音识别仅支持 Chrome/Edge 浏览器"
      >🎤</button>
    )
  }

  return (
    <div className="relative flex flex-col items-center gap-1">
      <AnimatePresence>
        {interimText && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap
              max-w-[200px] truncate bg-black/80 text-white text-xs px-2 py-1 rounded-lg z-20"
          >{interimText}</motion.div>
        )}
        {voiceState === 'processing' && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap
              bg-indigo-600 text-white text-xs px-2 py-1 rounded-lg z-20 flex items-center gap-1"
          >
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>⚙️</motion.span>
            AI 纠错中...
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onPointerDown={startListening}
        onPointerUp={voiceState === 'listening' ? stopListening : undefined}
        disabled={disabled || voiceState === 'processing'}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative p-2 rounded-lg transition-all duration-150 focus:outline-none
          ${voiceState === 'listening' ? 'bg-red-500 text-white shadow-lg shadow-red-500/40'
            : voiceState === 'processing' ? 'bg-indigo-500 text-white cursor-wait'
            : voiceState === 'error' ? 'bg-red-100 text-red-500'
            : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={voiceState === 'listening' ? '松开停止录音' : '按住说话（支持中英文，AI 自动纠错）'}
      >
        {voiceState === 'listening' && (
          <>
            <motion.span className="absolute inset-0 rounded-lg bg-red-500 opacity-40"
              animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 1, repeat: Infinity }} />
            <motion.span className="absolute inset-0 rounded-lg bg-red-500 opacity-20"
              animate={{ scale: [1, 2, 1], opacity: [0.2, 0, 0.2] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.3 }} />
          </>
        )}
        <span className="relative text-base">
          {voiceState === 'listening' ? '🔴' : voiceState === 'processing' ? '⚙️' : voiceState === 'error' ? '🚫' : '🎤'}
        </span>
      </motion.button>

      <span className="text-[9px] text-muted-foreground">
        {voiceState === 'listening' ? '聆听中...' : voiceState === 'processing' ? 'AI纠错' : '语音'}
      </span>
    </div>
  )
}
