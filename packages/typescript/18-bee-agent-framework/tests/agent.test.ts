import { describe, it, expect, vi } from 'vitest'
import { CalculatorTool, BeeAgent } from '../src/agent.js'
import type { AgentAction } from '../src/agent.js'

describe('CalculatorTool', () => {
  const calc = new CalculatorTool()

  it('has correct schema', () => {
    expect(calc.schema.name).toBe('Calculator')
    expect(calc.schema.description).toContain('mathematical')
  })

  it('evaluates addition', async () => {
    expect(await calc.run({ expression: '2 + 2' })).toBe('4')
  })

  it('evaluates complex expressions', async () => {
    expect(await calc.run({ expression: '10 * 5 + 3' })).toBe('53')
  })

  it('handles invalid expressions', async () => {
    const result = await calc.run({ expression: 'not a math expression!!!' })
    expect(result).toContain('Error')
  })
})

describe('BeeAgent', () => {
  it('throws without llm', async () => {
    const agent = new BeeAgent()
    await expect(agent.run('test')).rejects.toThrow('LLM required')
  })

  it('lists tool names', () => {
    const agent = new BeeAgent(undefined, [new CalculatorTool()])
    expect(agent.toolNames).toContain('Calculator')
  })

  it('adds tool dynamically', () => {
    const agent = new BeeAgent()
    agent.addTool(new CalculatorTool())
    expect(agent.toolNames).toContain('Calculator')
  })

  it('returns final answer', async () => {
    const llm = { complete: vi.fn().mockResolvedValue('ANSWER:42 is the answer') }
    const agent = new BeeAgent(llm)
    const result = await agent.run('What is the answer?')
    expect(result).toBe('42 is the answer')
  })

  it('processes thought then answer', async () => {
    const llm = { complete: vi.fn()
      .mockResolvedValueOnce('THOUGHT:I need to think about this')
      .mockResolvedValueOnce('ANSWER:The result is 7')
    }
    const agent = new BeeAgent(llm)
    const result = await agent.run('Compute something')
    expect(result).toBe('The result is 7')
    const actions = agent.memoryActions
    expect(actions[0].type).toBe('thought')
    expect(actions[1].type).toBe('answer')
  })

  it('calls tool and returns answer', async () => {
    const llm = { complete: vi.fn()
      .mockResolvedValueOnce('TOOL:Calculator|INPUT:{"expression":"6*7"}')
      .mockResolvedValueOnce('ANSWER:6 * 7 = 42')
    }
    const agent = new BeeAgent(llm, [new CalculatorTool()])
    const result = await agent.run('What is 6 times 7?')
    expect(result).toBe('6 * 7 = 42')
  })

  it('tracks memory actions', async () => {
    const llm = { complete: vi.fn().mockResolvedValue('ANSWER:done') }
    const agent = new BeeAgent(llm)
    await agent.run('test')
    expect(agent.memoryActions).toHaveLength(1)
    expect(agent.memoryActions[0].type).toBe('answer')
  })
})
