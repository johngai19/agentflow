'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStudioStore } from '@/stores/studioStore'

export default function ProjectGroupPanel() {
  const projects = useStudioStore(s => s.projects)
  const agents = useStudioStore(s => s.agents)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-black/30 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🗂️</span>
          <span className="text-white/80 font-medium text-sm">项目分组</span>
          <span className="text-[10px] text-white/40 bg-white/10 px-1.5 py-0.5 rounded-full">
            {projects.length} 个项目
          </span>
        </div>
        <motion.span
          animate={{ rotate: isCollapsed ? -90 : 0 }}
          className="text-white/40 text-xs"
        >▼</motion.span>
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {projects.map(project => {
                const projectAgents = agents.filter(a => project.agentIds.includes(a.id))
                const isOpen = expanded === project.id

                return (
                  <div key={project.id} className="rounded-lg border border-white/10 overflow-hidden">
                    {/* Project header */}
                    <button
                      onClick={() => setExpanded(isOpen ? null : project.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                    >
                      <span className="text-base">{project.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white/80 truncate">{project.name}</div>
                        <div className="text-[10px] text-white/40">{project.agentIds.length} 个 Agent</div>
                      </div>
                      {/* Agent emoji row */}
                      <div className="flex -space-x-1">
                        {projectAgents.slice(0, 4).map(a => (
                          <div
                            key={a.id}
                            className="w-5 h-5 rounded-full border border-black/30 flex items-center justify-center text-[10px]"
                            style={{ backgroundColor: a.color }}
                            title={a.name}
                          >{a.emoji}</div>
                        ))}
                        {projectAgents.length > 4 && (
                          <div className="w-5 h-5 rounded-full border border-black/30 bg-white/20 flex items-center justify-center text-[9px] text-white">
                            +{projectAgents.length - 4}
                          </div>
                        )}
                      </div>
                      <motion.span
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        className="text-white/30 text-[10px] ml-1"
                      >▼</motion.span>
                    </button>

                    {/* Shared resources */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden border-t border-white/10"
                        >
                          <div className="px-3 py-2 space-y-2 bg-black/20">
                            <p className="text-[10px] text-white/40 italic">{project.description}</p>

                            {/* Shared resources grid */}
                            <div className="grid grid-cols-2 gap-1.5">
                              {project.sharedResources.memory?.length ? (
                                <ResourceChip icon="🧠" label="Memory" items={project.sharedResources.memory} />
                              ) : null}
                              {project.sharedResources.files?.length ? (
                                <ResourceChip icon="📁" label="Files" items={project.sharedResources.files} />
                              ) : null}
                              {project.sharedResources.skills?.length ? (
                                <ResourceChip icon="⚡" label="Skills" items={project.sharedResources.skills} />
                              ) : null}
                              {project.sharedResources.mcpServers?.length ? (
                                <ResourceChip icon="🔌" label="MCP" items={project.sharedResources.mcpServers} />
                              ) : null}
                            </div>

                            {/* Agent list */}
                            <div className="space-y-1">
                              {projectAgents.map(a => (
                                <div key={a.id} className="flex items-center gap-2 text-[10px]">
                                  <div
                                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px]"
                                    style={{ backgroundColor: a.color }}
                                  >{a.emoji}</div>
                                  <span className="text-white/70">{a.name}</span>
                                  <span className="text-white/30">{a.role}</span>
                                  {a.isOrchestrator && <span className="text-amber-400">👑</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ResourceChip({ icon, label, items }: { icon: string; label: string; items: string[] }) {
  return (
    <div className="bg-white/5 rounded-md px-2 py-1.5">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px]">{icon}</span>
        <span className="text-[9px] text-white/50 font-medium">{label}</span>
      </div>
      <div className="space-y-0.5">
        {items.slice(0, 2).map((item, i) => (
          <div key={i} className="text-[9px] text-white/60 truncate">{item}</div>
        ))}
        {items.length > 2 && (
          <div className="text-[9px] text-white/30">+{items.length - 2} more</div>
        )}
      </div>
    </div>
  )
}
