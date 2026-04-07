# Genkit Starter

Google's Firebase AI framework for TypeScript agents and workflows.

Genkit provides a unified interface for building AI-powered features with flows, prompts, and model integrations. It supports multiple model providers and offers built-in observability.

## Key Concepts

- **GenkitFlow**: Typed async functions with metadata tracking (duration, step count)
- **GenkitPrompt**: Template-based prompts with variable substitution and LLM generation
- **GenkitRegistry**: Central registry for managing flows and prompts

## Usage

```typescript
import { GenkitRegistry } from './src/agent.js'

const genkit = new GenkitRegistry()

const flow = genkit.defineFlow('summarize', async (text: string) => {
  return text.slice(0, 100) + '...'
})

const result = await flow.run('Long document text...')
// result.output: summarized text
// result.metadata: { duration, steps }
```

## Tests

```bash
npm install
npm test
```
