'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { STATUS_CONFIG, type Agent } from '@/data/studioData'

interface AgentStatusBarProps {
  agent: Agent
}

function useDurationTimer(startTime?: number, active = false): string {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active || !startTime) { setElapsed(0); return }
    const update = () => setElapsed(Date.now() - startTime)
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startTime, active])

  if (!active || !startTime) return ''
  const s = Math.floor(elapsed / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m${s % 60}s`
}

export default function AgentStatusBar({ agent }: AgentStatusBarProps) {
  const isActive = agent.status === 'working' || agent.status === 'reporting'
  const elapsed = useDurationTimer(agent.startTime, isActive)
  const progress = agent.progress ?? 0
  const cfg = STATUS_CONFIG[agent.status]

  const busyLevel = agent.status === 'working' ? 3
    : agent.status === 'reporting' ? 2
    : agent.status === 'assigned'  ? 1
    : 0

  return (
    <AnimatePresence>
      {agent.status !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="absolute -top-14 left-1/2 -translate-x-1/2 w-24 pointer-events-none z-20"
        >
          {/* Glass card */}
          <div className="bg-black/75 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-white/10 shadow-xl">
            {/* Status dot + label row */}
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-1">
                <motion.span
                  className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`}
                  animate={agent.status === 'working' ? { opacity: [1, 0.4, 1] } : {}}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
                <span className={`text-[9px] font-medium ${cfg.color} truncate`}>
                  {cfg.label}
                </span>
              </div>
              {elapsed && (
                <span className="text-[9px] text-white/50 flex-shrink-0">{elapsed}</span>
              )}
            </div>

            {/* Task name */}
            {agent.currentTask && (
              <div className="text-[9px] text-white/70 truncate mb-1 leading-tight">
                {agent.currentTask}
              </div>
            )}

            {/* Progress bar */}
            {isActive && (
              <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: agent.color }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
            )}

            {/* Busy meter (3 bars) */}
            <div className="flex gap-0.5 mt-1 justify-center">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`h-1 w-3 rounded-sm transition-colors duration-300 ${
                    i < busyLevel ? 'opacity-100' : 'opacity-20'
                  }`}
                  style={{ backgroundColor: i < busyLevel ? agent.color : '#888' }}
                />
              ))}
            </div>

            {/* Arrow pointing down */}
            <div
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-1.5 overflow-hidden"
            >
              <div className="w-2 h-2 bg-black/75 rotate-45 translate-y-[-50%] mx-auto border-b border-r border-white/10" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
