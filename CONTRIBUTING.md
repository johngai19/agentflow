# Contributing

Thank you for contributing to the Agent Frameworks Starter Collection!

## Adding a New Framework Starter

### 1. Choose a slot number

Check the existing packages and pick the next available number (21+), or fill a gap. Numbers 1–20 are reserved for the initial collection.

### 2. Create the directory

**Python framework:**
```
packages/python/NN-framework-name/
```

**TypeScript framework:**
```
packages/typescript/NN-framework-name/
```

**Orchestration/Infrastructure:**
```
packages/orchestration/NN-framework-name/
```

### 3. Follow the standard structure

#### Python starter checklist

- [ ] `src/__init__.py` (empty)
- [ ] `tests/__init__.py` (empty)
- [ ] `src/agent.py` — core implementation
- [ ] `tests/test_agent.py` — pytest tests
- [ ] `pyproject.toml` with:
  ```toml
  [tool.pytest.ini_options]
  testpaths = ["tests"]
  pythonpath = ["."]
  ```
- [ ] `requirements.txt` with at minimum `pytest>=8.0`
- [ ] `README.md`

#### TypeScript starter checklist

- [ ] `src/agent.ts` — core implementation
- [ ] `src/index.ts` — re-exports
- [ ] `tests/agent.test.ts` — vitest tests
- [ ] `vitest.config.ts`:
  ```typescript
  import { defineConfig } from 'vitest/config'
  export default defineConfig({ test: { environment: 'node' } })
  ```
- [ ] `tsconfig.json` with `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`
- [ ] `package.json` with `"type": "module"` and `"test": "vitest run"`
- [ ] `README.md`

### 4. TDD requirements

All submissions **must** follow TDD:

1. **Write tests first** before writing the implementation
2. **Tests must pass** — `0 failed` is required before merging
3. **No real API calls in tests** — all LLM/model calls must be mocked
4. **Test both happy path and error cases**

#### Python: minimum test coverage

```python
# Happy path
def test_run_with_mock_llm(self):
    mock_llm = MagicMock()
    mock_llm.complete.return_value = "Mocked response"
    agent = MyAgent(llm=mock_llm)
    result = agent.run("test input")
    assert result is not None

# Error case
def test_run_requires_llm(self):
    agent = MyAgent()  # no llm
    with pytest.raises(ValueError, match="LLM required"):
        agent.run("test input")
```

#### TypeScript: minimum test coverage

```typescript
// Happy path
it('runs with mock provider', async () => {
  const provider = { generate: vi.fn().mockResolvedValue('Response') }
  const agent = new MyAgent(provider)
  const result = await agent.run('test input')
  expect(result).toBeTruthy()
})

// Error case
it('throws without provider', async () => {
  const agent = new MyAgent()
  await expect(agent.run('test')).rejects.toThrow('Provider required')
})
```

### 5. Implement the agent

The implementation should demonstrate the framework's **core patterns**:

- How to define and register tools
- How to manage conversation memory/state
- How to handle multi-step agent loops
- Any framework-specific patterns (graphs, crews, flows, etc.)

Keep implementations **concise** — show the pattern clearly without over-engineering.

### 6. Write the README

The `README.md` for each starter should include:

```markdown
# Framework Name Starter

[2-3 paragraph description of what makes this framework unique]

## Install

[one-liner install command]

## Test

[one-liner test command]

## What This Starter Demonstrates

[bullet list of patterns shown]

## Key Concepts

[brief explanation of the framework's core concepts]
```

### 7. Add to the web portal

Update `web/src/data/frameworks.ts` to add your framework to the showcase:

```typescript
{
  id: NN,
  name: "My Framework",
  language: "python" | "typescript" | "orchestration",
  description: "One-sentence description of what makes it unique.",
  tags: ["tag1", "tag2", "tag3"],
  githubPath: "NN-my-framework",
  docsUrl: "https://framework-docs.example.com",
}
```

### 8. Verify everything passes

```bash
# Python
cd packages/python/NN-my-framework
pip install -r requirements.txt
python -m pytest tests/ -v

# TypeScript
cd packages/typescript/NN-my-framework
npm install
npm test

# Web portal still builds
cd web
npm run build
```

### 9. Submit

Commit all files and open a pull request against `main`. The PR description should include:

- Framework name and link to official docs
- What patterns are demonstrated
- Test results (copy the pytest/vitest output)

---

## Code Style

### Python

- Use dataclasses or plain classes — no heavy framework dependencies in the starter itself
- Type hints on all public methods
- Docstrings on all public classes and methods
- Follow existing naming conventions in adjacent starters

### TypeScript

- All imports use `.js` extension (required for NodeNext ESM)
- Prefer `interface` over `type` for object shapes
- Export types from `src/index.ts`
- No `any` unless unavoidable (and explain in a comment why)

---

## Questions?

Open an issue or start a discussion. We're happy to help you get a new starter across the finish line.
