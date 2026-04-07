import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { INITIAL_AGENTS, ZONES, ZONE_TASKS, PROJECTS, type Agent, type Zone, type AgentStatus, type Project } from '@/data/studioData'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  rawTranscript?: string // original voice before correction
}

export interface WorkflowLink {
  fromId: string
  toId: string
}

// ─── localStorage guard ────────────────────────────────────────────────────
// createJSONStorage wraps getItem/setItem/removeItem with JSON serialization.
// We pass a custom storage object that catches QuotaExceededError silently.
const safeStorage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try { return localStorage.getItem(name) } catch { return null }
  },
  setItem: (name: string, value: string) => {
    try { localStorage.setItem(name, value) } catch (e) {
      console.warn('[studioStore] localStorage write failed (quota?)', e)
    }
  },
  removeItem: (name: string) => {
    try { localStorage.removeItem(name) } catch { /* ignore */ }
  },
}))

/** Build the initial workflowLinks list from INITIAL_AGENTS.workflowLinks */
function buildInitialLinks(): WorkflowLink[] {
  const links: WorkflowLink[] = []
  for (const agent of INITIAL_AGENTS) {
    for (const toId of (agent.workflowLinks ?? [])) {
      links.push({ fromId: agent.id, toId })
    }
  }
  return links
}

export interface Notification {
  id: string
  agentId: string
  agentName: string
  agentEmoji: string
  message: string
  type: 'success' | 'info' | 'warning' | 'error'
  timestamp: number
}

// Panel display mode: sidebar (ChatGPT-style) or modal popup
export type PanelMode = 'sidebar' | 'modal'
// Whether to show artifacts pane in sidebar
export type SidebarLayout = 'chat-only' | 'split-artifacts'

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
  // Provider info (for display)
  providerName: string
  providerIcon: string
  // User-editable workflow connections (source of truth for WorkflowEdges)
  workflowLinks: WorkflowLink[]

  // Actions
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
  /** Orchestrator dispatches a named task to an agent, moving them to a zone */
  dispatchTask: (fromAgentId: string, toAgentId: string, zoneId: string, taskDescription: string) => void
  clearChatHistory: (agentId: string) => void
  /** Workflow link editor actions */
  addWorkflowLink: (fromId: string, toId: string) => void
  removeWorkflowLink: (fromId: string, toId: string) => void
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
  agents: INITIAL_AGENTS,
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

  selectAgent: (id) => set({ selectedAgentId: id, isPanelOpen: !!id }),
  closePanel: () => set({ selectedAgentId: null, isPanelOpen: false }),
  setPanelMode: (mode) => set({ panelMode: mode }),
  setSidebarLayout: (layout) => set({ sidebarLayout: layout }),

  moveAgentToZone: (agentId, zoneId) => {
    const { agents, addNotification, simulateWork } = get()
    const agent = agents.find(a => a.id === agentId)
    const prevZone = agent?.currentZone
    if (!agent || prevZone === zoneId) return

    set(state => ({
      agents: state.agents.map(a =>
        a.id === agentId
          ? { ...a, currentZone: zoneId, status: zoneId === 'default' ? 'idle' : 'assigned', progress: undefined, startTime: undefined }
          : a
      )
    }))

    const zone = ZONES.find(z => z.id === zoneId)
    if (zoneId !== 'default' && zone) {
      addNotification({
        agentId,
        agentName: agent.name,
        agentEmoji: agent.emoji,
        message: `${agent.name} 已进入「${zone.name}」，准备开始工作`,
        type: 'info',
      })
      setTimeout(() => simulateWork(agentId, zoneId), 1500)
    } else {
      addNotification({
        agentId,
        agentName: agent.name,
        agentEmoji: agent.emoji,
        message: `${agent.name} 已返回待命区休息`,
        type: 'info',
      })
    }
  },

  updateAgentStatus: (agentId, status, task) => {
    set(state => ({
      agents: state.agents.map(a =>
        a.id === agentId ? { ...a, status, currentTask: task } : a
      )
    }))
  },

  updateAgentProgress: (agentId, progress) => {
    set(state => ({
      agents: state.agents.map(a =>
        a.id === agentId ? { ...a, progress } : a
      )
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
      )
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
      // Keep only the latest 100 messages in-memory (persisted slice is capped to 20)
      const updated = prev.length >= 100 ? [...prev.slice(-99), message] : [...prev, message]
      return {
        chatMessages: {
          ...state.chatMessages,
          [agentId]: updated,
        }
      }
    })
  },

  addNotification: (notification) => {
    const id = Math.random().toString(36).slice(2)
    set(state => ({
      notifications: [
        { ...notification, id, timestamp: Date.now() },
        ...state.notifications.slice(0, 4),
      ]
    }))
    setTimeout(() => get().dismissNotification(id), 5000)
  },

  dismissNotification: (id) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }))
  },

  simulateWork: (agentId, zoneId) => {
    const { agents, updateAgentStatus, updateAgentProgress, addNotification } = get()
    const agent = agents.find(a => a.id === agentId)
    if (!agent || agent.currentZone !== zoneId) return

    const tasks = ZONE_TASKS[zoneId] ?? ['执行任务中...']
    const task = tasks[Math.floor(Math.random() * tasks.length)]
    const duration = 6000 + Math.random() * 6000

    // Mark task start time
    set(state => ({
      agents: state.agents.map(a =>
        a.id === agentId ? { ...a, startTime: Date.now(), taskDuration: duration, progress: 0 } : a
      )
    }))

    updateAgentStatus(agentId, 'working', task)

    // Progress update loop — tick every 500ms
    const tickInterval = 500
    const ticks = Math.floor(duration / tickInterval)
    let tick = 0
    const progressTimer = setInterval(() => {
      tick++
      const progress = Math.min(95, Math.round((tick / ticks) * 100))
      updateAgentProgress(agentId, progress)

      // Check if agent still in this zone
      const current = get().agents.find(a => a.id === agentId)
      if (!current || current.currentZone !== zoneId) clearInterval(progressTimer)
    }, tickInterval)

    // Complete
    setTimeout(() => {
      clearInterval(progressTimer)
      const current = get().agents.find(a => a.id === agentId)
      if (!current || current.currentZone !== zoneId) return

      updateAgentProgress(agentId, 100)
      updateAgentStatus(agentId, 'reporting', '任务完成，整理报告...')

      set(state => ({
        agents: state.agents.map(a =>
          a.id === agentId ? { ...a, completedTasks: a.completedTasks + 1 } : a
        )
      }))

      addNotification({
        agentId,
        agentName: current.name,
        agentEmoji: current.emoji,
        message: `✅ ${current.name} 完成了：${task.replace('...', '')}`,
        type: 'success',
      })

      setTimeout(() => {
        const c = get().agents.find(a => a.id === agentId)
        if (c?.currentZone === zoneId) {
          updateAgentStatus(agentId, 'assigned', '等待下一轮任务...')
          set(state => ({
            agents: state.agents.map(a =>
              a.id === agentId ? { ...a, progress: undefined, startTime: undefined } : a
            )
          }))
          if (zoneId === 'cron') {
            setTimeout(() => get().simulateWork(agentId, zoneId), 8000)
          }
        }
      }, 3000)
    }, duration)
  },

  dispatchTask: (fromAgentId, toAgentId, zoneId, taskDescription) => {
    const { agents, moveAgentToZone, addMessage, addNotification } = get()
    const from = agents.find(a => a.id === fromAgentId)
    const to = agents.find(a => a.id === toAgentId)
    if (!from || !to) return

    // Orchestrator sends an in-chat dispatch message
    addMessage(fromAgentId, {
      id: Math.random().toString(36).slice(2),
      role: 'assistant',
      content: `📋 已将任务「${taskDescription}」派发给 **${to.name}**（${to.role}），请前往「${ZONES.find(z => z.id === zoneId)?.name ?? zoneId}」区域执行。`,
      timestamp: Date.now(),
    })

    // Move target agent and start work
    addNotification({
      agentId: fromAgentId,
      agentName: from.name,
      agentEmoji: from.emoji,
      message: `${from.emoji} ${from.name} → ${to.emoji} ${to.name}：${taskDescription}`,
      type: 'info',
    })

    setTimeout(() => moveAgentToZone(toAgentId, zoneId), 500)

    // Target agent posts acknowledgement in their own chat
    setTimeout(() => {
      addMessage(toAgentId, {
        id: Math.random().toString(36).slice(2),
        role: 'assistant',
        content: `收到 ${from.name} 的任务指派：「${taskDescription}」，正在前往工作区域…`,
        timestamp: Date.now(),
      })
    }, 800)
  },

  clearChatHistory: (agentId) => {
    set(state => ({
      chatMessages: { ...state.chatMessages, [agentId]: [] }
    }))
  },

  addWorkflowLink: (fromId, toId) => {
    set(state => {
      // Prevent duplicates and self-links
      if (fromId === toId) return {}
      const exists = state.workflowLinks.some(l => l.fromId === fromId && l.toId === toId)
      if (exists) return {}
      return { workflowLinks: [...state.workflowLinks, { fromId, toId }] }
    })
  },

  removeWorkflowLink: (fromId, toId) => {
    set(state => ({
      workflowLinks: state.workflowLinks.filter(l => !(l.fromId === fromId && l.toId === toId))
    }))
  },
    }),
    {
      name: 'agent-studio-state',
      storage: safeStorage,
      // Only persist chat history, zone assignments, pod counts, panel mode, workflow links
      partialize: (state) => ({
        // Cap each agent's chat history to the most recent 20 messages to stay within
        // the ~5 MB localStorage quota even after long conversations.
        chatMessages: Object.fromEntries(
          Object.entries(state.chatMessages).map(([id, msgs]) => [id, msgs.slice(-20)])
        ),
        panelMode: state.panelMode,
        sidebarLayout: state.sidebarLayout,
        workflowLinks: state.workflowLinks,
        agents: state.agents.map(a => ({
          ...a,
          // Reset volatile runtime state on restore
          status: a.currentZone === 'default' ? 'idle' : a.status,
          progress: undefined,
          startTime: undefined,
          currentTask: a.currentZone === 'default' ? undefined : a.currentTask,
        })),
      }),
    }
  )
)
