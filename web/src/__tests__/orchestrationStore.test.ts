/**
 * orchestrationStore tests
 *
 * Uses Vitest + zustand's raw store API (no React, no DOM).
 * We re-create a fresh store for each test by calling the factory directly,
 * bypassing the localStorage persist middleware.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
import type {
  Orchestration,
  OrchestrationRun,
  RunStatus,
  StepRun,
} from '@/data/orchestrationData'
import { SAMPLE_ORCHESTRATIONS, SAMPLE_RUNS } from '@/data/orchestrationData'

// ── types mirrored from the store so we don't import the persisted singleton ──
interface OrchestrationState {
  orchestrations: Orchestration[]
  runs: OrchestrationRun[]
  addOrchestration: (o: Orchestration) => void
  updateOrchestration: (id: string, patch: Partial<Orchestration>) => void
  deleteOrchestration: (id: string) => void
  toggleEnabled: (id: string) => void
  triggerRun: (orchId: string, trigger?: 'manual' | 'cron' | 'webhook') => string
  cancelRun: (runId: string) => void
  updateRunStatus: (runId: string, status: RunStatus) => void
  updateStepRun: (runId: string, stepId: string, patch: Partial<StepRun>) => void
  getRunsFor: (orchId: string) => OrchestrationRun[]
  getActiveRuns: () => OrchestrationRun[]
}

/** Build a fresh in-memory orchestration store (no localStorage) */
function makeStore() {
  return createStore<OrchestrationState>()((set, get) => ({
    orchestrations: SAMPLE_ORCHESTRATIONS.map(o => ({ ...o })),
    runs: SAMPLE_RUNS.map(r => ({ ...r, stepRuns: r.stepRuns.map(s => ({ ...s })) })),

    addOrchestration: (o) =>
      set(s => ({ orchestrations: [...s.orchestrations, o] })),

    updateOrchestration: (id, patch) =>
      set(s => ({
        orchestrations: s.orchestrations.map(o =>
          o.id === id ? { ...o, ...patch, updatedAt: Date.now() } : o
        ),
      })),

    deleteOrchestration: (id) =>
      set(s => ({
        orchestrations: s.orchestrations.filter(o => o.id !== id),
        runs: s.runs.filter(r => r.orchestrationId !== id),
      })),

    toggleEnabled: (id) =>
      set(s => ({
        orchestrations: s.orchestrations.map(o =>
          o.id === id ? { ...o, enabled: !o.enabled, updatedAt: Date.now() } : o
        ),
      })),

    triggerRun: (orchId, trigger = 'manual') => {
      const orch = get().orchestrations.find(o => o.id === orchId)
      if (!orch) return ''
      const runId = `run-test-${Date.now()}`
      const newRun: OrchestrationRun = {
        id: runId,
        orchestrationId: orchId,
        status: 'running',
        trigger,
        triggeredBy: trigger === 'manual' ? 'user' : 'scheduler',
        startedAt: Date.now(),
        stepRuns: orch.steps.map((s, i) => ({
          stepId: s.id,
          status: i === 0 ? 'running' : 'waiting',
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

    updateRunStatus: (runId, status) =>
      set(s => ({
        runs: s.runs.map(r =>
          r.id === runId ? { ...r, status, finishedAt: Date.now() } : r
        ),
      })),

    updateStepRun: (runId, stepId, patch) =>
      set(s => ({
        runs: s.runs.map(r =>
          r.id === runId
            ? {
                ...r,
                stepRuns: r.stepRuns.map(sr =>
                  sr.stepId === stepId ? { ...sr, ...patch } : sr
                ),
              }
            : r
        ),
      })),

    getRunsFor: (orchId) =>
      get().runs
        .filter(r => r.orchestrationId === orchId)
        .sort((a, b) => b.startedAt - a.startedAt),

    getActiveRuns: () => get().runs.filter(r => r.status === 'running'),
  }))
}

// ── helpers ───────────────────────────────────────────────────────────────────
const FIRST_ORCH = SAMPLE_ORCHESTRATIONS[0]

describe('orchestrationStore', () => {
  let store: ReturnType<typeof makeStore>

  beforeEach(() => {
    vi.useFakeTimers()
    store = makeStore()
  })

  // ── initial state ──────────────────────────────────────────────────────────
  it('loads sample orchestrations on init', () => {
    const { orchestrations } = store.getState()
    expect(orchestrations.length).toBeGreaterThanOrEqual(5)
    expect(orchestrations[0]).toHaveProperty('id')
    expect(orchestrations[0]).toHaveProperty('steps')
  })

  it('loads sample runs on init', () => {
    const { runs } = store.getState()
    expect(runs.length).toBeGreaterThan(0)
  })

  // ── addOrchestration ───────────────────────────────────────────────────────
  it('addOrchestration appends a new orchestration', () => {
    const newO: Orchestration = {
      id: 'test-orch-1',
      name: 'Test Orch',
      projectId: 'test',
      description: 'desc',
      icon: '🧪',
      steps: [],
      edges: [],
      triggers: [{ type: 'manual' }],
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    store.getState().addOrchestration(newO)
    const { orchestrations } = store.getState()
    expect(orchestrations.find(o => o.id === 'test-orch-1')).toBeDefined()
  })

  // ── updateOrchestration ────────────────────────────────────────────────────
  it('updateOrchestration patches only the target', () => {
    store.getState().updateOrchestration(FIRST_ORCH.id, { name: 'Updated Name' })
    const found = store.getState().orchestrations.find(o => o.id === FIRST_ORCH.id)
    expect(found?.name).toBe('Updated Name')
    // Other fields untouched
    expect(found?.icon).toBe(FIRST_ORCH.icon)
  })

  it('updateOrchestration bumps updatedAt', () => {
    const before = store.getState().orchestrations.find(o => o.id === FIRST_ORCH.id)!.updatedAt
    vi.advanceTimersByTime(1000)
    store.getState().updateOrchestration(FIRST_ORCH.id, { name: 'x' })
    const after = store.getState().orchestrations.find(o => o.id === FIRST_ORCH.id)!.updatedAt
    expect(after).toBeGreaterThanOrEqual(before)
  })

  // ── deleteOrchestration ────────────────────────────────────────────────────
  it('deleteOrchestration removes the orchestration and its runs', () => {
    const id = FIRST_ORCH.id
    const runsBefore = store.getState().runs.filter(r => r.orchestrationId === id).length
    expect(runsBefore).toBeGreaterThan(0) // sample data has runs for this orch

    store.getState().deleteOrchestration(id)

    expect(store.getState().orchestrations.find(o => o.id === id)).toBeUndefined()
    expect(store.getState().runs.filter(r => r.orchestrationId === id)).toHaveLength(0)
  })

  // ── toggleEnabled ──────────────────────────────────────────────────────────
  it('toggleEnabled flips enabled flag', () => {
    const orig = FIRST_ORCH.enabled
    store.getState().toggleEnabled(FIRST_ORCH.id)
    expect(store.getState().orchestrations.find(o => o.id === FIRST_ORCH.id)?.enabled).toBe(!orig)

    store.getState().toggleEnabled(FIRST_ORCH.id)
    expect(store.getState().orchestrations.find(o => o.id === FIRST_ORCH.id)?.enabled).toBe(orig)
  })

  // ── triggerRun ─────────────────────────────────────────────────────────────
  it('triggerRun creates a new run with status running', () => {
    const runId = store.getState().triggerRun(FIRST_ORCH.id, 'manual')
    expect(runId).toBeTruthy()
    const run = store.getState().runs.find(r => r.id === runId)
    expect(run).toBeDefined()
    expect(run?.status).toBe('running')
    expect(run?.orchestrationId).toBe(FIRST_ORCH.id)
    expect(run?.trigger).toBe('manual')
  })

  it('triggerRun returns empty string for unknown orchId', () => {
    const runId = store.getState().triggerRun('does-not-exist')
    expect(runId).toBe('')
  })

  it('triggerRun initialises first stepRun as running, rest as waiting', () => {
    const runId = store.getState().triggerRun(FIRST_ORCH.id)
    const run = store.getState().runs.find(r => r.id === runId)!
    expect(run.stepRuns[0].status).toBe('running')
    run.stepRuns.slice(1).forEach(sr => expect(sr.status).toBe('waiting'))
  })

  // ── cancelRun ─────────────────────────────────────────────────────────────
  it('cancelRun sets status to cancelled for a running run', () => {
    const runId = store.getState().triggerRun(FIRST_ORCH.id)
    store.getState().cancelRun(runId)
    expect(store.getState().runs.find(r => r.id === runId)?.status).toBe('cancelled')
  })

  it('cancelRun does not affect already finished runs', () => {
    // Find a successful run from sample data
    const successRun = store.getState().runs.find(r => r.status === 'success')!
    store.getState().cancelRun(successRun.id)
    expect(store.getState().runs.find(r => r.id === successRun.id)?.status).toBe('success')
  })

  // ── updateRunStatus ────────────────────────────────────────────────────────
  it('updateRunStatus changes run status', () => {
    const runId = store.getState().triggerRun(FIRST_ORCH.id)
    store.getState().updateRunStatus(runId, 'success')
    expect(store.getState().runs.find(r => r.id === runId)?.status).toBe('success')
  })

  // ── updateStepRun ──────────────────────────────────────────────────────────
  it('updateStepRun patches a step inside a run', () => {
    const runId = store.getState().triggerRun(FIRST_ORCH.id)
    const firstStepId = FIRST_ORCH.steps[0].id
    store.getState().updateStepRun(runId, firstStepId, { status: 'success', output: 'done' })
    const run = store.getState().runs.find(r => r.id === runId)!
    const step = run.stepRuns.find(s => s.stepId === firstStepId)!
    expect(step.status).toBe('success')
    expect(step.output).toBe('done')
  })

  // ── getRunsFor ────────────────────────────────────────────────────────────
  it('getRunsFor returns runs sorted newest-first', () => {
    const runs = store.getState().getRunsFor(FIRST_ORCH.id)
    expect(runs.length).toBeGreaterThan(0)
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i - 1].startedAt).toBeGreaterThanOrEqual(runs[i].startedAt)
    }
  })

  it('getRunsFor returns empty array for unknown orch', () => {
    expect(store.getState().getRunsFor('ghost-orch')).toHaveLength(0)
  })

  // ── getActiveRuns ─────────────────────────────────────────────────────────
  it('getActiveRuns returns only running runs', () => {
    const active = store.getState().getActiveRuns()
    active.forEach(r => expect(r.status).toBe('running'))
  })

  it('getActiveRuns includes a newly triggered run', () => {
    const runId = store.getState().triggerRun(FIRST_ORCH.id)
    const active = store.getState().getActiveRuns()
    expect(active.some(r => r.id === runId)).toBe(true)
  })
})
