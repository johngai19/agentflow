"use client"

import { Agent, STATUS_CONFIG } from '@/types/agent'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

const TYPE_INITIALS: Record<string, string> = {
  builder: 'BD',
  reviewer: 'RV',
  researcher: 'RS',
  ops: 'OP',
  pm: 'PM',
}

export function AgentCard({ agent }: { agent: Agent }) {
  const statusConfig = STATUS_CONFIG[agent.status]
  const progress = agent.tasksTotal > 0
    ? Math.round((agent.tasksCompleted / agent.tasksTotal) * 100)
    : 0

  return (
    <Link href={`/projects/${agent.projectId}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="text-xs font-bold">
                  {TYPE_INITIALS[agent.type] || 'AG'}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-base">{agent.name}</CardTitle>
                <CardDescription className="text-xs">{agent.project}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusConfig.dotClass} ${agent.status === 'running' ? 'animate-pulse' : ''}`} />
              <span className={`text-xs font-medium ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {agent.currentTask && (
            <p className="text-sm text-muted-foreground truncate">
              {agent.currentTask}
            </p>
          )}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
          <p className="text-xs text-muted-foreground">
            {agent.lastAction}
          </p>
        </CardContent>
        <CardFooter className="justify-between text-xs text-muted-foreground">
          <div className="flex gap-3">
            <span>{agent.metrics.commits} commits</span>
            <span>{agent.metrics.tests} tests</span>
            <span>{agent.metrics.fixes} fixes</span>
          </div>
          <span>{formatTimeAgo(agent.lastActionTime)}</span>
        </CardFooter>
      </Card>
    </Link>
  )
}
