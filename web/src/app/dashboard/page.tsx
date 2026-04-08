"use client"

// ─── System Health Dashboard ───────────────────────────────────────────────────
// Top-level overview: active workflows · agent health · metrics · alerts.

import Link from 'next/link'
import { useWorkflowRunStore } from '@/stores/workflowRunStore'
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore'
import useAgentStore from '@/stores/agentStore'
import { useOrchestrationStore } from '@/stores/orchestrationStore'
import { AgentHealthGrid }    from '@/components/dashboard/AgentHealthGrid'
import { WorkflowMetrics }    from '@/components/dashboard/WorkflowMetrics'
import { ActiveWorkflows }    from '@/components/dashboard/ActiveWorkflows'
import { AlertSummary }       from '@/components/dashboard/AlertSummary'
import { Card, CardContent }  from '@/components/ui/card'
import { Button }             from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  href,
  linkLabel,
  children,
}: {
  title: string
  subtitle?: string
  href?: string
  linkLabel?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {href && linkLabel && (
            <Link href={href}>
              <Button variant="ghost" size="sm" className="text-xs h-7">{linkLabel} →</Button>
            </Link>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const activeRuns   = useWorkflowRunStore(s => s.getActiveRuns())
  const totalRuns    = useWorkflowRunStore(s => s.runs.length)
  const wfCount      = useWorkflowDesignerStore(s => s.workflows.length)
  const agentStats   = useAgentStore(s => s.getStats())
  const orchRuns     = useOrchestrationStore(s => s.runs)
  const orchActive   = orchRuns.filter(r => r.status === 'running').length

  const now = new Date().toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">系统健康大盘</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            数据快照 · {now}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/workflows/runs">
            <Button variant="outline" size="sm">运行记录</Button>
          </Link>
          <Link href="/orchestrations">
            <Button variant="outline" size="sm">编排管理</Button>
          </Link>
        </div>
      </div>

      {/* Top-level KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: 'Agent 总数',
            value: agentStats.total,
            sub: `${agentStats.running} 运行中`,
            color: '',
            href: '/agents',
          },
          {
            label: 'Agent 错误',
            value: agentStats.error,
            sub: `${agentStats.blocked} 阻塞`,
            color: agentStats.error > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
            href: '/agents',
          },
          {
            label: '工作流',
            value: wfCount,
            sub: `${totalRuns} 次运行`,
            color: '',
            href: '/workflows',
          },
          {
            label: '活跃工作流',
            value: activeRuns.length,
            sub: '实时执行中',
            color: activeRuns.length > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground',
            href: '/workflows/runs',
          },
          {
            label: '编排运行',
            value: orchRuns.length,
            sub: `${orchActive} 活跃`,
            color: '',
            href: '/orchestrations',
          },
          {
            label: '系统状态',
            value: agentStats.error === 0 && activeRuns.length >= 0 ? '正常' : '告警',
            sub: agentStats.error > 0 ? `${agentStats.error} 个错误` : '无严重告警',
            color: agentStats.error === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600',
            href: undefined,
          },
        ].map(kpi => (
          <div key={kpi.label}>
            {kpi.href ? (
              <Link href={kpi.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 text-center">
                    <div className={cn('text-2xl font-bold', kpi.color)}>{kpi.value}</div>
                    <div className="text-xs font-medium mt-0.5">{kpi.label}</div>
                    <div className="text-[10px] text-muted-foreground">{kpi.sub}</div>
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <Card>
                <CardContent className="p-4 text-center">
                  <div className={cn('text-2xl font-bold', kpi.color)}>{kpi.value}</div>
                  <div className="text-xs font-medium mt-0.5">{kpi.label}</div>
                  <div className="text-[10px] text-muted-foreground">{kpi.sub}</div>
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>

      {/* Main grid: 2-col on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column (wider) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Active workflows */}
          <Section
            title="活跃工作流"
            subtitle={`${activeRuns.length} 个正在执行`}
            href="/workflows/runs"
            linkLabel="全部记录"
          >
            <ActiveWorkflows />
          </Section>

          {/* Workflow metrics + trend */}
          <Section
            title="工作流执行趋势"
            subtitle="过去 72 小时 · 成功率 / 平均耗时"
            href="/workflows/runs"
            linkLabel="详细记录"
          >
            <WorkflowMetrics />
          </Section>

        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Alert summary */}
          <Section
            title="告警汇总"
            subtitle="Agent 错误 + 工作流失败"
          >
            <AlertSummary />
          </Section>

          {/* Quick links */}
          <Card>
            <CardContent className="p-6 space-y-2">
              <h2 className="text-base font-semibold mb-3">快速入口</h2>
              {[
                { label: 'Agent Studio',   href: '/studio',              icon: '🎮' },
                { label: '工作流设计器',    href: '/workflows/designer',  icon: '✏️' },
                { label: '编排管理',        href: '/orchestrations',      icon: '🔀' },
                { label: '运行记录',        href: '/workflows/runs',      icon: '📋' },
                { label: 'Agent 列表',      href: '/agents',              icon: '🤖' },
                { label: '项目列表',        href: '/projects',            icon: '📁' },
              ].map(item => (
                <Link key={item.href} href={item.href}>
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm">
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                    <span className="ml-auto text-muted-foreground text-xs">→</span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Agent health grid (full width) */}
      <Section
        title="Agent 健康状态"
        subtitle={`${agentStats.total} 个 Agent · ${agentStats.running} 运行中 · ${agentStats.error} 错误`}
        href="/agents"
        linkLabel="Agent 列表"
      >
        <AgentHealthGrid />
      </Section>

    </div>
  )
}
