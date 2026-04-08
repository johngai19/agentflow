"use client"

// ─── Workflow Run Detail ───────────────────────────────────────────────────────
// Shows full execution timeline + per-step I/O for a single run.

import { use } from 'react'
import Link from 'next/link'
import { useWorkflowRunStore } from '@/stores/workflowRunStore'
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore'
import { RunTimeline } from '@/components/workflow/RunTimeline'
import type { WorkflowRunStatus } from '@/types/workflow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WorkflowRunStatus, { label: string; badge: string; dot: string }> = {
  pending:   { label: '待执行', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300', dot: 'bg-yellow-400' },
  running:   { label: '运行中', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',         dot: 'bg-blue-500 animate-pulse' },
  success:   { label: '成功',   badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',     dot: 'bg-green-500' },
  failed:    { label: '失败',   badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',             dot: 'bg-red-500' },
  cancelled: { label: '已取消', badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',            dot: 'bg-gray-400' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1_000)  return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  return `${m}m${s > 0 ? ` ${s}s` : ''}`
}

function formatDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const run      = useWorkflowRunStore(s => s.getRunById(id))
  const cancelRun = useWorkflowRunStore(s => s.cancelRun)
  const workflows = useWorkflowDesignerStore(s => s.workflows)

  if (!run) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">🔍</div>
        <h1 className="text-xl font-semibold mb-2">未找到运行记录</h1>
        <p className="text-muted-foreground mb-6">运行 ID: <code className="text-sm font-mono">{id}</code></p>
        <Link href="/workflows/runs">
          <Button variant="outline">← 返回运行列表</Button>
        </Link>
      </div>
    )
  }

  const workflow = workflows.find(w => w.id === run.workflowId)
  const cfg = STATUS_CONFIG[run.status]
  const duration = run.finishedAt ? run.finishedAt - run.startedAt : null

  // Build nodeId → label map from workflow definition
  const nodeLabels: Record<string, string> = {}
  if (workflow) {
    for (const node of workflow.nodes) {
      nodeLabels[node.id] = node.label
    }
  }

  const successCount  = run.nodeStates.filter(s => s.status === 'success').length
  const failedCount   = run.nodeStates.filter(s => s.status === 'failed').length
  const runningCount  = run.nodeStates.filter(s => s.status === 'running').length
  const waitingCount  = run.nodeStates.filter(s => s.status === 'waiting').length

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/workflows" className="hover:text-foreground">工作流</Link>
        <span>/</span>
        <Link href="/workflows/runs" className="hover:text-foreground">运行记录</Link>
        <span>/</span>
        <span className="text-foreground font-mono text-xs">{run.id}</span>
      </nav>

      {/* Run header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-3xl">{workflow?.icon ?? '🔄'}</span>
            <div>
              <h1 className="text-2xl font-bold">
                {workflow?.name ?? run.workflowId}
              </h1>
              <p className="text-sm text-muted-foreground font-mono">{run.id}</p>
            </div>
            <span className={cn('text-sm px-3 py-1 rounded-full font-medium', cfg.badge)}>
              <span className={cn('inline-block w-2 h-2 rounded-full mr-1.5', cfg.dot)} />
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {run.status === 'running' && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={() => cancelRun(run.id)}
            >
              取消运行
            </Button>
          )}
          {workflow && (
            <Link href={`/workflows/designer`}>
              <Button variant="outline" size="sm">查看工作流</Button>
            </Link>
          )}
          <Link href="/workflows/runs">
            <Button variant="ghost" size="sm">← 返回列表</Button>
          </Link>
        </div>
      </div>

      {/* Metadata cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">触发时间</div>
            <div className="text-sm font-medium">{formatDateTime(run.startedAt)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">触发人</div>
            <div className="text-sm font-medium">{run.triggeredBy}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">耗时</div>
            <div className={cn('text-sm font-medium font-mono', run.status === 'running' ? 'text-blue-600 dark:text-blue-400' : '')}>
              {duration != null ? formatDuration(duration) : '进行中...'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">节点状态</div>
            <div className="text-sm font-medium">
              <span className="text-green-600">{successCount}✓</span>
              {failedCount  > 0 && <span className="text-red-600 ml-1">{failedCount}✗</span>}
              {runningCount > 0 && <span className="text-blue-600 ml-1">{runningCount}▶</span>}
              {waitingCount > 0 && <span className="text-muted-foreground ml-1">{waitingCount}⏳</span>}
              <span className="text-muted-foreground ml-1">/ {run.nodeStates.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Finish time (only if completed) */}
      {run.finishedAt && (
        <div className="text-sm text-muted-foreground">
          完成时间：{formatDateTime(run.finishedAt)}
        </div>
      )}

      {/* Timeline */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <span>执行时间线</span>
            <Badge variant="outline" className="text-xs">{run.nodeStates.length} 节点</Badge>
          </h2>
          <RunTimeline run={run} nodeLabels={nodeLabels} />
        </CardContent>
      </Card>

      {/* Raw run info for debugging */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-2 select-none">
          调试信息（运行原始数据）
        </summary>
        <pre className="mt-2 p-4 bg-muted rounded-lg overflow-x-auto font-mono text-[11px]">
          {JSON.stringify({ id: run.id, workflowId: run.workflowId, status: run.status, triggeredBy: run.triggeredBy, startedAt: run.startedAt, finishedAt: run.finishedAt }, null, 2)}
        </pre>
      </details>
    </div>
  )
}
