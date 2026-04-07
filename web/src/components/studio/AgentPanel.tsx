'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStudioStore, type ChatMessage } from '@/stores/studioStore'
import { ZONES } from '@/data/studioData'
import VoiceButton from './VoiceButton'
import DispatchPanel from './DispatchPanel'
import WorkflowLinkEditor from './WorkflowLinkEditor'

// ── Markdown-lite renderer (bold + code blocks) ──
function renderContent(text: string) {
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const code = part.slice(3, -3).replace(/^\w+\n/, '')
      return (
        <pre key={i} className="mt-1 mb-1 bg-black/30 rounded p-2 text-[11px] overflow-x-auto whitespace-pre-wrap">
          <code>{code}</code>
        </pre>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-black/20 rounded px-1 text-[11px]">{part.slice(1, -1)}</code>
    }
    // Bold
    return <span key={i}>{part.split(/\*\*(.*?)\*\*/g).map((s, j) =>
      j % 2 === 1 ? <strong key={j}>{s}</strong> : s
    )}</span>
  })
}

export default function AgentPanel() {
  const selectedAgentId = useStudioStore(s => s.selectedAgentId)
  const isPanelOpen = useStudioStore(s => s.isPanelOpen)
  const panelMode = useStudioStore(s => s.panelMode)
  const sidebarLayout = useStudioStore(s => s.sidebarLayout)
  const agents = useStudioStore(s => s.agents)
  const chatMessages = useStudioStore(s => s.chatMessages)
  const addMessage = useStudioStore(s => s.addMessage)
  const closePanel = useStudioStore(s => s.closePanel)
  const setPanelMode = useStudioStore(s => s.setPanelMode)
  const setSidebarLayout = useStudioStore(s => s.setSidebarLayout)
  const scaleAgentPods = useStudioStore(s => s.scaleAgentPods)
  const clearChatHistory = useStudioStore(s => s.clearChatHistory)

  const agent = agents.find(a => a.id === selectedAgentId)
  const zone = agent ? ZONES.find(z => z.id === agent.currentZone) : undefined
  const messages = useMemo(
    () => selectedAgentId ? (chatMessages[selectedAgentId] ?? []) : [],
    [selectedAgentId, chatMessages]
  )

  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [artifacts, setArtifacts] = useState<string[]>([])
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

      // Extract code blocks as artifacts
      const codeBlocks = full.match(/```[\s\S]*?```/g) ?? []
      if (codeBlocks.length > 0) {
        setArtifacts(prev => [...prev, ...codeBlocks.map(b => b.slice(3, -3))])
      }
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
      if (corrected !== raw) {
        console.log(`Voice corrected: "${raw}" → "${corrected}"`)
      }
    }
  }, [])

  if (!agent) return null

  const isModal = panelMode === 'modal'
  const showArtifacts = sidebarLayout === 'split-artifacts' && artifacts.length > 0

  const panelContent = (
    <div className={`flex flex-col h-full ${showArtifacts ? 'min-h-0' : ''}`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
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
            {agent.isOrchestrator && <span className="text-xs">👑</span>}
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {agent.role}
            </span>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <span>{zone?.icon}</span>
            <span>{zone?.name ?? '待命区'}</span>
            <span>·</span>
            <span>✓ {agent.completedTasks} 项</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Sidebar layout toggle */}
          {!isModal && (
            <button
              onClick={() => setSidebarLayout(sidebarLayout === 'chat-only' ? 'split-artifacts' : 'chat-only')}
              className="p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground transition-colors text-xs"
              title={sidebarLayout === 'chat-only' ? '显示 Artifacts 面板' : '仅显示对话'}
            >
              {sidebarLayout === 'chat-only' ? '⊟' : '⊠'}
            </button>
          )}
          {/* Panel mode toggle */}
          <button
            onClick={() => setPanelMode(isModal ? 'sidebar' : 'modal')}
            className="p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground transition-colors text-xs"
            title={isModal ? '切换到侧边栏' : '切换到弹窗'}
          >
            {isModal ? '⇥' : '⊡'}
          </button>
          <button
            onClick={closePanel}
            className="p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground transition-colors"
          >✕</button>
        </div>
      </div>

      {/* Agent info strip */}
      <div className="px-4 py-2 border-b bg-muted/30 flex-shrink-0">
        <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>
        <div className="mt-1.5 flex flex-wrap gap-1 items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {agent.tools.slice(0, 4).map(tool => (
              <span key={tool} className="text-[10px] px-1.5 py-0.5 bg-background border rounded-md text-muted-foreground">
                🔧 {tool}
              </span>
            ))}
            {agent.tools.length > 4 && (
              <span className="text-[10px] text-muted-foreground">+{agent.tools.length - 4}</span>
            )}
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => clearChatHistory(agent.id)}
              className="text-[10px] text-muted-foreground/60 hover:text-destructive transition-colors ml-auto"
              title="清空对话记录"
            >🗑 清空</button>
          )}
        </div>
      </div>

      {/* Orchestrator dispatch panel */}
      {agent.isOrchestrator && (
        <div className="border-b flex-shrink-0">
          <DispatchPanel orchestratorId={agent.id} />
        </div>
      )}

      {/* Chat + optional artifacts split */}
      <div className={`flex-1 flex overflow-hidden ${showArtifacts ? 'flex-col' : ''}`}>
        {/* Chat messages */}
        <div className={`overflow-y-auto px-4 py-3 space-y-3 ${showArtifacts ? 'flex-1 min-h-0 border-b' : 'flex-1'}`}>
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
                {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
                {msg.rawTranscript && msg.rawTranscript !== msg.content && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-1.5 pt-1.5 border-t border-white/20 text-[10px] space-y-0.5"
                  >
                    <div className="flex items-center gap-1 text-white/40">
                      <span>🎤</span><span>AI 已纠正语音</span>
                    </div>
                    <div className="text-white/40 line-through">{msg.rawTranscript}</div>
                    <div className="text-green-400/80">→ {msg.content}</div>
                  </motion.div>
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
                {renderContent(streamingText)}
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

        {/* Artifacts pane */}
        {showArtifacts && (
          <div className="h-40 overflow-y-auto px-4 py-2 bg-muted/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">📎 Artifacts ({artifacts.length})</span>
              <button
                onClick={() => setArtifacts([])}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >清空</button>
            </div>
            <div className="space-y-2">
              {artifacts.map((a, i) => (
                <pre key={i} className="bg-background border rounded p-2 text-[10px] overflow-x-auto whitespace-pre-wrap">
                  <code>{a}</code>
                </pre>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pod scaling (kagent) */}
      {(agent.podCount !== undefined) && (
        <div className="px-4 py-2 border-t bg-muted/20 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">☸️ Pods</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => scaleAgentPods(agent.id, -1)}
                disabled={(agent.podCount ?? 1) <= 1}
                className="w-5 h-5 rounded flex items-center justify-center text-xs bg-muted hover:bg-muted/80 disabled:opacity-30"
              >−</button>
              <span className="text-xs font-mono w-4 text-center">{agent.podCount ?? 1}</span>
              <button
                onClick={() => scaleAgentPods(agent.id, 1)}
                disabled={(agent.podCount ?? 1) >= (agent.podMaxCount ?? 5)}
                className="w-5 h-5 rounded flex items-center justify-center text-xs bg-muted hover:bg-muted/80 disabled:opacity-30"
              >+</button>
            </div>
            <span className="text-[10px] text-muted-foreground">/ {agent.podMaxCount ?? 5} max</span>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: agent.podMaxCount ?? 5 }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-sm transition-colors"
                style={{ backgroundColor: i < (agent.podCount ?? 1) ? agent.color : '#e5e7eb' }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Workflow link editor */}
      <WorkflowLinkEditor agentId={agent.id} />

      {/* Input area */}
      <div className="px-4 py-3 border-t bg-background flex-shrink-0">
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
          Enter 发送 · Shift+Enter 换行 · 🎤 按住说话
        </p>
      </div>
    </div>
  )

  return (
    <AnimatePresence>
      {isPanelOpen && (
        <>
          {/* Backdrop (modal mode or mobile) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-30 ${isModal ? '' : 'lg:hidden'}`}
            onClick={closePanel}
          />

          {isModal ? (
            /* ── Modal popup ── */
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="fixed inset-x-4 top-16 bottom-16 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-16 sm:bottom-16 sm:w-[480px] bg-background border rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden"
            >
              {panelContent}
            </motion.div>
          ) : (
            /* ── Sidebar ── */
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[380px] bg-background border-l shadow-2xl z-40 flex flex-col"
            >
              {panelContent}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  )
}
