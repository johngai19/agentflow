// ─── Workflow Template Library ────────────────────────────────────────────────
//
// Pre-defined workflow templates for common operational scenarios.
// Each template is a complete WorkflowDefinition that users can
// instantiate with one click.

import type { WorkflowDefinition } from '@/types/workflow'

// ─── Template metadata (display-only) ────────────────────────────────────────

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: 'ops' | 'security' | 'infra' | 'knowledge' | 'iam'
  /** Estimated nodes in the template */
  nodeCount: number
  /** Approximate run time label */
  estimatedDuration: string
  tags: string[]
  definition: WorkflowDefinition
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function ts(offsetMs = 0): number {
  return Date.now() - offsetMs
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 工单创建流 (ticket_creation)
// ─────────────────────────────────────────────────────────────────────────────

const ticketCreationTemplate: WorkflowTemplate = {
  id: 'tpl-ticket-creation',
  name: '工单创建流',
  description: '接收告警或用户请求后自动分类、分配并通知相关人员，标准化工单全生命周期',
  icon: '🎫',
  category: 'ops',
  nodeCount: 6,
  estimatedDuration: '< 2 分钟',
  tags: ['工单', 'ITSM', '自动化', '钉钉'],
  definition: {
    id: 'tpl-def-ticket-creation',
    name: '工单创建流',
    description: '接收告警或用户请求后自动分类、分配并通知相关人员',
    icon: '🎫',
    projectId: '',
    enabled: false,
    createdAt: ts(86400000),
    updatedAt: ts(3600000),
    currentVersion: 1,
    versions: [],
    triggers: [{ type: 'webhook', webhookPath: '/trigger/ticket' }, { type: 'manual' }],
    contextVariables: [
      { key: 'title', description: '工单标题', defaultValue: '' },
      { key: 'priority', description: '优先级: P0/P1/P2/P3', defaultValue: 'P2' },
      { key: 'requester', description: '申请人 ID', defaultValue: '' },
    ],
    nodes: [
      {
        id: 'tc-n1',
        type: 'agent',
        label: '解析请求',
        position: { x: 100, y: 200 },
        isStart: true,
        description: '从 Webhook 或用户输入中解析工单字段',
        config: {
          agentId: 'parser-agent',
          taskTemplate: '解析并结构化工单请求：{{title}}，优先级：{{priority}}',
          timeout: 30000,
          retry: { maxAttempts: 2, backoffMs: 1000 },
        },
      },
      {
        id: 'tc-n2',
        type: 'condition',
        label: '是否紧急?',
        position: { x: 320, y: 200 },
        description: '判断是否为 P0/P1 紧急工单',
        config: {
          expression: 'priority === "P0" || priority === "P1"',
          trueBranchLabel: '紧急',
          falseBranchLabel: '普通',
        },
      },
      {
        id: 'tc-n3',
        type: 'approval',
        label: '快速审批 (P0/P1)',
        position: { x: 540, y: 100 },
        description: '紧急工单需要值班经理快速确认',
        config: {
          prompt: '发现紧急工单，请确认处理方案并指派负责人',
          approvers: ['oncall-manager'],
          timeout: 1800000,
          defaultAction: 'approve',
        },
      },
      {
        id: 'tc-n4',
        type: 'agent',
        label: '自动分配',
        position: { x: 540, y: 320 },
        description: '根据工单类型和当前负载自动分配处理人',
        config: {
          agentId: 'assign-agent',
          taskTemplate: '根据工单类型「{{title}}」和团队负载分配处理人',
          timeout: 15000,
          retry: { maxAttempts: 3, backoffMs: 500 },
        },
      },
      {
        id: 'tc-n5',
        type: 'agent',
        label: '创建工单记录',
        position: { x: 760, y: 200 },
        description: '写入工单系统并生成工单号',
        config: {
          agentId: 'ticket-writer',
          taskTemplate: '在工单系统中创建记录，优先级：{{priority}}，处理人：{{node_tc-n4.output.assignee}}',
          timeout: 20000,
          retry: { maxAttempts: 3, backoffMs: 1000 },
        },
      },
      {
        id: 'tc-n6',
        type: 'notification',
        label: '通知相关方',
        position: { x: 980, y: 200 },
        isEnd: true,
        description: '通过钉钉/邮件通知申请人和处理人',
        config: {
          channel: 'dingtalk',
          template: '工单 #{{node_tc-n5.output.ticketId}} 已创建\n优先级：{{priority}}\n处理人：{{node_tc-n4.output.assignee}}',
          recipients: ['{{requester}}', '{{node_tc-n4.output.assignee}}'],
        },
      },
    ],
    edges: [
      { id: 'tc-e1', from: 'tc-n1', to: 'tc-n2', condition: 'on_success' },
      { id: 'tc-e2', from: 'tc-n2', to: 'tc-n3', condition: 'on_true', label: '紧急' },
      { id: 'tc-e3', from: 'tc-n2', to: 'tc-n4', condition: 'on_false', label: '普通' },
      { id: 'tc-e4', from: 'tc-n3', to: 'tc-n5', condition: 'on_success' },
      { id: 'tc-e5', from: 'tc-n4', to: 'tc-n5', condition: 'on_success' },
      { id: 'tc-e6', from: 'tc-n5', to: 'tc-n6', condition: 'on_success' },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 告警响应流 (alert_response)
// ─────────────────────────────────────────────────────────────────────────────

const alertResponseTemplate: WorkflowTemplate = {
  id: 'tpl-alert-response',
  name: '告警响应流',
  description: '接收监控告警后自动分级、并行诊断根因，并根据严重程度决定是否需要人工介入',
  icon: '🚨',
  category: 'ops',
  nodeCount: 9,
  estimatedDuration: '3 ~ 10 分钟',
  tags: ['告警', '监控', 'SRE', '自动修复'],
  definition: {
    id: 'tpl-def-alert-response',
    name: '告警响应流',
    description: '接收监控告警，自动分级、并行诊断，按严重程度路由处置',
    icon: '🚨',
    projectId: '',
    enabled: false,
    createdAt: ts(172800000),
    updatedAt: ts(7200000),
    currentVersion: 1,
    versions: [],
    triggers: [{ type: 'webhook', webhookPath: '/trigger/alert' }, { type: 'event', eventTopic: 'monitoring.alert' }],
    contextVariables: [
      { key: 'alertName', description: '告警名称', defaultValue: '' },
      { key: 'severity', description: '严重程度: critical/warning/info', defaultValue: 'warning' },
      { key: 'service', description: '受影响服务', defaultValue: '' },
    ],
    nodes: [
      {
        id: 'ar-n1',
        type: 'agent',
        label: '告警解析',
        position: { x: 80, y: 240 },
        isStart: true,
        description: '解析告警载荷，提取关键字段',
        config: {
          agentId: 'alert-parser',
          taskTemplate: '解析告警：{{alertName}}，服务：{{service}}，严重度：{{severity}}',
          timeout: 15000,
          retry: { maxAttempts: 2, backoffMs: 500 },
        },
      },
      {
        id: 'ar-n2',
        type: 'parallel_fork',
        label: '并行诊断',
        position: { x: 280, y: 240 },
        description: '同时启动多条诊断链路',
        config: { branchCount: 3 },
      },
      {
        id: 'ar-n3',
        type: 'agent',
        label: '日志分析',
        position: { x: 480, y: 100 },
        config: {
          agentId: 'log-analyzer',
          taskTemplate: '查询 {{service}} 过去 15 分钟的错误日志，归纳根因',
          timeout: 60000,
          retry: { maxAttempts: 2, backoffMs: 2000 },
        },
      },
      {
        id: 'ar-n4',
        type: 'agent',
        label: '指标分析',
        position: { x: 480, y: 240 },
        config: {
          agentId: 'metrics-analyzer',
          taskTemplate: '分析 {{service}} CPU/内存/QPS 指标异常',
          timeout: 45000,
          retry: { maxAttempts: 2, backoffMs: 2000 },
        },
      },
      {
        id: 'ar-n5',
        type: 'agent',
        label: '依赖检查',
        position: { x: 480, y: 380 },
        config: {
          agentId: 'dependency-checker',
          taskTemplate: '检查 {{service}} 的上下游依赖服务健康状态',
          timeout: 30000,
          retry: { maxAttempts: 2, backoffMs: 1000 },
        },
      },
      {
        id: 'ar-n6',
        type: 'parallel_join',
        label: '汇总诊断结果',
        position: { x: 700, y: 240 },
        config: { mergeStrategy: 'wait_all' },
      },
      {
        id: 'ar-n7',
        type: 'condition',
        label: '是否 critical?',
        position: { x: 900, y: 240 },
        config: {
          expression: 'severity === "critical"',
          trueBranchLabel: '需人工',
          falseBranchLabel: '自动修复',
        },
      },
      {
        id: 'ar-n8',
        type: 'approval',
        label: '值班人员确认',
        position: { x: 1100, y: 140 },
        config: {
          prompt: '检测到 critical 告警：{{alertName}}\n\n诊断摘要：{{node_ar-n6.output.summary}}\n\n请确认处置方案',
          approvers: ['oncall-engineer', 'sre-lead'],
          timeout: 900000,
        },
      },
      {
        id: 'ar-n9',
        type: 'notification',
        label: '发送处置报告',
        position: { x: 1100, y: 360 },
        isEnd: true,
        config: {
          channel: 'dingtalk',
          template: '告警「{{alertName}}」已处置\n服务：{{service}}\n根因：{{node_ar-n6.output.rootCause}}\n处置：{{node_ar-n6.output.action}}',
          recipients: ['sre-team', 'service-owner'],
        },
      },
    ],
    edges: [
      { id: 'ar-e1', from: 'ar-n1', to: 'ar-n2', condition: 'on_success' },
      { id: 'ar-e2', from: 'ar-n2', to: 'ar-n3', condition: 'always' },
      { id: 'ar-e3', from: 'ar-n2', to: 'ar-n4', condition: 'always' },
      { id: 'ar-e4', from: 'ar-n2', to: 'ar-n5', condition: 'always' },
      { id: 'ar-e5', from: 'ar-n3', to: 'ar-n6', condition: 'always' },
      { id: 'ar-e6', from: 'ar-n4', to: 'ar-n6', condition: 'always' },
      { id: 'ar-e7', from: 'ar-n5', to: 'ar-n6', condition: 'always' },
      { id: 'ar-e8', from: 'ar-n6', to: 'ar-n7', condition: 'on_success' },
      { id: 'ar-e9', from: 'ar-n7', to: 'ar-n8', condition: 'on_true', label: '需人工' },
      { id: 'ar-e10', from: 'ar-n7', to: 'ar-n9', condition: 'on_false', label: '自动修复' },
      { id: 'ar-e11', from: 'ar-n8', to: 'ar-n9', condition: 'on_success' },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. 云资源创建流 (resource_provision)
// ─────────────────────────────────────────────────────────────────────────────

const resourceProvisionTemplate: WorkflowTemplate = {
  id: 'tpl-resource-provision',
  name: '云资源创建流',
  description: '标准化云资源申请、审批、创建和验证全流程，支持 Aliyun/AWS 等主流云平台',
  icon: '☁️',
  category: 'infra',
  nodeCount: 8,
  estimatedDuration: '5 ~ 30 分钟',
  tags: ['云资源', 'IaC', '审批', 'Aliyun'],
  definition: {
    id: 'tpl-def-resource-provision',
    name: '云资源创建流',
    description: '标准化云资源申请、审批、创建和验证全流程',
    icon: '☁️',
    projectId: '',
    enabled: false,
    createdAt: ts(259200000),
    updatedAt: ts(14400000),
    currentVersion: 1,
    versions: [],
    triggers: [{ type: 'manual' }, { type: 'webhook', webhookPath: '/trigger/provision' }],
    contextVariables: [
      { key: 'resourceType', description: '资源类型: ECS/RDS/OSS/VPC', defaultValue: 'ECS' },
      { key: 'environment', description: '环境: prod/staging/dev', defaultValue: 'dev' },
      { key: 'region', description: '云区域', defaultValue: 'cn-hangzhou' },
      { key: 'requester', description: '申请人', defaultValue: '' },
    ],
    nodes: [
      {
        id: 'rp-n1',
        type: 'agent',
        label: '需求评估',
        position: { x: 80, y: 220 },
        isStart: true,
        description: '评估资源规格需求合理性及预算估算',
        config: {
          agentId: 'cost-estimator',
          taskTemplate: '评估 {{resourceType}} 在 {{environment}} 环境的资源规格和月度成本',
          timeout: 30000,
          retry: { maxAttempts: 2, backoffMs: 1000 },
        },
      },
      {
        id: 'rp-n2',
        type: 'condition',
        label: '是否生产环境?',
        position: { x: 300, y: 220 },
        config: {
          expression: 'environment === "prod"',
          trueBranchLabel: '生产审批',
          falseBranchLabel: '直接创建',
        },
      },
      {
        id: 'rp-n3',
        type: 'approval',
        label: '生产资源审批',
        position: { x: 520, y: 120 },
        description: '生产资源需要架构师和 IT 负责人双重审批',
        config: {
          prompt: '申请创建生产资源：{{resourceType}}\n区域：{{region}}\n预估费用：{{node_rp-n1.output.cost}}/月\n\n请评估并审批',
          approvers: ['infra-architect', 'it-manager'],
          timeout: 86400000,
        },
      },
      {
        id: 'rp-n4',
        type: 'agent',
        label: '生成 IaC 配置',
        position: { x: 740, y: 220 },
        description: '生成 Terraform/Pulumi 配置文件',
        config: {
          agentId: 'iac-generator',
          taskTemplate: '生成 {{resourceType}} 的 Terraform 配置，环境：{{environment}}，区域：{{region}}',
          timeout: 60000,
          retry: { maxAttempts: 2, backoffMs: 2000 },
        },
      },
      {
        id: 'rp-n5',
        type: 'agent',
        label: '执行创建',
        position: { x: 960, y: 220 },
        description: '调用 Terraform Apply 执行资源创建',
        config: {
          agentId: 'terraform-executor',
          taskTemplate: '执行 Terraform Apply 创建资源，配置：{{node_rp-n4.output.config}}',
          timeout: 600000,
          retry: { maxAttempts: 1, backoffMs: 5000 },
        },
      },
      {
        id: 'rp-n6',
        type: 'agent',
        label: '健康检查',
        position: { x: 1180, y: 220 },
        description: '验证新创建资源的可访问性和基础健康状态',
        config: {
          agentId: 'health-checker',
          taskTemplate: '对新创建的 {{resourceType}} ({{node_rp-n5.output.resourceId}}) 执行健康检查',
          timeout: 120000,
          retry: { maxAttempts: 3, backoffMs: 10000 },
        },
      },
      {
        id: 'rp-n7',
        type: 'agent',
        label: '更新 CMDB',
        position: { x: 1400, y: 140 },
        description: '将资源信息同步到 CMDB',
        config: {
          agentId: 'cmdb-updater',
          taskTemplate: '在 CMDB 中注册资源 {{node_rp-n5.output.resourceId}}，类型：{{resourceType}}，环境：{{environment}}',
          timeout: 30000,
          retry: { maxAttempts: 3, backoffMs: 1000 },
        },
      },
      {
        id: 'rp-n8',
        type: 'notification',
        label: '通知完成',
        position: { x: 1400, y: 320 },
        isEnd: true,
        config: {
          channel: 'dingtalk',
          template: '资源创建完成\n类型：{{resourceType}}\nID：{{node_rp-n5.output.resourceId}}\n环境：{{environment}}\n区域：{{region}}',
          recipients: ['{{requester}}', 'infra-team'],
        },
      },
    ],
    edges: [
      { id: 'rp-e1', from: 'rp-n1', to: 'rp-n2', condition: 'on_success' },
      { id: 'rp-e2', from: 'rp-n2', to: 'rp-n3', condition: 'on_true', label: '生产审批' },
      { id: 'rp-e3', from: 'rp-n2', to: 'rp-n4', condition: 'on_false', label: '直接创建' },
      { id: 'rp-e4', from: 'rp-n3', to: 'rp-n4', condition: 'on_success' },
      { id: 'rp-e5', from: 'rp-n4', to: 'rp-n5', condition: 'on_success' },
      { id: 'rp-e6', from: 'rp-n5', to: 'rp-n6', condition: 'on_success' },
      { id: 'rp-e7', from: 'rp-n6', to: 'rp-n7', condition: 'on_success' },
      { id: 'rp-e8', from: 'rp-n6', to: 'rp-n8', condition: 'on_failure' },
      { id: 'rp-e9', from: 'rp-n7', to: 'rp-n8', condition: 'always' },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 权限变更流 (permission_change)
// ─────────────────────────────────────────────────────────────────────────────

const permissionChangeTemplate: WorkflowTemplate = {
  id: 'tpl-permission-change',
  name: '权限变更流',
  description: '权限申请的合规性审查、最小权限原则校验、多级审批和变更记录全流程',
  icon: '🔐',
  category: 'iam',
  nodeCount: 8,
  estimatedDuration: '10 分钟 ~ 1 天',
  tags: ['IAM', '权限', '合规', '审批', '安全'],
  definition: {
    id: 'tpl-def-permission-change',
    name: '权限变更流',
    description: '权限申请合规审查、最小权限校验、多级审批和变更记录',
    icon: '🔐',
    projectId: '',
    enabled: false,
    createdAt: ts(345600000),
    updatedAt: ts(21600000),
    currentVersion: 1,
    versions: [],
    triggers: [{ type: 'manual' }, { type: 'webhook', webhookPath: '/trigger/iam' }],
    contextVariables: [
      { key: 'subject', description: '申请人/服务账号', defaultValue: '' },
      { key: 'resource', description: '目标资源或系统', defaultValue: '' },
      { key: 'action', description: '权限动作: read/write/admin', defaultValue: 'read' },
      { key: 'reason', description: '申请原因', defaultValue: '' },
      { key: 'duration', description: '有效期（天）', defaultValue: '30' },
    ],
    nodes: [
      {
        id: 'pc-n1',
        type: 'agent',
        label: '合规性预检',
        position: { x: 80, y: 240 },
        isStart: true,
        description: '检查申请是否符合公司安全策略',
        config: {
          agentId: 'compliance-checker',
          taskTemplate: '检查 {{subject}} 申请 {{resource}} 的 {{action}} 权限是否符合最小权限原则和合规要求，原因：{{reason}}',
          timeout: 30000,
          retry: { maxAttempts: 2, backoffMs: 1000 },
        },
      },
      {
        id: 'pc-n2',
        type: 'condition',
        label: '是否高风险?',
        position: { x: 300, y: 240 },
        config: {
          expression: 'action === "admin" || node_pc-n1.output.riskLevel === "high"',
          trueBranchLabel: '高风险',
          falseBranchLabel: '标准',
        },
      },
      {
        id: 'pc-n3',
        type: 'approval',
        label: '安全团队审批',
        position: { x: 520, y: 120 },
        description: '高风险权限需安全团队评审',
        config: {
          prompt: '高风险权限申请\n主体：{{subject}}\n资源：{{resource}}\n动作：{{action}}\n原因：{{reason}}\n有效期：{{duration}} 天\n\n风险评估：{{node_pc-n1.output.riskDetail}}',
          approvers: ['security-team', 'it-manager'],
          timeout: 86400000,
        },
      },
      {
        id: 'pc-n4',
        type: 'approval',
        label: '业务负责人审批',
        position: { x: 520, y: 360 },
        description: '标准权限需要业务负责人审批',
        config: {
          prompt: '权限申请\n主体：{{subject}}\n资源：{{resource}}\n动作：{{action}}\n原因：{{reason}}',
          approvers: ['biz-owner'],
          timeout: 43200000,
        },
      },
      {
        id: 'pc-n5',
        type: 'agent',
        label: '执行权限变更',
        position: { x: 740, y: 240 },
        description: '调用 IAM API 授予权限',
        config: {
          agentId: 'iam-executor',
          taskTemplate: '为 {{subject}} 授予 {{resource}} 的 {{action}} 权限，有效期 {{duration}} 天',
          timeout: 30000,
          retry: { maxAttempts: 3, backoffMs: 2000 },
        },
      },
      {
        id: 'pc-n6',
        type: 'timer',
        label: '到期等待',
        position: { x: 960, y: 240 },
        description: '等待权限有效期结束',
        config: { duration: 'P{{duration}}D' },
      },
      {
        id: 'pc-n7',
        type: 'agent',
        label: '自动撤销权限',
        position: { x: 1180, y: 240 },
        description: '到期后自动撤销临时权限',
        config: {
          agentId: 'iam-executor',
          taskTemplate: '撤销 {{subject}} 在 {{resource}} 的 {{action}} 权限（已到期）',
          timeout: 30000,
          retry: { maxAttempts: 3, backoffMs: 2000 },
        },
      },
      {
        id: 'pc-n8',
        type: 'notification',
        label: '变更通知',
        position: { x: 1400, y: 240 },
        isEnd: true,
        config: {
          channel: 'dingtalk',
          template: '权限变更完成\n主体：{{subject}}\n资源：{{resource}}\n动作：{{action}}\n状态：{{node_pc-n5.output.status}}',
          recipients: ['{{subject}}', 'security-team'],
        },
      },
    ],
    edges: [
      { id: 'pc-e1', from: 'pc-n1', to: 'pc-n2', condition: 'on_success' },
      { id: 'pc-e2', from: 'pc-n2', to: 'pc-n3', condition: 'on_true', label: '高风险' },
      { id: 'pc-e3', from: 'pc-n2', to: 'pc-n4', condition: 'on_false', label: '标准' },
      { id: 'pc-e4', from: 'pc-n3', to: 'pc-n5', condition: 'on_success' },
      { id: 'pc-e5', from: 'pc-n4', to: 'pc-n5', condition: 'on_success' },
      { id: 'pc-e6', from: 'pc-n5', to: 'pc-n6', condition: 'on_success' },
      { id: 'pc-e7', from: 'pc-n6', to: 'pc-n7', condition: 'always' },
      { id: 'pc-e8', from: 'pc-n7', to: 'pc-n8', condition: 'always' },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. 知识咨询流 (knowledge_consultation)
// ─────────────────────────────────────────────────────────────────────────────

const knowledgeConsultationTemplate: WorkflowTemplate = {
  id: 'tpl-knowledge-consultation',
  name: '知识咨询流',
  description: '用户提问后从多个知识源并行检索，融合结果生成高质量答案，必要时升级给专家',
  icon: '🧠',
  category: 'knowledge',
  nodeCount: 8,
  estimatedDuration: '30 秒 ~ 5 分钟',
  tags: ['知识库', 'RAG', '问答', 'AI', '企业知识'],
  definition: {
    id: 'tpl-def-knowledge-consultation',
    name: '知识咨询流',
    description: '并行检索多个知识源，融合生成答案，按置信度决定是否升级专家',
    icon: '🧠',
    projectId: '',
    enabled: false,
    createdAt: ts(432000000),
    updatedAt: ts(28800000),
    currentVersion: 1,
    versions: [],
    triggers: [{ type: 'webhook', webhookPath: '/trigger/consult' }, { type: 'manual' }],
    contextVariables: [
      { key: 'question', description: '用户提问', defaultValue: '' },
      { key: 'userId', description: '提问用户 ID', defaultValue: '' },
      { key: 'domain', description: '领域: ops/security/infra/hr/general', defaultValue: 'general' },
    ],
    nodes: [
      {
        id: 'kc-n1',
        type: 'agent',
        label: '问题预处理',
        position: { x: 80, y: 240 },
        isStart: true,
        description: '分析问题意图，提取关键词，选择检索策略',
        config: {
          agentId: 'intent-analyzer',
          taskTemplate: '分析问题「{{question}}」的意图和领域，生成最优检索关键词，领域提示：{{domain}}',
          timeout: 20000,
          retry: { maxAttempts: 2, backoffMs: 500 },
        },
      },
      {
        id: 'kc-n2',
        type: 'parallel_fork',
        label: '并行检索',
        position: { x: 280, y: 240 },
        config: { branchCount: 3 },
      },
      {
        id: 'kc-n3',
        type: 'agent',
        label: '内部 Wiki 检索',
        position: { x: 480, y: 100 },
        config: {
          agentId: 'wiki-retriever',
          taskTemplate: '在企业 Wiki 中检索：{{node_kc-n1.output.keywords}}',
          timeout: 15000,
          retry: { maxAttempts: 2, backoffMs: 1000 },
        },
      },
      {
        id: 'kc-n4',
        type: 'agent',
        label: '历史工单检索',
        position: { x: 480, y: 240 },
        config: {
          agentId: 'ticket-retriever',
          taskTemplate: '检索相关历史工单和解决方案：{{node_kc-n1.output.keywords}}',
          timeout: 15000,
          retry: { maxAttempts: 2, backoffMs: 1000 },
        },
      },
      {
        id: 'kc-n5',
        type: 'agent',
        label: '技术文档检索',
        position: { x: 480, y: 380 },
        config: {
          agentId: 'doc-retriever',
          taskTemplate: '在技术文档库中检索：{{node_kc-n1.output.keywords}}，领域：{{domain}}',
          timeout: 15000,
          retry: { maxAttempts: 2, backoffMs: 1000 },
        },
      },
      {
        id: 'kc-n6',
        type: 'parallel_join',
        label: '融合检索结果',
        position: { x: 700, y: 240 },
        config: { mergeStrategy: 'wait_all' },
      },
      {
        id: 'kc-n7',
        type: 'agent',
        label: '生成答案',
        position: { x: 900, y: 240 },
        description: '基于检索内容合成高质量回答，评估置信度',
        config: {
          agentId: 'answer-generator',
          taskTemplate: '基于以下检索内容回答问题「{{question}}」：\n\nWiki：{{node_kc-n3.output.results}}\n工单：{{node_kc-n4.output.results}}\n文档：{{node_kc-n5.output.results}}',
          timeout: 60000,
          retry: { maxAttempts: 2, backoffMs: 2000 },
        },
      },
      {
        id: 'kc-n8',
        type: 'condition',
        label: '置信度是否充足?',
        position: { x: 1100, y: 240 },
        config: {
          expression: 'node_kc-n7.output.confidence >= 0.7',
          trueBranchLabel: '直接回答',
          falseBranchLabel: '升级专家',
        },
      },
      {
        id: 'kc-n9',
        type: 'notification',
        label: '返回答案',
        position: { x: 1300, y: 140 },
        isEnd: true,
        config: {
          channel: 'webhook',
          template: '{{node_kc-n7.output.answer}}',
          recipients: ['{{userId}}'],
        },
      },
      {
        id: 'kc-n10',
        type: 'notification',
        label: '升级专家',
        position: { x: 1300, y: 360 },
        isEnd: true,
        config: {
          channel: 'dingtalk',
          template: '用户 {{userId}} 的问题需要专家解答：\n\n{{question}}\n\nAI 初步答案（低置信度）：{{node_kc-n7.output.answer}}',
          recipients: ['domain-expert-{{domain}}'],
        },
      },
    ],
    edges: [
      { id: 'kc-e1', from: 'kc-n1', to: 'kc-n2', condition: 'on_success' },
      { id: 'kc-e2', from: 'kc-n2', to: 'kc-n3', condition: 'always' },
      { id: 'kc-e3', from: 'kc-n2', to: 'kc-n4', condition: 'always' },
      { id: 'kc-e4', from: 'kc-n2', to: 'kc-n5', condition: 'always' },
      { id: 'kc-e5', from: 'kc-n3', to: 'kc-n6', condition: 'always' },
      { id: 'kc-e6', from: 'kc-n4', to: 'kc-n6', condition: 'always' },
      { id: 'kc-e7', from: 'kc-n5', to: 'kc-n6', condition: 'always' },
      { id: 'kc-e8', from: 'kc-n6', to: 'kc-n7', condition: 'on_success' },
      { id: 'kc-e9', from: 'kc-n7', to: 'kc-n8', condition: 'on_success' },
      { id: 'kc-e10', from: 'kc-n8', to: 'kc-n9', condition: 'on_true', label: '直接回答' },
      { id: 'kc-e11', from: 'kc-n8', to: 'kc-n10', condition: 'on_false', label: '升级专家' },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  ticketCreationTemplate,
  alertResponseTemplate,
  resourceProvisionTemplate,
  permissionChangeTemplate,
  knowledgeConsultationTemplate,
]

export const TEMPLATE_MAP: Record<string, WorkflowTemplate> = Object.fromEntries(
  WORKFLOW_TEMPLATES.map(t => [t.id, t])
)

/** Category display config */
export const TEMPLATE_CATEGORIES: Record<WorkflowTemplate['category'], { label: string; icon: string; color: string }> = {
  ops: { label: '运维', icon: '⚙️', color: 'text-blue-400' },
  security: { label: '安全', icon: '🛡️', color: 'text-red-400' },
  infra: { label: '基础设施', icon: '☁️', color: 'text-cyan-400' },
  knowledge: { label: '知识管理', icon: '🧠', color: 'text-purple-400' },
  iam: { label: '权限管理', icon: '🔐', color: 'text-orange-400' },
}
