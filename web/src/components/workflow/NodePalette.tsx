'use client'

import { useDraggable } from '@dnd-kit/core'
import { NODE_PALETTE_ITEMS } from './nodes/nodeConfig'
import type { NodePaletteItem } from '@/types/workflow'

// ── Draggable palette item ─────────────────────────────────────────────────────

function PaletteItem({ item }: { item: NodePaletteItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${item.type}`,
    data: { isPaletteItem: true, nodeType: item.type },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing
        transition-all select-none
        ${item.color} ${item.borderColor}
        ${isDragging ? 'opacity-50 scale-95' : 'hover:brightness-125'}
      `}
      title={item.description}
    >
      <span className="text-base flex-shrink-0">{item.icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-white/80 truncate">{item.label}</div>
        <div className="text-[10px] text-white/40 truncate">{item.description}</div>
      </div>
    </div>
  )
}

// ── NodePalette component ──────────────────────────────────────────────────────

interface NodePaletteProps {
  className?: string
}

export function NodePalette({ className = '' }: NodePaletteProps) {
  return (
    <aside className={`flex flex-col gap-1 ${className}`}>
      <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1 px-1">
        节点类型
      </div>
      <div className="text-[10px] text-white/30 px-1 mb-2">拖拽到画布添加节点</div>
      <div className="space-y-1.5">
        {NODE_PALETTE_ITEMS.map(item => (
          <PaletteItem key={item.type} item={item} />
        ))}
      </div>
    </aside>
  )
}
