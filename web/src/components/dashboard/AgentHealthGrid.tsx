"use client"

// ─── AgentHealthGrid ──────────────────────────────────────────────────────────
// Compact grid of agent health cards sourced from agentStore.

import Link from 'next/link'
import useAgentStore from '@/stores/agentStore'
import { STATUS_CONFIG, TYPE_CONFIG } from '@/types/agent'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

export function AgentHealthGrid() {
  const agents   = useAgentStore(s => s.agents)
  const getStats = useAgentStore(s => s.getStats)
  const stats    = getStats()

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {[
          { key: 'total',     label: '全部',   value: stats.total,     color: 'text-foreground' },
          { key: 'running',   label: '运行中', value: stats.running,   color: 'text-green-600 dark:text-green-400' },
          { key: 'idle',      label: '空闲',   value: stats.idle,      color: 'text-yellow-600 dark:text-yellow-400' },
          { key: 'error',     label: '错误',   value: stats.error,     color: 'text-red-600 dark:text-red-400' },
          { key: 'blocked',   label: '阻塞',   value: stats.blocked,   color: 'text-orange-600 dark:text-orange-400' },
        ].map(s => (
          <div key={s.key} className="rounded-lg border bg-card px-3 py-2 text-center">
            <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {agents.map(agent => {
          const statusCfg = STATUS_CONFIG[agent.status]
          const typeCfg   = TYPE_CONFIG[agent.type]
          const progress  = agent.tasksTotal > 0
            ? Math.round((agent.tasksCompleted / agent.tasksTotal) * 100)
            : 0

          return (
            <div
              key={agent.id}
              className={cn(
                'rounded-lg border bg-card p-3 flex flex-col gap-2 transition-shadow hover:shadow-sm',
                agent.status === 'error'   ? 'border-red-500/30' :
                agent.status === 'blocked' ? 'border-orange-500/30' :
                agent.status === 'running' ? 'border-green-500/20' : ''
              )}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusCfg.dotClass)} />
                    <span className="text-sm font-semibold truncate">{agent.name}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <span>{typeCfg.emoji}</span>
                    <span>{typeCfg.label}</span>
                    <span>·</span>
                    <span className="truncate">{agent.project}</span>
                  </div>
                </div>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-medium', statusCfg.color, 'bg-current/10')}>
                  {statusCfg.label}
                </span>
              </div>

              {/* Current task */}
              {agent.currentTask && (
                <p className="text-[11px] text-muted-foreground truncate border rounded px-2 py-1 bg-muted/30">
                  {agent.currentTask}
                </p>
              )}
              {!agent.currentTask && (
                <p className="text-[11px] text-muted-foreground italic">
                  {agent.lastAction}
                </p>
              )}

              {/* Progress */}
              <div className="space-y-1">
                <Progress value={progress} className="h-1.5" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{agent.tasksCompleted}/{agent.tasksTotal} 任务</span>
                  <span>{progress}%</span>
                </div>
              </div>

              {/* Metrics */}
              <div className="flex gap-3 text-[10px] text-muted-foreground border-t pt-2">
                <span>commits {agent.metrics.commits}</span>
                <span>tests {agent.metrics.tests}</span>
                <span>fixes {agent.metrics.fixes}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="text-right">
        <Link href="/agents" className="text-xs text-muted-foreground hover:text-foreground underline">
          查看全部 Agent →
        </Link>
      </div>
    </div>
  )
}
