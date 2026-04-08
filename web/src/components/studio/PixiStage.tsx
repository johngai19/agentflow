"use client"

import { useEffect, useRef, useState } from 'react'
import type { Agent, Zone } from '@/data/studioData'

interface Props {
  agents: Agent[]
  zones: Zone[]
  onAgentClick: (agentId: string) => void
  onAgentDrop: (agentId: string, zoneId: string) => void
}

// Hex to number for Pixi
function hexColor(css: string): number {
  return parseInt(css.replace('#', ''), 16)
}

// Agent position in the canvas based on zone
function getZoneCenter(zoneId: string, zones: Zone[], canvasW: number, canvasH: number): { x: number; y: number } {
  const zoneList = zones.filter(z => z.id !== 'default')
  const idx = zoneList.findIndex(z => z.id === zoneId)
  if (zoneId === 'default' || idx === -1) {
    return { x: canvasW * 0.12, y: canvasH * 0.5 }
  }
  const cols = 2
  const col = idx % cols
  const row = Math.floor(idx / cols)
  const zoneW = (canvasW * 0.75) / cols
  const zoneH = (canvasH * 0.8) / Math.ceil(zoneList.length / cols)
  return {
    x: canvasW * 0.22 + col * zoneW + zoneW * 0.5,
    y: canvasH * 0.12 + row * zoneH + zoneH * 0.5,
  }
}

export default function PixiStage({ agents, zones, onAgentClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<unknown>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    let destroyed = false

    async function init() {
      const { Application, Graphics, Text, TextStyle, Container } = await import('pixi.js')
      if (destroyed) return

      const el = containerRef.current!
      const W = el.clientWidth || 800
      const H = el.clientHeight || 400

      const app = new Application()
      await app.init({
        width: W,
        height: H,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      appRef.current = app
      if (destroyed) { app.destroy(); return }
      el.appendChild(app.canvas as HTMLCanvasElement)

      // ── Draw zone backgrounds ──────────────────────────────────────────────
      const zoneList = zones.filter(z => z.id !== 'default')
      const cols = 2
      const zoneW = (W * 0.75) / cols
      const zoneH = (H * 0.8) / Math.ceil(zoneList.length / cols)
      const startX = W * 0.22
      const startY = H * 0.12

      const ZONE_COLORS: Record<string, number> = {
        cron: 0x1e1b4b, aliyun: 0x0c2340, deploy: 0x14292a, default: 0x1a1a2e,
      }

      zoneList.forEach((zone, idx) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const x = startX + col * zoneW
        const y = startY + row * zoneH
        const g = new Graphics()
        g.roundRect(x + 4, y + 4, zoneW - 8, zoneH - 8, 16)
        g.fill({ color: ZONE_COLORS[zone.id] ?? 0x1a1a2e, alpha: 0.6 })
        g.stroke({ color: 0x334155, width: 1, alpha: 0.8 })
        app.stage.addChild(g)

        // Zone label
        const label = new Text({
          text: `${zone.icon} ${zone.name}`,
          style: new TextStyle({ fill: '#94a3b8', fontSize: 11, fontWeight: '600', fontFamily: 'system-ui' }),
        })
        label.x = x + 12
        label.y = y + 10
        app.stage.addChild(label)
      })

      // ── Default zone (left strip) ─────────────────────────────────────────
      const dg = new Graphics()
      dg.roundRect(8, H * 0.1, W * 0.18, H * 0.8, 16)
      dg.fill({ color: 0x0f172a, alpha: 0.5 })
      dg.stroke({ color: 0x334155, width: 1 })
      app.stage.addChild(dg)
      const dlabel = new Text({ text: '🏠 待命区', style: new TextStyle({ fill: '#64748b', fontSize: 11, fontWeight: '600', fontFamily: 'system-ui' }) })
      dlabel.x = 18; dlabel.y = H * 0.1 + 10
      app.stage.addChild(dlabel)

      // ── Agent sprites ─────────────────────────────────────────────────────
      const agentContainers: Map<string, InstanceType<typeof Container>> = new Map()

      // Target positions (for smooth movement)
      const targets: Map<string, { x: number; y: number }> = new Map()

      agents.forEach((agent, aIdx) => {
        const container = new Container()
        container.eventMode = 'static'
        container.cursor = 'pointer'

        // Body circle
        const body = new Graphics()
        const color = hexColor(agent.color.replace('#', '') || '6366f1')
        body.circle(0, 0, 22)
        body.fill({ color, alpha: 0.85 })
        body.stroke({ color: 0xffffff, width: 2, alpha: 0.3 })
        container.addChild(body)

        // Emoji label
        const emoji = new Text({ text: agent.emoji, style: new TextStyle({ fontSize: 22, fontFamily: 'system-ui' }) })
        emoji.anchor.set(0.5, 0.5)
        emoji.x = 0; emoji.y = 1
        container.addChild(emoji)

        // Name tag
        const nameTag = new Text({
          text: agent.name,
          style: new TextStyle({ fill: '#e2e8f0', fontSize: 10, fontWeight: '700', fontFamily: 'system-ui' }),
        })
        nameTag.anchor.set(0.5, 0)
        nameTag.x = 0; nameTag.y = 26
        container.addChild(nameTag)

        // Status dot
        const dot = new Graphics()
        const dotColor = agent.status === 'working' ? 0xf59e0b
          : agent.status === 'reporting' ? 0x22c55e
          : agent.status === 'error' ? 0xef4444
          : agent.status === 'assigned' ? 0x3b82f6 : 0x64748b
        dot.circle(14, -14, 6)
        dot.fill(dotColor)
        dot.stroke({ color: 0x0f172a, width: 1.5 })
        container.addChild(dot)

        // Click handler
        container.on('pointerdown', () => onAgentClick(agent.id))

        // Initial position
        const defaultOffset = aIdx * 48 + 40
        const pos = agent.currentZone === 'default'
          ? { x: W * 0.09, y: H * 0.1 + defaultOffset }
          : getZoneCenter(agent.currentZone, zones, W, H)

        container.x = pos.x
        container.y = pos.y
        targets.set(agent.id, pos)
        agentContainers.set(agent.id, container)
        app.stage.addChild(container)
      })

      // ── Animation loop ────────────────────────────────────────────────────
      let t = 0
      app.ticker.add((ticker: { deltaTime: number }) => {
        t += ticker.deltaTime * 0.05
        agents.forEach((agent, aIdx) => {
          const ctr = agentContainers.get(agent.id)
          const target = targets.get(agent.id)
          if (!ctr || !target) return

          // Smooth movement
          ctr.x += (target.x - ctr.x) * 0.08
          ctr.y += (target.y - ctr.y) * 0.08

          // Idle float
          if (agent.status === 'idle' || agent.status === 'assigned') {
            ctr.y += Math.sin(t + aIdx * 1.5) * 0.3
          }
          // Working shake
          if (agent.status === 'working') {
            ctr.x += Math.sin(t * 8 + aIdx) * 0.4
            ctr.rotation = Math.sin(t * 6 + aIdx) * 0.04
          } else {
            ctr.rotation += (0 - ctr.rotation) * 0.1
          }
          // Reporting bounce
          if (agent.status === 'reporting') {
            ctr.y += Math.abs(Math.sin(t * 4 + aIdx)) * -0.6
          }
        })
      })

      setReady(true)
    }

    init()
    return () => {
      destroyed = true
      if (appRef.current) {
        const app = appRef.current as { destroy: (opts: unknown) => void }
        try { app.destroy({ removeView: true }) } catch {}
        appRef.current = null
      }
      setReady(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
          Loading canvas...
        </div>
      )}
    </div>
  )
}
