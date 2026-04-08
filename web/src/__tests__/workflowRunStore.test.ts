/**
 * workflowRunStore tests
 *
 * Uses Vitest + zustand vanilla store (no React, no DOM, no localStorage).
 * All logic is re-implemented as a factory function to avoid the persisted
 * singleton and localStorage dependency.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createStore } from 'zustand/vanilla'
import type { WorkflowRun, WorkflowRunStatus, WorkflowNodeRunState } from '@/types/workflow'

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateRunId(): string {
  return `wfrun-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function makeNodeState(nodeId: string, status: WorkflowNodeRunState['status'] = 'waiting'): WorkflowNodeRunState {
  return { nodeId, status }
}

function makeRun(
  overrides: Partial<WorkflowRun> = {},
  nodeIds: string[] = ['n1', 'n2', 'n3'],
): WorkflowRun {
  return {
    id:          generateRunId(),
    workflowId:  'wf-test',
    status:      'success',
    triggeredBy: 'user:test',
    startedAt:   Date.now() - 120_000,
    finishedAt:  Date.now() - 60_000,
    nodeStates:  nodeIds.map(id => makeNodeState(id, 'success')),
    ...overrides,
  }
}

// ── In-memory store factory ────────────────────────────────────────────────────

interface RunStoreState {
  runs: WorkflowRun[]

  triggerRun:      (workflowId: string, nodeIds: string[], triggeredBy?: string) => string
  cancelRun:       (runId: string) => void
  updateNodeState: (runId: string, nodeId: string, patch: Partial<WorkflowNodeRunState>) => void
  updateRunStatus: (runId: string, status: WorkflowRunStatus) => void

  getRunsForWorkflow: (workflowId: string) => WorkflowRun[]
  getRunById:         (runId: string) => WorkflowRun | undefined
  getActiveRuns:      () => WorkflowRun[]
  getSuccessRate:     (workflowId: string) => number
  getAvgDurationMs:   (workflowId: string) => number | null
  getRecentRuns:      (limit?: number) => WorkflowRun[]
  getStatusBreakdown: () => Record<WorkflowRunStatus, number>
}

function makeStore(seedRuns: WorkflowRun[] = []) {
  return createStore<RunStoreState>()((set, get) => ({
    runs: seedRuns,

    triggerRun: (workflowId, nodeIds, triggeredBy = 'user') => {
      const runId    = generateRunId()
      const startedAt = Date.now()
      const newRun: WorkflowRun = {
        id:          runId,
        workflowId,
        status:      'running',
        triggeredBy,
        startedAt,
        nodeStates:  nodeIds.map((nodeId, i) => ({
          nodeId,
          status: i === 0 ? 'running' : 'waiting',
          startedAt: i === 0 ? startedAt : undefined,
        })),
      }
      set(s => ({ runs: [newRun, ...s.runs] }))
      return runId
    },

    cancelRun: (runId) =>
      set(s => ({
        runs: s.runs.map(r =>
          r.id === runId && r.status === 'running'
            ? { ...r, status: 'cancelled', finishedAt: Date.now() }
            : r
        ),
      })),

    updateNodeState: (runId, nodeId, patch) =>
      set(s => ({
        runs: s.runs.map(r =>
          r.id === runId
            ? { ...r, nodeStates: r.nodeStates.map(ns => ns.nodeId === nodeId ? { ...ns, ...patch } : ns) }
            : r
        ),
      })),

    updateRunStatus: (runId, status) =>
      set(s => ({
        runs: s.runs.map(r =>
          r.id === runId
            ? { ...r, status, finishedAt: ['success','failed','cancelled'].includes(status) ? Date.now() : r.finishedAt }
            : r
        ),
      })),

    getRunsForWorkflow: (workflowId) =>
      get().runs.filter(r => r.workflowId === workflowId).sort((a, b) => b.startedAt - a.startedAt),

    getRunById: (runId) =>
      get().runs.find(r => r.id === runId),

    getActiveRuns: () =>
      get().runs.filter(r => r.status === 'running'),

    getSuccessRate: (workflowId) => {
      const finished = get().runs.filter(r =>
        r.workflowId === workflowId && (r.status === 'success' || r.status === 'failed')
      )
      if (!finished.length) return 100
      return Math.round((finished.filter(r => r.status === 'success').length / finished.length) * 100)
    },

    getAvgDurationMs: (workflowId) => {
      const completed = get().runs.filter(r => r.workflowId === workflowId && r.finishedAt != null)
      if (!completed.length) return null
      const total = completed.reduce((sum, r) => sum + (r.finishedAt! - r.startedAt), 0)
      return Math.round(total / completed.length)
    },

    getRecentRuns: (limit = 10) =>
      get().runs.slice().sort((a, b) => b.startedAt - a.startedAt).slice(0, limit),

    getStatusBreakdown: () => {
      const counts: Record<WorkflowRunStatus, number> = { pending: 0, running: 0, success: 0, failed: 0, cancelled: 0 }
      for (const r of get().runs) counts[r.status]++
      return counts
    },
  }))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('workflowRunStore', () => {
  let store: ReturnType<typeof makeStore>

  beforeEach(() => {
    vi.useFakeTimers()
    store = makeStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Initial state ────────────────────────────────────────────────────────────

  it('initialises empty', () => {
    expect(store.getState().runs).toHaveLength(0)
  })

  it('accepts seed runs', () => {
    const seeded = makeStore([makeRun()])
    expect(seeded.getState().runs).toHaveLength(1)
  })

  // ── triggerRun ───────────────────────────────────────────────────────────────

  it('triggerRun creates a running run and returns an id', () => {
    const id = store.getState().triggerRun('wf-1', ['n1', 'n2', 'n3'])
    expect(id).toBeTruthy()
    const run = store.getState().getRunById(id)!
    expect(run).toBeDefined()
    expect(run.status).toBe('running')
    expect(run.workflowId).toBe('wf-1')
    expect(run.nodeStates).toHaveLength(3)
  })

  it('triggerRun sets first node to running, rest to waiting', () => {
    const id  = store.getState().triggerRun('wf-1', ['n1', 'n2', 'n3'])
    const run = store.getState().getRunById(id)!
    expect(run.nodeStates[0].status).toBe('running')
    expect(run.nodeStates[1].status).toBe('waiting')
    expect(run.nodeStates[2].status).toBe('waiting')
  })

  it('triggerRun prepends the new run', () => {
    store.getState().triggerRun('wf-1', ['n1'])
    store.getState().triggerRun('wf-1', ['n1'])
    expect(store.getState().runs).toHaveLength(2)
  })

  it('triggerRun records the triggeredBy field', () => {
    const id = store.getState().triggerRun('wf-1', ['n1'], 'scheduler')
    const run = store.getState().getRunById(id)!
    expect(run.triggeredBy).toBe('scheduler')
  })

  it('triggerRun with empty nodeIds creates a run with no nodeStates', () => {
    const id  = store.getState().triggerRun('wf-empty', [])
    const run = store.getState().getRunById(id)!
    expect(run.nodeStates).toHaveLength(0)
  })

  // ── cancelRun ────────────────────────────────────────────────────────────────

  it('cancelRun transitions running run to cancelled', () => {
    const id = store.getState().triggerRun('wf-1', ['n1'])
    store.getState().cancelRun(id)
    const run = store.getState().getRunById(id)!
    expect(run.status).toBe('cancelled')
    expect(run.finishedAt).toBeDefined()
  })

  it('cancelRun does NOT affect already-completed runs', () => {
    const seed = makeRun({ status: 'success' })
    store = makeStore([seed])
    store.getState().cancelRun(seed.id)
    expect(store.getState().getRunById(seed.id)!.status).toBe('success')
  })

  it('cancelRun is idempotent on unknown id', () => {
    expect(() => store.getState().cancelRun('ghost')).not.toThrow()
  })

  // ── updateNodeState ──────────────────────────────────────────────────────────

  it('updateNodeState patches only the target node', () => {
    const id  = store.getState().triggerRun('wf-1', ['n1', 'n2', 'n3'])
    store.getState().updateNodeState(id, 'n1', { status: 'success', output: 'done' })
    const run = store.getState().getRunById(id)!
    expect(run.nodeStates.find(ns => ns.nodeId === 'n1')?.status).toBe('success')
    expect(run.nodeStates.find(ns => ns.nodeId === 'n1')?.output).toBe('done')
    expect(run.nodeStates.find(ns => ns.nodeId === 'n2')?.status).toBe('waiting')
  })

  it('updateNodeState sets error field on failure', () => {
    const id = store.getState().triggerRun('wf-1', ['n1'])
    store.getState().updateNodeState(id, 'n1', { status: 'failed', error: 'boom' })
    const ns = store.getState().getRunById(id)!.nodeStates[0]
    expect(ns.status).toBe('failed')
    expect(ns.error).toBe('boom')
  })

  it('updateNodeState on unknown run does not throw', () => {
    expect(() => store.getState().updateNodeState('ghost', 'n1', { status: 'success' })).not.toThrow()
  })

  // ── updateRunStatus ──────────────────────────────────────────────────────────

  it('updateRunStatus changes run status', () => {
    const id = store.getState().triggerRun('wf-1', ['n1'])
    store.getState().updateRunStatus(id, 'success')
    expect(store.getState().getRunById(id)!.status).toBe('success')
  })

  it('updateRunStatus sets finishedAt for terminal statuses', () => {
    for (const status of ['success', 'failed', 'cancelled'] as WorkflowRunStatus[]) {
      store = makeStore()
      const id = store.getState().triggerRun('wf-1', ['n1'])
      store.getState().updateRunStatus(id, status)
      expect(store.getState().getRunById(id)!.finishedAt).toBeDefined()
    }
  })

  it('updateRunStatus does not set finishedAt for non-terminal statuses', () => {
    const id = store.getState().triggerRun('wf-1', ['n1'])
    store.getState().updateRunStatus(id, 'pending')
    const run = store.getState().getRunById(id)!
    // finishedAt should remain undefined (wasn't set during trigger)
    expect(run.finishedAt).toBeUndefined()
  })

  // ── getRunsForWorkflow ────────────────────────────────────────────────────────

  it('getRunsForWorkflow filters by workflowId', () => {
    store = makeStore([
      makeRun({ workflowId: 'wf-a' }),
      makeRun({ workflowId: 'wf-b' }),
      makeRun({ workflowId: 'wf-a' }),
    ])
    const aRuns = store.getState().getRunsForWorkflow('wf-a')
    expect(aRuns).toHaveLength(2)
    expect(aRuns.every(r => r.workflowId === 'wf-a')).toBe(true)
  })

  it('getRunsForWorkflow returns newest first', () => {
    const old   = makeRun({ workflowId: 'wf-a', startedAt: Date.now() - 10_000 })
    const fresh = makeRun({ workflowId: 'wf-a', startedAt: Date.now() })
    store = makeStore([old, fresh])
    const runs = store.getState().getRunsForWorkflow('wf-a')
    expect(runs[0].id).toBe(fresh.id)
  })

  it('getRunsForWorkflow returns empty array for unknown workflowId', () => {
    expect(store.getState().getRunsForWorkflow('ghost')).toHaveLength(0)
  })

  // ── getRunById ────────────────────────────────────────────────────────────────

  it('getRunById returns the correct run', () => {
    const run = makeRun({ workflowId: 'wf-a' })
    store = makeStore([run])
    expect(store.getState().getRunById(run.id)?.id).toBe(run.id)
  })

  it('getRunById returns undefined for unknown id', () => {
    expect(store.getState().getRunById('ghost')).toBeUndefined()
  })

  // ── getActiveRuns ─────────────────────────────────────────────────────────────

  it('getActiveRuns returns only running runs', () => {
    store = makeStore([
      makeRun({ status: 'running', finishedAt: undefined }),
      makeRun({ status: 'success' }),
      makeRun({ status: 'failed'  }),
    ])
    expect(store.getState().getActiveRuns()).toHaveLength(1)
    expect(store.getState().getActiveRuns()[0].status).toBe('running')
  })

  // ── getSuccessRate ────────────────────────────────────────────────────────────

  it('getSuccessRate returns 100 when no finished runs', () => {
    expect(store.getState().getSuccessRate('wf-a')).toBe(100)
  })

  it('getSuccessRate calculates correctly', () => {
    store = makeStore([
      makeRun({ workflowId: 'wf-a', status: 'success' }),
      makeRun({ workflowId: 'wf-a', status: 'success' }),
      makeRun({ workflowId: 'wf-a', status: 'failed'  }),
      makeRun({ workflowId: 'wf-a', status: 'running', finishedAt: undefined }), // excluded
    ])
    expect(store.getState().getSuccessRate('wf-a')).toBe(67) // 2/3 = 66.7 → rounded to 67
  })

  it('getSuccessRate returns 0 when all failed', () => {
    store = makeStore([
      makeRun({ workflowId: 'wf-x', status: 'failed' }),
      makeRun({ workflowId: 'wf-x', status: 'failed' }),
    ])
    expect(store.getState().getSuccessRate('wf-x')).toBe(0)
  })

  // ── getAvgDurationMs ──────────────────────────────────────────────────────────

  it('getAvgDurationMs returns null when no completed runs', () => {
    expect(store.getState().getAvgDurationMs('wf-a')).toBeNull()
  })

  it('getAvgDurationMs returns null when runs have no finishedAt', () => {
    store = makeStore([makeRun({ workflowId: 'wf-a', status: 'running', finishedAt: undefined })])
    expect(store.getState().getAvgDurationMs('wf-a')).toBeNull()
  })

  it('getAvgDurationMs calculates correctly', () => {
    const base = Date.now()
    store = makeStore([
      makeRun({ workflowId: 'wf-a', startedAt: base - 10_000, finishedAt: base }),    // 10s
      makeRun({ workflowId: 'wf-a', startedAt: base - 20_000, finishedAt: base }),    // 20s
    ])
    const avg = store.getState().getAvgDurationMs('wf-a')!
    expect(avg).toBe(15_000) // average of 10s and 20s
  })

  // ── getRecentRuns ─────────────────────────────────────────────────────────────

  it('getRecentRuns limits and sorts by startedAt descending', () => {
    const now = Date.now()
    const runs = Array.from({ length: 15 }, (_, i) =>
      makeRun({ startedAt: now - i * 1_000 })
    )
    store = makeStore(runs)
    const recent = store.getState().getRecentRuns(5)
    expect(recent).toHaveLength(5)
    // Should be newest first
    for (let i = 0; i < recent.length - 1; i++) {
      expect(recent[i].startedAt).toBeGreaterThanOrEqual(recent[i + 1].startedAt)
    }
  })

  it('getRecentRuns defaults to 10', () => {
    const runs = Array.from({ length: 20 }, () => makeRun())
    store = makeStore(runs)
    expect(store.getState().getRecentRuns()).toHaveLength(10)
  })

  // ── getStatusBreakdown ────────────────────────────────────────────────────────

  it('getStatusBreakdown returns correct counts', () => {
    store = makeStore([
      makeRun({ status: 'success' }),
      makeRun({ status: 'success' }),
      makeRun({ status: 'failed'  }),
      makeRun({ status: 'running', finishedAt: undefined }),
      makeRun({ status: 'cancelled' }),
    ])
    const bd = store.getState().getStatusBreakdown()
    expect(bd.success).toBe(2)
    expect(bd.failed).toBe(1)
    expect(bd.running).toBe(1)
    expect(bd.cancelled).toBe(1)
    expect(bd.pending).toBe(0)
  })

  it('getStatusBreakdown returns all-zero when empty', () => {
    const bd = store.getState().getStatusBreakdown()
    expect(Object.values(bd).every(v => v === 0)).toBe(true)
  })

  // ── interaction: trigger → cancel ────────────────────────────────────────────

  it('triggerRun + cancelRun lifecycle', () => {
    const id = store.getState().triggerRun('wf-1', ['n1', 'n2'])
    expect(store.getState().getActiveRuns()).toHaveLength(1)
    store.getState().cancelRun(id)
    expect(store.getState().getActiveRuns()).toHaveLength(0)
    expect(store.getState().getRunById(id)!.status).toBe('cancelled')
  })

  // ── interaction: trigger → update nodes → complete ───────────────────────────

  it('full run lifecycle: trigger → node updates → mark complete', () => {
    const id = store.getState().triggerRun('wf-1', ['n1', 'n2', 'n3'])

    // Simulate n1 done
    store.getState().updateNodeState(id, 'n1', { status: 'success', finishedAt: Date.now(), output: 'ok' })
    store.getState().updateNodeState(id, 'n2', { status: 'running', startedAt: Date.now() })

    // n2 done
    store.getState().updateNodeState(id, 'n2', { status: 'success', finishedAt: Date.now() })
    store.getState().updateNodeState(id, 'n3', { status: 'running', startedAt: Date.now() })

    // n3 done → mark run success
    store.getState().updateNodeState(id, 'n3', { status: 'success', finishedAt: Date.now() })
    store.getState().updateRunStatus(id, 'success')

    const run = store.getState().getRunById(id)!
    expect(run.status).toBe('success')
    expect(run.finishedAt).toBeDefined()
    expect(run.nodeStates.every(ns => ns.status === 'success')).toBe(true)
    expect(store.getState().getActiveRuns()).toHaveLength(0)
  })
})
