/**
 * Bee Agent Framework starter - IBM's open-source TypeScript agent framework
 * ReAct-pattern agents with structured tool use
 */

export type ThoughtAction = {
  type: 'thought'
  content: string
}

export type ToolAction = {
  type: 'tool'
  toolName: string
  toolInput: Record<string, unknown>
}

export type FinalAnswer = {
  type: 'answer'
  content: string
}

export type AgentAction = ThoughtAction | ToolAction | FinalAnswer

export interface BeeToolSchema {
  name: string
  description: string
  inputSchema: Record<string, { type: string; description: string }>
}

export abstract class BeeTool {
  abstract get schema(): BeeToolSchema
  abstract run(input: Record<string, unknown>): Promise<string>
}

export class CalculatorTool extends BeeTool {
  get schema(): BeeToolSchema {
    return {
      name: 'Calculator',
      description: 'Evaluates mathematical expressions',
      inputSchema: { expression: { type: 'string', description: 'Math expression to evaluate' } }
    }
  }

  async run(input: Record<string, unknown>): Promise<string> {
    const expr = String(input.expression ?? '')
    try {
      const result = Function(`"use strict"; return (${expr})`)()
      return String(result)
    } catch {
      return 'Error: invalid expression'
    }
  }
}

export class BeeAgent {
  private tools: Map<string, BeeTool>
  private memory: AgentAction[] = []

  constructor(
    private llm?: { complete: (prompt: string) => Promise<string> },
    tools: BeeTool[] = []
  ) {
    this.tools = new Map(tools.map(t => [t.schema.name, t]))
  }

  addTool(tool: BeeTool): void {
    this.tools.set(tool.schema.name, tool)
  }

  get toolNames(): string[] {
    return Array.from(this.tools.keys())
  }

  get memoryActions(): AgentAction[] {
    return [...this.memory]
  }

  private parseAction(response: string): AgentAction {
    if (response.startsWith('THOUGHT:')) {
      return { type: 'thought', content: response.slice(8).trim() }
    }
    if (response.startsWith('TOOL:')) {
      const [toolPart, inputPart] = response.slice(5).split('|INPUT:')
      return {
        type: 'tool',
        toolName: toolPart?.trim() ?? '',
        toolInput: inputPart ? JSON.parse(inputPart.trim()) : {}
      }
    }
    if (response.startsWith('ANSWER:')) {
      return { type: 'answer', content: response.slice(7).trim() }
    }
    return { type: 'answer', content: response }
  }

  async run(task: string): Promise<string> {
    if (!this.llm) throw new Error('LLM required')
    this.memory = []

    const toolDescriptions = Array.from(this.tools.values())
      .map(t => `${t.schema.name}: ${t.schema.description}`)
      .join('\n')

    let context = `Task: ${task}\nTools:\n${toolDescriptions}`

    for (let i = 0; i < 10; i++) {
      const response = await this.llm.complete(context)
      const action = this.parseAction(response)
      this.memory.push(action)

      if (action.type === 'answer') return action.content

      if (action.type === 'tool') {
        const tool = this.tools.get(action.toolName)
        const result = tool
          ? await tool.run(action.toolInput)
          : `Tool '${action.toolName}' not found`
        context += `\nTool result: ${result}`
        continue
      }

      if (action.type === 'thought') {
        context += `\nThought: ${action.content}`
      }
    }
    return 'Max iterations reached'
  }
}
