/**
 * workflowTemplates tests
 *
 * Validates the structural integrity and completeness of all workflow templates.
 */
import { describe, it, expect } from 'vitest'
import {
  WORKFLOW_TEMPLATES,
  TEMPLATE_MAP,
  TEMPLATE_CATEGORIES,
  type WorkflowTemplate,
} from '@/data/workflowTemplates'

// ─── Registry completeness ────────────────────────────────────────────────────

describe('WORKFLOW_TEMPLATES registry', () => {
  it('exports exactly 5 templates', () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(5)
  })

  it('all expected scenario IDs are present', () => {
    const ids = WORKFLOW_TEMPLATES.map(t => t.id)
    expect(ids).toContain('tpl-ticket-creation')
    expect(ids).toContain('tpl-alert-response')
    expect(ids).toContain('tpl-resource-provision')
    expect(ids).toContain('tpl-permission-change')
    expect(ids).toContain('tpl-knowledge-consultation')
  })

  it('TEMPLATE_MAP contains all templates keyed by id', () => {
    for (const tpl of WORKFLOW_TEMPLATES) {
      expect(TEMPLATE_MAP[tpl.id]).toBe(tpl)
    }
  })

  it('TEMPLATE_CATEGORIES covers all categories used in templates', () => {
    const usedCategories = new Set(WORKFLOW_TEMPLATES.map(t => t.category))
    for (const cat of usedCategories) {
      expect(TEMPLATE_CATEGORIES).toHaveProperty(cat)
    }
  })

  it('each TEMPLATE_CATEGORIES entry has label, icon, and color', () => {
    for (const [, cfg] of Object.entries(TEMPLATE_CATEGORIES)) {
      expect(typeof cfg.label).toBe('string')
      expect(cfg.label.length).toBeGreaterThan(0)
      expect(typeof cfg.icon).toBe('string')
      expect(cfg.icon.length).toBeGreaterThan(0)
      expect(typeof cfg.color).toBe('string')
      expect(cfg.color.length).toBeGreaterThan(0)
    }
  })
})

// ─── Per-template structural checks ──────────────────────────────────────────

describe.each(WORKFLOW_TEMPLATES.map(t => [t.name, t] as [string, WorkflowTemplate]))(
  'template "%s"',
  (_, tpl) => {
    const def = tpl.definition

    it('has a non-empty name and description', () => {
      expect(tpl.name.length).toBeGreaterThan(0)
      expect(tpl.description.length).toBeGreaterThan(0)
    })

    it('has a valid category', () => {
      const validCategories = ['ops', 'security', 'infra', 'knowledge', 'iam']
      expect(validCategories).toContain(tpl.category)
    })

    it('has at least one tag', () => {
      expect(tpl.tags.length).toBeGreaterThan(0)
    })

    it('has nodeCount matching or within 2 of actual nodes', () => {
      // nodeCount is a display hint — allow a tolerance of 2
      expect(Math.abs(tpl.nodeCount - def.nodes.length)).toBeLessThanOrEqual(2)
    })

    it('definition has unique node IDs', () => {
      const ids = def.nodes.map(n => n.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('definition has unique edge IDs', () => {
      const ids = def.edges.map(e => e.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('definition has at least 4 nodes', () => {
      expect(def.nodes.length).toBeGreaterThanOrEqual(4)
    })

    it('definition has at least 3 edges', () => {
      expect(def.edges.length).toBeGreaterThanOrEqual(3)
    })

    it('all edge source/target nodes exist', () => {
      const nodeIds = new Set(def.nodes.map(n => n.id))
      for (const edge of def.edges) {
        expect(nodeIds.has(edge.from)).toBe(true)
        expect(nodeIds.has(edge.to)).toBe(true)
      }
    })

    it('has at least one start node (isStart or no incoming edges)', () => {
      const hasExplicitStart = def.nodes.some(n => n.isStart)
      if (!hasExplicitStart) {
        const hasIncoming = new Set(def.edges.map(e => e.to))
        const noIncoming = def.nodes.filter(n => !hasIncoming.has(n.id))
        expect(noIncoming.length).toBeGreaterThan(0)
      }
    })

    it('has at least one trigger defined', () => {
      expect(def.triggers.length).toBeGreaterThan(0)
    })

    it('has enabled=false (templates start disabled)', () => {
      expect(def.enabled).toBe(false)
    })

    it('currentVersion is 1 and versions is empty', () => {
      expect(def.currentVersion).toBe(1)
      expect(def.versions).toHaveLength(0)
    })

    it('all nodes have a non-empty label', () => {
      for (const node of def.nodes) {
        expect(node.label.length).toBeGreaterThan(0)
      }
    })

    it('all nodes have a position', () => {
      for (const node of def.nodes) {
        expect(typeof node.position.x).toBe('number')
        expect(typeof node.position.y).toBe('number')
      }
    })

    it('all nodes have a config', () => {
      for (const node of def.nodes) {
        expect(node.config).toBeDefined()
        expect(typeof node.config).toBe('object')
      }
    })

    it('has no duplicate edges (same from+to pair)', () => {
      const seen = new Set<string>()
      for (const edge of def.edges) {
        const key = `${edge.from}→${edge.to}`
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    })
  }
)

// ─── Template-specific content checks ────────────────────────────────────────

describe('ticket_creation template', () => {
  const tpl = TEMPLATE_MAP['tpl-ticket-creation']

  it('has webhook and manual triggers', () => {
    const triggerTypes = tpl.definition.triggers.map(t => t.type)
    expect(triggerTypes).toContain('webhook')
    expect(triggerTypes).toContain('manual')
  })

  it('has contextVariables including priority', () => {
    const keys = tpl.definition.contextVariables?.map(v => v.key) ?? []
    expect(keys).toContain('priority')
    expect(keys).toContain('title')
  })

  it('contains an approval node for urgent tickets', () => {
    const approvalNodes = tpl.definition.nodes.filter(n => n.type === 'approval')
    expect(approvalNodes.length).toBeGreaterThan(0)
  })

  it('ends with a notification node', () => {
    const endNodes = tpl.definition.nodes.filter(n => n.isEnd)
    expect(endNodes.some(n => n.type === 'notification')).toBe(true)
  })
})

describe('alert_response template', () => {
  const tpl = TEMPLATE_MAP['tpl-alert-response']

  it('has parallel_fork and parallel_join nodes', () => {
    const types = tpl.definition.nodes.map(n => n.type)
    expect(types).toContain('parallel_fork')
    expect(types).toContain('parallel_join')
  })

  it('has a condition node to route by severity', () => {
    const condNodes = tpl.definition.nodes.filter(n => n.type === 'condition')
    expect(condNodes.length).toBeGreaterThan(0)
  })

  it('has 3 parallel diagnostic branches from fork', () => {
    const fork = tpl.definition.nodes.find(n => n.type === 'parallel_fork')!
    const branchEdges = tpl.definition.edges.filter(e => e.from === fork.id)
    expect(branchEdges.length).toBe(3)
  })
})

describe('resource_provision template', () => {
  const tpl = TEMPLATE_MAP['tpl-resource-provision']

  it('has prod environment approval node', () => {
    const approvalNodes = tpl.definition.nodes.filter(n => n.type === 'approval')
    expect(approvalNodes.length).toBeGreaterThan(0)
  })

  it('contextVariables includes environment and resourceType', () => {
    const keys = tpl.definition.contextVariables?.map(v => v.key) ?? []
    expect(keys).toContain('environment')
    expect(keys).toContain('resourceType')
  })
})

describe('permission_change template', () => {
  const tpl = TEMPLATE_MAP['tpl-permission-change']

  it('has a timer node for auto-expiry', () => {
    const timerNodes = tpl.definition.nodes.filter(n => n.type === 'timer')
    expect(timerNodes.length).toBeGreaterThan(0)
  })

  it('has two approval nodes (security + biz)', () => {
    const approvalNodes = tpl.definition.nodes.filter(n => n.type === 'approval')
    expect(approvalNodes.length).toBeGreaterThanOrEqual(2)
  })

  it('contextVariables includes action', () => {
    const keys = tpl.definition.contextVariables?.map(v => v.key) ?? []
    expect(keys).toContain('action')
  })
})

describe('knowledge_consultation template', () => {
  const tpl = TEMPLATE_MAP['tpl-knowledge-consultation']

  it('has parallel_fork for multi-source retrieval', () => {
    expect(tpl.definition.nodes.some(n => n.type === 'parallel_fork')).toBe(true)
  })

  it('has 3 retrieval branches', () => {
    const fork = tpl.definition.nodes.find(n => n.type === 'parallel_fork')!
    const branchEdges = tpl.definition.edges.filter(e => e.from === fork.id)
    expect(branchEdges.length).toBe(3)
  })

  it('has a confidence condition node', () => {
    const condNodes = tpl.definition.nodes.filter(n => n.type === 'condition')
    expect(condNodes.length).toBeGreaterThan(0)
  })

  it('has two notification endpoints (direct answer + escalate)', () => {
    const notifNodes = tpl.definition.nodes.filter(n => n.type === 'notification')
    expect(notifNodes.length).toBeGreaterThanOrEqual(2)
  })
})
