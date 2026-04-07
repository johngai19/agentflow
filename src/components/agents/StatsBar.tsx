"use client"

import useAgentStore from '@/stores/agentStore'
import { Card, CardContent } from '@/components/ui/card'

// Simulated 7-day trend data for each stat
const TRENDS: Record<string, number[]> = {
  'Total Agents':  [6, 7, 7, 8, 9, 10, 10],
  'Running':       [3, 4, 3, 5, 4, 4, 4],
  'Idle':          [1, 1, 2, 1, 2, 2, 2],
  'Completed':     [0, 0, 1, 1, 1, 1, 1],
  'Blocked':       [1, 1, 0, 1, 1, 1, 1],
  'Errors':        [0, 0, 1, 0, 0, 1, 1],
}

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-[3px] h-8 mt-2">
      {data.map((value, i) => (
        <div
          key={i}
          className={`w-[4px] rounded-sm ${color} opacity-60 transition-all`}
          style={{ height: `${Math.max((value / max) * 100, 8)}%` }}
        />
      ))}
    </div>
  )
}

export function StatsBar() {
  const stats = useAgentStore((s) => s.getStats())

  const items = [
    { label: 'Total Agents', value: stats.total, color: 'text-foreground', barColor: 'bg-foreground/70' },
    { label: 'Running', value: stats.running, color: 'text-green-600 dark:text-green-400', barColor: 'bg-green-500' },
    { label: 'Idle', value: stats.idle, color: 'text-yellow-600 dark:text-yellow-400', barColor: 'bg-yellow-500' },
    { label: 'Completed', value: stats.completed, color: 'text-blue-600 dark:text-blue-400', barColor: 'bg-blue-500' },
    { label: 'Blocked', value: stats.blocked, color: 'text-orange-600 dark:text-orange-400', barColor: 'bg-orange-500' },
    { label: 'Errors', value: stats.error, color: 'text-red-600 dark:text-red-400', barColor: 'bg-red-500' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="pt-4 pb-4 text-center">
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            <div className="flex justify-center">
              <MiniChart data={TRENDS[item.label] || []} color={item.barColor} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
