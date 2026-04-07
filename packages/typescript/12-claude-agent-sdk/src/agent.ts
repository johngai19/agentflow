/**
 * Claude Agent SDK starter - Anthropic's agent SDK patterns
 * Models agent loops with tool use, multi-turn conversations
 */

export type ToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export type TextBlock = {
  type: 'text'
  text: string
}

export type ContentBlock = ToolUseBlock | TextBlock

export type ToolResult = {
  tool_use_id: string
  content: string
  is_error?: boolean
}

export type AgentTool = {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
  handler: (input: Record<string, unknown>) => Promise<string>
}

export type AnthropicClient = {
  messages: {
    create: (params: {
      model: string
      max_tokens: number
      system: string
      messages: Array<{ role: string; content: string | ContentBlock[] }>
      tools?: Array<Omit<AgentTool, 'handler'>>
    }) => Promise<{
      content: ContentBlock[]
      stop_reason: string
    }>
  }
}

export class ClaudeAgent {
  private tools: Map<string, AgentTool>
  readonly systemPrompt: string
  readonly model: string

  constructor(
    private client?: AnthropicClient,
    options: {
      systemPrompt?: string
      model?: string
      tools?: AgentTool[]
    } = {}
  ) {
    this.systemPrompt = options.systemPrompt ?? 'You are a helpful assistant.'
    this.model = options.model ?? 'claude-opus-4-6'
    this.tools = new Map((options.tools ?? []).map(t => [t.name, t]))
  }

  registerTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool)
  }

  getToolSchemas(): Array<Omit<AgentTool, 'handler'>> {
    return Array.from(this.tools.values()).map(({ handler, ...schema }) => schema)
  }

  async runToolUse(block: ToolUseBlock): Promise<ToolResult> {
    const tool = this.tools.get(block.name)
    if (!tool) {
      return { tool_use_id: block.id, content: `Tool '${block.name}' not found`, is_error: true }
    }
    try {
      const result = await tool.handler(block.input)
      return { tool_use_id: block.id, content: result }
    } catch (e) {
      return { tool_use_id: block.id, content: String(e), is_error: true }
    }
  }

  async run(userMessage: string): Promise<string> {
    if (!this.client) throw new Error('Anthropic client required')

    const messages: Array<{ role: string; content: string | ContentBlock[] }> = [
      { role: 'user', content: userMessage },
    ]
    const toolSchemas = this.getToolSchemas()

    for (let i = 0; i < 10; i++) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: this.systemPrompt,
        messages,
        tools: toolSchemas.length ? toolSchemas : undefined,
      })

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(b => b.type === 'text') as TextBlock | undefined
        return textBlock?.text ?? ''
      }

      if (response.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: response.content })
        const toolResults: ToolResult[] = []
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const result = await this.runToolUse(block as ToolUseBlock)
            toolResults.push(result)
          }
        }
        messages.push({
          role: 'user',
          content: toolResults.map(r => ({
            type: 'tool_result' as const,
            ...r,
          })) as unknown as ContentBlock[],
        })
        continue
      }
      break
    }
    return 'Agent loop completed'
  }

  get toolCount(): number {
    return this.tools.size
  }
}
