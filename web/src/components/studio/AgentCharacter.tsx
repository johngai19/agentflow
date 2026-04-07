'use client'

import { motion, type Variants } from 'framer-motion'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useStudioStore } from '@/stores/studioStore'
import { type Agent } from '@/data/studioData'
import AgentStatusBar from './AgentStatusBar'
import AgentSprite from './AgentSprite'

interface AgentCharacterProps {
  agent: Agent
}

// Float / bounce container variants (applied to the whole character)
const containerVariants: Variants = {
  idle:      { y: [0, -5, 0],           transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } },
  assigned:  { y: [0, -3, 0],           transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } },
  working:   { y: [0, -3, 0],           transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } },
  reporting: { y: [0, -10, 0],          transition: { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } },
  error:     { x: [-3, 3, -3, 3, 0],   transition: { duration: 0.4, repeat: Infinity } },
}

export default function AgentCharacter({ agent }: AgentCharacterProps) {
  const selectAgent = useStudioStore(s => s.selectAgent)
  const selectedAgentId = useStudioStore(s => s.selectedAgentId)
  const isSelected = selectedAgentId === agent.id

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: agent.id,
    data: { agent },
  })

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex flex-col items-center cursor-grab active:cursor-grabbing select-none
        ${isDragging ? 'z-50 opacity-90 scale-110' : 'z-0'}
        transition-opacity duration-150`}
      {...listeners}
      {...attributes}
    >
      {/* Float/bounce wrapper — provides the "alive" motion at container level */}
      <motion.div
        variants={containerVariants}
        animate={isDragging ? 'idle' : agent.status}
        className="relative mt-16"
        onClick={(e) => { e.stopPropagation(); selectAgent(isSelected ? null : agent.id) }}
      >
        {/* Status HUD floats above head */}
        <AgentStatusBar agent={agent} />

        {/* SVG character sprite (handles its own animation internals) */}
        <AgentSprite agent={agent} size={64} selected={isSelected} />

        {/* Pod count badge on body (kagent) */}
        {(agent.podCount ?? 1) > 1 && (
          <div
            className="absolute -bottom-1 -right-1 min-w-[18px] h-4 px-1 rounded-full text-[9px]
              font-bold flex items-center justify-center text-white shadow z-10"
            style={{ backgroundColor: agent.color }}
          >×{agent.podCount}</div>
        )}
      </motion.div>

      {/* Completed tasks counter */}
      {agent.completedTasks > 0 && (
        <div className="mt-1 text-[9px] text-muted-foreground">
          ✓ {agent.completedTasks}
        </div>
      )}
    </div>
  )
}
