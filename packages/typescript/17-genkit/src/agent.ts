/**
 * Genkit starter - Google's Firebase AI framework for TypeScript
 */

export interface FlowInput<T = unknown> {
  input: T
  context?: Record<string, unknown>
}

export interface FlowOutput<T = unknown> {
  output: T
  metadata: { duration: number; steps: number }
}

export type FlowFunction<I, O> = (input: I) => Promise<O>

export interface PromptConfig {
  model: string
  system?: string
  maxTokens?: number
}

export class GenkitFlow<I = unknown, O = unknown> {
  readonly name: string
  private fn: FlowFunction<I, O>
  private steps = 0

  constructor(name: string, fn: FlowFunction<I, O>) {
    this.name = name
    this.fn = fn
  }

  async run(input: I): Promise<FlowOutput<O>> {
    const start = Date.now()
    this.steps++
    const output = await this.fn(input)
    return { output, metadata: { duration: Date.now() - start, steps: this.steps } }
  }
}

export class GenkitPrompt {
  constructor(
    private config: PromptConfig,
    private template: string,
    private llm?: { generate: (config: PromptConfig, prompt: string) => Promise<string> }
  ) {}

  async render(variables: Record<string, string>): Promise<string> {
    let rendered = this.template
    for (const [k, v] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v)
    }
    return rendered
  }

  async generate(variables: Record<string, string>): Promise<string> {
    if (!this.llm) throw new Error('LLM required for generation')
    const prompt = await this.render(variables)
    return this.llm.generate(this.config, prompt)
  }
}

export class GenkitRegistry {
  private flows = new Map<string, GenkitFlow>()
  private prompts = new Map<string, GenkitPrompt>()

  defineFlow<I, O>(name: string, fn: FlowFunction<I, O>): GenkitFlow<I, O> {
    const flow = new GenkitFlow(name, fn)
    this.flows.set(name, flow as GenkitFlow)
    return flow
  }

  definePrompt(name: string, config: PromptConfig, template: string, llm?: { generate: (c: PromptConfig, p: string) => Promise<string> }): GenkitPrompt {
    const prompt = new GenkitPrompt(config, template, llm)
    this.prompts.set(name, prompt)
    return prompt
  }

  getFlow(name: string): GenkitFlow | undefined {
    return this.flows.get(name)
  }

  getPrompt(name: string): GenkitPrompt | undefined {
    return this.prompts.get(name)
  }

  get flowCount(): number {
    return this.flows.size
  }
}
