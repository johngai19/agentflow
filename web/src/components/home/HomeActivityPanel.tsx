"use client"

import Link from 'next/link'
import { useStudioStore } from '@/stores/studioStore'
import { useOrchestrationStore } from '@/stores/orchestrationStore'
import { formatDuration } from '@/data/orchestrationData'

export default function HomeActivityPanel() {
  const agents = useStudioStore(s => s.agents)
  const chatMessages = useStudioStore(s => s.chatMessages)
  const orchestrations = useOrchestrationStore(s => s.orchestrations)
  const runs = useOrchestrationStore(s => s.runs)

  const workingAgents = agents.filter(a => a.status === 'working' || a.status === 'reporting')
  const activeRuns = runs.filter(r => r.status === 'running')
  const recentRuns = runs.slice().sort((a, b) => b.startedAt - a.startedAt).slice(0, 5)
  const totalCompleted = agents.reduce((s, a) => s + a.completedTasks, 0)

  if (workingAgents.length === 0 && activeRuns.length === 0 && totalCompleted === 0) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-12">
      {/* Agent live status */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" />
            Agent 动态
          </h3>
          <Link href="/studio" className="text-xs text-muted-foreground hover:text-foreground">Studio →</Link>
        </div>
        <div className="space-y-2">
          {agents.filter(a => a.status !== 'idle').slice(0, 5).map(agent => (
            <div key={agent.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
              <span className="text-xl">{agent.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{agent.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    agent.status === 'working'   ? 'bg-amber-500/20 text-amber-600' :
                    agent.status === 'reporting' ? 'bg-green-500/20 text-green-600' :
                    agent.status === 'assigned'  ? 'bg-blue-500/20 text-blue-600' :
                    'bg-red-500/20 text-red-600'
                  }`}>
                    {agent.status === 'working' ? '工作中' : agent.status === 'reporting' ? '汇报' : agent.status === 'assigned' ? '已分配' : '错误'}
                  </span>
                </div>
                {agent.currentTask && (
                  <p className="text-xs text-muted-foreground truncate">{agent.currentTask}</p>
                )}
              </div>
              {agent.status === 'working' && agent.progress != null && (
                <div className="flex-shrink-0 text-xs text-muted-foreground">{agent.progress}%</div>
              )}
              <div className="text-xs text-muted-foreground flex-shrink-0">✓{agent.completedTasks}</div>
            </div>
          ))}
          {agents.filter(a => a.status !== 'idle').length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              所有 Agent 空闲中 · <Link href="/studio" className="underline">前往 Studio 分配任务</Link>
            </div>
          )}
        </div>
        {/* Mini stats */}
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground border-t pt-3">
          <span>{agents.length} 个 Agent</span>
          <span>{workingAgents.length} 工作中</span>
          <span>✓ {totalCompleted} 任务完成</span>
          <span>{Object.values(chatMessages).flat().length} 条消息</span>
        </div>
      </div>

      {/* Orchestration runs */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            编排执行
          </h3>
          <Link href="/orchestrations" className="text-xs text-muted-foreground hover:text-foreground">全部 →</Link>
        </div>
        <div className="space-y-2">
          {recentRuns.map(run => {
            const orch = orchestrations.find(o => o.id === run.orchestrationId)
            if (!orch) return null
            const completedSteps = run.stepRuns.filter(s => s.status === 'success').length
            return (
              <Link key={run.id} href={`/orchestrations/${run.orchestrationId}/runs/${run.id}`}>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                  <span className="text-lg flex-shrink-0">{orch.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{orch.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        run.status === 'running'  ? 'bg-blue-500/20 text-blue-600' :
                        run.status === 'success'  ? 'bg-green-500/20 text-green-600' :
                        run.status === 'failed'   ? 'bg-red-500/20 text-red-600' :
                        'bg-gray-500/20 text-gray-600'
                      }`}>
                        {run.status === 'running' ? '运行中' : run.status === 'success' ? '成功' : run.status === 'failed' ? '失败' : '取消'}
                      </span>
                    </div>
                    {/* Step mini bar */}
                    <div className="flex gap-0.5 mt-1">
                      {run.stepRuns.map(sr => (
                        <div key={sr.stepId} className={`h-1 flex-1 rounded-full ${
                          sr.status === 'success' ? 'bg-green-500' :
                          sr.status === 'failed'  ? 'bg-red-500' :
                          sr.status === 'running' ? 'bg-blue-500 animate-pulse' :
                          'bg-muted-foreground/20'
                        }`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-muted-foreground">
                      {run.finishedAt ? formatDuration(run.finishedAt - run.startedAt) : '进行中'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {completedSteps}/{run.stepRuns.length}步
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
          {recentRuns.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              暂无执行记录 · <Link href="/orchestrations" className="underline">查看编排</Link>
            </div>
          )}
        </div>
        {/* Stats */}
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground border-t pt-3">
          <span>{orchestrations.length} 个编排</span>
          <span>{activeRuns.length} 运行中</span>
          <span>{runs.filter(r => r.status === 'success').length} 成功</span>
          <span>{runs.filter(r => r.status === 'failed').length} 失败</span>
        </div>
      </div>
    </div>
  )
}
