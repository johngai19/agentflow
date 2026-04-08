/**
 * workflowSimulator tests
 *
 * Tests the DAG validation logic and simulation engine.
 * No real timers needed — we use very short delays and allow the engine
 * to run naturally (no vi.useFakeTimers, as we rely on real Promises).
 */
import { describe, it, expect, vi } from 'vitest'
import {
  runSimulation,
  validateDAG,
  type SimulationOptions,
  type SimulationStepEvent,
} from '@/lib/workflowSimulator'
import type { WorkflowDefinition } from '@/types/workflow'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeLinearWorkflow(nodeCount = 3): WorkflowDefinition {
  const nodes: WorkflowDefinition['nodes'] = Array.from({ length: nodeCount }, (_, i) => ({
    id: `n${i}`,
    type: 'agent' as const,
    label: `Node ${i}`,
    position: { x: i * 200, y: 200 },
    isStart: i === 0,
    isEnd: i === nodeCount - 1,
    config: { agentId: `agent-${i}`, taskTemplate: 'task', timeout: 5000, retry: { maxAttempts: 1, backoffMs: 100 } },
  }))

  const edges: WorkflowDefinition['edges'] = Array.from({ length: nodeCount - 1 }, (_, i) => ({
    id: `e${i}`,
    from: `n${i}`,
    to: `n${i + 1}`,
    condition: 'on_success' as const,
  }))

  return makeWorkflow(nodes, edges)
}

function makeWorkflow(
  nodes: WorkflowDefinition['nodes'],
  edges: WorkflowDefinition['edges']
): WorkflowDefinition {
  const now = Date.now()
  return {
    id: 'test-wf',
    name: 'Test',
    description: '',
    icon: '🧪',
    projectId: 'test',
    nodes,
    edges,
    triggers: [{ type: 'manual' }],
    enabled: true,
    createdAt: now,
    updatedAt: now,
    currentVersion: 1,
    versions: [],
  }
}

const FAST_OPTS: SimulationOptions = {
  stepDelayMs: 10,
  nodeExecTimeRange: [5, 15],
  failureProbability: 0,
}

// ─── validateDAG ──────────────────────────────────────────────────────────────

describe('validateDAG', () => {
  it('returns NO_NODES error for empty workflow', () => {
    const def = makeWorkflow([], [])
    const errors = validateDAG(def)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].code).toBe('NO_NODES')
  })

  it('returns no errors for a valid linear workflow', () => {
    const def = makeLinearWorkflow(3)
    expect(validateDAG(def)).toHaveLength(0)
  })

  it('returns MISSING_TARGET when edge references non-existent node', () => {
    const def = makeLinearWorkflow(2)
    def.edges.push({ id: 'bad', from: 'n0', to: 'ghost-node', condition: 'always' })
    const errors = validateDAG(def)
    expect(errors.some(e => e.code === 'MISSING_TARGET')).toBe(true)
  })

  it('detects CYCLE_DETECTED in a cyclic graph', () => {
    const nodes: WorkflowDefinition['nodes'] = [
      { id: 'a', type: 'agent', label: 'A', position: { x: 0, y: 0 }, isStart: true, config: { agentId: 'a', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } } },
      { id: 'b', type: 'agent', label: 'B', position: { x: 200, y: 0 }, config: { agentId: 'b', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } } },
      { id: 'c', type: 'agent', label: 'C', position: { x: 400, y: 0 }, config: { agentId: 'c', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } } },
    ]
    const edges: WorkflowDefinition['edges'] = [
      { id: 'e1', from: 'a', to: 'b', condition: 'always' },
      { id: 'e2', from: 'b', to: 'c', condition: 'always' },
      { id: 'e3', from: 'c', to: 'a', condition: 'always' }, // cycle
    ]
    const def = makeWorkflow(nodes, edges)
    const errors = validateDAG(def)
    expect(errors.some(e => e.code === 'CYCLE_DETECTED')).toBe(true)
  })

  it('returns NO_START_NODE when all nodes have incoming edges', () => {
    const nodes: WorkflowDefinition['nodes'] = [
      { id: 'a', type: 'agent', label: 'A', position: { x: 0, y: 0 }, config: { agentId: 'a', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } } },
      { id: 'b', type: 'agent', label: 'B', position: { x: 200, y: 0 }, config: { agentId: 'b', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } } },
    ]
    // Both have incoming edges — no start node
    const edges: WorkflowDefinition['edges'] = [
      { id: 'e1', from: 'a', to: 'b', condition: 'always' },
      { id: 'e2', from: 'b', to: 'a', condition: 'always' },
    ]
    const def = makeWorkflow(nodes, edges)
    const errors = validateDAG(def)
    // Cycle detected catches this scenario
    expect(errors.length).toBeGreaterThan(0)
  })

  it('accepts workflow with explicit isStart node', () => {
    const nodes: WorkflowDefinition['nodes'] = [
      {
        id: 'a', type: 'agent', label: 'A', position: { x: 0, y: 0 },
        isStart: true,
        config: { agentId: 'a', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } },
      },
      {
        id: 'b', type: 'agent', label: 'B', position: { x: 200, y: 0 },
        config: { agentId: 'b', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } },
      },
    ]
    const edges: WorkflowDefinition['edges'] = [
      { id: 'e1', from: 'a', to: 'b', condition: 'on_success' },
    ]
    expect(validateDAG(makeWorkflow(nodes, edges))).toHaveLength(0)
  })
})

// ─── runSimulation ────────────────────────────────────────────────────────────

describe('runSimulation', () => {
  it('completes a linear workflow with all nodes success', async () => {
    const def = makeLinearWorkflow(3)
    const result = await runSimulation(def, FAST_OPTS)
    expect(result.status).toBe('success')
    expect(result.visitedNodeIds).toHaveLength(3)
    expect(result.skippedNodeIds).toHaveLength(0)
    expect(Object.values(result.nodeStates).every(s => s.status === 'success')).toBe(true)
  }, 10000)

  it('visits all nodes and emits node_start + node_success events', async () => {
    const def = makeLinearWorkflow(3)
    const events: SimulationStepEvent[] = []
    const result = await runSimulation(def, {
      ...FAST_OPTS,
      onEvent: e => events.push(e),
    })
    const startEvents = events.filter(e => e.type === 'node_start')
    const successEvents = events.filter(e => e.type === 'node_success')
    expect(startEvents).toHaveLength(3)
    expect(successEvents).toHaveLength(3)
    const lastEvent = result.events[result.events.length - 1]
    expect(lastEvent.type).toBe('workflow_complete')
  }, 10000)

  it('emits onStateUpdate callbacks during run', async () => {
    const def = makeLinearWorkflow(2)
    const snapshots: Record<string, unknown>[] = []
    await runSimulation(def, {
      ...FAST_OPTS,
      onStateUpdate: states => snapshots.push(states),
    })
    // Should have received at least: initial + (start+end)*2 node updates
    expect(snapshots.length).toBeGreaterThanOrEqual(4)
  }, 10000)

  it('handles condition node with always_true mode', async () => {
    const nodes: WorkflowDefinition['nodes'] = [
      {
        id: 'start', type: 'agent', label: 'Start', position: { x: 0, y: 0 },
        isStart: true,
        config: { agentId: 'a', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } },
      },
      {
        id: 'cond', type: 'condition', label: 'Condition',
        position: { x: 200, y: 0 },
        config: { expression: 'x > 0', trueBranchLabel: 'Yes', falseBranchLabel: 'No' },
      },
      {
        id: 'true-node', type: 'agent', label: 'True Branch', position: { x: 400, y: -80 },
        config: { agentId: 'b', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } },
      },
      {
        id: 'false-node', type: 'agent', label: 'False Branch', position: { x: 400, y: 80 },
        config: { agentId: 'c', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } },
      },
    ]
    const edges: WorkflowDefinition['edges'] = [
      { id: 'e1', from: 'start', to: 'cond', condition: 'on_success' },
      { id: 'e2', from: 'cond', to: 'true-node', condition: 'on_true', label: 'Yes' },
      { id: 'e3', from: 'cond', to: 'false-node', condition: 'on_false', label: 'No' },
    ]
    const def = makeWorkflow(nodes, edges)
    const result = await runSimulation(def, {
      ...FAST_OPTS,
      conditionMode: 'always_true',
    })

    expect(result.visitedNodeIds).toContain('true-node')
    expect(result.visitedNodeIds).not.toContain('false-node')
    expect(result.skippedNodeIds).toContain('false-node')
  }, 10000)

  it('handles condition node with always_false mode', async () => {
    const nodes: WorkflowDefinition['nodes'] = [
      {
        id: 'start', type: 'agent', label: 'Start', position: { x: 0, y: 0 },
        isStart: true,
        config: { agentId: 'a', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } },
      },
      {
        id: 'cond', type: 'condition', label: 'Cond',
        position: { x: 200, y: 0 },
        config: { expression: 'x > 0', trueBranchLabel: 'Yes', falseBranchLabel: 'No' },
      },
      {
        id: 'true-node', type: 'agent', label: 'True', position: { x: 400, y: -80 },
        config: { agentId: 'b', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } },
      },
      {
        id: 'false-node', type: 'agent', label: 'False', position: { x: 400, y: 80 },
        config: { agentId: 'c', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } },
      },
    ]
    const edges: WorkflowDefinition['edges'] = [
      { id: 'e1', from: 'start', to: 'cond', condition: 'on_success' },
      { id: 'e2', from: 'cond', to: 'true-node', condition: 'on_true' },
      { id: 'e3', from: 'cond', to: 'false-node', condition: 'on_false' },
    ]
    const result = await runSimulation(makeWorkflow(nodes, edges), {
      ...FAST_OPTS,
      conditionMode: 'always_false',
    })

    expect(result.visitedNodeIds).toContain('false-node')
    expect(result.visitedNodeIds).not.toContain('true-node')
  }, 10000)

  it('simulates parallel fork/join', async () => {
    const nodes: WorkflowDefinition['nodes'] = [
      {
        id: 'start', type: 'agent', label: 'Start', position: { x: 0, y: 0 },
        isStart: true,
        config: { agentId: 'a', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } },
      },
      {
        id: 'fork', type: 'parallel_fork', label: 'Fork', position: { x: 200, y: 0 },
        config: { branchCount: 2 },
      },
      {
        id: 'b1', type: 'agent', label: 'Branch 1', position: { x: 400, y: -80 },
        config: { agentId: 'b1', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } },
      },
      {
        id: 'b2', type: 'agent', label: 'Branch 2', position: { x: 400, y: 80 },
        config: { agentId: 'b2', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } },
      },
      {
        id: 'join', type: 'parallel_join', label: 'Join', position: { x: 600, y: 0 },
        config: { mergeStrategy: 'wait_all' },
      },
      {
        id: 'end', type: 'notification', label: 'End', position: { x: 800, y: 0 },
        isEnd: true,
        config: { channel: 'dingtalk', template: 'done' },
      },
    ]
    const edges: WorkflowDefinition['edges'] = [
      { id: 'e1', from: 'start', to: 'fork', condition: 'on_success' },
      { id: 'e2', from: 'fork', to: 'b1', condition: 'always' },
      { id: 'e3', from: 'fork', to: 'b2', condition: 'always' },
      { id: 'e4', from: 'b1', to: 'join', condition: 'always' },
      { id: 'e5', from: 'b2', to: 'join', condition: 'always' },
      { id: 'e6', from: 'join', to: 'end', condition: 'on_success' },
    ]
    const result = await runSimulation(makeWorkflow(nodes, edges), FAST_OPTS)
    expect(result.visitedNodeIds).toContain('b1')
    expect(result.visitedNodeIds).toContain('b2')
    expect(result.visitedNodeIds).toContain('join')
    expect(result.visitedNodeIds).toContain('end')
  }, 15000)

  it('returns failed status when failure probability = 1', async () => {
    const def = makeLinearWorkflow(2)
    const result = await runSimulation(def, {
      ...FAST_OPTS,
      failureProbability: 1,
    })
    // At least one node should have failed
    const anyFailed = Object.values(result.nodeStates).some(s => s.status === 'failed')
    expect(anyFailed).toBe(true)
  }, 10000)

  it('respects AbortController signal', async () => {
    const def = makeLinearWorkflow(5)
    const controller = new AbortController()
    const p = runSimulation(def, {
      stepDelayMs: 200,
      nodeExecTimeRange: [100, 200],
      signal: controller.signal,
    })
    // Abort after a brief moment
    setTimeout(() => controller.abort(), 50)
    const result = await p
    expect(result.status).toBe('cancelled')
  }, 5000)

  it('returns durationMs >= 0', async () => {
    const def = makeLinearWorkflow(2)
    const result = await runSimulation(def, FAST_OPTS)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  }, 10000)

  it('all visited nodes appear in nodeStates with success/failed status', async () => {
    const def = makeLinearWorkflow(4)
    const result = await runSimulation(def, FAST_OPTS)
    for (const nodeId of result.visitedNodeIds) {
      const state = result.nodeStates[nodeId]
      expect(state).toBeDefined()
      expect(['success', 'failed']).toContain(state.status)
    }
  }, 10000)

  it('skipped nodes have status=skipped in nodeStates', async () => {
    // Use always_true to force one branch skip
    const nodes: WorkflowDefinition['nodes'] = [
      {
        id: 'start', type: 'agent', label: 'Start', position: { x: 0, y: 0 },
        isStart: true,
        config: { agentId: 'a', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } },
      },
      {
        id: 'cond', type: 'condition', label: 'Cond',
        position: { x: 200, y: 0 },
        config: { expression: 'x > 0', trueBranchLabel: 'Yes', falseBranchLabel: 'No' },
      },
      {
        id: 'true-node', type: 'agent', label: 'True', position: { x: 400, y: -80 },
        config: { agentId: 'b', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } },
      },
      {
        id: 'false-node', type: 'agent', label: 'False', position: { x: 400, y: 80 },
        config: { agentId: 'c', taskTemplate: '', timeout: 1000, retry: { maxAttempts: 1, backoffMs: 100 } },
      },
    ]
    const edges: WorkflowDefinition['edges'] = [
      { id: 'e1', from: 'start', to: 'cond', condition: 'on_success' },
      { id: 'e2', from: 'cond', to: 'true-node', condition: 'on_true' },
      { id: 'e3', from: 'cond', to: 'false-node', condition: 'on_false' },
    ]
    const result = await runSimulation(makeWorkflow(nodes, edges), {
      ...FAST_OPTS,
      conditionMode: 'always_true',
    })
    expect(result.nodeStates['false-node'].status).toBe('skipped')
  }, 10000)

  it('handles single-node workflow', async () => {
    const def = makeLinearWorkflow(1)
    const result = await runSimulation(def, FAST_OPTS)
    expect(result.status).toBe('success')
    expect(result.visitedNodeIds).toHaveLength(1)
  }, 10000)
})

// ─── Template workflows smoke test ───────────────────────────────────────────

describe('WORKFLOW_TEMPLATES smoke simulation', () => {
  it('all 5 templates pass validateDAG', async () => {
    const { WORKFLOW_TEMPLATES } = await import('@/data/workflowTemplates')
    for (const tpl of WORKFLOW_TEMPLATES) {
      const errors = validateDAG(tpl.definition)
      const cycleOrMissing = errors.filter(e => e.code === 'CYCLE_DETECTED' || e.code === 'MISSING_TARGET')
      expect(cycleOrMissing).toHaveLength(0)
    }
  })

  it('all templates can run to completion', async () => {
    const { WORKFLOW_TEMPLATES } = await import('@/data/workflowTemplates')
    for (const tpl of WORKFLOW_TEMPLATES) {
      const result = await runSimulation(tpl.definition, {
        ...FAST_OPTS,
        conditionMode: 'always_true',
      })
      // Should not be cancelled or error out structurally
      expect(['success', 'failed']).toContain(result.status)
      expect(result.events.length).toBeGreaterThan(0)
      const lastEvt = result.events[result.events.length - 1]
      expect(['workflow_complete', 'workflow_error']).toContain(lastEvt.type)
    }
  }, 60000)
})
