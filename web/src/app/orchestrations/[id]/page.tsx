"use client"

import { use, useState } from 'react'
import Link from 'next/link'
import { useOrchestrationStore } from '@/stores/orchestrationStore'
import { formatDuration, successRate } from '@/data/orchestrationData'
import type { RunStatus } from '@/data/orchestrationData'
import OrchestrationDAG from '@/components/orchestration/OrchestrationDAG'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { INITIAL_AGENTS } from '@/data/studioData'
import { useRouter } from 'next/navigation'

const STATUS_COLOR: Record<RunStatus, string> = {
  success:   'text-green-600 dark:text-green-400',
  failed:    'text-red-600 dark:text-red-400',
  running:   'text-blue-600 dark:text-blue-400',
  cancelled: 'text-gray-500',
  pending:   'text-yellow-600',
}
const STATUS_DOT: Record<RunStatus, string> = {
  success:   'bg-green-500',
  failed:    'bg-red-500',
  running:   'bg-blue-500 animate-pulse',
  cancelled: 'bg-gray-400',
  pending:   'bg-yellow-400',
}
const STATUS_LABEL: Record<RunStatus, string> = {
  success: '成功', failed: '失败', running: '运行中', cancelled: '已取消', pending: '等待中',
}
const TRIGGER_LABEL: Record<string, string> = {
  cron: '⏰ Cron', manual: '👆 手动', webhook: '🔗 Webhook', event: '📡 Event', chain: '⛓ Chain',
}

export default function OrchestrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const orchestration = useOrchestrationStore(s => s.orchestrations.find(o => o.id === id))
  const runs = useOrchestrationStore(s => s.runs.filter(r => r.orchestrationId === id).sort((a,b) => b.startedAt - a.startedAt))
  const triggerRun = useOrchestrationStore(s => s.triggerRun)
  const cancelRun = useOrchestrationStore(s => s.cancelRun)
  const toggleEnabled = useOrchestrationStore(s => s.toggleEnabled)
  const [triggering, setTriggering] = useState(false)

  if (!orchestration) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold">编排不存在</h1>
        <Button asChild className="mt-4"><Link href="/orchestrations">返回列表</Link></Button>
      </div>
    )
  }

  const latestRun = runs[0]
  const rate = successRate(runs)
  const totalTokens = runs.flatMap(r => r.stepRuns).reduce((s, sr) => s + (sr.tokensUsed ?? 0), 0)

  async function handleTrigger() {
    setTriggering(true)
    const runId = triggerRun(orchestration!.id, 'manual')
    setTimeout(() => { setTriggering(false); router.push(`/orchestrations/${id}/runs/${runId}`) }, 800)
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="text-4xl mt-1">{orchestration.icon}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{orchestration.name}</h1>
              {!orchestration.enabled && <Badge variant="outline">已禁用</Badge>}
              {latestRun?.status === 'running' && (
                <Badge className="bg-blue-500 text-white border-0 gap-1 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block" />
                  运行中
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1">{orchestration.description}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {orchestration.triggers.map((t, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {TRIGGER_LABEL[t.type]}{t.schedule ? ` ${t.schedule}` : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          <Button variant="outline" onClick={() => toggleEnabled(orchestration.id)}>
            {orchestration.enabled ? '⏸ 禁用' : '▶ 启用'}
          </Button>
          {latestRun?.status === 'running'
            ? <Button variant="destructive" onClick={() => cancelRun(latestRun.id)}>⏹ 取消</Button>
            : <Button onClick={handleTrigger} disabled={!orchestration.enabled || triggering}>
                {triggering ? '触发中...' : '▶ 立即运行'}
              </Button>
          }
          <Button variant="outline" asChild><Link href="/orchestrations">← 返回</Link></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '总运行次数', value: runs.length },
          { label: '成功率', value: `${rate}%` },
          { label: '平均耗时', value: runs.filter(r => r.finishedAt).length > 0
              ? formatDuration(runs.filter(r=>r.finishedAt).reduce((s,r) => s + r.finishedAt! - r.startedAt, 0) / runs.filter(r=>r.finishedAt).length)
              : '—' },
          { label: 'Token 总用量', value: totalTokens > 0 ? `${(totalTokens/1000).toFixed(1)}K` : '—' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* DAG view */}
      <Card>
        <CardHeader>
          <CardTitle>工作流 DAG</CardTitle>
          <CardDescription>
            {orchestration.steps.length} 个步骤，{orchestration.edges.length} 条依赖边
            {latestRun && ` — 上次运行: ${STATUS_LABEL[latestRun.status]}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrchestrationDAG orchestration={orchestration} run={latestRun} />

          {/* Step legend */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {orchestration.steps.map(step => {
              const agent = INITIAL_AGENTS.find(a => a.id === step.agentId)
              const stepRun = latestRun?.stepRuns.find(sr => sr.stepId === step.id)
              return (
                <div key={step.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                  <span className="text-base">{agent?.emoji ?? '🤖'}</span>
                  <div className="min-w-0">
                    <div className="font-medium">{step.name}</div>
                    <div className="text-muted-foreground truncate">{agent?.name} → {step.zoneId}</div>
                    {stepRun?.output && <div className="text-green-600 dark:text-green-400 mt-0.5 truncate">{stepRun.output}</div>}
                    {stepRun?.error && <div className="text-red-600 dark:text-red-400 mt-0.5 truncate">{stepRun.error}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Run history */}
      <Card>
        <CardHeader>
          <CardTitle>执行历史</CardTitle>
          <CardDescription>共 {runs.length} 次执行记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {runs.map((run, idx) => (
              <Link key={run.id} href={`/orchestrations/${id}/runs/${run.id}`}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  {/* Run number */}
                  <span className="text-xs text-muted-foreground w-10 flex-shrink-0">
                    #{runs.length - idx}
                  </span>

                  {/* Status */}
                  <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[run.status]}`} />
                    <span className={`text-xs font-medium ${STATUS_COLOR[run.status]}`}>
                      {STATUS_LABEL[run.status]}
                    </span>
                  </div>

                  {/* Trigger */}
                  <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                    {TRIGGER_LABEL[run.trigger]}
                  </span>

                  {/* Step status mini bar */}
                  <div className="flex gap-0.5 flex-1">
                    {run.stepRuns.map(sr => (
                      <div
                        key={sr.stepId}
                        title={sr.stepId}
                        className={`h-5 flex-1 rounded-sm ${
                          sr.status === 'success'  ? 'bg-green-500' :
                          sr.status === 'failed'   ? 'bg-red-500' :
                          sr.status === 'running'  ? 'bg-blue-500 animate-pulse' :
                          sr.status === 'skipped'  ? 'bg-gray-300 dark:bg-gray-700' :
                          'bg-gray-200 dark:bg-gray-800'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Duration */}
                  <span className="text-xs text-muted-foreground w-16 text-right flex-shrink-0">
                    {run.finishedAt ? formatDuration(run.finishedAt - run.startedAt) : '—'}
                  </span>

                  {/* Time */}
                  <span className="text-xs text-muted-foreground w-20 text-right flex-shrink-0">
                    {Math.round((Date.now() - run.startedAt) / 60000)}min前
                  </span>

                  <span className="text-muted-foreground text-xs">→</span>
                </div>
              </Link>
            ))}
            {runs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                尚无执行记录。点击&ldquo;立即运行&rdquo;触发第一次执行。
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
