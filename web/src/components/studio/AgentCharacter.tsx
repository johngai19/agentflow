'use client'

import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useStudioStore } from '@/stores/studioStore'
import { STATUS_CONFIG, type Agent } from '@/data/studioData'

interface AgentCharacterProps {
  agent: Agent
}

const bodyVariants: Variants = {
  idle: {
    y: [0, -6, 0],
    transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
  },
  assigned: {
    y: [0, -3, 0],
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
  },
  working: {
    rotate: [0, -8, 8, -8, 0],
    y: [0, -4, 0],
    transition: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
  },
  reporting: {
    y: [0, -12, 0],
    scale: [1, 1.08, 1],
    transition: { duration: 0.5, repeat: Infinity, ease: 'easeInOut' },
  },
  error: {
    x: [-4, 4, -4, 4, 0],
    transition: { duration: 0.4, repeat: Infinity },
  },
}

const eyeVariants: Variants = {
  idle:      { scaleY: [1, 0.15, 1], transition: { duration: 3, repeat: Infinity, repeatDelay: 2 } },
  assigned:  { scaleY: 1 },
  working:   { rotate: 360, transition: { duration: 1, repeat: Infinity, ease: 'linear' } },
  reporting: { scaleY: [1, 1.3, 1], transition: { duration: 0.4, repeat: Infinity } },
  error:     { scaleY: 0.3 },
}

export default function AgentCharacter({ agent }: AgentCharacterProps) {
  const selectAgent = useStudioStore(s => s.selectAgent)
  const selectedAgentId = useStudioStore(s => s.selectedAgentId)
  const isSelected = selectedAgentId === agent.id
  const statusCfg = STATUS_CONFIG[agent.status]

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
      {/* Body */}
      <motion.div
        variants={bodyVariants}
        animate={isDragging ? 'idle' : agent.status}
        className="relative"
        onClick={(e) => { e.stopPropagation(); selectAgent(isSelected ? null : agent.id) }}
      >
        {/* Outer glow ring */}
        <div
          className={`absolute inset-0 rounded-full blur-md opacity-50 transition-all duration-500`}
          style={{ backgroundColor: agent.color, transform: 'scale(1.3)' }}
        />

        {/* Selected ring */}
        {isSelected && (
          <motion.div
            className="absolute -inset-2 rounded-full border-2 border-white/80"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}

        {/* Main body circle */}
        <motion.div
          className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-2 border-white/30"
          style={{ backgroundColor: agent.color }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Face */}
          <div className="flex flex-col items-center gap-0.5">
            {/* Eyes */}
            <div className="flex gap-2">
              <motion.div
                className="w-2 h-2 bg-white rounded-full"
                variants={eyeVariants}
                animate={agent.status}
              />
              <motion.div
                className="w-2 h-2 bg-white rounded-full"
                variants={eyeVariants}
                animate={agent.status}
              />
            </div>
            {/* Mouth */}
            <div className={`w-4 h-1.5 rounded-full bg-white/80 ${agent.status === 'error' ? 'rotate-180' : ''}`} />
          </div>

          {/* Working gear overlay */}
          {agent.status === 'working' && (
            <motion.div
              className="absolute -top-1 -right-1 text-xs"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            >⚙️</motion.div>
          )}

          {/* Reporting flag */}
          {agent.status === 'reporting' && (
            <motion.div
              className="absolute -top-2 -right-1 text-sm"
              animate={{ y: [-2, 2, -2] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >🚩</motion.div>
          )}
        </motion.div>

        {/* Task bubble */}
        <AnimatePresence>
          {agent.currentTask && agent.status === 'working' && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.9 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap
                bg-black/80 text-white text-[10px] px-2 py-0.5 rounded-full pointer-events-none z-10"
            >
              {agent.currentTask}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Name + status badge */}
      <div className="mt-1.5 flex flex-col items-center gap-0.5">
        <span className="text-xs font-semibold text-foreground">{agent.name}</span>
        <span className={`text-[10px] font-medium ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* Completed tasks counter */}
      {agent.completedTasks > 0 && (
        <div className="mt-0.5 text-[9px] text-muted-foreground">
          ✓ {agent.completedTasks}
        </div>
      )}
    </div>
  )
}
