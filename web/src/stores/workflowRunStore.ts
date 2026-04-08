// ─── Workflow Run Store ────────────────────────────────────────────────────────
// Manages WorkflowRun execution state, separate from the designer store.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowNodeRunState,
} from '@/types/workflow'
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateRunId(): string {
  return `wfrun-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const now = Date.now()
const mins = (n: number) => n * 60_000
const hrs  = (n: number) => n * 3_600_000

function makeSeedRun(
  id: string,
  workflowId: string,
  status: WorkflowRunStatus,
  startOffset: number,
  durationMs: number,
  triggeredBy: string,
  nodeIds: string[],
): WorkflowRun {
  const startedAt = now - startOffset
  const nodeStates: WorkflowNodeRunState[] = nodeIds.map((nodeId, i) => {
    const nodeStart = startedAt + (durationMs / nodeIds.length) * i
    const nodeEnd   = startedAt + (durationMs / nodeIds.length) * (i + 1)
    const isLast = i === nodeIds.length - 1
    const nodeStatus =
      status === 'success' ? 'success' :
      status === 'failed'  && isLast   ? 'failed' :
      status === 'running' && isLast   ? 'running' :
      'success'
    return {
      nodeId,
      status: nodeStatus,
      startedAt: nodeStart,
      finishedAt: nodeStatus === 'running' ? undefined : nodeEnd,
      output: nodeStatus === 'success'
        ? `节点 ${nodeId} 执行完毕，输出 ${Math.floor(Math.random() * 500) + 100} 条记录`
        : undefined,
      error: nodeStatus === 'failed'
        ? `执行超时或依赖服务不可用 (节点 ${nodeId})`
        : undefined,
    }
  })

  return {
    id,
    workflowId,
    status,
    triggeredBy,
    startedAt,
    finishedAt: status === 'running' ? undefined : startedAt + durationMs,
    nodeStates,
  }
}

// Seed runs bound to the sample workflow in workflowDesignerStore ('sample-wf-001')
const SEED_WORKFLOW_ID = 'sample-wf-001'
const SEED_NODE_IDS = ['n-start', 'n-fork', 'n-vuln', 'n-compliance', 'n-join', 'n-condition', 'n-approval', 'n-notify']

export const SEED_WORKFLOW_RUNS: WorkflowRun[] = [
  makeSeedRun('wfrun-s001', SEED_WORKFLOW_ID, 'success',  hrs(2),   mins(4) + 32_000, 'user:john',    SEED_NODE_IDS),
  makeSeedRun('wfrun-s002', SEED_WORKFLOW_ID, 'success',  hrs(26),  mins(5) + 10_000, 'scheduler',    SEED_NODE_IDS),
  makeSeedRun('wfrun-s003', SEED_WORKFLOW_ID, 'failed',   hrs(50),  mins(2) + 8_000,  'scheduler',    SEED_NODE_IDS),
  makeSeedRun('wfrun-s004', SEED_WORKFLOW_ID, 'running',  mins(15), mins(3),          'user:john',    SEED_NODE_IDS),
  makeSeedRun('wfrun-s005', SEED_WORKFLOW_ID, 'cancelled',hrs(72),  mins(1) + 5_000,  'user:admin',   SEED_NODE_IDS),
]

// ─── Store interface ──────────────────────────────────────────────────────────

interface WorkflowRunState {
  runs: WorkflowRun[]

  // ── Actions ────────────────────────────────────────────────────────────────
  triggerRun: (workflowId: string, triggeredBy?: string) => string
  cancelRun:  (runId: string) => void
  updateNodeState: (runId: string, nodeId: string, patch: Partial<WorkflowNodeRunState>) => void
  updateRunStatus: (runId: string, status: WorkflowRunStatus) => void

  // ── Selectors ──────────────────────────────────────────────────────────────
  getRunsForWorkflow: (workflowId: string) => WorkflowRun[]
  getRunById:         (runId: string) => WorkflowRun | undefined
  getActiveRuns:      () => WorkflowRun[]

  // ── Derived metrics ────────────────────────────────────────────────────────
  getSuccessRate:       (workflowId: string) => number
  getAvgDurationMs:     (workflowId: string) => number | null
  getRecentRuns:        (limit?: number) => WorkflowRun[]
  getStatusBreakdown:   () => Record<WorkflowRunStatus, number>
}

// ─── Local storage adapter ────────────────────────────────────────────────────

const safeStorage = createJSONStorage(() => ({
  getItem:    (key: string) => { try { return localStorage.getItem(key) } catch { return null } },
  setItem:    (key: string, val: string) => { try { localStorage.setItem(key, val) } catch {} },
  removeItem: (key: string) => { try { localStorage.removeItem(key) } catch {} },
}))

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWorkflowRunStore = create<WorkflowRunState>()(
  persist(
    (set, get) => ({
      runs: SEED_WORKFLOW_RUNS,

      // ── Trigger a new run ──────────────────────────────────────────────────

      triggerRun: (workflowId, triggeredBy = 'user') => {
        // Pull node IDs from the designer store at trigger time
        const wf = useWorkflowDesignerStore.getState().workflows.find(w => w.id === workflowId)
        const nodeIds = wf ? wf.nodes.map(n => n.id) : []

        const runId = generateRunId()
        const startedAt = Date.now()
        const newRun: WorkflowRun = {
          id: runId,
          workflowId,
          status: 'running',
          triggeredBy,
          startedAt,
          nodeStates: nodeIds.map((nodeId, i) => ({
            nodeId,
            status: i === 0 ? 'running' : 'waiting',
            startedAt: i === 0 ? startedAt : undefined,
          })),
        }

        set(s => ({ runs: [newRun, ...s.runs] }))

        // Simulate progressive step execution
        if (nodeIds.length > 0) {
          simulateWorkflowRun(runId, nodeIds, set, get)
        }

        return runId
      },

      // ── Cancel ────────────────────────────────────────────────────────────

      cancelRun: (runId) =>
        set(s => ({
          runs: s.runs.map(r =>
            r.id === runId && r.status === 'running'
              ? { ...r, status: 'cancelled', finishedAt: Date.now() }
              : r
          ),
        })),

      // ── Granular node-state update ─────────────────────────────────────────

      updateNodeState: (runId, nodeId, patch) =>
        set(s => ({
          runs: s.runs.map(r =>
            r.id === runId
              ? {
                  ...r,
                  nodeStates: r.nodeStates.map(ns =>
                    ns.nodeId === nodeId ? { ...ns, ...patch } : ns
                  ),
                }
              : r
          ),
        })),

      // ── Run-level status update ────────────────────────────────────────────

      updateRunStatus: (runId, status) =>
        set(s => ({
          runs: s.runs.map(r =>
            r.id === runId
              ? { ...r, status, finishedAt: ['success','failed','cancelled'].includes(status) ? Date.now() : r.finishedAt }
              : r
          ),
        })),

      // ── Selectors ─────────────────────────────────────────────────────────

      getRunsForWorkflow: (workflowId) =>
        get().runs
          .filter(r => r.workflowId === workflowId)
          .sort((a, b) => b.startedAt - a.startedAt),

      getRunById: (runId) =>
        get().runs.find(r => r.id === runId),

      getActiveRuns: () =>
        get().runs.filter(r => r.status === 'running'),

      getSuccessRate: (workflowId) => {
        const finished = get().runs.filter(r =>
          r.workflowId === workflowId &&
          (r.status === 'success' || r.status === 'failed')
        )
        if (!finished.length) return 100
        return Math.round(
          (finished.filter(r => r.status === 'success').length / finished.length) * 100
        )
      },

      getAvgDurationMs: (workflowId) => {
        const completed = get().runs.filter(r =>
          r.workflowId === workflowId &&
          r.finishedAt != null
        )
        if (!completed.length) return null
        const total = completed.reduce(
          (sum, r) => sum + (r.finishedAt! - r.startedAt), 0
        )
        return Math.round(total / completed.length)
      },

      getRecentRuns: (limit = 10) =>
        get().runs
          .slice()
          .sort((a, b) => b.startedAt - a.startedAt)
          .slice(0, limit),

      getStatusBreakdown: () => {
        const counts: Record<WorkflowRunStatus, number> = {
          pending: 0, running: 0, success: 0, failed: 0, cancelled: 0,
        }
        for (const r of get().runs) counts[r.status]++
        return counts
      },
    }),
    {
      name: 'workflow-run-state',
      storage: safeStorage,
      partialize: (s) => ({ runs: s.runs.slice(0, 200) }),
    }
  )
)

// ─── Simulation helper ────────────────────────────────────────────────────────

type SetFn = (fn: (s: WorkflowRunState) => Partial<WorkflowRunState>) => void
type GetFn = () => WorkflowRunState

function simulateWorkflowRun(
  runId: string,
  nodeIds: string[],
  set: SetFn,
  get: GetFn,
) {
  let idx = 0
  const stepDuration = () => 5_000 + Math.random() * 10_000 // 5–15 s per node

  function advance() {
    const run = get().runs.find(r => r.id === runId)
    if (!run || run.status !== 'running') return

    const currentNodeId = nodeIds[idx]
    const failed = Math.random() < 0.07 // 7% failure chance

    // Complete current node
    set(s => ({
      runs: s.runs.map(r =>
        r.id === runId
          ? {
              ...r,
              nodeStates: r.nodeStates.map(ns =>
                ns.nodeId === currentNodeId
                  ? {
                      ...ns,
                      status: failed ? 'failed' : 'success',
                      finishedAt: Date.now(),
                      output: failed ? undefined : `处理完成 (${Math.floor(Math.random() * 500) + 50} 条记录)`,
                      error: failed ? `执行失败：超时或依赖异常` : undefined,
                    }
                  : ns
              ),
            }
          : r
      ),
    }))

    idx++

    if (failed || idx >= nodeIds.length) {
      set(s => ({
        runs: s.runs.map(r =>
          r.id === runId
            ? { ...r, status: failed ? 'failed' : 'success', finishedAt: Date.now() }
            : r
        ),
      }))
      return
    }

    // Start next node
    const nextNodeId = nodeIds[idx]
    set(s => ({
      runs: s.runs.map(r =>
        r.id === runId
          ? {
              ...r,
              nodeStates: r.nodeStates.map(ns =>
                ns.nodeId === nextNodeId
                  ? { ...ns, status: 'running', startedAt: Date.now() }
                  : ns
              ),
            }
          : r
      ),
    }))

    setTimeout(advance, stepDuration())
  }

  setTimeout(advance, stepDuration())
}
