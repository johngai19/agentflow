# TDD Guide for Agent Framework Starters

## Why TDD for AI Agents?

AI agent code is notoriously hard to test because:

1. **LLM responses are non-deterministic** — the same prompt produces different outputs
2. **API calls cost money and time** — a slow test suite discourages running tests
3. **External services may be unavailable** — CI/CD breaks in flaky ways
4. **Agent logic is interleaved with I/O** — hard to isolate business logic

TDD with mocks solves all of these by separating **agent logic** from **model provider calls**.

---

## The Three-Layer Model

Every starter in this collection is structured in three layers:

```
┌─────────────────────────────────────┐
│  Agent Logic (testable)             │
│  - State management                 │
│  - Tool routing                     │
│  - Response parsing                 │
│  - Error handling                   │
├─────────────────────────────────────┤
│  LLM Interface (injectable)         │
│  - model.complete(prompt) → string  │
│  - client.generate(messages) → str  │
├─────────────────────────────────────┤
│  Provider SDK (mocked in tests)     │
│  - Anthropic, OpenAI, Gemini, etc.  │
└─────────────────────────────────────┘
```

Tests operate on the **Agent Logic** layer and inject **mock implementations** at the LLM Interface layer. The actual Provider SDK is never called in tests.

---

## Python TDD Patterns

### Basic mock injection

```python
from unittest.mock import MagicMock
from src.agent import ResearchAgent

def test_run_with_mock_client():
    mock_client = MagicMock()
    mock_client.search.return_value = [
        {"title": "AI Docs", "url": "https://example.com", "snippet": "AI agents..."}
    ]

    agent = ResearchAgent(model_client=mock_client)
    response = agent.run("What is PydanticAI?")

    assert response.confidence > 0
    mock_client.search.assert_called_once_with("What is PydanticAI?")
```

### Testing error conditions

```python
def test_run_requires_client():
    agent = ResearchAgent()  # no client
    with pytest.raises(ValueError, match="Model client required"):
        agent.run("test query")
```

### Testing sequential LLM calls (side_effect)

```python
def test_multi_step_pipeline():
    mock_llm = MagicMock()
    # Return different responses for each call in sequence
    mock_llm.complete.side_effect = [
        "Research done: AI is growing fast.",   # call 1
        "Summary: AI growth is accelerating.",  # call 2
    ]
    pipeline = Pipeline([
        PromptTask("Research: {input}", llm=mock_llm),
        PromptTask("Summarize: {input}", llm=mock_llm),
    ])
    result = pipeline.run("AI trends")
    assert "accelerating" in result.value
    assert mock_llm.complete.call_count == 2
```

### Verifying prompt content

```python
def test_system_prompt_used():
    mock_llm = MagicMock()
    mock_llm.complete.return_value = "Response"
    agent = AssistantAgent("Coder", llm=mock_llm, system_message="You are a coding expert.")

    agent.generate_reply([Message(MessageRole.USER, "Write code")])

    # Assert the system message was included in the actual prompt
    call_arg = mock_llm.complete.call_args[0][0]
    assert "coding expert" in call_arg
```

### Running tests

```bash
# Basic run
python -m pytest tests/ -v

# With coverage report
python -m pytest tests/ -v --cov=src --cov-report=term-missing

# Stop on first failure
python -m pytest tests/ -x

# Run specific test class
python -m pytest tests/test_agent.py::TestResearchAgent -v
```

---

## TypeScript TDD Patterns

### Basic mock injection

```typescript
import { describe, it, expect, vi } from 'vitest'
import { MastraAgent } from '../src/agent.js'
import type { ModelProvider } from '../src/agent.js'

function makeProvider(response: string): ModelProvider {
  return { generate: vi.fn().mockResolvedValue(response) }
}

describe('MastraAgent', () => {
  it('generates response with provider', async () => {
    const provider = makeProvider('Mastra is a TypeScript agent framework.')
    const agent = new MastraAgent({ name: 'Agent', instructions: 'Be helpful' }, provider)

    const result = await agent.generate('What is Mastra?')

    expect(result.text).toBe('Mastra is a TypeScript agent framework.')
    expect(result.messages).toHaveLength(2) // user + assistant
  })
})
```

### Simulating multi-turn tool use

```typescript
function makeClient(responses: Array<{ content: any[]; stop_reason: string }>) {
  let callCount = 0
  return {
    messages: {
      create: vi.fn().mockImplementation(async () => {
        return responses[callCount++] ?? responses[responses.length - 1]
      })
    }
  }
}

it('handles tool use then final answer', async () => {
  const weatherHandler = vi.fn().mockResolvedValue('Sunny, 22°C')
  const client = makeClient([
    // First call: model decides to use a tool
    { content: [{ type: 'tool_use', id: 'tu_1', name: 'get_weather', input: { location: 'London' } }], stop_reason: 'tool_use' },
    // Second call: model provides final answer
    { content: [{ type: 'text', text: "London's weather is Sunny, 22°C" }], stop_reason: 'end_turn' },
  ])

  const agent = new ClaudeAgent(client, {
    tools: [{ name: 'get_weather', /* ... */ handler: weatherHandler }]
  })
  const result = await agent.run("What's the weather in London?")

  expect(result).toContain('London')
  expect(weatherHandler).toHaveBeenCalledWith({ location: 'London' })
})
```

### Testing error handling

```typescript
it('throws without provider', async () => {
  const agent = new MastraAgent({ name: 'Agent', instructions: '' })
  await expect(agent.generate('Hello')).rejects.toThrow('Model provider required')
})
```

### Testing async generators (streaming)

```typescript
it('yields all stream chunks in order', async () => {
  const chunks: StreamChunk[] = [
    { type: 'text', text: 'Hello' },
    { type: 'text', text: ' world' },
    { type: 'finish', finishReason: 'stop' },
  ]
  const received: StreamChunk[] = []

  for await (const chunk of mockStream(chunks)) {
    received.push(chunk)
  }

  expect(received).toHaveLength(3)
  expect(received[0]).toEqual({ type: 'text', text: 'Hello' })
})
```

### Running tests

```bash
# Basic run
npm test

# Watch mode (re-runs on file change)
npm run test:watch

# With coverage
npx vitest run --coverage
```

---

## Test Organization

### Class-based grouping (Python)

Group related tests in classes that mirror the production classes:

```python
class TestResearchAgent:      # tests for ResearchAgent class
    def test_requires_client(self): ...
    def test_run_with_mock(self): ...
    def test_empty_results(self): ...

class TestAgentResponse:      # tests for AgentResponse dataclass
    def test_create_response(self): ...
```

### describe-based grouping (TypeScript)

```typescript
describe('MastraAgent', () => {      // tests for MastraAgent class
  describe('generate', () => {       // tests for the generate() method
    it('throws without provider', ...)
    it('returns text and messages', ...)
    it('includes history', ...)
  })
})

describe('MastraWorkflow', () => {   // separate describe for Workflow
  it('chains steps fluently', ...)
  it('passes context between steps', ...)
})
```

---

## What to Test

For each agent class, cover:

| Test category | Example |
|---|---|
| **Construction** | Default values, required params, config validation |
| **Happy path** | Normal operation with mock LLM returning expected output |
| **Error cases** | Missing client, network error, invalid tool name |
| **Edge cases** | Empty inputs, max iterations, empty tool list |
| **Side effects** | Memory updated, session tracking, tool call counts |
| **Tool execution** | Each tool runs correctly, errors are handled |

---

## Red-Green-Refactor in Practice

When adding a new feature to a starter:

```bash
# 1. RED — write a failing test
python -m pytest tests/test_agent.py::TestMyFeature -v
# FAILED: AttributeError: MyAgent has no attribute 'new_method'

# 2. GREEN — implement the minimum to pass
# (add new_method to agent.py)
python -m pytest tests/test_agent.py::TestMyFeature -v
# PASSED

# 3. REFACTOR — clean up while keeping tests green
python -m pytest tests/ -v
# All tests still PASSED
```
