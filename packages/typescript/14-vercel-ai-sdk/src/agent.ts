/**
 * Vercel AI SDK starter - Streaming AI with tool support
 */

export type StreamChunk = { type: 'text'; text: string } | { type: 'tool_call'; name: string; args: Record<string, unknown> } | { type: 'finish'; finishReason: string }

export interface AITool {
  description: string
  parameters: Record<string, { type: string; description: string }>
  execute: (args: Record<string, unknown>) => Promise<unknown>
}

export interface GenerateTextOptions {
  model: string
  system?: string
  prompt: string
  tools?: Record<string, AITool>
  maxSteps?: number
}

export interface GenerateTextResult {
  text: string
  toolCalls: Array<{ toolName: string; args: Record<string, unknown>; result: unknown }>
  finishReason: string
  usage: { promptTokens: number; completionTokens: number }
  steps: number
}

export type AIProvider = {
  generateText: (options: GenerateTextOptions) => Promise<GenerateTextResult>
  streamText?: (options: GenerateTextOptions) => AsyncGenerator<StreamChunk>
}

export class VercelAIClient {
  private tools: Record<string, AITool> = {}

  constructor(private provider: AIProvider) {}

  defineTool(name: string, tool: AITool): this {
    this.tools[name] = tool
    return this
  }

  async generateText(prompt: string, options: { model?: string; system?: string } = {}): Promise<GenerateTextResult> {
    return this.provider.generateText({
      model: options.model ?? 'gpt-4o',
      system: options.system,
      prompt,
      tools: Object.keys(this.tools).length ? this.tools : undefined,
    })
  }

  getToolNames(): string[] {
    return Object.keys(this.tools)
  }
}

export async function* mockStream(chunks: StreamChunk[]): AsyncGenerator<StreamChunk> {
  for (const chunk of chunks) {
    yield chunk
  }
}
