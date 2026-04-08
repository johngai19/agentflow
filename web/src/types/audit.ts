// ─── Audit Log — Type Definitions ─────────────────────────────────────────────

// ── Action types ──────────────────────────────────────────────────────────────

export type AuditActionType =
  // Workflow lifecycle
  | 'workflow.created'
  | 'workflow.updated'
  | 'workflow.deleted'
  | 'workflow.enabled'
  | 'workflow.disabled'
  // Run lifecycle
  | 'run.triggered'
  | 'run.cancelled'
  | 'run.completed'
  | 'run.failed'
  // Node events
  | 'node.started'
  | 'node.completed'
  | 'node.failed'
  // Orchestration
  | 'orchestration.created'
  | 'orchestration.updated'
  | 'orchestration.deleted'
  | 'orchestration.triggered'
  // Agent
  | 'agent.started'
  | 'agent.stopped'
  | 'agent.error'
  // System
  | 'system.config_changed'
  | 'system.login'
  | 'system.logout'

// ── Resource types ────────────────────────────────────────────────────────────

export type AuditResourceType =
  | 'workflow'
  | 'run'
  | 'node'
  | 'orchestration'
  | 'agent'
  | 'system'

// ── Severity ──────────────────────────────────────────────────────────────────

export type AuditSeverity = 'info' | 'warning' | 'error'

// ── Single audit log entry ────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  timestamp: number               // epoch ms
  action: AuditActionType
  resourceType: AuditResourceType
  resourceId: string              // id of the affected resource
  resourceName?: string           // human-readable name at time of event
  actor: string                   // user id, scheduler, webhook, etc.
  severity: AuditSeverity
  /** Short one-liner summary rendered in the table */
  summary: string
  /** Optional structured metadata (diff, params, error message, …) */
  metadata?: Record<string, unknown>
}

// ── Filter state used by the audit page ──────────────────────────────────────

export interface AuditFilter {
  /** epoch ms start bound (inclusive) — undefined = no lower limit */
  fromTs?: number
  /** epoch ms end bound (inclusive) — undefined = no upper limit */
  toTs?: number
  actionTypes: AuditActionType[]  // empty = all
  resourceTypes: AuditResourceType[] // empty = all
  severities: AuditSeverity[]    // empty = all
  /** Free-text search applied to summary, resourceName, actor */
  search: string
}

// ── Store interface ───────────────────────────────────────────────────────────

export interface AuditLogStoreState {
  entries: AuditLogEntry[]
  filter: AuditFilter

  // ── Actions ────────────────────────────────────────────────────────────────
  addEntry: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void
  clearAll: () => void
  setFilter: (patch: Partial<AuditFilter>) => void
  resetFilter: () => void

  // ── Selectors ──────────────────────────────────────────────────────────────
  getFiltered: () => AuditLogEntry[]
  getEntriesForResource: (resourceType: AuditResourceType, resourceId: string) => AuditLogEntry[]
  getRecentEntries: (limit?: number) => AuditLogEntry[]
  getCountBySeverity: () => Record<AuditSeverity, number>
}
