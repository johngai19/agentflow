# 06-crewai

## What is CrewAI?

CrewAI is a multi-agent collaboration framework where role-based agents work together as a "crew" to accomplish complex tasks. Each agent has a defined role (Researcher, Writer, Analyst, etc.), a goal, and a backstory that shapes its behavior. Agents are assigned tasks and execute them in sequence or in parallel, with results combined into a final output.

## Why Use CrewAI?

- Role-based agent design makes responsibilities clear and modular
- Supports multi-agent pipelines where agents hand off work to each other
- Easy to extend with custom tools per agent
- Ideal for document generation, research workflows, and content pipelines

## Install

```bash
pip install -r requirements.txt
```

## Run Tests

```bash
python -m pytest tests/ -v
```
