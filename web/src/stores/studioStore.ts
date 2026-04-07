import { create } from 'zustand'
import { INITIAL_AGENTS, ZONES, ZONE_TASKS, type Agent, type Zone, type AgentStatus } from '@/data/studioData'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  rawTranscript?: string // original voice before correction
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

interface StudioState {
  agents: Agent[]
  zones: Zone[]
  selectedAgentId: string | null
  chatMessages: Record<string, ChatMessage[]>
  notifications: Notification[]
  isPanelOpen: boolean

  // Actions
  selectAgent: (id: string | null) => void
  closePanel: () => void
  moveAgentToZone: (agentId: string, zoneId: string) => void
  updateAgentStatus: (agentId: string, status: AgentStatus, task?: string) => void
  addMessage: (agentId: string, message: ChatMessage) => void
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  dismissNotification: (id: string) => void
  simulateWork: (agentId: string, zoneId: string) => void
}

export const useStudioStore = create<StudioState>((set, get) => ({
  agents: INITIAL_AGENTS,
  zones: ZONES,
  selectedAgentId: null,
  chatMessages: {},
  notifications: [],
  isPanelOpen: false,

  selectAgent: (id) => set({ selectedAgentId: id, isPanelOpen: !!id }),
  closePanel: () => set({ selectedAgentId: null, isPanelOpen: false }),

  moveAgentToZone: (agentId, zoneId) => {
    const { agents, addNotification, simulateWork } = get()
    const agent = agents.find(a => a.id === agentId)
    const prevZone = agent?.currentZone
    if (!agent || prevZone === zoneId) return

    set(state => ({
      agents: state.agents.map(a =>
        a.id === agentId ? { ...a, currentZone: zoneId, status: zoneId === 'default' ? 'idle' : 'assigned' } : a
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
      // Start simulated work after a short delay
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

  addMessage: (agentId, message) => {
    set(state => ({
      chatMessages: {
        ...state.chatMessages,
        [agentId]: [...(state.chatMessages[agentId] ?? []), message],
      }
    }))
  },

  addNotification: (notification) => {
    const id = Math.random().toString(36).slice(2)
    set(state => ({
      notifications: [
        { ...notification, id, timestamp: Date.now() },
        ...state.notifications.slice(0, 4), // keep max 5
      ]
    }))
    // Auto dismiss after 5s
    setTimeout(() => get().dismissNotification(id), 5000)
  },

  dismissNotification: (id) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }))
  },

  simulateWork: (agentId, zoneId) => {
    const { agents, updateAgentStatus, addNotification } = get()
    const agent = agents.find(a => a.id === agentId)
    if (!agent || agent.currentZone !== zoneId) return

    const tasks = ZONE_TASKS[zoneId] ?? ['执行任务中...']
    const task = tasks[Math.floor(Math.random() * tasks.length)]

    // Working phase
    updateAgentStatus(agentId, 'working', task)

    // Complete after 6-12 seconds
    const duration = 6000 + Math.random() * 6000
    setTimeout(() => {
      const current = get().agents.find(a => a.id === agentId)
      if (!current || current.currentZone !== zoneId) return

      // Reporting phase
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

      // Back to assigned after reporting
      setTimeout(() => {
        const c = get().agents.find(a => a.id === agentId)
        if (c?.currentZone === zoneId) {
          updateAgentStatus(agentId, 'assigned', '等待下一轮任务...')
          // Loop for cron zone
          if (zoneId === 'cron') {
            setTimeout(() => get().simulateWork(agentId, zoneId), 8000)
          }
        }
      }, 3000)
    }, duration)
  },
}))
