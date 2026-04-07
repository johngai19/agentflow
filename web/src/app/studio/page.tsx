'use client'

import { useState, useCallback, useRef } from 'react'
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
import ProjectGroupPanel from '@/components/studio/ProjectGroupPanel'
import KagentConfigPanel from '@/components/studio/KagentConfigPanel'
import WorkflowEdges from '@/components/studio/WorkflowEdges'
import { STATUS_CONFIG, type Agent } from '@/data/studioData'

export default function StudioPage() {
  const agents = useStudioStore(s => s.agents)
  const zones = useStudioStore(s => s.zones)
  const moveAgentToZone = useStudioStore(s => s.moveAgentToZone)

  const [activeAgent, setActiveAgent] = useState<Agent | null>(null)
  const [showWorkflow, setShowWorkflow] = useState(true)
  const mainRef = useRef<HTMLDivElement>(null)

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
  const orchestrator = agents.find(a => a.isOrchestrator)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/60 hover:text-white text-sm transition-colors">← 返回</Link>
            <span className="text-white/20">|</span>
            <span className="text-white font-semibold text-sm">🤖 Agent Studio</span>
            {orchestrator && (
              <div className="hidden sm:flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
                <span className="text-xs">{orchestrator.emoji}</span>
                <span className="text-xs text-amber-400">{orchestrator.name}</span>
                <span className="text-[10px] text-amber-500/70">总管</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-white/70">
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-amber-400"
              />
              <span>{totalWorking} 工作中</span>
            </div>
            <div className="text-xs text-white/70 hidden sm:block">
              ✓ <span className="text-green-400 font-semibold">{totalCompleted}</span> 完成
            </div>
            {/* Workflow toggle */}
            <button
              onClick={() => setShowWorkflow(v => !v)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                showWorkflow
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-white/5 border-white/20 text-white/40'
              }`}
            >
              {showWorkflow ? '↔ 工作流' : '↔ 显示工作流'}
            </button>
            <div className="text-xs text-white/30 hidden md:block">
              拖拽分配 · 点击对话 · 🎤 语音
            </div>
          </div>
        </div>
      </header>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
          {/* ── Left sidebar: controls ── */}
          <div className="hidden lg:flex flex-col gap-3 w-60 flex-shrink-0">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-white/80 font-semibold text-sm mb-1"
            >
              控制面板
            </motion.div>

            <ProjectGroupPanel />
            <KagentConfigPanel />

            {/* Status legend */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-black/30 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3"
            >
              <div className="text-[10px] text-white/50 mb-2 font-medium">状态图例</div>
              <div className="space-y-1.5">
                {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([status, cfg]) => (
                  <div key={status} className="flex items-center gap-2 text-[11px]">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className="text-white/60">{cfg.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Tips */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="bg-indigo-950/40 border border-indigo-700/30 rounded-xl px-3 py-2.5"
            >
              <div className="text-[10px] text-indigo-300/70 space-y-1">
                <div>💡 拖拽 Agent 到工作区</div>
                <div>💬 点击 Agent 开始对话</div>
                <div>🎤 AI 上下文语音纠错</div>
                <div>⊡ 切换弹窗/侧边栏模式</div>
                <div>☸️ 调整 Pod 数量扩缩容</div>
              </div>
            </motion.div>
          </div>

          {/* ── Main: zones + workflow ── */}
          <main
            ref={mainRef}
            className="flex-1 relative"
          >
            {/* Hero text */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6"
            >
              <h1 className="text-2xl font-bold text-white mb-1">Agent 控制台</h1>
              <p className="text-sm text-white/50">
                将 Agent 拖入工作区域开始任务 · 点击角色进行对话
              </p>
            </motion.div>

            {/* Zones grid with SVG overlay */}
            <div className="relative">
              {showWorkflow && <WorkflowEdges containerRef={mainRef} />}
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
            </div>

            {/* Mobile: project + kagent panels */}
            <div className="lg:hidden mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ProjectGroupPanel />
              <KagentConfigPanel />
            </div>
          </main>
        </div>

        {/* Drag overlay — ghost while dragging */}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeAgent && (
            <div className="opacity-80 scale-110 rotate-6 pointer-events-none">
              <AgentCharacter agent={activeAgent} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Side panel / modal */}
      <AgentPanel />

      {/* Notifications */}
      <Notifications />
    </div>
  )
}
