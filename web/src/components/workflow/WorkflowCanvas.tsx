'use client'

import { useRef, useCallback, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore'
import { WorkflowNodeRenderer } from './nodes/WorkflowNodeRenderer'
import type { WorkflowNode, WorkflowEdge, WorkflowNodeType, Position } from '@/types/workflow'

// ─── Edge rendering (SVG) ─────────────────────────────────────────────────────

function bezierPath(from: Position, to: Position): string {
  const dx = Math.abs(to.x - from.x)
  const cy = Math.max(60, dx * 0.4)
  return `M${from.x},${from.y} C${from.x + cy},${from.y} ${to.x - cy},${to.y} ${to.x},${to.y}`
}

const CONDITION_COLORS: Record<string, string> = {
  always: '#64748b',
  on_success: '#22c55e',
  on_failure: '#ef4444',
  on_true: '#22c55e',
  on_false: '#ef4444',
}

interface CanvasEdgeProps {
  edge: WorkflowEdge
  fromNode: WorkflowNode | undefined
  toNode: WorkflowNode | undefined
  selected: boolean
  onClick: () => void
  /** offset to get from node top-left to its right-center port */
  nodeWidth?: number
  nodeHeight?: number
}

function CanvasEdge({ edge, fromNode, toNode, selected, onClick }: CanvasEdgeProps) {
  if (!fromNode || !toNode) return null

  // Approximate port positions: right-center of from, left-center of to
  const NODE_W = 175
  const NODE_H = 72
  const from: Position = { x: fromNode.position.x + NODE_W, y: fromNode.position.y + NODE_H / 2 }
  const to: Position = { x: toNode.position.x, y: toNode.position.y + NODE_H / 2 }

  const color = CONDITION_COLORS[edge.condition ?? 'always'] ?? '#64748b'
  const path = bezierPath(from, to)
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2

  return (
    <g onClick={onClick} className="cursor-pointer" style={{ pointerEvents: 'stroke' }}>
      {/* Wide invisible hit area */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={16} />
      {/* Shadow */}
      <path d={path} fill="none" stroke="#000" strokeWidth={3} strokeOpacity={0.15} />
      {/* Main edge */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeOpacity={selected ? 0.9 : 0.6}
        strokeDasharray={edge.condition === 'always' ? undefined : '6 4'}
        markerEnd="url(#arrowhead)"
      />
      {/* Animated flow dots for always/on_success */}
      {!selected && (edge.condition === 'always' || edge.condition === 'on_success') && (
        <circle r={3} fill={color} opacity={0.7}>
          <animateMotion dur="2s" repeatCount="indefinite" path={path} />
        </circle>
      )}
      {/* Edge label */}
      {edge.label && (
        <text x={midX} y={midY - 6} textAnchor="middle" fontSize={10} fill={color} opacity={0.8} fontFamily="system-ui">
          {edge.label}
        </text>
      )}
      {selected && (
        <circle cx={midX} cy={midY} r={5} fill={color} opacity={0.9} />
      )}
    </g>
  )
}

// ─── WorkflowCanvas ───────────────────────────────────────────────────────────

interface ConnectState {
  fromNodeId: string
  fromX: number
  fromY: number
  currentX: number
  currentY: number
}

interface WorkflowCanvasProps {
  className?: string
}

export function WorkflowCanvas({ className = '' }: WorkflowCanvasProps) {
  const workflow = useWorkflowDesignerStore(s => s.getActiveWorkflow())
  const selectedNodeIds = useWorkflowDesignerStore(s => s.selectedNodeIds)
  const selectedEdgeId = useWorkflowDesignerStore(s => s.selectedEdgeId)
  const mode = useWorkflowDesignerStore(s => s.mode)
  const viewport = useWorkflowDesignerStore(s => s.viewport)
  const selectNode = useWorkflowDesignerStore(s => s.selectNode)
  const selectEdge = useWorkflowDesignerStore(s => s.selectEdge)
  const clearSelection = useWorkflowDesignerStore(s => s.clearSelection)
  const moveNode = useWorkflowDesignerStore(s => s.moveNode)
  const addEdge = useWorkflowDesignerStore(s => s.addEdge)
  const addNode = useWorkflowDesignerStore(s => s.addNode)
  const setViewport = useWorkflowDesignerStore(s => s.setViewport)

  const containerRef = useRef<HTMLDivElement>(null)

  // ── DnD drop target for palette items ─────────────────────────────────────
  const { setNodeRef, isOver } = useDroppable({ id: 'workflow-canvas' })

  // ── Node dragging state ────────────────────────────────────────────────────
  const draggingNodeRef = useRef<{ nodeId: string; startMouseX: number; startMouseY: number; startNodeX: number; startNodeY: number } | null>(null)

  // ── Connect mode state ─────────────────────────────────────────────────────
  const [connectState, setConnectState] = useState<ConnectState | null>(null)

  // ── Pan state ──────────────────────────────────────────────────────────────
  const panRef = useRef<{ startX: number; startY: number; startVpX: number; startVpY: number } | null>(null)

  // Convert screen coords to canvas coords
  const screenToCanvas = useCallback((sx: number, sy: number): Position => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: sx, y: sy }
    return {
      x: (sx - rect.left - viewport.x) / viewport.scale,
      y: (sy - rect.top - viewport.y) / viewport.scale,
    }
  }, [viewport])

  // ── Pointer events ─────────────────────────────────────────────────────────
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (mode === 'pan' || e.button === 1) {
      panRef.current = { startX: e.clientX, startY: e.clientY, startVpX: viewport.x, startVpY: viewport.y }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    clearSelection()
  }, [mode, viewport, clearSelection])

  const handleNodePointerDown = useCallback((e: React.PointerEvent, node: WorkflowNode) => {
    e.stopPropagation()
    if (mode === 'connect') {
      const canvasPos = screenToCanvas(e.clientX, e.clientY)
      setConnectState({
        fromNodeId: node.id,
        fromX: node.position.x + 175,
        fromY: node.position.y + 36,
        currentX: canvasPos.x,
        currentY: canvasPos.y,
      })
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    selectNode(node.id, e.shiftKey)
    draggingNodeRef.current = {
      nodeId: node.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNodeX: node.position.x,
      startNodeY: node.position.y,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [mode, selectNode, screenToCanvas])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Pan
    if (panRef.current) {
      const dx = e.clientX - panRef.current.startX
      const dy = e.clientY - panRef.current.startY
      setViewport({ x: panRef.current.startVpX + dx, y: panRef.current.startVpY + dy })
      return
    }
    // Node drag
    if (draggingNodeRef.current) {
      const dx = (e.clientX - draggingNodeRef.current.startMouseX) / viewport.scale
      const dy = (e.clientY - draggingNodeRef.current.startMouseY) / viewport.scale
      moveNode(draggingNodeRef.current.nodeId, {
        x: draggingNodeRef.current.startNodeX + dx,
        y: draggingNodeRef.current.startNodeY + dy,
      })
      return
    }
    // Connect line tracking
    if (connectState) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY)
      setConnectState(prev => prev ? { ...prev, currentX: canvasPos.x, currentY: canvasPos.y } : null)
    }
  }, [viewport.scale, moveNode, connectState, screenToCanvas, setViewport])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    panRef.current = null
    draggingNodeRef.current = null
    if (connectState) {
      // Check if released over a node
      const target = document.elementFromPoint(e.clientX, e.clientY)
      const nodeEl = target?.closest('[data-node-id]') as HTMLElement | null
      const toNodeId = nodeEl?.dataset.nodeId
      if (toNodeId && toNodeId !== connectState.fromNodeId) {
        addEdge(connectState.fromNodeId, toNodeId, 'on_success')
      }
      setConnectState(null)
    }
  }, [connectState, addEdge])

  // ── Wheel zoom ─────────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.2, Math.min(3, viewport.scale * delta))
    // Zoom toward cursor
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setViewport({
        scale: newScale,
        x: cx - (cx - viewport.x) * (newScale / viewport.scale),
        y: cy - (cy - viewport.y) * (newScale / viewport.scale),
      })
    } else {
      setViewport({ scale: newScale })
    }
  }, [viewport, setViewport])

  if (!workflow) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="text-center text-white/30">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-sm">从左侧列表选择工作流，或新建一个</div>
        </div>
      </div>
    )
  }

  const NODE_W = 175
  const NODE_H = 72

  return (
    <div
      ref={(el) => {
        containerRef.current = el
        setNodeRef(el)
      }}
      className={`
        relative overflow-hidden bg-slate-950 select-none
        ${isOver ? 'ring-2 ring-inset ring-indigo-500/40' : ''}
        ${mode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
        ${className}
      `}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Grid background */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        <defs>
          <pattern
            id="grid"
            x={viewport.x % (20 * viewport.scale)}
            y={viewport.y % (20 * viewport.scale)}
            width={20 * viewport.scale}
            height={20 * viewport.scale}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={1} cy={1} r={0.5} fill="#334155" opacity={0.5} />
          </pattern>
          <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#64748b" opacity={0.8} />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Main transform group */}
      <div
        className="absolute"
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`, transformOrigin: '0 0', zIndex: 1 }}
      >
        {/* Edges SVG layer */}
        <svg
          className="absolute overflow-visible pointer-events-none"
          style={{ top: 0, left: 0, width: 1, height: 1, zIndex: 0, overflow: 'visible' }}
        >
          {workflow.edges.map(edge => (
            <CanvasEdge
              key={edge.id}
              edge={edge}
              fromNode={workflow.nodes.find(n => n.id === edge.from)}
              toNode={workflow.nodes.find(n => n.id === edge.to)}
              selected={edge.id === selectedEdgeId}
              onClick={() => selectEdge(edge.id)}
            />
          ))}

          {/* Connect-mode preview line */}
          {connectState && (
            <path
              d={bezierPath(
                { x: connectState.fromX, y: connectState.fromY },
                { x: connectState.currentX, y: connectState.currentY }
              )}
              fill="none"
              stroke="#6366f1"
              strokeWidth={2}
              strokeDasharray="6 4"
              opacity={0.8}
            />
          )}
        </svg>

        {/* Nodes */}
        {workflow.nodes.map(node => (
          <div
            key={node.id}
            data-node-id={node.id}
            className="absolute"
            style={{ left: node.position.x, top: node.position.y, width: NODE_W, minHeight: NODE_H, zIndex: 2 }}
            onPointerDown={(e) => handleNodePointerDown(e, node)}
          >
            <WorkflowNodeRenderer
              node={node}
              selected={selectedNodeIds.includes(node.id)}
              onClick={() => {}} // handled by pointer down for combined select+drag
            />
          </div>
        ))}
      </div>

      {/* Empty state */}
      {workflow.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 3 }}>
          <div className="text-center text-white/20">
            <div className="text-5xl mb-3">⊕</div>
            <div className="text-sm">从左侧面板拖拽节点到此处</div>
          </div>
        </div>
      )}

      {/* Viewport indicator */}
      <div className="absolute bottom-2 right-3 text-[10px] text-white/20 pointer-events-none" style={{ zIndex: 4 }}>
        {Math.round(viewport.scale * 100)}% · {workflow.nodes.length} 节点 · {workflow.edges.length} 连线
      </div>

      {/* Mode indicator */}
      <div className="absolute top-2 left-3 flex items-center gap-1.5 pointer-events-none" style={{ zIndex: 4 }}>
        {mode === 'connect' && (
          <span className="text-[10px] bg-indigo-500/30 border border-indigo-500/50 text-indigo-300 px-2 py-0.5 rounded-full">
            连线模式 — 点击起始节点后拖向目标
          </span>
        )}
        {mode === 'pan' && (
          <span className="text-[10px] bg-slate-700/60 border border-slate-600 text-slate-300 px-2 py-0.5 rounded-full">
            平移模式
          </span>
        )}
      </div>
    </div>
  )
}
