import { create } from 'zustand'
import { Agent, AgentStatus } from '@/types/agent'
import { mockAgents } from '@/data/mock-agents'

interface AgentStoreState {
  agents: Agent[]
  filter: AgentStatus | 'all'
  setFilter: (filter: AgentStatus | 'all') => void
  getFilteredAgents: () => Agent[]
  getAgentsByProject: (projectId: string) => Agent[]
  getStats: () => {
    total: number
    running: number
    idle: number
    completed: number
    error: number
    blocked: number
  }
}

const useAgentStore = create<AgentStoreState>()((set, get) => ({
  agents: mockAgents,
  filter: 'all',
  setFilter: (filter) => set({ filter }),
  getFilteredAgents: () => {
    const { agents, filter } = get()
    if (filter === 'all') return agents
    return agents.filter((a) => a.status === filter)
  },
  getAgentsByProject: (projectId) => {
    return get().agents.filter((a) => a.projectId === projectId)
  },
  getStats: () => {
    const agents = get().agents
    return {
      total: agents.length,
      running: agents.filter((a) => a.status === 'running').length,
      idle: agents.filter((a) => a.status === 'idle').length,
      completed: agents.filter((a) => a.status === 'completed').length,
      error: agents.filter((a) => a.status === 'error').length,
      blocked: agents.filter((a) => a.status === 'blocked').length,
    }
  },
}))

export default useAgentStore
