'use client'

/**
 * AgentSprite — CSS-animated SVG character.
 *
 * Design inspired by AI Town / minion aesthetics:
 *  - Rounded pill body with a coloured outfit
 *  - Eyes that blink, spin (working), or widen (reporting)
 *  - Arms that animate depending on status
 *  - Walking legs when the agent is assigned/moving
 *  - Speech bubble when talking
 *  - Tool accessory badge above the head
 *
 * Every animation is pure CSS keyframes (no heavy engine dependency).
 */

import { useEffect, useState } from 'react'
import type { Agent } from '@/data/studioData'

interface AgentSpriteProps {
  agent: Agent
  size?: number   // px, default 64
  selected?: boolean
}

// Tool → emoji badge
const TOOL_BADGE: Record<string, string> = {
  kubectl: '☸️',
  terraform: '🏗️',
  docker: '🐳',
  security_scan: '🔍',
  data_analysis: '📈',
  cost_analysis: '💰',
  code_review: '👓',
  orchestrate: '👑',
  monitoring: '📡',
  aliyun_ecs: '☁️',
}

function getToolBadge(tools: string[]) {
  for (const t of tools) {
    if (TOOL_BADGE[t]) return TOOL_BADGE[t]
  }
  return null
}

// Hex → rgba helper
function hexAlpha(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function AgentSprite({ agent, size = 64, selected = false }: AgentSpriteProps) {
  const [blink, setBlink] = useState(false)
  const badge = getToolBadge(agent.tools)
  const c = agent.color

  // Autonomous blink every 3-5 seconds
  useEffect(() => {
    const schedule = () => {
      const delay = 3000 + Math.random() * 2000
      return setTimeout(() => {
        setBlink(true)
        setTimeout(() => { setBlink(false); schedule() }, 140)
      }, delay)
    }
    const id = schedule()
    return () => clearTimeout(id)
  }, [])

  const S = size          // shorthand
  const cx = S / 2        // centre x
  const bodyH = S * 0.55  // body height
  const bodyY = S * 0.28  // body top
  const headR = S * 0.20  // head radius
  const headCY = S * 0.22 // head centre Y

  // Eye parameters
  const eyeRx = S * 0.055
  const eyeRy = blink || agent.status === 'error' ? S * 0.01 : S * 0.055
  const eyeY = headCY + S * 0.02

  // Arm angles by status
  const armAngle =
    agent.status === 'working'   ? -40 :
    agent.status === 'reporting' ? -70 :
    agent.status === 'assigned'  ? -20 : 0

  return (
    <div
      className="relative inline-flex flex-col items-center select-none"
      style={{ width: S, height: S + 20 }}
    >
      {/* ── CSS animation keyframes (injected once per sprite, deduplicated by id) ── */}
      <style>{`
        @keyframes sprite-bob {
          0%,100% { transform: translateY(0px) }
          50%     { transform: translateY(-4px) }
        }
        @keyframes sprite-shake {
          0%,100% { transform: rotate(0deg) }
          20%     { transform: rotate(-8deg) }
          40%     { transform: rotate(8deg) }
          60%     { transform: rotate(-6deg) }
          80%     { transform: rotate(6deg) }
        }
        @keyframes sprite-bounce {
          0%,100% { transform: translateY(0) scaleY(1) }
          40%     { transform: translateY(-10px) scaleY(1.08) }
          60%     { transform: translateY(-12px) scaleY(1.10) }
        }
        @keyframes sprite-error {
          0%,100% { transform: translateX(0) }
          25%     { transform: translateX(-4px) }
          75%     { transform: translateX(4px) }
        }
        @keyframes sprite-walk-l {
          0%,100% { transform: rotate(25deg) }
          50%     { transform: rotate(-25deg) }
        }
        @keyframes sprite-walk-r {
          0%,100% { transform: rotate(-25deg) }
          50%     { transform: rotate(25deg) }
        }
        @keyframes sprite-spin-eye {
          from { transform: rotate(0deg) }
          to   { transform: rotate(360deg) }
        }
        @keyframes sprite-pulse-eye {
          0%,100% { rx: ${eyeRx}; ry: ${eyeRy} }
          50%     { rx: ${S * 0.07}; ry: ${S * 0.07} }
        }
        @keyframes sprite-talk {
          0%,100% { transform: scaleY(1) }
          50%     { transform: scaleY(0.3) }
        }
      `}</style>

      {/* ── Selection glow ────────────────────────────────────────────────── */}
      {selected && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: S * 0.05,
            boxShadow: `0 0 0 3px ${c}, 0 0 16px ${hexAlpha(c, 0.5)}`,
            borderRadius: '50%',
          }}
        />
      )}

      {/* ── Main SVG character ───────────────────────────────────────────── */}
      <svg
        width={S}
        height={S}
        viewBox={`0 0 ${S} ${S}`}
        style={{
          animation:
            agent.status === 'idle'      ? `sprite-bob 2.5s ease-in-out infinite` :
            agent.status === 'working'   ? `sprite-shake 0.8s ease-in-out infinite` :
            agent.status === 'reporting' ? `sprite-bounce 0.55s ease-in-out infinite` :
            agent.status === 'error'     ? `sprite-error 0.4s linear infinite` :
            agent.status === 'assigned'  ? `sprite-bob 1.4s ease-in-out infinite` :
            undefined,
          overflow: 'visible',
        }}
      >
        <defs>
          {/* Body gradient */}
          <linearGradient id={`bg-${agent.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} />
            <stop offset="100%" stopColor={hexAlpha(c, 0.65)} />
          </linearGradient>
          {/* Shine */}
          <radialGradient id={`shine-${agent.id}`} cx="35%" cy="30%" r="45%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* ── Shadow ────────────────────────────────────────────────────── */}
        <ellipse cx={cx} cy={S * 0.97} rx={S * 0.22} ry={S * 0.04}
          fill="rgba(0,0,0,0.18)" />

        {/* ── Legs (walking when assigned/working) ──────────────────────── */}
        <g transform={`translate(${cx},${bodyY + bodyH})`}>
          <rect
            x={-S * 0.10} y={0} width={S * 0.12} height={S * 0.14}
            rx={S * 0.04} fill={hexAlpha(c, 0.8)}
            style={
              agent.status === 'assigned' || agent.status === 'working'
                ? { animation: `sprite-walk-l 0.55s ease-in-out infinite`, transformOrigin: `${S * 0.04}px 0` }
                : undefined
            }
          />
          <rect
            x={S * 0.02} y={0} width={S * 0.12} height={S * 0.14}
            rx={S * 0.04} fill={hexAlpha(c, 0.8)}
            style={
              agent.status === 'assigned' || agent.status === 'working'
                ? { animation: `sprite-walk-r 0.55s ease-in-out infinite`, transformOrigin: `${S * 0.04}px 0` }
                : undefined
            }
          />
        </g>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <rect
          x={cx - S * 0.22} y={bodyY}
          width={S * 0.44} height={bodyH}
          rx={S * 0.13}
          fill={`url(#bg-${agent.id})`}
        />
        {/* Shine overlay */}
        <rect
          x={cx - S * 0.22} y={bodyY}
          width={S * 0.44} height={bodyH}
          rx={S * 0.13}
          fill={`url(#shine-${agent.id})`}
        />

        {/* ── Outfit detail line ─────────────────────────────────────────── */}
        <line
          x1={cx - S * 0.18} y1={bodyY + bodyH * 0.42}
          x2={cx + S * 0.18} y2={bodyY + bodyH * 0.42}
          stroke="rgba(255,255,255,0.25)" strokeWidth={S * 0.015}
        />

        {/* ── Arms ──────────────────────────────────────────────────────── */}
        {/* Left arm */}
        <rect
          x={cx - S * 0.38} y={bodyY + S * 0.06}
          width={S * 0.16} height={S * 0.28}
          rx={S * 0.05} fill={hexAlpha(c, 0.75)}
          style={{
            transformOrigin: `${cx - S * 0.22}px ${bodyY + S * 0.06}px`,
            transform: `rotate(${-armAngle}deg)`,
            transition: 'transform 0.4s ease',
          }}
        />
        {/* Right arm */}
        <rect
          x={cx + S * 0.22} y={bodyY + S * 0.06}
          width={S * 0.16} height={S * 0.28}
          rx={S * 0.05} fill={hexAlpha(c, 0.75)}
          style={{
            transformOrigin: `${cx + S * 0.22}px ${bodyY + S * 0.06}px`,
            transform: `rotate(${armAngle}deg)`,
            transition: 'transform 0.4s ease',
          }}
        />

        {/* ── Head ──────────────────────────────────────────────────────── */}
        <circle cx={cx} cy={headCY} r={headR}
          fill={`url(#bg-${agent.id})`} />
        <circle cx={cx} cy={headCY} r={headR}
          fill={`url(#shine-${agent.id})`} />

        {/* ── Eyes ──────────────────────────────────────────────────────── */}
        {agent.status === 'working' ? (
          /* Spinning gear eyes */
          <>
            <g style={{ transformOrigin: `${cx - S * 0.08}px ${eyeY}px`, animation: 'sprite-spin-eye 0.9s linear infinite' }}>
              <circle cx={cx - S * 0.08} cy={eyeY} r={S * 0.055} fill="white" />
              <circle cx={cx - S * 0.08} cy={eyeY} r={S * 0.025} fill={c} />
            </g>
            <g style={{ transformOrigin: `${cx + S * 0.08}px ${eyeY}px`, animation: 'sprite-spin-eye 0.9s linear infinite reverse' }}>
              <circle cx={cx + S * 0.08} cy={eyeY} r={S * 0.055} fill="white" />
              <circle cx={cx + S * 0.08} cy={eyeY} r={S * 0.025} fill={c} />
            </g>
          </>
        ) : (
          /* Normal eyes with blink */
          <>
            <ellipse cx={cx - S * 0.08} cy={eyeY} rx={eyeRx} ry={eyeRy} fill="white"
              style={{ transition: 'ry 0.07s ease' }} />
            <ellipse cx={cx + S * 0.08} cy={eyeY} rx={eyeRx} ry={eyeRy} fill="white"
              style={{ transition: 'ry 0.07s ease' }} />
            {!blink && (
              <>
                <circle cx={cx - S * 0.08} cy={eyeY} r={S * 0.025} fill={c} />
                <circle cx={cx + S * 0.08} cy={eyeY} r={S * 0.025} fill={c} />
                {/* Highlight specks */}
                <circle cx={cx - S * 0.065} cy={eyeY - S * 0.015} r={S * 0.01} fill="white" />
                <circle cx={cx + S * 0.095} cy={eyeY - S * 0.015} r={S * 0.01} fill="white" />
              </>
            )}
          </>
        )}

        {/* ── Mouth ─────────────────────────────────────────────────────── */}
        {agent.status === 'reporting' ? (
          /* Talking — animated mouth */
          <ellipse
            cx={cx} cy={headCY + S * 0.10}
            rx={S * 0.07} ry={S * 0.04}
            fill="rgba(0,0,0,0.55)"
            style={{ animation: 'sprite-talk 0.35s ease-in-out infinite', transformOrigin: `${cx}px ${headCY + S * 0.10}px` }}
          />
        ) : agent.status === 'error' ? (
          /* Sad mouth */
          <path
            d={`M ${cx - S * 0.07} ${headCY + S * 0.12} Q ${cx} ${headCY + S * 0.07} ${cx + S * 0.07} ${headCY + S * 0.12}`}
            fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={S * 0.025} strokeLinecap="round"
          />
        ) : (
          /* Happy curve */
          <path
            d={`M ${cx - S * 0.07} ${headCY + S * 0.10} Q ${cx} ${headCY + S * 0.16} ${cx + S * 0.07} ${headCY + S * 0.10}`}
            fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={S * 0.025} strokeLinecap="round"
          />
        )}

        {/* ── Emoji overprint on body (role icon) ───────────────────────── */}
        <text
          x={cx} y={bodyY + bodyH * 0.72}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={S * 0.20}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >{agent.emoji}</text>
      </svg>

      {/* ── Tool badge ───────────────────────────────────────────────────── */}
      {badge && (
        <span
          className="absolute text-xs"
          style={{ top: -2, right: -2, fontSize: S * 0.22 }}
        >{badge}</span>
      )}

      {/* ── Name + status ────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center mt-0.5 leading-tight">
        <span className="text-xs font-semibold text-foreground">{agent.name}</span>
        {agent.isOrchestrator && (
          <span className="text-[9px] text-amber-500 font-medium">总管</span>
        )}
      </div>
    </div>
  )
}
