# Google ADK Agent Starter

Google's Agent Development Kit (ADK) is an open-source framework for building multi-agent AI systems optimized for Google's Gemini model family. ADK provides a structured approach to defining agents with typed function declarations, session management, and built-in support for tool-calling via Gemini's native function-calling API. It is designed to integrate naturally with Google Cloud services and the broader Gemini ecosystem, making it the natural choice for teams already working within Google infrastructure.

What distinguishes ADK from other frameworks is its emphasis on structured tool declarations and session lifecycle management. Rather than freeform tool descriptions, each function is declared with a formal schema that Gemini uses to decide when and how to call it. The framework also provides first-class session objects for tracking conversation history, which is essential for building multi-turn agents with persistent context. ADK supports multi-agent orchestration, where specialist sub-agents can be composed into larger systems.

This starter demonstrates the core ADK patterns: `FunctionDeclaration` for schema-typed tool registration, `AgentSession` for conversation history tracking, and `GoogleADKAgent` for orchestrating Gemini-powered interactions. All tests use a mock model client so no Gemini API key is required during development and CI.

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
05-google-adk/
├── src/
│   └── agent.py        # FunctionDeclaration, AgentSession, GoogleADKAgent
├── tests/
│   └── test_agent.py   # TDD tests using mocks (no API key needed)
├── pyproject.toml
├── requirements.txt
└── README.md
```
