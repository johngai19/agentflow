"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrchestrationStore } from '@/stores/orchestrationStore'
import { INITIAL_AGENTS, ZONES } from '@/data/studioData'
import type { Orchestration, OrchestrationStep, Trigger } from '@/data/orchestrationData'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import OrchestrationDAG from '@/components/orchestration/OrchestrationDAG'

const ICONS = ['🚀', '🛡️', '💓', '📊', '🤖', '⚡', '🔍', '🏗️', '📋', '🧹', '💰', '🔐']

export default function NewOrchestrationPage() {
  const router = useRouter()
  const addOrchestration = useOrchestrationStore(s => s.addOrchestration)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('infra-ops')
  const [icon, setIcon] = useState('🚀')
  const [schedule, setSchedule] = useState('')
  const [triggerType, setTriggerType] = useState<'cron' | 'manual' | 'webhook'>('manual')
  const [steps, setSteps] = useState<OrchestrationStep[]>([
    { id: 'step-1', name: '步骤 1', agentId: INITIAL_AGENTS[1].id, zoneId: 'deploy', taskTemplate: '' },
  ])
  const [previewDag, setPreviewDag] = useState(false)

  function addStep() {
    setSteps(prev => [...prev, {
      id: `step-${prev.length + 1}`,
      name: `步骤 ${prev.length + 1}`,
      agentId: INITIAL_AGENTS[1].id,
      zoneId: 'deploy',
      taskTemplate: '',
    }])
  }

  function removeStep(idx: number) {
    setSteps(prev => prev.filter((_, i) => i !== idx))
  }

  function updateStep(idx: number, patch: Partial<OrchestrationStep>) {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  // Build auto sequential edges
  const autoEdges = steps.slice(0, -1).map((s, i) => ({ from: s.id, to: steps[i + 1].id, condition: 'on_success' as const }))

  const previewOrch: Orchestration = {
    id: 'preview',
    name: name || '新编排',
    projectId,
    description,
    icon,
    steps,
    edges: autoEdges,
    triggers: triggerType === 'cron' && schedule
      ? [{ type: 'cron', schedule }]
      : [{ type: triggerType }],
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  function handleSubmit() {
    if (!name.trim() || steps.length === 0) return
    const triggers: Trigger[] = triggerType === 'cron' && schedule
      ? [{ type: 'cron', schedule }, { type: 'manual' }]
      : [{ type: triggerType }]
    const orch: Orchestration = {
      ...previewOrch,
      id: `orch-${Date.now()}`,
      triggers,
    }
    addOrchestration(orch)
    router.push(`/orchestrations/${orch.id}`)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">新建编排</h1>
          <p className="text-muted-foreground text-sm mt-1">定义 Agent 工作流的步骤、依赖和触发条件</p>
        </div>
        <Button variant="outline" asChild><Link href="/orchestrations">← 取消</Link></Button>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle className="text-base">基本信息</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            {/* Icon picker */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">图标</label>
              <div className="flex gap-1 flex-wrap w-36">
                {ICONS.map(ic => (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={`text-xl p-1 rounded hover:bg-muted ${icon === ic ? 'bg-muted ring-2 ring-primary' : ''}`}
                  >{ic}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">编排名称 *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="如：夜间安全巡检"
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">描述</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="这个编排做什么..."
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">所属项目</label>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="infra-ops">基础设施运维</option>
                  <option value="security">安全合规</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trigger */}
      <Card>
        <CardHeader><CardTitle className="text-base">触发方式</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {(['manual', 'cron', 'webhook'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTriggerType(t)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  triggerType === t ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'
                }`}
              >
                {t === 'manual' ? '👆 手动' : t === 'cron' ? '⏰ 定时' : '🔗 Webhook'}
              </button>
            ))}
          </div>
          {triggerType === 'cron' && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Cron 表达式</label>
              <input
                value={schedule}
                onChange={e => setSchedule(e.target.value)}
                placeholder="0 2 * * * （每天凌晨2点）"
                className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {[
                  ['0 * * * *', '每小时'], ['0 2 * * *', '每天02:00'],
                  ['0 9 * * 1', '每周一09:00'], ['*/5 * * * *', '每5分钟'],
                ].map(([expr, label]) => (
                  <button key={expr} onClick={() => setSchedule(expr)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Steps */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">步骤配置</CardTitle>
              <CardDescription className="mt-0.5">步骤按顺序依次执行（可后续在DAG编辑器中配置并行）</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={addStep}>+ 添加步骤</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step, idx) => {
            const agent = INITIAL_AGENTS.find(a => a.id === step.agentId)
            return (
              <div key={step.id} className="border rounded-xl p-4 space-y-3 relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono w-5">{String(idx + 1).padStart(2, '0')}</span>
                    <input
                      value={step.name}
                      onChange={e => updateStep(idx, { name: e.target.value })}
                      className="font-medium text-sm bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                    />
                  </div>
                  {steps.length > 1 && (
                    <button onClick={() => removeStep(idx)} className="text-muted-foreground hover:text-destructive text-xs">✕</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">执行 Agent</label>
                    <select
                      value={step.agentId}
                      onChange={e => updateStep(idx, { agentId: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border rounded-lg bg-background focus:outline-none"
                    >
                      {INITIAL_AGENTS.map(a => (
                        <option key={a.id} value={a.id}>{a.emoji} {a.name} — {a.role}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">工作区 Zone</label>
                    <select
                      value={step.zoneId}
                      onChange={e => updateStep(idx, { zoneId: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border rounded-lg bg-background focus:outline-none"
                    >
                      {ZONES.filter(z => z.id !== 'default').map(z => (
                        <option key={z.id} value={z.id}>{z.icon} {z.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">任务描述（支持 {'{{变量}}'} 引用上一步输出）</label>
                  <textarea
                    value={step.taskTemplate}
                    onChange={e => updateStep(idx, { taskTemplate: e.target.value })}
                    rows={2}
                    placeholder={`${agent?.description?.slice(0, 50) ?? '描述这一步要做什么'}...`}
                    className="w-full px-2 py-1.5 text-xs border rounded-lg bg-background focus:outline-none resize-none font-mono"
                  />
                </div>
                {idx < steps.length - 1 && (
                  <div className="text-xs text-center text-muted-foreground">↓ on_success</div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* DAG Preview */}
      <div>
        <button onClick={() => setPreviewDag(!previewDag)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          {previewDag ? '▾' : '▸'} 预览 DAG
        </button>
        {previewDag && (
          <div className="mt-2">
            <OrchestrationDAG orchestration={previewOrch} height={200} />
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" asChild><Link href="/orchestrations">取消</Link></Button>
        <Button onClick={handleSubmit} disabled={!name.trim()}>创建编排</Button>
      </div>
    </div>
  )
}
