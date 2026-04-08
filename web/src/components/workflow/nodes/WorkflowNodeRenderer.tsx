'use client'

import type { WorkflowNode } from '@/types/workflow'
import { AgentNode } from './AgentNode'
import { ConditionNode } from './ConditionNode'
import { ParallelForkNode, ParallelJoinNode } from './ParallelNode'
import { ApprovalNode } from './ApprovalNode'
import { TimerNode, SubworkflowNode, NotificationNode, LoopNode } from './SpecialNodes'

interface WorkflowNodeRendererProps {
  node: WorkflowNode
  selected: boolean
  onClick: () => void
}

export function WorkflowNodeRenderer({ node, selected, onClick }: WorkflowNodeRendererProps) {
  const props = { node, selected, onClick }

  switch (node.type) {
    case 'agent':
      return <AgentNode {...props} />
    case 'condition':
      return <ConditionNode {...props} />
    case 'parallel_fork':
      return <ParallelForkNode {...props} />
    case 'parallel_join':
      return <ParallelJoinNode {...props} />
    case 'approval':
      return <ApprovalNode {...props} />
    case 'timer':
      return <TimerNode {...props} />
    case 'subworkflow':
      return <SubworkflowNode {...props} />
    case 'notification':
      return <NotificationNode {...props} />
    case 'loop':
      return <LoopNode {...props} />
    default:
      return (
        <div
          onClick={onClick}
          className={`min-w-[120px] rounded-xl border-2 cursor-pointer bg-slate-700/50 border-slate-600 px-3 py-2 ${selected ? 'ring-2 ring-white/40' : ''}`}
        >
          <span className="text-xs text-white/60">{node.label}</span>
        </div>
      )
  }
}
