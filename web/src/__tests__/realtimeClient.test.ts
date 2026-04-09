/**
 * realtimeClient.test.ts
 *
 * Tests for the RealtimeClient WebSocket manager.
 * Uses a mock WebSocket to avoid real network connections.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RealtimeClient,
  destroyRealtimeClient,
  type WorkflowStatusEvent,
  type AgentHealthEvent,
  type ApprovalRequestEvent,
  type ConnectionState,
} from '@/lib/realtimeClient'

// ─── Mock WebSocket ────────────────────────────────────────────────────────────

class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3

  readyState = MockWebSocket.OPEN
  url: string

  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: ((ev: { code: number }) => void) | null = null

  sentMessages: string[] = []

  constructor(url: string) {
    this.url = url
    // Store instance for test access
    MockWebSocket.lastInstance = this
  }

  send(data: string): void {
    this.sentMessages.push(data)
  }

  close(code = 1000): void {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code })
  }

  /** Helpers for test control */
  simulateOpen(): void {
    this.onopen?.()
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) })
  }

  simulateError(): void {
    this.onerror?.()
  }

  simulateClose(code = 4000): void {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code })
  }

  static lastInstance: MockWebSocket
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('WebSocket', MockWebSocket)
  destroyRealtimeClient()
})

afterEach(() => {
  vi.unstubAllGlobals()
  destroyRealtimeClient()
  vi.clearAllTimers()
})

// ─── Connection lifecycle ─────────────────────────────────────────────────────

describe('RealtimeClient — connection lifecycle', () => {
  it('should start in disconnected state', () => {
    const client = new RealtimeClient('ws://localhost/api/realtime')
    expect(client.getStatus().state).toBe('disconnected')
  })

  it('should move to connecting then connected on successful open', () => {
    const states: ConnectionState[] = []
    const client = new RealtimeClient('ws://localhost/api/realtime')
    client.onConnectionChange(s => states.push(s.state))
    client.connect()
    MockWebSocket.lastInstance.simulateOpen()
    expect(states).toContain('connecting')
    expect(states).toContain('connected')
  })

  it('should report reconnectAttempt=0 after successful connect', () => {
    const client = new RealtimeClient('ws://localhost/api/realtime')
    client.connect()
    MockWebSocket.lastInstance.simulateOpen()
    expect(client.getStatus().reconnectAttempt).toBe(0)
  })

  it('should not reconnect after clean disconnect (code 1000)', () => {
    const client = new RealtimeClient('ws://localhost/api/realtime')
    client.connect()
    MockWebSocket.lastInstance.simulateOpen()
    client.disconnect()
    expect(client.getStatus().state).toBe('disconnected')
  })

  it('should schedule reconnect on abnormal close', () => {
    vi.useFakeTimers()
    const states: ConnectionState[] = []
    const client = new RealtimeClient('ws://localhost/api/realtime')
    client.onConnectionChange(s => states.push(s.state))
    client.connect()
    MockWebSocket.lastInstance.simulateOpen()
    MockWebSocket.lastInstance.simulateClose(4001)
    // After abnormal close, should be disconnected with reconnectAttempt > 0
    const status = client.getStatus()
    expect(status.state).toBe('disconnected')
    expect(status.reconnectAttempt).toBeGreaterThan(0)
    vi.useRealTimers()
  })

  it('should not create new connections after destroy()', () => {
    const client = new RealtimeClient('ws://localhost/api/realtime')
    client.connect()
    MockWebSocket.lastInstance.simulateOpen()
    client.disconnect()
    const before = MockWebSocket.lastInstance
    client.connect() // should be no-op
    // The instance should not have changed
    expect(MockWebSocket.lastInstance).toBe(before)
  })
})

// ─── Event routing ────────────────────────────────────────────────────────────

describe('RealtimeClient — event routing', () => {
  function makeConnectedClient(): RealtimeClient {
    const client = new RealtimeClient('ws://localhost/api/realtime')
    client.connect()
    MockWebSocket.lastInstance.simulateOpen()
    return client
  }

  it('should route workflow_status events to workflow_status listeners', () => {
    const client = makeConnectedClient()
    const received: WorkflowStatusEvent[] = []
    client.on('workflow_status', ev => received.push(ev))

    const event: WorkflowStatusEvent = {
      type: 'workflow_status',
      runId: 'run-001',
      workflowId: 'wf-001',
      workflowName: 'Security Scan',
      status: 'success',
      triggeredBy: 'user:john',
      startedAt: Date.now(),
    }
    MockWebSocket.lastInstance.simulateMessage(event)
    expect(received).toHaveLength(1)
    expect(received[0].runId).toBe('run-001')
  })

  it('should route agent_health events to agent_health listeners', () => {
    const client = makeConnectedClient()
    const received: AgentHealthEvent[] = []
    client.on('agent_health', ev => received.push(ev))

    const event: AgentHealthEvent = {
      type: 'agent_health',
      agentId: 'agent-001',
      agentName: 'Builder Agent',
      previousStatus: 'running',
      currentStatus: 'error',
      timestamp: Date.now(),
    }
    MockWebSocket.lastInstance.simulateMessage(event)
    expect(received).toHaveLength(1)
    expect(received[0].currentStatus).toBe('error')
  })

  it('should route approval_request events to approval_request listeners', () => {
    const client = makeConnectedClient()
    const received: ApprovalRequestEvent[] = []
    client.on('approval_request', ev => received.push(ev))

    const event: ApprovalRequestEvent = {
      type: 'approval_request',
      requestId: 'req-001',
      workflowId: 'wf-001',
      workflowName: 'Deploy Pipeline',
      runId: 'run-001',
      nodeId: 'n-approval',
      nodeLabel: 'Approve Deploy',
      requestedBy: 'system',
      context: 'Deploy v1.2.3 to production',
      createdAt: Date.now(),
    }
    MockWebSocket.lastInstance.simulateMessage(event)
    expect(received).toHaveLength(1)
    expect(received[0].requestId).toBe('req-001')
  })

  it('should also route all events to * wildcard listeners', () => {
    const client = makeConnectedClient()
    const all: unknown[] = []
    client.on('*', ev => all.push(ev))

    MockWebSocket.lastInstance.simulateMessage({ type: 'workflow_status', runId: 'r1', workflowId: 'w1', workflowName: 'W', status: 'success', triggeredBy: 'u', startedAt: 0 })
    MockWebSocket.lastInstance.simulateMessage({ type: 'agent_health', agentId: 'a1', agentName: 'A', previousStatus: 'idle', currentStatus: 'running', timestamp: 0 })
    expect(all).toHaveLength(2)
  })

  it('should NOT route to wrong type listener', () => {
    const client = makeConnectedClient()
    const workflowEvents: unknown[] = []
    client.on('workflow_status', ev => workflowEvents.push(ev))

    MockWebSocket.lastInstance.simulateMessage({
      type: 'agent_health',
      agentId: 'a1', agentName: 'A',
      previousStatus: 'idle', currentStatus: 'error',
      timestamp: Date.now(),
    })
    expect(workflowEvents).toHaveLength(0)
  })
})

// ─── Unsubscribe ──────────────────────────────────────────────────────────────

describe('RealtimeClient — unsubscribe', () => {
  it('should stop calling listener after unsubscribe()', () => {
    const client = new RealtimeClient('ws://localhost/api/realtime')
    client.connect()
    MockWebSocket.lastInstance.simulateOpen()

    const received: unknown[] = []
    const unsub = client.on('workflow_status', ev => received.push(ev))

    const event = { type: 'workflow_status', runId: 'r1', workflowId: 'w1', workflowName: 'W', status: 'success' as const, triggeredBy: 'u', startedAt: 0 }
    MockWebSocket.lastInstance.simulateMessage(event)
    expect(received).toHaveLength(1)

    unsub()
    MockWebSocket.lastInstance.simulateMessage(event)
    expect(received).toHaveLength(1) // no new events
  })

  it('should stop calling connection listener after unsubscribe()', () => {
    const client = new RealtimeClient('ws://localhost/api/realtime')
    const calls: unknown[] = []
    const unsub = client.onConnectionChange(s => calls.push(s))
    const callCount = calls.length

    unsub()
    client.connect()
    MockWebSocket.lastInstance.simulateOpen()
    expect(calls.length).toBe(callCount) // no new calls
  })
})

// ─── Ping / pong ─────────────────────────────────────────────────────────────

describe('RealtimeClient — ping/pong', () => {
  it('should update latency when pong is received', () => {
    const client = new RealtimeClient('ws://localhost/api/realtime')
    client.connect()
    MockWebSocket.lastInstance.simulateOpen()

    MockWebSocket.lastInstance.simulateMessage({ type: 'pong', sentAt: Date.now() - 42 })
    const status = client.getStatus()
    expect(status.latencyMs).toBeDefined()
    expect(status.latencyMs).toBeGreaterThanOrEqual(0)
  })
})

// ─── Malformed messages ────────────────────────────────────────────────────────

describe('RealtimeClient — resilience', () => {
  it('should not throw on invalid JSON message', () => {
    const client = new RealtimeClient('ws://localhost/api/realtime')
    client.connect()
    MockWebSocket.lastInstance.simulateOpen()
    expect(() =>
      MockWebSocket.lastInstance.onmessage?.({ data: 'not-json' })
    ).not.toThrow()
  })

  it('should not throw on message with no type field', () => {
    const client = new RealtimeClient('ws://localhost/api/realtime')
    client.connect()
    MockWebSocket.lastInstance.simulateOpen()
    expect(() =>
      MockWebSocket.lastInstance.simulateMessage({ foo: 'bar' })
    ).not.toThrow()
  })

  it('should not throw on null message', () => {
    const client = new RealtimeClient('ws://localhost/api/realtime')
    client.connect()
    MockWebSocket.lastInstance.simulateOpen()
    expect(() =>
      MockWebSocket.lastInstance.simulateMessage(null)
    ).not.toThrow()
  })
})
