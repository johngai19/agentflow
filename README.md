# Agent Frameworks Starter Collection

> Top 20 AI agent frameworks — production-quality TDD starters in Python & TypeScript, plus Kubernetes orchestration.

[![Tests](https://img.shields.io/badge/tests-243%20passed-brightgreen)](#test-results)
[![Frameworks](https://img.shields.io/badge/frameworks-20-blue)](#frameworks)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

---

## What Is This?

A monorepo of **self-contained starter packages** for the most popular AI agent frameworks. Each starter:

- Demonstrates the framework's **core patterns** (tool use, memory, multi-agent, RAG, etc.)
- Uses **TDD** — tests are written first, implementation follows
- Runs **offline** — all LLM calls are mocked, no API keys required to run tests
- Is **production-ready** — patterns match how real apps are built

Use this as a reference when evaluating frameworks, learning agent development, or bootstrapping a new project.

---

## Repository Structure

```
agent-frameworks-starter/
│
├── web/                              # Next.js 15 showcase portal
│   └── src/
│       ├── app/                      # App Router pages
│       ├── components/frameworks/    # FrameworkCard UI component
│       └── data/frameworks.ts        # Framework metadata
│
├── packages/
│   ├── python/                       # Python agent starters (pip + pytest)
│   │   ├── 01-pydantic-ai/
│   │   ├── 02-langchain/
│   │   ├── 03-langgraph/
│   │   ├── 04-llamaindex/
│   │   ├── 05-google-adk/
│   │   ├── 06-crewai/
│   │   ├── 07-autogen/
│   │   ├── 08-smolagents/
│   │   ├── 09-agno/
│   │   ├── 10-semantic-kernel/
│   │   └── 20-griptape/
│   │
│   ├── typescript/                   # TypeScript starters (npm + vitest)
│   │   ├── 11-mastra/
│   │   ├── 12-claude-agent-sdk/
│   │   ├── 13-openai-agents/
│   │   ├── 14-vercel-ai-sdk/
│   │   ├── 15-langchain-js/
│   │   ├── 16-langgraph-js/
│   │   ├── 17-genkit/
│   │   └── 18-bee-agent-framework/
│   │
│   └── orchestration/                # Infrastructure / orchestration
│       └── 19-kagent/
│
├── docs/                             # Project documentation
│   ├── architecture.md
│   ├── tdd-guide.md
│   ├── python-guide.md
│   ├── typescript-guide.md
│   └── framework-comparison.md
│
├── CONTRIBUTING.md
├── package.json                      # pnpm workspace root
└── pnpm-workspace.yaml
```

---

## Quick Start

### Run any Python starter

```bash
cd packages/python/01-pydantic-ai
pip install -r requirements.txt
python -m pytest tests/ -v
```

### Run any TypeScript starter

```bash
cd packages/typescript/11-mastra
npm install
npm test
```

### Start the web showcase

```bash
pnpm install         # install all TS workspace deps
pnpm dev             # http://localhost:3000
```

### Run all TypeScript tests

```bash
pnpm test:ts
```

---

## Frameworks

### 🐍 Python Frameworks

| # | Framework | Highlights | Docs |
|---|-----------|-----------|------|
| 01 | **PydanticAI** | Type-safe agents, Pydantic v2 validation, DI for testing | [ai.pydantic.dev](https://ai.pydantic.dev) |
| 02 | **LangChain** | Largest ecosystem, chains + RAG + 100s of integrations | [python.langchain.com](https://python.langchain.com) |
| 03 | **LangGraph** | Stateful graph workflows, cycles, multi-actor systems | [langchain-ai.github.io/langgraph](https://langchain-ai.github.io/langgraph) |
| 04 | **LlamaIndex** | Data-first RAG framework, query engines, data connectors | [docs.llamaindex.ai](https://docs.llamaindex.ai) |
| 05 | **Google ADK** | Google's official agent kit, Gemini-native, sessions | [google.github.io/adk-docs](https://google.github.io/adk-docs) |
| 06 | **CrewAI** | Role-based multi-agent crews, task delegation | [docs.crewai.com](https://docs.crewai.com) |
| 07 | **AutoGen** | Microsoft conversational multi-agents, code execution | [microsoft.github.io/autogen](https://microsoft.github.io/autogen) |
| 08 | **Smolagents** | HuggingFace minimal agents, code-first tool use | [huggingface.co/docs/smolagents](https://huggingface.co/docs/smolagents) |
| 09 | **Agno** | Fast async agents (ex-Phidata), structured outputs, teams | [docs.agno.com](https://docs.agno.com) |
| 10 | **Semantic Kernel** | Microsoft enterprise SDK, plugins, planners, C#/Python | [learn.microsoft.com/semantic-kernel](https://learn.microsoft.com/semantic-kernel) |
| 20 | **Griptape** | Enterprise pipelines, fine-grained control, production-ready | [docs.griptape.ai](https://docs.griptape.ai) |

### 🟦 TypeScript Frameworks

| # | Framework | Highlights | Docs |
|---|-----------|-----------|------|
| 11 | **Mastra** | Modern TS-first, typed tools, workflows, integrations | [mastra.ai/docs](https://mastra.ai/docs) |
| 12 | **Claude Agent SDK** | Anthropic official, full tool use, multi-turn agent loop | [docs.anthropic.com](https://docs.anthropic.com) |
| 13 | **OpenAI Agents SDK** | OpenAI official, function calling, handoffs between agents | [platform.openai.com/docs](https://platform.openai.com/docs) |
| 14 | **Vercel AI SDK** | Streaming-first, React hooks, provider-agnostic, Next.js | [sdk.vercel.ai/docs](https://sdk.vercel.ai/docs) |
| 15 | **LangChain.js** | JS/TS port of LangChain, same ecosystem in Node/browser | [js.langchain.com](https://js.langchain.com) |
| 16 | **LangGraph.js** | TypeScript graph agents, stateful, multi-actor | [langchain-ai.github.io/langgraphjs](https://langchain-ai.github.io/langgraphjs) |
| 17 | **Genkit** | Google Firebase AI, flows + prompts, Gemini integration | [firebase.google.com/docs/genkit](https://firebase.google.com/docs/genkit) |
| 18 | **Bee Agent Framework** | IBM open-source, ReAct pattern, structured tool schemas | [i-am-bee.github.io/bee-agent-framework](https://i-am-bee.github.io/bee-agent-framework) |

### ⚙️ Orchestration & Infrastructure

| # | Framework | Highlights | Docs |
|---|-----------|-----------|------|
| 19 | **kagent** | Kubernetes-native, CRD-based agent definitions, GitOps | [kagent.dev](https://kagent.dev) |

---

## Test Results

All 243 tests pass with zero real API calls (fully mocked):

| Group | Frameworks | Tests | Status |
|-------|------------|-------|--------|
| Python 01–05 | pydantic-ai, langchain, langgraph, llamaindex, google-adk | 66 | ✅ all passed |
| Python 06–10 | crewai, autogen, smolagents, agno, semantic-kernel | 71 | ✅ all passed |
| Python 20 | griptape | 15 | ✅ all passed |
| TypeScript 11–15 | mastra, claude-sdk, openai-agents, vercel-ai, langchain-js | 42 | ✅ all passed |
| TypeScript 16–18 | langgraph-js, genkit, bee-agent | 29 | ✅ all passed |
| Orchestration 19 | kagent | 11 | ✅ all passed |
| **Total** | **20 frameworks** | **243** | ✅ **243/243** |

---

## TDD Philosophy

Every starter follows the same TDD workflow:

```
1. Define the interface  →  What should the agent DO?
2. Write failing tests   →  What does "correct" look like?
3. Implement             →  Make the tests pass
4. Refactor              →  Clean up without breaking tests
```

**Key constraint:** Tests must pass with mocked LLMs. This enforces:
- Clean dependency injection (LLM client passed into constructor)
- Separation of agent logic from model provider
- Ability to test edge cases (errors, empty responses, tool failures)

See [`docs/tdd-guide.md`](docs/tdd-guide.md) for detailed patterns.

---

## Framework Selection Guide

| If you need… | Use |
|---|---|
| Strictest type safety + Python | **PydanticAI** (#01) |
| Largest ecosystem / most integrations | **LangChain** (#02) |
| Complex stateful workflows with cycles | **LangGraph** (#03 / #16) |
| RAG over your own documents | **LlamaIndex** (#04) |
| Google Gemini + production agents | **Google ADK** (#05) |
| Multi-agent teams with roles | **CrewAI** (#06) |
| Conversational multi-agent systems | **AutoGen** (#07) |
| Minimal code, quick prototype | **Smolagents** (#08) |
| Fast async production agents | **Agno** (#09) |
| Microsoft/Azure enterprise stack | **Semantic Kernel** (#10) |
| TypeScript-first modern stack | **Mastra** (#11) |
| Anthropic Claude as primary model | **Claude Agent SDK** (#12) |
| OpenAI GPT as primary model | **OpenAI Agents** (#13) |
| Streaming UI + Next.js | **Vercel AI SDK** (#14) |
| Enterprise Python pipelines | **Griptape** (#20) |
| Kubernetes-native agent ops | **kagent** (#19) |

---

## Development

### Prerequisites

- **Node.js** ≥ 20, **pnpm** ≥ 9
- **Python** ≥ 3.11, **pip**

### Install all TypeScript dependencies

```bash
pnpm install
```

### Test commands

```bash
# All TypeScript packages
pnpm test:ts

# Web portal
pnpm test:web

# Specific Python framework
cd packages/python/03-langgraph
python -m pytest tests/ -v --cov=src --cov-report=term-missing

# All Python frameworks (bash loop)
for dir in packages/python/*/; do
  echo "▶ $dir"
  (cd "$dir" && python -m pytest tests/ -q)
done
```

### Web portal development

```bash
pnpm dev              # http://localhost:3000  (Next.js dev with Turbopack)
pnpm build            # Production build
```

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for how to add a new framework starter.

---

## License

MIT
