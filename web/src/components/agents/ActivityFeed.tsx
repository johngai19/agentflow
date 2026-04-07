"use client"

import { mockActivity, ActivityType } from '@/data/mock-activity'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  GitCommitHorizontal,
  Rocket,
  TestTube2,
  Eye,
  AlertTriangle,
  Wrench,
  Settings2,
} from 'lucide-react'

const TYPE_CONFIG: Record<ActivityType, { icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  commit:  { icon: <GitCommitHorizontal className="h-3.5 w-3.5" />, variant: 'default' },
  deploy:  { icon: <Rocket className="h-3.5 w-3.5" />,             variant: 'default' },
  test:    { icon: <TestTube2 className="h-3.5 w-3.5" />,          variant: 'secondary' },
  review:  { icon: <Eye className="h-3.5 w-3.5" />,                variant: 'outline' },
  error:   { icon: <AlertTriangle className="h-3.5 w-3.5" />,      variant: 'destructive' },
  fix:     { icon: <Wrench className="h-3.5 w-3.5" />,             variant: 'secondary' },
  config:  { icon: <Settings2 className="h-3.5 w-3.5" />,          variant: 'outline' },
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function ActivityFeed({ limit = 10 }: { limit?: number }) {
  const events = mockActivity.slice(0, limit)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Feed</CardTitle>
        <CardDescription>Real-time actions across all agents</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {events.map((event) => {
            const config = TYPE_CONFIG[event.type]
            return (
              <div
                key={event.id}
                className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0"
              >
                <div className="mt-0.5 shrink-0">
                  <Badge variant={config.variant} className="h-6 w-6 p-0 flex items-center justify-center rounded-full">
                    {config.icon}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{event.agentName}</span>
                    <span className="text-muted-foreground"> in </span>
                    <span className="font-medium">{event.project}</span>
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {event.action}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
                  {formatTime(event.timestamp)}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
