import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  Orchestration,
  OrchestrationRun,
  StepRun,
  RunStatus,
  StepStatus,
  SAMPLE_ORCHESTRATIONS,
  SAMPLE_RUNS,
} from '@/data/orchestrationData'

interface OrchestrationState {
  orchestrations: Orchestration[]
  runs: OrchestrationRun[]

  // Actions
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

const safeStorage = createJSONStorage(() => ({
  getItem: (key) => { try { return localStorage.getItem(key) } catch { return null } },
  setItem: (key, val) => { try { localStorage.setItem(key, val) } catch {} },
  removeItem: (key) => { try { localStorage.removeItem(key) } catch {} },
}))

export const useOrchestrationStore = create<OrchestrationState>()(
  persist(
    (set, get) => ({
      orchestrations: SAMPLE_ORCHESTRATIONS,
      runs: SAMPLE_RUNS,

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
        const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
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

        // Simulate progression
        simulateRun(runId, orch, set, get)
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

      getActiveRuns: () =>
        get().runs.filter(r => r.status === 'running'),
    }),
    {
      name: 'studio-orchestrations',
      storage: safeStorage,
      partialize: (s) => ({
        orchestrations: s.orchestrations,
        runs: s.runs.slice(0, 100), // keep last 100 runs
      }),
    }
  )
)

// ─── Simulation helper ────────────────────────────────────────────────────────
type SetFn = (fn: (s: OrchestrationState) => Partial<OrchestrationState>) => void
type GetFn = () => OrchestrationState

function simulateRun(runId: string, orch: Orchestration, set: SetFn, get: GetFn) {
  const stepDuration = 8000 + Math.random() * 12000 // 8-20s per step
  let stepIdx = 0

  function advanceStep() {
    const run = get().runs.find(r => r.id === runId)
    if (!run || run.status !== 'running') return

    // Complete current step
    const currentStep = orch.steps[stepIdx]
    const failed = Math.random() < 0.08 // 8% chance of failure

    const finalStatus: StepStatus = failed ? 'failed' : 'success'
    set(s => ({
      runs: s.runs.map(r =>
        r.id === runId
          ? {
              ...r,
              stepRuns: r.stepRuns.map(sr =>
                sr.stepId === currentStep.id
                  ? {
                      ...sr,
                      status: finalStatus,
                      finishedAt: Date.now(),
                      toolsUsed: orch.steps[stepIdx].taskTemplate.includes('kubectl') ? ['kubectl'] : ['web_search'],
                      tokensUsed: 800 + Math.floor(Math.random() * 1500),
                      output: failed ? undefined : `Step completed: ${currentStep.name}`,
                      error: failed ? `Error executing ${currentStep.name}` : undefined,
                    }
                  : sr
              ),
            }
          : r
      ),
    }))

    stepIdx++

    if (failed || stepIdx >= orch.steps.length) {
      // Run complete
      set(s => ({
        runs: s.runs.map(r =>
          r.id === runId
            ? { ...r, status: failed ? 'failed' : 'success', finishedAt: Date.now() }
            : r
        ),
      }))
      return
    }

    // Start next step
    const nextStep = orch.steps[stepIdx]
    set(s => ({
      runs: s.runs.map(r =>
        r.id === runId
          ? {
              ...r,
              stepRuns: r.stepRuns.map(sr =>
                sr.stepId === nextStep.id
                  ? { ...sr, status: 'running', startedAt: Date.now() }
                  : sr
              ),
            }
          : r
      ),
    }))

    setTimeout(advanceStep, stepDuration)
  }

  // Start first step
  set(s => ({
    runs: s.runs.map(r =>
      r.id === runId
        ? {
            ...r,
            stepRuns: r.stepRuns.map((sr, i) =>
              i === 0 ? { ...sr, startedAt: Date.now() } : sr
            ),
          }
        : r
    ),
  }))

  setTimeout(advanceStep, stepDuration)
}
