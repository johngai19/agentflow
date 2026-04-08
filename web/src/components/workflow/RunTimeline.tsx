"use client"

// ─── RunTimeline ──────────────────────────────────────────────────────────────
// Renders a vertical timeline of workflow node states.
// Each row is expandable to show input/output detail.

import { useState } from 'react'
import type { WorkflowNodeRunState, WorkflowRun } from '@/types/workflow'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  waiting:  { label: '等待中',   dot: 'bg-gray-300 dark:bg-gray-600', badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', icon: '⏳' },
  running:  { label: '执行中',   dot: 'bg-blue-500 animate-pulse',    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', icon: '▶' },
  success:  { label: '成功',     dot: 'bg-green-500',                  badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', icon: '✓' },
  failed:   { label: '失败',     dot: 'bg-red-500',                    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', icon: '✗' },
  skipped:  { label: '已跳过',   dot: 'bg-yellow-400',                 badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300', icon: '↷' },
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDurationMs(ms: number): string {
  if (ms < 1_000)  return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  return `${m}m${s > 0 ? ` ${s}s` : ''}`
}

function relativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs
  if (diff < 60_000)  return `${Math.floor(diff / 1_000)}秒前`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  return `${Math.floor(diff / 3_600_000)}小时前`
}

// ─── Single timeline row ──────────────────────────────────────────────────────

interface TimelineRowProps {
  state:    WorkflowNodeRunState
  nodeLabel?: string
  isLast:   boolean
  index:    number
}

function TimelineRow({ state, nodeLabel, isLast, index }: TimelineRowProps) {
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIG[state.status]
  const duration =
    state.startedAt && state.finishedAt
      ? state.finishedAt - state.startedAt
      : null
  const canExpand = !!(state.output || state.error)

  return (
    <div className="relative flex gap-4">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
      )}

      {/* Status dot */}
      <div className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 border-background bg-background flex items-center justify-center mt-0.5">
        <span className={cn('w-3.5 h-3.5 rounded-full', cfg.dot)} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-lg border px-4 py-3',
            'bg-card transition-colors',
            canExpand ? 'cursor-pointer hover:bg-muted/40' : '',
            state.status === 'running' ? 'border-blue-500/40 shadow-sm shadow-blue-500/10' : '',
            state.status === 'failed'  ? 'border-red-500/40' : '',
          )}
          onClick={() => canExpand && setExpanded(v => !v)}
        >
          {/* Left: index + label */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-mono text-muted-foreground flex-shrink-0 w-5 text-center">
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">
                {nodeLabel ?? state.nodeId}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono truncate">
                {state.nodeId}
              </div>
            </div>
          </div>

          {/* Right: status + timing */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {duration != null && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {formatDurationMs(duration)}
              </span>
            )}
            {state.startedAt && (
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                {relativeTime(state.startedAt)}
              </span>
            )}
            <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', cfg.badge)}>
              {cfg.icon} {cfg.label}
            </span>
            {canExpand && (
              <span className="text-muted-foreground text-xs">{expanded ? '▲' : '▼'}</span>
            )}
          </div>
        </div>

        {/* Expandable detail */}
        {expanded && (
          <div className="mt-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-2">
            {state.output && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">输出</p>
                <pre className="text-xs whitespace-pre-wrap break-all text-foreground font-mono bg-background rounded p-2 border">
                  {state.output}
                </pre>
              </div>
            )}
            {state.error && (
              <div>
                <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider mb-1">错误</p>
                <pre className="text-xs whitespace-pre-wrap break-all text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-950/20 rounded p-2 border border-red-200 dark:border-red-900">
                  {state.error}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function RunProgressBar({ states }: { states: WorkflowNodeRunState[] }) {
  const total   = states.length
  const done    = states.filter(s => s.status === 'success' || s.status === 'skipped').length
  const failed  = states.filter(s => s.status === 'failed').length
  const running = states.filter(s => s.status === 'running').length

  return (
    <div className="space-y-1">
      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-muted">
        {states.map(s => (
          <div
            key={s.nodeId}
            className={cn(
              'flex-1 transition-all duration-500',
              s.status === 'success' ? 'bg-green-500' :
              s.status === 'failed'  ? 'bg-red-500' :
              s.status === 'running' ? 'bg-blue-500 animate-pulse' :
              s.status === 'skipped' ? 'bg-yellow-400' :
              'bg-muted-foreground/20'
            )}
          />
        ))}
      </div>
      <div className="flex gap-3 text-[11px] text-muted-foreground">
        <span>{done} / {total} 节点完成</span>
        {running > 0 && <span className="text-blue-600 dark:text-blue-400">{running} 执行中</span>}
        {failed > 0  && <span className="text-red-600">{failed} 失败</span>}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export interface RunTimelineProps {
  run: WorkflowRun
  /** Optional map of nodeId → human-readable label */
  nodeLabels?: Record<string, string>
  /** Show a compact version (no per-node expand, fewer details) */
  compact?: boolean
}

export function RunTimeline({ run, nodeLabels = {}, compact = false }: RunTimelineProps) {
  if (run.nodeStates.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        该运行没有节点状态记录
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <RunProgressBar states={run.nodeStates} />

      {/* Timeline rows */}
      {!compact && (
        <div className="pt-2">
          {run.nodeStates.map((state, i) => (
            <TimelineRow
              key={state.nodeId}
              state={state}
              nodeLabel={nodeLabels[state.nodeId]}
              isLast={i === run.nodeStates.length - 1}
              index={i}
            />
          ))}
        </div>
      )}

      {/* Compact mode: just badge pills */}
      {compact && (
        <div className="flex flex-wrap gap-2">
          {run.nodeStates.map((state, i) => {
            const cfg = STATUS_CONFIG[state.status]
            return (
              <Badge
                key={state.nodeId}
                variant="outline"
                className={cn('text-[11px] gap-1', cfg.badge)}
              >
                <span>{cfg.icon}</span>
                {nodeLabels[state.nodeId] ?? `节点 ${i + 1}`}
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
