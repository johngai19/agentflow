'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useStudioStore } from '@/stores/studioStore'
import Zone from '@/components/studio/Zone'
import AgentCharacter from '@/components/studio/AgentCharacter'
import AgentPanel from '@/components/studio/AgentPanel'
import Notifications from '@/components/studio/Notifications'
import { STATUS_CONFIG, type Agent } from '@/data/studioData'

export default function StudioPage() {
  const agents = useStudioStore(s => s.agents)
  const zones = useStudioStore(s => s.zones)
  const moveAgentToZone = useStudioStore(s => s.moveAgentToZone)
  const isPanelOpen = useStudioStore(s => s.isPanelOpen)
  const closePanel = useStudioStore(s => s.closePanel)

  const [activeAgent, setActiveAgent] = useState<Agent | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const agent = agents.find(a => a.id === event.active.id)
    if (agent) setActiveAgent(agent)
  }, [agents])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      moveAgentToZone(active.id as string, over.id as string)
    }
    setActiveAgent(null)
  }, [moveAgentToZone])

  const totalWorking = agents.filter(a => a.status === 'working').length
  const totalCompleted = agents.reduce((sum, a) => sum + a.completedTasks, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/30 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/60 hover:text-white text-sm transition-colors">← 返回</Link>
            <span className="text-white/20">|</span>
            <span className="text-white font-semibold text-sm">🤖 Agent Studio</span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-white/70">
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-amber-400"
              />
              <span>{totalWorking} 工作中</span>
            </div>
            <div className="text-xs text-white/70">
              ✓ 累计完成 <span className="text-green-400 font-semibold">{totalCompleted}</span> 项
            </div>
            <div className="text-xs text-white/50 hidden sm:block">
              拖拽分配 · 点击对话 · 按住🎤说话
            </div>
          </div>
        </div>
      </header>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <main
          className="max-w-6xl mx-auto px-4 py-6"
          onClick={() => isPanelOpen && closePanel()}
        >
          {/* Hero text */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-2xl font-bold text-white mb-1">Agent 控制台</h1>
            <p className="text-sm text-white/50">
              将 Agent 拖入工作区域开始任务 · 点击角色进行对话和语音交互
            </p>
          </motion.div>

          {/* Zones grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {zones.map((zone, i) => (
              <motion.div
                key={zone.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Zone zone={zone} />
              </motion.div>
            ))}
          </div>

          {/* Agent status legend */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 flex flex-wrap justify-center gap-3"
          >
            {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([status, cfg]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-white/50">
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.ring.replace('ring-', 'bg-')}`} />
                <span>{cfg.label}</span>
              </div>
            ))}
            <span className="text-white/30 text-xs">· 点击角色查看详情 / 语音对话</span>
          </motion.div>

          {/* Tip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-4 text-center"
          >
            <div className="inline-flex items-center gap-2 text-xs text-white/30 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <span>💡</span>
              <span>语音支持 AI 上下文纠错：说「查一下阿里云时烂」会自动修正为「实例」</span>
            </div>
          </motion.div>
        </main>

        {/* Drag overlay — ghost while dragging */}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeAgent && (
            <div className="opacity-80 scale-110 rotate-6 pointer-events-none">
              <AgentCharacter agent={activeAgent} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Side panel */}
      <AgentPanel />

      {/* Notifications */}
      <Notifications />
    </div>
  )
}
