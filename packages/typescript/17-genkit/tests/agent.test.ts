import { describe, it, expect, vi } from 'vitest'
import { GenkitFlow, GenkitPrompt, GenkitRegistry } from '../src/agent.js'

describe('GenkitFlow', () => {
  it('runs flow and returns output', async () => {
    const flow = new GenkitFlow('greet', async (name: string) => `Hello, ${name}!`)
    const result = await flow.run('Alice')
    expect(result.output).toBe('Hello, Alice!')
    expect(result.metadata.steps).toBe(1)
  })

  it('tracks step count', async () => {
    const flow = new GenkitFlow('counter', async (x: number) => x * 2)
    await flow.run(1)
    await flow.run(2)
    const result = await flow.run(3)
    expect(result.metadata.steps).toBe(3)
  })

  it('measures duration', async () => {
    const flow = new GenkitFlow('slow', async (x: number) => x)
    const result = await flow.run(42)
    expect(result.metadata.duration).toBeGreaterThanOrEqual(0)
  })
})

describe('GenkitPrompt', () => {
  const config = { model: 'gemini-2.0-flash', maxTokens: 100 }

  it('renders template variables', async () => {
    const prompt = new GenkitPrompt(config, 'Hello {{name}}, you asked: {{question}}')
    const rendered = await prompt.render({ name: 'Bob', question: 'What is AI?' })
    expect(rendered).toBe('Hello Bob, you asked: What is AI?')
  })

  it('throws without llm for generate', async () => {
    const prompt = new GenkitPrompt(config, 'Hello {{name}}')
    await expect(prompt.generate({ name: 'Alice' })).rejects.toThrow('LLM required')
  })

  it('generates with mock llm', async () => {
    const mockLLM = { generate: vi.fn().mockResolvedValue('AI is amazing!') }
    const prompt = new GenkitPrompt(config, 'What is {{topic}}?', mockLLM)
    const result = await prompt.generate({ topic: 'AI' })
    expect(result).toBe('AI is amazing!')
    expect(mockLLM.generate).toHaveBeenCalledWith(config, 'What is AI?')
  })
})

describe('GenkitRegistry', () => {
  it('defines and retrieves flows', () => {
    const registry = new GenkitRegistry()
    registry.defineFlow('test', async (x: string) => x.toUpperCase())
    expect(registry.getFlow('test')).toBeDefined()
    expect(registry.flowCount).toBe(1)
  })

  it('returns undefined for unknown flow', () => {
    const registry = new GenkitRegistry()
    expect(registry.getFlow('unknown')).toBeUndefined()
  })

  it('defines and retrieves prompts', () => {
    const registry = new GenkitRegistry()
    registry.definePrompt('my_prompt', { model: 'gemini-2.0-flash' }, 'Hello {{name}}')
    expect(registry.getPrompt('my_prompt')).toBeDefined()
  })

  it('executes flow through registry', async () => {
    const registry = new GenkitRegistry()
    const flow = registry.defineFlow('double', async (n: number) => n * 2)
    const result = await flow.run(21)
    expect(result.output).toBe(42)
  })
})
