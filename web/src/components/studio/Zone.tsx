'use client'

import { useDroppable } from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import AgentCharacter from './AgentCharacter'
import { useStudioStore } from '@/stores/studioStore'
import type { Zone as ZoneType } from '@/data/studioData'

interface ZoneProps {
  zone: ZoneType
}

// Max "comfortable" agents per zone before it looks crowded
const ZONE_CAPACITY: Record<string, number> = {
  default: 6,
  cron: 3,
  aliyun: 4,
  deploy: 3,
}

export default function Zone({ zone }: ZoneProps) {
  const agents = useStudioStore(s => s.agents.filter(a => a.currentZone === zone.id))
  const { setNodeRef, isOver } = useDroppable({ id: zone.id })

  const hasAgents = agents.length > 0
  const workingCount = agents.filter(a => a.status === 'working').length
  const reportingCount = agents.filter(a => a.status === 'reporting').length
  const capacity = ZONE_CAPACITY[zone.id] ?? 4
  const utilization = Math.min(1, agents.length / capacity)

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        relative rounded-2xl border-2 p-4 transition-all duration-200 min-h-[200px]
        bg-gradient-to-br ${zone.gradient} ${zone.border}
        ${isOver ? 'ring-2 ring-primary ring-offset-2 scale-[1.01] shadow-xl' : ''}
      `}
    >
      {/* Drop highlight */}
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
      <div className="flex items-start justify-between mb-2 relative z-10">
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

        {/* Status badges */}
        <div className="flex flex-col items-end gap-1">
          {workingCount > 0 && (
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] text-amber-600 font-medium">{workingCount} 工作</span>
            </motion.div>
          )}
          {reportingCount > 0 && (
            <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce" />
              <span className="text-[10px] text-green-600 font-medium">{reportingCount} 汇报</span>
            </div>
          )}
        </div>
      </div>

      {/* Capacity bar */}
      {hasAgents && (
        <div className="relative z-10 mb-2 flex items-center gap-2">
          <div className="flex-1 h-1 bg-black/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${utilization * 100}%`,
                backgroundColor: utilization > 0.8 ? '#ef4444' : utilization > 0.5 ? '#f59e0b' : '#10b981',
              }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground whitespace-nowrap">
            {agents.length}/{capacity}
          </span>
        </div>
      )}

      {/* Description */}
      <p className="text-[11px] text-muted-foreground mb-3 relative z-10 leading-relaxed">
        {zone.description}
      </p>

      {/* Agent characters */}
      <div className="relative z-10 flex flex-wrap gap-3 min-h-[100px] items-end pt-2">
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
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-2xl opacity-30">⬇</span>
              <span className="text-[11px] text-muted-foreground border border-dashed border-muted-foreground/30 px-3 py-1.5 rounded-lg">
                拖入 Agent 开始工作
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Active task list (mini log) */}
      <AnimatePresence>
        {agents.some(a => a.currentTask) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative z-10 mt-3 pt-2 border-t border-black/10 space-y-1"
          >
            {agents.filter(a => a.currentTask).map(a => (
              <div key={a.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span style={{ color: a.color }}>{a.emoji}</span>
                <span className="truncate">{a.currentTask}</span>
                {a.progress !== undefined && a.progress > 0 && (
                  <span className="ml-auto flex-shrink-0 font-mono">{a.progress}%</span>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
