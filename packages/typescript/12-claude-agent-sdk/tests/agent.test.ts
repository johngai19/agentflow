import { describe, it, expect, vi } from 'vitest'
import { ClaudeAgent } from '../src/agent.js'
import type { AnthropicClient, AgentTool, TextBlock, ToolUseBlock } from '../src/agent.js'

function makeClient(responses: Array<{ content: any[]; stop_reason: string }>): AnthropicClient {
  let callCount = 0
  return {
    messages: {
      create: vi.fn().mockImplementation(async () => {
        const resp = responses[callCount] ?? responses[responses.length - 1]
        callCount++
        return resp
      }),
    },
  }
}

function makeTextResponse(text: string) {
  return { content: [{ type: 'text', text }], stop_reason: 'end_turn' }
}

function makeToolUseResponse(name: string, input: Record<string, unknown>) {
  return {
    content: [{ type: 'tool_use', id: 'tu_001', name, input }],
    stop_reason: 'tool_use',
  }
}

describe('ClaudeAgent', () => {
  it('creates agent with defaults', () => {
    const agent = new ClaudeAgent()
    expect(agent.model).toBe('claude-opus-4-6')
    expect(agent.systemPrompt).toBe('You are a helpful assistant.')
    expect(agent.toolCount).toBe(0)
  })

  it('registers tools', () => {
    const tool: AgentTool = {
      name: 'search',
      description: 'Search web',
      input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Query' } }, required: ['query'] },
      handler: async ({ query }) => `Results for ${query}`,
    }
    const agent = new ClaudeAgent(undefined, { tools: [tool] })
    expect(agent.toolCount).toBe(1)
  })

  it('throws without client', async () => {
    const agent = new ClaudeAgent()
    await expect(agent.run('Hello')).rejects.toThrow('Anthropic client required')
  })

  it('returns text response on end_turn', async () => {
    const client = makeClient([makeTextResponse('Hello from Claude!')])
    const agent = new ClaudeAgent(client)
    const result = await agent.run('Say hello')
    expect(result).toBe('Hello from Claude!')
  })

  it('handles tool use and gets final answer', async () => {
    const weatherTool: AgentTool = {
      name: 'get_weather',
      description: 'Get weather',
      input_schema: { type: 'object', properties: { location: { type: 'string', description: 'Location' } }, required: ['location'] },
      handler: vi.fn().mockResolvedValue('Sunny, 22°C'),
    }
    const client = makeClient([
      makeToolUseResponse('get_weather', { location: 'London' }),
      makeTextResponse("London's weather is Sunny, 22°C"),
    ])
    const agent = new ClaudeAgent(client, { tools: [weatherTool] })
    const result = await agent.run("What's the weather in London?")
    expect(result).toContain('London')
    expect(weatherTool.handler).toHaveBeenCalledWith({ location: 'London' })
  })

  it('handles unknown tool gracefully', async () => {
    const agent = new ClaudeAgent()
    const result = await agent.runToolUse({ type: 'tool_use', id: 'tu_x', name: 'unknown', input: {} })
    expect(result.is_error).toBe(true)
    expect(result.content).toContain("not found")
  })

  it('returns tool schemas without handlers', () => {
    const agent = new ClaudeAgent(undefined, {
      tools: [{
        name: 'calc',
        description: 'Calculator',
        input_schema: { type: 'object', properties: {}, required: [] },
        handler: async () => '42',
      }],
    })
    const schemas = agent.getToolSchemas()
    expect(schemas[0]).not.toHaveProperty('handler')
    expect(schemas[0].name).toBe('calc')
  })
})
