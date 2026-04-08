// ─── Workflow Designer — Core Type Definitions ───────────────────────────────

// ── Node types ────────────────────────────────────────────────────────────────

export type WorkflowNodeType =
  | 'agent'
  | 'condition'
  | 'parallel_fork'
  | 'parallel_join'
  | 'approval'
  | 'timer'
  | 'subworkflow'
  | 'notification'
  | 'loop'

// ── Retry strategy ────────────────────────────────────────────────────────────

export interface RetryStrategy {
  maxAttempts: number
  backoffMs: number
  backoffMultiplier?: number   // exponential factor (default 1 = fixed)
}

// ── Parameter mapping ─────────────────────────────────────────────────────────

export interface ParameterMapping {
  /** Target parameter name inside the node */
  key: string
  /** Source expression, e.g. "{{node_id.output.field}}" or a literal value */
  value: string
}

// ── Node-type specific configs ────────────────────────────────────────────────

export interface AgentNodeConfig {
  agentId: string
  taskTemplate: string         // supports {{variable}} interpolation
  inputMappings?: ParameterMapping[]
  timeout?: number             // ms; undefined = no timeout
  retry?: RetryStrategy
}

export interface ConditionNodeConfig {
  /** JS-like expression evaluated against the previous node's output context */
  expression: string
  /** Label shown on the "true" branch edge */
  trueBranchLabel?: string
  /** Label shown on the "false" branch edge */
  falseBranchLabel?: string
}

export interface ParallelForkNodeConfig {
  /** IDs of the child branch start-nodes (resolved at runtime by edges) */
  branchCount?: number
}

export interface ParallelJoinNodeConfig {
  /** Strategy for merging branch results */
  mergeStrategy: 'wait_all' | 'wait_any' | 'wait_n'
  waitN?: number
}

export interface ApprovalNodeConfig {
  /** Free text prompt shown to the approver */
  prompt: string
  /** List of approver identifiers (user IDs or role names) */
  approvers: string[]
  timeout?: number             // ms to auto-expire if no decision
  defaultAction?: 'approve' | 'reject'
}

export interface TimerNodeConfig {
  /** ISO 8601 duration string, e.g. "PT5M" for 5 minutes, or a cron expression */
  duration?: string
  cron?: string
}

export interface SubworkflowNodeConfig {
  workflowId: string
  /** Input overrides passed to the sub-workflow */
  inputMappings?: ParameterMapping[]
  waitForCompletion: boolean
}

export interface NotificationNodeConfig {
  channel: 'dingtalk' | 'slack' | 'email' | 'webhook'
  template: string
  recipients?: string[]
  webhookUrl?: string
}

export interface LoopNodeConfig {
  /** JS-like expression: evaluated each iteration; loop continues while true */
  condition: string
  /** Maximum number of iterations (safety cap) */
  maxIterations: number
  /** ID of the node that marks the end of the loop body */
  bodyEndNodeId?: string
}

export type WorkflowNodeConfig =
  | AgentNodeConfig
  | ConditionNodeConfig
  | ParallelForkNodeConfig
  | ParallelJoinNodeConfig
  | ApprovalNodeConfig
  | TimerNodeConfig
  | SubworkflowNodeConfig
  | NotificationNodeConfig
  | LoopNodeConfig

// ── Canvas position ───────────────────────────────────────────────────────────

export interface Position {
  x: number
  y: number
}

// ── Workflow node ─────────────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  label: string
  position: Position
  config: WorkflowNodeConfig
  /** Optional description shown in UI tooltips */
  description?: string
  /** Whether this node is the designated start node */
  isStart?: boolean
  /** Whether this node is the designated end node */
  isEnd?: boolean
}

// ── Edge ─────────────────────────────────────────────────────────────────────

export type EdgeCondition = 'always' | 'on_success' | 'on_failure' | 'on_true' | 'on_false'

export interface WorkflowEdge {
  id: string
  from: string                  // source node id
  to: string                    // target node id
  condition?: EdgeCondition
  /** Human-readable label rendered on the edge */
  label?: string
}

// ── Trigger ───────────────────────────────────────────────────────────────────

export type WorkflowTriggerType = 'manual' | 'cron' | 'webhook' | 'event' | 'chain'

export interface WorkflowTrigger {
  type: WorkflowTriggerType
  schedule?: string             // cron expression
  webhookPath?: string
  eventTopic?: string
  chainFromWorkflowId?: string
  chainOnEvent?: 'completed' | 'failed'
}

// ── Version ───────────────────────────────────────────────────────────────────

export interface WorkflowVersion {
  version: number               // monotonically increasing integer
  createdAt: number             // epoch ms
  createdBy?: string
  comment?: string
  snapshot: WorkflowDefinition  // full workflow at that version
}

// ── Context variable ──────────────────────────────────────────────────────────

export interface WorkflowContextVariable {
  key: string
  description?: string
  defaultValue?: string
}

// ── Workflow definition (the design-time artifact) ────────────────────────────

export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  icon: string
  projectId: string

  nodes: WorkflowNode[]
  edges: WorkflowEdge[]

  triggers: WorkflowTrigger[]
  concurrency?: number          // max parallel runs
  timeout?: number              // global timeout in ms

  /** Named input variables for this workflow */
  contextVariables?: WorkflowContextVariable[]

  enabled: boolean
  createdAt: number
  updatedAt: number
  /** Current version number (matches latest entry in versions array) */
  currentVersion: number
  versions: WorkflowVersion[]
}

// ── Designer state (UI-layer, not persisted in workflow def) ──────────────────

export type DesignerMode = 'select' | 'connect' | 'pan'

export interface DesignerViewport {
  x: number
  y: number
  scale: number
}

// ── Node palette item (for the drag-from-palette UX) ─────────────────────────

export interface NodePaletteItem {
  type: WorkflowNodeType
  label: string
  description: string
  icon: string
  color: string              // Tailwind bg color class
  borderColor: string        // Tailwind border color class
}

// ── Run-time types (lightweight, reuse orchestrationData for full run history) ─

export type WorkflowRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

export interface WorkflowNodeRunState {
  nodeId: string
  status: 'waiting' | 'running' | 'success' | 'failed' | 'skipped'
  startedAt?: number
  finishedAt?: number
  output?: string
  error?: string
}

export interface WorkflowRun {
  id: string
  workflowId: string
  status: WorkflowRunStatus
  triggeredBy: string
  startedAt: number
  finishedAt?: number
  nodeStates: WorkflowNodeRunState[]
}
