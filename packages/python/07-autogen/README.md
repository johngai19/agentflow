# 07-autogen

## What is AutoGen?

AutoGen is Microsoft's open-source framework for building conversational multi-agent systems. Agents communicate by sending and receiving messages in a structured conversation loop. It features ConversableAgent as the base class, with specialized AssistantAgent (LLM-powered) and UserProxyAgent (human proxy) subtypes, plus GroupChat for coordinating many agents simultaneously.

## Why Use AutoGen?

- Conversation-first design: agents naturally exchange messages
- Flexible reply registration lets you inject custom logic without subclassing
- GroupChat with round-robin or custom speaker selection
- Human-in-the-loop support via UserProxyAgent input modes
- Well-suited for coding assistants, debate simulations, and review pipelines

## Install

```bash
pip install -r requirements.txt
```

## Run Tests

```bash
python -m pytest tests/ -v
```
