'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useStudioStore } from '@/stores/studioStore'

interface Point { x: number; y: number }

interface Edge {
  fromId: string
  toId: string
  fromColor: string
  toColor: string
  from: Point
  to: Point
}

function midCurve(from: Point, to: Point) {
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  // Offset control point perpendicular to midpoint for a gentle arc
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const offset = Math.min(40, len * 0.25)
  const cx = mx - (dy / len) * offset
  const cy = my + (dx / len) * offset
  return `M${from.x},${from.y} Q${cx},${cy} ${to.x},${to.y}`
}

export default function WorkflowEdges({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const agents = useStudioStore(s => s.agents)
  const [edges, setEdges] = useState<Edge[]>([])
  const frameRef = useRef<number>(0)

  const computeEdges = useCallback(() => {
    if (!containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()

    const positions: Record<string, Point> = {}
    for (const agent of agents) {
      const el = containerRef.current.querySelector(`[data-agent-id="${agent.id}"]`)
      if (el) {
        const r = el.getBoundingClientRect()
        positions[agent.id] = {
          x: r.left - containerRect.left + r.width / 2,
          y: r.top - containerRect.top + r.height / 2,
        }
      }
    }

    const newEdges: Edge[] = []
    for (const agent of agents) {
      if (!agent.workflowLinks?.length) continue
      const from = positions[agent.id]
      if (!from) continue
      for (const targetId of agent.workflowLinks) {
        const to = positions[targetId]
        if (!to) continue
        const targetAgent = agents.find(a => a.id === targetId)
        newEdges.push({
          fromId: agent.id,
          toId: targetId,
          fromColor: agent.color,
          toColor: targetAgent?.color ?? '#888',
          from,
          to,
        })
      }
    }
    setEdges(newEdges)
  }, [agents, containerRef])

  useEffect(() => {
    const tick = () => {
      computeEdges()
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [computeEdges])

  if (!edges.length) return null

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {edges.map((e, i) => (
          <marker
            key={`arrow-${i}`}
            id={`arrow-${i}`}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L6,3 z" fill={e.toColor} opacity={0.6} />
          </marker>
        ))}
        {edges.map((e, i) => (
          <linearGradient
            key={`grad-${i}`}
            id={`grad-${i}`}
            x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={e.fromColor} stopOpacity={0.5} />
            <stop offset="100%" stopColor={e.toColor} stopOpacity={0.5} />
          </linearGradient>
        ))}
      </defs>

      {edges.map((e, i) => (
        <g key={`edge-${e.fromId}-${e.toId}`}>
          {/* Shadow */}
          <path
            d={midCurve(e.from, e.to)}
            fill="none"
            stroke="black"
            strokeWidth={3}
            strokeOpacity={0.15}
            strokeDasharray="5 4"
          />
          {/* Main line */}
          <path
            d={midCurve(e.from, e.to)}
            fill="none"
            stroke={`url(#grad-${i})`}
            strokeWidth={1.5}
            strokeOpacity={0.7}
            strokeDasharray="5 4"
            markerEnd={`url(#arrow-${i})`}
          >
            <animate
              attributeName="stroke-dashoffset"
              from="18"
              to="0"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ))}
    </svg>
  )
}
