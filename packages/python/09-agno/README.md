# 09-agno

## What is Agno?

Agno (formerly Phidata) is a fast, structured agent framework focused on async execution and clean run/response patterns. Agents are configured with a model, tools, memory, and instructions. Each `run()` call returns a typed `RunResponse` with content, status, and message history. Agno also supports multi-agent teams via `AgnoTeam`.

## Why Use Agno?

- Clean, typed RunResponse objects make result handling predictable
- Built-in Memory class with configurable sliding-window history
- Instruction lists replace monolithic system prompts for modular control
- AgnoTeam enables parallel multi-agent task execution
- Designed for production use with async support and structured outputs

## Install

```bash
pip install -r requirements.txt
```

## Run Tests

```bash
python -m pytest tests/ -v
```
