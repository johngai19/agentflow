import { describe, it, expect, vi } from 'vitest'
import { VercelAIClient, mockStream } from '../src/agent.js'
import type { AIProvider, GenerateTextResult, StreamChunk } from '../src/agent.js'

function makeResult(text: string, toolCalls = []): GenerateTextResult {
  return { text, toolCalls, finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 20 }, steps: 1 }
}

function makeProvider(result: GenerateTextResult): AIProvider {
  return { generateText: vi.fn().mockResolvedValue(result) }
}

describe('VercelAIClient', () => {
  it('generates text', async () => {
    const provider = makeProvider(makeResult('Hello world'))
    const client = new VercelAIClient(provider)
    const result = await client.generateText('Say hello')
    expect(result.text).toBe('Hello world')
    expect(result.finishReason).toBe('stop')
  })

  it('defines tools', () => {
    const client = new VercelAIClient(makeProvider(makeResult('')))
    client.defineTool('search', {
      description: 'Search web',
      parameters: { query: { type: 'string', description: 'Query' } },
      execute: vi.fn(),
    })
    expect(client.getToolNames()).toContain('search')
  })

  it('chains tool definitions', () => {
    const provider = makeProvider(makeResult(''))
    const client = new VercelAIClient(provider)
      .defineTool('a', { description: '', parameters: {}, execute: vi.fn() })
      .defineTool('b', { description: '', parameters: {}, execute: vi.fn() })
    expect(client.getToolNames()).toHaveLength(2)
  })

  it('passes tools to provider', async () => {
    const provider = makeProvider(makeResult('With tools'))
    const client = new VercelAIClient(provider)
    client.defineTool('calc', { description: 'calc', parameters: {}, execute: vi.fn() })
    await client.generateText('Calculate something')
    const callArgs = (provider.generateText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArgs.tools).toHaveProperty('calc')
  })

  it('does not pass tools when none defined', async () => {
    const provider = makeProvider(makeResult('No tools'))
    const client = new VercelAIClient(provider)
    await client.generateText('No tools test')
    const callArgs = (provider.generateText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArgs.tools).toBeUndefined()
  })
})

describe('mockStream', () => {
  it('yields all chunks in order', async () => {
    const chunks: StreamChunk[] = [
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' world' },
      { type: 'finish', finishReason: 'stop' },
    ]
    const received: StreamChunk[] = []
    for await (const chunk of mockStream(chunks)) {
      received.push(chunk)
    }
    expect(received).toHaveLength(3)
    expect(received[0]).toEqual({ type: 'text', text: 'Hello' })
    expect(received[2].type).toBe('finish')
  })
})
