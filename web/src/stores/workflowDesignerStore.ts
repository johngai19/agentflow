import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  DesignerMode,
  DesignerViewport,
  Position,
  WorkflowVersion,
} from '@/types/workflow'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function defaultConfigForType(type: WorkflowNodeType) {
  switch (type) {
    case 'agent':
      return { agentId: '', taskTemplate: '', inputMappings: [], timeout: 60000, retry: { maxAttempts: 3, backoffMs: 1000 } }
    case 'condition':
      return { expression: '', trueBranchLabel: 'Yes', falseBranchLabel: 'No' }
    case 'parallel_fork':
      return { branchCount: 2 }
    case 'parallel_join':
      return { mergeStrategy: 'wait_all' as const }
    case 'approval':
      return { prompt: '', approvers: [], timeout: 86400000 }
    case 'timer':
      return { duration: 'PT5M' }
    case 'subworkflow':
      return { workflowId: '', inputMappings: [], waitForCompletion: true }
    case 'notification':
      return { channel: 'dingtalk' as const, template: '' }
    case 'loop':
      return { condition: 'true', maxIterations: 10 }
    default:
      return {}
  }
}

// ─── Empty workflow factory ───────────────────────────────────────────────────

export function createEmptyWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  const now = Date.now()
  return {
    id: generateId('wf'),
    name: 'New Workflow',
    description: '',
    icon: '🔄',
    projectId: '',
    nodes: [],
    edges: [],
    triggers: [{ type: 'manual' }],
    enabled: false,
    createdAt: now,
    updatedAt: now,
    currentVersion: 1,
    versions: [],
    ...overrides,
  }
}

// ─── Sample workflow ──────────────────────────────────────────────────────────

const SAMPLE_WORKFLOW: WorkflowDefinition = {
  id: 'sample-wf-001',
  name: '示例：安全巡检工作流',
  description: '端到端安全巡检示例，含并行分支和人工审批',
  icon: '🛡️',
  projectId: 'security',
  enabled: true,
  createdAt: Date.now() - 86400000 * 3,
  updatedAt: Date.now() - 3600000,
  currentVersion: 2,
  versions: [],
  triggers: [{ type: 'cron', schedule: '0 2 * * *' }, { type: 'manual' }],
  nodes: [
    {
      id: 'n-start',
      type: 'agent',
      label: '数据收集',
      position: { x: 120, y: 200 },
      isStart: true,
      config: { agentId: 'alice', taskTemplate: '收集所有云资源清单', timeout: 60000, retry: { maxAttempts: 3, backoffMs: 1000 } },
    },
    {
      id: 'n-fork',
      type: 'parallel_fork',
      label: '并行扫描',
      position: { x: 340, y: 200 },
      config: { branchCount: 2 },
    },
    {
      id: 'n-vuln',
      type: 'agent',
      label: '漏洞扫描',
      position: { x: 560, y: 120 },
      config: { agentId: 'diana', taskTemplate: '执行 CVE 扫描', timeout: 120000, retry: { maxAttempts: 2, backoffMs: 2000 } },
    },
    {
      id: 'n-compliance',
      type: 'agent',
      label: '合规检查',
      position: { x: 560, y: 300 },
      config: { agentId: 'diana', taskTemplate: '检查 CIS Benchmark', timeout: 90000, retry: { maxAttempts: 2, backoffMs: 2000 } },
    },
    {
      id: 'n-join',
      type: 'parallel_join',
      label: '汇合结果',
      position: { x: 780, y: 200 },
      config: { mergeStrategy: 'wait_all' },
    },
    {
      id: 'n-condition',
      type: 'condition',
      label: '有严重漏洞?',
      position: { x: 980, y: 200 },
      config: { expression: 'findings.critical > 0', trueBranchLabel: '需审批', falseBranchLabel: '直接报告' },
    },
    {
      id: 'n-approval',
      type: 'approval',
      label: '人工审批',
      position: { x: 1180, y: 120 },
      config: { prompt: '发现严重漏洞，请确认处理方案', approvers: ['security-team'], timeout: 3600000 },
    },
    {
      id: 'n-notify',
      type: 'notification',
      label: '发送告警',
      position: { x: 1380, y: 200 },
      config: { channel: 'dingtalk', template: '安全巡检完成：{{summary}}', recipients: ['security-team'] },
    },
  ],
  edges: [
    { id: 'e1', from: 'n-start', to: 'n-fork', condition: 'on_success' },
    { id: 'e2', from: 'n-fork', to: 'n-vuln', condition: 'always' },
    { id: 'e3', from: 'n-fork', to: 'n-compliance', condition: 'always' },
    { id: 'e4', from: 'n-vuln', to: 'n-join', condition: 'always' },
    { id: 'e5', from: 'n-compliance', to: 'n-join', condition: 'always' },
    { id: 'e6', from: 'n-join', to: 'n-condition', condition: 'on_success' },
    { id: 'e7', from: 'n-condition', to: 'n-approval', condition: 'on_true', label: '需审批' },
    { id: 'e8', from: 'n-condition', to: 'n-notify', condition: 'on_false', label: '直接报告' },
    { id: 'e9', from: 'n-approval', to: 'n-notify', condition: 'on_success' },
  ],
}

// ─── Store state ──────────────────────────────────────────────────────────────

interface WorkflowDesignerState {
  // Workflow catalog
  workflows: WorkflowDefinition[]

  // Active designer session
  activeWorkflowId: string | null
  selectedNodeIds: string[]
  selectedEdgeId: string | null
  mode: DesignerMode
  viewport: DesignerViewport
  isDirty: boolean

  // ── Workflow CRUD ──────────────────────────────────────────────────────────
  createWorkflow: (overrides?: Partial<WorkflowDefinition>) => string
  loadWorkflow: (id: string) => void
  saveWorkflow: () => void
  deleteWorkflow: (id: string) => void
  duplicateWorkflow: (id: string) => string
  updateWorkflowMeta: (id: string, patch: Partial<Pick<WorkflowDefinition, 'name' | 'description' | 'icon' | 'enabled' | 'triggers' | 'concurrency' | 'timeout'>>) => void

  // ── Node operations ────────────────────────────────────────────────────────
  addNode: (type: WorkflowNodeType, position: Position) => string
  updateNode: (nodeId: string, patch: Partial<Omit<WorkflowNode, 'id'>>) => void
  deleteNode: (nodeId: string) => void
  moveNode: (nodeId: string, position: Position) => void

  // ── Edge operations ────────────────────────────────────────────────────────
  addEdge: (from: string, to: string, condition?: WorkflowEdge['condition'], label?: string) => string | null
  updateEdge: (edgeId: string, patch: Partial<Omit<WorkflowEdge, 'id'>>) => void
  deleteEdge: (edgeId: string) => void

  // ── Selection ──────────────────────────────────────────────────────────────
  selectNode: (nodeId: string, multi?: boolean) => void
  selectEdge: (edgeId: string | null) => void
  clearSelection: () => void

  // ── Viewport ───────────────────────────────────────────────────────────────
  setMode: (mode: DesignerMode) => void
  setViewport: (viewport: Partial<DesignerViewport>) => void
  resetViewport: () => void

  // ── Version management ─────────────────────────────────────────────────────
  snapshotVersion: (comment?: string) => void
  restoreVersion: (workflowId: string, version: number) => void

  // ── Selectors ──────────────────────────────────────────────────────────────
  getActiveWorkflow: () => WorkflowDefinition | null
}

// ─── Local storage adapter ────────────────────────────────────────────────────

const safeStorage = createJSONStorage(() => ({
  getItem: (key: string) => { try { return localStorage.getItem(key) } catch { return null } },
  setItem: (key: string, val: string) => { try { localStorage.setItem(key, val) } catch {} },
  removeItem: (key: string) => { try { localStorage.removeItem(key) } catch {} },
}))

// ─── Store implementation ─────────────────────────────────────────────────────

export const useWorkflowDesignerStore = create<WorkflowDesignerState>()(
  persist(
    (set, get) => ({
      workflows: [SAMPLE_WORKFLOW],
      activeWorkflowId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      mode: 'select',
      viewport: { x: 0, y: 0, scale: 1 },
      isDirty: false,

      // ── Workflow CRUD ────────────────────────────────────────────────────────

      createWorkflow: (overrides = {}) => {
        const wf = createEmptyWorkflow(overrides)
        set(s => ({ workflows: [...s.workflows, wf], activeWorkflowId: wf.id, isDirty: false, selectedNodeIds: [], selectedEdgeId: null }))
        return wf.id
      },

      loadWorkflow: (id) => {
        set({ activeWorkflowId: id, selectedNodeIds: [], selectedEdgeId: null, isDirty: false, viewport: { x: 0, y: 0, scale: 1 } })
      },

      saveWorkflow: () => {
        const { activeWorkflowId } = get()
        if (!activeWorkflowId) return
        set(s => ({
          workflows: s.workflows.map(w =>
            w.id === activeWorkflowId ? { ...w, updatedAt: Date.now() } : w
          ),
          isDirty: false,
        }))
      },

      deleteWorkflow: (id) => {
        set(s => ({
          workflows: s.workflows.filter(w => w.id !== id),
          activeWorkflowId: s.activeWorkflowId === id ? null : s.activeWorkflowId,
        }))
      },

      duplicateWorkflow: (id) => {
        const src = get().workflows.find(w => w.id === id)
        if (!src) return ''
        const newId = generateId('wf')
        const now = Date.now()
        const copy: WorkflowDefinition = {
          ...src,
          id: newId,
          name: `${src.name} (副本)`,
          enabled: false,
          createdAt: now,
          updatedAt: now,
          currentVersion: 1,
          versions: [],
          // Deep-clone nodes and edges with new IDs
          nodes: src.nodes.map(n => ({ ...n, id: generateId('n') })),
          edges: src.edges.map(e => ({ ...e, id: generateId('e') })),
        }
        set(s => ({ workflows: [...s.workflows, copy] }))
        return newId
      },

      updateWorkflowMeta: (id, patch) => {
        set(s => ({
          workflows: s.workflows.map(w =>
            w.id === id ? { ...w, ...patch, updatedAt: Date.now() } : w
          ),
          isDirty: s.activeWorkflowId === id ? true : s.isDirty,
        }))
      },

      // ── Node operations ──────────────────────────────────────────────────────

      addNode: (type, position) => {
        const { activeWorkflowId } = get()
        if (!activeWorkflowId) return ''
        const nodeId = generateId('n')
        const node: WorkflowNode = {
          id: nodeId,
          type,
          label: labelForType(type),
          position,
          config: defaultConfigForType(type) as WorkflowNode['config'],
        }
        set(s => ({
          workflows: s.workflows.map(w =>
            w.id === activeWorkflowId ? { ...w, nodes: [...w.nodes, node] } : w
          ),
          isDirty: true,
        }))
        return nodeId
      },

      updateNode: (nodeId, patch) => {
        const { activeWorkflowId } = get()
        if (!activeWorkflowId) return
        set(s => ({
          workflows: s.workflows.map(w =>
            w.id === activeWorkflowId
              ? { ...w, nodes: w.nodes.map(n => n.id === nodeId ? { ...n, ...patch } : n) }
              : w
          ),
          isDirty: true,
        }))
      },

      deleteNode: (nodeId) => {
        const { activeWorkflowId } = get()
        if (!activeWorkflowId) return
        set(s => ({
          workflows: s.workflows.map(w =>
            w.id === activeWorkflowId
              ? {
                  ...w,
                  nodes: w.nodes.filter(n => n.id !== nodeId),
                  edges: w.edges.filter(e => e.from !== nodeId && e.to !== nodeId),
                }
              : w
          ),
          selectedNodeIds: s.selectedNodeIds.filter(id => id !== nodeId),
          isDirty: true,
        }))
      },

      moveNode: (nodeId, position) => {
        const { activeWorkflowId } = get()
        if (!activeWorkflowId) return
        set(s => ({
          workflows: s.workflows.map(w =>
            w.id === activeWorkflowId
              ? { ...w, nodes: w.nodes.map(n => n.id === nodeId ? { ...n, position } : n) }
              : w
          ),
          isDirty: true,
        }))
      },

      // ── Edge operations ──────────────────────────────────────────────────────

      addEdge: (from, to, condition = 'always', label) => {
        const { activeWorkflowId } = get()
        if (!activeWorkflowId || from === to) return null
        const wf = get().workflows.find(w => w.id === activeWorkflowId)
        if (!wf) return null
        if (wf.edges.some(e => e.from === from && e.to === to)) return null // duplicate
        const edgeId = generateId('e')
        const edge: WorkflowEdge = { id: edgeId, from, to, condition, label }
        set(s => ({
          workflows: s.workflows.map(w =>
            w.id === activeWorkflowId ? { ...w, edges: [...w.edges, edge] } : w
          ),
          isDirty: true,
        }))
        return edgeId
      },

      updateEdge: (edgeId, patch) => {
        const { activeWorkflowId } = get()
        if (!activeWorkflowId) return
        set(s => ({
          workflows: s.workflows.map(w =>
            w.id === activeWorkflowId
              ? { ...w, edges: w.edges.map(e => e.id === edgeId ? { ...e, ...patch } : e) }
              : w
          ),
          isDirty: true,
        }))
      },

      deleteEdge: (edgeId) => {
        const { activeWorkflowId } = get()
        if (!activeWorkflowId) return
        set(s => ({
          workflows: s.workflows.map(w =>
            w.id === activeWorkflowId
              ? { ...w, edges: w.edges.filter(e => e.id !== edgeId) }
              : w
          ),
          selectedEdgeId: s.selectedEdgeId === edgeId ? null : s.selectedEdgeId,
          isDirty: true,
        }))
      },

      // ── Selection ────────────────────────────────────────────────────────────

      selectNode: (nodeId, multi = false) => {
        set(s => ({
          selectedNodeIds: multi
            ? s.selectedNodeIds.includes(nodeId)
              ? s.selectedNodeIds.filter(id => id !== nodeId)
              : [...s.selectedNodeIds, nodeId]
            : [nodeId],
          selectedEdgeId: null,
        }))
      },

      selectEdge: (edgeId) => {
        set({ selectedEdgeId: edgeId, selectedNodeIds: [] })
      },

      clearSelection: () => {
        set({ selectedNodeIds: [], selectedEdgeId: null })
      },

      // ── Viewport ─────────────────────────────────────────────────────────────

      setMode: (mode) => set({ mode }),

      setViewport: (viewport) => {
        set(s => ({ viewport: { ...s.viewport, ...viewport } }))
      },

      resetViewport: () => {
        set({ viewport: { x: 0, y: 0, scale: 1 } })
      },

      // ── Version management ────────────────────────────────────────────────────

      snapshotVersion: (comment) => {
        const { activeWorkflowId } = get()
        if (!activeWorkflowId) return
        const wf = get().workflows.find(w => w.id === activeWorkflowId)
        if (!wf) return
        const newVersion = wf.currentVersion + 1
        const versionEntry: WorkflowVersion = {
          version: wf.currentVersion,
          createdAt: Date.now(),
          comment,
          snapshot: { ...wf, versions: [] }, // don't nest version history
        }
        set(s => ({
          workflows: s.workflows.map(w =>
            w.id === activeWorkflowId
              ? {
                  ...w,
                  currentVersion: newVersion,
                  versions: [...w.versions, versionEntry].slice(-20), // keep last 20
                  updatedAt: Date.now(),
                }
              : w
          ),
          isDirty: false,
        }))
      },

      restoreVersion: (workflowId, version) => {
        const wf = get().workflows.find(w => w.id === workflowId)
        if (!wf) return
        const entry = wf.versions.find(v => v.version === version)
        if (!entry) return
        const restored: WorkflowDefinition = {
          ...entry.snapshot,
          id: workflowId,
          currentVersion: wf.currentVersion + 1,
          versions: wf.versions,
          updatedAt: Date.now(),
        }
        set(s => ({
          workflows: s.workflows.map(w => w.id === workflowId ? restored : w),
          isDirty: true,
        }))
      },

      // ── Selectors ────────────────────────────────────────────────────────────

      getActiveWorkflow: () => {
        const { activeWorkflowId, workflows } = get()
        return workflows.find(w => w.id === activeWorkflowId) ?? null
      },
    }),
    {
      name: 'workflow-designer-state',
      storage: safeStorage,
      partialize: (s) => ({
        workflows: s.workflows.map(w => ({
          ...w,
          // trim version history for storage
          versions: w.versions.slice(-10),
        })),
        activeWorkflowId: s.activeWorkflowId,
      }),
    }
  )
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function labelForType(type: WorkflowNodeType): string {
  const labels: Record<WorkflowNodeType, string> = {
    agent: 'Agent 任务',
    condition: '条件分支',
    parallel_fork: '并行分叉',
    parallel_join: '并行汇合',
    approval: '人工审批',
    timer: '定时等待',
    subworkflow: '子工作流',
    notification: '通知',
    loop: '循环',
  }
  return labels[type] ?? type
}
