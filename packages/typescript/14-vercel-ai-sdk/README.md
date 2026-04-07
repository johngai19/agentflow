# Vercel AI SDK Starter

The Vercel AI SDK provides a unified interface for text generation and streaming across multiple AI providers including OpenAI, Anthropic, and others. This starter demonstrates the core `generateText` pattern with tool definitions, provider abstraction, and async streaming via `AsyncGenerator`.

The `VercelAIClient` wraps any `AIProvider` implementation and provides a fluent API for registering tools with `defineTool`. Tools are passed directly to the provider only when defined, matching the Vercel AI SDK's behavior. The `mockStream` utility enables testing streaming scenarios without a real provider connection.

## Install

```bash
npm install
```

## Test

```bash
npm test
```
