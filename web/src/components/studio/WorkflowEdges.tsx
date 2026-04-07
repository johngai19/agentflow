'use client'

import { useEffect, useRef, useState } from 'react'
import { useStudioStore } from '@/stores/studioStore'
import { agentPositionRegistry, type AgentPosition } from '@/lib/agentPositionRegistry'

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
  const workflowLinks = useStudioStore(s => s.workflowLinks)
  const [edges, setEdges] = useState<Edge[]>([])

  // Build a colour lookup from agents array (stable reference via useMemo-like approach)
  const agentsRef = useRef(agents)
  agentsRef.current = agents

  const workflowLinksRef = useRef(workflowLinks)
  workflowLinksRef.current = workflowLinks

  useEffect(() => {
    // Subscribe to registry — fires whenever any agent position changes.
    // No rAF loop, no per-frame DOM query.
    const unsubscribe = agentPositionRegistry.subscribe((positions: Map<string, AgentPosition>) => {
      const container = containerRef.current
      if (!container) return

      const containerRect = container.getBoundingClientRect()

      // Translate viewport-relative positions to container-relative
      const relPos = (vp: AgentPosition): Point => ({
        x: vp.x - containerRect.left,
        y: vp.y - containerRect.top,
      })

      const newEdges: Edge[] = []
      const currentAgents = agentsRef.current
      const currentLinks = workflowLinksRef.current

      // Collect all link pairs from the store (user-editable)
      for (const link of currentLinks) {
        const fromAgent = currentAgents.find(a => a.id === link.fromId)
        const toAgent = currentAgents.find(a => a.id === link.toId)
        if (!fromAgent || !toAgent) continue

        const fromVP = positions.get(link.fromId)
        const toVP = positions.get(link.toId)
        if (!fromVP || !toVP) continue

        newEdges.push({
          fromId: link.fromId,
          toId: link.toId,
          fromColor: fromAgent.color,
          toColor: toAgent.color,
          from: relPos(fromVP),
          to: relPos(toVP),
        })
      }

      setEdges(newEdges)
    })

    return unsubscribe
  }, [containerRef]) // workflowLinks / agents changes are picked up via refs

  // Re-compute edges when store links or agents change (the registry snapshot stays the same
  // but the logical connections may have changed).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const positions = agentPositionRegistry.snapshot()

    const relPos = (vp: AgentPosition): Point => ({
      x: vp.x - containerRect.left,
      y: vp.y - containerRect.top,
    })

    const newEdges: Edge[] = []
    for (const link of workflowLinks) {
      const fromAgent = agents.find(a => a.id === link.fromId)
      const toAgent = agents.find(a => a.id === link.toId)
      if (!fromAgent || !toAgent) continue

      const fromVP = positions.get(link.fromId)
      const toVP = positions.get(link.toId)
      if (!fromVP || !toVP) continue

      newEdges.push({
        fromId: link.fromId,
        toId: link.toId,
        fromColor: fromAgent.color,
        toColor: toAgent.color,
        from: relPos(fromVP),
        to: relPos(toVP),
      })
    }
    setEdges(newEdges)
  }, [agents, workflowLinks, containerRef])

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
