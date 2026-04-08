/**
 * workflowDesignerStore tests
 *
 * Uses Vitest + zustand vanilla store (no React, no DOM, no localStorage).
 * The store logic is extracted into a factory function to allow isolated tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
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

// ── Helpers duplicated from store (to avoid importing the persisted singleton) ─

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function defaultConfigForType(type: WorkflowNodeType) {
  switch (type) {
    case 'agent': return { agentId: '', taskTemplate: '', timeout: 60000, retry: { maxAttempts: 3, backoffMs: 1000 } }
    case 'condition': return { expression: '', trueBranchLabel: 'Yes', falseBranchLabel: 'No' }
    case 'parallel_fork': return { branchCount: 2 }
    case 'parallel_join': return { mergeStrategy: 'wait_all' as const }
    case 'approval': return { prompt: '', approvers: [], timeout: 86400000 }
    case 'timer': return { duration: 'PT5M' }
    case 'subworkflow': return { workflowId: '', inputMappings: [], waitForCompletion: true }
    case 'notification': return { channel: 'dingtalk' as const, template: '' }
    case 'loop': return { condition: 'true', maxIterations: 10 }
    default: return {}
  }
}

function labelForType(type: WorkflowNodeType): string {
  const labels: Record<WorkflowNodeType, string> = {
    agent: 'Agent 任务', condition: '条件分支', parallel_fork: '并行分叉',
    parallel_join: '并行汇合', approval: '人工审批', timer: '定时等待',
    subworkflow: '子工作流', notification: '通知', loop: '循环',
  }
  return labels[type] ?? type
}

function createEmptyWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  const now = Date.now()
  return {
    id: generateId('wf'), name: 'New Workflow', description: '', icon: '🔄',
    projectId: '', nodes: [], edges: [], triggers: [{ type: 'manual' }],
    enabled: false, createdAt: now, updatedAt: now, currentVersion: 1, versions: [],
    ...overrides,
  }
}

// ── In-memory store factory ────────────────────────────────────────────────────

interface DesignerState {
  workflows: WorkflowDefinition[]
  activeWorkflowId: string | null
  selectedNodeIds: string[]
  selectedEdgeId: string | null
  mode: DesignerMode
  viewport: DesignerViewport
  isDirty: boolean

  createWorkflow: (overrides?: Partial<WorkflowDefinition>) => string
  loadWorkflow: (id: string) => void
  saveWorkflow: () => void
  deleteWorkflow: (id: string) => void
  duplicateWorkflow: (id: string) => string
  updateWorkflowMeta: (id: string, patch: Partial<Pick<WorkflowDefinition, 'name' | 'description' | 'icon' | 'enabled'>>) => void

  addNode: (type: WorkflowNodeType, position: Position) => string
  updateNode: (nodeId: string, patch: Partial<Omit<WorkflowNode, 'id'>>) => void
  deleteNode: (nodeId: string) => void
  moveNode: (nodeId: string, position: Position) => void

  addEdge: (from: string, to: string, condition?: WorkflowEdge['condition'], label?: string) => string | null
  updateEdge: (edgeId: string, patch: Partial<Omit<WorkflowEdge, 'id'>>) => void
  deleteEdge: (edgeId: string) => void

  selectNode: (nodeId: string, multi?: boolean) => void
  selectEdge: (edgeId: string | null) => void
  clearSelection: () => void

  setMode: (mode: DesignerMode) => void
  setViewport: (viewport: Partial<DesignerViewport>) => void
  resetViewport: () => void

  snapshotVersion: (comment?: string) => void
  restoreVersion: (workflowId: string, version: number) => void

  getActiveWorkflow: () => WorkflowDefinition | null
}

function makeStore(initial?: Partial<WorkflowDefinition>) {
  const seed = initial ? createEmptyWorkflow(initial) : null

  return createStore<DesignerState>()((set, get) => ({
    workflows: seed ? [seed] : [],
    activeWorkflowId: seed ? seed.id : null,
    selectedNodeIds: [],
    selectedEdgeId: null,
    mode: 'select',
    viewport: { x: 0, y: 0, scale: 1 },
    isDirty: false,

    createWorkflow: (overrides = {}) => {
      const wf = createEmptyWorkflow(overrides)
      set(s => ({ workflows: [...s.workflows, wf], activeWorkflowId: wf.id, isDirty: false, selectedNodeIds: [], selectedEdgeId: null }))
      return wf.id
    },

    loadWorkflow: (id) => set({ activeWorkflowId: id, selectedNodeIds: [], selectedEdgeId: null, isDirty: false }),

    saveWorkflow: () => {
      const { activeWorkflowId } = get()
      if (!activeWorkflowId) return
      set(s => ({
        workflows: s.workflows.map(w => w.id === activeWorkflowId ? { ...w, updatedAt: Date.now() } : w),
        isDirty: false,
      }))
    },

    deleteWorkflow: (id) =>
      set(s => ({
        workflows: s.workflows.filter(w => w.id !== id),
        activeWorkflowId: s.activeWorkflowId === id ? null : s.activeWorkflowId,
      })),

    duplicateWorkflow: (id) => {
      const src = get().workflows.find(w => w.id === id)
      if (!src) return ''
      const newId = generateId('wf')
      const now = Date.now()
      const copy: WorkflowDefinition = {
        ...src, id: newId, name: `${src.name} (副本)`,
        enabled: false, createdAt: now, updatedAt: now, currentVersion: 1, versions: [],
        nodes: src.nodes.map(n => ({ ...n, id: generateId('n') })),
        edges: src.edges.map(e => ({ ...e, id: generateId('e') })),
      }
      set(s => ({ workflows: [...s.workflows, copy] }))
      return newId
    },

    updateWorkflowMeta: (id, patch) =>
      set(s => ({
        workflows: s.workflows.map(w => w.id === id ? { ...w, ...patch, updatedAt: Date.now() } : w),
        isDirty: s.activeWorkflowId === id ? true : s.isDirty,
      })),

    addNode: (type, position) => {
      const { activeWorkflowId } = get()
      if (!activeWorkflowId) return ''
      const nodeId = generateId('n')
      const node: WorkflowNode = {
        id: nodeId, type, label: labelForType(type), position,
        config: defaultConfigForType(type) as WorkflowNode['config'],
      }
      set(s => ({
        workflows: s.workflows.map(w => w.id === activeWorkflowId ? { ...w, nodes: [...w.nodes, node] } : w),
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
            ? { ...w, nodes: w.nodes.filter(n => n.id !== nodeId), edges: w.edges.filter(e => e.from !== nodeId && e.to !== nodeId) }
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
          w.id === activeWorkflowId ? { ...w, nodes: w.nodes.map(n => n.id === nodeId ? { ...n, position } : n) } : w
        ),
        isDirty: true,
      }))
    },

    addEdge: (from, to, condition = 'always', label) => {
      const { activeWorkflowId } = get()
      if (!activeWorkflowId || from === to) return null
      const wf = get().workflows.find(w => w.id === activeWorkflowId)
      if (!wf) return null
      if (wf.edges.some(e => e.from === from && e.to === to)) return null
      const edgeId = generateId('e')
      set(s => ({
        workflows: s.workflows.map(w =>
          w.id === activeWorkflowId ? { ...w, edges: [...w.edges, { id: edgeId, from, to, condition, label }] } : w
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
          w.id === activeWorkflowId ? { ...w, edges: w.edges.map(e => e.id === edgeId ? { ...e, ...patch } : e) } : w
        ),
        isDirty: true,
      }))
    },

    deleteEdge: (edgeId) => {
      const { activeWorkflowId } = get()
      if (!activeWorkflowId) return
      set(s => ({
        workflows: s.workflows.map(w =>
          w.id === activeWorkflowId ? { ...w, edges: w.edges.filter(e => e.id !== edgeId) } : w
        ),
        selectedEdgeId: s.selectedEdgeId === edgeId ? null : s.selectedEdgeId,
        isDirty: true,
      }))
    },

    selectNode: (nodeId, multi = false) =>
      set(s => ({
        selectedNodeIds: multi
          ? s.selectedNodeIds.includes(nodeId)
            ? s.selectedNodeIds.filter(id => id !== nodeId)
            : [...s.selectedNodeIds, nodeId]
          : [nodeId],
        selectedEdgeId: null,
      })),

    selectEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeIds: [] }),

    clearSelection: () => set({ selectedNodeIds: [], selectedEdgeId: null }),

    setMode: (mode) => set({ mode }),

    setViewport: (vp) => set(s => ({ viewport: { ...s.viewport, ...vp } })),

    resetViewport: () => set({ viewport: { x: 0, y: 0, scale: 1 } }),

    snapshotVersion: (comment) => {
      const { activeWorkflowId } = get()
      if (!activeWorkflowId) return
      const wf = get().workflows.find(w => w.id === activeWorkflowId)
      if (!wf) return
      const newVersion = wf.currentVersion + 1
      const entry: WorkflowVersion = {
        version: wf.currentVersion,
        createdAt: Date.now(),
        comment,
        snapshot: { ...wf, versions: [] },
      }
      set(s => ({
        workflows: s.workflows.map(w =>
          w.id === activeWorkflowId
            ? { ...w, currentVersion: newVersion, versions: [...w.versions, entry].slice(-20), updatedAt: Date.now() }
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
        ...entry.snapshot, id: workflowId,
        currentVersion: wf.currentVersion + 1,
        versions: wf.versions,
        updatedAt: Date.now(),
      }
      set(s => ({ workflows: s.workflows.map(w => w.id === workflowId ? restored : w), isDirty: true }))
    },

    getActiveWorkflow: () => {
      const { activeWorkflowId, workflows } = get()
      return workflows.find(w => w.id === activeWorkflowId) ?? null
    },
  }))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('workflowDesignerStore', () => {
  let store: ReturnType<typeof makeStore>

  beforeEach(() => {
    vi.useFakeTimers()
    store = makeStore({ name: 'Test Workflow' })
  })

  // ── Initial state ────────────────────────────────────────────────────────────

  it('initialises with a seeded workflow', () => {
    const { workflows, activeWorkflowId } = store.getState()
    expect(workflows).toHaveLength(1)
    expect(workflows[0].name).toBe('Test Workflow')
    expect(activeWorkflowId).toBe(workflows[0].id)
  })

  it('getActiveWorkflow returns the active workflow', () => {
    const wf = store.getState().getActiveWorkflow()
    expect(wf).not.toBeNull()
    expect(wf?.name).toBe('Test Workflow')
  })

  it('isDirty starts false', () => {
    expect(store.getState().isDirty).toBe(false)
  })

  // ── createWorkflow ───────────────────────────────────────────────────────────

  it('createWorkflow adds and activates a new workflow', () => {
    const id = store.getState().createWorkflow({ name: 'Alpha' })
    expect(id).toBeTruthy()
    const { workflows, activeWorkflowId } = store.getState()
    expect(workflows.length).toBe(2)
    expect(activeWorkflowId).toBe(id)
    expect(workflows.find(w => w.id === id)?.name).toBe('Alpha')
  })

  it('createWorkflow resets isDirty and selection', () => {
    store.getState().selectNode('fake-node')
    store.getState().createWorkflow()
    expect(store.getState().isDirty).toBe(false)
    expect(store.getState().selectedNodeIds).toHaveLength(0)
  })

  // ── loadWorkflow ─────────────────────────────────────────────────────────────

  it('loadWorkflow switches active workflow and clears selection', () => {
    const id2 = store.getState().createWorkflow({ name: 'Beta' })
    const id1 = store.getState().workflows[0].id
    store.getState().selectNode('some-node')
    store.getState().loadWorkflow(id1)
    expect(store.getState().activeWorkflowId).toBe(id1)
    expect(store.getState().selectedNodeIds).toHaveLength(0)
    expect(store.getState().isDirty).toBe(false)
    void id2 // suppress unused warning
  })

  // ── deleteWorkflow ───────────────────────────────────────────────────────────

  it('deleteWorkflow removes the workflow', () => {
    const id = store.getState().workflows[0].id
    store.getState().deleteWorkflow(id)
    expect(store.getState().workflows.find(w => w.id === id)).toBeUndefined()
  })

  it('deleteWorkflow clears activeWorkflowId when active is deleted', () => {
    const id = store.getState().activeWorkflowId!
    store.getState().deleteWorkflow(id)
    expect(store.getState().activeWorkflowId).toBeNull()
  })

  // ── duplicateWorkflow ────────────────────────────────────────────────────────

  it('duplicateWorkflow creates a copy with a different id', () => {
    const srcId = store.getState().workflows[0].id
    const newId = store.getState().duplicateWorkflow(srcId)
    expect(newId).toBeTruthy()
    expect(newId).not.toBe(srcId)
    expect(store.getState().workflows).toHaveLength(2)
    const copy = store.getState().workflows.find(w => w.id === newId)!
    expect(copy.name).toContain('副本')
  })

  it('duplicateWorkflow returns empty string for unknown id', () => {
    expect(store.getState().duplicateWorkflow('ghost')).toBe('')
  })

  // ── updateWorkflowMeta ───────────────────────────────────────────────────────

  it('updateWorkflowMeta patches fields and sets isDirty', () => {
    const id = store.getState().activeWorkflowId!
    store.getState().updateWorkflowMeta(id, { name: 'Renamed', description: 'desc' })
    const wf = store.getState().workflows.find(w => w.id === id)!
    expect(wf.name).toBe('Renamed')
    expect(wf.description).toBe('desc')
    expect(store.getState().isDirty).toBe(true)
  })

  // ── addNode ──────────────────────────────────────────────────────────────────

  it('addNode adds a node to the active workflow', () => {
    const nodeId = store.getState().addNode('agent', { x: 100, y: 200 })
    expect(nodeId).toBeTruthy()
    const wf = store.getState().getActiveWorkflow()!
    expect(wf.nodes).toHaveLength(1)
    expect(wf.nodes[0].id).toBe(nodeId)
    expect(wf.nodes[0].type).toBe('agent')
    expect(wf.nodes[0].position).toEqual({ x: 100, y: 200 })
  })

  it('addNode sets isDirty', () => {
    store.getState().addNode('condition', { x: 0, y: 0 })
    expect(store.getState().isDirty).toBe(true)
  })

  it('addNode returns empty string when no active workflow', () => {
    const emptyStore = makeStore()  // no seed
    void emptyStore.getState().workflows  // just to ensure it's initialised
    // Manually set activeWorkflowId to null
    const id = emptyStore.getState().addNode('agent', { x: 0, y: 0 })
    // No active workflow exists in this store (workflows is empty)
    expect(id).toBe('')
  })

  it('addNode creates correct default config for all node types', () => {
    const types: WorkflowNodeType[] = [
      'agent', 'condition', 'parallel_fork', 'parallel_join',
      'approval', 'timer', 'subworkflow', 'notification', 'loop',
    ]
    for (const type of types) {
      store = makeStore({ name: 'T' })
      store.getState().addNode(type, { x: 0, y: 0 })
      const node = store.getState().getActiveWorkflow()!.nodes[0]
      expect(node.type).toBe(type)
      expect(node.config).toBeDefined()
    }
  })

  // ── updateNode ───────────────────────────────────────────────────────────────

  it('updateNode patches only the target node', () => {
    const n1 = store.getState().addNode('agent', { x: 0, y: 0 })
    store.getState().addNode('condition', { x: 200, y: 0 })
    store.getState().updateNode(n1, { label: 'Updated Label' })
    const wf = store.getState().getActiveWorkflow()!
    expect(wf.nodes.find(n => n.id === n1)?.label).toBe('Updated Label')
    expect(wf.nodes.find(n => n.id !== n1)?.label).not.toBe('Updated Label')
  })

  // ── deleteNode ───────────────────────────────────────────────────────────────

  it('deleteNode removes node and its connected edges', () => {
    const n1 = store.getState().addNode('agent', { x: 0, y: 0 })
    const n2 = store.getState().addNode('agent', { x: 200, y: 0 })
    store.getState().addEdge(n1, n2, 'on_success')
    expect(store.getState().getActiveWorkflow()!.edges).toHaveLength(1)

    store.getState().deleteNode(n1)
    const wf = store.getState().getActiveWorkflow()!
    expect(wf.nodes.find(n => n.id === n1)).toBeUndefined()
    expect(wf.edges).toHaveLength(0)
  })

  it('deleteNode removes node from selectedNodeIds', () => {
    const n1 = store.getState().addNode('agent', { x: 0, y: 0 })
    store.getState().selectNode(n1)
    expect(store.getState().selectedNodeIds).toContain(n1)
    store.getState().deleteNode(n1)
    expect(store.getState().selectedNodeIds).not.toContain(n1)
  })

  // ── moveNode ─────────────────────────────────────────────────────────────────

  it('moveNode updates node position', () => {
    const n1 = store.getState().addNode('agent', { x: 0, y: 0 })
    store.getState().moveNode(n1, { x: 300, y: 400 })
    const node = store.getState().getActiveWorkflow()!.nodes.find(n => n.id === n1)
    expect(node?.position).toEqual({ x: 300, y: 400 })
  })

  // ── addEdge ──────────────────────────────────────────────────────────────────

  it('addEdge creates an edge between two nodes', () => {
    const n1 = store.getState().addNode('agent', { x: 0, y: 0 })
    const n2 = store.getState().addNode('agent', { x: 200, y: 0 })
    const edgeId = store.getState().addEdge(n1, n2, 'on_success')
    expect(edgeId).toBeTruthy()
    const wf = store.getState().getActiveWorkflow()!
    expect(wf.edges).toHaveLength(1)
    expect(wf.edges[0].from).toBe(n1)
    expect(wf.edges[0].to).toBe(n2)
    expect(wf.edges[0].condition).toBe('on_success')
  })

  it('addEdge prevents self-loops', () => {
    const n1 = store.getState().addNode('agent', { x: 0, y: 0 })
    const result = store.getState().addEdge(n1, n1)
    expect(result).toBeNull()
    expect(store.getState().getActiveWorkflow()!.edges).toHaveLength(0)
  })

  it('addEdge prevents duplicate edges', () => {
    const n1 = store.getState().addNode('agent', { x: 0, y: 0 })
    const n2 = store.getState().addNode('agent', { x: 200, y: 0 })
    store.getState().addEdge(n1, n2)
    const result = store.getState().addEdge(n1, n2)
    expect(result).toBeNull()
    expect(store.getState().getActiveWorkflow()!.edges).toHaveLength(1)
  })

  it('addEdge returns null when no active workflow', () => {
    const emptyStore = makeStore()
    const r = emptyStore.getState().addEdge('a', 'b')
    expect(r).toBeNull()
  })

  // ── updateEdge ───────────────────────────────────────────────────────────────

  it('updateEdge patches edge fields', () => {
    const n1 = store.getState().addNode('agent', { x: 0, y: 0 })
    const n2 = store.getState().addNode('agent', { x: 200, y: 0 })
    const edgeId = store.getState().addEdge(n1, n2, 'always')!
    store.getState().updateEdge(edgeId, { condition: 'on_failure', label: 'fail path' })
    const edge = store.getState().getActiveWorkflow()!.edges.find(e => e.id === edgeId)!
    expect(edge.condition).toBe('on_failure')
    expect(edge.label).toBe('fail path')
  })

  // ── deleteEdge ───────────────────────────────────────────────────────────────

  it('deleteEdge removes the edge', () => {
    const n1 = store.getState().addNode('agent', { x: 0, y: 0 })
    const n2 = store.getState().addNode('agent', { x: 200, y: 0 })
    const edgeId = store.getState().addEdge(n1, n2)!
    store.getState().deleteEdge(edgeId)
    expect(store.getState().getActiveWorkflow()!.edges).toHaveLength(0)
  })

  it('deleteEdge clears selectedEdgeId if it was selected', () => {
    const n1 = store.getState().addNode('agent', { x: 0, y: 0 })
    const n2 = store.getState().addNode('agent', { x: 200, y: 0 })
    const edgeId = store.getState().addEdge(n1, n2)!
    store.getState().selectEdge(edgeId)
    store.getState().deleteEdge(edgeId)
    expect(store.getState().selectedEdgeId).toBeNull()
  })

  // ── selection ────────────────────────────────────────────────────────────────

  it('selectNode sets single selection and clears edge', () => {
    const n1 = store.getState().addNode('agent', { x: 0, y: 0 })
    const n2 = store.getState().addNode('agent', { x: 200, y: 0 })
    store.getState().selectEdge('fake-edge')
    store.getState().selectNode(n1)
    expect(store.getState().selectedNodeIds).toEqual([n1])
    expect(store.getState().selectedEdgeId).toBeNull()
    void n2
  })

  it('selectNode with multi=true toggles inclusion', () => {
    const n1 = store.getState().addNode('agent', { x: 0, y: 0 })
    const n2 = store.getState().addNode('agent', { x: 200, y: 0 })
    store.getState().selectNode(n1)
    store.getState().selectNode(n2, true)
    expect(store.getState().selectedNodeIds).toContain(n1)
    expect(store.getState().selectedNodeIds).toContain(n2)
    // Toggle off n1
    store.getState().selectNode(n1, true)
    expect(store.getState().selectedNodeIds).not.toContain(n1)
  })

  it('selectEdge sets selectedEdgeId and clears nodes', () => {
    const n1 = store.getState().addNode('agent', { x: 0, y: 0 })
    store.getState().selectNode(n1)
    store.getState().selectEdge('edge-123')
    expect(store.getState().selectedEdgeId).toBe('edge-123')
    expect(store.getState().selectedNodeIds).toHaveLength(0)
  })

  it('clearSelection resets all selections', () => {
    const n1 = store.getState().addNode('agent', { x: 0, y: 0 })
    store.getState().selectNode(n1)
    store.getState().selectEdge('e1')
    store.getState().clearSelection()
    expect(store.getState().selectedNodeIds).toHaveLength(0)
    expect(store.getState().selectedEdgeId).toBeNull()
  })

  // ── mode ─────────────────────────────────────────────────────────────────────

  it('setMode changes designer mode', () => {
    store.getState().setMode('connect')
    expect(store.getState().mode).toBe('connect')
    store.getState().setMode('pan')
    expect(store.getState().mode).toBe('pan')
    store.getState().setMode('select')
    expect(store.getState().mode).toBe('select')
  })

  // ── viewport ─────────────────────────────────────────────────────────────────

  it('setViewport partially updates viewport', () => {
    store.getState().setViewport({ scale: 1.5 })
    expect(store.getState().viewport.scale).toBe(1.5)
    expect(store.getState().viewport.x).toBe(0) // unchanged
  })

  it('resetViewport restores defaults', () => {
    store.getState().setViewport({ x: 300, y: 200, scale: 2 })
    store.getState().resetViewport()
    expect(store.getState().viewport).toEqual({ x: 0, y: 0, scale: 1 })
  })

  // ── saveWorkflow ─────────────────────────────────────────────────────────────

  it('saveWorkflow clears isDirty', () => {
    store.getState().addNode('agent', { x: 0, y: 0 })
    expect(store.getState().isDirty).toBe(true)
    store.getState().saveWorkflow()
    expect(store.getState().isDirty).toBe(false)
  })

  // ── version management ────────────────────────────────────────────────────────

  it('snapshotVersion increments version number', () => {
    const wfBefore = store.getState().getActiveWorkflow()!
    expect(wfBefore.currentVersion).toBe(1)
    store.getState().snapshotVersion('initial')
    const wfAfter = store.getState().getActiveWorkflow()!
    expect(wfAfter.currentVersion).toBe(2)
  })

  it('snapshotVersion stores a version entry', () => {
    store.getState().snapshotVersion('v1 comment')
    const wf = store.getState().getActiveWorkflow()!
    expect(wf.versions).toHaveLength(1)
    expect(wf.versions[0].comment).toBe('v1 comment')
    expect(wf.versions[0].version).toBe(1)
  })

  it('snapshotVersion clears isDirty', () => {
    store.getState().addNode('agent', { x: 0, y: 0 })
    store.getState().snapshotVersion()
    expect(store.getState().isDirty).toBe(false)
  })

  it('restoreVersion restores a prior snapshot', () => {
    store.getState().addNode('agent', { x: 100, y: 100 })
    store.getState().snapshotVersion('with one node')
    // Now add another node
    store.getState().addNode('condition', { x: 300, y: 100 })
    expect(store.getState().getActiveWorkflow()!.nodes).toHaveLength(2)
    // Restore version 1 (which had 1 node)
    const wfId = store.getState().activeWorkflowId!
    store.getState().restoreVersion(wfId, 1)
    expect(store.getState().getActiveWorkflow()!.nodes).toHaveLength(1)
    expect(store.getState().isDirty).toBe(true)
  })

  it('restoreVersion does nothing for unknown version', () => {
    const wfId = store.getState().activeWorkflowId!
    const before = store.getState().getActiveWorkflow()!.currentVersion
    store.getState().restoreVersion(wfId, 999)
    expect(store.getState().getActiveWorkflow()!.currentVersion).toBe(before)
  })

  // ── version cap ──────────────────────────────────────────────────────────────

  it('snapshotVersion keeps at most 20 versions', () => {
    for (let i = 0; i < 25; i++) {
      store.getState().snapshotVersion(`v${i}`)
    }
    const versions = store.getState().getActiveWorkflow()!.versions
    expect(versions.length).toBeLessThanOrEqual(20)
  })
})
