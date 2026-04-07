"use client"

import useAgentStore from '@/stores/agentStore'
import { AgentCard } from './AgentCard'
import { AgentStatus } from '@/types/agent'
import { Button } from '@/components/ui/button'

const FILTER_OPTIONS: { value: AgentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'idle', label: 'Idle' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'error', label: 'Error' },
]

export function AgentGrid() {
  const filter = useAgentStore((s) => s.filter)
  const setFilter = useAgentStore((s) => s.setFilter)
  const agents = useAgentStore((s) => s.getFilteredAgents())

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground mr-1">Filter:</span>
        {FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
      {agents.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No agents match the selected filter.
        </p>
      )}
    </div>
  )
}
