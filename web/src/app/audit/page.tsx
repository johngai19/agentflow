"use client"

// ─── Audit Log Page ────────────────────────────────────────────────────────────
// Time range selector · operation-type filter · severity filter · free search

import { useState, useCallback } from 'react'
import { useAuditLogStore } from '@/stores/auditLogStore'
import { AuditLogTable }    from '@/components/audit/AuditLogTable'
import { Card, CardContent } from '@/components/ui/card'
import { Badge }             from '@/components/ui/badge'
import { Button }            from '@/components/ui/button'
import { Input }             from '@/components/ui/input'
import type {
  AuditActionType,
  AuditResourceType,
  AuditSeverity,
} from '@/types/audit'

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_OPTIONS: AuditSeverity[] = ['info', 'warning', 'error']

const RESOURCE_OPTIONS: AuditResourceType[] = [
  'workflow', 'run', 'node', 'orchestration', 'agent', 'system',
]

const ACTION_GROUPS: { label: string; actions: AuditActionType[] }[] = [
  {
    label: '工作流',
    actions: [
      'workflow.created', 'workflow.updated', 'workflow.deleted',
      'workflow.enabled', 'workflow.disabled',
    ],
  },
  {
    label: '运行',
    actions: ['run.triggered', 'run.cancelled', 'run.completed', 'run.failed'],
  },
  {
    label: '节点',
    actions: ['node.started', 'node.completed', 'node.failed'],
  },
  {
    label: '编排',
    actions: [
      'orchestration.created', 'orchestration.updated',
      'orchestration.deleted', 'orchestration.triggered',
    ],
  },
  {
    label: 'Agent',
    actions: ['agent.started', 'agent.stopped', 'agent.error'],
  },
  {
    label: '系统',
    actions: ['system.config_changed', 'system.login', 'system.logout'],
  },
]

const SEVERITY_STYLE: Record<AuditSeverity, string> = {
  info:    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  error:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

// ─── Quick time range presets ─────────────────────────────────────────────────

type TimePreset = '1h' | '24h' | '7d' | '30d' | 'all'

function presetToRange(preset: TimePreset): { fromTs?: number; toTs?: number } {
  if (preset === 'all') return {}
  const ms: Record<Exclude<TimePreset, 'all'>, number> = {
    '1h':  60 * 60_000,
    '24h': 24 * 60 * 60_000,
    '7d':  7  * 24 * 60 * 60_000,
    '30d': 30 * 24 * 60 * 60_000,
  }
  return { fromTs: Date.now() - ms[preset as Exclude<TimePreset, 'all'>] }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const filter         = useAuditLogStore(s => s.filter)
  const setFilter      = useAuditLogStore(s => s.setFilter)
  const resetFilter    = useAuditLogStore(s => s.resetFilter)
  const getFiltered    = useAuditLogStore(s => s.getFiltered)
  const getCountBySeverity = useAuditLogStore(s => s.getCountBySeverity)

  const [timePreset, setTimePreset] = useState<TimePreset>('all')

  const filtered     = getFiltered()
  const severityCounts = getCountBySeverity()

  // ── Time preset handler ──────────────────────────────────────────────────────
  const handlePreset = useCallback((preset: TimePreset) => {
    setTimePreset(preset)
    setFilter(presetToRange(preset))
  }, [setFilter])

  // ── Toggle helper for array-based filters ──────────────────────────────────
  function toggleItem<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">审计日志</h1>
          <p className="text-muted-foreground mt-1">
            所有工作流、运行、Agent 及系统操作的完整记录
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetFilter}>
          重置筛选
        </Button>
      </div>

      {/* Severity summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {SEVERITY_OPTIONS.map(s => (
          <Card
            key={s}
            className={`cursor-pointer transition-colors ${filter.severities.includes(s) ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFilter({ severities: toggleItem(filter.severities, s) })}
          >
            <CardContent className="py-4 flex items-center justify-between">
              <span className="text-sm font-medium capitalize">{s === 'info' ? '信息' : s === 'warning' ? '警告' : '错误'}</span>
              <span className={`text-lg font-bold px-2 py-0.5 rounded text-sm ${SEVERITY_STYLE[s]}`}>
                {severityCounts[s]}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4 space-y-4">
          {/* Search */}
          <div className="flex items-center gap-3">
            <Input
              placeholder="搜索摘要、资源、操作者…"
              value={filter.search}
              onChange={e => setFilter({ search: e.target.value })}
              className="max-w-sm"
            />
            <span className="text-sm text-muted-foreground">
              显示 {filtered.length} 条记录
            </span>
          </div>

          {/* Time presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">时间范围</span>
            {(['1h', '24h', '7d', '30d', 'all'] as TimePreset[]).map(p => (
              <button
                key={p}
                onClick={() => handlePreset(p)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  timePreset === p
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {p === 'all' ? '全部' : p}
              </button>
            ))}
          </div>

          {/* Resource type filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">资源类型</span>
            {RESOURCE_OPTIONS.map(rt => (
              <Badge
                key={rt}
                variant={filter.resourceTypes.includes(rt) ? 'default' : 'outline'}
                className="cursor-pointer select-none"
                onClick={() => setFilter({ resourceTypes: toggleItem(filter.resourceTypes, rt) })}
              >
                {rt}
              </Badge>
            ))}
          </div>

          {/* Action type filter */}
          <div className="flex items-start gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground mt-1 mr-1">操作类型</span>
            <div className="flex flex-wrap gap-2">
              {ACTION_GROUPS.map(group => (
                <div key={group.label} className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">{group.label}:</span>
                  {group.actions.map(action => (
                    <Badge
                      key={action}
                      variant={filter.actionTypes.includes(action) ? 'default' : 'outline'}
                      className="cursor-pointer select-none font-mono text-xs"
                      onClick={() => setFilter({ actionTypes: toggleItem(filter.actionTypes, action) })}
                    >
                      {action.split('.')[1]}
                    </Badge>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <AuditLogTable entries={filtered} />
        </CardContent>
      </Card>

    </div>
  )
}
