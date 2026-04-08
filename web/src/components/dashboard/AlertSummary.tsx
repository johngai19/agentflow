"use client"

// ─── AlertSummary ─────────────────────────────────────────────────────────────
// Derives alerts from agent errors/blocked + workflow failures and surfaces
// them as a prioritised list. No external alert data source needed.

import Link from 'next/link'
import useAgentStore from '@/stores/agentStore'
import { useWorkflowRunStore } from '@/stores/workflowRunStore'
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore'
import { cn } from '@/lib/utils'

// ─── Alert types ──────────────────────────────────────────────────────────────

type AlertSeverity = 'critical' | 'warning' | 'info'

interface Alert {
  id:       string
  severity: AlertSeverity
  title:    string
  detail:   string
  href?:    string
  ts:       number
}

const SEVERITY_CONFIG: Record<AlertSeverity, { icon: string; badge: string; border: string }> = {
  critical: { icon: '🔴', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',          border: 'border-red-500/30' },
  warning:  { icon: '🟡', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300', border: 'border-yellow-500/30' },
  info:     { icon: '🔵', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',        border: 'border-blue-500/20' },
}

function relativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs
  if (diff < 60_000)    return `${Math.floor(diff / 1_000)}秒前`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`
  return `${Math.floor(diff / 86_400_000)}天前`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AlertSummary() {
  const agents    = useAgentStore(s => s.agents)
  const runs      = useWorkflowRunStore(s => s.runs)
  const workflows = useWorkflowDesignerStore(s => s.workflows)

  // Derive alerts
  const alerts: Alert[] = []

  // 1. Error agents
  for (const a of agents.filter(a => a.status === 'error')) {
    alerts.push({
      id:       `agent-err-${a.id}`,
      severity: 'critical',
      title:    `Agent 错误：${a.name}`,
      detail:   a.lastAction,
      href:     '/agents',
      ts:       a.lastActionTime.getTime(),
    })
  }

  // 2. Blocked agents
  for (const a of agents.filter(a => a.status === 'blocked')) {
    alerts.push({
      id:       `agent-blocked-${a.id}`,
      severity: 'warning',
      title:    `Agent 阻塞：${a.name}`,
      detail:   a.currentTask ?? a.lastAction,
      href:     '/agents',
      ts:       a.lastActionTime.getTime(),
    })
  }

  // 3. Recently failed workflow runs (last 24h)
  const cutoff = Date.now() - 86_400_000
  const recentFailed = runs.filter(r => r.status === 'failed' && r.startedAt > cutoff)
  for (const r of recentFailed) {
    const wf = workflows.find(w => w.id === r.workflowId)
    const failedNode = r.nodeStates.find(ns => ns.status === 'failed')
    alerts.push({
      id:       `wf-fail-${r.id}`,
      severity: 'critical',
      title:    `工作流失败：${wf?.name ?? r.workflowId}`,
      detail:   failedNode?.error ?? '执行失败，请检查日志',
      href:     `/workflows/runs/${r.id}`,
      ts:       r.startedAt,
    })
  }

  // 4. Active runs > 30 min (potential hangs)
  const hangThreshold = 30 * 60_000
  for (const r of runs.filter(r => r.status === 'running')) {
    if (Date.now() - r.startedAt > hangThreshold) {
      const wf = workflows.find(w => w.id === r.workflowId)
      alerts.push({
        id:       `wf-hang-${r.id}`,
        severity: 'warning',
        title:    `工作流运行超时：${wf?.name ?? r.workflowId}`,
        detail:   `已运行 ${Math.round((Date.now() - r.startedAt) / 60_000)} 分钟，请确认是否正常`,
        href:     `/workflows/runs/${r.id}`,
        ts:       r.startedAt,
      })
    }
  }

  // Sort by severity then time (newest first)
  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => order[a.severity] - order[b.severity] || b.ts - a.ts)

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const warningCount  = alerts.filter(a => a.severity === 'warning').length

  return (
    <div className="space-y-3">
      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap">
        {criticalCount > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-medium">
            {criticalCount} 严重
          </span>
        )}
        {warningCount > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 font-medium">
            {warningCount} 警告
          </span>
        )}
        {alerts.length === 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-medium">
            系统正常
          </span>
        )}
      </div>

      {/* Alert list */}
      {alerts.length === 0 && (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <div className="text-2xl mb-1 opacity-40">✓</div>
          无活跃告警
        </div>
      )}

      <div className="space-y-2">
        {alerts.slice(0, 8).map(alert => {
          const cfg = SEVERITY_CONFIG[alert.severity]
          const inner = (
            <div className={cn(
              'rounded-lg border p-3 flex items-start gap-3',
              cfg.border,
              alert.href ? 'hover:bg-muted/30 transition-colors cursor-pointer' : ''
            )}>
              <span className="text-base flex-shrink-0">{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{alert.title}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{relativeTime(alert.ts)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{alert.detail}</p>
              </div>
            </div>
          )
          return alert.href
            ? <Link key={alert.id} href={alert.href}>{inner}</Link>
            : <div key={alert.id}>{inner}</div>
        })}
      </div>

      {alerts.length > 8 && (
        <p className="text-xs text-center text-muted-foreground">
          另有 {alerts.length - 8} 条告警未显示
        </p>
      )}
    </div>
  )
}
