import { describe, it, expect, vi } from 'vitest'
import { PromptTemplate, LLMChain, SequentialChain, AgentExecutor } from '../src/agent.js'

function makeLLM(response: string) {
  return { invoke: vi.fn().mockResolvedValue(response) }
}

describe('PromptTemplate', () => {
  it('creates from template string', () => {
    const pt = PromptTemplate.fromTemplate('Hello {name}, you are {age} years old')
    expect(pt.inputVariables).toContain('name')
    expect(pt.inputVariables).toContain('age')
  })

  it('formats template with variables', async () => {
    const pt = PromptTemplate.fromTemplate('Say hello to {name}')
    const result = await pt.invoke({ name: 'Alice' })
    expect(result).toBe('Say hello to Alice')
  })

  it('replaces multiple occurrences', async () => {
    const pt = PromptTemplate.fromTemplate('{x} + {x} = ?')
    const result = await pt.invoke({ x: '5' })
    expect(result).toBe('5 + 5 = ?')
  })
})

describe('LLMChain', () => {
  it('invokes llm with formatted prompt', async () => {
    const llm = makeLLM('Paris')
    const pt = PromptTemplate.fromTemplate('What is the capital of {country}?')
    const chain = new LLMChain(pt, llm)
    const result = await chain.invoke({ country: 'France' })
    expect(result).toBe('Paris')
    expect(llm.invoke).toHaveBeenCalledWith('What is the capital of France?')
  })
})

describe('SequentialChain', () => {
  it('chains runnables', async () => {
    const chain = new SequentialChain()
      .pipe({ invoke: async (x: string) => x.toUpperCase() })
      .pipe({ invoke: async (x: string) => `Result: ${x}` })
    const result = await chain.invoke('hello')
    expect(result).toBe('Result: HELLO')
  })

  it('counts chain length', () => {
    const chain = new SequentialChain()
      .pipe({ invoke: async (x: string) => x })
      .pipe({ invoke: async (x: string) => x })
    expect(chain.length).toBe(2)
  })
})

describe('AgentExecutor', () => {
  it('throws without llm', async () => {
    const executor = new AgentExecutor()
    await expect(executor.invoke('test')).rejects.toThrow('LLM required')
  })

  it('adds tools', () => {
    const executor = new AgentExecutor()
    executor.addTool({ name: 'search', description: 'Search', schema: {}, call: vi.fn() })
    expect(executor.toolNames).toContain('search')
  })

  it('invokes with tools available', async () => {
    const llm = makeLLM('Using search tool to find answer...')
    const executor = new AgentExecutor(llm, [{
      name: 'search',
      description: 'Search the web',
      schema: {},
      call: vi.fn().mockResolvedValue('results'),
    }])
    const result = await executor.invoke('Find information about LangChain')
    expect(result).toBe('Using search tool to find answer...')
    const prompt = (llm.invoke as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(prompt).toContain('search')
    expect(prompt).toContain('LangChain')
  })
})
