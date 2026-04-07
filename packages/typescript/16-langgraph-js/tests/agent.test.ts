import { describe, it, expect, vi } from 'vitest'
import { StateGraph, CompiledStateGraph, createReActGraph } from '../src/agent.js'
import type { AgentState } from '../src/agent.js'

function makeState(overrides: Partial<AgentState> = {}): AgentState {
  return { messages: [], context: {}, ...overrides }
}

describe('StateGraph', () => {
  it('throws without entry point', () => {
    const g = new StateGraph<AgentState>()
    g.addNode('n', async s => s)
    expect(() => g.compile()).toThrow('Entry point not set')
  })

  it('compiles with entry point', () => {
    const g = new StateGraph<AgentState>()
    g.addNode('start', async s => s)
    g.setEntryPoint('start')
    const compiled = g.compile()
    expect(compiled).toBeInstanceOf(CompiledStateGraph)
    expect(compiled.nodeCount).toBe(1)
  })

  it('chains fluently', () => {
    const g = new StateGraph<AgentState>()
      .addNode('a', async s => s)
      .addNode('b', async s => s)
      .addEdge('a', 'b')
      .setEntryPoint('a')
    expect(g.compile().nodeCount).toBe(2)
  })
})

describe('CompiledStateGraph', () => {
  it('invokes single node', async () => {
    const g = new StateGraph<AgentState>()
      .addNode('process', async s => ({ ...s, answer: 'done' }))
      .setEntryPoint('process')
    const result = await g.compile().invoke(makeState())
    expect(result.answer).toBe('done')
  })

  it('passes state through multiple nodes', async () => {
    const order: string[] = []
    const g = new StateGraph<{ val: number; steps: string[] }>()
      .addNode('step1', async s => { order.push('step1'); return { val: s.val + 1, steps: [...s.steps, 'step1'] } })
      .addNode('step2', async s => { order.push('step2'); return { val: s.val * 2, steps: [...s.steps, 'step2'] } })
      .addEdge('step1', 'step2')
      .setEntryPoint('step1')
    const result = await g.compile().invoke({ val: 5, steps: [] })
    expect(order).toEqual(['step1', 'step2'])
    expect(result.val).toBe(12)
  })

  it('routes conditionally', async () => {
    const g = new StateGraph<AgentState>()
      .addNode('route', async s => s)
      .addNode('path_a', async s => ({ ...s, answer: 'path A' }))
      .addNode('path_b', async s => ({ ...s, answer: 'path B' }))
      .addConditionalEdges('route', s => s.context.choice as string ?? 'a', { a: 'path_a', b: 'path_b' })
      .setEntryPoint('route')

    const resultA = await g.compile().invoke(makeState({ context: { choice: 'a' } }))
    const resultB = await g.compile().invoke(makeState({ context: { choice: 'b' } }))
    expect(resultA.answer).toBe('path A')
    expect(resultB.answer).toBe('path B')
  })
})

describe('createReActGraph', () => {
  it('returns answer without llm', async () => {
    const graph = createReActGraph()
    const result = await graph.invoke(makeState({ messages: [{ role: 'user', content: 'hello' }] }))
    expect(result.answer).toBe('No LLM provided')
  })

  it('uses llm for thinking and answering', async () => {
    const mockLLM = { complete: vi.fn().mockResolvedValueOnce('Step 1: analyze').mockResolvedValueOnce('The answer is 42') }
    const graph = createReActGraph(mockLLM)
    const result = await graph.invoke(makeState({ messages: [{ role: 'user', content: 'What is 6*7?' }] }))
    expect(result.answer).toBe('The answer is 42')
    expect(mockLLM.complete).toHaveBeenCalledTimes(2)
  })
})
