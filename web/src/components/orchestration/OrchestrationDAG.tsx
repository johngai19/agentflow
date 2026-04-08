"use client"

import { useRef, useEffect, useMemo } from 'react'
import type { Orchestration, OrchestrationRun, StepStatus } from '@/data/orchestrationData'

interface NodePos { x: number; y: number; w: number; h: number }

const STATUS_COLORS: Record<StepStatus, { bg: string; border: string; text: string; dot: string }> = {
  waiting:  { bg: '#1e293b', border: '#475569', text: '#94a3b8', dot: '#475569' },
  running:  { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd', dot: '#3b82f6' },
  success:  { bg: '#14532d', border: '#22c55e', text: '#86efac', dot: '#22c55e' },
  failed:   { bg: '#450a0a', border: '#ef4444', text: '#fca5a5', dot: '#ef4444' },
  skipped:  { bg: '#1c1917', border: '#78716c', text: '#a8a29e', dot: '#78716c' },
}

interface Props {
  orchestration: Orchestration
  run?: OrchestrationRun
  height?: number
}

export default function OrchestrationDAG({ orchestration, run, height = 320 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Compute topological levels
  const levels = useMemo(() => {
    const steps = orchestration.steps
    const inDegree: Record<string, number> = {}
    const children: Record<string, string[]> = {}
    steps.forEach(s => { inDegree[s.id] = 0; children[s.id] = [] })
    orchestration.edges.forEach(e => {
      inDegree[e.to] = (inDegree[e.to] || 0) + 1
      children[e.from].push(e.to)
    })

    const levels: string[][] = []
    let queue = steps.filter(s => inDegree[s.id] === 0).map(s => s.id)
    const visited = new Set<string>()

    while (queue.length > 0) {
      levels.push([...queue])
      queue.forEach(id => visited.add(id))
      const next: string[] = []
      queue.forEach(id => {
        children[id].forEach(child => {
          inDegree[child]--
          if (inDegree[child] === 0 && !visited.has(child)) next.push(child)
        })
      })
      queue = next
    }

    return levels
  }, [orchestration])

  // Compute node positions
  const nodePositions = useMemo(() => {
    const pos: Record<string, NodePos> = {}
    const nodeW = 160
    const nodeH = 60
    const padX = 60
    const gapX = 80
    const gapY = 30

    levels.forEach((level, col) => {
      const totalH = level.length * nodeH + (level.length - 1) * gapY
      const startY = (height - totalH) / 2
      level.forEach((stepId, row) => {
        pos[stepId] = {
          x: padX + col * (nodeW + gapX),
          y: startY + row * (nodeH + gapY),
          w: nodeW,
          h: nodeH,
        }
      })
    })
    return pos
  }, [levels, height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const W = rect.width
    ctx.clearRect(0, 0, W, height)

    // Draw edges
    orchestration.edges.forEach(edge => {
      const from = nodePositions[edge.from]
      const to = nodePositions[edge.to]
      if (!from || !to) return

      const stepRun = run?.stepRuns.find(sr => sr.stepId === edge.from)
      const isActive = stepRun?.status === 'success'
      const toRun = run?.stepRuns.find(sr => sr.stepId === edge.to)
      const isRunning = toRun?.status === 'running'

      ctx.beginPath()
      ctx.strokeStyle = isActive ? '#22c55e' : isRunning ? '#3b82f6' : '#334155'
      ctx.lineWidth = isActive || isRunning ? 2 : 1
      ctx.setLineDash(isActive ? [] : [5, 4])

      const x1 = from.x + from.w
      const y1 = from.y + from.h / 2
      const x2 = to.x
      const y2 = to.y + to.h / 2
      const cx = (x1 + x2) / 2

      ctx.moveTo(x1, y1)
      ctx.bezierCurveTo(cx, y1, cx, y2, x2, y2)
      ctx.stroke()
      ctx.setLineDash([])

      // Arrow head
      const angle = Math.atan2(y2 - y1, x2 - x1)
      ctx.fillStyle = isActive ? '#22c55e' : isRunning ? '#3b82f6' : '#334155'
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - 10 * Math.cos(angle - 0.4), y2 - 10 * Math.sin(angle - 0.4))
      ctx.lineTo(x2 - 10 * Math.cos(angle + 0.4), y2 - 10 * Math.sin(angle + 0.4))
      ctx.closePath()
      ctx.fill()
    })

    // Draw nodes
    orchestration.steps.forEach(step => {
      const pos = nodePositions[step.id]
      if (!pos) return
      const stepRun = run?.stepRuns.find(sr => sr.stepId === step.id)
      const status: StepStatus = stepRun?.status ?? 'waiting'
      const colors = STATUS_COLORS[status]

      const radius = 10
      ctx.beginPath()
      ctx.moveTo(pos.x + radius, pos.y)
      ctx.lineTo(pos.x + pos.w - radius, pos.y)
      ctx.arcTo(pos.x + pos.w, pos.y, pos.x + pos.w, pos.y + radius, radius)
      ctx.lineTo(pos.x + pos.w, pos.y + pos.h - radius)
      ctx.arcTo(pos.x + pos.w, pos.y + pos.h, pos.x + pos.w - radius, pos.y + pos.h, radius)
      ctx.lineTo(pos.x + radius, pos.y + pos.h)
      ctx.arcTo(pos.x, pos.y + pos.h, pos.x, pos.y + pos.h - radius, radius)
      ctx.lineTo(pos.x, pos.y + radius)
      ctx.arcTo(pos.x, pos.y, pos.x + radius, pos.y, radius)
      ctx.closePath()

      ctx.fillStyle = colors.bg
      ctx.fill()
      ctx.strokeStyle = colors.border
      ctx.lineWidth = status === 'running' ? 2 : 1.5
      ctx.stroke()

      // Running pulse ring
      if (status === 'running') {
        ctx.beginPath()
        ctx.roundRect(pos.x - 3, pos.y - 3, pos.w + 6, pos.h + 6, radius + 3)
        ctx.strokeStyle = `${colors.border}50`
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Status dot
      ctx.beginPath()
      ctx.arc(pos.x + 14, pos.y + pos.h / 2, 5, 0, Math.PI * 2)
      ctx.fillStyle = colors.dot
      ctx.fill()

      // Step name
      ctx.fillStyle = colors.text
      ctx.font = `600 12px system-ui, sans-serif`
      ctx.fillText(step.name, pos.x + 26, pos.y + pos.h / 2 - 5, pos.w - 32)

      // Duration or status
      const durText = stepRun?.finishedAt && stepRun.startedAt
        ? `${((stepRun.finishedAt - stepRun.startedAt) / 1000).toFixed(1)}s`
        : status === 'running' ? '运行中...'
        : status === 'waiting' ? '等待中'
        : status === 'skipped' ? '已跳过'
        : ''
      ctx.font = `11px system-ui, sans-serif`
      ctx.fillStyle = `${colors.text}99`
      ctx.fillText(durText, pos.x + 26, pos.y + pos.h / 2 + 10)
    })
  }, [orchestration, run, nodePositions, height])

  const totalWidth = levels.length * (160 + 80) + 120

  return (
    <div className="overflow-x-auto rounded-xl bg-slate-950 border border-slate-800">
      <canvas
        ref={canvasRef}
        style={{ width: Math.max(totalWidth, 600), height }}
        className="block"
      />
    </div>
  )
}
