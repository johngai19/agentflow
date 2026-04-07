# OpenAI Agents SDK Starter

This starter demonstrates OpenAI Agents SDK patterns for building GPT-powered agents with function tool calling, multi-turn agentic loops, and agent handoffs. It follows the OpenAI Chat Completions API structure with `tool_calls` and `finish_reason` handling.

The `OpenAIAgent` class manages the full run loop: sending messages, detecting `tool_calls` finish reasons, executing registered function tools with parsed arguments, and continuing until the model produces a `stop` response. The `Handoff` class models conditional routing between specialized agents based on user input, a core pattern in multi-agent systems.

## Install

```bash
npm install
```

## Test

```bash
npm test
```
