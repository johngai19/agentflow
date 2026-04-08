'use client'

import { useCallback, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
} from '@dnd-kit/core'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { NodePalette } from '@/components/workflow/NodePalette'
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas'
import { NodeConfigPanel } from '@/components/workflow/NodeConfigPanel'
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore'
import { NODE_TYPE_MAP } from '@/components/workflow/nodes/nodeConfig'
import type { WorkflowNodeType } from '@/types/workflow'

// ─── Version history panel ────────────────────────────────────────────────────

function VersionHistoryPanel({ onClose }: { onClose: () => void }) {
  const workflow = useWorkflowDesignerStore(s => s.getActiveWorkflow())
  const snapshotVersion = useWorkflowDesignerStore(s => s.snapshotVersion)
  const restoreVersion = useWorkflowDesignerStore(s => s.restoreVersion)
  const [comment, setComment] = useState('')

  if (!workflow) return null

  return (
    <div className="absolute right-4 top-14 w-72 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
        <span className="text-xs font-semibold text-white/70">版本历史 (v{workflow.currentVersion})</span>
        <button onClick={onClose} className="text-white/30 hover:text-white/60 text-sm">✕</button>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="版本说明（可选）"
            className="flex-1 bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-indigo-500/60"
          />
          <button
            onClick={() => { snapshotVersion(comment || undefined); setComment('') }}
            className="px-2.5 py-1 text-xs bg-indigo-500/30 border border-indigo-500/50 text-indigo-300 rounded hover:bg-indigo-500/40 transition-colors"
          >
            保存快照
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {workflow.versions.length === 0 && (
            <div className="text-[10px] text-white/30 text-center py-4">暂无历史版本</div>
          )}
          {[...workflow.versions].reverse().map(v => (
            <div key={v.version} className="flex items-center gap-2 px-2 py-1.5 rounded bg-slate-800/50 text-xs">
              <span className="text-indigo-400 font-mono font-semibold">v{v.version}</span>
              <span className="text-white/40 flex-1 truncate">{v.comment ?? '无说明'}</span>
              <span className="text-white/20 text-[10px]">{new Date(v.createdAt).toLocaleDateString()}</span>
              <button
                onClick={() => restoreVersion(workflow.id, v.version)}
                className="text-[10px] text-yellow-400/70 hover:text-yellow-300 transition-colors"
              >
                恢复
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Workflow list sidebar ─────────────────────────────────────────────────────

function WorkflowListSidebar({ onClose }: { onClose: () => void }) {
  const workflows = useWorkflowDesignerStore(s => s.workflows)
  const activeWorkflowId = useWorkflowDesignerStore(s => s.activeWorkflowId)
  const loadWorkflow = useWorkflowDesignerStore(s => s.loadWorkflow)
  const createWorkflow = useWorkflowDesignerStore(s => s.createWorkflow)
  const deleteWorkflow = useWorkflowDesignerStore(s => s.deleteWorkflow)
  const duplicateWorkflow = useWorkflowDesignerStore(s => s.duplicateWorkflow)

  return (
    <div className="absolute left-64 top-14 w-72 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
        <span className="text-xs font-semibold text-white/70">工作流列表</span>
        <button onClick={onClose} className="text-white/30 hover:text-white/60 text-sm">✕</button>
      </div>
      <div className="p-2 space-y-1 max-h-96 overflow-y-auto">
        {workflows.map(wf => (
          <div
            key={wf.id}
            className={`
              flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors group
              ${wf.id === activeWorkflowId ? 'bg-indigo-500/20 border border-indigo-500/40' : 'hover:bg-slate-800'}
            `}
            onClick={() => { loadWorkflow(wf.id); onClose() }}
          >
            <span className="text-base flex-shrink-0">{wf.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white/80 truncate">{wf.name}</div>
              <div className="text-[10px] text-white/30">{wf.nodes.length} 节点 · v{wf.currentVersion}</div>
            </div>
            <div className="hidden group-hover:flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); duplicateWorkflow(wf.id) }}
                className="text-[10px] text-white/40 hover:text-white/70 px-1 py-0.5 rounded"
                title="复制"
              >
                ⧉
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteWorkflow(wf.id) }}
                className="text-[10px] text-red-400/60 hover:text-red-300 px-1 py-0.5 rounded"
                title="删除"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-white/10">
        <button
          onClick={() => { createWorkflow(); onClose() }}
          className="w-full py-1.5 text-xs bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 rounded-lg hover:bg-indigo-500/30 transition-colors"
        >
          + 新建工作流
        </button>
      </div>
    </div>
  )
}

// ─── Main designer page ────────────────────────────────────────────────────────

export default function WorkflowDesignerPage() {
  const workflow = useWorkflowDesignerStore(s => s.getActiveWorkflow())
  const workflows = useWorkflowDesignerStore(s => s.workflows)
  const isDirty = useWorkflowDesignerStore(s => s.isDirty)
  const mode = useWorkflowDesignerStore(s => s.mode)
  const addNode = useWorkflowDesignerStore(s => s.addNode)
  const loadWorkflow = useWorkflowDesignerStore(s => s.loadWorkflow)
  const createWorkflow = useWorkflowDesignerStore(s => s.createWorkflow)
  const saveWorkflow = useWorkflowDesignerStore(s => s.saveWorkflow)
  const snapshotVersion = useWorkflowDesignerStore(s => s.snapshotVersion)
  const setMode = useWorkflowDesignerStore(s => s.setMode)
  const resetViewport = useWorkflowDesignerStore(s => s.resetViewport)

  const [showVersions, setShowVersions] = useState(false)
  const [showWorkflowList, setShowWorkflowList] = useState(false)
  const [dragOverlay, setDragOverlay] = useState<WorkflowNodeType | null>(null)

  // Load sample workflow on first render if none active
  const activeWorkflowId = useWorkflowDesignerStore(s => s.activeWorkflowId)
  if (!activeWorkflowId && workflows.length > 0) {
    loadWorkflow(workflows[0].id)
  }

  // ── DnD for palette → canvas ───────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDragOverlay(null)
    const { active, over } = event
    if (over?.id === 'workflow-canvas' && active.data.current?.isPaletteItem) {
      const nodeType = active.data.current.nodeType as WorkflowNodeType
      // Place roughly in center of viewport
      addNode(nodeType, {
        x: 200 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      })
    }
  }, [addNode])

  const handleDragStart = useCallback((event: { active: { data: { current?: { nodeType?: WorkflowNodeType } } } }) => {
    if (event.active.data.current?.nodeType) {
      setDragOverlay(event.active.data.current.nodeType)
    }
  }, [])

  const modeButtons = [
    { id: 'select' as const, icon: '↖', label: '选择' },
    { id: 'connect' as const, icon: '↔', label: '连线' },
    { id: 'pan' as const, icon: '✋', label: '平移' },
  ]

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen bg-slate-950 text-foreground overflow-hidden">
        {/* ── Top toolbar ─────────────────────────────────────────────────────── */}
        <header className="flex items-center gap-3 px-4 h-12 border-b border-white/10 bg-slate-900/80 backdrop-blur-md flex-shrink-0">
          <Link href="/" className="text-white/50 hover:text-white/80 text-sm transition-colors">← 返回</Link>
          <span className="text-white/20">|</span>

          {/* Workflow selector */}
          <button
            onClick={() => setShowWorkflowList(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition-colors"
          >
            <span>{workflow?.icon ?? '🔄'}</span>
            <span>{workflow?.name ?? '选择工作流'}</span>
            <span className="text-white/30 text-xs">▾</span>
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="有未保存的更改" />}
          </button>

          <div className="flex-1" />

          {/* Mode buttons */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
            {modeButtons.map(btn => (
              <button
                key={btn.id}
                onClick={() => setMode(btn.id)}
                title={btn.label}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  mode === btn.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {btn.icon} {btn.label}
              </button>
            ))}
          </div>

          <button
            onClick={resetViewport}
            className="text-xs text-white/40 hover:text-white/70 px-2 py-1 rounded hover:bg-white/5 transition-colors"
            title="重置视图"
          >
            ⊞ 重置视图
          </button>

          {/* Version / Save */}
          <button
            onClick={() => setShowVersions(v => !v)}
            className="text-xs text-white/50 hover:text-white/80 px-2 py-1 rounded hover:bg-white/5 transition-colors"
          >
            📋 版本 {workflow ? `(v${workflow.currentVersion})` : ''}
          </button>
          <button
            onClick={() => { saveWorkflow(); snapshotVersion('手动保存') }}
            disabled={!isDirty}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              isDirty
                ? 'bg-indigo-500/30 border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/40'
                : 'bg-white/5 border-white/10 text-white/20 cursor-not-allowed'
            }`}
          >
            {isDirty ? '保存' : '已保存'}
          </button>

          {/* New workflow */}
          <button
            onClick={() => createWorkflow()}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/60 hover:text-white/80 hover:border-white/30 transition-colors"
          >
            + 新建
          </button>
        </header>

        {/* ── Main 3-column layout ────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Left: Node palette */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-56 flex-shrink-0 border-r border-white/10 overflow-y-auto p-3 bg-slate-900/60"
          >
            <NodePalette />
          </motion.div>

          {/* Center: Canvas */}
          <WorkflowCanvas className="flex-1" />

          {/* Right: Config panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-64 flex-shrink-0 border-l border-white/10 bg-slate-900/60 overflow-hidden"
          >
            <NodeConfigPanel className="h-full" />
          </motion.div>
        </div>

        {/* ── Overlays ──────────────────────────────────────────────────────────── */}
        {showVersions && workflow && (
          <VersionHistoryPanel onClose={() => setShowVersions(false)} />
        )}
        {showWorkflowList && (
          <WorkflowListSidebar onClose={() => setShowWorkflowList(false)} />
        )}
      </div>

      {/* Drag overlay ghost */}
      <DragOverlay dropAnimation={null}>
        {dragOverlay && (
          <div className={`
            flex items-center gap-2 px-3 py-2 rounded-lg border opacity-80 scale-105 pointer-events-none
            ${NODE_TYPE_MAP[dragOverlay].color} ${NODE_TYPE_MAP[dragOverlay].borderColor}
          `}>
            <span>{NODE_TYPE_MAP[dragOverlay].icon}</span>
            <span className="text-xs text-white/80">{NODE_TYPE_MAP[dragOverlay].label}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
