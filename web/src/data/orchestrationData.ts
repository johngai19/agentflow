// ─── Types ───────────────────────────────────────────────────────────────────

export type TriggerType = 'manual' | 'cron' | 'webhook' | 'event' | 'chain'
export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'
export type StepStatus = 'waiting' | 'running' | 'success' | 'failed' | 'skipped'

export interface OrchestrationStep {
  id: string
  name: string
  agentId: string
  zoneId: string
  taskTemplate: string       // supports {{variables}}
  dependsOn?: string[]       // explicit step IDs (optional, edges also encode deps)
  condition?: string         // JS-like condition on prev step output
  timeout?: number           // ms
  retry?: { maxAttempts: number; backoffMs: number }
}

export interface OrchestrationEdge {
  from: string               // step id
  to: string                 // step id
  condition?: 'always' | 'on_success' | 'on_failure'
}

export interface Trigger {
  type: TriggerType
  schedule?: string          // cron expression
  webhookPath?: string
  eventTopic?: string
  chainFrom?: string         // orchestration id
  chainOnEvent?: 'completed' | 'failed'
}

export interface Orchestration {
  id: string
  name: string
  projectId: string
  description: string
  icon: string
  steps: OrchestrationStep[]
  edges: OrchestrationEdge[]
  triggers: Trigger[]
  concurrency?: number
  timeout?: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}

// ─── Run (execution instance) ─────────────────────────────────────────────────

export interface StepRun {
  stepId: string
  status: StepStatus
  startedAt?: number
  finishedAt?: number
  output?: string
  error?: string
  toolsUsed?: string[]
  tokensUsed?: number
}

export interface OrchestrationRun {
  id: string
  orchestrationId: string
  status: RunStatus
  trigger: TriggerType
  triggeredBy?: string       // userId or 'scheduler'
  startedAt: number
  finishedAt?: number
  stepRuns: StepRun[]
  logLines?: string[]        // sparse global log
}

// ─── Sample Data ──────────────────────────────────────────────────────────────

const now = Date.now()
const mins = (n: number) => n * 60 * 1000
const hrs = (n: number) => n * 60 * 60 * 1000
const days = (n: number) => n * 24 * 60 * 60 * 1000

export const SAMPLE_ORCHESTRATIONS: Orchestration[] = [
  // ── 1. 夜间安全巡检 ─────────────────────────────────────────────────────────
  {
    id: 'nightly-security-scan',
    name: '夜间安全巡检',
    projectId: 'security',
    description: '每天凌晨自动执行全量漏洞扫描、合规审计，并将报告发送给运营团队',
    icon: '🛡️',
    steps: [
      { id: 's1', name: '数据收集', agentId: 'alice', zoneId: 'aliyun', taskTemplate: '收集所有云资源清单，准备安全扫描数据' },
      { id: 's2', name: '漏洞扫描', agentId: 'diana', zoneId: 'aliyun', taskTemplate: '对 {{s1.resourceList}} 执行 CVE 扫描', dependsOn: ['s1'] },
      { id: 's3', name: '合规检查', agentId: 'diana', zoneId: 'cron', taskTemplate: '检查 CIS Benchmark 合规性', dependsOn: ['s1'] },
      { id: 's4', name: '成本分析', agentId: 'eve', zoneId: 'aliyun', taskTemplate: '分析安全相关资源的成本合理性', dependsOn: ['s2'] },
      { id: 's5', name: '汇总报告', agentId: 'max', zoneId: 'deploy', taskTemplate: '整合 {{s2.findings}} 和 {{s3.compliance}} 生成完整安全报告', dependsOn: ['s2', 's3', 's4'] },
    ],
    edges: [
      { from: 's1', to: 's2', condition: 'on_success' },
      { from: 's1', to: 's3', condition: 'on_success' },
      { from: 's2', to: 's4', condition: 'on_success' },
      { from: 's2', to: 's5', condition: 'always' },
      { from: 's3', to: 's5', condition: 'always' },
      { from: 's4', to: 's5', condition: 'always' },
    ],
    triggers: [{ type: 'cron', schedule: '0 2 * * *' }],
    enabled: true,
    createdAt: now - days(30),
    updatedAt: now - days(2),
  },

  // ── 2. 基础设施健康检查 ───────────────────────────────────────────────────────
  {
    id: 'infra-health-check',
    name: '基础设施健康检查',
    projectId: 'infra-ops',
    description: '每小时检查所有 K8s 集群、ECS 实例和 VPC 网络状态，异常时自动告警',
    icon: '💓',
    steps: [
      { id: 'h1', name: 'K8s 集群检查', agentId: 'bob', zoneId: 'aliyun', taskTemplate: 'kubectl get nodes,pods --all-namespaces，检查异常状态' },
      { id: 'h2', name: 'ECS 实例监控', agentId: 'bob', zoneId: 'aliyun', taskTemplate: '查询所有 ECS 实例 CPU/内存/磁盘使用率' },
      { id: 'h3', name: '网络探活', agentId: 'alice', zoneId: 'cron', taskTemplate: '对关键服务执行 HTTP 健康探测', dependsOn: ['h1'] },
      { id: 'h4', name: '告警聚合', agentId: 'max', zoneId: 'deploy', taskTemplate: '汇总异常，仅在发现问题时触发钉钉告警', dependsOn: ['h1', 'h2', 'h3'] },
    ],
    edges: [
      { from: 'h1', to: 'h3', condition: 'always' },
      { from: 'h1', to: 'h4', condition: 'always' },
      { from: 'h2', to: 'h4', condition: 'always' },
      { from: 'h3', to: 'h4', condition: 'always' },
    ],
    triggers: [{ type: 'cron', schedule: '0 * * * *' }],
    enabled: true,
    createdAt: now - days(20),
    updatedAt: now - days(1),
  },

  // ── 3. 每周成本报告 ─────────────────────────────────────────────────────────
  {
    id: 'weekly-cost-report',
    name: '每周成本优化报告',
    projectId: 'infra-ops',
    description: '每周一分析上周云资源支出，识别浪费，生成优化建议 PDF 报告',
    icon: '📊',
    steps: [
      { id: 'c1', name: '账单数据拉取', agentId: 'eve', zoneId: 'aliyun', taskTemplate: '拉取过去7天阿里云账单明细' },
      { id: 'c2', name: '资源使用分析', agentId: 'eve', zoneId: 'aliyun', taskTemplate: '分析各产品线资源利用率，识别闲置资源', dependsOn: ['c1'] },
      { id: 'c3', name: '优化建议生成', agentId: 'alice', zoneId: 'deploy', taskTemplate: '基于 {{c2.idleResources}} 生成详细优化建议', dependsOn: ['c2'] },
      { id: 'c4', name: '报告生成', agentId: 'max', zoneId: 'deploy', taskTemplate: '整合分析结果，生成周报并发送邮件', dependsOn: ['c2', 'c3'] },
    ],
    edges: [
      { from: 'c1', to: 'c2', condition: 'on_success' },
      { from: 'c2', to: 'c3', condition: 'on_success' },
      { from: 'c2', to: 'c4', condition: 'on_success' },
      { from: 'c3', to: 'c4', condition: 'always' },
    ],
    triggers: [{ type: 'cron', schedule: '0 9 * * 1' }],
    enabled: true,
    createdAt: now - days(15),
    updatedAt: now - days(3),
  },

  // ── 4. 部署流水线 ────────────────────────────────────────────────────────────
  {
    id: 'deploy-pipeline',
    name: '应用部署流水线',
    projectId: 'infra-ops',
    description: '代码合并到 main 后自动触发：代码审查 → 安全扫描 → 构建 → 灰度发布',
    icon: '🚀',
    steps: [
      { id: 'd1', name: '代码审查', agentId: 'charlie', zoneId: 'deploy', taskTemplate: '对新提交进行自动 code review，检查规范和安全问题' },
      { id: 'd2', name: '安全门禁', agentId: 'diana', zoneId: 'deploy', taskTemplate: '扫描依赖漏洞（npm audit / pip audit），CVE评分 > 7 则阻断', dependsOn: ['d1'], condition: 'd1.approved === true' },
      { id: 'd3', name: '构建镜像', agentId: 'charlie', zoneId: 'deploy', taskTemplate: '构建 Docker 镜像并推送到私有仓库', dependsOn: ['d2'] },
      { id: 'd4', name: '灰度发布', agentId: 'bob', zoneId: 'deploy', taskTemplate: '以 10% 流量灰度发布到 K8s，观察5分钟错误率', dependsOn: ['d3'] },
      { id: 'd5', name: '全量切流', agentId: 'bob', zoneId: 'aliyun', taskTemplate: '灰度正常则全量发布，异常则自动回滚', dependsOn: ['d4'] },
    ],
    edges: [
      { from: 'd1', to: 'd2', condition: 'on_success' },
      { from: 'd2', to: 'd3', condition: 'on_success' },
      { from: 'd3', to: 'd4', condition: 'on_success' },
      { from: 'd4', to: 'd5', condition: 'on_success' },
    ],
    triggers: [
      { type: 'webhook', webhookPath: '/api/orchestrations/trigger/deploy-pipeline' },
      { type: 'manual' },
    ],
    enabled: true,
    createdAt: now - days(10),
    updatedAt: now - hrs(3),
  },

  // ── 5. Agent注册巡检（链式触发）────────────────────────────────────────────
  {
    id: 'agent-registry-audit',
    name: 'Agent 注册审计',
    projectId: 'infra-ops',
    description: '每天检查 Agent Registry 健康状态，自动下线心跳超时的 Agent',
    icon: '🤖',
    steps: [
      { id: 'r1', name: 'Registry 扫描', agentId: 'alice', zoneId: 'cron', taskTemplate: '查询所有注册 Agent 的最后心跳时间' },
      { id: 'r2', name: '异常下线', agentId: 'max', zoneId: 'deploy', taskTemplate: '对心跳超时 > 5min 的 Agent 执行下线操作', dependsOn: ['r1'] },
    ],
    edges: [{ from: 'r1', to: 'r2', condition: 'on_success' }],
    triggers: [
      { type: 'cron', schedule: '30 6 * * *' },
      { type: 'chain', chainFrom: 'nightly-security-scan', chainOnEvent: 'completed' },
    ],
    enabled: true,
    createdAt: now - days(5),
    updatedAt: now - days(1),
  },
]

// ─── Sample Run History ───────────────────────────────────────────────────────

function makeRun(
  id: string,
  orchId: string,
  status: RunStatus,
  startOffset: number,    // ms before now
  durationMs: number,
  trigger: TriggerType,
): OrchestrationRun {
  const startedAt = now - startOffset
  const orch = SAMPLE_ORCHESTRATIONS.find(o => o.id === orchId)!
  const defaultStepRuns: StepRun[] = orch.steps.map((s, i) => ({
    stepId: s.id,
    status: status === 'success' ? 'success'
          : status === 'failed' && i === orch.steps.length - 1 ? 'failed'
          : status === 'running' && i === orch.steps.length - 1 ? 'running'
          : 'success',
    startedAt: startedAt + (durationMs / orch.steps.length) * i,
    finishedAt: status === 'running' && i === orch.steps.length - 1
      ? undefined
      : startedAt + (durationMs / orch.steps.length) * (i + 1),
    toolsUsed: ['web_search', 'kubectl'].slice(0, (i % 2) + 1),
    tokensUsed: 800 + Math.floor(Math.random() * 2000),
  }))

  return {
    id,
    orchestrationId: orchId,
    status,
    trigger,
    triggeredBy: trigger === 'manual' ? 'user:john' : 'scheduler',
    startedAt,
    finishedAt: status === 'running' ? undefined : startedAt + durationMs,
    stepRuns: defaultStepRuns,
  }
}

export const SAMPLE_RUNS: OrchestrationRun[] = [
  // nightly-security-scan runs
  makeRun('run-sec-001', 'nightly-security-scan', 'success',  hrs(4),  mins(4) + 32000, 'cron'),
  makeRun('run-sec-002', 'nightly-security-scan', 'success',  hrs(28), mins(5) + 10000, 'cron'),
  makeRun('run-sec-003', 'nightly-security-scan', 'failed',   hrs(52), mins(2) + 8000,  'cron'),
  makeRun('run-sec-004', 'nightly-security-scan', 'success',  hrs(76), mins(4) + 55000, 'cron'),

  // infra-health-check (hourly, many runs)
  ...Array.from({ length: 8 }, (_, i) =>
    makeRun(`run-hc-${String(i + 1).padStart(3, '0')}`, 'infra-health-check',
      i === 3 ? 'failed' : 'success',
      hrs(i), mins(1) + 5000 + i * 3000, 'cron')
  ),

  // weekly-cost-report
  makeRun('run-cost-001', 'weekly-cost-report', 'success', days(7),  mins(8) + 22000, 'cron'),
  makeRun('run-cost-002', 'weekly-cost-report', 'success', days(14), mins(7) + 44000, 'cron'),
  makeRun('run-cost-003', 'weekly-cost-report', 'failed',  days(21), mins(3) + 11000, 'cron'),

  // deploy-pipeline — one currently running
  makeRun('run-dep-001', 'deploy-pipeline', 'running', mins(8), mins(6), 'webhook'),
  makeRun('run-dep-002', 'deploy-pipeline', 'success', hrs(2),  mins(5) + 38000, 'manual'),
  makeRun('run-dep-003', 'deploy-pipeline', 'success', hrs(26), mins(4) + 52000, 'webhook'),

  // agent-registry-audit
  makeRun('run-reg-001', 'agent-registry-audit', 'success', hrs(18), mins(0) + 45000, 'cron'),
  makeRun('run-reg-002', 'agent-registry-audit', 'success', hrs(42), mins(0) + 33000, 'chain'),
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getRunsByOrchId(orchId: string): OrchestrationRun[] {
  return SAMPLE_RUNS.filter(r => r.orchestrationId === orchId)
    .sort((a, b) => b.startedAt - a.startedAt)
}

export function getRunById(runId: string): OrchestrationRun | undefined {
  return SAMPLE_RUNS.find(r => r.id === runId)
}

export function getOrchById(id: string): Orchestration | undefined {
  return SAMPLE_ORCHESTRATIONS.find(o => o.id === id)
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}m${s > 0 ? ` ${s}s` : ''}`
}

export function successRate(runs: OrchestrationRun[]): number {
  if (!runs.length) return 100
  const done = runs.filter(r => r.status === 'success' || r.status === 'failed')
  if (!done.length) return 100
  return Math.round((done.filter(r => r.status === 'success').length / done.length) * 100)
}
