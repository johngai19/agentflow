'use client'

// ─── Workflow Templates Page ──────────────────────────────────────────────────
//
// Browse and instantiate pre-built workflow templates.
// Uses the template library + TemplateCard component + SimulationPanel.

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { TemplateCard } from '@/components/workflow/TemplateCard'
import { SimulationPanel } from '@/components/workflow/SimulationPanel'
import {
  WORKFLOW_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type WorkflowTemplate,
} from '@/data/workflowTemplates'
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore'
import { useRouter } from 'next/navigation'

// ─── Category filter bar ──────────────────────────────────────────────────────

const ALL = 'all'
type FilterCategory = typeof ALL | WorkflowTemplate['category']

function CategoryFilterBar({
  active,
  onChange,
}: {
  active: FilterCategory
  onChange: (c: FilterCategory) => void
}) {
  const categories: { value: FilterCategory; label: string; icon: string }[] = [
    { value: ALL, label: '全部', icon: '◈' },
    ...Object.entries(TEMPLATE_CATEGORIES).map(([k, v]) => ({
      value: k as WorkflowTemplate['category'],
      label: v.label,
      icon: v.icon,
    })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {categories.map(cat => (
        <button
          key={cat.value}
          onClick={() => onChange(cat.value)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
            ${active === cat.value
              ? 'bg-indigo-500/30 border border-indigo-500/60 text-indigo-200'
              : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20'}
          `}
        >
          <span>{cat.icon}</span>
          {cat.label}
        </button>
      ))}
    </div>
  )
}

// ─── Template detail / preview modal ─────────────────────────────────────────

function TemplatePreviewModal({
  template,
  onClose,
  onUse,
}: {
  template: WorkflowTemplate
  onClose: () => void
  onUse: (t: WorkflowTemplate) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{template.icon}</span>
            <div>
              <h2 className="text-base font-semibold text-white/90">{template.name}</h2>
              <p className="text-xs text-white/40">{template.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUse(template)}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-500/30 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/40 transition-colors"
            >
              使用此模板 →
            </button>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/60 text-sm px-2 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {/* Simulation panel */}
            <SimulationPanel
              workflow={template.definition}
              className="h-[520px]"
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkflowTemplatesPage() {
  const router = useRouter()
  const createWorkflow = useWorkflowDesignerStore(s => s.createWorkflow)
  const loadWorkflow = useWorkflowDesignerStore(s => s.loadWorkflow)

  const [activeCategory, setActiveCategory] = useState<FilterCategory>(ALL)
  const [search, setSearch] = useState('')
  const [previewTemplate, setPreviewTemplate] = useState<WorkflowTemplate | null>(null)
  const [justUsed, setJustUsed] = useState<string | null>(null)

  const filtered = WORKFLOW_TEMPLATES.filter(t => {
    const matchCategory = activeCategory === ALL || t.category === activeCategory
    const q = search.toLowerCase().trim()
    const matchSearch = !q ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q))
    return matchCategory && matchSearch
  })

  function handleUseTemplate(template: WorkflowTemplate) {
    // Deep-clone definition with a new id
    const defClone = JSON.parse(JSON.stringify(template.definition))
    const now = Date.now()
    defClone.id = `wf-from-tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    defClone.createdAt = now
    defClone.updatedAt = now
    defClone.enabled = false
    defClone.versions = []
    defClone.currentVersion = 1

    const id = createWorkflow(defClone)
    loadWorkflow(id)

    setJustUsed(template.id)
    setPreviewTemplate(null)
    setTimeout(() => setJustUsed(null), 3000)

    // Navigate to designer after a brief delay
    setTimeout(() => router.push('/workflows/designer'), 400)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3.5 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <Link href="/workflows/designer" className="text-white/40 hover:text-white/70 text-sm transition-colors">
          ← 工作流设计器
        </Link>
        <span className="text-white/15">|</span>
        <h1 className="text-sm font-semibold text-white/80">工作流模板库</h1>
        <span className="text-[11px] text-white/30 px-2 py-0.5 rounded-full bg-white/5">
          {WORKFLOW_TEMPLATES.length} 个模板
        </span>
        <div className="flex-1" />
        <Link
          href="/workflows/designer"
          className="text-xs text-white/40 hover:text-white/70 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
        >
          + 空白新建
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white/90 mb-2">选择工作流模板</h2>
          <p className="text-sm text-white/45">
            从预置场景模板快速开始，支持 dry-run 预览执行路径，一键加载到设计器
          </p>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 text-sm">⌕</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索模板..."
              className="w-full bg-slate-900 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-indigo-500/60 transition-colors"
            />
          </div>
          <CategoryFilterBar active={activeCategory} onChange={setActiveCategory} />
        </div>

        {/* Template grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-5xl opacity-30">🔍</span>
            <p className="text-sm text-white/40">未找到匹配的模板</p>
            <button
              onClick={() => { setSearch(''); setActiveCategory(ALL) }}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline"
            >
              清除筛选
            </button>
          </div>
        ) : (
          <motion.div
            key={activeCategory + search}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filtered.map(template => (
              <div key={template.id} className="relative">
                <TemplateCard
                  template={template}
                  onUse={handleUseTemplate}
                />
                {/* Preview button overlay */}
                <button
                  onClick={() => setPreviewTemplate(template)}
                  className="absolute top-3 right-3 text-[10px] text-white/30 hover:text-white/60 px-2 py-0.5 rounded bg-black/30 border border-white/10 hover:border-white/20 transition-colors"
                >
                  预览 / 模拟
                </button>
                {/* "Used" toast overlay */}
                <AnimatePresence>
                  {justUsed === template.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute inset-0 flex items-center justify-center rounded-xl bg-green-500/20 border border-green-500/30 backdrop-blur-sm"
                    >
                      <div className="text-center">
                        <div className="text-3xl mb-1">✓</div>
                        <div className="text-xs font-semibold text-green-300">正在跳转到设计器...</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        )}

        {/* Info footer */}
        <div className="mt-12 px-4 py-3 rounded-xl bg-white/3 border border-white/8 flex items-center gap-3">
          <span className="text-xl">💡</span>
          <div className="text-[11px] text-white/35 leading-relaxed">
            点击「预览 / 模拟」可以在不打开设计器的情况下通过 dry-run 查看节点执行路径。
            点击「使用此模板」将模板深拷贝到设计器，原始模板不会被修改。
          </div>
        </div>
      </main>

      {/* Preview modal */}
      <AnimatePresence>
        {previewTemplate && (
          <TemplatePreviewModal
            template={previewTemplate}
            onClose={() => setPreviewTemplate(null)}
            onUse={handleUseTemplate}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
