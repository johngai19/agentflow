'use client'

import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore'
import type {
  WorkflowNode,
  WorkflowEdge,
  AgentNodeConfig,
  ConditionNodeConfig,
  ApprovalNodeConfig,
  TimerNodeConfig,
  SubworkflowNodeConfig,
  NotificationNodeConfig,
  LoopNodeConfig,
  RetryStrategy,
} from '@/types/workflow'
import { NODE_TYPE_MAP } from './nodes/nodeConfig'

// ─── Sub-form components ───────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-1">{children}</label>
}

function Input({ value, onChange, placeholder, type = 'text', className = '' }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 transition-colors ${className}`}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 2 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 transition-colors resize-none"
    />
  )
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-indigo-500/60 transition-colors"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ─── Node-specific config forms ────────────────────────────────────────────────

function AgentConfigForm({ node }: { node: WorkflowNode }) {
  const updateNode = useWorkflowDesignerStore(s => s.updateNode)
  const cfg = node.config as AgentNodeConfig

  const patch = (p: Partial<AgentNodeConfig>) =>
    updateNode(node.id, { config: { ...cfg, ...p } })

  const patchRetry = (p: Partial<RetryStrategy>) =>
    patch({ retry: { ...(cfg.retry ?? { maxAttempts: 3, backoffMs: 1000 }), ...p } })

  return (
    <div className="space-y-3">
      <div>
        <Label>Agent ID</Label>
        <Input value={cfg.agentId} onChange={v => patch({ agentId: v })} placeholder="alice / bob / diana..." />
      </div>
      <div>
        <Label>任务模板</Label>
        <Textarea value={cfg.taskTemplate} onChange={v => patch({ taskTemplate: v })} placeholder="任务描述，支持 {{变量}}" rows={3} />
      </div>
      <div>
        <Label>超时 (ms)</Label>
        <Input type="number" value={cfg.timeout ?? ''} onChange={v => patch({ timeout: Number(v) || undefined })} placeholder="60000" />
      </div>
      <div>
        <Label>重试次数</Label>
        <Input type="number" value={cfg.retry?.maxAttempts ?? 3} onChange={v => patchRetry({ maxAttempts: Number(v) })} />
      </div>
      <div>
        <Label>退避间隔 (ms)</Label>
        <Input type="number" value={cfg.retry?.backoffMs ?? 1000} onChange={v => patchRetry({ backoffMs: Number(v) })} />
      </div>
    </div>
  )
}

function ConditionConfigForm({ node }: { node: WorkflowNode }) {
  const updateNode = useWorkflowDesignerStore(s => s.updateNode)
  const cfg = node.config as ConditionNodeConfig
  const patch = (p: Partial<ConditionNodeConfig>) =>
    updateNode(node.id, { config: { ...cfg, ...p } })

  return (
    <div className="space-y-3">
      <div>
        <Label>条件表达式</Label>
        <Textarea value={cfg.expression} onChange={v => patch({ expression: v })} placeholder="findings.critical > 0" />
        <p className="text-[10px] text-white/30 mt-1">支持 JS 表达式，上下文变量来自前驱节点输出</p>
      </div>
      <div>
        <Label>True 分支标签</Label>
        <Input value={cfg.trueBranchLabel ?? 'Yes'} onChange={v => patch({ trueBranchLabel: v })} />
      </div>
      <div>
        <Label>False 分支标签</Label>
        <Input value={cfg.falseBranchLabel ?? 'No'} onChange={v => patch({ falseBranchLabel: v })} />
      </div>
    </div>
  )
}

function ApprovalConfigForm({ node }: { node: WorkflowNode }) {
  const updateNode = useWorkflowDesignerStore(s => s.updateNode)
  const cfg = node.config as ApprovalNodeConfig
  const patch = (p: Partial<ApprovalNodeConfig>) =>
    updateNode(node.id, { config: { ...cfg, ...p } })

  return (
    <div className="space-y-3">
      <div>
        <Label>审批说明</Label>
        <Textarea value={cfg.prompt} onChange={v => patch({ prompt: v })} placeholder="请描述需要审批的内容..." />
      </div>
      <div>
        <Label>审批人（逗号分隔）</Label>
        <Input
          value={cfg.approvers.join(', ')}
          onChange={v => patch({ approvers: v.split(',').map(s => s.trim()).filter(Boolean) })}
          placeholder="security-team, john"
        />
      </div>
      <div>
        <Label>超时 (ms)</Label>
        <Input type="number" value={cfg.timeout ?? ''} onChange={v => patch({ timeout: Number(v) || undefined })} placeholder="3600000" />
      </div>
      <div>
        <Label>超时默认操作</Label>
        <Select
          value={cfg.defaultAction ?? ''}
          onChange={v => patch({ defaultAction: v as ApprovalNodeConfig['defaultAction'] })}
          options={[
            { value: '', label: '不自动操作（挂起）' },
            { value: 'approve', label: '自动批准' },
            { value: 'reject', label: '自动拒绝' },
          ]}
        />
      </div>
    </div>
  )
}

function TimerConfigForm({ node }: { node: WorkflowNode }) {
  const updateNode = useWorkflowDesignerStore(s => s.updateNode)
  const cfg = node.config as TimerNodeConfig
  const patch = (p: Partial<TimerNodeConfig>) =>
    updateNode(node.id, { config: { ...cfg, ...p } })

  return (
    <div className="space-y-3">
      <div>
        <Label>等待时长 (ISO 8601)</Label>
        <Input value={cfg.duration ?? ''} onChange={v => patch({ duration: v || undefined })} placeholder="PT5M" />
        <p className="text-[10px] text-white/30 mt-1">如 PT5M=5分钟, PT1H=1小时, P1D=1天</p>
      </div>
      <div>
        <Label>或 Cron 表达式</Label>
        <Input value={cfg.cron ?? ''} onChange={v => patch({ cron: v || undefined })} placeholder="0 9 * * 1" />
      </div>
    </div>
  )
}

function SubworkflowConfigForm({ node }: { node: WorkflowNode }) {
  const updateNode = useWorkflowDesignerStore(s => s.updateNode)
  const cfg = node.config as SubworkflowNodeConfig
  const patch = (p: Partial<SubworkflowNodeConfig>) =>
    updateNode(node.id, { config: { ...cfg, ...p } })

  return (
    <div className="space-y-3">
      <div>
        <Label>子工作流 ID</Label>
        <Input value={cfg.workflowId} onChange={v => patch({ workflowId: v })} placeholder="workflow-id" />
      </div>
      <div>
        <Label>执行模式</Label>
        <Select
          value={cfg.waitForCompletion ? 'sync' : 'async'}
          onChange={v => patch({ waitForCompletion: v === 'sync' })}
          options={[
            { value: 'sync', label: '同步等待完成' },
            { value: 'async', label: '异步触发（不等待）' },
          ]}
        />
      </div>
    </div>
  )
}

function NotificationConfigForm({ node }: { node: WorkflowNode }) {
  const updateNode = useWorkflowDesignerStore(s => s.updateNode)
  const cfg = node.config as NotificationNodeConfig
  const patch = (p: Partial<NotificationNodeConfig>) =>
    updateNode(node.id, { config: { ...cfg, ...p } })

  return (
    <div className="space-y-3">
      <div>
        <Label>通知渠道</Label>
        <Select
          value={cfg.channel}
          onChange={v => patch({ channel: v as NotificationNodeConfig['channel'] })}
          options={[
            { value: 'dingtalk', label: '钉钉' },
            { value: 'slack', label: 'Slack' },
            { value: 'email', label: '邮件' },
            { value: 'webhook', label: 'Webhook' },
          ]}
        />
      </div>
      <div>
        <Label>消息模板</Label>
        <Textarea value={cfg.template} onChange={v => patch({ template: v })} placeholder="通知内容，支持 {{变量}}" />
      </div>
      {cfg.channel === 'webhook' && (
        <div>
          <Label>Webhook URL</Label>
          <Input value={cfg.webhookUrl ?? ''} onChange={v => patch({ webhookUrl: v })} placeholder="https://..." />
        </div>
      )}
    </div>
  )
}

function LoopConfigForm({ node }: { node: WorkflowNode }) {
  const updateNode = useWorkflowDesignerStore(s => s.updateNode)
  const cfg = node.config as LoopNodeConfig
  const patch = (p: Partial<LoopNodeConfig>) =>
    updateNode(node.id, { config: { ...cfg, ...p } })

  return (
    <div className="space-y-3">
      <div>
        <Label>循环条件（持续为 true 时循环）</Label>
        <Textarea value={cfg.condition} onChange={v => patch({ condition: v })} placeholder="items.length > 0" />
      </div>
      <div>
        <Label>最大迭代次数</Label>
        <Input type="number" value={cfg.maxIterations} onChange={v => patch({ maxIterations: Number(v) || 10 })} />
      </div>
    </div>
  )
}

// ─── Edge config form ──────────────────────────────────────────────────────────

function EdgeConfigForm({ edge }: { edge: WorkflowEdge }) {
  const updateEdge = useWorkflowDesignerStore(s => s.updateEdge)
  const deleteEdge = useWorkflowDesignerStore(s => s.deleteEdge)

  return (
    <div className="space-y-3">
      <div>
        <Label>连接条件</Label>
        <Select
          value={edge.condition ?? 'always'}
          onChange={v => updateEdge(edge.id, { condition: v as WorkflowEdge['condition'] })}
          options={[
            { value: 'always', label: '总是执行' },
            { value: 'on_success', label: '成功时' },
            { value: 'on_failure', label: '失败时' },
            { value: 'on_true', label: '条件为真时' },
            { value: 'on_false', label: '条件为假时' },
          ]}
        />
      </div>
      <div>
        <Label>标签</Label>
        <Input value={edge.label ?? ''} onChange={v => updateEdge(edge.id, { label: v || undefined })} placeholder="可选说明" />
      </div>
      <button
        onClick={() => deleteEdge(edge.id)}
        className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors"
      >
        删除连线
      </button>
    </div>
  )
}

// ─── Main NodeConfigPanel ──────────────────────────────────────────────────────

interface NodeConfigPanelProps {
  className?: string
}

export function NodeConfigPanel({ className = '' }: NodeConfigPanelProps) {
  const workflow = useWorkflowDesignerStore(s => s.getActiveWorkflow())
  const selectedNodeIds = useWorkflowDesignerStore(s => s.selectedNodeIds)
  const selectedEdgeId = useWorkflowDesignerStore(s => s.selectedEdgeId)
  const updateNode = useWorkflowDesignerStore(s => s.updateNode)
  const deleteNode = useWorkflowDesignerStore(s => s.deleteNode)
  const clearSelection = useWorkflowDesignerStore(s => s.clearSelection)

  if (!workflow) return null

  const selectedNode = selectedNodeIds.length === 1
    ? workflow.nodes.find(n => n.id === selectedNodeIds[0])
    : null

  const selectedEdge = selectedEdgeId
    ? workflow.edges.find(e => e.id === selectedEdgeId)
    : null

  if (!selectedNode && !selectedEdge) {
    return (
      <aside className={`flex flex-col items-center justify-center text-center px-4 ${className}`}>
        <div className="text-2xl mb-2 opacity-40">⟳</div>
        <div className="text-xs text-white/30">点击画布中的节点或连线<br />查看并编辑配置</div>
      </aside>
    )
  }

  const paletteItem = selectedNode ? NODE_TYPE_MAP[selectedNode.type] : null

  return (
    <aside className={`flex flex-col overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          {paletteItem && <span className="text-base">{paletteItem.icon}</span>}
          <span className="text-xs font-semibold text-white/80">
            {selectedNode ? selectedNode.label : '连线属性'}
          </span>
        </div>
        <button onClick={clearSelection} className="text-white/30 hover:text-white/60 text-sm transition-colors">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Node: common fields */}
        {selectedNode && (
          <>
            <div>
              <Label>节点名称</Label>
              <Input
                value={selectedNode.label}
                onChange={v => updateNode(selectedNode.id, { label: v })}
                placeholder="节点名称"
              />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea
                value={selectedNode.description ?? ''}
                onChange={v => updateNode(selectedNode.id, { description: v || undefined })}
                placeholder="可选节点描述..."
              />
            </div>
            <div className="border-t border-white/10 pt-3">
              <Label>{paletteItem?.label ?? selectedNode.type} 配置</Label>
            </div>

            {selectedNode.type === 'agent' && <AgentConfigForm node={selectedNode} />}
            {selectedNode.type === 'condition' && <ConditionConfigForm node={selectedNode} />}
            {selectedNode.type === 'approval' && <ApprovalConfigForm node={selectedNode} />}
            {selectedNode.type === 'timer' && <TimerConfigForm node={selectedNode} />}
            {selectedNode.type === 'subworkflow' && <SubworkflowConfigForm node={selectedNode} />}
            {selectedNode.type === 'notification' && <NotificationConfigForm node={selectedNode} />}
            {selectedNode.type === 'loop' && <LoopConfigForm node={selectedNode} />}
            {(selectedNode.type === 'parallel_fork' || selectedNode.type === 'parallel_join') && (
              <div className="text-xs text-white/30">分叉/汇合节点由连线结构自动推断</div>
            )}

            <div className="pt-3 border-t border-white/10">
              <button
                onClick={() => { deleteNode(selectedNode.id); clearSelection() }}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors"
              >
                删除节点
              </button>
            </div>
          </>
        )}

        {/* Edge config */}
        {selectedEdge && <EdgeConfigForm edge={selectedEdge} />}
      </div>
    </aside>
  )
}
