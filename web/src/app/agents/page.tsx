"use client"

import { useStudioStore } from '@/stores/studioStore'
import { STATUS_CONFIG } from '@/data/studioData'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default function AgentsPage() {
  const agents = useStudioStore((s) => s.agents)
  const zones = useStudioStore((s) => s.zones)

  const totalWorking = agents.filter(a => a.status === 'working').length
  const totalCompleted = agents.reduce((sum, a) => sum + a.completedTasks, 0)

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Agents</h1>
          <p className="text-muted-foreground mt-1">
            Live AI agents from the Studio — {totalWorking} working, {totalCompleted} tasks completed
          </p>
        </div>
        <Link
          href="/studio"
          className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          Open Studio →
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Task</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Pods</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => {
                const sc = STATUS_CONFIG[agent.status]
                const zone = zones.find(z => z.id === agent.currentZone)
                const pct = agent.progress ?? 0
                return (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{agent.emoji}</span>
                        <span>{agent.name}</span>
                        {agent.isOrchestrator && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-amber-400 text-amber-600">
                            总管
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{agent.role}</TableCell>
                    <TableCell>
                      {agent.projectId ? (
                        <Link
                          href={`/projects/${agent.projectId}`}
                          className="text-sm underline-offset-4 hover:underline text-muted-foreground"
                        >
                          {agent.projectId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {zone?.icon} {zone?.name ?? agent.currentZone}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${sc.dot}`} />
                        <span className={`text-sm ${sc.color}`}>{sc.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                      {agent.currentTask || '—'}
                    </TableCell>
                    <TableCell>
                      {agent.status === 'working' || agent.status === 'reporting' ? (
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="w-16" />
                          <span className="text-xs">{pct}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{agent.completedTasks}</TableCell>
                    <TableCell className="text-right text-sm">
                      {agent.podCount ?? 1}{agent.podMaxCount ? `/${agent.podMaxCount}` : ''}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
