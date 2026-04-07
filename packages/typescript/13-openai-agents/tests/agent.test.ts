import { describe, it, expect, vi } from 'vitest'
import { OpenAIAgent, Handoff } from '../src/agent.js'
import type { OpenAIClient } from '../src/agent.js'

function makeClient(responses: Array<{ choices: any[] }>): OpenAIClient {
  let i = 0
  return { chat: { completions: { create: vi.fn().mockImplementation(async () => responses[i++] ?? responses[responses.length - 1]) } } }
}

function stopResponse(content: string) {
  return { choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }
}

function toolCallResponse(name: string, args: Record<string, unknown>) {
  return {
    choices: [{
      message: { role: 'assistant', content: null, tool_calls: [{ id: 'tc_1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] },
      finish_reason: 'tool_calls',
    }],
  }
}

describe('OpenAIAgent', () => {
  it('creates agent with config', () => {
    const agent = new OpenAIAgent({ name: 'TestAgent', instructions: 'Be helpful' })
    expect(agent.name).toBe('TestAgent')
    expect(agent.model).toBe('gpt-4o')
  })

  it('adds function tool', () => {
    const agent = new OpenAIAgent({ name: 'Agent', instructions: '' })
    agent.addFunctionTool('search', 'Search', {}, async () => 'results')
    expect(agent.toolCount).toBe(1)
  })

  it('throws without client', async () => {
    const agent = new OpenAIAgent({ name: 'Agent', instructions: '' })
    await expect(agent.run('test')).rejects.toThrow('OpenAI client required')
  })

  it('returns text on stop', async () => {
    const client = makeClient([stopResponse('Hello from GPT!')])
    const agent = new OpenAIAgent({ name: 'Agent', instructions: '' }, client)
    const result = await agent.run('Say hello')
    expect(result).toBe('Hello from GPT!')
    expect(agent.runSteps).toHaveLength(1)
  })

  it('calls tool and gets final answer', async () => {
    const handler = vi.fn().mockResolvedValue('42')
    const client = makeClient([
      toolCallResponse('calculate', { expression: '6 * 7' }),
      stopResponse('The answer is 42'),
    ])
    const agent = new OpenAIAgent({ name: 'Agent', instructions: '' }, client)
    agent.addFunctionTool('calculate', 'Calculator', {}, handler)
    const result = await agent.run('What is 6 * 7?')
    expect(result).toBe('The answer is 42')
    expect(handler).toHaveBeenCalledWith({ expression: '6 * 7' })
  })
})

describe('Handoff', () => {
  it('creates handoff between agents', () => {
    const a1 = new OpenAIAgent({ name: 'Agent1', instructions: '' })
    const a2 = new OpenAIAgent({ name: 'Agent2', instructions: '' })
    const handoff = new Handoff(a1, a2, input => input.includes('code'))
    expect(handoff.shouldHandoff('write some code')).toBe(true)
    expect(handoff.shouldHandoff('general question')).toBe(false)
  })

  it('always handoffs without condition', () => {
    const a1 = new OpenAIAgent({ name: 'A1', instructions: '' })
    const a2 = new OpenAIAgent({ name: 'A2', instructions: '' })
    const handoff = new Handoff(a1, a2)
    expect(handoff.shouldHandoff('anything')).toBe(true)
  })
})
