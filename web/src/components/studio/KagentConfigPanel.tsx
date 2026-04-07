'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStudioStore } from '@/stores/studioStore'
import { setAgentProvider, createAgentProvider, type AgentProviderConfig } from '@/lib/agentProvider'

export default function KagentConfigPanel() {
  const agents = useStudioStore(s => s.agents)
  const scaleAgentPods = useStudioStore(s => s.scaleAgentPods)
  const providerName = useStudioStore(s => s.providerName)
  const providerIcon = useStudioStore(s => s.providerIcon)

  const [isOpen, setIsOpen] = useState(false)
  const [providerType, setProviderType] = useState<AgentProviderConfig['type']>('mock')
  const [endpoint, setEndpoint] = useState('http://localhost:8080')
  const [namespace, setNamespace] = useState('default')
  const [connected, setConnected] = useState(false)

  const agentsWithPods = agents.filter(a => a.podCount !== undefined && !a.isOrchestrator)
  const totalPods = agentsWithPods.reduce((s, a) => s + (a.podCount ?? 1), 0)

  const handleConnect = () => {
    const provider = createAgentProvider({ type: providerType, endpoint, namespace })
    setAgentProvider(provider)
    setConnected(true)
    setTimeout(() => setConnected(false), 3000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-black/30 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">☸️</span>
          <span className="text-white/80 font-medium text-sm">kagent / K8s</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
              providerType === 'kagent'
                ? 'bg-green-500/20 border-green-500/40 text-green-400'
                : 'bg-white/10 border-white/20 text-white/40'
            }`}
          >
            {providerIcon} {providerName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40">{totalPods} pods</span>
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            className="text-white/40 text-[10px]"
          >▼</motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="px-3 pb-3 space-y-3 bg-black/20">
              {/* Provider selector */}
              <div className="pt-3">
                <label className="text-[10px] text-white/50 block mb-1">Provider 类型</label>
                <div className="flex gap-1.5">
                  {(['mock', 'kagent'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setProviderType(t)}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                        providerType === t
                          ? 'bg-indigo-500/30 border-indigo-500/60 text-indigo-300'
                          : 'bg-white/5 border-white/20 text-white/50 hover:border-white/40'
                      }`}
                    >
                      {t === 'mock' ? '🧪 Mock' : '☸️ kagent'}
                    </button>
                  ))}
                </div>
              </div>

              {providerType === 'kagent' && (
                <div className="space-y-1.5">
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">API 端点</label>
                    <input
                      value={endpoint}
                      onChange={e => setEndpoint(e.target.value)}
                      className="w-full text-[10px] bg-white/10 border border-white/20 rounded px-2 py-1 text-white/80 focus:outline-none focus:border-indigo-500/60"
                      placeholder="http://k8s-api:8080"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">Namespace</label>
                    <input
                      value={namespace}
                      onChange={e => setNamespace(e.target.value)}
                      className="w-full text-[10px] bg-white/10 border border-white/20 rounded px-2 py-1 text-white/80 focus:outline-none focus:border-indigo-500/60"
                      placeholder="default"
                    />
                  </div>
                  <button
                    onClick={handleConnect}
                    className="w-full text-[10px] py-1.5 rounded bg-indigo-500/30 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/40 transition-colors"
                  >
                    {connected ? '✅ 已连接' : '连接 kagent'}
                  </button>
                </div>
              )}

              {/* Pod scaling per agent */}
              <div>
                <div className="text-[10px] text-white/50 mb-2 flex items-center gap-1">
                  <span>Pod 扩缩容</span>
                  <span className="text-white/30">（总计 {totalPods} pods）</span>
                </div>
                <div className="space-y-2">
                  {agentsWithPods.map(agent => (
                    <div key={agent.id} className="flex items-center gap-2">
                      {/* Agent avatar */}
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
                        style={{ backgroundColor: agent.color }}
                      >{agent.emoji}</div>
                      <span className="text-[10px] text-white/60 w-12 truncate">{agent.name}</span>

                      {/* Scale controls */}
                      <div className="flex items-center gap-1 flex-1">
                        <button
                          onClick={() => scaleAgentPods(agent.id, -1)}
                          disabled={(agent.podCount ?? 1) <= 1}
                          className="w-4 h-4 rounded text-[10px] bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center"
                        >−</button>

                        {/* Pod visual bars */}
                        <div className="flex gap-0.5 flex-1">
                          {Array.from({ length: agent.podMaxCount ?? 5 }).map((_, i) => (
                            <motion.div
                              key={i}
                              className="h-3 flex-1 rounded-sm"
                              style={{
                                backgroundColor: i < (agent.podCount ?? 1) ? agent.color : '#ffffff15',
                              }}
                              animate={i < (agent.podCount ?? 1) ? { opacity: [0.7, 1, 0.7] } : {}}
                              transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                            />
                          ))}
                        </div>

                        <button
                          onClick={() => scaleAgentPods(agent.id, 1)}
                          disabled={(agent.podCount ?? 1) >= (agent.podMaxCount ?? 5)}
                          className="w-4 h-4 rounded text-[10px] bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center"
                        >+</button>

                        <span className="text-[9px] text-white/40 w-8 text-right">
                          {agent.podCount}/{agent.podMaxCount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* kagent CRD snippet */}
              {providerType === 'kagent' && (
                <div>
                  <div className="text-[10px] text-white/50 mb-1">CRD 示例</div>
                  <pre className="bg-black/30 rounded p-2 text-[9px] text-green-400/80 overflow-x-auto">
{`apiVersion: kagent.dev/v1alpha1
kind: Agent
metadata:
  name: bob
  namespace: ${namespace}
  labels:
    studio.project: infra-ops
spec:
  displayName: Bob
  role: 云运维工程师
  replicas: ${agents.find(a => a.id === 'bob')?.podCount ?? 2}
  maxReplicas: 8
  tools:
    - kubectl
    - aliyun_ecs
    - terraform`}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
