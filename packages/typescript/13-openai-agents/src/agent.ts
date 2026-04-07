/**
 * OpenAI Agents SDK starter - OpenAI's agent framework patterns
 */

export type RunStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'requires_action'

export interface FunctionTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type ToolDefinition = FunctionTool

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface RunStep {
  id: string
  type: 'message_creation' | 'tool_calls'
  status: RunStatus
  content?: string
  toolCalls?: ToolCall[]
}

export type OpenAIClient = {
  chat: {
    completions: {
      create: (params: {
        model: string
        messages: Array<{ role: string; content: string }>
        tools?: ToolDefinition[]
      }) => Promise<{
        choices: Array<{
          message: { role: string; content: string | null; tool_calls?: ToolCall[] }
          finish_reason: string
        }>
      }>
    }
  }
}

export class OpenAIAgent {
  readonly name: string
  readonly instructions: string
  readonly model: string
  private tools: Map<string, { definition: ToolDefinition; handler: (args: unknown) => Promise<string> }>
  private steps: RunStep[] = []

  constructor(
    options: { name: string; instructions: string; model?: string },
    private client?: OpenAIClient
  ) {
    this.name = options.name
    this.instructions = options.instructions
    this.model = options.model ?? 'gpt-4o'
    this.tools = new Map()
  }

  addFunctionTool(
    name: string,
    description: string,
    parameters: Record<string, unknown>,
    handler: (args: unknown) => Promise<string>
  ): void {
    this.tools.set(name, {
      definition: { type: 'function', function: { name, description, parameters } },
      handler,
    })
  }

  async run(userMessage: string): Promise<string> {
    if (!this.client) throw new Error('OpenAI client required')
    this.steps = []

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: this.instructions },
      { role: 'user', content: userMessage },
    ]
    const toolDefs = Array.from(this.tools.values()).map(t => t.definition)

    for (let i = 0; i < 10; i++) {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: toolDefs.length ? toolDefs : undefined,
      })
      const choice = response.choices[0]

      if (choice.finish_reason === 'stop') {
        this.steps.push({ id: `step_${i}`, type: 'message_creation', status: 'completed', content: choice.message.content ?? '' })
        return choice.message.content ?? ''
      }

      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
        this.steps.push({ id: `step_${i}`, type: 'tool_calls', status: 'completed', toolCalls: choice.message.tool_calls })
        messages.push({ role: 'assistant', content: JSON.stringify(choice.message.tool_calls) })

        for (const tc of choice.message.tool_calls) {
          const tool = this.tools.get(tc.function.name)
          const result = tool
            ? await tool.handler(JSON.parse(tc.function.arguments))
            : `Tool '${tc.function.name}' not found`
          messages.push({ role: 'tool', content: result })
        }
        continue
      }
      break
    }
    return 'Run completed'
  }

  get runSteps(): RunStep[] {
    return [...this.steps]
  }

  get toolCount(): number {
    return this.tools.size
  }
}

export class Handoff {
  constructor(
    public readonly from: OpenAIAgent,
    public readonly to: OpenAIAgent,
    public readonly condition?: (input: string) => boolean
  ) {}

  shouldHandoff(input: string): boolean {
    return this.condition ? this.condition(input) : true
  }
}
