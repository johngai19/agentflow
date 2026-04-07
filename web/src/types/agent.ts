export type AgentType = 'builder' | 'reviewer' | 'researcher' | 'ops' | 'pm'

export type AgentStatus = 'running' | 'idle' | 'completed' | 'error' | 'blocked'

export interface Agent {
  id: string
  name: string
  project: string
  projectId: string
  type: AgentType
  status: AgentStatus
  lastAction: string
  lastActionTime: Date
  tasksCompleted: number
  tasksTotal: number
  currentTask?: string
  metrics: {
    commits: number
    tests: number
    fixes: number
  }
}

export interface Project {
  id: string
  name: string
  description: string
  repo: string
  progress: number
  agents: string[] // agent IDs
}

export const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; dotClass: string }> = {
  running:   { label: 'Running',   color: 'text-green-600 dark:text-green-400',  dotClass: 'bg-green-500' },
  idle:      { label: 'Idle',      color: 'text-yellow-600 dark:text-yellow-400', dotClass: 'bg-yellow-500' },
  completed: { label: 'Completed', color: 'text-blue-600 dark:text-blue-400',   dotClass: 'bg-blue-500' },
  error:     { label: 'Error',     color: 'text-red-600 dark:text-red-400',    dotClass: 'bg-red-500' },
  blocked:   { label: 'Blocked',   color: 'text-orange-600 dark:text-orange-400', dotClass: 'bg-orange-500' },
}

export const TYPE_CONFIG: Record<AgentType, { label: string; emoji: string }> = {
  builder:    { label: 'Builder',    emoji: '' },
  reviewer:   { label: 'Reviewer',   emoji: '' },
  researcher: { label: 'Researcher', emoji: '' },
  ops:        { label: 'Ops',        emoji: '' },
  pm:         { label: 'PM',         emoji: '' },
}
