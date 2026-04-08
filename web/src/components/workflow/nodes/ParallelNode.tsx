'use client'

import type { WorkflowNode, ParallelForkNodeConfig, ParallelJoinNodeConfig } from '@/types/workflow'

interface ParallelNodeProps {
  node: WorkflowNode
  selected: boolean
  onClick: () => void
}

export function ParallelForkNode({ node, selected, onClick }: ParallelNodeProps) {
  const config = node.config as ParallelForkNodeConfig
  return (
    <div
      onClick={onClick}
      className={`
        min-w-[140px] rounded-xl border-2 cursor-pointer transition-all select-none
        bg-cyan-500/20 border-cyan-500/50
        ${selected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 scale-105' : 'hover:border-cyan-400/80'}
      `}
    >
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">⑂</span>
          <span className="text-xs font-semibold text-cyan-200">{node.label}</span>
        </div>
        <div className="text-[10px] text-cyan-300/60">
          {config.branchCount ?? 2} 条并行分支
        </div>
      </div>
      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan-400/60 border border-cyan-300/60" />
      <div className="absolute -right-1.5 top-1/4 w-3 h-3 rounded-full bg-cyan-400/60 border border-cyan-300/60" />
      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan-400/60 border border-cyan-300/60" />
      <div className="absolute -right-1.5 top-3/4 w-3 h-3 rounded-full bg-cyan-400/60 border border-cyan-300/60" />
    </div>
  )
}

export function ParallelJoinNode({ node, selected, onClick }: ParallelNodeProps) {
  const config = node.config as ParallelJoinNodeConfig
  const strategyLabel: Record<string, string> = {
    wait_all: '等待全部',
    wait_any: '等待任意',
    wait_n: `等待 ${(config as ParallelJoinNodeConfig).waitN ?? '?'} 条`,
  }
  return (
    <div
      onClick={onClick}
      className={`
        min-w-[140px] rounded-xl border-2 cursor-pointer transition-all select-none
        bg-cyan-500/20 border-cyan-500/50
        ${selected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 scale-105' : 'hover:border-cyan-400/80'}
      `}
    >
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">⑃</span>
          <span className="text-xs font-semibold text-cyan-200">{node.label}</span>
        </div>
        <div className="text-[10px] text-cyan-300/60">
          {strategyLabel[config.mergeStrategy] ?? config.mergeStrategy}
        </div>
      </div>
      <div className="absolute -left-1.5 top-1/4 w-3 h-3 rounded-full bg-cyan-400/60 border border-cyan-300/60" />
      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan-400/60 border border-cyan-300/60" />
      <div className="absolute -left-1.5 top-3/4 w-3 h-3 rounded-full bg-cyan-400/60 border border-cyan-300/60" />
      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan-400/60 border border-cyan-300/60" />
    </div>
  )
}
