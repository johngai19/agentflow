'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStudioStore, type ChatMessage } from '@/stores/studioStore'
import { ZONES } from '@/data/studioData'
import VoiceButton from './VoiceButton'

export default function AgentPanel() {
  const selectedAgentId = useStudioStore(s => s.selectedAgentId)
  const isPanelOpen = useStudioStore(s => s.isPanelOpen)
  const agents = useStudioStore(s => s.agents)
  const chatMessages = useStudioStore(s => s.chatMessages)
  const addMessage = useStudioStore(s => s.addMessage)
  const closePanel = useStudioStore(s => s.closePanel)

  const agent = agents.find(a => a.id === selectedAgentId)
  const zone = agent ? ZONES.find(z => z.id === agent.currentZone) : undefined
  const messages = selectedAgentId ? (chatMessages[selectedAgentId] ?? []) : []

  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  useEffect(() => {
    if (isPanelOpen) setTimeout(() => inputRef.current?.focus(), 300)
  }, [isPanelOpen, selectedAgentId])

  const recentContext = messages.slice(-4).map(m => `${m.role === 'user' ? '用户' : agent?.name}: ${m.content}`).join('\n')

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !agent || isStreaming) return

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    }
    addMessage(agent.id, userMsg)
    setInput('')
    setIsStreaming(true)
    setStreamingText('')

    try {
      const res = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          agent: { name: agent.name, role: agent.role, personality: agent.personality, tools: agent.tools, completedTasks: agent.completedTasks },
          zone: zone ? { name: zone.name } : null,
        }),
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setStreamingText(full)
      }

      const assistantMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        role: 'assistant',
        content: full,
        timestamp: Date.now(),
      }
      addMessage(agent.id, assistantMsg)
    } catch {
      const errMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        role: 'assistant',
        content: '⚠️ 连接失败，请检查 ANTHROPIC_API_KEY 环境变量配置。',
        timestamp: Date.now(),
      }
      addMessage(agent.id, errMsg)
    } finally {
      setIsStreaming(false)
      setStreamingText('')
    }
  }, [agent, messages, addMessage, isStreaming, zone])

  const handleVoiceTranscript = useCallback((corrected: string, raw: string) => {
    if (corrected.trim()) {
      setInput(corrected)
      // Show correction hint if different
      if (corrected !== raw) {
        console.log(`Voice corrected: "${raw}" → "${corrected}"`)
      }
    }
  }, [])

  if (!agent) return null

  return (
    <AnimatePresence>
      {isPanelOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
            onClick={closePanel}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[380px] bg-background border-l shadow-2xl z-40 flex flex-col"
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3 border-b"
              style={{ background: `linear-gradient(135deg, ${agent.color}22, transparent)` }}
            >
              {/* Avatar */}
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md flex-shrink-0"
                style={{ backgroundColor: agent.color }}
              >
                <span className="text-xl">{agent.emoji}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base">{agent.name}</h3>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {agent.role}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>{zone?.icon}</span>
                  <span>{zone?.name ?? '待命区'}</span>
                  <span>·</span>
                  <span>完成 {agent.completedTasks} 项任务</span>
                </div>
              </div>

              <button
                onClick={closePanel}
                className="p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground transition-colors"
              >✕</button>
            </div>

            {/* Agent info strip */}
            <div className="px-4 py-2 border-b bg-muted/30">
              <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {agent.tools.slice(0, 4).map(tool => (
                  <span key={tool} className="text-[10px] px-1.5 py-0.5 bg-background border rounded-md text-muted-foreground">
                    🔧 {tool}
                  </span>
                ))}
                {agent.tools.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">+{agent.tools.length - 4}</span>
                )}
              </div>
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && !isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-8"
                >
                  <div className="text-4xl mb-3">👋</div>
                  <p className="text-sm text-muted-foreground">
                    你好！我是 {agent.name}，{agent.role}。<br />
                    有什么我可以帮你的吗？
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    可以直接打字，或按住 🎤 说话
                  </p>
                </motion.div>
              )}

              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {msg.role === 'assistant' && (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: agent.color + '33' }}
                    >
                      {agent.emoji}
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                      ${msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-muted rounded-tl-sm'
                      }`}
                  >
                    {msg.content}
                    {msg.rawTranscript && msg.rawTranscript !== msg.content && (
                      <div className="mt-1 pt-1 border-t border-white/20 text-[10px] opacity-60">
                        🎤 原文：{msg.rawTranscript}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Streaming response */}
              {isStreaming && streamingText && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: agent.color + '33' }}
                  >
                    {agent.emoji}
                  </div>
                  <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-tl-sm bg-muted text-sm leading-relaxed">
                    {streamingText}
                    <span className="inline-block w-1 h-3 bg-current opacity-70 animate-pulse ml-0.5 align-middle" />
                  </div>
                </motion.div>
              )}

              {/* Typing indicator */}
              {isStreaming && !streamingText && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: agent.color + '33' }}>
                    {agent.emoji}
                  </div>
                  <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-muted flex gap-1 items-center">
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
                        animate={{ y: [-2, 2, -2] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="px-4 py-3 border-t bg-background">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage(input)
                    }
                  }}
                  placeholder={`给 ${agent.name} 下达指令...`}
                  rows={1}
                  disabled={isStreaming}
                  className="flex-1 resize-none rounded-xl border bg-muted/50 px-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/60
                    disabled:opacity-50 max-h-[120px] overflow-y-auto"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />

                <VoiceButton
                  agent={agent}
                  zone={zone}
                  recentContext={recentContext}
                  onTranscript={handleVoiceTranscript}
                  disabled={isStreaming}
                />

                <motion.button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isStreaming}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-40
                    disabled:cursor-not-allowed transition-opacity"
                >
                  {isStreaming ? (
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="block"
                    >⚙️</motion.span>
                  ) : '↑'}
                </motion.button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                Enter 发送 · Shift+Enter 换行 · 🎤 按住说话（AI 自动纠错专业术语）
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
