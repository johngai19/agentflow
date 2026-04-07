# TypeScript Framework Development Guide

## Prerequisites

- Node.js ≥ 20
- npm (or pnpm for workspace-level commands)

## Running a TypeScript Starter

```bash
# Navigate to any TypeScript starter
cd packages/typescript/11-mastra

# Install dependencies
npm install

# Run tests
npm test

# Watch mode (re-runs on save)
npm run test:watch
```

## Project Structure

Every TypeScript starter follows this layout:

```
NN-framework-name/
├── src/
│   ├── agent.ts            ← core agent implementation
│   └── index.ts            ← re-exports public API
├── tests/
│   └── agent.test.ts       ← vitest test suite
├── vitest.config.ts        ← test runner config
├── tsconfig.json           ← TypeScript config
├── package.json            ← ESM package + scripts
└── README.md
```

## Key Configuration Choices

### ESM (type: "module")

All starters use native ES modules:

```json
// package.json
{ "type": "module" }
```

This means:
- Import paths must include `.js` extension: `import { Agent } from './agent.js'`
- Works with Node.js 18+ natively
- Vitest handles ESM seamlessly

### NodeNext module resolution

```json
// tsconfig.json
{
  "module": "NodeNext",
  "moduleResolution": "NodeNext"
}
```

Required for correct ESM import resolution with TypeScript.

### Vitest over Jest

Vitest is used instead of Jest because:
- Native ESM support (no transform config needed)
- Faster cold start
- Compatible Jest API (`describe`, `it`, `expect`, `vi`)
- First-class TypeScript support

## Running All TypeScript Starters

From the repo root (uses pnpm workspace):

```bash
# Run tests in all TypeScript packages
pnpm test:ts
```

Or manually:

```bash
for dir in packages/typescript/*/; do
  echo "▶ Testing $(basename $dir)"
  (cd "$dir" && npm test 2>&1 | tail -5)
done
```

## Mock Patterns

### Mock a provider with `vi.fn()`

```typescript
import { vi } from 'vitest'

const mockProvider = {
  generate: vi.fn().mockResolvedValue('Mocked AI response')
}
const agent = new MyAgent(mockProvider)
```

### Simulate sequential responses

```typescript
const mockClient = {
  messages: {
    create: vi.fn()
      .mockResolvedValueOnce({ /* first response */ })
      .mockResolvedValueOnce({ /* second response */ })
  }
}
```

### Verify what was called

```typescript
expect(mockProvider.generate).toHaveBeenCalledOnce()
expect(mockProvider.generate).toHaveBeenCalledWith(
  expect.arrayContaining([
    expect.objectContaining({ role: 'user' })
  ]),
  'You are a helpful assistant.',
  []
)
```

### Spy on existing methods

```typescript
const agent = new MyAgent(provider)
const spy = vi.spyOn(agent, 'runToolUse')
await agent.run('test')
expect(spy).toHaveBeenCalled()
```

## Adding Real SDK Dependencies

The starters currently have no production SDK dependencies (only `vitest` and `typescript`). To use the real SDK:

| Framework | Install command |
|---|---|
| Mastra | `npm install @mastra/core` |
| Claude Agent SDK | `npm install @anthropic-ai/sdk` |
| OpenAI Agents | `npm install openai` |
| Vercel AI SDK | `npm install ai` |
| LangChain.js | `npm install langchain @langchain/anthropic` |
| LangGraph.js | `npm install @langchain/langgraph` |
| Genkit | `npm install @genkit-ai/core @genkit-ai/googleai` |
| Bee Agent Framework | `npm install bee-agent-framework` |

## Writing New TypeScript Starters

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the full checklist. Key points:

1. Export a clean public API from `src/index.ts`
2. Accept the AI client/provider as an optional constructor parameter
3. Throw descriptive errors (not silent failures) when no client is provided
4. Import paths must end in `.js` (TypeScript compiles to JS, NodeNext requires explicit extensions)
5. Use `vi.fn()` for mocks — never import or instantiate real SDK clients in tests
6. Test both the happy path and error cases for every public method
