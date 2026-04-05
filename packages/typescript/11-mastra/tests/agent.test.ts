import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MastraAgent, MastraWorkflow } from '../src/agent.js'
import type { Tool, ModelProvider, Message } from '../src/agent.js'

function makeTool(id: string): Tool {
  return {
    id,
    description: `Tool ${id}`,
    execute: vi.fn().mockResolvedValue(`result from ${id}`),
  }
}

function makeProvider(response = 'Mocked response'): ModelProvider {
  return { generate: vi.fn().mockResolvedValue(response) }
}

describe('MastraAgent', () => {
  it('creates agent with config', () => {
    const agent = new MastraAgent({ name: 'TestAgent', instructions: 'Be helpful' })
    expect(agent.name).toBe('TestAgent')
    expect(agent.instructions).toBe('Be helpful')
    expect(agent.model).toBe('claude-3-5-sonnet-latest')
  })

  it('uses custom model if provided', () => {
    const agent = new MastraAgent({ name: 'Agent', instructions: '', model: 'gpt-4o' })
    expect(agent.model).toBe('gpt-4o')
  })

  it('registers tools from config', () => {
    const agent = new MastraAgent({
      name: 'Agent', instructions: '',
      tools: [makeTool('search'), makeTool('calc')],
    })
    expect(agent.toolIds).toContain('search')
    expect(agent.toolIds).toContain('calc')
  })

  it('adds tool dynamically', () => {
    const agent = new MastraAgent({ name: 'Agent', instructions: '' })
    agent.addTool(makeTool('newTool'))
    expect(agent.getTool('newTool')).toBeDefined()
  })

  it('returns undefined for unknown tool', () => {
    const agent = new MastraAgent({ name: 'Agent', instructions: '' })
    expect(agent.getTool('unknown')).toBeUndefined()
  })

  it('throws without provider', async () => {
    const agent = new MastraAgent({ name: 'Agent', instructions: '' })
    await expect(agent.generate('Hello')).rejects.toThrow('Model provider required')
  })

  it('generates response with provider', async () => {
    const provider = makeProvider('Mastra is a TypeScript agent framework.')
    const agent = new MastraAgent({ name: 'Agent', instructions: 'Be helpful' }, provider)
    const result = await agent.generate('What is Mastra?')
    expect(result.text).toBe('Mastra is a TypeScript agent framework.')
    expect(result.messages.length).toBe(2) // user + assistant
  })

  it('includes conversation history in generate', async () => {
    const provider = makeProvider('Follow-up response')
    const agent = new MastraAgent({ name: 'Agent', instructions: '' }, provider)
    const history: Message[] = [
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'First response' },
    ]
    const result = await agent.generate('Second message', history)
    expect(result.messages.length).toBe(4)
    const generateCall = (provider.generate as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(generateCall[0]).toHaveLength(3) // history + new user message
  })
})

describe('MastraWorkflow', () => {
  it('creates workflow with name', () => {
    const wf = new MastraWorkflow('test-workflow')
    expect(wf.name).toBe('test-workflow')
    expect(wf.stepCount).toBe(0)
  })

  it('chains steps fluently', () => {
    const wf = new MastraWorkflow('wf')
      .step('step1', async ctx => ctx)
      .step('step2', async ctx => ctx)
    expect(wf.stepCount).toBe(2)
  })

  it('executes steps in order', async () => {
    const order: string[] = []
    const wf = new MastraWorkflow('wf')
      .step('a', async ctx => { order.push('a'); return { ...ctx, a: true } })
      .step('b', async ctx => { order.push('b'); return { ...ctx, b: true } })
    const result = await wf.execute()
    expect(order).toEqual(['a', 'b'])
    expect(result).toMatchObject({ a: true, b: true })
  })

  it('passes context between steps', async () => {
    const wf = new MastraWorkflow('wf')
      .step('produce', async () => ({ data: 'hello' }))
      .step('transform', async ctx => ({ result: (ctx.data as string).toUpperCase() }))
    const result = await wf.execute()
    expect(result.result).toBe('HELLO')
  })

  it('executes with initial context', async () => {
    const wf = new MastraWorkflow('wf')
      .step('use', async ctx => ({ ...ctx, processed: true }))
    const result = await wf.execute({ initial: 'value' })
    expect(result.initial).toBe('value')
    expect(result.processed).toBe(true)
  })
})
