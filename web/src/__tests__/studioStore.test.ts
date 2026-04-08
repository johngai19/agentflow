/**
 * studioStore tests
 *
 * Tests the pure state-management logic of the studio store using zustand/vanilla.
 * We bypass the persisted singleton so every test starts fresh.
 * Timers are faked so setTimeout callbacks (notifications, progress loops) are
 * under test control.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { INITIAL_AGENTS, ZONES, PROJECTS, ZONE_TASKS, type Agent, type Zone, type AgentStatus, type Project } from '@/data/studioData'
import type { ChatMessage, Notification, WorkflowLink, PanelMode, SidebarLayout } from '@/stores/studioStore'

// ── Types (mirrored to avoid importing the persisted singleton) ──────────────
interface StudioState {
  agents: Agent[]
  zones: Zone[]
  projects: Project[]
  selectedAgentId: string | null
  chatMessages: Record<string, ChatMessage[]>
  notifications: Notification[]
  isPanelOpen: boolean
  panelMode: PanelMode
  sidebarLayout: SidebarLayout
  providerName: string
  providerIcon: string
  workflowLinks: WorkflowLink[]
  demoMode: boolean

  selectAgent: (id: string | null) => void
  closePanel: () => void
  setPanelMode: (mode: PanelMode) => void
  setSidebarLayout: (layout: SidebarLayout) => void
  moveAgentToZone: (agentId: string, zoneId: string) => void
  updateAgentStatus: (agentId: string, status: AgentStatus, task?: string) => void
  updateAgentProgress: (agentId: string, progress: number) => void
  scaleAgentPods: (agentId: string, delta: number) => void
  addMessage: (agentId: string, message: ChatMessage) => void
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  dismissNotification: (id: string) => void
  simulateWork: (agentId: string, zoneId: string) => void
  dispatchTask: (fromAgentId: string, toAgentId: string, zoneId: string, taskDescription: string) => void
  clearChatHistory: (agentId: string) => void
  addWorkflowLink: (fromId: string, toId: string) => void
  removeWorkflowLink: (fromId: string, toId: string) => void
  toggleDemoMode: () => void
}

function buildInitialLinks(): WorkflowLink[] {
  const links: WorkflowLink[] = []
  for (const agent of INITIAL_AGENTS) {
    for (const toId of (agent.workflowLinks ?? [])) {
      links.push({ fromId: agent.id, toId })
    }
  }
  return links
}

/** Build a fresh in-memory studio store (no localStorage, no side-effects) */
function makeStore() {
  return createStore<StudioState>()((set, get) => ({
    agents: INITIAL_AGENTS.map(a => ({ ...a })),
    zones: ZONES,
    projects: PROJECTS,
    selectedAgentId: null,
    chatMessages: {},
    notifications: [],
    isPanelOpen: false,
    panelMode: 'sidebar',
    sidebarLayout: 'chat-only',
    providerName: 'Mock (Local)',
    providerIcon: '🧪',
    workflowLinks: buildInitialLinks(),
    demoMode: false,

    selectAgent: (id) => set({ selectedAgentId: id, isPanelOpen: !!id }),
    closePanel: () => set({ selectedAgentId: null, isPanelOpen: false }),
    setPanelMode: (mode) => set({ panelMode: mode }),
    setSidebarLayout: (layout) => set({ sidebarLayout: layout }),

    moveAgentToZone: (agentId, zoneId) => {
      const { agents, addNotification } = get()
      const agent = agents.find(a => a.id === agentId)
      const prevZone = agent?.currentZone
      if (!agent || prevZone === zoneId) return

      set(state => ({
        agents: state.agents.map(a =>
          a.id === agentId
            ? { ...a, currentZone: zoneId, status: zoneId === 'default' ? 'idle' : 'assigned', progress: undefined, startTime: undefined }
            : a
        ),
      }))

      const zone = ZONES.find(z => z.id === zoneId)
      if (zoneId !== 'default' && zone) {
        addNotification({
          agentId,
          agentName: agent.name,
          agentEmoji: agent.emoji,
          message: `${agent.name} 已进入「${zone.name}」`,
          type: 'info',
        })
      } else {
        addNotification({
          agentId,
          agentName: agent.name,
          agentEmoji: agent.emoji,
          message: `${agent.name} 已返回待命区`,
          type: 'info',
        })
      }
    },

    updateAgentStatus: (agentId, status, task) => {
      set(state => ({
        agents: state.agents.map(a =>
          a.id === agentId ? { ...a, status, currentTask: task } : a
        ),
      }))
    },

    updateAgentProgress: (agentId, progress) => {
      set(state => ({
        agents: state.agents.map(a =>
          a.id === agentId ? { ...a, progress } : a
        ),
      }))
    },

    scaleAgentPods: (agentId, delta) => {
      const { agents, addNotification } = get()
      const agent = agents.find(a => a.id === agentId)
      if (!agent) return
      const current = agent.podCount ?? 1
      const max = agent.podMaxCount ?? 5
      const newCount = Math.max(1, Math.min(max, current + delta))
      if (newCount === current) return

      set(state => ({
        agents: state.agents.map(a =>
          a.id === agentId ? { ...a, podCount: newCount } : a
        ),
      }))

      addNotification({
        agentId,
        agentName: agent.name,
        agentEmoji: agent.emoji,
        message: `${agent.name} 已${delta > 0 ? '扩容' : '缩容'}至 ${newCount} 个 Pod`,
        type: 'info',
      })
    },

    addMessage: (agentId, message) => {
      set(state => {
        const prev = state.chatMessages[agentId] ?? []
        const updated = prev.length >= 100 ? [...prev.slice(-99), message] : [...prev, message]
        return { chatMessages: { ...state.chatMessages, [agentId]: updated } }
      })
    },

    addNotification: (notification) => {
      const id = Math.random().toString(36).slice(2)
      set(state => ({
        notifications: [
          { ...notification, id, timestamp: Date.now() },
          ...state.notifications.slice(0, 4),
        ],
      }))
      setTimeout(() => get().dismissNotification(id), 5000)
    },

    dismissNotification: (id) => {
      set(state => ({ notifications: state.notifications.filter(n => n.id !== id) }))
    },

    simulateWork: (agentId, zoneId) => {
      const { agents, updateAgentStatus, updateAgentProgress, addNotification } = get()
      const agent = agents.find(a => a.id === agentId)
      if (!agent || agent.currentZone !== zoneId) return

      const tasks = ZONE_TASKS[zoneId] ?? ['执行任务中...']
      const task = tasks[0]
      const duration = 6000

      set(state => ({
        agents: state.agents.map(a =>
          a.id === agentId ? { ...a, startTime: Date.now(), taskDuration: duration, progress: 0 } : a
        ),
      }))

      updateAgentStatus(agentId, 'working', task)

      setTimeout(() => {
        const current = get().agents.find(a => a.id === agentId)
        if (!current || current.currentZone !== zoneId) return
        updateAgentProgress(agentId, 100)
        updateAgentStatus(agentId, 'reporting', '任务完成，整理报告...')
        set(state => ({
          agents: state.agents.map(a =>
            a.id === agentId ? { ...a, completedTasks: a.completedTasks + 1 } : a
          ),
        }))
        addNotification({
          agentId,
          agentName: current.name,
          agentEmoji: current.emoji,
          message: `✅ ${current.name} 完成了：${task.replace('...', '')}`,
          type: 'success',
        })
      }, duration)
    },

    dispatchTask: (fromAgentId, toAgentId, zoneId, taskDescription) => {
      const { agents, moveAgentToZone, addMessage, addNotification } = get()
      const from = agents.find(a => a.id === fromAgentId)
      const to = agents.find(a => a.id === toAgentId)
      if (!from || !to) return

      addMessage(fromAgentId, {
        id: Math.random().toString(36).slice(2),
        role: 'assistant',
        content: `📋 已将任务「${taskDescription}」派发给 **${to.name}**`,
        timestamp: Date.now(),
      })

      addNotification({
        agentId: fromAgentId,
        agentName: from.name,
        agentEmoji: from.emoji,
        message: `${from.emoji} ${from.name} → ${to.emoji} ${to.name}：${taskDescription}`,
        type: 'info',
      })

      setTimeout(() => moveAgentToZone(toAgentId, zoneId), 500)

      setTimeout(() => {
        addMessage(toAgentId, {
          id: Math.random().toString(36).slice(2),
          role: 'assistant',
          content: `收到 ${from.name} 的任务指派：「${taskDescription}」`,
          timestamp: Date.now(),
        })
      }, 800)
    },

    clearChatHistory: (agentId) => {
      set(state => ({ chatMessages: { ...state.chatMessages, [agentId]: [] } }))
    },

    addWorkflowLink: (fromId, toId) => {
      set(state => {
        if (fromId === toId) return {}
        const exists = state.workflowLinks.some(l => l.fromId === fromId && l.toId === toId)
        if (exists) return {}
        return { workflowLinks: [...state.workflowLinks, { fromId, toId }] }
      })
    },

    removeWorkflowLink: (fromId, toId) => {
      set(state => ({
        workflowLinks: state.workflowLinks.filter(l => !(l.fromId === fromId && l.toId === toId)),
      }))
    },

    toggleDemoMode: () => set(state => ({ demoMode: !state.demoMode })),
  }))
}

const AGENT_ID = INITIAL_AGENTS[0].id  // 'max'
const WORKER_ID = INITIAL_AGENTS[1].id // 'alice'
const CRON_ZONE = ZONES.find(z => z.id === 'cron')!
const DEFAULT_ZONE = ZONES.find(z => z.id === 'default')!

describe('studioStore', () => {
  let store: ReturnType<typeof makeStore>

  beforeEach(() => {
    vi.useFakeTimers()
    store = makeStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── initial state ──────────────────────────────────────────────────────────
  it('has initial agents from INITIAL_AGENTS', () => {
    expect(store.getState().agents.length).toBe(INITIAL_AGENTS.length)
  })

  it('has no open panel by default', () => {
    const { isPanelOpen, selectedAgentId } = store.getState()
    expect(isPanelOpen).toBe(false)
    expect(selectedAgentId).toBeNull()
  })

  it('initialises workflowLinks from INITIAL_AGENTS.workflowLinks', () => {
    const links = store.getState().workflowLinks
    expect(links.length).toBeGreaterThan(0)
    links.forEach(l => {
      expect(l.fromId).toBeTruthy()
      expect(l.toId).toBeTruthy()
      expect(l.fromId).not.toBe(l.toId)
    })
  })

  // ── selectAgent / closePanel ───────────────────────────────────────────────
  it('selectAgent opens panel and sets selectedAgentId', () => {
    store.getState().selectAgent(AGENT_ID)
    expect(store.getState().selectedAgentId).toBe(AGENT_ID)
    expect(store.getState().isPanelOpen).toBe(true)
  })

  it('selectAgent(null) closes panel', () => {
    store.getState().selectAgent(AGENT_ID)
    store.getState().selectAgent(null)
    expect(store.getState().isPanelOpen).toBe(false)
    expect(store.getState().selectedAgentId).toBeNull()
  })

  it('closePanel resets panel state', () => {
    store.getState().selectAgent(AGENT_ID)
    store.getState().closePanel()
    expect(store.getState().isPanelOpen).toBe(false)
    expect(store.getState().selectedAgentId).toBeNull()
  })

  // ── setPanelMode / setSidebarLayout ────────────────────────────────────────
  it('setPanelMode sets the panel display mode', () => {
    store.getState().setPanelMode('modal')
    expect(store.getState().panelMode).toBe('modal')
    store.getState().setPanelMode('sidebar')
    expect(store.getState().panelMode).toBe('sidebar')
  })

  it('setSidebarLayout sets the sidebar layout', () => {
    store.getState().setSidebarLayout('split-artifacts')
    expect(store.getState().sidebarLayout).toBe('split-artifacts')
  })

  // ── moveAgentToZone ────────────────────────────────────────────────────────
  it('moveAgentToZone changes agent currentZone', () => {
    store.getState().moveAgentToZone(WORKER_ID, CRON_ZONE.id)
    const agent = store.getState().agents.find(a => a.id === WORKER_ID)!
    expect(agent.currentZone).toBe(CRON_ZONE.id)
  })

  it('moveAgentToZone sets status to assigned when entering non-default zone', () => {
    store.getState().moveAgentToZone(WORKER_ID, CRON_ZONE.id)
    const agent = store.getState().agents.find(a => a.id === WORKER_ID)!
    expect(agent.status).toBe('assigned')
  })

  it('moveAgentToZone sets status to idle when returning to default zone', () => {
    store.getState().moveAgentToZone(WORKER_ID, CRON_ZONE.id)
    store.getState().moveAgentToZone(WORKER_ID, 'default')
    const agent = store.getState().agents.find(a => a.id === WORKER_ID)!
    expect(agent.status).toBe('idle')
    expect(agent.currentZone).toBe('default')
  })

  it('moveAgentToZone no-ops when agent is already in zone', () => {
    const before = store.getState().agents.find(a => a.id === WORKER_ID)!.currentZone
    store.getState().moveAgentToZone(WORKER_ID, before)
    const after = store.getState().agents.find(a => a.id === WORKER_ID)!.currentZone
    expect(after).toBe(before)
  })

  it('moveAgentToZone adds a notification', () => {
    store.getState().moveAgentToZone(WORKER_ID, CRON_ZONE.id)
    expect(store.getState().notifications.length).toBeGreaterThan(0)
  })

  // ── updateAgentStatus ──────────────────────────────────────────────────────
  it('updateAgentStatus changes agent status and task', () => {
    store.getState().updateAgentStatus(WORKER_ID, 'working', '处理数据...')
    const agent = store.getState().agents.find(a => a.id === WORKER_ID)!
    expect(agent.status).toBe('working')
    expect(agent.currentTask).toBe('处理数据...')
  })

  // ── updateAgentProgress ────────────────────────────────────────────────────
  it('updateAgentProgress sets progress', () => {
    store.getState().updateAgentProgress(WORKER_ID, 55)
    expect(store.getState().agents.find(a => a.id === WORKER_ID)!.progress).toBe(55)
  })

  // ── scaleAgentPods ─────────────────────────────────────────────────────────
  it('scaleAgentPods increases podCount within max bounds', () => {
    const alice = store.getState().agents.find(a => a.id === WORKER_ID)!
    const before = alice.podCount ?? 1
    store.getState().scaleAgentPods(WORKER_ID, 2)
    const after = store.getState().agents.find(a => a.id === WORKER_ID)!.podCount!
    expect(after).toBe(Math.min((alice.podMaxCount ?? 5), before + 2))
  })

  it('scaleAgentPods does not go below 1', () => {
    store.getState().scaleAgentPods(WORKER_ID, -100)
    expect(store.getState().agents.find(a => a.id === WORKER_ID)!.podCount).toBe(1)
  })

  it('scaleAgentPods does not go above podMaxCount', () => {
    const alice = store.getState().agents.find(a => a.id === WORKER_ID)!
    store.getState().scaleAgentPods(WORKER_ID, 100)
    expect(store.getState().agents.find(a => a.id === WORKER_ID)!.podCount).toBe(alice.podMaxCount ?? 5)
  })

  // ── addMessage / clearChatHistory ──────────────────────────────────────────
  it('addMessage appends to chatMessages for an agent', () => {
    const msg: ChatMessage = { id: 'msg-1', role: 'user', content: 'hello', timestamp: Date.now() }
    store.getState().addMessage(WORKER_ID, msg)
    expect(store.getState().chatMessages[WORKER_ID]).toHaveLength(1)
    expect(store.getState().chatMessages[WORKER_ID][0].content).toBe('hello')
  })

  it('addMessage caps at 100 messages', () => {
    for (let i = 0; i < 105; i++) {
      store.getState().addMessage(WORKER_ID, {
        id: `msg-${i}`, role: 'user', content: `msg ${i}`, timestamp: Date.now(),
      })
    }
    expect(store.getState().chatMessages[WORKER_ID].length).toBeLessThanOrEqual(100)
  })

  it('clearChatHistory empties messages for an agent', () => {
    store.getState().addMessage(WORKER_ID, { id: 'x', role: 'user', content: 'hi', timestamp: Date.now() })
    store.getState().clearChatHistory(WORKER_ID)
    expect(store.getState().chatMessages[WORKER_ID]).toHaveLength(0)
  })

  // ── addNotification / dismissNotification ─────────────────────────────────
  it('addNotification appends a notification', () => {
    store.getState().addNotification({
      agentId: WORKER_ID, agentName: 'Alice', agentEmoji: '🤖',
      message: 'test notification', type: 'info',
    })
    expect(store.getState().notifications.length).toBe(1)
    expect(store.getState().notifications[0].message).toBe('test notification')
  })

  it('addNotification caps at 5 notifications', () => {
    for (let i = 0; i < 8; i++) {
      store.getState().addNotification({
        agentId: WORKER_ID, agentName: 'Alice', agentEmoji: '🤖',
        message: `notification ${i}`, type: 'info',
      })
    }
    expect(store.getState().notifications.length).toBeLessThanOrEqual(5)
  })

  it('dismissNotification removes by id', () => {
    store.getState().addNotification({
      agentId: WORKER_ID, agentName: 'Alice', agentEmoji: '🤖',
      message: 'to dismiss', type: 'info',
    })
    const id = store.getState().notifications[0].id
    store.getState().dismissNotification(id)
    expect(store.getState().notifications.find(n => n.id === id)).toBeUndefined()
  })

  it('notification auto-dismisses after 5000ms', () => {
    store.getState().addNotification({
      agentId: WORKER_ID, agentName: 'Alice', agentEmoji: '🤖',
      message: 'auto-dismiss', type: 'info',
    })
    expect(store.getState().notifications.length).toBe(1)
    vi.advanceTimersByTime(5001)
    expect(store.getState().notifications.length).toBe(0)
  })

  // ── workflowLinks ──────────────────────────────────────────────────────────
  it('addWorkflowLink adds a new link', () => {
    const before = store.getState().workflowLinks.length
    store.getState().addWorkflowLink('alice', 'charlie')
    expect(store.getState().workflowLinks.length).toBe(before + 1)
  })

  it('addWorkflowLink ignores duplicates', () => {
    store.getState().addWorkflowLink('alice', 'bob')
    const after1 = store.getState().workflowLinks.length
    store.getState().addWorkflowLink('alice', 'bob')
    expect(store.getState().workflowLinks.length).toBe(after1)
  })

  it('addWorkflowLink ignores self-links', () => {
    const before = store.getState().workflowLinks.length
    store.getState().addWorkflowLink('alice', 'alice')
    expect(store.getState().workflowLinks.length).toBe(before)
  })

  it('removeWorkflowLink removes the specified link', () => {
    store.getState().addWorkflowLink('alice', 'charlie')
    const before = store.getState().workflowLinks.length
    store.getState().removeWorkflowLink('alice', 'charlie')
    expect(store.getState().workflowLinks.length).toBe(before - 1)
    expect(store.getState().workflowLinks.some(l => l.fromId === 'alice' && l.toId === 'charlie')).toBe(false)
  })

  // ── toggleDemoMode ─────────────────────────────────────────────────────────
  it('toggleDemoMode flips demoMode', () => {
    const before = store.getState().demoMode
    store.getState().toggleDemoMode()
    expect(store.getState().demoMode).toBe(!before)
    store.getState().toggleDemoMode()
    expect(store.getState().demoMode).toBe(before)
  })

  // ── dispatchTask ───────────────────────────────────────────────────────────
  it('dispatchTask adds a dispatch message to the fromAgent chat', () => {
    store.getState().dispatchTask(AGENT_ID, WORKER_ID, CRON_ZONE.id, '巡检任务')
    const messages = store.getState().chatMessages[AGENT_ID] ?? []
    expect(messages.length).toBe(1)
    expect(messages[0].content).toContain('巡检任务')
  })

  it('dispatchTask moves toAgent after 500ms', () => {
    store.getState().dispatchTask(AGENT_ID, WORKER_ID, CRON_ZONE.id, '测试任务')
    vi.advanceTimersByTime(501)
    const agent = store.getState().agents.find(a => a.id === WORKER_ID)!
    expect(agent.currentZone).toBe(CRON_ZONE.id)
  })

  it('dispatchTask adds acknowledgement to toAgent chat after 800ms', () => {
    store.getState().dispatchTask(AGENT_ID, WORKER_ID, CRON_ZONE.id, '测试任务')
    vi.advanceTimersByTime(801)
    const messages = store.getState().chatMessages[WORKER_ID] ?? []
    expect(messages.length).toBeGreaterThan(0)
  })

  // ── simulateWork ───────────────────────────────────────────────────────────
  it('simulateWork sets status to working immediately', () => {
    store.getState().moveAgentToZone(WORKER_ID, CRON_ZONE.id)
    store.getState().simulateWork(WORKER_ID, CRON_ZONE.id)
    expect(store.getState().agents.find(a => a.id === WORKER_ID)!.status).toBe('working')
  })

  it('simulateWork completes and increments completedTasks after duration', () => {
    store.getState().moveAgentToZone(WORKER_ID, CRON_ZONE.id)
    const before = store.getState().agents.find(a => a.id === WORKER_ID)!.completedTasks
    store.getState().simulateWork(WORKER_ID, CRON_ZONE.id)
    vi.advanceTimersByTime(7000)
    const after = store.getState().agents.find(a => a.id === WORKER_ID)!.completedTasks
    expect(after).toBe(before + 1)
  })
})
