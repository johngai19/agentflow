/**
 * LangChain.js starter - Chain-based AI composition in TypeScript
 */

export interface Runnable<Input = string, Output = string> {
  invoke(input: Input): Promise<Output>
}

export class PromptTemplate implements Runnable<Record<string, string>, string> {
  constructor(private template: string, public readonly inputVariables: string[]) {}

  async invoke(variables: Record<string, string>): Promise<string> {
    let result = this.template
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
    }
    return result
  }

  static fromTemplate(template: string): PromptTemplate {
    const vars = Array.from(template.matchAll(/\{(\w+)\}/g)).map(m => m[1])
    return new PromptTemplate(template, vars)
  }
}

export class LLMChain implements Runnable<Record<string, string>, string> {
  constructor(
    private prompt: PromptTemplate,
    private llm: { invoke: (prompt: string) => Promise<string> }
  ) {}

  async invoke(input: Record<string, string>): Promise<string> {
    const prompt = await this.prompt.invoke(input)
    return this.llm.invoke(prompt)
  }
}

export class SequentialChain<T = string> implements Runnable<T, unknown> {
  private chains: Runnable[] = []

  pipe<O>(chain: Runnable<unknown, O>): SequentialChain<T> {
    this.chains.push(chain as Runnable)
    return this
  }

  async invoke(input: T): Promise<unknown> {
    let result: unknown = input
    for (const chain of this.chains) {
      result = await chain.invoke(result as string)
    }
    return result
  }

  get length(): number {
    return this.chains.length
  }
}

export type StructuredTool = {
  name: string
  description: string
  schema: Record<string, { type: string; description: string }>
  call: (input: Record<string, unknown>) => Promise<string>
}

export class AgentExecutor {
  private tools: Map<string, StructuredTool>

  constructor(
    private llm?: { invoke: (prompt: string) => Promise<string> },
    tools: StructuredTool[] = []
  ) {
    this.tools = new Map(tools.map(t => [t.name, t]))
  }

  addTool(tool: StructuredTool): void {
    this.tools.set(tool.name, tool)
  }

  async invoke(input: string): Promise<string> {
    if (!this.llm) throw new Error('LLM required for AgentExecutor')
    const toolDescriptions = Array.from(this.tools.values())
      .map(t => `${t.name}: ${t.description}`)
      .join('\n')
    const prompt = `Tools:\n${toolDescriptions}\n\nQuestion: ${input}\nAnswer:`
    return this.llm.invoke(prompt)
  }

  get toolNames(): string[] {
    return Array.from(this.tools.keys())
  }
}
