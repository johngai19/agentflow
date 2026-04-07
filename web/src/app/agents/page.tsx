"use client"

import useAgentStore from '@/stores/agentStore'
import { STATUS_CONFIG } from '@/types/agent'
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
import Link from 'next/link'

export default function AgentsPage() {
  const agents = useAgentStore((s) => s.agents)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">All Agents</h1>
        <p className="text-muted-foreground mt-1">
          Full list of AI agents across all projects
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Task</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Commits</TableHead>
                <TableHead className="text-right">Tests</TableHead>
                <TableHead className="text-right">Fixes</TableHead>
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
                    <TableCell>
                      <Link
                        href={`/projects/${agent.projectId}`}
                        className="text-sm underline-offset-4 hover:underline"
                      >
                        {agent.project}
                      </Link>
                    </TableCell>
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
                    <TableCell className="text-right">{agent.metrics.tests}</TableCell>
                    <TableCell className="text-right">{agent.metrics.fixes}</TableCell>
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
