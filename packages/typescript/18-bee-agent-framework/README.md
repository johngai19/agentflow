# Bee Agent Framework Starter

IBM's open-source TypeScript agent framework with ReAct-pattern agents and structured tool use.

Bee Agent Framework enables building production-grade agents with a clean ReAct loop, typed tools, and structured memory. It follows the Thought-Action-Observation pattern for transparent reasoning.

## Key Concepts

- **BeeTool**: Abstract base for typed tools with schema definitions
- **CalculatorTool**: Built-in tool for evaluating mathematical expressions
- **BeeAgent**: ReAct-pattern agent with tool use, memory tracking, and configurable LLM
- **AgentAction**: Discriminated union of thought, tool call, and final answer actions

## Usage

```typescript
import { BeeAgent, CalculatorTool } from './src/agent.js'

const agent = new BeeAgent(myLLM, [new CalculatorTool()])
const result = await agent.run('What is 6 * 7?')
// result: '42'
```

## Tests

```bash
npm install
npm test
```
