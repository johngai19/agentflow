# Claude Agent SDK Starter

This starter demonstrates Anthropic's agent SDK patterns for building Claude-powered agents with tool use and multi-turn conversation management. It models the agentic loop where Claude can call tools, receive results, and continue reasoning until reaching a final answer.

The `ClaudeAgent` class handles the full tool-use loop: it sends messages to Claude, detects `tool_use` stop reasons, dispatches tool calls to registered handlers, and feeds results back as `tool_result` blocks. The design mirrors the official Anthropic Messages API structure, making it straightforward to swap the mock client for a real `@anthropic-ai/sdk` instance.

## Install

```bash
npm install
```

## Test

```bash
npm test
```
