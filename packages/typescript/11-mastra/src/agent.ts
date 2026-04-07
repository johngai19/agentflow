/**
 * Mastra starter - Modern TypeScript agent framework
 * https://mastra.ai
 */

export interface Tool<TInput = Record<string, unknown>, TOutput = unknown> {
  id: string
  description: string
  execute: (input: TInput) => Promise<TOutput>
}

export interface AgentConfig {
  name: string
  instructions: string
  model?: string
  tools?: Tool[]
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface GenerateResult {
  text: string
  messages: Message[]
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

export type ModelProvider = {
  generate: (messages: Message[], system: string, tools: Tool[]) => Promise<string>
}

export class MastraAgent {
  readonly name: string
  readonly instructions: string
  readonly model: string
  private tools: Map<string, Tool>
  private modelProvider?: ModelProvider

  constructor(config: AgentConfig, provider?: ModelProvider) {
    this.name = config.name
    this.instructions = config.instructions
    this.model = config.model ?? 'claude-3-5-sonnet-latest'
    this.tools = new Map((config.tools ?? []).map(t => [t.id, t]))
    this.modelProvider = provider
  }

  addTool(tool: Tool): void {
    this.tools.set(tool.id, tool)
  }

  getTool(id: string): Tool | undefined {
    return this.tools.get(id)
  }

  get toolIds(): string[] {
    return Array.from(this.tools.keys())
  }

  async generate(input: string, history: Message[] = []): Promise<GenerateResult> {
    if (!this.modelProvider) {
      throw new Error('Model provider required for generation')
    }
    const messages: Message[] = [
      ...history,
      { role: 'user', content: input },
    ]
    const text = await this.modelProvider.generate(
      messages,
      this.instructions,
      Array.from(this.tools.values()),
    )
    const resultMessages: Message[] = [
      ...messages,
      { role: 'assistant', content: text },
    ]
    return { text, messages: resultMessages }
  }
}

export class MastraWorkflow {
  private steps: Array<{ name: string; fn: (ctx: Record<string, unknown>) => Promise<Record<string, unknown>> }> = []
  readonly name: string

  constructor(name: string) {
    this.name = name
  }

  step(name: string, fn: (ctx: Record<string, unknown>) => Promise<Record<string, unknown>>): this {
    this.steps.push({ name, fn })
    return this
  }

  async execute(initialContext: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    let ctx = { ...initialContext }
    for (const step of this.steps) {
      ctx = await step.fn(ctx)
    }
    return ctx
  }

  get stepCount(): number {
    return this.steps.length
  }
}
