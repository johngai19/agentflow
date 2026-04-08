"use client"

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useOrchestrationStore } from '@/stores/orchestrationStore'
import { formatDuration } from '@/data/orchestrationData'
import type { RunStatus, StepStatus } from '@/data/orchestrationData'
import OrchestrationDAG from '@/components/orchestration/OrchestrationDAG'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { INITIAL_AGENTS } from '@/data/studioData'

const STEP_STATUS_CONFIG: Record<StepStatus, { label: string; icon: string; color: string; bg: string }> = {
  waiting:  { label: '等待中', icon: '⏳', color: 'text-slate-500',   bg: 'bg-slate-100 dark:bg-slate-800' },
  running:  { label: '运行中', icon: '🔄', color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-950/50' },
  success:  { label: '完成',   icon: '✅', color: 'text-green-600',   bg: 'bg-green-50 dark:bg-green-950/50' },
  failed:   { label: '失败',   icon: '❌', color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-950/50' },
  skipped:  { label: '跳过',   icon: '⏭',  color: 'text-gray-500',    bg: 'bg-gray-50 dark:bg-gray-900' },
}

const RUN_STATUS_CONFIG: Record<RunStatus, { label: string; color: string; badge: string }> = {
  success:   { label: '成功',   color: 'text-green-600', badge: 'bg-green-500 text-white' },
  failed:    { label: '失败',   color: 'text-red-600',   badge: 'bg-red-500 text-white' },
  running:   { label: '运行中', color: 'text-blue-600',  badge: 'bg-blue-500 text-white' },
  cancelled: { label: '已取消', color: 'text-gray-500',  badge: 'bg-gray-400 text-white' },
  pending:   { label: '等待中', color: 'text-yellow-600',badge: 'bg-yellow-400 text-white' },
}

function Elapsed({ startedAt, finishedAt }: { startedAt: number; finishedAt?: number }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (finishedAt) { setElapsed(finishedAt - startedAt); return }
    setElapsed(Date.now() - startedAt)
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 1000)
    return () => clearInterval(t)
  }, [startedAt, finishedAt])
  return <>{formatDuration(elapsed)}</>
}

export default function RunDetailPage({ params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = use(params)
  const orchestration = useOrchestrationStore(s => s.orchestrations.find(o => o.id === id))
  const run = useOrchestrationStore(s => s.runs.find(r => r.id === runId))
  const cancelRun = useOrchestrationStore(s => s.cancelRun)

  if (!orchestration || !run) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold">执行记录不存在</h1>
        <Button asChild className="mt-4"><Link href={`/orchestrations/${id}`}>返回</Link></Button>
      </div>
    )
  }

  const rs = RUN_STATUS_CONFIG[run.status]
  const isRunning = run.status === 'running'
  const completedSteps = run.stepRuns.filter(s => s.status === 'success').length
  const totalTokens = run.stepRuns.reduce((s, sr) => s + (sr.tokensUsed ?? 0), 0)

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb + header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/orchestrations" className="hover:underline">编排</Link>
            <span>/</span>
            <Link href={`/orchestrations/${id}`} className="hover:underline">{orchestration.icon} {orchestration.name}</Link>
            <span>/</span>
            <span>#{run.id.slice(-6)}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold">执行详情</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rs.badge} ${isRunning ? 'animate-pulse' : ''}`}>
              {isRunning && '⟳ '}{rs.label}
            </span>
          </div>
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
            <span>触发: {run.trigger === 'manual' ? '👆 手动' : run.trigger === 'cron' ? '⏰ 定时' : '🔗 Webhook'}</span>
            <span>开始: {new Date(run.startedAt).toLocaleString('zh-CN')}</span>
            <span>耗时: <Elapsed startedAt={run.startedAt} finishedAt={run.finishedAt} /></span>
            {totalTokens > 0 && <span>Token: {(totalTokens/1000).toFixed(1)}K</span>}
          </div>
        </div>
        {isRunning && (
          <Button variant="destructive" size="sm" onClick={() => cancelRun(runId)}>⏹ 取消运行</Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{completedSteps}/{orchestration.steps.length} 步骤完成</span>
          <span>{Math.round((completedSteps / orchestration.steps.length) * 100)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              run.status === 'failed' ? 'bg-red-500' :
              run.status === 'success' ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${(completedSteps / orchestration.steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* DAG visualization */}
      <OrchestrationDAG orchestration={orchestration} run={run} height={280} />

      {/* Steps detail — GitHub Actions style */}
      <div className="space-y-2">
        {orchestration.steps.map((step, idx) => {
          const stepRun = run.stepRuns.find(sr => sr.stepId === step.id)
          const status: StepStatus = stepRun?.status ?? 'waiting'
          const sc = STEP_STATUS_CONFIG[status]
          const agent = INITIAL_AGENTS.find(a => a.id === step.agentId)

          return (
            <div key={step.id} className={`rounded-xl border transition-all ${sc.bg} ${status === 'running' ? 'border-blue-300 dark:border-blue-700' : 'border-border'}`}>
              {/* Step header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg flex-shrink-0">
                  {status === 'running' ? (
                    <span className="inline-block animate-spin">🔄</span>
                  ) : sc.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{step.name}</span>
                    <span className={`text-xs font-medium ${sc.color}`}>{sc.label}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex gap-2 flex-wrap">
                    <span>{agent?.emoji} {agent?.name ?? step.agentId}</span>
                    <span>→ {step.zoneId}</span>
                    {stepRun?.toolsUsed?.map(t => (
                      <span key={t} className="px-1 rounded bg-muted">{t}</span>
                    ))}
                  </div>
                </div>

                <div className="flex-shrink-0 text-right">
                  {stepRun?.startedAt && (
                    <div className="text-xs font-mono text-muted-foreground">
                      {stepRun.finishedAt
                        ? formatDuration(stepRun.finishedAt - stepRun.startedAt)
                        : <Elapsed startedAt={stepRun.startedAt} />}
                    </div>
                  )}
                  {stepRun?.tokensUsed && (
                    <div className="text-[10px] text-muted-foreground">{stepRun.tokensUsed} tokens</div>
                  )}
                </div>

                <span className="text-xs text-muted-foreground w-4 text-center flex-shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
              </div>

              {/* Step output / error */}
              {(stepRun?.output || stepRun?.error) && (
                <div className="border-t border-border/50 px-4 py-2">
                  {stepRun.output && (
                    <pre className="text-xs text-green-700 dark:text-green-400 whitespace-pre-wrap font-mono bg-black/10 dark:bg-white/5 rounded p-2">
                      {stepRun.output}
                    </pre>
                  )}
                  {stepRun.error && (
                    <pre className="text-xs text-red-700 dark:text-red-400 whitespace-pre-wrap font-mono bg-red-500/10 rounded p-2">
                      ✗ {stepRun.error}
                    </pre>
                  )}
                </div>
              )}

              {/* Task template */}
              <div className="border-t border-border/20 px-4 py-2 text-[11px] text-muted-foreground">
                {step.taskTemplate}
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary card for completed runs */}
      {!isRunning && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">执行摘要</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {run.stepRuns.filter(s => s.status === 'success').length}
                </div>
                <div className="text-xs text-muted-foreground">步骤成功</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {run.stepRuns.filter(s => s.status === 'failed').length}
                </div>
                <div className="text-xs text-muted-foreground">步骤失败</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {totalTokens > 0 ? `${(totalTokens/1000).toFixed(1)}K` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Total Tokens</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {run.finishedAt ? formatDuration(run.finishedAt - run.startedAt) : '—'}
                </div>
                <div className="text-xs text-muted-foreground">总耗时</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
