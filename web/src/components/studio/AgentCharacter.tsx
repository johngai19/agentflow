'use client'

import { useEffect, useRef } from 'react'
import { motion, type Variants } from 'framer-motion'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useStudioStore } from '@/stores/studioStore'
import { STATUS_CONFIG, type Agent } from '@/data/studioData'
import AgentStatusBar from './AgentStatusBar'
import { agentPositionRegistry } from '@/lib/agentPositionRegistry'

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

  // Position registry: notify WorkflowEdges of our DOM position via ResizeObserver.
  // This avoids per-frame DOM queries in WorkflowEdges (no layout thrashing).
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const report = () => {
      const rect = el.getBoundingClientRect()
      // We store viewport-relative coords; WorkflowEdges will subtract its container offset.
      agentPositionRegistry.update(agent.id, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })
    }

    report()

    const ro = new ResizeObserver(report)
    ro.observe(el)

    // Also re-report on scroll/layout shifts
    window.addEventListener('scroll', report, { passive: true })
    window.addEventListener('resize', report, { passive: true })

    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', report)
      window.removeEventListener('resize', report)
      agentPositionRegistry.remove(agent.id)
    }
  }, [agent.id])

  // Re-report position when a drag transform changes (agent moves)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    agentPositionRegistry.update(agent.id, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }, [agent.id, transform])

  // Merge refs: dnd-kit setNodeRef + our measurement rootRef
  const mergeRef = (node: HTMLDivElement | null) => {
    setNodeRef(node)
    ;(rootRef as React.MutableRefObject<HTMLDivElement | null>).current = node
  }

  return (
    <div
      ref={mergeRef}
      data-agent-id={agent.id}
      style={style}
      className={`relative flex flex-col items-center cursor-grab active:cursor-grabbing select-none
        ${isDragging ? 'z-50 opacity-90 scale-110' : 'z-0'}
        transition-opacity duration-150`}
      {...listeners}
      {...attributes}
    >
      {/* Body + status bar container */}
      <motion.div
        variants={bodyVariants}
        animate={isDragging ? 'idle' : agent.status}
        className="relative mt-16"
        onClick={(e) => { e.stopPropagation(); selectAgent(isSelected ? null : agent.id) }}
      >
        {/* Status bar floating above head */}
        <AgentStatusBar agent={agent} />

        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-full blur-md opacity-50 transition-all duration-500"
          style={{ backgroundColor: agent.color, transform: 'scale(1.3)' }}
        />

        {/* Orchestrator crown */}
        {agent.isOrchestrator && (
          <motion.div
            className="absolute -top-5 left-1/2 -translate-x-1/2 text-base z-10"
            animate={{ y: [-1, 1, -1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >👑</motion.div>
        )}

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

          {/* Pod count badge (kagent) */}
          {(agent.podCount ?? 1) > 1 && (
            <div
              className="absolute -bottom-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold
                flex items-center justify-center text-white shadow"
              style={{ backgroundColor: agent.color }}
            >
              ×{agent.podCount}
            </div>
          )}
        </motion.div>
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
