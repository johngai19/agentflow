"use client"

// ─── Notification Center ───────────────────────────────────────────────────────
// Displays real-time notifications via the RealtimeClient.
// Three categories: approval_pending · workflow_done/failed · agent_error
//
// Features:
//   - Sound alerts (Web Audio API, no asset dependencies)
//   - Desktop (browser) notifications via Notification API
//   - Badge count on trigger button
//   - Mark-as-read / clear-all
//   - Connection status indicator

import { useEffect, useRef, useState, useCallback } from 'react'
import { getRealtimeClient } from '@/lib/realtimeClient'
import type {
  WorkflowStatusEvent,
  AgentHealthEvent,
  ApprovalRequestEvent,
  ConnectionState,
} from '@/lib/realtimeClient'
import { cn } from '@/lib/utils'

// ─── Notification model ───────────────────────────────────────────────────────

type NotifCategory = 'approval' | 'workflow' | 'agent'

interface Notification {
  id: string
  category: NotifCategory
  title: string
  body: string
  timestamp: number
  read: boolean
  /** Optional action link shown as a button */
  actionHref?: string
  actionLabel?: string
}

// ─── Sound helper (Web Audio API — no external assets) ────────────────────────

function playTone(
  frequency: number,
  durationMs: number,
  gainValue = 0.15,
  type: OscillatorType = 'sine'
): void {
  if (typeof window === 'undefined') return
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = frequency
    osc.type = type
    gain.gain.setValueAtTime(gainValue, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + durationMs / 1000)
  } catch {
    // AudioContext blocked (e.g., no user gesture yet) — silent fallback
  }
}

const SOUNDS: Record<NotifCategory, () => void> = {
  approval: () => { playTone(880, 200); setTimeout(() => playTone(1100, 200), 220) },
  workflow: () => playTone(660, 180, 0.12),
  agent:    () => { playTone(440, 150, 0.18, 'square'); setTimeout(() => playTone(330, 200, 0.15, 'square'), 170) },
}

// ─── Desktop notification helper ─────────────────────────────────────────────

function showDesktopNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' })
  } else if (Notification.permission === 'default') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') new Notification(title, { body, icon: '/favicon.ico' })
    })
  }
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  NotifCategory,
  { label: string; dotClass: string; bgClass: string; icon: string }
> = {
  approval: {
    label: 'Approval Needed',
    dotClass: 'bg-amber-500',
    bgClass:  'border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/30',
    icon: '⏳',
  },
  workflow: {
    label: 'Workflow Update',
    dotClass: 'bg-blue-500',
    bgClass:  'border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-950/30',
    icon: '⚡',
  },
  agent: {
    label: 'Agent Alert',
    dotClass: 'bg-red-500',
    bgClass:  'border-l-4 border-red-400 bg-red-50 dark:bg-red-950/30',
    icon: '🤖',
  },
}

// ─── Connection dot ───────────────────────────────────────────────────────────

function ConnectionDot({ state }: { state: ConnectionState }) {
  const cfg: Record<ConnectionState, { color: string; label: string }> = {
    connected:    { color: 'bg-green-500',  label: 'Live' },
    connecting:   { color: 'bg-yellow-400 animate-pulse', label: 'Connecting' },
    disconnected: { color: 'bg-slate-400',  label: 'Disconnected' },
    error:        { color: 'bg-red-500',    label: 'Error' },
  }
  const { color, label } = cfg[state]
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn('w-2 h-2 rounded-full', color)} />
      {label}
    </span>
  )
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({
  notif,
  onRead,
  onDismiss,
}: {
  notif: Notification
  onRead: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const cfg = CATEGORY_CONFIG[notif.category]
  const age = Date.now() - notif.timestamp
  const ageLabel =
    age < 60_000
      ? 'just now'
      : age < 3_600_000
      ? `${Math.floor(age / 60_000)}m ago`
      : `${Math.floor(age / 3_600_000)}h ago`

  return (
    <div
      className={cn(
        'relative px-3 py-2.5 rounded-lg transition',
        cfg.bgClass,
        !notif.read && 'ring-1 ring-inset ring-current/10'
      )}
      onClick={() => onRead(notif.id)}
    >
      {/* Unread dot */}
      {!notif.read && (
        <span
          className={cn(
            'absolute top-2.5 right-8 w-2 h-2 rounded-full',
            cfg.dotClass
          )}
        />
      )}
      <button
        className="absolute top-1.5 right-2 text-slate-400 hover:text-slate-600 text-xs"
        onClick={e => { e.stopPropagation(); onDismiss(notif.id) }}
        aria-label="Dismiss"
      >
        ✕
      </button>
      <div className="flex items-start gap-2 pr-4">
        <span className="text-base shrink-0 mt-0.5">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{notif.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
          <div className="flex items-center justify-between mt-1.5 gap-2">
            <span className="text-[10px] text-muted-foreground/70">{ageLabel}</span>
            {notif.actionHref && (
              <a
                href={notif.actionHref}
                className="text-[10px] font-medium text-blue-600 hover:underline"
                onClick={e => e.stopPropagation()}
              >
                {notif.actionLabel ?? 'View'}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface NotificationCenterProps {
  /** Max notifications to retain in memory (default: 50) */
  maxItems?: number
  /** Whether to play sounds (default: true) */
  soundEnabled?: boolean
  /** Whether to show desktop notifications (default: true) */
  desktopEnabled?: boolean
}

export function NotificationCenter({
  maxItems = 50,
  soundEnabled = true,
  desktopEnabled = true,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [filter, setFilter] = useState<NotifCategory | 'all'>('all')
  const panelRef = useRef<HTMLDivElement>(null)

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const addNotification = useCallback(
    (partial: Omit<Notification, 'id' | 'read' | 'timestamp'>) => {
      const notif: Notification = {
        ...partial,
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        read: false,
        timestamp: Date.now(),
      }
      if (soundEnabled) SOUNDS[notif.category]()
      if (desktopEnabled) showDesktopNotification(notif.title, notif.body)
      setNotifications(prev => [notif, ...prev].slice(0, maxItems))
    },
    [soundEnabled, desktopEnabled, maxItems]
  )

  // ── Connect & subscribe ───────────────────────────────────────────────────────

  useEffect(() => {
    const client = getRealtimeClient()
    client.connect()

    const unsubConn = client.onConnectionChange(s => setConnectionState(s.state))

    const unsubWorkflow = client.on('workflow_status', (ev: WorkflowStatusEvent) => {
      if (ev.status !== 'success' && ev.status !== 'failed') return
      const isFailure = ev.status === 'failed'
      addNotification({
        category: 'workflow',
        title: isFailure
          ? `Workflow failed: ${ev.workflowName}`
          : `Workflow completed: ${ev.workflowName}`,
        body: isFailure
          ? ev.errorMessage ?? 'An error occurred during execution.'
          : `Run ${ev.runId} finished successfully.`,
        actionHref: `/workflows/${ev.workflowId}/runs/${ev.runId}`,
        actionLabel: 'View run',
      })
    })

    const unsubAgent = client.on('agent_health', (ev: AgentHealthEvent) => {
      if (ev.currentStatus !== 'error' && ev.currentStatus !== 'blocked') return
      addNotification({
        category: 'agent',
        title: `Agent ${ev.currentStatus === 'error' ? 'error' : 'blocked'}: ${ev.agentName}`,
        body: ev.currentTask
          ? `Current task: ${ev.currentTask}`
          : `Agent transitioned from ${ev.previousStatus} → ${ev.currentStatus}.`,
        actionHref: `/agents`,
        actionLabel: 'View agents',
      })
    })

    const unsubApproval = client.on('approval_request', (ev: ApprovalRequestEvent) => {
      addNotification({
        category: 'approval',
        title: `Approval needed: ${ev.nodeLabel}`,
        body: `Workflow "${ev.workflowName}" is waiting for your approval.${ev.expiresAt ? ` Expires ${new Date(ev.expiresAt).toLocaleTimeString()}.` : ''}`,
        actionHref: `/workflows/${ev.workflowId}/runs/${ev.runId}`,
        actionLabel: 'Review',
      })
    })

    return () => {
      unsubConn()
      unsubWorkflow()
      unsubAgent()
      unsubApproval()
    }
  }, [addNotification])

  // ── Close on outside click ────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ── Derived ───────────────────────────────────────────────────────────────────

  const unread = notifications.filter(n => !n.read).length
  const approvalCount = notifications.filter(n => n.category === 'approval' && !n.read).length

  const visible =
    filter === 'all' ? notifications : notifications.filter(n => n.category === filter)

  const markRead = (id: string) =>
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)))
  const dismiss = (id: string) =>
    setNotifications(prev => prev.filter(n => n.id !== id))
  const clearAll = () => setNotifications([])
  const markAllRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'relative flex items-center justify-center w-9 h-9 rounded-lg transition',
          'hover:bg-accent text-foreground',
          open && 'bg-accent'
        )}
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {/* Bell icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge */}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}

        {/* Amber pulse for pending approvals */}
        {approvalCount > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse border-2 border-background" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-11 w-80 rounded-xl border border-border bg-background shadow-xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <span className="text-xs bg-red-100 text-red-700 font-medium px-1.5 rounded-full">
                  {unread} new
                </span>
              )}
            </div>
            <ConnectionDot state={connectionState} />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 px-3 pt-2 pb-1 border-b border-border/50">
            {(['all', 'approval', 'workflow', 'agent'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md transition capitalize',
                  filter === f
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                {f === 'all'
                  ? `All (${notifications.length})`
                  : f === 'approval'
                  ? `Approvals${approvalCount > 0 ? ` (${approvalCount})` : ''}`
                  : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-80 p-2 space-y-1.5">
            {visible.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <p className="text-2xl mb-2">◈</p>
                <p>No notifications</p>
              </div>
            ) : (
              visible.map(n => (
                <NotifRow
                  key={n.id}
                  notif={n}
                  onRead={markRead}
                  onDismiss={dismiss}
                />
              ))
            )}
          </div>

          {/* Footer actions */}
          {notifications.length > 0 && (
            <div className="flex justify-between items-center px-4 py-2 border-t border-border bg-muted/30">
              <button
                onClick={markAllRead}
                className="text-xs text-muted-foreground hover:text-foreground transition"
              >
                Mark all read
              </button>
              <button
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-red-500 transition"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
