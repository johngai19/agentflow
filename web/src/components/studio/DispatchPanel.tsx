'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStudioStore } from '@/stores/studioStore'
import { ZONES } from '@/data/studioData'

interface DispatchPanelProps {
  orchestratorId: string
}

export default function DispatchPanel({ orchestratorId }: DispatchPanelProps) {
  const agents = useStudioStore(s => s.agents)
  const dispatchTask = useStudioStore(s => s.dispatchTask)

  const [isOpen, setIsOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [selectedZone, setSelectedZone] = useState<string>('aliyun')
  const [taskText, setTaskText] = useState('')
  const [dispatching, setDispatching] = useState(false)

  const workers = agents.filter(a => !a.isOrchestrator)
  const workZones = ZONES.filter(z => z.id !== 'default')

  const handleDispatch = async () => {
    if (!selectedAgent || !taskText.trim()) return
    setDispatching(true)
    dispatchTask(orchestratorId, selectedAgent, selectedZone, taskText.trim())
    setTimeout(() => {
      setDispatching(false)
      setTaskText('')
      setIsOpen(false)
    }, 800)
  }

  return (
    <div className="px-4 py-2">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between text-xs text-amber-500 hover:text-amber-400 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span>📋</span>
          <span className="font-medium">调度任务</span>
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          className="text-amber-500/60 text-[10px]"
        >▼</motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-2">
              {/* Target agent */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">派发给</label>
                  <select
                    value={selectedAgent}
                    onChange={e => setSelectedAgent(e.target.value)}
                    className="w-full text-xs bg-muted border border-border rounded px-2 py-1 focus:outline-none"
                  >
                    <option value="">选择 Agent</option>
                    {workers.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.emoji} {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">目标区域</label>
                  <select
                    value={selectedZone}
                    onChange={e => setSelectedZone(e.target.value)}
                    className="w-full text-xs bg-muted border border-border rounded px-2 py-1 focus:outline-none"
                  >
                    {workZones.map(z => (
                      <option key={z.id} value={z.id}>{z.icon} {z.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Task description */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">任务说明</label>
                <textarea
                  value={taskText}
                  onChange={e => setTaskText(e.target.value)}
                  placeholder="描述具体任务..."
                  rows={2}
                  className="w-full text-xs bg-muted border border-border rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                />
              </div>

              {/* Dispatch button */}
              <motion.button
                onClick={handleDispatch}
                disabled={!selectedAgent || !taskText.trim() || dispatching}
                whileTap={{ scale: 0.97 }}
                className="w-full py-1.5 rounded-lg text-xs font-medium transition-colors
                  bg-amber-500/20 border border-amber-500/40 text-amber-400
                  hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {dispatching ? (
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  >正在派发…</motion.span>
                ) : '📤 派发任务'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
