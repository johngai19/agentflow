import { describe, it, expect } from 'vitest'
import { createAgentManifest, validateManifest, createTeamManifest } from '../src/agent.js'
import type { KagentManifest } from '../src/agent.js'

describe('createAgentManifest', () => {
  it('creates valid agent manifest', () => {
    const manifest = createAgentManifest('my-agent', {
      description: 'A helpful AI agent',
      systemPrompt: 'You are a helpful assistant',
    })
    expect(manifest.apiVersion).toBe('kagent.dev/v1alpha1')
    expect(manifest.kind).toBe('Agent')
    expect(manifest.metadata.name).toBe('my-agent')
    expect(manifest.metadata.namespace).toBe('default')
  })

  it('sets default model config', () => {
    const manifest = createAgentManifest('agent', {
      description: 'Test', systemPrompt: 'Test'
    })
    expect(manifest.spec.modelConfig.name).toBe('default-model')
  })

  it('uses custom model config name', () => {
    const manifest = createAgentManifest('agent', {
      description: 'Test', systemPrompt: 'Test', modelConfigName: 'claude-model'
    })
    expect(manifest.spec.modelConfig.name).toBe('claude-model')
  })

  it('includes tools when specified', () => {
    const manifest = createAgentManifest('agent', {
      description: 'Test', systemPrompt: 'Test',
      tools: [{ type: 'McpServer', name: 'filesystem' }]
    })
    expect(manifest.spec.tools).toHaveLength(1)
    expect(manifest.spec.tools![0].name).toBe('filesystem')
  })
})

describe('validateManifest', () => {
  function makeValid(): KagentManifest {
    return createAgentManifest('test-agent', {
      description: 'Test agent', systemPrompt: 'Be helpful'
    })
  }

  it('validates correct manifest', () => {
    const result = validateManifest(makeValid())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects wrong apiVersion', () => {
    const m = { ...makeValid(), apiVersion: 'wrong/v1' }
    const result = validateManifest(m)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid apiVersion')
  })

  it('rejects missing system prompt', () => {
    const m = makeValid()
    m.spec.systemPrompt = ''
    expect(validateManifest(m).valid).toBe(false)
  })

  it('rejects missing description', () => {
    const m = makeValid()
    m.spec.description = ''
    expect(validateManifest(m).valid).toBe(false)
  })
})

describe('createTeamManifest', () => {
  it('creates team with agents', () => {
    const team = createTeamManifest('my-team', ['agent-1', 'agent-2', 'agent-3'])
    expect(team.kind).toBe('Team')
    expect(team.spec.participants).toHaveLength(3)
    expect(team.spec.participants[0].name).toBe('agent-1')
  })

  it('sets default max turns', () => {
    const team = createTeamManifest('team', ['a', 'b'])
    expect(team.spec.maxTurns).toBe(10)
  })

  it('uses custom max turns', () => {
    const team = createTeamManifest('team', ['a'], 5)
    expect(team.spec.maxTurns).toBe(5)
  })
})
