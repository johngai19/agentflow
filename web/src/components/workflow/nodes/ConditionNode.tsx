'use client'

import type { WorkflowNode, ConditionNodeConfig } from '@/types/workflow'

interface ConditionNodeProps {
  node: WorkflowNode
  selected: boolean
  onClick: () => void
}

export function ConditionNode({ node, selected, onClick }: ConditionNodeProps) {
  const config = node.config as ConditionNodeConfig
  return (
    <div
      onClick={onClick}
      className={`
        min-w-[160px] rounded-xl border-2 cursor-pointer transition-all select-none
        bg-yellow-500/20 border-yellow-500/50
        ${selected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900 scale-105' : 'hover:border-yellow-400/80'}
      `}
    >
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">⚡</span>
          <span className="text-xs font-semibold text-yellow-200 truncate">{node.label}</span>
        </div>
        {config.expression && (
          <div className="text-[10px] font-mono text-yellow-300/70 truncate max-w-[150px] bg-black/20 rounded px-1.5 py-0.5">
            {config.expression}
          </div>
        )}
        <div className="mt-1 flex items-center gap-2 text-[9px]">
          <span className="text-green-400">✓ {config.trueBranchLabel ?? 'Yes'}</span>
          <span className="text-red-400">✗ {config.falseBranchLabel ?? 'No'}</span>
        </div>
      </div>
      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-yellow-400/60 border border-yellow-300/60" />
      <div className="absolute -right-1.5 top-1/3 -translate-y-1/2 w-3 h-3 rounded-full bg-green-400/60 border border-green-300/60" />
      <div className="absolute -right-1.5 top-2/3 -translate-y-1/2 w-3 h-3 rounded-full bg-red-400/60 border border-red-300/60" />
    </div>
  )
}
