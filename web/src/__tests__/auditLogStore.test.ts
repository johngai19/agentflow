/**
 * auditLogStore tests
 *
 * Uses Vitest + zustand vanilla store (no React, no DOM, no localStorage).
 * A factory function rebuilds a fresh in-memory store for each test,
 * bypassing the persist middleware singleton.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'zustand/vanilla'
import type {
  AuditLogEntry,
  AuditLogStoreState,
  AuditFilter,
  AuditSeverity,
} from '@/types/audit'

// ─── Helpers ──────────────────────────────────────────────────────────────────

let idSeq = 0
function genId() { return `audit-test-${++idSeq}` }

const DEFAULT_FILTER: AuditFilter = {
  fromTs:        undefined,
  toTs:          undefined,
  actionTypes:   [],
  resourceTypes: [],
  severities:    [],
  search:        '',
}

function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id:           genId(),
    timestamp:    Date.now(),
    action:       'workflow.created',
    resourceType: 'workflow',
    resourceId:   'wf-001',
    resourceName: 'Test Workflow',
    actor:        'user:test',
    severity:     'info',
    summary:      '工作流已创建',
    ...overrides,
  }
}

// ─── In-memory store factory ──────────────────────────────────────────────────

function makeStore(seedEntries: AuditLogEntry[] = []) {
  return createStore<AuditLogStoreState>()((set, get) => ({
    entries: [...seedEntries],
    filter:  { ...DEFAULT_FILTER },

    addEntry: (entry) => {
      const newEntry: AuditLogEntry = {
        ...entry,
        id:        genId(),
        timestamp: Date.now(),
      }
      set(s => ({ entries: [newEntry, ...s.entries].slice(0, 1_000) }))
    },

    clearAll: () => set({ entries: [] }),

    setFilter: (patch) =>
      set(s => ({ filter: { ...s.filter, ...patch } })),

    resetFilter: () => set({ filter: { ...DEFAULT_FILTER } }),

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
  }))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('auditLogStore — addEntry', () => {
  let store: ReturnType<typeof makeStore>

  beforeEach(() => {
    idSeq = 0
    store = makeStore()
  })

  it('starts with no entries', () => {
    expect(store.getState().entries).toHaveLength(0)
  })

  it('adds a new entry with generated id and timestamp', () => {
    const before = Date.now()
    store.getState().addEntry({
      action:       'workflow.created',
      resourceType: 'workflow',
      resourceId:   'wf-001',
      actor:        'user:john',
      severity:     'info',
      summary:      '工作流已创建',
    })
    const after = Date.now()
    const entries = store.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBeTruthy()
    expect(entries[0].timestamp).toBeGreaterThanOrEqual(before)
    expect(entries[0].timestamp).toBeLessThanOrEqual(after)
    expect(entries[0].action).toBe('workflow.created')
  })

  it('prepends new entries (most-recent first)', () => {
    store.getState().addEntry({ action: 'workflow.created', resourceType: 'workflow', resourceId: 'wf-a', actor: 'u', severity: 'info', summary: 'first' })
    store.getState().addEntry({ action: 'run.triggered',    resourceType: 'run',      resourceId: 'r-b',  actor: 'u', severity: 'info', summary: 'second' })
    const entries = store.getState().entries
    expect(entries[0].summary).toBe('second')
    expect(entries[1].summary).toBe('first')
  })

  it('caps entries at 1 000', () => {
    const seed = Array.from({ length: 1_000 }, (_, i) =>
      makeEntry({ id: `e-${i}`, timestamp: Date.now() - i })
    )
    const cappedStore = makeStore(seed)
    cappedStore.getState().addEntry({ action: 'system.login', resourceType: 'system', resourceId: 'sys', actor: 'u', severity: 'info', summary: 'overflow' })
    expect(cappedStore.getState().entries).toHaveLength(1_000)
  })
})

describe('auditLogStore — clearAll', () => {
  it('removes all entries', () => {
    const store = makeStore([makeEntry(), makeEntry()])
    store.getState().clearAll()
    expect(store.getState().entries).toHaveLength(0)
  })
})

describe('auditLogStore — getFiltered (no filter)', () => {
  let store: ReturnType<typeof makeStore>
  beforeEach(() => {
    idSeq = 0
    store = makeStore([
      makeEntry({ severity: 'info',    action: 'workflow.created',  resourceType: 'workflow' }),
      makeEntry({ severity: 'warning', action: 'run.failed',        resourceType: 'run',     resourceId: 'r-1' }),
      makeEntry({ severity: 'error',   action: 'agent.error',       resourceType: 'agent',   summary: 'Agent failed', actor: 'scheduler' }),
    ])
  })

  it('returns all entries when filter is default', () => {
    expect(store.getState().getFiltered()).toHaveLength(3)
  })
})

describe('auditLogStore — getFiltered (severity filter)', () => {
  let store: ReturnType<typeof makeStore>
  beforeEach(() => {
    idSeq = 0
    store = makeStore([
      makeEntry({ severity: 'info' }),
      makeEntry({ severity: 'warning' }),
      makeEntry({ severity: 'error' }),
      makeEntry({ severity: 'info' }),
    ])
  })

  it('filters by single severity', () => {
    store.getState().setFilter({ severities: ['error'] })
    expect(store.getState().getFiltered()).toHaveLength(1)
  })

  it('filters by multiple severities', () => {
    store.getState().setFilter({ severities: ['info', 'error'] })
    expect(store.getState().getFiltered()).toHaveLength(3)
  })
})

describe('auditLogStore — getFiltered (resource type filter)', () => {
  let store: ReturnType<typeof makeStore>
  beforeEach(() => {
    idSeq = 0
    store = makeStore([
      makeEntry({ resourceType: 'workflow' }),
      makeEntry({ resourceType: 'run' }),
      makeEntry({ resourceType: 'agent' }),
      makeEntry({ resourceType: 'workflow' }),
    ])
  })

  it('filters by resource type', () => {
    store.getState().setFilter({ resourceTypes: ['workflow'] })
    expect(store.getState().getFiltered()).toHaveLength(2)
  })
})

describe('auditLogStore — getFiltered (action type filter)', () => {
  let store: ReturnType<typeof makeStore>
  beforeEach(() => {
    idSeq = 0
    store = makeStore([
      makeEntry({ action: 'workflow.created' }),
      makeEntry({ action: 'run.triggered' }),
      makeEntry({ action: 'run.failed' }),
      makeEntry({ action: 'workflow.deleted' }),
    ])
  })

  it('filters by single action type', () => {
    store.getState().setFilter({ actionTypes: ['run.triggered'] })
    expect(store.getState().getFiltered()).toHaveLength(1)
  })

  it('filters by multiple action types', () => {
    store.getState().setFilter({ actionTypes: ['run.triggered', 'run.failed'] })
    expect(store.getState().getFiltered()).toHaveLength(2)
  })
})

describe('auditLogStore — getFiltered (search)', () => {
  let store: ReturnType<typeof makeStore>
  beforeEach(() => {
    idSeq = 0
    store = makeStore([
      makeEntry({ summary: '工作流「合规扫描」已创建', actor: 'user:john', resourceId: 'wf-123', resourceName: '合规扫描' }),
      makeEntry({ summary: 'Agent SecurityScanner 启动', actor: 'scheduler', resourceId: 'ag-1', resourceName: 'SecurityScanner' }),
      makeEntry({ summary: '运行失败：超时', actor: 'scheduler', resourceId: 'r-99' }),
    ])
  })

  it('matches by summary keyword', () => {
    store.getState().setFilter({ search: '合规' })
    expect(store.getState().getFiltered()).toHaveLength(1)
    expect(store.getState().getFiltered()[0].resourceName).toBe('合规扫描')
  })

  it('matches by actor', () => {
    store.getState().setFilter({ search: 'user:john' })
    expect(store.getState().getFiltered()).toHaveLength(1)
  })

  it('matches by resource name', () => {
    store.getState().setFilter({ search: 'securityscanner' })
    expect(store.getState().getFiltered()).toHaveLength(1)
  })

  it('returns empty when no match', () => {
    store.getState().setFilter({ search: 'nonexistent_xyz' })
    expect(store.getState().getFiltered()).toHaveLength(0)
  })
})

describe('auditLogStore — getFiltered (time range)', () => {
  it('filters by fromTs', () => {
    const base = 1_700_000_000_000
    const store = makeStore([
      makeEntry({ timestamp: base - 10_000 }),
      makeEntry({ timestamp: base }),
      makeEntry({ timestamp: base + 10_000 }),
    ])
    store.getState().setFilter({ fromTs: base })
    const filtered = store.getState().getFiltered()
    expect(filtered).toHaveLength(2)
    expect(filtered.every(e => e.timestamp >= base)).toBe(true)
  })

  it('filters by toTs', () => {
    const base = 1_700_000_000_000
    const store = makeStore([
      makeEntry({ timestamp: base - 10_000 }),
      makeEntry({ timestamp: base }),
      makeEntry({ timestamp: base + 10_000 }),
    ])
    store.getState().setFilter({ toTs: base })
    const filtered = store.getState().getFiltered()
    expect(filtered).toHaveLength(2)
    expect(filtered.every(e => e.timestamp <= base)).toBe(true)
  })

  it('filters by both fromTs and toTs', () => {
    const base = 1_700_000_000_000
    const store = makeStore([
      makeEntry({ timestamp: base - 10_000 }),
      makeEntry({ timestamp: base }),
      makeEntry({ timestamp: base + 10_000 }),
    ])
    store.getState().setFilter({ fromTs: base, toTs: base })
    expect(store.getState().getFiltered()).toHaveLength(1)
  })
})

describe('auditLogStore — getFiltered (combined filters)', () => {
  it('applies severity + search simultaneously', () => {
    const store = makeStore([
      makeEntry({ severity: 'error', summary: 'Agent error', actor: 'scheduler' }),
      makeEntry({ severity: 'error', summary: 'Run failed', actor: 'user:john' }),
      makeEntry({ severity: 'info',  summary: 'Workflow ok',  actor: 'scheduler' }),
    ])
    store.getState().setFilter({ severities: ['error'], search: 'scheduler' })
    const filtered = store.getState().getFiltered()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].summary).toBe('Agent error')
  })
})

describe('auditLogStore — resetFilter', () => {
  it('clears all filter fields', () => {
    const store = makeStore()
    store.getState().setFilter({ severities: ['error'], search: 'test', resourceTypes: ['workflow'] })
    store.getState().resetFilter()
    const f = store.getState().filter
    expect(f.severities).toHaveLength(0)
    expect(f.search).toBe('')
    expect(f.resourceTypes).toHaveLength(0)
  })
})

describe('auditLogStore — getEntriesForResource', () => {
  it('returns only entries for matching resource', () => {
    const store = makeStore([
      makeEntry({ resourceType: 'workflow', resourceId: 'wf-001' }),
      makeEntry({ resourceType: 'workflow', resourceId: 'wf-002' }),
      makeEntry({ resourceType: 'run',      resourceId: 'wf-001' }),
    ])
    const result = store.getState().getEntriesForResource('workflow', 'wf-001')
    expect(result).toHaveLength(1)
    expect(result[0].resourceId).toBe('wf-001')
    expect(result[0].resourceType).toBe('workflow')
  })

  it('returns empty array when no match', () => {
    const store = makeStore([makeEntry({ resourceType: 'workflow', resourceId: 'wf-001' })])
    expect(store.getState().getEntriesForResource('agent', 'wf-001')).toHaveLength(0)
  })
})

describe('auditLogStore — getRecentEntries', () => {
  it('returns up to default limit (20)', () => {
    const entries = Array.from({ length: 25 }, () => makeEntry())
    const store = makeStore(entries)
    expect(store.getState().getRecentEntries()).toHaveLength(20)
  })

  it('respects custom limit', () => {
    const entries = Array.from({ length: 10 }, () => makeEntry())
    const store = makeStore(entries)
    expect(store.getState().getRecentEntries(5)).toHaveLength(5)
  })

  it('returns all if fewer than limit', () => {
    const store = makeStore([makeEntry(), makeEntry()])
    expect(store.getState().getRecentEntries(20)).toHaveLength(2)
  })
})

describe('auditLogStore — getCountBySeverity', () => {
  it('counts entries by severity', () => {
    const store = makeStore([
      makeEntry({ severity: 'info' }),
      makeEntry({ severity: 'info' }),
      makeEntry({ severity: 'warning' }),
      makeEntry({ severity: 'error' }),
      makeEntry({ severity: 'error' }),
      makeEntry({ severity: 'error' }),
    ])
    const counts = store.getState().getCountBySeverity()
    expect(counts.info).toBe(2)
    expect(counts.warning).toBe(1)
    expect(counts.error).toBe(3)
  })

  it('returns zeros for empty store', () => {
    const store = makeStore()
    const counts = store.getState().getCountBySeverity()
    expect(counts).toEqual({ info: 0, warning: 0, error: 0 })
  })
})
