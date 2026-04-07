'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStudioStore } from '@/stores/studioStore'

interface WorkflowLinkEditorProps {
  agentId: string
}

/**
 * Displays the outbound workflow connections for a given agent and lets the
 * user add or remove links. This is surfaced inside AgentPanel beneath the
 * Pods scaling row.
 */
export default function WorkflowLinkEditor({ agentId }: WorkflowLinkEditorProps) {
  const agents = useStudioStore(s => s.agents)
  const workflowLinks = useStudioStore(s => s.workflowLinks)
  const addWorkflowLink = useStudioStore(s => s.addWorkflowLink)
  const removeWorkflowLink = useStudioStore(s => s.removeWorkflowLink)

  const [isOpen, setIsOpen] = useState(false)
  const [newTarget, setNewTarget] = useState('')

  // Links that originate from this agent
  const outboundLinks = workflowLinks.filter(l => l.fromId === agentId)

  // Agents that are not already linked and are not self
  const linkableAgents = agents.filter(
    a => a.id !== agentId && !outboundLinks.some(l => l.toId === a.id)
  )

  const handleAdd = () => {
    if (!newTarget) return
    addWorkflowLink(agentId, newTarget)
    setNewTarget('')
  }

  return (
    <div className="px-4 py-2 border-t bg-muted/10 flex-shrink-0">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span>↔</span>
          <span className="font-medium">工作流连接</span>
          {outboundLinks.length > 0 && (
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 rounded-full px-1.5 py-0.5">
              {outboundLinks.length}
            </span>
          )}
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          className="text-indigo-400/60 text-[10px]"
        >▼</motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-2">
              {/* Current outbound connections */}
              {outboundLinks.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-1">
                  暂无连接
                </p>
              ) : (
                <div className="space-y-1">
                  {outboundLinks.map(link => {
                    const target = agents.find(a => a.id === link.toId)
                    if (!target) return null
                    return (
                      <div
                        key={link.toId}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20"
                      >
                        <div className="flex items-center gap-1.5 text-xs text-foreground min-w-0">
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: target.color }}
                          />
                          <span className="truncate">{target.emoji} {target.name}</span>
                          <span className="text-muted-foreground text-[10px] flex-shrink-0">
                            {target.role}
                          </span>
                        </div>
                        <button
                          onClick={() => removeWorkflowLink(agentId, link.toId)}
                          className="text-[10px] text-muted-foreground/60 hover:text-red-400 transition-colors flex-shrink-0"
                          title="删除连接"
                        >✕</button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add new connection */}
              {linkableAgents.length > 0 && (
                <div className="flex gap-1.5 items-center">
                  <select
                    value={newTarget}
                    onChange={e => setNewTarget(e.target.value)}
                    className="flex-1 text-xs bg-muted border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  >
                    <option value="">选择目标 Agent…</option>
                    {linkableAgents.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.emoji} {a.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAdd}
                    disabled={!newTarget}
                    className="text-xs px-2 py-1 rounded bg-indigo-500/20 border border-indigo-500/40
                      text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed
                      transition-colors flex-shrink-0"
                  >+ 添加</button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
