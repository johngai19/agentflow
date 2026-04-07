# LangGraph.js Starter

Graph-based stateful agent workflows in TypeScript.

LangGraph.js enables building complex, stateful multi-actor applications by modeling agent logic as directed graphs. Each node processes state and edges determine flow, including conditional routing.

## Key Concepts

- **StateGraph**: Define nodes (processing steps) and edges (transitions) for agent workflows
- **CompiledStateGraph**: Executable graph that runs nodes in sequence with state passing
- **Conditional Edges**: Route between nodes based on state values (e.g., ReAct loops)
- **AgentState**: Typed state object flowing through the graph

## Usage

```typescript
import { StateGraph, createReActGraph } from './src/agent.js'

const graph = new StateGraph<{ val: number }>()
  .addNode('process', async (state) => ({ val: state.val * 2 }))
  .setEntryPoint('process')
  .compile()

const result = await graph.invoke({ val: 21 })
// result.val === 42
```

## Tests

```bash
npm install
npm test
```
