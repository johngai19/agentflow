/**
 * IAgentProvider — abstract interface for decoupled agent sources.
 * Implementations: MockAgentProvider (local), KagentProvider (K8s CRDs), OpenAIProvider, etc.
 */

import type { Agent, Zone } from '@/data/studioData'

export interface AgentProviderConfig {
  type: 'mock' | 'kagent' | 'openai' | 'custom'
  endpoint?: string   // e.g. K8s API server for kagent
  namespace?: string  // K8s namespace
  apiKey?: string
}

export interface IAgentProvider {
  /** Fetch current list of agents */
  getAgents(): Promise<Agent[]>

  /** Fetch zone definitions */
  getZones(): Promise<Zone[]>

  /** Assign an agent to a task in a zone */
  assignTask(agentId: string, zoneId: string, task?: string): Promise<void>

  /** Update agent status */
  updateStatus(agentId: string, status: Agent['status'], task?: string): Promise<void>

  /** Scale agent pod count (kagent) — no-op for non-K8s providers */
  scalePods(agentId: string, count: number): Promise<void>

  /** Send message to an agent and get a streaming reply URL */
  getChatEndpoint(agentId: string): string

  /** Provider name shown in UI */
  readonly providerName: string
  readonly providerIcon: string
}

// ─────────────────────────────────────────────
// Mock Provider (local data — no network)
// ─────────────────────────────────────────────

import { INITIAL_AGENTS, ZONES } from '@/data/studioData'

export class MockAgentProvider implements IAgentProvider {
  readonly providerName = 'Mock (Local)'
  readonly providerIcon = '🧪'

  async getAgents() { return [...INITIAL_AGENTS] }
  async getZones()  { return [...ZONES] }
  async assignTask() { /* handled by local store */ }
  async updateStatus() { /* handled by local store */ }
  async scalePods()  { /* no-op for mock */ }
  getChatEndpoint()  { return '/api/agent-chat' }
}

// ─────────────────────────────────────────────
// kagent Provider (Kubernetes CRDs)
// ─────────────────────────────────────────────

export class KagentProvider implements IAgentProvider {
  readonly providerName = 'kagent (K8s)'
  readonly providerIcon = '☸️'

  constructor(private config: AgentProviderConfig) {}

  async getAgents(): Promise<Agent[]> {
    // TODO: fetch from K8s API — GET /apis/kagent.dev/v1alpha1/namespaces/{ns}/agents
    const endpoint = this.config.endpoint ?? '/api/kagent/agents'
    try {
      const res = await fetch(endpoint, {
        headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {},
      })
      if (!res.ok) throw new Error(`kagent fetch failed: ${res.status}`)
      const data = await res.json()
      // Map CRD spec to Agent shape
      return (data.items ?? []).map(mapKagentCRDToAgent)
    } catch {
      console.warn('[KagentProvider] falling back to mock data')
      return [...INITIAL_AGENTS]
    }
  }

  async getZones() { return [...ZONES] }

  async assignTask(agentId: string, zoneId: string, task?: string) {
    const endpoint = `${this.config.endpoint ?? '/api/kagent'}/agents/${agentId}/assign`
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoneId, task }),
    }).catch(() => {/* graceful */})
  }

  async updateStatus() { /* K8s status is read-only; reconciled by operator */ }

  async scalePods(agentId: string, count: number) {
    // PATCH /apis/apps/v1/namespaces/{ns}/deployments/{agentId} with replicas
    const endpoint = `${this.config.endpoint ?? '/api/kagent'}/agents/${agentId}/scale`
    await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replicas: count }),
    }).catch(() => {/* graceful */})
  }

  getChatEndpoint(agentId: string) {
    return `${this.config.endpoint ?? '/api/kagent'}/agents/${agentId}/chat`
  }
}

// ─────────────────────────────────────────────
// CRD → Agent mapper
// ─────────────────────────────────────────────

function mapKagentCRDToAgent(crd: Record<string, unknown>): Agent {
  const spec = (crd.spec as Record<string, unknown>) ?? {}
  const meta = (crd.metadata as Record<string, unknown>) ?? {}
  return {
    id:             String(meta.name ?? 'unknown'),
    name:           String(spec.displayName ?? meta.name ?? 'Agent'),
    emoji:          String(spec.emoji ?? '🤖'),
    color:          String(spec.color ?? '#6366f1'),
    bgColor:        String(spec.bgColor ?? 'bg-indigo-500'),
    role:           String(spec.role ?? 'Agent'),
    description:    String(spec.description ?? ''),
    tools:          (spec.tools as string[]) ?? [],
    personality:    String(spec.personality ?? ''),
    status:         'idle',
    currentZone:    'default',
    completedTasks: 0,
    podCount:       Number((spec as Record<string, unknown>).replicas ?? 1),
    podMaxCount:    Number((spec as Record<string, unknown>).maxReplicas ?? 5),
    isOrchestrator: Boolean((spec as Record<string, unknown>).orchestrator),
    projectId:      String((meta.labels as Record<string, string>)?.['studio.project'] ?? ''),
    workflowLinks:  (spec.workflowLinks as string[]) ?? [],
  }
}

// ─────────────────────────────────────────────
// Provider factory
// ─────────────────────────────────────────────

export function createAgentProvider(config: AgentProviderConfig): IAgentProvider {
  switch (config.type) {
    case 'kagent': return new KagentProvider(config)
    case 'mock':
    default:       return new MockAgentProvider()
  }
}

// Singleton default provider (can be swapped at runtime)
let _activeProvider: IAgentProvider = new MockAgentProvider()

export function getAgentProvider() { return _activeProvider }
export function setAgentProvider(p: IAgentProvider) { _activeProvider = p }
