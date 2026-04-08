'use client'

import type { WorkflowNode } from '@/types/workflow'
import type { AgentNodeConfig } from '@/types/workflow'

interface AgentNodeProps {
  node: WorkflowNode
  selected: boolean
  onClick: () => void
}

export function AgentNode({ node, selected, onClick }: AgentNodeProps) {
  const config = node.config as AgentNodeConfig
  return (
    <div
      onClick={onClick}
      className={`
        min-w-[160px] rounded-xl border-2 cursor-pointer transition-all select-none
        bg-indigo-500/20 border-indigo-500/50
        ${selected ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900 scale-105' : 'hover:border-indigo-400/80'}
      `}
    >
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🤖</span>
          <span className="text-xs font-semibold text-indigo-200 truncate">{node.label}</span>
          {node.isStart && (
            <span className="ml-auto text-[9px] bg-green-500/30 text-green-300 border border-green-500/40 rounded-full px-1.5 py-0.5">START</span>
          )}
        </div>
        {config.agentId && (
          <div className="text-[10px] text-white/40 font-mono truncate">@{config.agentId}</div>
        )}
        {config.taskTemplate && (
          <div className="mt-1 text-[10px] text-white/50 truncate max-w-[150px]">{config.taskTemplate}</div>
        )}
        {config.timeout && (
          <div className="mt-1 flex items-center gap-1 text-[9px] text-white/30">
            <span>⏱</span>
            <span>{Math.round(config.timeout / 1000)}s</span>
            {config.retry && <span>· ↺{config.retry.maxAttempts}</span>}
          </div>
        )}
      </div>
      {/* Connection port indicators */}
      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-indigo-400/60 border border-indigo-300/60" />
      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-indigo-400/60 border border-indigo-300/60" />
    </div>
  )
}
