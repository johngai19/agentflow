# Griptape Starter

Enterprise Python agent pipeline framework for production AI applications.

Griptape provides a clean pipeline abstraction for building multi-step AI workflows with typed artifacts, tool use, and conversation memory. It emphasizes reliability and observability for production deployments.

## Key Concepts

- **Artifact**: Typed data container (TEXT, JSON, BLOB, ERROR) flowing through pipelines
- **PromptTask**: Template-based LLM task with input/output artifact chaining
- **ToolkitTask**: Task with access to multiple tools for complex operations
- **Pipeline**: Sequential chain of tasks with fluent builder API
- **GriptapeAgent**: Conversational agent with memory and tool registry

## Usage

```python
from src.agent import Pipeline, PromptTask, GriptapeAgent

# Pipeline usage
pipeline = (Pipeline()
    .add_task(PromptTask("Summarize: {input}", llm=my_llm))
    .add_task(PromptTask("Translate to French: {input}", llm=my_llm)))

result = pipeline.run("Long document text...")

# Agent usage
agent = GriptapeAgent(llm=my_llm)
response = agent.run("What is the capital of France?")
```

## Tests

```bash
pip install pytest
pytest tests/ -v
```
