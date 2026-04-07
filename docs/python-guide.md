# Python Framework Development Guide

## Prerequisites

- Python ≥ 3.11
- pip or uv

## Running a Python Starter

```bash
# Navigate to any Python starter
cd packages/python/01-pydantic-ai

# Install dependencies
pip install -r requirements.txt

# Run all tests
python -m pytest tests/ -v

# Run with coverage
python -m pytest tests/ -v --cov=src --cov-report=term-missing

# Run a specific test
python -m pytest tests/test_agent.py::TestResearchAgent::test_run_with_mock_client -v
```

## Project Structure

Every Python starter follows this layout:

```
NN-framework-name/
├── src/
│   ├── __init__.py         ← empty, marks src/ as a package
│   └── agent.py            ← main implementation
├── tests/
│   ├── __init__.py         ← empty, marks tests/ as a package
│   └── test_agent.py       ← pytest test suite
├── pyproject.toml          ← build config + pytest settings
├── requirements.txt        ← pip dependencies
└── README.md
```

### Why `pythonpath = ["."]`?

The `pyproject.toml` includes:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

This lets tests import `from src.agent import ...` without needing to install the package with `pip install -e .`. Just `pip install -r requirements.txt` and run `pytest`.

## Adding Production Dependencies

The `requirements.txt` files currently contain only test dependencies (`pytest`, `pytest-cov`) because the starter implementations are self-contained (no real SDK needed to run tests).

To use the real framework in production, install the actual SDK:

| Framework | Install command |
|---|---|
| PydanticAI | `pip install pydantic-ai` |
| LangChain | `pip install langchain langchain-anthropic` |
| LangGraph | `pip install langgraph` |
| LlamaIndex | `pip install llama-index` |
| Google ADK | `pip install google-adk` |
| CrewAI | `pip install crewai` |
| AutoGen | `pip install pyautogen` |
| Smolagents | `pip install smolagents` |
| Agno | `pip install agno` |
| Semantic Kernel | `pip install semantic-kernel` |
| Griptape | `pip install griptape` |

## Using a Virtual Environment (Recommended)

```bash
# Create venv
python -m venv .venv

# Activate (Linux/Mac)
source .venv/bin/activate

# Activate (Windows)
.venv\Scripts\activate

# Install deps
pip install -r requirements.txt

# Run tests
python -m pytest tests/ -v
```

Or with `uv` (faster):

```bash
uv venv
uv pip install -r requirements.txt
uv run pytest tests/ -v
```

## Running All Python Starters

```bash
# From repo root — loop through all Python packages
for dir in packages/python/*/; do
  echo ""
  echo "▶ Testing $(basename $dir)"
  (cd "$dir" && python -m pytest tests/ -q 2>&1 | tail -3)
done
```

## Writing New Python Starters

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the full checklist. Key points:

1. Agent classes accept `llm=None` or `model_client=None` constructor parameter
2. Raise `ValueError` with descriptive message when run without an LLM
3. Tests use `unittest.mock.MagicMock()` — no `patch()` needed since we use DI
4. Use `side_effect=["response1", "response2"]` for sequential mock calls
5. Use `assert_called_once_with(...)` to verify prompt content
