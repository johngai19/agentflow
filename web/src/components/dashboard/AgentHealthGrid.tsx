"use client"

// ─── AgentHealthGrid ──────────────────────────────────────────────────────────
// Compact grid of agent health cards.
//
// Data source priority:
//   1. Live data from OpsAgent Agent Registry API (agentRegistryApi.listAgents)
//   2. Falls back to local agentStore (mock data) if API is unreachable
//
// Refresh: manual via the "刷新" button, or automatic on mount.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import useAgentStore from '@/stores/agentStore'
import { STATUS_CONFIG, TYPE_CONFIG } from '@/types/agent'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { agentRegistryApi, type AgentInfo, OpsAgentApiError } from '@/lib/opsagentApi'

// ─── AgentInfo → agentflow Agent shape adapter ────────────────────────────────

function mapAgentInfoToStatus(agent: AgentInfo): 'running' | 'idle' | 'error' {
  if (!agent.is_healthy) return 'error'
  return 'idle'
}

// ─── Live Agent Card ──────────────────────────────────────────────────────────

function LiveAgentCard({ agent }: { agent: AgentInfo }) {
  const isHealthy = agent.is_healthy
  const statusLabel = isHealthy ? 'Healthy' : 'Unhealthy'
  const dotClass = isHealthy ? 'bg-green-500' : 'bg-red-500'
  const badgeColor = isHealthy
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'
  const borderClass = isHealthy ? 'border-green-500/20' : 'border-red-500/30'

  const lastSeen = agent.last_seen
    ? new Date(agent.last_seen).toLocaleTimeString()
    : '–'

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 flex flex-col gap-2 transition-shadow hover:shadow-sm',
        borderClass,
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dotClass)} />
            <span className="text-sm font-semibold truncate">{agent.name}</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
            <span className="font-mono text-[10px] bg-muted px-1 rounded">{agent.agent_id}</span>
          </div>
        </div>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-medium', badgeColor)}>
          {statusLabel}
        </span>
      </div>

      {/* Description */}
      {agent.description && (
        <p className="text-[11px] text-muted-foreground truncate border rounded px-2 py-1 bg-muted/30">
          {agent.description}
        </p>
      )}

      {/* Capabilities */}
      {agent.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {agent.capabilities.slice(0, 3).map(cap => (
            <span
              key={cap.name}
              className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
            >
              {cap.name}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{agent.capabilities.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Tags + last seen */}
      <div className="flex justify-between text-[10px] text-muted-foreground border-t pt-2">
        <div className="flex gap-1 flex-wrap">
          {agent.tags.slice(0, 2).map(tag => (
            <span key={tag} className="bg-muted px-1 rounded">{tag}</span>
          ))}
        </div>
        <span title="最近一次健康检查">seen {lastSeen}</span>
      </div>
    </div>
  )
}

// ─── Fallback Mock Card (uses existing agentStore) ─────────────────────────────

function MockAgentCard({ agent }: { agent: ReturnType<typeof useAgentStore.getState>['agents'][number] }) {
  const statusCfg = STATUS_CONFIG[agent.status]
  const typeCfg   = TYPE_CONFIG[agent.type]
  const progress  = agent.tasksTotal > 0
    ? Math.round((agent.tasksCompleted / agent.tasksTotal) * 100)
    : 0

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 flex flex-col gap-2 transition-shadow hover:shadow-sm',
        agent.status === 'error'   ? 'border-red-500/30' :
        agent.status === 'blocked' ? 'border-orange-500/30' :
        agent.status === 'running' ? 'border-green-500/20' : ''
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusCfg.dotClass)} />
            <span className="text-sm font-semibold truncate">{agent.name}</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
            <span>{typeCfg.emoji}</span>
            <span>{typeCfg.label}</span>
            <span>·</span>
            <span className="truncate">{agent.project}</span>
          </div>
        </div>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-medium', statusCfg.color, 'bg-current/10')}>
          {statusCfg.label}
        </span>
      </div>
      {agent.currentTask && (
        <p className="text-[11px] text-muted-foreground truncate border rounded px-2 py-1 bg-muted/30">
          {agent.currentTask}
        </p>
      )}
      {!agent.currentTask && (
        <p className="text-[11px] text-muted-foreground italic">{agent.lastAction}</p>
      )}
      <div className="space-y-1">
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{agent.tasksCompleted}/{agent.tasksTotal} 任务</span>
          <span>{progress}%</span>
        </div>
      </div>
      <div className="flex gap-3 text-[10px] text-muted-foreground border-t pt-2">
        <span>commits {agent.metrics.commits}</span>
        <span>tests {agent.metrics.tests}</span>
        <span>fixes {agent.metrics.fixes}</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentHealthGrid() {
  // Local agentStore is the fallback
  const mockAgents = useAgentStore(s => s.agents)
  const getStats   = useAgentStore(s => s.getStats)

  // Live API state
  const [liveAgents, setLiveAgents]   = useState<AgentInfo[] | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [isLiveMode, setIsLiveMode]   = useState(false)

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await agentRegistryApi.listAgents()
      setLiveAgents(res.agents)
      setIsLiveMode(true)
    } catch (err) {
      if (err instanceof OpsAgentApiError) {
        setError(`API ${err.status}: ${err.message}`)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('无法连接到 Agent Registry')
      }
      setIsLiveMode(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Attempt to load live data on mount
  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  // ── Compute summary stats ──────────────────────────────────────────────────
  const liveStats = liveAgents
    ? {
        total:   liveAgents.length,
        healthy: liveAgents.filter(a => a.is_healthy).length,
        unhealthy: liveAgents.filter(a => !a.is_healthy).length,
      }
    : null

  const mockStats = getStats()

  return (
    <div className="space-y-4">
      {/* Header: data source indicator + refresh */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              loading ? 'bg-yellow-400 animate-pulse' :
              isLiveMode ? 'bg-green-500' : 'bg-muted-foreground',
            )}
          />
          <span className="text-[11px] text-muted-foreground">
            {loading ? '加载中…' :
             isLiveMode ? '实时数据 (Agent Registry)' :
             '本地模拟数据'}
          </span>
          {error && (
            <span className="text-[10px] text-red-400 truncate max-w-[200px]" title={error}>
              {error}
            </span>
          )}
        </div>
        <button
          onClick={fetchAgents}
          disabled={loading}
          className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
        >
          {loading ? '⏳' : '↻'} 刷新
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {isLiveMode && liveStats ? (
          <>
            <div className="rounded-lg border bg-card px-3 py-2 text-center col-span-1">
              <div className="text-xl font-bold text-foreground">{liveStats.total}</div>
              <div className="text-[10px] text-muted-foreground">全部</div>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2 text-center col-span-1">
              <div className="text-xl font-bold text-green-600 dark:text-green-400">{liveStats.healthy}</div>
              <div className="text-[10px] text-muted-foreground">健康</div>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2 text-center col-span-1">
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{liveStats.unhealthy}</div>
              <div className="text-[10px] text-muted-foreground">异常</div>
            </div>
          </>
        ) : (
          [
            { key: 'total',   label: '全部',   value: mockStats.total,   color: 'text-foreground' },
            { key: 'running', label: '运行中', value: mockStats.running, color: 'text-green-600 dark:text-green-400' },
            { key: 'idle',    label: '空闲',   value: mockStats.idle,    color: 'text-yellow-600 dark:text-yellow-400' },
            { key: 'error',   label: '错误',   value: mockStats.error,   color: 'text-red-600 dark:text-red-400' },
            { key: 'blocked', label: '阻塞',   value: mockStats.blocked, color: 'text-orange-600 dark:text-orange-400' },
          ].map(s => (
            <div key={s.key} className="rounded-lg border bg-card px-3 py-2 text-center">
              <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))
        )}
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {isLiveMode && liveAgents
          ? liveAgents.map(agent => (
              <LiveAgentCard key={agent.agent_id} agent={agent} />
            ))
          : mockAgents.map(agent => (
              <MockAgentCard key={agent.id} agent={agent} />
            ))
        }
        {isLiveMode && liveAgents?.length === 0 && (
          <div className="col-span-3 text-center text-sm text-muted-foreground py-8">
            Agent Registry 中暂无已注册的 Agent
          </div>
        )}
      </div>

      <div className="text-right">
        <Link href="/agents" className="text-xs text-muted-foreground hover:text-foreground underline">
          查看全部 Agent →
        </Link>
      </div>
    </div>
  )
}
