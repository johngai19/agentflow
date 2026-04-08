"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useOrchestrationStore } from '@/stores/orchestrationStore'
import { getRunsByOrchId, successRate, formatDuration } from '@/data/orchestrationData'
import type { RunStatus } from '@/data/orchestrationData'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const STATUS_DOT: Record<RunStatus, string> = {
  success:   'bg-green-500',
  failed:    'bg-red-500',
  running:   'bg-blue-500 animate-pulse',
  cancelled: 'bg-gray-400',
  pending:   'bg-yellow-400',
}

const TRIGGER_LABEL: Record<string, string> = {
  cron: '⏰ Cron',
  manual: '👆 手动',
  webhook: '🔗 Webhook',
  event: '📡 Event',
  chain: '🔗 Chain',
}

function MiniTimeline({ orchId }: { orchId: string }) {
  const allRuns = useOrchestrationStore(s => s.runs)
  const runs = allRuns
    .filter(r => r.orchestrationId === orchId)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 10)
  return (
    <div className="flex gap-0.5 items-end h-6">
      {runs.reverse().map(r => (
        <div
          key={r.id}
          title={`${r.status} — ${new Date(r.startedAt).toLocaleString('zh-CN')}`}
          className={`w-3 rounded-sm flex-shrink-0 ${
            r.status === 'success'   ? 'bg-green-500 h-full' :
            r.status === 'failed'    ? 'bg-red-500 h-full' :
            r.status === 'running'   ? 'bg-blue-500 h-4 animate-pulse' :
            r.status === 'cancelled' ? 'bg-gray-400 h-3' : 'bg-yellow-400 h-2'
          }`}
        />
      ))}
      {runs.length === 0 && (
        <span className="text-[10px] text-muted-foreground">尚无运行记录</span>
      )}
    </div>
  )
}

export default function OrchestrationsPage() {
  const orchestrations = useOrchestrationStore(s => s.orchestrations)
  const runs = useOrchestrationStore(s => s.runs)
  const toggleEnabled = useOrchestrationStore(s => s.toggleEnabled)
  const triggerRun = useOrchestrationStore(s => s.triggerRun)
  const [triggering, setTriggering] = useState<string | null>(null)

  async function handleTrigger(orchId: string) {
    setTriggering(orchId)
    triggerRun(orchId, 'manual')
    setTimeout(() => setTriggering(null), 1500)
  }

  const activeRuns = runs.filter(r => r.status === 'running')

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">编排管理</h1>
          <p className="text-muted-foreground mt-1">
            自动化工作流 — {orchestrations.length} 个编排，{activeRuns.length} 个运行中
          </p>
        </div>
        <Link href="/orchestrations/new">
          <Button className="gap-2">+ 新建编排</Button>
        </Link>
      </div>

      {/* Active runs banner */}
      {activeRuns.length > 0 && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
            {activeRuns.length} 个编排正在运行中
          </span>
          <div className="flex gap-2 ml-auto">
            {activeRuns.slice(0, 3).map(r => {
              const o = orchestrations.find(x => x.id === r.orchestrationId)
              return (
                <Link key={r.id} href={`/orchestrations/${r.orchestrationId}/runs/${r.id}`}>
                  <Badge variant="outline" className="text-xs border-blue-500/40 text-blue-500 cursor-pointer hover:bg-blue-500/10">
                    {o?.icon} {o?.name}
                  </Badge>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Orchestration list */}
      <div className="space-y-3">
        {orchestrations.map(orch => {
          const orchRuns = getRunsByOrchId(orch.id)
          const lastRun = orchRuns[0]
          const rate = successRate(orchRuns)
          const isRunning = orchRuns.some(r => r.status === 'running')

          return (
            <Card key={orch.id} className={`transition-all hover:shadow-md ${!orch.enabled ? 'opacity-50' : ''}`}>
              <CardContent className="p-0">
                <div className="flex items-center gap-0">
                  {/* Color stripe */}
                  <div className={`w-1 self-stretch rounded-l-lg flex-shrink-0 ${
                    isRunning ? 'bg-blue-500' :
                    lastRun?.status === 'failed' ? 'bg-red-500' : 'bg-green-500'
                  }`} />

                  <div className="flex-1 px-5 py-4 flex items-center gap-4">
                    {/* Icon + name */}
                    <div className="flex-shrink-0 text-2xl">{orch.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/orchestrations/${orch.id}`} className="font-semibold hover:underline">
                          {orch.name}
                        </Link>
                        {!orch.enabled && <Badge variant="outline" className="text-[10px]">已禁用</Badge>}
                        {isRunning && (
                          <Badge className="text-[10px] bg-blue-500 text-white border-0 gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block" />
                            运行中
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{orch.projectId}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{orch.description}</p>
                    </div>

                    {/* Triggers */}
                    <div className="hidden md:flex gap-1 flex-wrap flex-shrink-0">
                      {orch.triggers.map((t, i) => (
                        <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {TRIGGER_LABEL[t.type]}
                          {t.schedule && ` ${t.schedule}`}
                        </span>
                      ))}
                    </div>

                    {/* Mini timeline */}
                    <div className="hidden lg:block flex-shrink-0 w-24">
                      <MiniTimeline orchId={orch.id} />
                    </div>

                    {/* Last run */}
                    <div className="hidden md:block flex-shrink-0 text-right min-w-[100px]">
                      {lastRun ? (
                        <>
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[lastRun.status]}`} />
                            <span className="text-xs">
                              {lastRun.finishedAt
                                ? formatDuration(lastRun.finishedAt - lastRun.startedAt)
                                : '运行中...'}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {Math.round((Date.now() - lastRun.startedAt) / 60000)}分钟前
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">未运行</span>
                      )}
                    </div>

                    {/* Success rate */}
                    <div className="hidden xl:block flex-shrink-0 text-center min-w-[50px]">
                      <div className={`text-sm font-bold ${rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {orchRuns.length > 0 ? `${rate}%` : '—'}
                      </div>
                      <div className="text-[10px] text-muted-foreground">成功率</div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={!orch.enabled || triggering === orch.id || isRunning}
                        onClick={() => handleTrigger(orch.id)}
                      >
                        {triggering === orch.id ? '触发中...' : '▶ 运行'}
                      </Button>
                      <Link href={`/orchestrations/${orch.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs">详情</Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => toggleEnabled(orch.id)}
                      >
                        {orch.enabled ? '⏸' : '▶'}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
