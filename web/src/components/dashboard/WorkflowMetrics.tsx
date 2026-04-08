"use client"

// ─── WorkflowMetrics ──────────────────────────────────────────────────────────
// Displays workflow completion/failure trend as an inline sparkline bar chart
// plus aggregate metrics, sourced from workflowRunStore.

import { useWorkflowRunStore } from '@/stores/workflowRunStore'
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1_000)  return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  return `${m}m${s > 0 ? ` ${s}s` : ''}`
}

// Group runs into N time buckets (most recent on the right)
function bucketRuns(
  runs: { startedAt: number; status: string }[],
  buckets: number,
  windowMs: number,
) {
  const now   = Date.now()
  const start = now - windowMs
  const size  = windowMs / buckets

  return Array.from({ length: buckets }, (_, i) => {
    const lo = start + size * i
    const hi = start + size * (i + 1)
    const slice = runs.filter(r => r.startedAt >= lo && r.startedAt < hi)
    return {
      success:   slice.filter(r => r.status === 'success').length,
      failed:    slice.filter(r => r.status === 'failed').length,
      running:   slice.filter(r => r.status === 'running').length,
      cancelled: slice.filter(r => r.status === 'cancelled').length,
      total:     slice.length,
    }
  })
}

// ─── Sparkline bar ────────────────────────────────────────────────────────────

interface SparkBarProps {
  success:   number
  failed:    number
  running:   number
  cancelled: number
  maxTotal:  number
}

function SparkBar({ success, failed, running, cancelled, maxTotal }: SparkBarProps) {
  const total = success + failed + running + cancelled
  if (total === 0 || maxTotal === 0) {
    return <div className="flex-1 h-full flex items-end"><div className="w-full h-1 rounded-sm bg-muted-foreground/10" /></div>
  }
  const heightPct = Math.round((total / maxTotal) * 100)
  return (
    <div className="flex-1 h-full flex items-end">
      <div
        className="w-full rounded-sm flex flex-col-reverse overflow-hidden transition-all duration-500"
        style={{ height: `${Math.max(heightPct, 8)}%` }}
      >
        {success   > 0 && <div className="bg-green-500"  style={{ flex: success }} />}
        {running   > 0 && <div className="bg-blue-500 animate-pulse" style={{ flex: running }} />}
        {failed    > 0 && <div className="bg-red-500"    style={{ flex: failed }} />}
        {cancelled > 0 && <div className="bg-gray-400"   style={{ flex: cancelled }} />}
      </div>
    </div>
  )
}

// ─── Per-workflow row ─────────────────────────────────────────────────────────

interface WorkflowRowProps {
  workflowId:   string
  workflowName: string
  workflowIcon: string
}

function WorkflowRow({ workflowId, workflowName, workflowIcon }: WorkflowRowProps) {
  const getRunsForWorkflow = useWorkflowRunStore(s => s.getRunsForWorkflow)
  const getSuccessRate     = useWorkflowRunStore(s => s.getSuccessRate)
  const getAvgDurationMs   = useWorkflowRunStore(s => s.getAvgDurationMs)

  const runs    = getRunsForWorkflow(workflowId)
  const rate    = getSuccessRate(workflowId)
  const avgMs   = getAvgDurationMs(workflowId)
  const buckets = bucketRuns(runs, 12, 72 * 3_600_000) // 72h window, 12 buckets (6h each)
  const maxTotal = Math.max(...buckets.map(b => b.total), 1)
  const active  = runs.filter(r => r.status === 'running').length

  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      {/* Workflow name */}
      <span className="text-lg flex-shrink-0">{workflowIcon}</span>
      <div className="w-36 min-w-0 flex-shrink-0">
        <div className="text-sm font-medium truncate">{workflowName}</div>
        <div className="text-[10px] text-muted-foreground">{runs.length} 次运行</div>
      </div>

      {/* Sparkline */}
      <div className="flex-1 flex gap-0.5 h-8">
        {buckets.map((b, i) => (
          <SparkBar key={i} {...b} maxTotal={maxTotal} />
        ))}
      </div>

      {/* Success rate */}
      <div className={cn(
        'flex-shrink-0 text-sm font-bold w-10 text-right',
        rate >= 90 ? 'text-green-600 dark:text-green-400' :
        rate >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
        'text-red-600'
      )}>
        {runs.length > 0 ? `${rate}%` : '—'}
      </div>

      {/* Avg duration */}
      <div className="flex-shrink-0 text-xs text-muted-foreground w-14 text-right font-mono">
        {avgMs != null ? formatDuration(avgMs) : '—'}
      </div>

      {/* Active indicator */}
      <div className="flex-shrink-0 w-12 text-right">
        {active > 0 ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
            {active} 中
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function WorkflowMetrics() {
  const workflows = useWorkflowDesignerStore(s => s.workflows)
  const allRuns   = useWorkflowRunStore(s => s.runs)

  const totalRuns    = allRuns.length
  const activeRuns   = allRuns.filter(r => r.status === 'running').length
  const successRuns  = allRuns.filter(r => r.status === 'success').length
  const failedRuns   = allRuns.filter(r => r.status === 'failed').length
  const overallRate  = totalRuns > 0 ? Math.round((successRuns / (successRuns + failedRuns || 1)) * 100) : 100

  return (
    <div className="space-y-4">
      {/* Aggregate metrics */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: '总运行',   value: totalRuns,    color: '' },
          { label: '运行中',   value: activeRuns,   color: 'text-blue-600 dark:text-blue-400' },
          { label: '整体成功率', value: `${overallRate}%`, color: overallRate >= 90 ? 'text-green-600' : overallRate >= 70 ? 'text-yellow-600' : 'text-red-600' },
          { label: '失败',     value: failedRuns,   color: failedRuns > 0 ? 'text-red-600' : 'text-muted-foreground' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Column headers */}
      {workflows.length > 0 && (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase tracking-wider px-0">
          <div className="w-6 flex-shrink-0" />
          <div className="w-36 flex-shrink-0">工作流</div>
          <div className="flex-1 text-center">趋势（72h）</div>
          <div className="w-10 text-right flex-shrink-0">成功率</div>
          <div className="w-14 text-right flex-shrink-0">均耗时</div>
          <div className="w-12 text-right flex-shrink-0">状态</div>
        </div>
      )}

      {/* Per-workflow rows */}
      {workflows.map(wf => (
        <WorkflowRow
          key={wf.id}
          workflowId={wf.id}
          workflowName={wf.name}
          workflowIcon={wf.icon}
        />
      ))}

      {workflows.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4">
          尚无工作流数据
        </div>
      )}
    </div>
  )
}
