"use client"

// ─── ActiveWorkflows ──────────────────────────────────────────────────────────
// Shows currently running workflow executions with live progress.

import Link from 'next/link'
import { useWorkflowRunStore } from '@/stores/workflowRunStore'
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function elapsed(startedAt: number): string {
  const ms = Date.now() - startedAt
  if (ms < 60_000) return `${Math.floor(ms / 1_000)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1_000)}s`
}

export function ActiveWorkflows() {
  const runs      = useWorkflowRunStore(s => s.getActiveRuns())
  const cancelRun = useWorkflowRunStore(s => s.cancelRun)
  const workflows = useWorkflowDesignerStore(s => s.workflows)

  if (runs.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <div className="text-2xl mb-2 opacity-40">⚡</div>
        暂无活跃工作流
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {runs.map(run => {
        const wf      = workflows.find(w => w.id === run.workflowId)
        const total   = run.nodeStates.length
        const done    = run.nodeStates.filter(s => s.status === 'success').length
        const failed  = run.nodeStates.filter(s => s.status === 'failed').length
        const current = run.nodeStates.find(s => s.status === 'running')
        const currentLabel = wf?.nodes.find(n => n.id === current?.nodeId)?.label ?? current?.nodeId ?? '准备中'

        return (
          <div
            key={run.id}
            className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-3"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl flex-shrink-0">{wf?.icon ?? '🔄'}</span>
                <div className="min-w-0">
                  <Link href={`/workflows/runs/${run.id}`} className="text-sm font-semibold hover:underline truncate block">
                    {wf?.name ?? run.workflowId}
                  </Link>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                    <span className="font-mono">{run.id}</span>
                    <span>·</span>
                    <span>已运行 {elapsed(run.startedAt)}</span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] text-destructive hover:bg-destructive/10 flex-shrink-0"
                onClick={() => cancelRun(run.id)}
              >
                取消
              </Button>
            </div>

            {/* Current step indicator */}
            <div className="flex items-center gap-2 text-[11px] text-blue-700 dark:text-blue-300">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping inline-block" />
              <span className="font-medium">当前步骤：</span>
              <span>{currentLabel}</span>
            </div>

            {/* Node progress bar */}
            <div className="space-y-1">
              <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
                {run.nodeStates.map(ns => (
                  <div
                    key={ns.nodeId}
                    title={wf?.nodes.find(n => n.id === ns.nodeId)?.label ?? ns.nodeId}
                    className={cn(
                      'flex-1 transition-all duration-500',
                      ns.status === 'success' ? 'bg-green-500' :
                      ns.status === 'failed'  ? 'bg-red-500' :
                      ns.status === 'running' ? 'bg-blue-500 animate-pulse' :
                      'bg-muted-foreground/20'
                    )}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{done} 完成 {failed > 0 ? `· ${failed} 失败` : ''}</span>
                <span>{done} / {total}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
