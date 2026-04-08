'use client'

import type { WorkflowNode, TimerNodeConfig, SubworkflowNodeConfig, NotificationNodeConfig, LoopNodeConfig } from '@/types/workflow'

interface NodeProps {
  node: WorkflowNode
  selected: boolean
  onClick: () => void
}

// ── Timer Node ─────────────────────────────────────────────────────────────────

export function TimerNode({ node, selected, onClick }: NodeProps) {
  const config = node.config as TimerNodeConfig
  return (
    <div
      onClick={onClick}
      className={`
        min-w-[140px] rounded-xl border-2 cursor-pointer transition-all select-none
        bg-purple-500/20 border-purple-500/50
        ${selected ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-900 scale-105' : 'hover:border-purple-400/80'}
      `}
    >
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">⏱</span>
          <span className="text-xs font-semibold text-purple-200">{node.label}</span>
        </div>
        {config.cron ? (
          <div className="text-[10px] font-mono text-purple-300/70">{config.cron}</div>
        ) : config.duration ? (
          <div className="text-[10px] text-purple-300/70">等待 {config.duration}</div>
        ) : null}
      </div>
      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-purple-400/60 border border-purple-300/60" />
      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-purple-400/60 border border-purple-300/60" />
    </div>
  )
}

// ── Sub-workflow Node ──────────────────────────────────────────────────────────

export function SubworkflowNode({ node, selected, onClick }: NodeProps) {
  const config = node.config as SubworkflowNodeConfig
  return (
    <div
      onClick={onClick}
      className={`
        min-w-[160px] rounded-xl border-2 cursor-pointer transition-all select-none
        bg-teal-500/20 border-teal-500/50
        ${selected ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-slate-900 scale-105' : 'hover:border-teal-400/80'}
      `}
    >
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📦</span>
          <span className="text-xs font-semibold text-teal-200 truncate">{node.label}</span>
        </div>
        {config.workflowId && (
          <div className="text-[10px] font-mono text-teal-300/70 truncate">→ {config.workflowId}</div>
        )}
        <div className="text-[9px] text-white/30">
          {config.waitForCompletion ? '同步等待' : '异步触发'}
        </div>
      </div>
      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-teal-400/60 border border-teal-300/60" />
      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-teal-400/60 border border-teal-300/60" />
    </div>
  )
}

// ── Notification Node ──────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<string, string> = {
  dingtalk: '🔔',
  slack: '💬',
  email: '📧',
  webhook: '🌐',
}

export function NotificationNode({ node, selected, onClick }: NodeProps) {
  const config = node.config as NotificationNodeConfig
  return (
    <div
      onClick={onClick}
      className={`
        min-w-[150px] rounded-xl border-2 cursor-pointer transition-all select-none
        bg-green-500/20 border-green-500/50
        ${selected ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-slate-900 scale-105' : 'hover:border-green-400/80'}
      `}
    >
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{CHANNEL_ICONS[config.channel] ?? '🔔'}</span>
          <span className="text-xs font-semibold text-green-200 truncate">{node.label}</span>
        </div>
        <div className="text-[10px] text-green-300/70 capitalize">{config.channel}</div>
        {config.template && (
          <div className="text-[10px] text-white/40 truncate max-w-[140px]">{config.template}</div>
        )}
      </div>
      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-400/60 border border-green-300/60" />
      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-400/60 border border-green-300/60" />
    </div>
  )
}

// ── Loop Node ──────────────────────────────────────────────────────────────────

export function LoopNode({ node, selected, onClick }: NodeProps) {
  const config = node.config as LoopNodeConfig
  return (
    <div
      onClick={onClick}
      className={`
        min-w-[150px] rounded-xl border-2 cursor-pointer transition-all select-none
        bg-rose-500/20 border-rose-500/50
        ${selected ? 'ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-900 scale-105' : 'hover:border-rose-400/80'}
      `}
    >
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🔁</span>
          <span className="text-xs font-semibold text-rose-200">{node.label}</span>
        </div>
        {config.condition && (
          <div className="text-[10px] font-mono text-rose-300/70 truncate max-w-[140px] bg-black/20 rounded px-1.5 py-0.5">
            {config.condition}
          </div>
        )}
        <div className="text-[9px] text-white/30 mt-0.5">最多 {config.maxIterations} 次</div>
      </div>
      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-rose-400/60 border border-rose-300/60" />
      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-rose-400/60 border border-rose-300/60" />
    </div>
  )
}
