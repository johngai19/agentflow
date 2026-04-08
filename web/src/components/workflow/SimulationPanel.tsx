'use client'

// ─── SimulationPanel ──────────────────────────────────────────────────────────
//
// Renders a dry-run simulation control panel for a WorkflowDefinition.
// Shows per-step progress, node state badges, event log, and a summary.

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { WorkflowDefinition, WorkflowNodeRunState } from '@/types/workflow'
import {
  runSimulation,
  validateDAG,
  type SimulationOptions,
  type SimulationStepEvent,
  type SimulationResult,
  type DAGValidationError,
} from '@/lib/workflowSimulator'

// ─── Node state badge ─────────────────────────────────────────────────────────

function NodeStateBadge({ state }: { state: WorkflowNodeRunState['status'] }) {
  const map: Record<WorkflowNodeRunState['status'], { label: string; className: string }> = {
    waiting: { label: '等待', className: 'bg-white/5 text-white/30 border-white/10' },
    running: { label: '执行中', className: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse' },
    success: { label: '成功', className: 'bg-green-500/20 text-green-300 border-green-500/40' },
    failed: { label: '失败', className: 'bg-red-500/20 text-red-300 border-red-500/40' },
    skipped: { label: '跳过', className: 'bg-slate-700/50 text-white/20 border-white/5' },
  }
  const cfg = map[state]
  return (
    <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

// ─── Event log item ───────────────────────────────────────────────────────────

function EventLogItem({ event }: { event: SimulationStepEvent }) {
  const iconMap: Record<SimulationStepEvent['type'], string> = {
    node_start: '▶',
    node_success: '✓',
    node_skip: '⊘',
    node_error: '✕',
    workflow_complete: '🏁',
    workflow_error: '💥',
  }
  const colorMap: Record<SimulationStepEvent['type'], string> = {
    node_start: 'text-indigo-400',
    node_success: 'text-green-400',
    node_skip: 'text-white/25',
    node_error: 'text-red-400',
    workflow_complete: 'text-emerald-400',
    workflow_error: 'text-red-400',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-2 py-1"
    >
      <span className={`text-[11px] mt-0.5 flex-shrink-0 font-mono ${colorMap[event.type]}`}>
        {iconMap[event.type]}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] text-white/60">{event.message}</span>
      </div>
      <span className="text-[9px] text-white/20 flex-shrink-0 font-mono">
        {new Date(event.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}
      </span>
    </motion.div>
  )
}

// ─── Validation error ─────────────────────────────────────────────────────────

function ValidationErrors({ errors }: { errors: DAGValidationError[] }) {
  return (
    <div className="space-y-1.5">
      {errors.map((err, i) => (
        <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <span className="text-red-400 text-xs mt-0.5">⚠</span>
          <span className="text-[11px] text-red-300">{err.message}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SimulationSummary({ result }: { result: SimulationResult }) {
  const total = Object.keys(result.nodeStates).length
  const success = Object.values(result.nodeStates).filter(s => s.status === 'success').length
  const failed = Object.values(result.nodeStates).filter(s => s.status === 'failed').length
  const skipped = result.skippedNodeIds.length

  const isSuccess = result.status === 'success'

  return (
    <div className={`
      px-4 py-3 rounded-xl border
      ${isSuccess
        ? 'bg-green-500/10 border-green-500/25'
        : 'bg-red-500/10 border-red-500/25'}
    `}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-base ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
          {isSuccess ? '✓' : '✕'}
        </span>
        <span className={`text-sm font-semibold ${isSuccess ? 'text-green-300' : 'text-red-300'}`}>
          模拟{isSuccess ? '成功' : '完成（有失败节点）'}
        </span>
        <span className="ml-auto text-[11px] text-white/30 font-mono">
          {result.durationMs}ms
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-1">
        <div className="text-center py-1.5 rounded-lg bg-white/5">
          <div className="text-base font-bold text-green-300">{success}</div>
          <div className="text-[9px] text-white/30">成功</div>
        </div>
        <div className="text-center py-1.5 rounded-lg bg-white/5">
          <div className={`text-base font-bold ${failed > 0 ? 'text-red-300' : 'text-white/20'}`}>{failed}</div>
          <div className="text-[9px] text-white/30">失败</div>
        </div>
        <div className="text-center py-1.5 rounded-lg bg-white/5">
          <div className="text-base font-bold text-white/40">{skipped}</div>
          <div className="text-[9px] text-white/30">跳过 / 共 {total}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Config row ───────────────────────────────────────────────────────────────

function ConfigSelect<T extends string>({
  label, value, onChange, options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="flex-1 bg-slate-800 border border-white/10 rounded px-2 py-1 text-[11px] text-white/70 focus:outline-none focus:border-indigo-500/60 transition-colors"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Node progress list ───────────────────────────────────────────────────────

function NodeProgressList({
  nodes,
  nodeStates,
}: {
  nodes: WorkflowDefinition['nodes']
  nodeStates: Record<string, WorkflowNodeRunState>
}) {
  return (
    <div className="space-y-1">
      {nodes.map(node => {
        const state = nodeStates[node.id]
        const isRunning = state?.status === 'running'
        return (
          <div
            key={node.id}
            className={`
              flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors duration-300
              ${isRunning ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-white/2 border border-transparent'}
            `}
          >
            <span className="text-sm flex-shrink-0">{
              node.type === 'agent' ? '🤖' :
              node.type === 'condition' ? '⚡' :
              node.type === 'parallel_fork' ? '⑂' :
              node.type === 'parallel_join' ? '⑃' :
              node.type === 'approval' ? '✋' :
              node.type === 'timer' ? '⏱' :
              node.type === 'subworkflow' ? '📦' :
              node.type === 'notification' ? '🔔' : '🔁'
            }</span>
            <span className="flex-1 text-[11px] text-white/60 truncate">{node.label}</span>
            {state && <NodeStateBadge state={state.status} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── SimulationPanel ─────────────────────────────────────────────────────────

export interface SimulationPanelProps {
  workflow: WorkflowDefinition
  onClose?: () => void
  className?: string
}

export function SimulationPanel({ workflow, onClose, className = '' }: SimulationPanelProps) {
  const [simStatus, setSimStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [events, setEvents] = useState<SimulationStepEvent[]>([])
  const [nodeStates, setNodeStates] = useState<Record<string, WorkflowNodeRunState>>({})
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [validationErrors, setValidationErrors] = useState<DAGValidationError[]>([])

  // Config
  const [conditionMode, setConditionMode] = useState<NonNullable<SimulationOptions['conditionMode']>>('random')
  const [failureProbability, setFailureProbability] = useState<'0' | '0.1' | '0.3'>('0')
  const [stepDelayMs, setStepDelayMs] = useState<'400' | '700' | '1000'>('700')

  const abortRef = useRef<AbortController | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  async function startSimulation() {
    // Validate first
    const errors = validateDAG(workflow)
    setValidationErrors(errors)
    if (errors.length > 0) return

    // Reset state
    setEvents([])
    setNodeStates({})
    setResult(null)
    setSimStatus('running')

    const controller = new AbortController()
    abortRef.current = controller

    const opts: SimulationOptions = {
      stepDelayMs: parseInt(stepDelayMs),
      conditionMode,
      failureProbability: parseFloat(failureProbability),
      signal: controller.signal,
      onEvent: (evt) => {
        setEvents(prev => [...prev, evt])
        setTimeout(scrollToBottom, 50)
      },
      onStateUpdate: (states) => {
        setNodeStates({ ...states })
      },
    }

    const res = await runSimulation(workflow, opts)
    setResult(res)
    setSimStatus('done')
    abortRef.current = null
  }

  function stopSimulation() {
    abortRef.current?.abort()
    setSimStatus('done')
  }

  function reset() {
    setSimStatus('idle')
    setEvents([])
    setNodeStates({})
    setResult(null)
    setValidationErrors([])
  }

  return (
    <div className={`flex flex-col bg-slate-900 border border-white/10 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <span className="text-base">🧪</span>
          <span className="text-sm font-semibold text-white/80">Dry-run 模拟</span>
          <span className="text-[10px] text-white/30 font-mono px-2 py-0.5 rounded bg-white/5">
            {workflow.nodes.length} 节点 · {workflow.edges.length} 边
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-sm transition-colors">
            ✕
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left: config + node progress */}
        <div className="w-52 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden">
          {/* Config */}
          <div className="p-3 space-y-2 border-b border-white/10">
            <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1">模拟配置</div>
            <ConfigSelect
              label="条件分支"
              value={conditionMode}
              onChange={setConditionMode}
              options={[
                { value: 'random', label: '随机' },
                { value: 'always_true', label: '总走 True' },
                { value: 'always_false', label: '总走 False' },
              ]}
            />
            <ConfigSelect
              label="失败概率"
              value={failureProbability}
              onChange={setFailureProbability}
              options={[
                { value: '0', label: '0%（无错误）' },
                { value: '0.1', label: '10%' },
                { value: '0.3', label: '30%' },
              ]}
            />
            <ConfigSelect
              label="步骤间隔"
              value={stepDelayMs}
              onChange={setStepDelayMs}
              options={[
                { value: '400', label: '快 (0.4s)' },
                { value: '700', label: '正常 (0.7s)' },
                { value: '1000', label: '慢 (1.0s)' },
              ]}
            />
          </div>

          {/* Node progress */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wide px-1 mb-1">节点进度</div>
            <NodeProgressList nodes={workflow.nodes} nodeStates={nodeStates} />
          </div>
        </div>

        {/* Right: event log + result */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Validation errors */}
          <AnimatePresence>
            {validationErrors.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-3 border-b border-white/10 overflow-hidden"
              >
                <ValidationErrors errors={validationErrors} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Event log */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5 min-h-0">
            {events.length === 0 && simStatus === 'idle' && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <span className="text-4xl opacity-30">🧪</span>
                <p className="text-xs text-white/30">配置参数后点击「开始模拟」</p>
                <p className="text-[11px] text-white/20">不会调用真实 API，仅模拟执行路径</p>
              </div>
            )}
            {events.map((evt, i) => <EventLogItem key={i} event={evt} />)}
            <div ref={logEndRef} />
          </div>

          {/* Summary */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 border-t border-white/10"
              >
                <SimulationSummary result={result} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="px-4 py-3 border-t border-white/10 flex items-center gap-2">
            {simStatus === 'idle' && (
              <button
                onClick={startSimulation}
                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-indigo-500/25 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/35 transition-colors"
              >
                ▶ 开始模拟
              </button>
            )}
            {simStatus === 'running' && (
              <button
                onClick={stopSimulation}
                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors"
              >
                ■ 停止
              </button>
            )}
            {simStatus === 'done' && (
              <>
                <button
                  onClick={reset}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg bg-white/5 border border-white/15 text-white/50 hover:text-white/70 hover:border-white/25 transition-colors"
                >
                  ↺ 重置
                </button>
                <button
                  onClick={startSimulation}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg bg-indigo-500/25 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/35 transition-colors"
                >
                  ▶ 再次运行
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
