export type AgentStatus = 'idle' | 'assigned' | 'working' | 'reporting' | 'error'

export interface Agent {
  id: string
  name: string
  emoji: string
  color: string
  bgColor: string
  role: string
  description: string
  tools: string[]
  personality: string
  status: AgentStatus
  currentZone: string
  currentTask?: string
  completedTasks: number
}

export interface Zone {
  id: string
  name: string
  description: string
  icon: string
  gradient: string
  border: string
  type: 'default' | 'cron' | 'cloud' | 'deploy' | 'custom'
  cronLabel?: string
}

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'alice',
    name: 'Alice',
    emoji: '🔬',
    color: '#6366f1',
    bgColor: 'bg-indigo-500',
    role: '研究分析师',
    description: '专注于数据分析和市场调研，擅长从海量信息中提炼关键洞察。处理过 1000+ 份研究报告。',
    tools: ['web_search', 'data_analysis', 'report_generation', 'summarization'],
    personality: '严谨细致，喜欢用数据说话，回答前会先确认信息来源',
    status: 'idle',
    currentZone: 'default',
    completedTasks: 12,
  },
  {
    id: 'bob',
    name: 'Bob',
    emoji: '⚡',
    color: '#f59e0b',
    bgColor: 'bg-amber-500',
    role: '云运维工程师',
    description: '负责云基础设施监控和自动化运维，熟悉 Kubernetes、阿里云 ECS/VPC/OSS、Terraform。',
    tools: ['kubectl', 'aliyun_ecs', 'aliyun_vpc', 'terraform', 'prometheus', 'monitoring'],
    personality: '高效务实，专注系统稳定性，喜欢自动化一切重复工作',
    status: 'idle',
    currentZone: 'default',
    completedTasks: 28,
  },
  {
    id: 'charlie',
    name: 'Charlie',
    emoji: '💻',
    color: '#10b981',
    bgColor: 'bg-emerald-500',
    role: '全栈开发者',
    description: '负责代码审查、CI/CD 流水线和应用部署，精通 TypeScript、Python、Docker。',
    tools: ['code_review', 'github_actions', 'docker', 'deployment', 'testing', 'npm'],
    personality: '追求代码质量，注重工程最佳实践，偶尔会对不规范代码发出叹气',
    status: 'idle',
    currentZone: 'default',
    completedTasks: 35,
  },
  {
    id: 'diana',
    name: 'Diana',
    emoji: '🛡️',
    color: '#ef4444',
    bgColor: 'bg-red-500',
    role: '安全巡检员',
    description: '负责安全扫描、漏洞检测和合规检查，定时巡检所有云资源，发现异常立即告警。',
    tools: ['security_scan', 'vulnerability_check', 'compliance_audit', 'cve_lookup', 'alert'],
    personality: '谨慎严格，对安全问题零容忍，发现漏洞会非常兴奋（职业病）',
    status: 'idle',
    currentZone: 'default',
    completedTasks: 19,
  },
  {
    id: 'eve',
    name: 'Eve',
    emoji: '📊',
    color: '#8b5cf6',
    bgColor: 'bg-violet-500',
    role: '成本优化师',
    description: '分析云资源使用情况，识别浪费，提供成本优化建议。上月帮团队节省了 ¥12,000。',
    tools: ['cost_analysis', 'resource_tagging', 'billing_report', 'rightsizing', 'reserved_instances'],
    personality: '精打细算，善于发现隐性成本，看到闲置资源会感到生理不适',
    status: 'idle',
    currentZone: 'default',
    completedTasks: 8,
  },
]

export const ZONES: Zone[] = [
  {
    id: 'default',
    name: '待命区',
    description: '空闲中的 Agent 在这里休息，等待任务分配',
    icon: '🏠',
    gradient: 'from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50',
    border: 'border-slate-200 dark:border-slate-700',
    type: 'default',
  },
  {
    id: 'cron',
    name: '定时巡检室',
    description: '拖入此区域后，Agent 将按计划自动执行巡检任务',
    icon: '⏰',
    gradient: 'from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-900/50',
    border: 'border-blue-300 dark:border-blue-700',
    type: 'cron',
    cronLabel: '每 6 小时',
  },
  {
    id: 'aliyun',
    name: '阿里云区域',
    description: '处理阿里云 ECS、VPC、OSS 等资源的管理和监控任务',
    icon: '☁️',
    gradient: 'from-orange-50 to-amber-100 dark:from-orange-950/50 dark:to-amber-900/50',
    border: 'border-orange-300 dark:border-orange-700',
    type: 'cloud',
  },
  {
    id: 'deploy',
    name: '部署流水线',
    description: '执行 CI/CD、Docker 构建、Kubernetes 部署等发布任务',
    icon: '🚀',
    gradient: 'from-green-50 to-emerald-100 dark:from-green-950/50 dark:to-emerald-900/50',
    border: 'border-green-300 dark:border-emerald-700',
    type: 'deploy',
  },
]

export const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; ring: string; animation: string }> = {
  idle:      { label: '空闲',   color: 'text-slate-500',  ring: 'ring-slate-300',  animation: 'animate-pulse' },
  assigned:  { label: '已分配', color: 'text-blue-500',   ring: 'ring-blue-400',   animation: '' },
  working:   { label: '工作中', color: 'text-amber-500',  ring: 'ring-amber-400',  animation: 'animate-spin' },
  reporting: { label: '汇报中', color: 'text-green-500',  ring: 'ring-green-400',  animation: 'animate-bounce' },
  error:     { label: '出错了', color: 'text-red-500',    ring: 'ring-red-400',    animation: 'animate-ping' },
}

// Simulate work tasks per zone
export const ZONE_TASKS: Record<string, string[]> = {
  cron: [
    '正在执行定时安全扫描...',
    '检查 SSL 证书有效期...',
    '生成资源使用报告...',
    '清理过期日志文件...',
  ],
  aliyun: [
    '查询 ECS 实例状态...',
    '检查 VPC 安全组规则...',
    '分析 OSS 存储用量...',
    '监控 RDS 连接数...',
  ],
  deploy: [
    '触发 CI/CD 流水线...',
    '构建 Docker 镜像...',
    '推送到 K8s 集群...',
    '运行集成测试...',
  ],
}
