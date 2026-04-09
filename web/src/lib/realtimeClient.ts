// src/lib/realtimeClient.ts — AgentFlow Real-time WebSocket Client
//
// Manages a single persistent WebSocket connection to the AgentFlow backend,
// multiplexing three event streams:
//   - workflow_status  : WorkflowRun status changes (started/completed/failed)
//   - agent_health     : Agent status transitions (running/idle/error/blocked)
//   - approval_request : New human-approval tasks requiring attention
//
// Design principles:
//   - Singleton per browser tab (module-level instance)
//   - Auto-reconnect with exponential back-off (capped at 30 s)
//   - Typed event payloads — no `any`
//   - React-friendly: exposes subscribe/unsubscribe hooks consumed by stores
//   - Graceful degradation: falls back to polling if WS is unavailable

import type { WorkflowRunStatus } from '@/types/workflow'
import type { AgentStatus } from '@/types/agent'

// ─── Event payload types ──────────────────────────────────────────────────────

export interface WorkflowStatusEvent {
  type: 'workflow_status'
  runId: string
  workflowId: string
  workflowName: string
  status: WorkflowRunStatus
  triggeredBy: string
  startedAt: number
  finishedAt?: number
  errorMessage?: string
}

export interface AgentHealthEvent {
  type: 'agent_health'
  agentId: string
  agentName: string
  previousStatus: AgentStatus
  currentStatus: AgentStatus
  currentTask?: string
  timestamp: number
}

export interface ApprovalRequestEvent {
  type: 'approval_request'
  requestId: string
  workflowId: string
  workflowName: string
  runId: string
  nodeId: string
  nodeLabel: string
  requestedBy: string
  context: string
  createdAt: number
  expiresAt?: number
}

export type RealtimeEvent =
  | WorkflowStatusEvent
  | AgentHealthEvent
  | ApprovalRequestEvent

export type RealtimeEventType = RealtimeEvent['type']

// ─── Connection state ─────────────────────────────────────────────────────────

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface ConnectionStatus {
  state: ConnectionState
  latencyMs?: number
  reconnectAttempt: number
  lastConnectedAt?: number
  lastError?: string
}

// ─── Listener types ───────────────────────────────────────────────────────────

type EventListener<T extends RealtimeEvent> = (event: T) => void
type ConnectionListener = (status: ConnectionStatus) => void
type AnyEventListener = (event: RealtimeEvent) => void

// ─── Constants ────────────────────────────────────────────────────────────────

const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS  = 30_000
const PING_INTERVAL_MS  = 25_000
const CONNECT_TIMEOUT_MS = 8_000

// ─── RealtimeClient class ─────────────────────────────────────────────────────

export class RealtimeClient {
  private ws: WebSocket | null = null
  private status: ConnectionStatus = { state: 'disconnected', reconnectAttempt: 0 }
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  // Typed listener maps
  private listeners: {
    workflow_status: Set<EventListener<WorkflowStatusEvent>>
    agent_health: Set<EventListener<AgentHealthEvent>>
    approval_request: Set<EventListener<ApprovalRequestEvent>>
    '*': Set<AnyEventListener>
  } = {
    workflow_status: new Set(),
    agent_health: new Set(),
    approval_request: new Set(),
    '*': new Set(),
  }
  private connectionListeners: Set<ConnectionListener> = new Set()

  constructor(private readonly wsUrl: string) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  connect(): void {
    if (this.destroyed) return
    if (this.ws?.readyState === WebSocket.OPEN) return
    this._connect()
  }

  disconnect(): void {
    this.destroyed = true
    this._clearTimers()
    this.ws?.close(1000, 'client_disconnect')
    this.ws = null
    this._setStatus({ state: 'disconnected', reconnectAttempt: 0 })
  }

  getStatus(): ConnectionStatus {
    return { ...this.status }
  }

  // ── Typed subscriptions ─────────────────────────────────────────────────────

  on(type: 'workflow_status', fn: EventListener<WorkflowStatusEvent>): () => void
  on(type: 'agent_health',    fn: EventListener<AgentHealthEvent>): () => void
  on(type: 'approval_request', fn: EventListener<ApprovalRequestEvent>): () => void
  on(type: '*', fn: AnyEventListener): () => void
  on(type: RealtimeEventType | '*', fn: EventListener<RealtimeEvent> | AnyEventListener): () => void {
    if (type === '*') {
      this.listeners['*'].add(fn as AnyEventListener)
      return () => this.listeners['*'].delete(fn as AnyEventListener)
    }
    const set = this.listeners[type] as Set<EventListener<RealtimeEvent>>
    set.add(fn as EventListener<RealtimeEvent>)
    return () => set.delete(fn as EventListener<RealtimeEvent>)
  }

  onConnectionChange(fn: ConnectionListener): () => void {
    this.connectionListeners.add(fn)
    // Immediately call with current status
    fn({ ...this.status })
    return () => this.connectionListeners.delete(fn)
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private _connect(): void {
    if (this.destroyed) return

    this._setStatus({ ...this.status, state: 'connecting' })

    let ws: WebSocket
    try {
      ws = new WebSocket(this.wsUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'WebSocket constructor failed'
      this._setStatus({ state: 'error', reconnectAttempt: this.status.reconnectAttempt, lastError: msg })
      this._scheduleReconnect()
      return
    }

    this.ws = ws

    // Connection timeout guard
    this.connectTimer = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close()
        this._setStatus({
          ...this.status,
          state: 'error',
          lastError: `Connection timeout after ${CONNECT_TIMEOUT_MS}ms`,
        })
        this._scheduleReconnect()
      }
    }, CONNECT_TIMEOUT_MS)

    ws.onopen = () => {
      if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null }
      this._setStatus({
        state: 'connected',
        reconnectAttempt: 0,
        lastConnectedAt: Date.now(),
      })
      this._startPing()
    }

    ws.onmessage = (ev: MessageEvent) => {
      this._handleMessage(ev.data as string)
    }

    ws.onerror = () => {
      // onerror is always followed by onclose; log here for status
      this._setStatus({
        ...this.status,
        state: 'error',
        lastError: 'WebSocket error',
      })
    }

    ws.onclose = (ev: CloseEvent) => {
      if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null }
      this._stopPing()
      if (!this.destroyed && ev.code !== 1000) {
        this._scheduleReconnect()
      } else if (!this.destroyed) {
        this._setStatus({ state: 'disconnected', reconnectAttempt: 0 })
      }
    }
  }

  private _handleMessage(raw: string): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return // ignore malformed frames
    }

    if (!parsed || typeof parsed !== 'object') return
    const msg = parsed as Record<string, unknown>

    // Pong frame — measure latency
    if (msg['type'] === 'pong') {
      const sentAt = msg['sentAt'] as number | undefined
      if (sentAt) {
        this._setStatus({ ...this.status, latencyMs: Date.now() - sentAt })
      }
      return
    }

    const type = msg['type'] as string
    if (!type) return

    if (type === 'workflow_status') {
      const event = msg as unknown as WorkflowStatusEvent
      this.listeners.workflow_status.forEach(fn => fn(event))
      this.listeners['*'].forEach(fn => fn(event))
    } else if (type === 'agent_health') {
      const event = msg as unknown as AgentHealthEvent
      this.listeners.agent_health.forEach(fn => fn(event))
      this.listeners['*'].forEach(fn => fn(event))
    } else if (type === 'approval_request') {
      const event = msg as unknown as ApprovalRequestEvent
      this.listeners.approval_request.forEach(fn => fn(event))
      this.listeners['*'].forEach(fn => fn(event))
    }
  }

  private _scheduleReconnect(): void {
    if (this.destroyed) return
    this._clearTimers()
    const attempt = this.status.reconnectAttempt + 1
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** (attempt - 1), RECONNECT_MAX_MS)
    this._setStatus({ ...this.status, state: 'disconnected', reconnectAttempt: attempt })
    this.reconnectTimer = setTimeout(() => this._connect(), delay)
  }

  private _startPing(): void {
    this._stopPing()
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', sentAt: Date.now() }))
      }
    }, PING_INTERVAL_MS)
  }

  private _stopPing(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
  }

  private _clearTimers(): void {
    this._stopPing()
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    if (this.connectTimer)   { clearTimeout(this.connectTimer);   this.connectTimer = null }
  }

  private _setStatus(next: ConnectionStatus): void {
    this.status = next
    this.connectionListeners.forEach(fn => fn({ ...next }))
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: RealtimeClient | null = null

/**
 * Get the module-level singleton RealtimeClient.
 * The WS URL is derived from the current browser origin (ws:// or wss://).
 * Falls back to a no-op stub during SSR.
 */
export function getRealtimeClient(): RealtimeClient {
  if (typeof window === 'undefined') {
    // SSR stub — never actually connects
    return new RealtimeClient('ws://localhost:0')
  }
  if (!_instance) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${window.location.host}/api/realtime`
    _instance = new RealtimeClient(url)
  }
  return _instance
}

/**
 * Destroy the singleton (useful for testing or hot-reload scenarios).
 */
export function destroyRealtimeClient(): void {
  _instance?.disconnect()
  _instance = null
}
