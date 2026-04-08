"use client"

// ─── Workflow Runs List ────────────────────────────────────────────────────────
// Shows all workflow runs across all workflows with live status.

import { useState } from 'react'
import Link from 'next/link'
import { useWorkflowRunStore } from '@/stores/workflowRunStore'
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore'
import type { WorkflowRunStatus } from '@/types/workflow'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WorkflowRunStatus, {
  label: string; dot: string; badge: string; row: string
}> = {
  pending:   { label: '待执行', dot: 'bg-yellow-400',              badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300', row: '' },
  running:   { label: '运行中', dot: 'bg-blue-500 animate-pulse',  badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',         row: 'border-blue-500/30 bg-blue-500/5 dark:bg-blue-900/10' },
  success:   { label: '成功',   dot: 'bg-green-500',               badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',      row: '' },
  failed:    { label: '失败',   dot: 'bg-red-500',                  badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',              row: 'border-red-500/20' },
  cancelled: { label: '已取消', dot: 'bg-gray-400',                badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',             row: 'opacity-60' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1_000)  return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  return `${m}m${s > 0 ? ` ${s}s` : ''}`
}

function relativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs
  if (diff < 60_000)    return `${Math.floor(diff / 1_000)}秒前`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`
  return `${Math.floor(diff / 86_400_000)}天前`
}

const ALL_STATUSES: (WorkflowRunStatus | 'all')[] = ['all', 'running', 'success', 'failed', 'cancelled', 'pending']
const STATUS_LABELS: Record<WorkflowRunStatus | 'all', string> = {
  all: '全部', pending: '待执行', running: '运行中', success: '成功', failed: '失败', cancelled: '已取消',
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function WorkflowRunsPage() {
  const runs      = useWorkflowRunStore(s => s.runs)
  const cancelRun = useWorkflowRunStore(s => s.cancelRun)
  const workflows = useWorkflowDesignerStore(s => s.workflows)

  const [statusFilter, setStatusFilter] = useState<WorkflowRunStatus | 'all'>('all')
  const [wfFilter,     setWfFilter]     = useState<string>('all')

  // Derived
  const activeRuns   = runs.filter(r => r.status === 'running')
  const totalSuccess = runs.filter(r => r.status === 'success').length
  const totalFailed  = runs.filter(r => r.status === 'failed').length

  const filtered = runs
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .filter(r => wfFilter === 'all' || r.workflowId === wfFilter)
    .sort((a, b) => b.startedAt - a.startedAt)

  function wfName(workflowId: string): string {
    return workflows.find(w => w.id === workflowId)?.name ?? workflowId
  }
  function wfIcon(workflowId: string): string {
    return workflows.find(w => w.id === workflowId)?.icon ?? '🔄'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">工作流运行记录</h1>
          <p className="text-muted-foreground mt-1">
            共 {runs.length} 条运行记录 · {activeRuns.length} 个运行中
          </p>
        </div>
        <Link href="/workflows/designer">
          <Button variant="outline" className="gap-2">设计器 →</Button>
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '总运行次数', value: runs.length,    color: 'text-foreground' },
          { label: '运行中',     value: activeRuns.length, color: 'text-blue-600 dark:text-blue-400' },
          { label: '成功',       value: totalSuccess,   color: 'text-green-600 dark:text-green-400' },
          { label: '失败',       value: totalFailed,    color: 'text-red-600 dark:text-red-400' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <div className={cn('text-2xl font-bold', stat.color)}>{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active runs banner */}
      {activeRuns.length > 0 && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {activeRuns.length} 个工作流正在执行
          </span>
          <div className="flex gap-2 flex-wrap">
            {activeRuns.map(r => (
              <Link key={r.id} href={`/workflows/runs/${r.id}`}>
                <Badge variant="outline" className="text-xs border-blue-500/40 text-blue-600 cursor-pointer hover:bg-blue-500/10">
                  {wfIcon(r.workflowId)} {wfName(r.workflowId)}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Status filter */}
        <div className="flex gap-1 flex-wrap">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              )}
            >
              {STATUS_LABELS[s]}
              {s !== 'all' && (
                <span className="ml-1 opacity-70">
                  ({runs.filter(r => r.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Workflow filter */}
        <select
          value={wfFilter}
          onChange={e => setWfFilter(e.target.value)}
          className="ml-auto text-xs px-3 py-1.5 rounded-md border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">全部工作流</option>
          {workflows.map(w => (
            <option key={w.id} value={w.id}>{w.icon} {w.name}</option>
          ))}
        </select>
      </div>

      {/* Run list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            暂无匹配的运行记录
          </div>
        )}
        {filtered.map(run => {
          const cfg      = STATUS_CONFIG[run.status]
          const duration = run.finishedAt ? run.finishedAt - run.startedAt : null
          const done     = run.nodeStates.filter(s => s.status === 'success').length
          const total    = run.nodeStates.length

          return (
            <Card key={run.id} className={cn('transition-all hover:shadow-md', cfg.row)}>
              <CardContent className="p-0">
                <div className="flex items-center gap-0">
                  {/* Status stripe */}
                  <div className={cn('w-1 self-stretch rounded-l-lg flex-shrink-0', cfg.dot)} />

                  <div className="flex-1 px-4 py-3 flex items-center gap-4">
                    {/* Workflow icon + name */}
                    <div className="text-xl flex-shrink-0">{wfIcon(run.workflowId)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/workflows/runs/${run.id}`} className="text-sm font-semibold hover:underline truncate">
                          {wfName(run.workflowId)}
                        </Link>
                        <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">{run.id}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                        <span>触发人: {run.triggeredBy}</span>
                        <span>{relativeTime(run.startedAt)}</span>
                        {total > 0 && (
                          <span>{done}/{total} 节点</span>
                        )}
                      </div>
                    </div>

                    {/* Node progress bar */}
                    {total > 0 && (
                      <div className="hidden sm:flex gap-px items-end h-5 w-24 flex-shrink-0">
                        {run.nodeStates.map(ns => (
                          <div
                            key={ns.nodeId}
                            title={ns.nodeId}
                            className={cn(
                              'flex-1 rounded-sm',
                              ns.status === 'success' ? 'h-full bg-green-500' :
                              ns.status === 'failed'  ? 'h-full bg-red-500' :
                              ns.status === 'running' ? 'h-3 bg-blue-500 animate-pulse' :
                              ns.status === 'skipped' ? 'h-2 bg-yellow-400' :
                              'h-1 bg-muted-foreground/20'
                            )}
                          />
                        ))}
                      </div>
                    )}

                    {/* Duration */}
                    <div className="hidden md:block text-right flex-shrink-0 min-w-[70px]">
                      {duration != null ? (
                        <div className="text-sm font-mono">{formatDuration(duration)}</div>
                      ) : (
                        <div className="text-sm text-blue-600 dark:text-blue-400 animate-pulse">进行中</div>
                      )}
                      <div className="text-[10px] text-muted-foreground">耗时</div>
                    </div>

                    {/* Status badge */}
                    <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0', cfg.badge)}>
                      <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1.5', cfg.dot)} />
                      {cfg.label}
                    </span>

                    {/* Actions */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Link href={`/workflows/runs/${run.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs">详情</Button>
                      </Link>
                      {run.status === 'running' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                          onClick={() => cancelRun(run.id)}
                        >
                          取消
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
