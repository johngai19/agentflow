# Agent Frameworks Starter Collection

A monorepo containing TDD (Test-Driven Development) starter examples for the top 20 AI agent frameworks.

## Structure

```
agent-frameworks-starter/
├── web/                          # Next.js frontend app (shadcn/ui)
├── packages/
│   ├── typescript/               # TypeScript agent framework starters
│   ├── python/                   # Python agent framework starters
│   └── orchestration/            # Multi-agent orchestration examples
└── pnpm-workspace.yaml
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Run the web app
pnpm dev

# Run all TypeScript tests
pnpm test:ts

# Run the web app tests
pnpm test:web

# Run Python tests (from individual package dirs)
pnpm test:python
```

## Agent Frameworks

| # | Framework | Language | Package Path | Status |
|---|-----------|----------|--------------|--------|
| 1 | [LangChain](https://github.com/langchain-ai/langchainjs) | TypeScript | `packages/typescript/langchain` | Planned |
| 2 | [LangGraph](https://github.com/langchain-ai/langgraphjs) | TypeScript | `packages/typescript/langgraph` | Planned |
| 3 | [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | Python | `packages/python/openai-agents` | Planned |
| 4 | [Anthropic Claude Agent SDK](https://github.com/anthropics/anthropic-sdk-python) | TypeScript/Python | `packages/typescript/claude-agent` | Planned |
| 5 | [AutoGen](https://github.com/microsoft/autogen) | Python | `packages/python/autogen` | Planned |
| 6 | [CrewAI](https://github.com/crewAIInc/crewAI) | Python | `packages/python/crewai` | Planned |
| 7 | [Semantic Kernel](https://github.com/microsoft/semantic-kernel) | TypeScript | `packages/typescript/semantic-kernel` | Planned |
| 8 | [Mastra](https://github.com/mastra-ai/mastra) | TypeScript | `packages/typescript/mastra` | Planned |
| 9 | [Vercel AI SDK](https://github.com/vercel/ai) | TypeScript | `packages/typescript/vercel-ai` | Planned |
| 10 | [Haystack](https://github.com/deepset-ai/haystack) | Python | `packages/python/haystack` | Planned |
| 11 | [DSPy](https://github.com/stanfordnlp/dspy) | Python | `packages/python/dspy` | Planned |
| 12 | [LlamaIndex](https://github.com/run-llama/llama_index) | Python | `packages/python/llamaindex` | Planned |
| 13 | [Phidata (Agno)](https://github.com/agno-agi/agno) | Python | `packages/python/agno` | Planned |
| 14 | [PydanticAI](https://github.com/pydantic/pydantic-ai) | Python | `packages/python/pydantic-ai` | Planned |
| 15 | [Smolagents](https://github.com/huggingface/smolagents) | Python | `packages/python/smolagents` | Planned |
| 16 | [BeeAI](https://github.com/i-am-bee/bee-agent-framework) | TypeScript | `packages/typescript/beeai` | Planned |
| 17 | [Agentkit (Coinbase)](https://github.com/coinbase/agentkit) | TypeScript | `packages/typescript/agentkit` | Planned |
| 18 | [Camel-AI](https://github.com/camel-ai/camel) | Python | `packages/python/camel-ai` | Planned |
| 19 | [Letta (MemGPT)](https://github.com/letta-ai/letta) | Python | `packages/python/letta` | Planned |
| 20 | [AG2 (AutoGen fork)](https://github.com/ag2ai/ag2) | Python | `packages/python/ag2` | Planned |

## Web App

The `web/` package is a Next.js 15 app with:
- **shadcn/ui** component library
- **Tailwind CSS v4**
- **Zustand** for state management
- **React Hook Form + Zod** for forms and validation
- **Vitest** for testing
- **TypeScript**

## Contributing

Each framework starter lives in its own package directory and follows TDD principles:
1. Tests are written first
2. Implementation follows
3. Each package is self-contained with its own dependencies
