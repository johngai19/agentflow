# LangGraph Agent Starter

LangGraph extends LangChain with a graph-based execution model designed specifically for building stateful, multi-step agent workflows. Rather than linear chains, LangGraph lets you define agents as directed graphs where each node is a processing step and edges (including conditional edges) determine the flow of execution. This paradigm makes it natural to express complex agent behaviors like loops, branching, and human-in-the-loop checkpoints.

The defining feature of LangGraph is its built-in state management. Each node receives the current `AgentState` and returns an updated version — the framework handles merging, persistence, and routing automatically. This makes it straightforward to build agents that maintain conversation history, accumulate search results across iterations, or pause mid-execution for human approval before proceeding.

This starter implements the core LangGraph primitives from scratch: `StateGraph` for defining the workflow, `GraphNode` for individual processing steps with lifecycle tracking, and `ConditionalEdge` for dynamic routing based on state. The example walks through a simulated search-then-answer flow using conditional routing.

## Installation

```bash
pip install -r requirements.txt
```

## Running Tests

```bash
python -m pytest tests/ -v
```

## Running with Coverage

```bash
python -m pytest tests/ -v --cov=src --cov-report=term-missing
```

## Project Structure

```
03-langgraph/
├── src/
│   └── agent.py        # StateGraph, GraphNode, ConditionalEdge, CompiledGraph
├── tests/
│   └── test_agent.py   # TDD tests for graph execution (no API key needed)
├── pyproject.toml
├── requirements.txt
└── README.md
```
