"use client"

import useAgentStore from '@/stores/agentStore'
import { Card, CardContent } from '@/components/ui/card'

export function StatsBar() {
  const stats = useAgentStore((s) => s.getStats())

  const items = [
    { label: 'Total Agents', value: stats.total, color: 'text-foreground' },
    { label: 'Running', value: stats.running, color: 'text-green-600' },
    { label: 'Idle', value: stats.idle, color: 'text-yellow-600' },
    { label: 'Completed', value: stats.completed, color: 'text-blue-600' },
    { label: 'Blocked', value: stats.blocked, color: 'text-orange-600' },
    { label: 'Errors', value: stats.error, color: 'text-red-600' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="pt-4 pb-4 text-center">
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
