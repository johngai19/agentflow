/**
 * workflowConverter.ts — Converts agentflow WorkflowDefinition to OpsAgent format.
 *
 * The agentflow frontend uses a node+edge graph model (WorkflowDefinition).
 * The opsagent workflow engine uses a step-based DAG with explicit transitions.
 * This module bridges the two formats.
 */

import type { WorkflowDefinition, WorkflowNode, WorkflowEdge } from '@/types/workflow'
import type { OpsWorkflowDefinition, OpsWorkflowStep } from '@/lib/opsagentApi'

// ─── Edge condition → transition condition expression ─────────────────────────

function edgeConditionToExpr(
  condition: WorkflowEdge['condition'],
  nodeId: string,
): string | undefined {
  switch (condition) {
    case 'on_success': return `steps.${nodeId}.status == 'completed'`
    case 'on_failure': return `steps.${nodeId}.status == 'failed'`
    case 'on_true':    return `steps.${nodeId}.output.result == true`
    case 'on_false':   return `steps.${nodeId}.output.result == false`
    case 'always':
    default:
      return undefined
  }
}

// ─── Map a single WorkflowNode → OpsWorkflowStep ─────────────────────────────

function convertNode(
  node: WorkflowNode,
  outboundEdges: WorkflowEdge[],
): OpsWorkflowStep {
  // Build transitions from outbound edges
  const transitions = outboundEdges.map(edge => ({
    target: edge.to,
    condition: edgeConditionToExpr(edge.condition, node.id),
  }))

  const base: Omit<OpsWorkflowStep, 'type'> = {
    id:         node.id,
    name:       node.label,
    transitions,
    metadata:   { description: node.description ?? '', icon: '' },
  }

  switch (node.type) {
    case 'agent': {
      const cfg = node.config as {
        agentId: string
        taskTemplate: string
        timeout?: number
        retry?: { maxAttempts: number; backoffMs: number }
      }
      return {
        ...base,
        type:             'agent',
        agent_name:       cfg.agentId,
        agent_url:        '',            // resolved at runtime via Agent Registry
        message_template: cfg.taskTemplate,
        timeout_seconds:  cfg.timeout ? Math.floor(cfg.timeout / 1000) : 300,
        retry_count:      cfg.retry?.maxAttempts ?? 0,
      }
    }

    case 'approval': {
      const cfg = node.config as {
        prompt: string
        approvers: string[]
        timeout?: number
        defaultAction?: 'approve' | 'reject'
      }
      return {
        ...base,
        type:            'approval',
        message_template: cfg.prompt,
        approval_config:  {
          approvers:      cfg.approvers,
          timeout_ms:     cfg.timeout,
          default_action: cfg.defaultAction,
        },
        timeout_seconds: cfg.timeout ? Math.floor(cfg.timeout / 1000) : 86400,
      }
    }

    case 'condition': {
      const cfg = node.config as { expression: string }
      return {
        ...base,
        type:           'condition',
        condition_expr: cfg.expression,
      }
    }

    case 'parallel_fork':
    case 'parallel_join': {
      return {
        ...base,
        type:           'parallel',
        parallel_steps: outboundEdges.map(e => e.to),
        metadata: {
          ...base.metadata,
          parallel_role: node.type,
        },
      }
    }

    case 'notification': {
      const cfg = node.config as {
        channel: string
        template: string
        recipients?: string[]
        webhookUrl?: string
      }
      return {
        ...base,
        type:             'notification',
        message_template: cfg.template,
        metadata: {
          ...base.metadata,
          channel:    cfg.channel,
          recipients: cfg.recipients ?? [],
          webhook_url: cfg.webhookUrl ?? '',
        },
      }
    }

    case 'timer': {
      const cfg = node.config as { duration?: string; cron?: string }
      return {
        ...base,
        type: 'agent',             // use a timer-agent in opsagent
        agent_name:       'timer-agent',
        message_template: cfg.duration ?? cfg.cron ?? 'PT1M',
        metadata: {
          ...base.metadata,
          timer_type: cfg.cron ? 'cron' : 'duration',
          duration:   cfg.duration,
          cron:       cfg.cron,
        },
      }
    }

    case 'subworkflow': {
      const cfg = node.config as {
        workflowId: string
        waitForCompletion: boolean
      }
      return {
        ...base,
        type:        'agent',
        agent_name:  'workflow-engine',
        agent_url:   '',
        message_template: cfg.workflowId,
        metadata: {
          ...base.metadata,
          sub_workflow_id:    cfg.workflowId,
          wait_for_completion: cfg.waitForCompletion,
        },
      }
    }

    case 'loop': {
      const cfg = node.config as { condition: string; maxIterations: number }
      return {
        ...base,
        type:           'condition',
        condition_expr: cfg.condition,
        metadata: {
          ...base.metadata,
          loop_max_iterations: cfg.maxIterations,
        },
      }
    }

    default:
      return { ...base, type: 'agent', agent_name: node.type }
  }
}

// ─── Main conversion function ─────────────────────────────────────────────────

/**
 * Convert an agentflow WorkflowDefinition to the OpsAgent engine format.
 *
 * The entry step is the node marked `isStart = true`, or the first node
 * with no incoming edges.
 */
export function convertWorkflowToOpsAgent(workflow: WorkflowDefinition): OpsWorkflowDefinition {
  const { nodes, edges } = workflow

  // Build edge index: nodeId → outbound edges
  const outboundEdges = new Map<string, WorkflowEdge[]>()
  for (const node of nodes) {
    outboundEdges.set(node.id, [])
  }
  for (const edge of edges) {
    outboundEdges.get(edge.from)?.push(edge)
  }

  // Find entry step
  const incomingCount = new Map<string, number>()
  for (const node of nodes) incomingCount.set(node.id, 0)
  for (const edge of edges) {
    incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1)
  }

  const startNode =
    nodes.find(n => n.isStart) ??
    nodes.find(n => (incomingCount.get(n.id) ?? 0) === 0) ??
    nodes[0]

  const steps: OpsWorkflowStep[] = nodes.map(node =>
    convertNode(node, outboundEdges.get(node.id) ?? []),
  )

  // Extract context variables as workflow-level variables
  const variables: Record<string, unknown> = {}
  for (const cv of workflow.contextVariables ?? []) {
    variables[cv.key] = cv.defaultValue ?? ''
  }

  return {
    id:          workflow.id,
    name:        workflow.name,
    description: workflow.description,
    version:     String(workflow.currentVersion),
    trigger:     workflow.triggers[0]?.type === 'webhook' ? 'webhook'
                  : workflow.triggers[0]?.type === 'cron'  ? 'cron'
                  : 'manual',
    steps,
    entry_step:  startNode?.id ?? '',
    variables,
    metadata: {
      agentflow_icon:       workflow.icon,
      agentflow_project_id: workflow.projectId,
      agentflow_updated_at: workflow.updatedAt,
      concurrency:          workflow.concurrency,
      timeout_ms:           workflow.timeout,
    },
  }
}
