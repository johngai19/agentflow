'use client'

import { useDroppable } from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import AgentCharacter from './AgentCharacter'
import { useStudioStore } from '@/stores/studioStore'
import type { Zone as ZoneType } from '@/data/studioData'

interface ZoneProps {
  zone: ZoneType
}

export default function Zone({ zone }: ZoneProps) {
  const agents = useStudioStore(s => s.agents.filter(a => a.currentZone === zone.id))
  const { setNodeRef, isOver } = useDroppable({ id: zone.id })

  const hasAgents = agents.length > 0
  const workingCount = agents.filter(a => a.status === 'working').length

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        relative rounded-2xl border-2 p-4 transition-all duration-200 min-h-[180px]
        bg-gradient-to-br ${zone.gradient} ${zone.border}
        ${isOver ? 'ring-2 ring-primary ring-offset-2 scale-[1.01] shadow-lg' : ''}
      `}
    >
      {/* Zone drop highlight */}
      <AnimatePresence>
        {isOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-2xl bg-primary/10 pointer-events-none z-0"
          />
        )}
      </AnimatePresence>

      {/* Zone header */}
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl">{zone.icon}</span>
          <div>
            <h3 className="font-semibold text-sm text-foreground leading-tight">{zone.name}</h3>
            {zone.cronLabel && (
              <span className="text-[10px] text-blue-500 font-medium bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded-full">
                ⏰ {zone.cronLabel}
              </span>
            )}
          </div>
        </div>

        {/* Working indicator */}
        {workingCount > 0 && (
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] text-amber-600 font-medium">{workingCount} 工作中</span>
          </motion.div>
        )}
      </div>

      {/* Description */}
      <p className="text-[11px] text-muted-foreground mb-3 relative z-10">{zone.description}</p>

      {/* Agent characters */}
      <div className="relative z-10 flex flex-wrap gap-4 min-h-[80px] items-end">
        <AnimatePresence>
          {agents.map(agent => (
            <motion.div
              key={agent.id}
              layout
              data-agent-id={agent.id}
              initial={{ scale: 0.5, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <AgentCharacter agent={agent} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Drop hint */}
        {!hasAgents && (
          <motion.div
            animate={{ opacity: isOver ? 0 : [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="text-[11px] text-muted-foreground border border-dashed border-muted-foreground/40 px-3 py-1.5 rounded-lg">
              拖入 Agent 开始工作
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
