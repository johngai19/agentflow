// ─── Audit Log Store ───────────────────────────────────────────────────────────
// Records every workflow / run / agent operation; exposed as a Zustand store
// with persist (localStorage, capped at 1 000 entries).

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  AuditLogEntry,
  AuditLogStoreState,
  AuditFilter,
  AuditActionType,
  AuditResourceType,
  AuditSeverity,
} from '@/types/audit'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateAuditId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const DEFAULT_FILTER: AuditFilter = {
  fromTs:        undefined,
  toTs:          undefined,
  actionTypes:   [],
  resourceTypes: [],
  severities:    [],
  search:        '',
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const now  = Date.now()
const mins = (n: number) => n * 60_000
const hrs  = (n: number) => n * 3_600_000
const days = (n: number) => n * 86_400_000

type SeedRow = [
  actionType: AuditActionType,
  resourceType: AuditResourceType,
  resourceId: string,
  resourceName: string,
  actor: string,
  severity: AuditSeverity,
  summary: string,
  ageMs: number,
]

const SEED_ROWS: SeedRow[] = [
  // recent runs
  ['run.triggered',   'run',          'wfrun-s004', 'sample-wf-001',   'user:john',    'info',    '工作流 sample-wf-001 由 user:john 手动触发',          mins(15)],
  ['node.started',    'node',         'n-start',    '节点 n-start',     'scheduler',    'info',    '节点 n-start 开始执行',                               mins(14)],
  ['node.completed',  'node',         'n-fork',     '节点 n-fork',      'scheduler',    'info',    '节点 n-fork 执行成功，输出 342 条记录',                 mins(12)],
  ['run.failed',      'run',          'wfrun-s003', 'sample-wf-001',   'scheduler',    'error',   '工作流运行 wfrun-s003 失败：超时或依赖服务不可用',       hrs(50)],
  ['node.failed',     'node',         'n-approval', '节点 n-approval',  'scheduler',    'error',   '节点 n-approval 执行失败：审批超时',                   hrs(50) + mins(2)],
  // workflow management
  ['workflow.created','workflow',     'sample-wf-001', '示例合规检查工作流', 'user:john', 'info',  '工作流「示例合规检查工作流」已创建（版本 v1）',           days(3)],
  ['workflow.updated','workflow',     'sample-wf-001', '示例合规检查工作流', 'user:john', 'info',  '工作流「示例合规检查工作流」已更新（节点配置变更）',       days(1) + hrs(6)],
  ['workflow.enabled','workflow',     'sample-wf-001', '示例合规检查工作流', 'user:admin','info',  '工作流「示例合规检查工作流」已启用',                     days(2)],
  // run history
  ['run.triggered',   'run',          'wfrun-s001', 'sample-wf-001',   'user:john',    'info',    '工作流 sample-wf-001 由 user:john 手动触发',          hrs(2)],
  ['run.completed',   'run',          'wfrun-s001', 'sample-wf-001',   'scheduler',    'info',    '工作流运行 wfrun-s001 成功完成（耗时 4m 32s）',         hrs(2) - mins(4)],
  ['run.triggered',   'run',          'wfrun-s002', 'sample-wf-001',   'scheduler',    'info',    '工作流 sample-wf-001 由定时调度触发',                  hrs(26)],
  ['run.completed',   'run',          'wfrun-s002', 'sample-wf-001',   'scheduler',    'info',    '工作流运行 wfrun-s002 成功完成（耗时 5m 10s）',         hrs(26) - mins(5)],
  ['run.triggered',   'run',          'wfrun-s005', 'sample-wf-001',   'user:admin',   'info',    '工作流 sample-wf-001 由 user:admin 手动触发',          hrs(72)],
  ['run.cancelled',   'run',          'wfrun-s005', 'sample-wf-001',   'user:admin',   'warning', '工作流运行 wfrun-s005 已被 user:admin 取消',            hrs(72) - mins(1)],
  // orchestration events
  ['orchestration.created',  'orchestration', 'orch-001', '每日合规扫描',    'user:john',  'info',    '编排「每日合规扫描」已创建',                          days(5)],
  ['orchestration.triggered','orchestration', 'orch-001', '每日合规扫描',    'scheduler',  'info',    '编排「每日合规扫描」由 Cron 触发',                    hrs(24)],
  ['orchestration.updated',  'orchestration', 'orch-001', '每日合规扫描',    'user:admin', 'info',    '编排「每日合规扫描」调度时间已更新',                   days(2)],
  // agent events
  ['agent.started',   'agent',        'agent-001',  'SecurityScanner',  'scheduler',    'info',    'Agent SecurityScanner 已启动，分配至工作流 sample-wf-001', hrs(2)],
  ['agent.stopped',   'agent',        'agent-001',  'SecurityScanner',  'scheduler',    'info',    'Agent SecurityScanner 已停止（任务完成）',              hrs(2) - mins(4)],
  ['agent.error',     'agent',        'agent-003',  'ComplianceAgent',  'scheduler',    'warning', 'Agent ComplianceAgent 报告警告：响应延迟超过阈值',      hrs(50)],
  // system events
  ['system.login',    'system',       'sys',        'System',           'user:john',    'info',    '用户 user:john 登录系统',                              days(1)],
  ['system.login',    'system',       'sys',        'System',           'user:admin',   'info',    '用户 user:admin 登录系统',                             days(3)],
  ['system.config_changed', 'system', 'sys',        'System',           'user:admin',   'warning', '系统全局超时参数已由 user:admin 修改（300s → 600s）',   days(4)],
]

const SEED_ENTRIES: AuditLogEntry[] = SEED_ROWS.map(
  ([action, resourceType, resourceId, resourceName, actor, severity, summary, ageMs]) => ({
    id:           generateAuditId(),
    timestamp:    now - ageMs,
    action,
    resourceType,
    resourceId,
    resourceName,
    actor,
    severity,
    summary,
  })
).sort((a, b) => b.timestamp - a.timestamp)

// ─── Local storage adapter ────────────────────────────────────────────────────

const safeStorage = createJSONStorage(() => ({
  getItem:    (key: string) => { try { return localStorage.getItem(key)         } catch { return null } },
  setItem:    (key: string, val: string) => { try { localStorage.setItem(key, val) } catch {} },
  removeItem: (key: string) => { try { localStorage.removeItem(key)             } catch {} },
}))

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuditLogStore = create<AuditLogStoreState>()(
  persist(
    (set, get) => ({
      entries: SEED_ENTRIES,
      filter:  { ...DEFAULT_FILTER },

      // ── Add an entry ────────────────────────────────────────────────────────
      addEntry: (entry) => {
        const newEntry: AuditLogEntry = {
          ...entry,
          id:        generateAuditId(),
          timestamp: Date.now(),
        }
        set(s => ({
          entries: [newEntry, ...s.entries].slice(0, 1_000),
        }))
      },

      // ── Clear all ───────────────────────────────────────────────────────────
      clearAll: () => set({ entries: [] }),

      // ── Update filter ───────────────────────────────────────────────────────
      setFilter: (patch) =>
        set(s => ({ filter: { ...s.filter, ...patch } })),

      resetFilter: () => set({ filter: { ...DEFAULT_FILTER } }),

      // ── Filtered view ───────────────────────────────────────────────────────
      getFiltered: () => {
        const { entries, filter } = get()
        const q = filter.search.trim().toLowerCase()
        return entries.filter(e => {
          if (filter.fromTs !== undefined && e.timestamp < filter.fromTs) return false
          if (filter.toTs   !== undefined && e.timestamp > filter.toTs)   return false
          if (filter.actionTypes.length   > 0 && !filter.actionTypes.includes(e.action))             return false
          if (filter.resourceTypes.length > 0 && !filter.resourceTypes.includes(e.resourceType))     return false
          if (filter.severities.length    > 0 && !filter.severities.includes(e.severity))            return false
          if (q) {
            const hay = [e.summary, e.resourceName ?? '', e.actor, e.resourceId].join(' ').toLowerCase()
            if (!hay.includes(q)) return false
          }
          return true
        })
      },

      getEntriesForResource: (resourceType, resourceId) =>
        get().entries.filter(e => e.resourceType === resourceType && e.resourceId === resourceId),

      getRecentEntries: (limit = 20) =>
        get().entries.slice(0, limit),

      getCountBySeverity: () => {
        const counts: Record<AuditSeverity, number> = { info: 0, warning: 0, error: 0 }
        for (const e of get().entries) counts[e.severity]++
        return counts
      },
    }),
    {
      name: 'audit-log-state',
      storage: safeStorage,
      partialize: (s) => ({ entries: s.entries.slice(0, 500) }),
    }
  )
)
