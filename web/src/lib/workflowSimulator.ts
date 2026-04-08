// ─── Workflow Simulation Engine ───────────────────────────────────────────────
//
// Dry-run simulation of a WorkflowDefinition.  No real API calls are made.
// The engine traverses the DAG, emitting step events at configurable tick
// intervals. Condition branches are resolved pseudo-randomly (configurable).
//
// Design principles:
//   - Pure function entry point: createSimulation()
//   - Emits events via callback — works in any React state model
//   - Deterministic when given a fixed seed (future enhancement)
//   - Abortable via AbortController

import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeRunState,
  WorkflowRunStatus,
  EdgeCondition,
} from '@/types/workflow'

// ─── Public types ─────────────────────────────────────────────────────────────

export type SimulationStatus = 'idle' | 'running' | 'completed' | 'aborted' | 'error'

export interface SimulationStepEvent {
  type: 'node_start' | 'node_success' | 'node_skip' | 'node_error' | 'workflow_complete' | 'workflow_error'
  nodeId?: string
  nodeLabel?: string
  message: string
  timestamp: number
}

export interface SimulationResult {
  status: WorkflowRunStatus
  /** All node run states indexed by nodeId */
  nodeStates: Record<string, WorkflowNodeRunState>
  /** Ordered execution log */
  events: SimulationStepEvent[]
  durationMs: number
  /** Nodes that were visited */
  visitedNodeIds: string[]
  /** Nodes that were skipped (pruned branch) */
  skippedNodeIds: string[]
}

export interface SimulationOptions {
  /** Delay between node steps in ms (default: 600) */
  stepDelayMs?: number
  /**
   * How to resolve condition branches.
   * 'random'  = flip a coin each time
   * 'always_true' = always take the true / on_true branch
   * 'always_false' = always take the false / on_false branch
   */
  conditionMode?: 'random' | 'always_true' | 'always_false'
  /**
   * Probability (0-1) that a non-approval node fails (default: 0).
   * Useful for testing error-path branches.
   */
  failureProbability?: number
  /** Simulated execution time range per node in ms (default: [200, 800]) */
  nodeExecTimeRange?: [number, number]
  onEvent?: (event: SimulationStepEvent) => void
  onStateUpdate?: (states: Record<string, WorkflowNodeRunState>) => void
  signal?: AbortSignal
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
  })
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Build an adjacency map: nodeId → outbound edges */
function buildAdjacency(edges: WorkflowEdge[]): Map<string, WorkflowEdge[]> {
  const map = new Map<string, WorkflowEdge[]>()
  for (const edge of edges) {
    if (!map.has(edge.from)) map.set(edge.from, [])
    map.get(edge.from)!.push(edge)
  }
  return map
}

/** Find the start node (isStart=true, or the node with no incoming edges) */
function findStartNode(def: WorkflowDefinition): WorkflowNode | null {
  const explicit = def.nodes.find(n => n.isStart)
  if (explicit) return explicit
  const hasIncoming = new Set(def.edges.map(e => e.to))
  return def.nodes.find(n => !hasIncoming.has(n.id)) ?? null
}

/** Resolve which edge(s) to follow after a node execution */
function resolveNextEdges(
  edges: WorkflowEdge[],
  nodeStatus: 'success' | 'failed',
  conditionMode: 'random' | 'always_true' | 'always_false'
): WorkflowEdge[] {
  // Group edges by condition category
  const conditionEdges = edges.filter(e =>
    e.condition === 'on_true' || e.condition === 'on_false'
  )
  const statusEdges = edges.filter(e =>
    e.condition === 'on_success' || e.condition === 'on_failure'
  )
  const alwaysEdges = edges.filter(e => !e.condition || e.condition === 'always')

  // Condition branch resolution
  if (conditionEdges.length > 0) {
    let takeTrueBranch: boolean
    switch (conditionMode) {
      case 'always_true':  takeTrueBranch = true; break
      case 'always_false': takeTrueBranch = false; break
      default:             takeTrueBranch = Math.random() >= 0.5; break
    }
    return conditionEdges.filter(e =>
      takeTrueBranch ? e.condition === 'on_true' : e.condition === 'on_false'
    )
  }

  // Success/failure routing
  if (statusEdges.length > 0) {
    const targetCondition: EdgeCondition = nodeStatus === 'success' ? 'on_success' : 'on_failure'
    return statusEdges.filter(e => e.condition === targetCondition)
  }

  // Always / parallel fan-out
  return alwaysEdges
}

/** Mock output for each node type */
function mockNodeOutput(node: WorkflowNode): string {
  switch (node.type) {
    case 'agent':
      return `Agent「${node.label}」执行完成，输出结果已写入上下文`
    case 'condition':
      return `条件「${node.label}」已评估`
    case 'parallel_fork':
      return `并行分叉「${node.label}」已触发所有子分支`
    case 'parallel_join':
      return `并行汇合「${node.label}」等待所有分支完成`
    case 'approval':
      return `审批节点「${node.label}」模拟自动通过`
    case 'timer':
      return `定时节点「${node.label}」模拟等待已跳过`
    case 'subworkflow':
      return `子工作流「${node.label}」模拟执行完成`
    case 'notification':
      return `通知「${node.label}」已模拟发送`
    case 'loop':
      return `循环「${node.label}」执行一次后退出`
    default:
      return `节点「${node.label}」执行完成`
  }
}

// ─── Core simulator ───────────────────────────────────────────────────────────

export async function runSimulation(
  definition: WorkflowDefinition,
  options: SimulationOptions = {}
): Promise<SimulationResult> {
  const {
    stepDelayMs = 600,
    conditionMode = 'random',
    failureProbability = 0,
    nodeExecTimeRange = [200, 800],
    onEvent,
    onStateUpdate,
    signal,
  } = options

  const startedAt = Date.now()
  const events: SimulationStepEvent[] = []
  const nodeStates: Record<string, WorkflowNodeRunState> = {}
  const visitedNodeIds: string[] = []
  const skippedNodeIds: string[] = []

  // Initialise all nodes as 'waiting'
  for (const node of definition.nodes) {
    nodeStates[node.id] = {
      nodeId: node.id,
      status: 'waiting',
    }
  }
  onStateUpdate?.({ ...nodeStates })

  const adjacency = buildAdjacency(definition.edges)
  const nodeMap = new Map(definition.nodes.map(n => [n.id, n]))

  function emit(event: SimulationStepEvent) {
    events.push(event)
    onEvent?.(event)
  }

  async function executeNode(node: WorkflowNode): Promise<'success' | 'failed'> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    visitedNodeIds.push(node.id)

    // Mark running
    nodeStates[node.id] = { nodeId: node.id, status: 'running', startedAt: Date.now() }
    onStateUpdate?.({ ...nodeStates })

    emit({
      type: 'node_start',
      nodeId: node.id,
      nodeLabel: node.label,
      message: `开始执行「${node.label}」（${node.type}）`,
      timestamp: Date.now(),
    })

    // Simulate execution time
    const execTime = randomBetween(nodeExecTimeRange[0], nodeExecTimeRange[1])
    await sleep(Math.min(execTime, stepDelayMs), signal)

    // Determine outcome
    const shouldFail = node.type !== 'approval' &&
                       node.type !== 'timer' &&
                       Math.random() < failureProbability

    const finishedAt = Date.now()
    if (shouldFail) {
      nodeStates[node.id] = {
        nodeId: node.id,
        status: 'failed',
        startedAt: nodeStates[node.id].startedAt,
        finishedAt,
        error: `模拟错误：节点「${node.label}」执行失败（概率注入）`,
      }
      onStateUpdate?.({ ...nodeStates })
      emit({
        type: 'node_error',
        nodeId: node.id,
        nodeLabel: node.label,
        message: `节点「${node.label}」执行失败`,
        timestamp: Date.now(),
      })
      return 'failed'
    }

    nodeStates[node.id] = {
      nodeId: node.id,
      status: 'success',
      startedAt: nodeStates[node.id].startedAt,
      finishedAt,
      output: mockNodeOutput(node),
    }
    onStateUpdate?.({ ...nodeStates })

    emit({
      type: 'node_success',
      nodeId: node.id,
      nodeLabel: node.label,
      message: `节点「${node.label}」执行成功`,
      timestamp: Date.now(),
    })

    return 'success'
  }

  async function traverseFrom(nodeId: string, depth = 0): Promise<void> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (depth > 50) return // safety cap against infinite loops

    const node = nodeMap.get(nodeId)
    if (!node) return
    if (nodeStates[nodeId]?.status === 'success' || nodeStates[nodeId]?.status === 'failed') return

    const status = await executeNode(node)
    await sleep(stepDelayMs, signal)

    const outEdges = adjacency.get(nodeId) ?? []
    const nextEdges = resolveNextEdges(outEdges, status, conditionMode)
    const nextIds = new Set(nextEdges.map(e => e.to))

    // Mark skipped edges
    for (const edge of outEdges) {
      if (!nextIds.has(edge.to)) {
        const targetNode = nodeMap.get(edge.to)
        if (targetNode && nodeStates[edge.to]?.status === 'waiting') {
          nodeStates[edge.to] = { nodeId: edge.to, status: 'skipped' }
          skippedNodeIds.push(edge.to)
          emit({
            type: 'node_skip',
            nodeId: edge.to,
            nodeLabel: targetNode.label,
            message: `节点「${targetNode.label}」被跳过（条件分支未命中）`,
            timestamp: Date.now(),
          })
          onStateUpdate?.({ ...nodeStates })
        }
      }
    }

    // Handle parallel_join: wait for all branches to complete before continuing
    if (node.type === 'parallel_join') {
      // Check all incoming edges to see if all source nodes are done
      const incomingEdges = definition.edges.filter(e => e.to === nodeId)
      const allPredecessorsDone = incomingEdges.every(e => {
        const s = nodeStates[e.from]?.status
        return s === 'success' || s === 'failed' || s === 'skipped'
      })
      if (!allPredecessorsDone) return
    }

    // Traverse next nodes (parallel if multiple)
    await Promise.all(nextEdges.map(edge => traverseFrom(edge.to, depth + 1)))
  }

  let finalStatus: WorkflowRunStatus = 'success'

  try {
    const startNode = findStartNode(definition)
    if (!startNode) {
      throw new Error('找不到起始节点（请确保工作流至少有一个节点，且有明确的 isStart 或无入边节点）')
    }

    await traverseFrom(startNode.id)

    // Check if any node failed
    const anyFailed = Object.values(nodeStates).some(s => s.status === 'failed')
    finalStatus = anyFailed ? 'failed' : 'success'

    emit({
      type: 'workflow_complete',
      message: anyFailed
        ? `工作流模拟完成（存在失败节点）`
        : `工作流模拟成功完成，共执行 ${visitedNodeIds.length} 个节点`,
      timestamp: Date.now(),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      finalStatus = 'cancelled'
      emit({
        type: 'workflow_error',
        message: '模拟已中止',
        timestamp: Date.now(),
      })
    } else {
      finalStatus = 'failed'
      emit({
        type: 'workflow_error',
        message: `模拟错误：${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      })
    }
  }

  return {
    status: finalStatus,
    nodeStates,
    events,
    durationMs: Date.now() - startedAt,
    visitedNodeIds,
    skippedNodeIds,
  }
}

// ─── Convenience: synchronous DAG validation ─────────────────────────────────
//
// Called before simulation to surface structural issues early.

export interface DAGValidationError {
  code: 'NO_NODES' | 'NO_START_NODE' | 'ORPHAN_NODE' | 'CYCLE_DETECTED' | 'MISSING_TARGET'
  message: string
  nodeId?: string
}

export function validateDAG(definition: WorkflowDefinition): DAGValidationError[] {
  const errors: DAGValidationError[] = []

  if (definition.nodes.length === 0) {
    errors.push({ code: 'NO_NODES', message: '工作流没有任何节点' })
    return errors
  }

  const nodeIds = new Set(definition.nodes.map(n => n.id))

  // Check edge targets exist
  for (const edge of definition.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push({ code: 'MISSING_TARGET', message: `边 ${edge.id} 的源节点 ${edge.from} 不存在`, nodeId: edge.from })
    }
    if (!nodeIds.has(edge.to)) {
      errors.push({ code: 'MISSING_TARGET', message: `边 ${edge.id} 的目标节点 ${edge.to} 不存在`, nodeId: edge.to })
    }
  }

  // Start node
  const startNode = findStartNode(definition)
  if (!startNode) {
    errors.push({ code: 'NO_START_NODE', message: '无法确定起始节点（请设置 isStart=true 或确保有无入边的节点）' })
  }

  // Cycle detection (DFS)
  const visited = new Set<string>()
  const inStack = new Set<string>()
  const adjacency = buildAdjacency(definition.edges)

  function dfsCycle(nodeId: string): boolean {
    visited.add(nodeId)
    inStack.add(nodeId)
    for (const edge of adjacency.get(nodeId) ?? []) {
      if (!visited.has(edge.to)) {
        if (dfsCycle(edge.to)) return true
      } else if (inStack.has(edge.to)) {
        return true
      }
    }
    inStack.delete(nodeId)
    return false
  }

  for (const node of definition.nodes) {
    if (!visited.has(node.id)) {
      if (dfsCycle(node.id)) {
        errors.push({ code: 'CYCLE_DETECTED', message: `检测到环路，包含节点 ${node.id}（${node.label}）`, nodeId: node.id })
        break
      }
    }
  }

  return errors
}
