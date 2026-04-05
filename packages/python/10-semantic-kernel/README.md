# 10-semantic-kernel

## What is Semantic Kernel?

Semantic Kernel is Microsoft's AI orchestration framework that connects AI models to code via a plugin-and-function architecture. A central `Kernel` instance manages registered plugins (collections of named functions) and AI services. Functions can be invoked synchronously or asynchronously with typed `KernelArguments`, returning structured `FunctionResult` objects.

## Why Use Semantic Kernel?

- Plugin architecture keeps AI capabilities organized and reusable
- Supports both sync and async function invocation
- Service registry decouples LLM provider from business logic
- Strong typing with KernelArguments and FunctionResult
- Natural fit for enterprise .NET-inspired patterns in Python
- Pairs well with Azure OpenAI, OpenAI, and HuggingFace backends

## Install

```bash
pip install -r requirements.txt
```

## Run Tests

```bash
python -m pytest tests/ -v
```
