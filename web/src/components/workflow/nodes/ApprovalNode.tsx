'use client'

import type { WorkflowNode, ApprovalNodeConfig } from '@/types/workflow'

interface ApprovalNodeProps {
  node: WorkflowNode
  selected: boolean
  onClick: () => void
}

export function ApprovalNode({ node, selected, onClick }: ApprovalNodeProps) {
  const config = node.config as ApprovalNodeConfig
  return (
    <div
      onClick={onClick}
      className={`
        min-w-[160px] rounded-xl border-2 cursor-pointer transition-all select-none
        bg-orange-500/20 border-orange-500/50
        ${selected ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-slate-900 scale-105' : 'hover:border-orange-400/80'}
      `}
    >
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">✋</span>
          <span className="text-xs font-semibold text-orange-200 truncate">{node.label}</span>
        </div>
        {config.prompt && (
          <div className="text-[10px] text-white/50 truncate max-w-[150px]">{config.prompt}</div>
        )}
        {config.approvers.length > 0 && (
          <div className="mt-1 text-[10px] text-orange-300/60">
            审批人: {config.approvers.slice(0, 2).join(', ')}{config.approvers.length > 2 ? ` +${config.approvers.length - 2}` : ''}
          </div>
        )}
        {config.timeout && (
          <div className="text-[9px] text-white/30">
            超时: {Math.round(config.timeout / 3600000)}h
          </div>
        )}
      </div>
      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-orange-400/60 border border-orange-300/60" />
      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-orange-400/60 border border-orange-300/60" />
    </div>
  )
}
