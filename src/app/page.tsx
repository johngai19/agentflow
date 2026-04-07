"use client"

import { StatsBar } from '@/components/agents/StatsBar'
import { AgentGrid } from '@/components/agents/AgentGrid'

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent Town</h1>
        <p className="text-muted-foreground mt-1">
          Central dashboard for all AI agents across your projects
        </p>
      </div>
      <StatsBar />
      <AgentGrid />
    </div>
  )
}
