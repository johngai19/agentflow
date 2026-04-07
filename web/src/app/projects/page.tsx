"use client"

import Link from 'next/link'
import { useStudioStore } from '@/stores/studioStore'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function ProjectsPage() {
  const projects = useStudioStore(s => s.projects)
  const agents = useStudioStore(s => s.agents)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground mt-1">
          All active projects with AI agent support
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((project) => {
          const projectAgents = agents.filter(a => project.agentIds.includes(a.id))
          const workingCount = projectAgents.filter(a => a.status === 'working').length
          const completedTasks = projectAgents.reduce((sum, a) => sum + a.completedTasks, 0)
          const resources = project.sharedResources

          return (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{project.icon}</span>
                      <CardTitle className="text-base">{project.name}</CardTitle>
                    </div>
                    <Badge
                      variant={workingCount > 0 ? 'default' : 'secondary'}
                      style={workingCount > 0 ? { background: project.color } : {}}
                    >
                      {workingCount > 0 ? `${workingCount} active` : 'idle'}
                    </Badge>
                  </div>
                  <CardDescription>{project.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{projectAgents.length} agent{projectAgents.length !== 1 ? 's' : ''}</span>
                    <span>{completedTasks} tasks done</span>
                  </div>

                  {/* Agent emoji row */}
                  <div className="flex gap-1 flex-wrap">
                    {projectAgents.map(a => (
                      <span
                        key={a.id}
                        title={`${a.name} — ${a.status}`}
                        className={`text-lg transition-all ${a.status === 'working' ? 'animate-bounce' : ''}`}
                      >
                        {a.emoji}
                      </span>
                    ))}
                  </div>

                  {/* Shared resources */}
                  {(resources.mcpServers?.length || resources.skills?.length) && (
                    <div className="flex gap-1 flex-wrap">
                      {resources.mcpServers?.map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                          MCP:{s.replace('-mcp', '')}
                        </span>
                      ))}
                      {resources.skills?.slice(0, 3).map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
