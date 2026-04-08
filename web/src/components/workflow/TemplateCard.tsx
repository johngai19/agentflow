'use client'

// ─── TemplateCard ─────────────────────────────────────────────────────────────
//
// Displays a single workflow template with a mini node-count preview,
// category badge, and a one-click "Use Template" action.

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { WorkflowTemplate } from '@/data/workflowTemplates'
import { TEMPLATE_CATEGORIES } from '@/data/workflowTemplates'

// ─── Mini DAG preview ─────────────────────────────────────────────────────────

function MiniDAGPreview({ template }: { template: WorkflowTemplate }) {
  const nodes = template.definition.nodes.slice(0, 6)
  const edges = template.definition.edges

  // Simple linear layout for preview (up to 6 nodes, 80px each)
  const W = 280
  const H = 60
  const nodeR = 8
  // Build a basic x-position per node based on topological depth
  const depthMap = new Map<string, number>()
  const nodeIds = new Set(nodes.map(n => n.id))

  function getDepth(nodeId: string, visited = new Set<string>()): number {
    if (depthMap.has(nodeId)) return depthMap.get(nodeId)!
    if (visited.has(nodeId)) return 0
    visited.add(nodeId)
    const inEdges = edges.filter(e => e.to === nodeId && nodeIds.has(e.from))
    if (inEdges.length === 0) {
      depthMap.set(nodeId, 0)
      return 0
    }
    const maxParentDepth = Math.max(...inEdges.map(e => getDepth(e.from, new Set(visited))))
    const d = maxParentDepth + 1
    depthMap.set(nodeId, d)
    return d
  }

  nodes.forEach(n => getDepth(n.id))

  const maxDepth = Math.max(...Array.from(depthMap.values()), 0)
  const colSpacing = maxDepth > 0 ? (W - nodeR * 2 - 16) / maxDepth : 0

  function xForNode(nodeId: string): number {
    const d = depthMap.get(nodeId) ?? 0
    return nodeR + 8 + d * colSpacing
  }

  // Y: spread nodes at the same depth vertically
  const depthCount = new Map<number, number>()
  const depthIndex = new Map<string, number>()
  nodes.forEach(n => {
    const d = depthMap.get(n.id) ?? 0
    const idx = depthCount.get(d) ?? 0
    depthIndex.set(n.id, idx)
    depthCount.set(d, idx + 1)
  })

  function yForNode(nodeId: string): number {
    const d = depthMap.get(nodeId) ?? 0
    const count = depthCount.get(d) ?? 1
    const idx = depthIndex.get(nodeId) ?? 0
    if (count === 1) return H / 2
    return (H / (count + 1)) * (idx + 1)
  }

  const nodeTypeColors: Record<string, string> = {
    agent: '#6366f1',
    condition: '#eab308',
    parallel_fork: '#06b6d4',
    parallel_join: '#06b6d4',
    approval: '#f97316',
    timer: '#a855f7',
    subworkflow: '#14b8a6',
    notification: '#22c55e',
    loop: '#f43f5e',
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-14 opacity-70"
      aria-hidden="true"
    >
      {/* Edges */}
      {edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to)).map(edge => (
        <line
          key={edge.id}
          x1={xForNode(edge.from)}
          y1={yForNode(edge.from)}
          x2={xForNode(edge.to)}
          y2={yForNode(edge.to)}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1.5}
          markerEnd="none"
        />
      ))}
      {/* Nodes */}
      {nodes.map(node => {
        const cx = xForNode(node.id)
        const cy = yForNode(node.id)
        const color = nodeTypeColors[node.type] ?? '#6b7280'
        return (
          <g key={node.id}>
            <circle cx={cx} cy={cy} r={nodeR} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.5} />
            {node.isStart && <circle cx={cx} cy={cy} r={nodeR + 3} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.5} />}
          </g>
        )
      })}
      {nodes.length > 6 && (
        <text x={W - 20} y={H / 2 + 4} fontSize={9} fill="rgba(255,255,255,0.3)" textAnchor="middle">
          +{template.definition.nodes.length - 6}
        </text>
      )}
    </svg>
  )
}

// ─── Category badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: WorkflowTemplate['category'] }) {
  const cfg = TEMPLATE_CATEGORIES[category]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${cfg.color}`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  )
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────

export interface TemplateCardProps {
  template: WorkflowTemplate
  onUse: (template: WorkflowTemplate) => void
  className?: string
}

export function TemplateCard({ template, onUse, className = '' }: TemplateCardProps) {
  const [pressed, setPressed] = useState(false)

  function handleUse() {
    setPressed(true)
    setTimeout(() => setPressed(false), 600)
    onUse(template)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.015 }}
      transition={{ duration: 0.2 }}
      className={`
        flex flex-col bg-slate-900 border border-white/10 rounded-xl overflow-hidden
        hover:border-indigo-500/40 transition-colors duration-200 ${className}
      `}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-start gap-3">
        <span className="text-3xl flex-shrink-0 leading-none mt-0.5">{template.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white/90 leading-snug">{template.name}</h3>
          <p className="text-[11px] text-white/45 mt-0.5 line-clamp-2 leading-relaxed">{template.description}</p>
        </div>
      </div>

      {/* Mini DAG preview */}
      <div className="px-3 py-1 border-t border-b border-white/5 bg-slate-950/40">
        <MiniDAGPreview template={template} />
      </div>

      {/* Meta row */}
      <div className="px-4 pt-2.5 pb-1 flex flex-wrap items-center gap-2">
        <CategoryBadge category={template.category} />
        <span className="text-[10px] text-white/30">
          {template.nodeCount} 节点
        </span>
        <span className="text-[10px] text-white/20">·</span>
        <span className="text-[10px] text-white/30">
          预计 {template.estimatedDuration}
        </span>
      </div>

      {/* Tags */}
      <div className="px-4 pb-2 flex flex-wrap gap-1">
        {template.tags.map(tag => (
          <span
            key={tag}
            className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 border border-white/5"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Action */}
      <div className="px-4 pb-4 mt-auto pt-2 border-t border-white/5">
        <button
          onClick={handleUse}
          disabled={pressed}
          className={`
            w-full py-2 text-xs font-semibold rounded-lg border transition-all duration-200
            ${pressed
              ? 'bg-green-500/20 border-green-500/40 text-green-300'
              : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 hover:border-indigo-400/60'}
          `}
        >
          {pressed ? '✓ 已创建' : '使用此模板'}
        </button>
      </div>
    </motion.div>
  )
}
