'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Download,
  Layers3,
  Search,
  Star,
  X,
} from 'lucide-react'
import {
  WORKFLOW_TEMPLATES,
  type WorkflowTemplate,
} from '@/data/workflowTemplates'
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore'

type MarketplaceCategory = 'all' | 'devops' | 'security' | 'monitoring' | 'incident-response'

interface MarketplaceMeta {
  category: Exclude<MarketplaceCategory, 'all'>
  categoryLabel: string
  rating: number
  installs: number
  spotlight: string
  accent: string
  thumbnailTint: string
}

const CATEGORY_OPTIONS: { value: MarketplaceCategory; label: string; hint: string }[] = [
  { value: 'all', label: 'All Templates', hint: 'Everything in the library' },
  { value: 'devops', label: 'DevOps', hint: 'Provisioning and delivery flows' },
  { value: 'security', label: 'Security', hint: 'Access control and security ops' },
  { value: 'monitoring', label: 'Monitoring', hint: 'Alerting and observability workflows' },
  { value: 'incident-response', label: 'Incident Response', hint: 'Escalation and response playbooks' },
]

const MARKETPLACE_META: Record<string, MarketplaceMeta> = {
  'tpl-ticket-creation': {
    category: 'incident-response',
    categoryLabel: 'Incident Response',
    rating: 4.8,
    installs: 1240,
    spotlight: 'Triage inbound requests, classify severity, and route to the right owner.',
    accent: 'from-amber-400/25 via-rose-500/15 to-transparent',
    thumbnailTint: 'bg-amber-400/10',
  },
  'tpl-alert-response': {
    category: 'monitoring',
    categoryLabel: 'Monitoring',
    rating: 4.9,
    installs: 2180,
    spotlight: 'Parallel diagnostics for alert intake, escalation, and remediation decisions.',
    accent: 'from-cyan-400/30 via-sky-500/10 to-transparent',
    thumbnailTint: 'bg-cyan-400/10',
  },
  'tpl-resource-provision': {
    category: 'devops',
    categoryLabel: 'DevOps',
    rating: 4.7,
    installs: 1635,
    spotlight: 'Standardize approvals, IaC generation, provisioning, and post-create checks.',
    accent: 'from-emerald-400/25 via-teal-500/10 to-transparent',
    thumbnailTint: 'bg-emerald-400/10',
  },
  'tpl-permission-change': {
    category: 'security',
    categoryLabel: 'Security',
    rating: 4.8,
    installs: 1498,
    spotlight: 'Review risky access changes, collect approvals, and automate revocation.',
    accent: 'from-red-400/25 via-orange-500/10 to-transparent',
    thumbnailTint: 'bg-red-400/10',
  },
  'tpl-knowledge-consultation': {
    category: 'incident-response',
    categoryLabel: 'Incident Response',
    rating: 4.6,
    installs: 980,
    spotlight: 'Gather context across knowledge sources and escalate low-confidence answers fast.',
    accent: 'from-fuchsia-400/25 via-indigo-500/10 to-transparent',
    thumbnailTint: 'bg-fuchsia-400/10',
  },
}

function formatInstallCount(count: number) {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return `${count}`
}

function cloneTemplateDefinition(template: WorkflowTemplate) {
  const definition = JSON.parse(JSON.stringify(template.definition)) as WorkflowTemplate['definition']
  const now = Date.now()
  definition.id = `wf-from-tpl-${now}-${Math.random().toString(36).slice(2, 6)}`
  definition.createdAt = now
  definition.updatedAt = now
  definition.enabled = false
  definition.versions = []
  definition.currentVersion = 1
  return definition
}

function PreviewThumbnail({ template }: { template: WorkflowTemplate }) {
  const meta = MARKETPLACE_META[template.id]
  const nodes = template.definition.nodes.slice(0, 7)
  const edges = template.definition.edges
  const nodeIds = new Set(nodes.map(node => node.id))
  const depthMap = new Map<string, number>()
  const width = 312
  const height = 164

  function getDepth(nodeId: string, visited = new Set<string>()): number {
    if (depthMap.has(nodeId)) return depthMap.get(nodeId) ?? 0
    if (visited.has(nodeId)) return 0
    visited.add(nodeId)
    const incoming = edges.filter(edge => edge.to === nodeId && nodeIds.has(edge.from))
    if (incoming.length === 0) {
      depthMap.set(nodeId, 0)
      return 0
    }
    const depth = Math.max(...incoming.map(edge => getDepth(edge.from, new Set(visited)))) + 1
    depthMap.set(nodeId, depth)
    return depth
  }

  nodes.forEach(node => getDepth(node.id))

  const maxDepth = Math.max(...Array.from(depthMap.values()), 0)
  const columns = new Map<number, string[]>()
  nodes.forEach(node => {
    const depth = depthMap.get(node.id) ?? 0
    columns.set(depth, [...(columns.get(depth) ?? []), node.id])
  })

  function xForNode(nodeId: string) {
    const depth = depthMap.get(nodeId) ?? 0
    const horizontalPadding = 34
    if (maxDepth === 0) return width / 2
    return horizontalPadding + ((width - horizontalPadding * 2) / maxDepth) * depth
  }

  function yForNode(nodeId: string) {
    const depth = depthMap.get(nodeId) ?? 0
    const siblings = columns.get(depth) ?? [nodeId]
    const index = siblings.indexOf(nodeId)
    const verticalPadding = 26
    if (siblings.length === 1) return height / 2
    return verticalPadding + ((height - verticalPadding * 2) / (siblings.length - 1)) * index
  }

  const nodeTypeColor: Record<string, string> = {
    agent: '#38bdf8',
    condition: '#f59e0b',
    parallel_fork: '#22c55e',
    parallel_join: '#14b8a6',
    approval: '#fb7185',
    timer: '#c084fc',
    subworkflow: '#a3e635',
    notification: '#f97316',
    loop: '#f43f5e',
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 ${meta.thumbnailTint}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.accent}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_38%)]" />
      <div className="relative flex items-start justify-between px-4 pt-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">{meta.categoryLabel}</div>
          <div className="mt-1 text-xl">{template.icon}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] text-white/55">
          {template.nodeCount} nodes
        </div>
      </div>

      <div className="relative px-3 pb-3 pt-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
          <defs>
            <pattern id={`grid-${template.id}`} width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            </pattern>
          </defs>

          <rect width={width} height={height} rx="18" fill={`url(#grid-${template.id})`} />

          {edges.filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to)).map(edge => (
            <line
              key={edge.id}
              x1={xForNode(edge.from)}
              y1={yForNode(edge.from)}
              x2={xForNode(edge.to)}
              y2={yForNode(edge.to)}
              stroke="rgba(255,255,255,0.24)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}

          {nodes.map(node => {
            const color = nodeTypeColor[node.type] ?? '#94a3b8'
            return (
              <g key={node.id}>
                <circle
                  cx={xForNode(node.id)}
                  cy={yForNode(node.id)}
                  r="11"
                  fill={color}
                  fillOpacity="0.18"
                  stroke={color}
                  strokeWidth="1.6"
                />
                {node.isStart ? (
                  <circle
                    cx={xForNode(node.id)}
                    cy={yForNode(node.id)}
                    r="16"
                    fill="none"
                    stroke={color}
                    strokeOpacity="0.35"
                    strokeWidth="1"
                  />
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function RatingPill({ rating, installs }: { rating: number; installs: number }) {
  return (
    <div className="flex items-center gap-3 text-xs text-white/55">
      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
        <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
        {rating.toFixed(1)}
      </span>
      <span className="inline-flex items-center gap-1">
        <Download className="h-3.5 w-3.5" />
        {formatInstallCount(installs)} installs
      </span>
    </div>
  )
}

function TemplateDetailModal({
  template,
  onClose,
  onUse,
}: {
  template: WorkflowTemplate
  onClose: () => void
  onUse: (template: WorkflowTemplate) => void
}) {
  const meta = MARKETPLACE_META[template.id]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#07111f] shadow-2xl shadow-black/40"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-sky-200/85">
                {meta.categoryLabel}
              </span>
              <span className="text-xs text-white/35">{template.estimatedDuration}</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="pt-0.5 text-3xl">{template.icon}</span>
              <div>
                <h2 className="text-2xl font-semibold text-white">{template.name}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/62">
                  {template.definition.description || template.description}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onUse(template)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-400/12 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/18"
            >
              Use Template
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/55 transition hover:text-white"
              aria-label="Close template details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-[1.3fr_0.9fr]">
          <div className="overflow-auto border-b border-white/10 p-6 lg:border-b-0 lg:border-r">
            <PreviewThumbnail template={template} />

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">Rating</div>
                <div className="mt-2 text-2xl font-semibold text-white">{meta.rating.toFixed(1)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">Installs</div>
                <div className="mt-2 text-2xl font-semibold text-white">{formatInstallCount(meta.installs)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">Nodes</div>
                <div className="mt-2 text-2xl font-semibold text-white">{template.definition.nodes.length}</div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs font-medium uppercase tracking-[0.24em] text-white/35">Full Description</div>
              <p className="mt-3 text-sm leading-7 text-white/68">
                {template.definition.description || template.description}
              </p>
              <p className="mt-4 text-sm leading-7 text-white/52">
                {meta.spotlight}
              </p>
            </div>
          </div>

          <div className="overflow-auto p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">Node List</h3>
                <p className="mt-1 text-sm text-white/40">Execution order, core node type, and per-step purpose.</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
                <Layers3 className="h-3.5 w-3.5" />
                {template.definition.edges.length} edges
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {template.definition.nodes.map((node, index) => (
                <div
                  key={node.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">
                        Step {index + 1} · {node.type.replaceAll('_', ' ')}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white/90">{node.label}</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-white/45">
                      {node.id}
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-white/55">
                    {node.description || 'No node description provided in template data.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function WorkflowMarketplacePage() {
  const router = useRouter()
  const createWorkflow = useWorkflowDesignerStore(state => state.createWorkflow)
  const loadWorkflow = useWorkflowDesignerStore(state => state.loadWorkflow)

  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [launchingTemplateId, setLaunchingTemplateId] = useState<string | null>(null)

  const filteredTemplates = WORKFLOW_TEMPLATES.filter(template => {
    const meta = MARKETPLACE_META[template.id]
    const normalizedQuery = query.trim().toLowerCase()
    const matchesCategory = activeCategory === 'all' || meta.category === activeCategory
    const matchesQuery =
      normalizedQuery.length === 0 ||
      template.name.toLowerCase().includes(normalizedQuery) ||
      template.description.toLowerCase().includes(normalizedQuery) ||
      template.definition.description.toLowerCase().includes(normalizedQuery) ||
      meta.categoryLabel.toLowerCase().includes(normalizedQuery) ||
      template.tags.some(tag => tag.toLowerCase().includes(normalizedQuery)) ||
      template.definition.nodes.some(node =>
        node.label.toLowerCase().includes(normalizedQuery) ||
        (node.description ?? '').toLowerCase().includes(normalizedQuery)
      )

    return matchesCategory && matchesQuery
  })

  function handleUseTemplate(template: WorkflowTemplate) {
    const clonedDefinition = cloneTemplateDefinition(template)
    const workflowId = createWorkflow(clonedDefinition)
    loadWorkflow(workflowId)
    setLaunchingTemplateId(template.id)
    setSelectedTemplate(null)
    window.setTimeout(() => {
      router.push('/workflows/designer')
    }, 180)
  }

  return (
    <div className="min-h-screen bg-[#020816] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_35%)]" />

      <div className="relative">
        <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
            <Link href="/workflows/designer" className="text-sm text-white/45 transition hover:text-white/80">
              ← Back to Designer
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-white/35">Workflow Marketplace</div>
              <h1 className="mt-1 text-lg font-semibold text-white/90">Template Marketplace</h1>
            </div>
            <div className="ml-auto rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/45">
              {WORKFLOW_TEMPLATES.length} templates
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-10">
          <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-emerald-200/65">Curated Templates</div>
              <h2 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-white">
                Launch production-ready workflow templates and clone them straight into the designer.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/55">
                Browse the library, filter by operating domain, inspect the full node graph, and use a template in one click without touching the source definition.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-white/35">Marketplace Stats</div>
                  <div className="mt-2 text-2xl font-semibold text-white">5 proven starting points</div>
                </div>
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-200">
                  Clone-ready
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-white/35">Avg rating</div>
                  <div className="mt-1 text-lg font-semibold text-white">4.8</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-white/35">Total installs</div>
                  <div className="mt-1 text-lg font-semibold text-white">7.5k</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-white/35">Fastest launch</div>
                  <div className="mt-1 text-lg font-semibold text-white">&lt; 1 min</div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-10 rounded-[30px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative max-w-xl flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search templates, tags, node names, or categories"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-emerald-400/40"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setActiveCategory(option.value)}
                    className={`rounded-2xl border px-4 py-2 text-left transition ${
                      activeCategory === option.value
                        ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-100'
                        : 'border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white/80'
                    }`}
                  >
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="mt-0.5 text-[11px] opacity-60">{option.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-8">
            {filteredTemplates.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-white/15 bg-white/[0.02] px-6 py-20 text-center">
                <div className="text-lg font-medium text-white/85">No templates matched the current filters.</div>
                <p className="mt-2 text-sm text-white/45">
                  Clear the search or switch categories to see the full marketplace.
                </p>
                <button
                  onClick={() => {
                    setQuery('')
                    setActiveCategory('all')
                  }}
                  className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:text-white"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredTemplates.map(template => {
                  const meta = MARKETPLACE_META[template.id]
                  const isLaunching = launchingTemplateId === template.id

                  return (
                    <motion.article
                      key={template.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group overflow-hidden rounded-[28px] border border-white/10 bg-[#07101d]/95"
                    >
                      <div className="p-4">
                        <PreviewThumbnail template={template} />
                      </div>

                      <div className="border-t border-white/10 px-5 py-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">{meta.categoryLabel}</div>
                            <h3 className="mt-2 text-xl font-semibold text-white">{template.name}</h3>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/45">
                            {template.estimatedDuration}
                          </span>
                        </div>

                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/58">
                          {template.description}
                        </p>

                        <div className="mt-4">
                          <RatingPill rating={meta.rating} installs={meta.installs} />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {template.tags.slice(0, 4).map(tag => (
                            <span
                              key={tag}
                              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/50"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <p className="mt-4 text-sm leading-6 text-white/45">
                          {meta.spotlight}
                        </p>

                        <div className="mt-5 flex items-center gap-3">
                          <button
                            onClick={() => handleUseTemplate(template)}
                            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                              isLaunching
                                ? 'border-emerald-400/35 bg-emerald-400/12 text-emerald-100'
                                : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/16'
                            }`}
                          >
                            {isLaunching ? 'Opening Designer...' : 'Use Template'}
                            <ArrowRight className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => setSelectedTemplate(template)}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </motion.article>
                  )
                })}
              </div>
            )}
          </section>
        </main>
      </div>

      <AnimatePresence>
        {selectedTemplate ? (
          <TemplateDetailModal
            template={selectedTemplate}
            onClose={() => setSelectedTemplate(null)}
            onUse={handleUseTemplate}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
