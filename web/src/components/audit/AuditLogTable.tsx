"use client"

// ─── Audit Log Table ───────────────────────────────────────────────────────────
// Renders a list of AuditLogEntry rows with severity badge, action chip,
// resource info, actor, and relative timestamp.

import type { AuditLogEntry, AuditSeverity, AuditResourceType } from '@/types/audit'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<AuditSeverity, string> = {
  info:    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  error:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

const SEVERITY_LABEL: Record<AuditSeverity, string> = {
  info:    'INFO',
  warning: 'WARN',
  error:   'ERROR',
}

const RESOURCE_ICON: Record<AuditResourceType, string> = {
  workflow:      '⚙️',
  run:           '▶️',
  node:          '🔷',
  orchestration: '🔗',
  agent:         '🤖',
  system:        '🛡️',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(epochMs: number): string {
  const diffMs  = Date.now() - epochMs
  const diffSec = Math.floor(diffMs / 1_000)
  if (diffSec < 60)  return `${diffSec}s 前`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60)  return `${diffMin}m 前`
  const diffHr  = Math.floor(diffMin / 60)
  if (diffHr  < 24)  return `${diffHr}h 前`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d 前`
}

function formatTimestamp(epochMs: number): string {
  return new Date(epochMs).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AuditLogTableProps {
  entries: AuditLogEntry[]
  emptyMessage?: string
}

export function AuditLogTable({ entries, emptyMessage = '无符合条件的审计记录' }: AuditLogTableProps) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">级别</TableHead>
          <TableHead className="w-52">操作类型</TableHead>
          <TableHead className="w-36">资源</TableHead>
          <TableHead>摘要</TableHead>
          <TableHead className="w-32">操作者</TableHead>
          <TableHead className="w-36 text-right">时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map(entry => (
          <AuditLogRow key={entry.id} entry={entry} />
        ))}
      </TableBody>
    </Table>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  return (
    <TableRow>
      {/* Severity */}
      <TableCell>
        <span
          className={cn(
            'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold',
            SEVERITY_STYLES[entry.severity]
          )}
        >
          {SEVERITY_LABEL[entry.severity]}
        </span>
      </TableCell>

      {/* Action type */}
      <TableCell>
        <Badge variant="outline" className="font-mono text-xs">
          {entry.action}
        </Badge>
      </TableCell>

      {/* Resource */}
      <TableCell>
        <span className="text-xs text-muted-foreground">
          {RESOURCE_ICON[entry.resourceType]}{' '}
          {entry.resourceName ?? entry.resourceId}
        </span>
      </TableCell>

      {/* Summary */}
      <TableCell className="max-w-sm whitespace-normal text-sm">
        {entry.summary}
      </TableCell>

      {/* Actor */}
      <TableCell>
        <span className="text-xs text-muted-foreground">{entry.actor}</span>
      </TableCell>

      {/* Timestamp */}
      <TableCell className="text-right">
        <span
          className="text-xs text-muted-foreground"
          title={formatTimestamp(entry.timestamp)}
        >
          {formatRelativeTime(entry.timestamp)}
        </span>
      </TableCell>
    </TableRow>
  )
}
