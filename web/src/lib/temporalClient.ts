/**
 * temporalClient.ts — Temporal workflow query client for agentflow.
 *
 * Provides a browser-safe abstraction over Temporal workflow state.
 * Because Temporal's gRPC SDK runs only in Node.js, browser-side access
 * goes through the Temporal Web UI HTTP API (v2 REST) and/or a thin
 * Next.js API route that proxies gRPC queries server-side.
 *
 * Architecture:
 *   Browser → Next.js API route (/api/temporal/*)
 *                ↓  (server-side only)
 *           Temporal gRPC server (localhost:7233 or remote)
 *
 * All exported functions are safe to call from React components.
 * They hit the internal Next.js proxy by default, with optional
 * direct Temporal Web UI URL override for read-only status queries.
 */

// ─── Config ───────────────────────────────────────────────────────────────────

/** Temporal Web UI base URL — used to construct deep links in the UI. */
const TEMPORAL_UI_URL =
  process.env.NEXT_PUBLIC_TEMPORAL_UI_URL ?? 'http://localhost:8080'

/** Default Temporal namespace used by opsagent. */
const TEMPORAL_NAMESPACE =
  process.env.TEMPORAL_NAMESPACE ?? 'opsagent'

/**
 * Internal Next.js API proxy base path.
 * The actual proxy route (pages/api or app/api) must be implemented
 * separately — see src/app/api/temporal/route.ts (scaffold below).
 */
const TEMPORAL_PROXY_BASE = '/api/temporal'

// ─── Error type ───────────────────────────────────────────────────────────────

export class TemporalClientError extends Error {
  constructor(
    public readonly code: number | 'network',
    message: string,
  ) {
    super(`TemporalClient error [${code}]: ${message}`)
    this.name = 'TemporalClientError'
  }
}

// ─── Shared fetch helper ─────────────────────────────────────────────────────

async function temporalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${TEMPORAL_PROXY_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (!res.ok) {
    let msg = res.statusText
    try {
      const body = await res.json()
      msg = body.error ?? body.message ?? msg
    } catch { /* ignore */ }
    throw new TemporalClientError(res.status, msg)
  }

  if (res.status === 204) return {} as T
  return res.json() as Promise<T>
}

// ─── Temporal workflow status types ──────────────────────────────────────────

/** Maps to Temporal's WorkflowExecutionStatus enum (subset we care about). */
export type TemporalWorkflowStatus =
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TERMINATED'
  | 'CONTINUED_AS_NEW'
  | 'TIMED_OUT'
  | 'UNKNOWN'

export interface TemporalWorkflowInfo {
  /** Temporal workflow ID (maps to workflowDefinitionId + runId) */
  workflow_id: string
  /** Temporal run ID */
  run_id: string
  /** Workflow type name (maps to our workflow definition name) */
  workflow_type: string
  /** Current execution status */
  status: TemporalWorkflowStatus
  /** Execution start time (ISO 8601) */
  start_time: string
  /** Execution close time (ISO 8601), null if still running */
  close_time: string | null
  /** Execution duration in milliseconds, null if still running */
  duration_ms: number | null
  /** Memo fields stored on the workflow (arbitrary key-value) */
  memo: Record<string, unknown>
  /** Search attributes (indexed fields for Temporal visibility queries) */
  search_attributes: Record<string, unknown>
  /** Number of task queue workers currently polling */
  task_queue: string
  /** Pending activities */
  pending_activities: TemporalPendingActivity[]
  /** Signals that have been received */
  received_signals: TemporalSignalInfo[]
}

export interface TemporalPendingActivity {
  activity_id: string
  activity_type: string
  state: 'SCHEDULED' | 'STARTED' | 'CANCEL_REQUESTED'
  scheduled_time: string
  last_started_time: string | null
  heartbeat_details?: unknown
  attempt: number
}

export interface TemporalSignalInfo {
  signal_name: string
  received_at: string
  input?: unknown
}

export interface TemporalWorkflowListParams {
  namespace?: string
  /** Temporal visibility query string, e.g. "WorkflowType='ops-workflow'" */
  query?: string
  /** Maximum number of results */
  page_size?: number
  /** Opaque page token from previous response */
  next_page_token?: string
}

export interface TemporalWorkflowListResponse {
  executions: TemporalWorkflowInfo[]
  next_page_token: string | null
}

export interface TemporalQueryResult<T = unknown> {
  result: T
}

// ─── Temporal Client API ──────────────────────────────────────────────────────

export const temporalClient = {
  /**
   * Get the status and details of a single workflow execution.
   *
   * Proxied through /api/temporal/workflows/{workflow_id}/runs/{run_id}
   */
  getWorkflow(workflowId: string, runId?: string): Promise<TemporalWorkflowInfo> {
    const path = runId
      ? `/workflows/${encodeURIComponent(workflowId)}/runs/${encodeURIComponent(runId)}`
      : `/workflows/${encodeURIComponent(workflowId)}`
    return temporalFetch<TemporalWorkflowInfo>(path)
  },

  /**
   * List workflow executions with optional Temporal visibility filter.
   *
   * Proxied through /api/temporal/workflows
   */
  listWorkflows(params?: TemporalWorkflowListParams): Promise<TemporalWorkflowListResponse> {
    const qs = new URLSearchParams()
    const ns = params?.namespace ?? TEMPORAL_NAMESPACE
    qs.set('namespace', ns)
    if (params?.query)          qs.set('query', params.query)
    if (params?.page_size)      qs.set('page_size', String(params.page_size))
    if (params?.next_page_token) qs.set('next_page_token', params.next_page_token)
    return temporalFetch<TemporalWorkflowListResponse>(`/workflows?${qs.toString()}`)
  },

  /**
   * Query a workflow's state using a named Temporal query handler.
   *
   * Proxied through POST /api/temporal/workflows/{workflow_id}/query
   */
  queryWorkflow<T = unknown>(
    workflowId: string,
    queryType: string,
    args?: unknown[],
  ): Promise<TemporalQueryResult<T>> {
    return temporalFetch<TemporalQueryResult<T>>(
      `/workflows/${encodeURIComponent(workflowId)}/query`,
      {
        method: 'POST',
        body: JSON.stringify({ query_type: queryType, args: args ?? [] }),
      },
    )
  },

  /**
   * Send a signal to a running workflow.
   *
   * Proxied through POST /api/temporal/workflows/{workflow_id}/signal
   *
   * Signal names defined in opsagent temporal_integration/signals.py:
   *   - "approval_signal"
   *   - "info_request_signal"
   *   - "manual_complete_signal"
   */
  signalWorkflow(
    workflowId: string,
    signalName: string,
    payload: unknown,
  ): Promise<{ ok: boolean }> {
    return temporalFetch<{ ok: boolean }>(
      `/workflows/${encodeURIComponent(workflowId)}/signal`,
      {
        method: 'POST',
        body: JSON.stringify({ signal_name: signalName, payload }),
      },
    )
  },

  /**
   * Terminate a workflow (hard stop, no cleanup).
   *
   * Proxied through POST /api/temporal/workflows/{workflow_id}/terminate
   */
  terminateWorkflow(workflowId: string, reason?: string): Promise<{ ok: boolean }> {
    return temporalFetch<{ ok: boolean }>(
      `/workflows/${encodeURIComponent(workflowId)}/terminate`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: reason ?? 'Terminated via agentflow UI' }),
      },
    )
  },

  /**
   * Cancel a workflow (graceful cancellation, allows cleanup activities).
   *
   * Proxied through POST /api/temporal/workflows/{workflow_id}/cancel
   */
  cancelWorkflow(workflowId: string): Promise<{ ok: boolean }> {
    return temporalFetch<{ ok: boolean }>(
      `/workflows/${encodeURIComponent(workflowId)}/cancel`,
      { method: 'POST' },
    )
  },

  // ── Convenience: send opsagent-specific signals ────────────────────────────

  /**
   * Send an approval signal (maps to ApprovalSignal in signals.py).
   */
  sendApprovalSignal(
    workflowId: string,
    approved: boolean,
    approver: string,
    opts?: { comment?: string; approvalId?: string; channel?: string },
  ): Promise<{ ok: boolean }> {
    return temporalClient.signalWorkflow(workflowId, 'approval_signal', {
      approved,
      approver,
      comment:     opts?.comment     ?? '',
      approval_id: opts?.approvalId  ?? '',
      timestamp:   new Date().toISOString(),
      metadata:    opts?.channel ? { channel: opts.channel } : {},
    })
  },

  /**
   * Send a manual-complete signal (maps to ManualCompleteSignal in signals.py).
   * action: "complete" | "cancel" | "skip_step"
   */
  sendManualCompleteSignal(
    workflowId: string,
    action: 'complete' | 'cancel' | 'skip_step',
    operator: string,
    opts?: { reason?: string; stepId?: string },
  ): Promise<{ ok: boolean }> {
    return temporalClient.signalWorkflow(workflowId, 'manual_complete_signal', {
      action,
      operator,
      reason:  opts?.reason  ?? '',
      step_id: opts?.stepId  ?? '',
      metadata: {},
    })
  },

  // ── UI deep-link helpers ───────────────────────────────────────────────────

  /**
   * Generate a Temporal Web UI deep-link URL for a workflow execution.
   * Opens the workflow detail page in the Temporal UI.
   */
  getWebUiUrl(workflowId: string, runId?: string): string {
    const base = `${TEMPORAL_UI_URL}/namespaces/${encodeURIComponent(TEMPORAL_NAMESPACE)}/workflows/${encodeURIComponent(workflowId)}`
    return runId ? `${base}/${encodeURIComponent(runId)}` : base
  },
}

export default temporalClient
