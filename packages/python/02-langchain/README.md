# LangChain Agent Starter

LangChain is one of the most widely-adopted Python frameworks for building LLM-powered applications. Its core abstraction is the "chain" — a composable sequence of operations that transforms inputs through prompts, LLMs, parsers, and tools. LangChain popularized the ReAct (Reasoning + Acting) pattern for agents, where the LLM iteratively decides which tool to call based on the current context and previous observations.

What sets LangChain apart is its massive ecosystem of integrations: hundreds of LLM providers, vector stores, document loaders, and tools are available as drop-in components. The framework is highly modular — you can swap OpenAI for Anthropic, or FAISS for Pinecone, without rewriting your agent logic. This makes it ideal for rapid prototyping and for projects that need flexibility across providers.

This starter demonstrates the key building blocks: `Tool` for wrappable functions, `LLMChain` for prompt-templated LLM calls, and `AgentExecutor` for orchestrating tools with an LLM. A calculator tool and injectable weather tool show how to build and test tool-using agents without any real API credentials.

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
02-langchain/
├── src/
│   └── agent.py        # Tool, LLMChain, AgentExecutor implementations
├── tests/
│   └── test_agent.py   # TDD tests using mocks (no API key needed)
├── pyproject.toml
├── requirements.txt
└── README.md
```
