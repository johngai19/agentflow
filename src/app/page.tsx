"use client"

import { StatsBar } from '@/components/agents/StatsBar'
import { AgentGrid } from '@/components/agents/AgentGrid'
import { ActivityFeed } from '@/components/agents/ActivityFeed'

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
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2">
          <AgentGrid />
        </div>
        <div>
          <ActivityFeed limit={12} />
        </div>
      </div>
    </div>
  )
}
