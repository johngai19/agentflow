# Architecture

## Monorepo Layout

This project uses **pnpm workspaces** for JavaScript/TypeScript packages and keeps Python packages as standalone directories (Python has no native monorepo tooling equivalent to pnpm).

```
agent-frameworks-starter/         ← monorepo root
│
├── pnpm-workspace.yaml            ← declares TS workspaces
├── package.json                   ← root scripts (test:ts, dev, etc.)
│
├── web/                           ← Next.js 15 showcase (pnpm workspace member)
├── packages/typescript/*/         ← TS starters (pnpm workspace members)
├── packages/python/*/             ← Python starters (standalone, not in pnpm workspace)
└── packages/orchestration/*/      ← Infrastructure starters (mixed)
```

### Workspace configuration

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'web'
  - 'packages/typescript/*'
```

Python packages are deliberately excluded from the pnpm workspace — they have no shared JS dependencies and manage their own `requirements.txt` + `pyproject.toml`.

---

## Package Anatomy

### Python starter

```
packages/python/NN-framework-name/
├── src/
│   ├── __init__.py          ← makes src/ a Python package
│   └── agent.py             ← core agent implementation
├── tests/
│   ├── __init__.py
│   └── test_agent.py        ← pytest test suite
├── pyproject.toml           ← build system + pytest config
├── requirements.txt         ← pip-installable dependencies
└── README.md
```

`pyproject.toml` key settings:
```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]          # ← lets tests import from src/ without install
```

### TypeScript starter

```
packages/typescript/NN-framework-name/
├── src/
│   ├── agent.ts             ← core agent implementation
│   └── index.ts             ← re-exports public API
├── tests/
│   └── agent.test.ts        ← vitest test suite
├── vitest.config.ts         ← test runner configuration
├── tsconfig.json            ← TypeScript compilation config
├── package.json             ← ESM package, vitest + tsx devDeps
└── README.md
```

`package.json` key settings:
```json
{
  "type": "module",              // ESM throughout
  "scripts": { "test": "vitest run" }
}
```

`tsconfig.json` key settings:
```json
{
  "module": "NodeNext",
  "moduleResolution": "NodeNext"  // required for ESM + .js imports
}
```

### Orchestration starter (kagent)

```
packages/orchestration/19-kagent/
├── src/
│   └── agent.ts             ← TypeScript models for kagent CRD schemas
├── tests/
│   └── agent.test.ts        ← validation tests (no LLM needed)
├── manifests/               ← example YAML manifests
│   └── example-agent.yaml
└── README.md
```

---

## Design Principles

### 1. Dependency Injection for LLM Clients

Every agent accepts its LLM client as a constructor parameter:

```python
# Python pattern
class ResearchAgent:
    def __init__(self, model_client=None):
        self._client = model_client  # None → use mocks in tests

agent = ResearchAgent(model_client=mock_client)   # test
agent = ResearchAgent(model_client=AnthropicClient())  # production
```

```typescript
// TypeScript pattern
class MastraAgent {
  constructor(config: AgentConfig, provider?: ModelProvider) {
    this.modelProvider = provider  // undefined → use mocks in tests
  }
}
```

This makes LLM calls **observable and controllable** in tests without `patch()` magic.

### 2. Fail Fast Without Client

Agents throw descriptive errors when run without a configured client, rather than silently failing or returning empty results:

```python
def run(self, query: str) -> AgentResponse:
    if not self._client:
        raise ValueError("Model client required for production use")
```

Tests explicitly cover this case to document the expected behavior.

### 3. Thin Abstractions

Each starter provides just enough abstraction to demonstrate the framework's patterns — no over-engineering. The goal is clarity, not completeness. A real application would extend these patterns with error handling, retry logic, observability, etc.

### 4. No External Network Calls in Tests

Tests never make HTTP requests. All external calls are intercepted via:
- Python: `unittest.mock.MagicMock` / `patch`
- TypeScript: `vi.fn().mockResolvedValue()` / `vi.mock()`

---

## Web Portal (Next.js)

The `web/` package is a **static showcase** of all 20 frameworks. It uses:

- **Next.js 15 App Router** with static rendering (no server-side data fetching)
- **Tailwind CSS v4** + **shadcn/ui** components
- **Framework data** from `src/data/frameworks.ts` — a plain TypeScript array, no database

Build output is fully static HTML/CSS/JS — deployable to any CDN.

```
web/src/
├── app/
│   ├── layout.tsx            ← Root layout (TopNavbar)
│   └── page.tsx              ← Home page (all 20 framework cards)
├── components/
│   ├── frameworks/
│   │   └── FrameworkCard.tsx ← Reusable card with language badge + tags
│   ├── layout/
│   │   └── TopNavbar.tsx     ← Sticky header with section anchors
│   └── ui/                   ← shadcn/ui primitives
└── data/
    └── frameworks.ts         ← Single source of truth for framework metadata
```
