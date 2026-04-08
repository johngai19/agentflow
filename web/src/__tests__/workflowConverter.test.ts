/**
 * workflowConverter tests
 *
 * Tests the conversion from agentflow WorkflowDefinition to OpsAgent engine format.
 * Pure unit tests — no network calls, no DOM.
 */
import { describe, it, expect } from 'vitest'
import { convertWorkflowToOpsAgent } from '@/lib/workflowConverter'
import type { WorkflowDefinition } from '@/types/workflow'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const now = Date.now()

function makeWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id:             'wf-test-001',
    name:           'Test Workflow',
    description:    'A test workflow',
    icon:           '🔄',
    projectId:      'proj-a',
    nodes:          [],
    edges:          [],
    triggers:       [{ type: 'manual' }],
    enabled:        true,
    createdAt:      now,
    updatedAt:      now,
    currentVersion: 1,
    versions:       [],
    ...overrides,
  }
}

// ─── Basic conversion ─────────────────────────────────────────────────────────

describe('convertWorkflowToOpsAgent', () => {
  it('maps top-level fields correctly', () => {
    const wf = makeWorkflow()
    const result = convertWorkflowToOpsAgent(wf)
    expect(result.id).toBe('wf-test-001')
    expect(result.name).toBe('Test Workflow')
    expect(result.description).toBe('A test workflow')
    expect(result.version).toBe('1')
    expect(result.trigger).toBe('manual')
  })

  it('maps cron trigger correctly', () => {
    const wf = makeWorkflow({ triggers: [{ type: 'cron', schedule: '0 2 * * *' }] })
    expect(convertWorkflowToOpsAgent(wf).trigger).toBe('cron')
  })

  it('maps webhook trigger correctly', () => {
    const wf = makeWorkflow({ triggers: [{ type: 'webhook', webhookPath: '/hook' }] })
    expect(convertWorkflowToOpsAgent(wf).trigger).toBe('webhook')
  })

  it('uses first trigger type for mixed triggers', () => {
    const wf = makeWorkflow({ triggers: [{ type: 'manual' }, { type: 'cron', schedule: '0 2 * * *' }] })
    expect(convertWorkflowToOpsAgent(wf).trigger).toBe('manual')
  })

  // ── Entry step detection ───────────────────────────────────────────────────

  it('uses isStart node as entry step', () => {
    const wf = makeWorkflow({
      nodes: [
        { id: 'n1', type: 'agent', label: 'Agent 1', position: { x: 0, y: 0 }, config: { agentId: '', taskTemplate: '' } },
        { id: 'n2', type: 'agent', label: 'Agent 2', position: { x: 100, y: 0 }, config: { agentId: '', taskTemplate: '' }, isStart: true },
      ],
    })
    const result = convertWorkflowToOpsAgent(wf)
    expect(result.entry_step).toBe('n2')
  })

  it('falls back to node with no incoming edges', () => {
    const wf = makeWorkflow({
      nodes: [
        { id: 'n1', type: 'agent', label: 'First', position: { x: 0, y: 0 }, config: { agentId: '', taskTemplate: '' } },
        { id: 'n2', type: 'agent', label: 'Second', position: { x: 100, y: 0 }, config: { agentId: '', taskTemplate: '' } },
      ],
      edges: [{ id: 'e1', from: 'n1', to: 'n2' }],
    })
    expect(convertWorkflowToOpsAgent(wf).entry_step).toBe('n1')
  })

  // ── Context variables ──────────────────────────────────────────────────────

  it('maps context variables to workflow variables', () => {
    const wf = makeWorkflow({
      contextVariables: [
        { key: 'env',     defaultValue: 'production' },
        { key: 'timeout', defaultValue: '300' },
        { key: 'empty' },
      ],
    })
    const result = convertWorkflowToOpsAgent(wf)
    const variables = result.variables ?? {}
    expect(variables['env']).toBe('production')
    expect(variables['timeout']).toBe('300')
    expect(variables['empty']).toBe('')
  })

  // ── Node type mappings ─────────────────────────────────────────────────────

  describe('agent node', () => {
    it('maps to type agent with message_template', () => {
      const wf = makeWorkflow({
        nodes: [{
          id:    'n1',
          type:  'agent',
          label: 'Deploy Agent',
          position: { x: 0, y: 0 },
          config: {
            agentId:      'deploy-agent',
            taskTemplate: 'Deploy {{env}}',
            timeout:      60000,
            retry:        { maxAttempts: 3, backoffMs: 1000 },
          },
        }],
      })
      const step = convertWorkflowToOpsAgent(wf).steps[0]
      expect(step.type).toBe('agent')
      expect(step.agent_name).toBe('deploy-agent')
      expect(step.message_template).toBe('Deploy {{env}}')
      expect(step.timeout_seconds).toBe(60)
      expect(step.retry_count).toBe(3)
    })

    it('defaults timeout to 300s when not specified', () => {
      const wf = makeWorkflow({
        nodes: [{
          id: 'n1', type: 'agent', label: 'A', position: { x: 0, y: 0 },
          config: { agentId: 'x', taskTemplate: '' },
        }],
      })
      expect(convertWorkflowToOpsAgent(wf).steps[0].timeout_seconds).toBe(300)
    })
  })

  describe('approval node', () => {
    it('maps to type approval with approval_config', () => {
      const wf = makeWorkflow({
        nodes: [{
          id:    'n1',
          type:  'approval',
          label: 'Manager Approval',
          position: { x: 0, y: 0 },
          config: {
            prompt:        'Please approve this deployment',
            approvers:     ['alice', 'bob'],
            timeout:       3600000,
            defaultAction: 'approve' as const,
          },
        }],
      })
      const step = convertWorkflowToOpsAgent(wf).steps[0]
      expect(step.type).toBe('approval')
      expect(step.message_template).toBe('Please approve this deployment')
      expect((step.approval_config as { approvers: string[] }).approvers).toEqual(['alice', 'bob'])
      expect(step.timeout_seconds).toBe(3600)
    })
  })

  describe('condition node', () => {
    it('maps to type condition with condition_expr', () => {
      const wf = makeWorkflow({
        nodes: [{
          id: 'n1', type: 'condition', label: 'Check', position: { x: 0, y: 0 },
          config: { expression: 'output.exitCode == 0' },
        }],
      })
      const step = convertWorkflowToOpsAgent(wf).steps[0]
      expect(step.type).toBe('condition')
      expect(step.condition_expr).toBe('output.exitCode == 0')
    })
  })

  describe('notification node', () => {
    it('maps to type notification with channel metadata', () => {
      const wf = makeWorkflow({
        nodes: [{
          id: 'n1', type: 'notification', label: 'Notify', position: { x: 0, y: 0 },
          config: {
            channel:    'dingtalk' as const,
            template:   'Deployment complete',
            recipients: ['team-ops'],
          },
        }],
      })
      const step = convertWorkflowToOpsAgent(wf).steps[0]
      expect(step.type).toBe('notification')
      expect(step.message_template).toBe('Deployment complete')
      expect((step.metadata as Record<string, unknown>).channel).toBe('dingtalk')
    })
  })

  // ── Edge → transition mapping ──────────────────────────────────────────────

  describe('edge transitions', () => {
    it('maps always edge to transition with no condition', () => {
      const wf = makeWorkflow({
        nodes: [
          { id: 'n1', type: 'agent', label: 'A', position: { x: 0, y: 0 }, config: { agentId: '', taskTemplate: '' } },
          { id: 'n2', type: 'agent', label: 'B', position: { x: 100, y: 0 }, config: { agentId: '', taskTemplate: '' } },
        ],
        edges: [{ id: 'e1', from: 'n1', to: 'n2', condition: 'always' }],
      })
      const step1 = convertWorkflowToOpsAgent(wf).steps.find(s => s.id === 'n1')!
      expect(step1.transitions).toHaveLength(1)
      expect(step1.transitions[0].target).toBe('n2')
      expect(step1.transitions[0].condition).toBeUndefined()
    })

    it('maps on_success edge to condition expression', () => {
      const wf = makeWorkflow({
        nodes: [
          { id: 'n1', type: 'agent', label: 'A', position: { x: 0, y: 0 }, config: { agentId: '', taskTemplate: '' } },
          { id: 'n2', type: 'agent', label: 'B', position: { x: 100, y: 0 }, config: { agentId: '', taskTemplate: '' } },
        ],
        edges: [{ id: 'e1', from: 'n1', to: 'n2', condition: 'on_success' }],
      })
      const trans = convertWorkflowToOpsAgent(wf).steps.find(s => s.id === 'n1')!.transitions[0]
      expect(trans.condition).toContain("status == 'completed'")
    })

    it('maps on_failure edge correctly', () => {
      const wf = makeWorkflow({
        nodes: [
          { id: 'n1', type: 'agent', label: 'A', position: { x: 0, y: 0 }, config: { agentId: '', taskTemplate: '' } },
          { id: 'n2', type: 'agent', label: 'B', position: { x: 100, y: 0 }, config: { agentId: '', taskTemplate: '' } },
        ],
        edges: [{ id: 'e1', from: 'n1', to: 'n2', condition: 'on_failure' }],
      })
      const trans = convertWorkflowToOpsAgent(wf).steps.find(s => s.id === 'n1')!.transitions[0]
      expect(trans.condition).toContain("status == 'failed'")
    })

    it('maps on_true and on_false branch conditions', () => {
      const wf = makeWorkflow({
        nodes: [
          { id: 'cond', type: 'condition', label: 'Branch', position: { x: 0, y: 0 }, config: { expression: 'x > 0' } },
          { id: 'yes',  type: 'agent',     label: 'Yes path', position: { x: 100, y: -50 }, config: { agentId: '', taskTemplate: '' } },
          { id: 'no',   type: 'agent',     label: 'No path',  position: { x: 100, y: 50 },  config: { agentId: '', taskTemplate: '' } },
        ],
        edges: [
          { id: 'e1', from: 'cond', to: 'yes', condition: 'on_true' },
          { id: 'e2', from: 'cond', to: 'no',  condition: 'on_false' },
        ],
      })
      const condStep = convertWorkflowToOpsAgent(wf).steps.find(s => s.id === 'cond')!
      const trueEdge  = condStep.transitions.find(t => t.target === 'yes')!
      const falseEdge = condStep.transitions.find(t => t.target === 'no')!
      expect(trueEdge.condition).toContain('result == true')
      expect(falseEdge.condition).toContain('result == false')
    })

    it('a node with no outgoing edges has empty transitions', () => {
      const wf = makeWorkflow({
        nodes: [{ id: 'n1', type: 'agent', label: 'End', position: { x: 0, y: 0 }, config: { agentId: '', taskTemplate: '' } }],
      })
      expect(convertWorkflowToOpsAgent(wf).steps[0].transitions).toEqual([])
    })
  })

  // ── Metadata passthrough ───────────────────────────────────────────────────

  it('stores agentflow metadata in opsagent metadata', () => {
    const wf = makeWorkflow({ icon: '⚙️', projectId: 'proj-x' })
    const result = convertWorkflowToOpsAgent(wf)
    expect((result.metadata as Record<string, unknown>).agentflow_icon).toBe('⚙️')
    expect((result.metadata as Record<string, unknown>).agentflow_project_id).toBe('proj-x')
  })
})
