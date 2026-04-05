# PydanticAI Agent Starter

PydanticAI is a Python agent framework developed by the Pydantic team that brings type safety and validation to AI agent development. It integrates natively with Pydantic's data validation ecosystem, allowing you to define structured input/output schemas for your agents and tools. This means you get automatic validation, serialization, and IDE autocompletion for all agent interactions — a significant improvement over untyped string-based approaches common in older frameworks.

What makes PydanticAI unique is its first-class support for dependency injection, making agents highly testable without real API keys. You can swap out model clients with mocks during testing, validate that your agent produces correctly-typed responses, and build confidence in your pipeline before ever calling a real LLM endpoint. The framework also supports both sync and async execution patterns.

This starter demonstrates a `ResearchAgent` that uses injectable tool functions for web search and text summarization. The agent returns a strongly-typed `AgentResponse` with structured `SearchResult` sources and a confidence score — all validated at runtime.

## Installation

```bash
pip install -r requirements.txt
```

## Running Tests

```bash
python -m pytest tests/ -v
```

## Running with Coverage

```bash
python -m pytest tests/ -v --cov=src --cov-report=term-missing
```

## Project Structure

```
01-pydantic-ai/
├── src/
│   └── agent.py        # ResearchAgent with type-safe tools
├── tests/
│   └── test_agent.py   # TDD tests using mocks (no API key needed)
├── pyproject.toml
├── requirements.txt
└── README.md
```
