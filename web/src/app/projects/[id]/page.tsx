"use client"

import { use } from 'react'
import Link from 'next/link'
import { getProjectById, getAgentsByProject } from '@/data/mock-agents'
import { STATUS_CONFIG } from '@/types/agent'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function formatTime(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const project = getProjectById(id)
  const agents = getAgentsByProject(id)

  if (!project) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold">Project not found</h1>
        <Button asChild className="mt-4">
          <Link href="/projects">Back to Projects</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant={project.progress === 100 ? 'default' : 'secondary'}>
              {project.progress}%
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">{project.description}</p>
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            {project.repo}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/projects">All Projects</Link>
        </Button>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Overall Progress</span>
            <span>{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-3" />
        </CardContent>
      </Card>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agents ({agents.length})</CardTitle>
          <CardDescription>AI agents assigned to this project</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Task</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Commits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => {
                const sc = STATUS_CONFIG[agent.status]
                const pct = agent.tasksTotal > 0
                  ? Math.round((agent.tasksCompleted / agent.tasksTotal) * 100)
                  : 0
                return (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell className="capitalize">{agent.type}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${sc.dotClass}`} />
                        <span className={`text-sm ${sc.color}`}>{sc.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {agent.currentTask || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="w-16" />
                        <span className="text-xs">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{agent.metrics.commits}</TableCell>
                  </TableRow>
                )
              })}
              {agents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No agents assigned to this project.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest actions from project agents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {agents
              .sort((a, b) => b.lastActionTime.getTime() - a.lastActionTime.getTime())
              .map((agent) => (
                <div key={agent.id} className="flex items-start gap-3">
                  <div className="mt-1">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_CONFIG[agent.status].dotClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{agent.name}</span>
                      {' '}{agent.lastAction}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(agent.lastActionTime)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Metrics Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Metrics</CardTitle>
          <CardDescription>Charts and analytics (coming soon)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            {agents.map((agent) => (
              <div key={agent.id} className="space-y-1">
                <p className="text-sm font-medium">{agent.name}</p>
                <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                  <span>{agent.metrics.commits} commits</span>
                  <span>{agent.metrics.tests} tests</span>
                  <span>{agent.metrics.fixes} fixes</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
