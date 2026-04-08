/**
 * temporalClient tests
 *
 * Tests the Temporal client proxy layer.
 * All requests go through the /api/temporal proxy base path.
 * fetch is mocked via vi.stubGlobal.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import temporalClient, { TemporalClientError, type TemporalWorkflowInfo } from '@/lib/temporalClient'

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok:         status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json:       () => Promise.resolve(body),
    }),
  )
}

function mockFetchError(status: number, message: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok:         false,
      status,
      statusText: 'Error',
      json:       () => Promise.resolve({ error: message }),
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const sampleWorkflowInfo: TemporalWorkflowInfo = {
  workflow_id:        'wf-001',
  run_id:             'run-abc-123',
  workflow_type:      'ops-workflow',
  status:             'RUNNING',
  start_time:         '2026-04-08T10:00:00Z',
  close_time:         null,
  duration_ms:        null,
  memo:               {},
  search_attributes:  {},
  task_queue:         'opsagent-task-queue',
  pending_activities: [],
  received_signals:   [],
}

// ─── getWorkflow ──────────────────────────────────────────────────────────────

describe('temporalClient.getWorkflow', () => {
  it('fetches workflow by ID', async () => {
    mockFetch(sampleWorkflowInfo)
    const result = await temporalClient.getWorkflow('wf-001')
    expect(result.workflow_id).toBe('wf-001')
    expect(result.status).toBe('RUNNING')
  })

  it('includes runId in URL when provided', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(sampleWorkflowInfo),
    })
    vi.stubGlobal('fetch', fetchSpy)
    await temporalClient.getWorkflow('wf-001', 'run-abc-123')
    const [url] = fetchSpy.mock.calls[0] as [string]
    expect(url).toContain('wf-001')
    expect(url).toContain('run-abc-123')
  })

  it('throws TemporalClientError on 404', async () => {
    mockFetchError(404, 'Workflow not found')
    await expect(temporalClient.getWorkflow('missing')).rejects.toBeInstanceOf(TemporalClientError)
  })
})

// ─── listWorkflows ────────────────────────────────────────────────────────────

describe('temporalClient.listWorkflows', () => {
  it('returns workflow list', async () => {
    mockFetch({ executions: [sampleWorkflowInfo], next_page_token: null })
    const result = await temporalClient.listWorkflows()
    expect(result.executions).toHaveLength(1)
    expect(result.next_page_token).toBeNull()
  })

  it('appends namespace and query params', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ executions: [], next_page_token: null }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    await temporalClient.listWorkflows({
      namespace:  'my-ns',
      query:      "WorkflowType='ops-workflow'",
      page_size:  25,
    })
    const [url] = fetchSpy.mock.calls[0] as [string]
    expect(url).toContain('namespace=my-ns')
    expect(url).toContain('page_size=25')
  })
})

// ─── queryWorkflow ────────────────────────────────────────────────────────────

describe('temporalClient.queryWorkflow', () => {
  it('sends POST to query endpoint with type and args', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ result: { state: 'pending_approval' } }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    const result = await temporalClient.queryWorkflow('wf-001', 'get_state', [])
    expect(result.result).toEqual({ state: 'pending_approval' })
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/query')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body as string)
    expect(body.query_type).toBe('get_state')
  })
})

// ─── signalWorkflow ───────────────────────────────────────────────────────────

describe('temporalClient.signalWorkflow', () => {
  it('sends POST with signal name and payload', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    const result = await temporalClient.signalWorkflow('wf-001', 'approval_signal', { approved: true })
    expect(result.ok).toBe(true)
    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(body.signal_name).toBe('approval_signal')
    expect(body.payload.approved).toBe(true)
  })
})

// ─── sendApprovalSignal ───────────────────────────────────────────────────────

describe('temporalClient.sendApprovalSignal', () => {
  it('sends approval_signal with correct fields', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    await temporalClient.sendApprovalSignal('wf-001', true, 'alice@example.com', {
      comment:    'LGTM',
      approvalId: 'LARK-42',
      channel:    'lark',
    })
    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(body.signal_name).toBe('approval_signal')
    expect(body.payload.approved).toBe(true)
    expect(body.payload.approver).toBe('alice@example.com')
    expect(body.payload.comment).toBe('LGTM')
    expect(body.payload.approval_id).toBe('LARK-42')
    expect(body.payload.metadata.channel).toBe('lark')
  })

  it('sends rejection correctly', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    await temporalClient.sendApprovalSignal('wf-001', false, 'bob')
    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(body.payload.approved).toBe(false)
  })
})

// ─── sendManualCompleteSignal ─────────────────────────────────────────────────

describe('temporalClient.sendManualCompleteSignal', () => {
  it('sends manual_complete_signal with action and operator', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    await temporalClient.sendManualCompleteSignal('wf-001', 'cancel', 'admin', { reason: 'timed out' })
    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(body.signal_name).toBe('manual_complete_signal')
    expect(body.payload.action).toBe('cancel')
    expect(body.payload.operator).toBe('admin')
    expect(body.payload.reason).toBe('timed out')
  })
})

// ─── cancelWorkflow ───────────────────────────────────────────────────────────

describe('temporalClient.cancelWorkflow', () => {
  it('sends POST to cancel endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    const result = await temporalClient.cancelWorkflow('wf-001')
    expect(result.ok).toBe(true)
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/cancel')
    expect(opts.method).toBe('POST')
  })
})

// ─── terminateWorkflow ────────────────────────────────────────────────────────

describe('temporalClient.terminateWorkflow', () => {
  it('sends reason in body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    await temporalClient.terminateWorkflow('wf-001', 'Emergency stop')
    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(body.reason).toBe('Emergency stop')
  })
})

// ─── getWebUiUrl ──────────────────────────────────────────────────────────────

describe('temporalClient.getWebUiUrl', () => {
  it('generates URL with workflow ID', () => {
    const url = temporalClient.getWebUiUrl('wf-001')
    expect(url).toContain('wf-001')
    expect(url).toContain('namespaces')
  })

  it('appends run ID when provided', () => {
    const url = temporalClient.getWebUiUrl('wf-001', 'run-abc')
    expect(url).toContain('run-abc')
  })
})

// ─── TemporalClientError ──────────────────────────────────────────────────────

describe('TemporalClientError', () => {
  it('stores code and message', () => {
    const err = new TemporalClientError(503, 'Service unavailable')
    expect(err.code).toBe(503)
    expect(err.message).toContain('503')
    expect(err.name).toBe('TemporalClientError')
  })

  it('accepts network as code', () => {
    const err = new TemporalClientError('network', 'Connection refused')
    expect(err.code).toBe('network')
  })

  it('is instanceof Error', () => {
    expect(new TemporalClientError(500, 'err')).toBeInstanceOf(Error)
  })
})
