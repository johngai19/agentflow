/**
 * LangGraph.js starter - Graph-based stateful agent workflows in TypeScript
 */

export type NodeFunction<S extends Record<string, unknown>> = (state: S) => Promise<Partial<S>>
export type EdgeCondition<S extends Record<string, unknown>> = (state: S) => string

export interface GraphNode<S extends Record<string, unknown>> {
  name: string
  fn: NodeFunction<S>
}

export interface ConditionalEdge<S extends Record<string, unknown>> {
  from: string
  condition: EdgeCondition<S>
  routes: Record<string, string>
}

export class StateGraph<S extends Record<string, unknown>> {
  private nodes = new Map<string, NodeFunction<S>>()
  private edges = new Map<string, string>()
  private conditionalEdges: ConditionalEdge<S>[] = []
  private entryPoint?: string

  addNode(name: string, fn: NodeFunction<S>): this {
    this.nodes.set(name, fn)
    return this
  }

  addEdge(from: string, to: string): this {
    this.edges.set(from, to)
    return this
  }

  addConditionalEdges(from: string, condition: EdgeCondition<S>, routes: Record<string, string>): this {
    this.conditionalEdges.push({ from, condition, routes })
    return this
  }

  setEntryPoint(name: string): this {
    this.entryPoint = name
    return this
  }

  compile(): CompiledStateGraph<S> {
    if (!this.entryPoint) throw new Error('Entry point not set')
    return new CompiledStateGraph(this.nodes, this.edges, this.conditionalEdges, this.entryPoint)
  }
}

export class CompiledStateGraph<S extends Record<string, unknown>> {
  constructor(
    private nodes: Map<string, NodeFunction<S>>,
    private edges: Map<string, string>,
    private conditionalEdges: ConditionalEdge<S>[],
    private entryPoint: string
  ) {}

  async invoke(initialState: S): Promise<S> {
    let state = { ...initialState }
    let current: string | undefined = this.entryPoint
    const visited = new Set<string>()

    while (current && current !== '__end__' && visited.size < 50) {
      const fn = this.nodes.get(current)
      if (!fn) break
      const updates = await fn(state)
      state = { ...state, ...updates }
      visited.add(current)

      const condEdge = this.conditionalEdges.find(e => e.from === current)
      if (condEdge) {
        const key = condEdge.condition(state)
        current = condEdge.routes[key] ?? '__end__'
      } else {
        current = this.edges.get(current)
      }
    }
    return state
  }

  get nodeCount(): number {
    return this.nodes.size
  }
}

export interface AgentState {
  messages: Array<{ role: string; content: string }>
  context: Record<string, unknown>
  answer?: string
}

export function createReActGraph(llm?: { complete: (prompt: string) => Promise<string> }) {
  const graph = new StateGraph<AgentState>()

  graph.addNode('think', async (state) => {
    if (!llm) return state
    const lastMsg = state.messages[state.messages.length - 1]?.content ?? ''
    const thought = await llm.complete(`Think step by step: ${lastMsg}`)
    return { context: { ...state.context, thought } }
  })

  graph.addNode('answer', async (state) => {
    if (!llm) return { answer: 'No LLM provided' }
    const thought = state.context.thought as string ?? ''
    const ans = await llm.complete(`Based on thinking: ${thought}\nProvide answer:`)
    return { answer: ans }
  })

  graph.addEdge('think', 'answer')
  graph.setEntryPoint('think')
  return graph.compile()
}
