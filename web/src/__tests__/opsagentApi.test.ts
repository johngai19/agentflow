/**
 * opsagentApi integration tests
 *
 * Uses Vitest with a mocked global fetch. Tests cover:
 *   - agentRegistryApi: list, get, register, unregister, healthCheckAll
 *   - workflowEngineApi: list, register, start, getExecution, cancel
 *   - approvalApi: submitDecision, createLarkApproval
 *   - auditApi: queryExecutions
 *   - OpsAgentApiError: thrown on non-2xx
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  agentRegistryApi,
  workflowEngineApi,
  approvalApi,
  auditApi,
  OpsAgentApiError,
  type AgentInfo,
  type OpsWorkflowDefinition,
  type WorkflowExecutionDetail,
} from '@/lib/opsagentApi'

// ─── Mock fetch setup ─────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok:     status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json:   () => Promise.resolve(body),
    }),
  )
}

function mockFetchError(status: number, detail: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok:         false,
      status,
      statusText: 'Error',
      json:       () => Promise.resolve({ detail }),
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── Sample fixtures ──────────────────────────────────────────────────────────

const sampleAgent: AgentInfo = {
  agent_id:         'test-agent-1',
  name:             'Test Agent',
  description:      'A test agent',
  base_url:         'http://test-agent:8000',
  a2a_endpoint:     'http://test-agent:8000/a2a',
  health_check_url: 'http://test-agent:8000/health',
  capabilities:     [{ name: 'ticket_creation', description: 'Create tickets', intents: ['ticket'], input_schema: {}, output_schema: {} }],
  tags:             ['infra', 'test'],
  metadata:         {},
  is_healthy:       true,
  last_seen:        '2026-04-08T10:00:00Z',
  registered_at:    '2026-04-01T00:00:00Z',
}

const sampleWorkflowDef: OpsWorkflowDefinition = {
  id:          'wf-001',
  name:        'Test Workflow',
  description: 'Integration test workflow',
  version:     '1',
  trigger:     'manual',
  steps:       [
    {
      id:         'step-1',
      name:       'Step One',
      type:       'agent',
      agent_name: 'test-agent-1',
      agent_url:  '',
      transitions: [],
      metadata:   {},
    },
  ],
  entry_step:  'step-1',
  variables:   {},
  metadata:    {},
}

const sampleExecution: WorkflowExecutionDetail = {
  id:            'exec-001',
  workflow_id:   'wf-001',
  status:        'running',
  started_at:    '2026-04-08T10:00:00Z',
  completed_at:  null,
  trigger_event: { source: 'agentflow-ui' },
  variables:     {},
  steps:         {},
  current_step:  'step-1',
  error:         null,
}

// ═══════════════════════════════════════════════════════════════════════════════
// Agent Registry API
// ═══════════════════════════════════════════════════════════════════════════════

describe('agentRegistryApi', () => {
  describe('listAgents', () => {
    it('returns agent list on 200', async () => {
      mockFetch({ agents: [sampleAgent] })
      const result = await agentRegistryApi.listAgents()
      expect(result.agents).toHaveLength(1)
      expect(result.agents[0].agent_id).toBe('test-agent-1')
    })

    it('calls the correct endpoint', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true, status: 200, json: () => Promise.resolve({ agents: [] }),
      })
      vi.stubGlobal('fetch', fetchSpy)
      await agentRegistryApi.listAgents()
      const url = fetchSpy.mock.calls[0][0] as string
      expect(url).toContain('/agents')
    })

    it('throws OpsAgentApiError on 503', async () => {
      mockFetchError(503, 'Service unavailable')
      await expect(agentRegistryApi.listAgents()).rejects.toBeInstanceOf(OpsAgentApiError)
    })
  })

  describe('getAgent', () => {
    it('returns single agent', async () => {
      mockFetch(sampleAgent)
      const agent = await agentRegistryApi.getAgent('test-agent-1')
      expect(agent.name).toBe('Test Agent')
      expect(agent.is_healthy).toBe(true)
    })

    it('throws OpsAgentApiError on 404', async () => {
      mockFetchError(404, 'Agent not found')
      const err = await agentRegistryApi.getAgent('nonexistent').catch(e => e)
      expect(err).toBeInstanceOf(OpsAgentApiError)
      expect((err as OpsAgentApiError).status).toBe(404)
    })
  })

  describe('registerAgent', () => {
    it('sends POST with agent data', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true, status: 200, json: () => Promise.resolve(sampleAgent),
      })
      vi.stubGlobal('fetch', fetchSpy)
      const { registered_at: _r, last_seen: _l, is_healthy: _h, ...agentPayload } = sampleAgent
      await agentRegistryApi.registerAgent(agentPayload)
      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(options.method).toBe('POST')
      const body = JSON.parse(options.body as string)
      expect(body.agent_id).toBe('test-agent-1')
    })
  })

  describe('unregisterAgent', () => {
    it('sends DELETE request', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true, status: 200, json: () => Promise.resolve({ deleted: true }),
      })
      vi.stubGlobal('fetch', fetchSpy)
      const result = await agentRegistryApi.unregisterAgent('test-agent-1')
      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(options.method).toBe('DELETE')
      expect(result.deleted).toBe(true)
    })
  })

  describe('healthCheckAll', () => {
    it('returns health check results', async () => {
      mockFetch({ results: { 'test-agent-1': true, 'test-agent-2': false } })
      const result = await agentRegistryApi.healthCheckAll()
      expect(result.results['test-agent-1']).toBe(true)
      expect(result.results['test-agent-2']).toBe(false)
    })

    it('sends POST to health-check endpoint', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true, status: 200, json: () => Promise.resolve({ results: {} }),
      })
      vi.stubGlobal('fetch', fetchSpy)
      await agentRegistryApi.healthCheckAll()
      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('health-check')
      expect(options.method).toBe('POST')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Workflow Engine API
// ═══════════════════════════════════════════════════════════════════════════════

describe('workflowEngineApi', () => {
  describe('listWorkflows', () => {
    it('returns workflow summaries', async () => {
      mockFetch({ workflows: [{ id: 'wf-001', name: 'Test Workflow', description: '', version: '1' }] })
      const result = await workflowEngineApi.listWorkflows()
      expect(result.workflows).toHaveLength(1)
      expect(result.workflows[0].id).toBe('wf-001')
    })
  })

  describe('registerWorkflow', () => {
    it('posts definition and returns registered status', async () => {
      mockFetch({ id: 'wf-001', name: 'Test Workflow', status: 'registered' })
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 'wf-001', name: 'Test Workflow', status: 'registered' }),
      })
      vi.stubGlobal('fetch', fetchSpy)
      const result = await workflowEngineApi.registerWorkflow(sampleWorkflowDef)
      expect(result.status).toBe('registered')
      expect(result.id).toBe('wf-001')
      const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body as string)
      expect(body.definition.id).toBe('wf-001')
    })
  })

  describe('startWorkflow', () => {
    it('returns execution id and status', async () => {
      mockFetch({ execution_id: 'exec-001', workflow_id: 'wf-001', status: 'running' })
      const result = await workflowEngineApi.startWorkflow({
        workflow_id: 'wf-001',
        trigger_event: { source: 'agentflow-ui' },
      })
      expect(result.execution_id).toBe('exec-001')
      expect(result.status).toBe('running')
    })

    it('throws OpsAgentApiError on 404 (workflow not registered)', async () => {
      mockFetchError(404, '工作流 wf-999 未找到')
      await expect(
        workflowEngineApi.startWorkflow({ workflow_id: 'wf-999' }),
      ).rejects.toBeInstanceOf(OpsAgentApiError)
    })
  })

  describe('getExecution', () => {
    it('returns full execution detail', async () => {
      mockFetch(sampleExecution)
      const result = await workflowEngineApi.getExecution('exec-001')
      expect(result.id).toBe('exec-001')
      expect(result.workflow_id).toBe('wf-001')
      expect(result.status).toBe('running')
      expect(result.current_step).toBe('step-1')
    })
  })

  describe('cancelExecution', () => {
    it('returns cancelled status', async () => {
      mockFetch({ status: 'cancelled' })
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true, status: 200, json: () => Promise.resolve({ status: 'cancelled' }),
      })
      vi.stubGlobal('fetch', fetchSpy)
      const result = await workflowEngineApi.cancelExecution('exec-001')
      expect(result.status).toBe('cancelled')
      const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(opts.method).toBe('POST')
    })

    it('throws OpsAgentApiError on 400 if execution already finished', async () => {
      mockFetchError(400, '无法取消执行')
      await expect(workflowEngineApi.cancelExecution('exec-done')).rejects.toBeInstanceOf(OpsAgentApiError)
    })
  })

  describe('health', () => {
    it('returns service health', async () => {
      mockFetch({ status: 'ok', service: 'workflow-engine' })
      const result = await workflowEngineApi.health()
      expect(result.status).toBe('ok')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Approval API
// ═══════════════════════════════════════════════════════════════════════════════

describe('approvalApi', () => {
  describe('submitDecision', () => {
    it('sends approval decision and returns approved status', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true, status: 200, json: () => Promise.resolve({ status: 'approved' }),
      })
      vi.stubGlobal('fetch', fetchSpy)
      const result = await approvalApi.submitDecision('exec-001', 'step-approval', {
        approved: true,
        approver: 'alice',
      })
      expect(result.status).toBe('approved')
      const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('/executions/exec-001/steps/step-approval/approve')
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body as string)
      expect(body.approved).toBe(true)
      expect(body.approver).toBe('alice')
    })

    it('sends rejection and returns rejected status', async () => {
      mockFetch({ status: 'rejected' })
      const result = await approvalApi.submitDecision('exec-001', 'step-approval', {
        approved: false,
        approver: 'bob',
      })
      expect(result.status).toBe('rejected')
    })

    it('throws OpsAgentApiError on 400 if step is not in approval state', async () => {
      mockFetchError(400, '步骤不在审批等待状态')
      await expect(
        approvalApi.submitDecision('exec-001', 'step-1', { approved: true, approver: 'alice' }),
      ).rejects.toBeInstanceOf(OpsAgentApiError)
    })
  })

  describe('createLarkApproval', () => {
    it('posts to lark approval bridge', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: () => Promise.resolve({ instance_code: 'LARK-001', status: 'pending' }),
      })
      vi.stubGlobal('fetch', fetchSpy)
      const result = await approvalApi.createLarkApproval({
        execution_id: 'exec-001',
        step_id:      'step-approval',
        step_name:    'Code Review Approval',
        description:  'Please review and approve',
        approver_ids: ['alice@company.com'],
        initiator_id: 'system',
      })
      expect(result.instance_code).toBe('LARK-001')
      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('/approvals/create')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Audit API
// ═══════════════════════════════════════════════════════════════════════════════

describe('auditApi', () => {
  describe('queryExecutions', () => {
    it('fetches executions without params', async () => {
      mockFetch({ executions: [sampleExecution], total: 1 })
      const result = await auditApi.queryExecutions()
      expect(result.executions).toHaveLength(1)
    })

    it('appends query params correctly', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: () => Promise.resolve({ executions: [], total: 0 }),
      })
      vi.stubGlobal('fetch', fetchSpy)
      await auditApi.queryExecutions({
        workflow_id: 'wf-001',
        status:      'running',
        limit:       10,
        offset:      20,
      })
      const [url] = fetchSpy.mock.calls[0] as [string]
      expect(url).toContain('workflow_id=wf-001')
      expect(url).toContain('status=running')
      expect(url).toContain('limit=10')
      expect(url).toContain('offset=20')
    })
  })

  describe('getExecution', () => {
    it('delegates to workflowEngineApi.getExecution', async () => {
      mockFetch(sampleExecution)
      const result = await auditApi.getExecution('exec-001')
      expect(result.id).toBe('exec-001')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// OpsAgentApiError
// ═══════════════════════════════════════════════════════════════════════════════

describe('OpsAgentApiError', () => {
  it('captures status and endpoint', () => {
    const err = new OpsAgentApiError(503, '/workflows', 'Service unavailable')
    expect(err.status).toBe(503)
    expect(err.endpoint).toBe('/workflows')
    expect(err.message).toContain('503')
    expect(err.name).toBe('OpsAgentApiError')
  })

  it('is instanceof Error', () => {
    const err = new OpsAgentApiError(404, '/agents/x', 'Not found')
    expect(err).toBeInstanceOf(Error)
  })
})
