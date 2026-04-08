/**
 * opsagentApi.ts — Typed HTTP client for the OpsAgent backend platform.
 *
 * Covers four service areas:
 *   1. Agent Registry  — backed by temporal_integration/agent_registry + CMDB service
 *   2. Workflow Engine — workflow CRUD, trigger, query, cancel
 *   3. Approval Bridge — send approval signals to running workflows
 *   4. Audit Log       — query execution history / audit trail
 *
 * All functions return typed Promises and throw OpsAgentApiError on non-2xx.
 * Callers can substitute the base URLs via env vars (see .env.example).
 */

// ─── Base URLs ────────────────────────────────────────────────────────────────

const WORKFLOW_ENGINE_URL =
  process.env.NEXT_PUBLIC_WORKFLOW_ENGINE_URL ?? 'http://localhost:8010'

const CMDB_URL =
  process.env.NEXT_PUBLIC_CMDB_URL ?? 'http://localhost:8013'

const LARK_APPROVAL_BRIDGE_URL =
  process.env.NEXT_PUBLIC_LARK_APPROVAL_BRIDGE_URL ?? 'http://localhost:8011'

// ─── Error type ───────────────────────────────────────────────────────────────

export class OpsAgentApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    message: string,
  ) {
    super(`OpsAgent API error ${status} @ ${endpoint}: ${message}`)
    this.name = 'OpsAgentApiError'
  }
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? body.message ?? detail
    } catch {
      // ignore parse error
    }
    throw new OpsAgentApiError(res.status, url, detail)
  }

  // 204 No Content — return empty object
  if (res.status === 204) return {} as T
  return res.json() as Promise<T>
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. AGENT REGISTRY
//    Backed by the temporal_integration AgentRegistry (Redis) which is exposed
//    through the workflow-engine service and the CMDB service's CI endpoint.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Agent Registry types (mirrors temporal_integration/agent_registry.py) ─────

export interface AgentCapability {
  name: string
  description: string
  intents: string[]
  input_schema: Record<string, unknown>
  output_schema: Record<string, unknown>
}

export interface AgentInfo {
  agent_id: string
  name: string
  description: string
  base_url: string
  a2a_endpoint: string
  health_check_url: string
  capabilities: AgentCapability[]
  tags: string[]
  metadata: Record<string, unknown>
  is_healthy: boolean
  last_seen: string | null   // ISO 8601
  registered_at: string      // ISO 8601
}

export interface AgentRegistryListResponse {
  agents: AgentInfo[]
}

export interface AgentHealthCheckAllResponse {
  results: Record<string, boolean>
}

// CMDB ConfigurationItem (subset used for agent health display)
export interface CIRecord {
  id: string
  ci_type: string
  name: string
  status: string
  environment: string | null
  region: string | null
  cloud: string | null
  owner_team: string | null
  tags: Record<string, unknown>
  attributes: Record<string, unknown>
  source_agent: string | null
  updated_at: string
}

export interface CIListResponse {
  items: CIRecord[]
  total: number
}

// ── Agent Registry API ────────────────────────────────────────────────────────

export const agentRegistryApi = {
  /**
   * List all registered agents from the Temporal Agent Registry.
   * Endpoint: GET /agents  (workflow-engine)
   */
  listAgents(): Promise<AgentRegistryListResponse> {
    return apiFetch(`${WORKFLOW_ENGINE_URL}/agents`)
  },

  /**
   * Get a single agent by ID.
   * Endpoint: GET /agents/{agent_id}
   */
  getAgent(agentId: string): Promise<AgentInfo> {
    return apiFetch(`${WORKFLOW_ENGINE_URL}/agents/${encodeURIComponent(agentId)}`)
  },

  /**
   * Register (create or update) an agent.
   * Endpoint: POST /agents
   */
  registerAgent(agent: Omit<AgentInfo, 'registered_at' | 'last_seen' | 'is_healthy'>): Promise<AgentInfo> {
    return apiFetch(`${WORKFLOW_ENGINE_URL}/agents`, {
      method: 'POST',
      body: JSON.stringify(agent),
    })
  },

  /**
   * Unregister (delete) an agent.
   * Endpoint: DELETE /agents/{agent_id}
   */
  unregisterAgent(agentId: string): Promise<{ deleted: boolean }> {
    return apiFetch(`${WORKFLOW_ENGINE_URL}/agents/${encodeURIComponent(agentId)}`, {
      method: 'DELETE',
    })
  },

  /**
   * Trigger a health check for all agents and return results.
   * Endpoint: POST /agents/health-check
   */
  healthCheckAll(): Promise<AgentHealthCheckAllResponse> {
    return apiFetch(`${WORKFLOW_ENGINE_URL}/agents/health-check`, {
      method: 'POST',
    })
  },

  /**
   * Query CMDB CIs filtered by ci_type and/or status.
   * Useful for fetching infra assets alongside agent health.
   * Endpoint: GET /cis  (cmdb-service)
   */
  listCIs(params?: {
    ci_type?: string
    status?: string
    environment?: string
    owner_team?: string
    limit?: number
    offset?: number
  }): Promise<CIListResponse> {
    const qs = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v))
      })
    }
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return apiFetch(`${CMDB_URL}/cis${query}`)
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. WORKFLOW ENGINE
//    Backed by opsagent-platform/platform/workflow-engine/engine.py
// ═══════════════════════════════════════════════════════════════════════════════

// ── Workflow Engine types (mirrors engine.py Pydantic models) ─────────────────

export interface OpsWorkflowStep {
  id: string
  name: string
  type: 'agent' | 'approval' | 'condition' | 'parallel' | 'notification'
  agent_name?: string
  agent_url?: string
  message_template?: string
  approval_config?: Record<string, unknown>
  condition_expr?: string
  parallel_steps?: string[]
  timeout_seconds?: number
  retry_count?: number
  transitions: Array<{ target: string; condition?: string }>
  metadata: Record<string, unknown>
}

export interface OpsWorkflowDefinition {
  id: string
  name: string
  description?: string
  version?: string
  trigger?: 'manual' | 'webhook' | 'cron'
  steps: OpsWorkflowStep[]
  entry_step: string
  variables?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface OpsWorkflowSummary {
  id: string
  name: string
  description: string
  version: string
}

export interface OpsWorkflowListResponse {
  workflows: OpsWorkflowSummary[]
}

export interface RegisterWorkflowResponse {
  id: string
  name: string
  status: 'registered'
}

export interface StartWorkflowRequest {
  workflow_id: string
  trigger_event?: Record<string, unknown>
  variables?: Record<string, unknown>
}

export interface StartWorkflowResponse {
  execution_id: string
  workflow_id: string
  status: string
}

export interface StepExecution {
  step_id: string
  status: 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'skipped'
  started_at: string | null
  completed_at: string | null
  input_data: Record<string, unknown>
  output_data: Record<string, unknown>
  error: string | null
  retry_attempt: number
}

export interface WorkflowExecutionDetail {
  id: string
  workflow_id: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  started_at: string
  completed_at: string | null
  trigger_event: Record<string, unknown>
  variables: Record<string, unknown>
  steps: Record<string, StepExecution>
  current_step: string | null
  error: string | null
}

export interface CancelExecutionResponse {
  status: 'cancelled'
}

// ── Workflow Engine API ───────────────────────────────────────────────────────

export const workflowEngineApi = {
  /**
   * List all registered workflow definitions.
   * Endpoint: GET /workflows
   */
  listWorkflows(): Promise<OpsWorkflowListResponse> {
    return apiFetch(`${WORKFLOW_ENGINE_URL}/workflows`)
  },

  /**
   * Register a workflow definition (JSON format).
   * Endpoint: POST /workflows/register
   */
  registerWorkflow(definition: OpsWorkflowDefinition): Promise<RegisterWorkflowResponse> {
    return apiFetch(`${WORKFLOW_ENGINE_URL}/workflows/register`, {
      method: 'POST',
      body: JSON.stringify({ definition }),
    })
  },

  /**
   * Register a workflow definition (YAML format).
   * Endpoint: POST /workflows/register-yaml
   */
  registerWorkflowYaml(yamlContent: string): Promise<RegisterWorkflowResponse> {
    return apiFetch(`${WORKFLOW_ENGINE_URL}/workflows/register-yaml`, {
      method: 'POST',
      body: JSON.stringify({ yaml: yamlContent }),
    })
  },

  /**
   * Start (trigger) a workflow execution.
   * Endpoint: POST /workflows/start
   */
  startWorkflow(req: StartWorkflowRequest): Promise<StartWorkflowResponse> {
    return apiFetch(`${WORKFLOW_ENGINE_URL}/workflows/start`, {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  /**
   * Get the current execution state by execution ID.
   * Endpoint: GET /executions/{execution_id}
   */
  getExecution(executionId: string): Promise<WorkflowExecutionDetail> {
    return apiFetch(`${WORKFLOW_ENGINE_URL}/executions/${encodeURIComponent(executionId)}`)
  },

  /**
   * Cancel a running execution.
   * Endpoint: POST /executions/{execution_id}/cancel
   */
  cancelExecution(executionId: string): Promise<CancelExecutionResponse> {
    return apiFetch(
      `${WORKFLOW_ENGINE_URL}/executions/${encodeURIComponent(executionId)}/cancel`,
      { method: 'POST' },
    )
  },

  /**
   * Health check for the workflow engine service.
   * Endpoint: GET /health
   */
  health(): Promise<{ status: string; service: string }> {
    return apiFetch(`${WORKFLOW_ENGINE_URL}/health`)
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. APPROVAL SIGNALS
//    Sends approval/rejection decisions to:
//    - Simple workflow engine: POST /executions/{id}/steps/{step_id}/approve
//    - Lark Approval Bridge: POST /approvals/create + callback flow
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApprovalDecisionRequest {
  approved: boolean
  approver: string
  comment?: string
}

export interface ApprovalDecisionResponse {
  status: 'approved' | 'rejected'
}

export interface LarkApprovalCreateRequest {
  execution_id: string
  step_id: string
  step_name: string
  description: string
  agent_output?: string
  approver_ids: string[]
  initiator_id: string
  metadata?: Record<string, unknown>
}

export interface LarkApprovalCreateResponse {
  instance_code: string
  status: string
}

export interface LarkApprovalStatusResponse {
  instance_code: string
  status: string
  execution_id?: string
  step_id?: string
}

export const approvalApi = {
  /**
   * Submit an approval decision for a workflow step.
   * Routes directly to the workflow engine.
   * Endpoint: POST /executions/{execution_id}/steps/{step_id}/approve
   */
  submitDecision(
    executionId: string,
    stepId: string,
    req: ApprovalDecisionRequest,
  ): Promise<ApprovalDecisionResponse> {
    return apiFetch(
      `${WORKFLOW_ENGINE_URL}/executions/${encodeURIComponent(executionId)}/steps/${encodeURIComponent(stepId)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({
          approved: req.approved,
          approver: req.approver,
        }),
      },
    )
  },

  /**
   * Create a Lark (Feishu) approval instance for a workflow step.
   * The Lark Approval Bridge handles the async callback flow.
   * Endpoint: POST /approvals/create
   */
  createLarkApproval(req: LarkApprovalCreateRequest): Promise<LarkApprovalCreateResponse> {
    return apiFetch(`${LARK_APPROVAL_BRIDGE_URL}/approvals/create`, {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  /**
   * Query the status of a Lark approval instance.
   * Endpoint: GET /approvals/{instance_code}
   */
  getLarkApprovalStatus(instanceCode: string): Promise<LarkApprovalStatusResponse> {
    return apiFetch(
      `${LARK_APPROVAL_BRIDGE_URL}/approvals/${encodeURIComponent(instanceCode)}`,
    )
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. AUDIT LOG QUERY
//    The workflow engine execution detail is the authoritative audit source.
//    These helpers query execution history and map to agentflow AuditLogEntry.
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuditQueryParams {
  workflow_id?: string
  status?: WorkflowExecutionDetail['status']
  /** Epoch ms lower bound */
  from_ts?: number
  /** Epoch ms upper bound */
  to_ts?: number
  limit?: number
  offset?: number
}

export interface AuditQueryResponse {
  executions: WorkflowExecutionDetail[]
  total: number
}

export const auditApi = {
  /**
   * Query workflow executions as an audit log.
   * Maps to GET /executions with optional filters.
   *
   * Note: the current workflow engine stores executions in Redis individually.
   * This function queries each execution ID from a listing endpoint when
   * available, or falls back to fetching a known set of IDs.
   * Endpoint: GET /executions  (if available) or direct execution fetch.
   */
  queryExecutions(params?: AuditQueryParams): Promise<AuditQueryResponse> {
    const qs = new URLSearchParams()
    if (params) {
      if (params.workflow_id) qs.set('workflow_id', params.workflow_id)
      if (params.status)      qs.set('status', params.status)
      if (params.from_ts)     qs.set('from_ts', String(params.from_ts))
      if (params.to_ts)       qs.set('to_ts', String(params.to_ts))
      if (params.limit)       qs.set('limit', String(params.limit))
      if (params.offset)      qs.set('offset', String(params.offset))
    }
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return apiFetch(`${WORKFLOW_ENGINE_URL}/executions${query}`)
  },

  /**
   * Fetch a single execution record by ID (used for detail views).
   */
  getExecution(executionId: string): Promise<WorkflowExecutionDetail> {
    return workflowEngineApi.getExecution(executionId)
  },
}

// ─── Convenience re-export of all sub-clients ────────────────────────────────

export const opsagentApi = {
  agents:    agentRegistryApi,
  workflows: workflowEngineApi,
  approvals: approvalApi,
  audit:     auditApi,
}

export default opsagentApi
