import type { NodePaletteItem, WorkflowNodeType } from '@/types/workflow'

// ─── Node type visual config ───────────────────────────────────────────────────

export const NODE_PALETTE_ITEMS: NodePaletteItem[] = [
  {
    type: 'agent',
    label: 'Agent 任务',
    description: '调用指定 Agent 执行任务',
    icon: '🤖',
    color: 'bg-indigo-500/20',
    borderColor: 'border-indigo-500/50',
  },
  {
    type: 'condition',
    label: '条件分支',
    description: '根据条件表达式路由到不同分支',
    icon: '⚡',
    color: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/50',
  },
  {
    type: 'parallel_fork',
    label: '并行分叉',
    description: '将执行拆分为多个并行分支',
    icon: '⑂',
    color: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/50',
  },
  {
    type: 'parallel_join',
    label: '并行汇合',
    description: '等待所有（或部分）并行分支完成',
    icon: '⑃',
    color: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/50',
  },
  {
    type: 'approval',
    label: '人工审批',
    description: '暂停执行，等待指定人员审批',
    icon: '✋',
    color: 'bg-orange-500/20',
    borderColor: 'border-orange-500/50',
  },
  {
    type: 'timer',
    label: '定时等待',
    description: '延迟执行或等待到指定时间',
    icon: '⏱',
    color: 'bg-purple-500/20',
    borderColor: 'border-purple-500/50',
  },
  {
    type: 'subworkflow',
    label: '子工作流',
    description: '调用另一个工作流',
    icon: '📦',
    color: 'bg-teal-500/20',
    borderColor: 'border-teal-500/50',
  },
  {
    type: 'notification',
    label: '通知',
    description: '发送通知到钉钉/Slack/邮件',
    icon: '🔔',
    color: 'bg-green-500/20',
    borderColor: 'border-green-500/50',
  },
  {
    type: 'loop',
    label: '循环',
    description: '循环执行节点直到条件满足',
    icon: '🔁',
    color: 'bg-rose-500/20',
    borderColor: 'border-rose-500/50',
  },
]

export const NODE_TYPE_MAP: Record<WorkflowNodeType, NodePaletteItem> = Object.fromEntries(
  NODE_PALETTE_ITEMS.map(item => [item.type, item])
) as Record<WorkflowNodeType, NodePaletteItem>
