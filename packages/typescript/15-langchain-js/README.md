# LangChain.js Starter

LangChain.js is the TypeScript implementation of the popular LangChain framework, bringing chain-based AI composition, prompt templating, and agent execution to JavaScript and TypeScript applications. It introduces the `Runnable` interface as a universal abstraction for composable AI components.

This starter implements the core LangChain patterns: `PromptTemplate` for variable interpolation in prompts, `LLMChain` for combining a prompt with an LLM call, `SequentialChain` for composing multiple runnables in a pipeline, and `AgentExecutor` for running agents with access to structured tools. All LLM calls are abstracted behind simple interfaces, making it easy to plug in any real LangChain-compatible model.

## Install

```bash
npm install
```

## Test

```bash
npm test
```
