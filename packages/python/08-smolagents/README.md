# 08-smolagents

## What is Smolagents?

Smolagents is HuggingFace's lightweight agent framework designed for simplicity and speed. Agents reason step-by-step and choose from a set of registered tools, outputting either a tool call or a final answer using a structured format. The framework emphasizes minimal dependencies and easy tool integration.

## Why Use Smolagents?

- Extremely lightweight — minimal boilerplate to get an agent running
- Tool-first design: easy to add custom tools with a `forward()` method
- Transparent step logging for debugging agent reasoning
- Supports sandboxed code execution via CodeInterpreterTool
- Great starting point for custom HuggingFace model integrations

## Install

```bash
pip install -r requirements.txt
```

## Run Tests

```bash
python -m pytest tests/ -v
```
