import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AgentRegistryPage, {
  applyHealthCheckResults,
  buildRegisterPayload,
  formatLastSeen,
  parseTagList,
  slugifyAgentName,
} from '@/app/agents/registry/page'
import type { AgentInfo } from '@/lib/opsagentApi'

const sampleAgent: AgentInfo = {
  agent_id: 'incident-triage-agent',
  name: 'Incident Triage Agent',
  description: 'Handles incident routing',
  base_url: 'https://agent.internal',
  a2a_endpoint: 'https://agent.internal/a2a',
  health_check_url: 'https://agent.internal/health',
  capabilities: [
    {
      name: 'triage',
      description: 'triage capability',
      intents: ['triage'],
      input_schema: {},
      output_schema: {},
    },
  ],
  tags: ['triage'],
  metadata: {},
  is_healthy: true,
  last_seen: '2026-04-10T12:00:00.000Z',
  registered_at: '2026-04-09T12:00:00.000Z',
}

describe('AgentRegistryPage', () => {
  it('renders the registry table and register form sections', () => {
    const html = renderToStaticMarkup(createElement(AgentRegistryPage))

    expect(html).toContain('Agent Registry')
    expect(html).toContain('Registered Agents')
    expect(html).toContain('Register New Agent')
    expect(html).toContain('Name')
    expect(html).toContain('Status')
    expect(html).toContain('Capabilities')
    expect(html).toContain('Last Seen')
    expect(html).toContain('Actions')
    expect(html).toContain('Endpoint URL')
    expect(html).toContain('Capabilities Tags')
    expect(html).toContain('Register Agent')
  })
})

describe('agent registry helpers', () => {
  it('parses unique capability tags', () => {
    expect(parseTagList('triage, diagnostics, triage , remediation')).toEqual([
      'triage',
      'diagnostics',
      'remediation',
    ])
  })

  it('slugifies agent names for registry ids', () => {
    expect(slugifyAgentName(' Incident Triage Agent ')).toBe('incident-triage-agent')
  })

  it('builds a register payload from the form values', () => {
    const payload = buildRegisterPayload({
      name: 'Incident Triage Agent',
      endpointUrl: 'https://agent.internal/a2a',
      capabilityTags: 'triage, diagnostics',
    })

    expect(payload.agent_id).toBe('incident-triage-agent')
    expect(payload.base_url).toBe('https://agent.internal')
    expect(payload.a2a_endpoint).toBe('https://agent.internal/a2a')
    expect(payload.health_check_url).toBe('https://agent.internal/health')
    expect(payload.capabilities.map(capability => capability.name)).toEqual([
      'triage',
      'diagnostics',
    ])
    expect(payload.tags).toEqual(['triage', 'diagnostics'])
  })

  it('applies health check results to matching agents only', () => {
    const updated = applyHealthCheckResults(
      [
        sampleAgent,
        {
          ...sampleAgent,
          agent_id: 'remediation-agent',
          name: 'Remediation Agent',
          is_healthy: true,
        },
      ],
      { 'remediation-agent': false },
    )

    expect(updated[0].is_healthy).toBe(true)
    expect(updated[1].is_healthy).toBe(false)
    expect(updated[1].last_seen).not.toBeNull()
  })

  it('formats missing and valid last_seen values', () => {
    expect(formatLastSeen(null)).toBe('Never')
    expect(formatLastSeen('2026-04-10T12:00:00.000Z')).toContain('2026')
  })
})
