# Mastra Agent Starter

Mastra is a modern TypeScript-first agent framework for building AI agents with structured tool use, multi-step workflows, and conversation management. It provides a clean, strongly-typed API that integrates with any LLM provider through a simple abstraction layer.

This starter demonstrates the core Mastra patterns: creating agents with configurable tools and instructions, running multi-turn conversations with history, and composing multi-step workflows that pass context between steps. All AI provider calls are abstracted behind a `ModelProvider` interface, making it easy to swap between Claude, GPT-4, and other models.

## Install

```bash
npm install
```

## Test

```bash
npm test
```
