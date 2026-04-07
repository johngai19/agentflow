"use client"

import { use } from 'react'
import Link from 'next/link'
import { useStudioStore } from '@/stores/studioStore'
import { STATUS_CONFIG } from '@/data/studioData'
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

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const projects = useStudioStore(s => s.projects)
  const allAgents = useStudioStore(s => s.agents)
  const zones = useStudioStore(s => s.zones)
  const chatMessages = useStudioStore(s => s.chatMessages)

  const project = projects.find(p => p.id === id)
  const agents = allAgents.filter(a => project?.agentIds.includes(a.id))

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

  const workingCount = agents.filter(a => a.status === 'working').length
  const totalCompleted = agents.reduce((sum, a) => sum + a.completedTasks, 0)
  const totalMessages = agents.reduce((sum, a) => sum + (chatMessages[a.id]?.length ?? 0), 0)
  const resources = project.sharedResources

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{project.icon}</span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              <p className="text-muted-foreground mt-1">{project.description}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/studio">Open Studio</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/projects">All Projects</Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Agents', value: agents.length },
          { label: 'Working', value: workingCount },
          { label: 'Tasks Done', value: totalCompleted },
          { label: 'Chat Messages', value: totalMessages },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold" style={{ color: project.color }}>{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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
                <TableHead>Role</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Task</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Tasks Done</TableHead>
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
                    <TableCell className="max-w-[180px] truncate text-muted-foreground text-sm">
                      {agent.currentTask || '—'}
                    </TableCell>
                    <TableCell>
                      {(agent.status === 'working' || agent.status === 'reporting') ? (
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
              {agents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No agents assigned to this project.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Shared Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Shared Resources</CardTitle>
          <CardDescription>Memory, files, skills and MCP servers shared between agents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {resources.memory && resources.memory.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">🧠 Memory Keys</p>
                <div className="flex flex-wrap gap-1.5">
                  {resources.memory.map(m => (
                    <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-mono">{m}</span>
                  ))}
                </div>
              </div>
            )}
            {resources.files && resources.files.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">📁 Shared Files</p>
                <div className="flex flex-wrap gap-1.5">
                  {resources.files.map(f => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono">{f}</span>
                  ))}
                </div>
              </div>
            )}
            {resources.skills && resources.skills.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">⚡ Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {resources.skills.map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {resources.mcpServers && resources.mcpServers.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">🔌 MCP Servers</p>
                <div className="flex flex-wrap gap-1.5">
                  {resources.mcpServers.map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Chat Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Agent Activity</CardTitle>
          <CardDescription>Latest messages from project agents ({totalMessages} total)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {agents.flatMap(agent =>
              (chatMessages[agent.id] ?? []).slice(-3).map(msg => ({
                agent,
                msg,
              }))
            )
              .sort((a, b) => b.msg.timestamp - a.msg.timestamp)
              .slice(0, 8)
              .map(({ agent, msg }) => (
                <div key={msg.id} className="flex items-start gap-3">
                  <span className="text-lg">{agent.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold">{agent.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.role === 'user' && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1">user</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{msg.content.slice(0, 120)}</p>
                  </div>
                </div>
              ))}
            {totalMessages === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">
                No messages yet. Open Studio and assign agents to zones to see activity here.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
