"""Griptape starter - Enterprise Python agent pipeline framework."""
from dataclasses import dataclass, field
from typing import Any, Callable
from enum import Enum


class ArtifactType(Enum):
    TEXT = "text"
    JSON = "json"
    BLOB = "blob"
    ERROR = "error"


@dataclass
class Artifact:
    """A piece of data flowing through a Griptape pipeline."""
    value: Any
    artifact_type: ArtifactType = ArtifactType.TEXT
    name: str = ""
    encoding: str = "utf-8"

    def to_text(self) -> str:
        return str(self.value)

    @property
    def is_error(self) -> bool:
        return self.artifact_type == ArtifactType.ERROR


@dataclass
class ToolAction:
    """An action taken by a tool."""
    tool_name: str
    input: Artifact
    output: Artifact | None = None


class BaseTool:
    """Base class for all Griptape tools."""
    name: str = ""
    description: str = ""

    def run(self, artifact: Artifact) -> Artifact:
        raise NotImplementedError

    def __call__(self, artifact: Artifact) -> Artifact:
        return self.run(artifact)


class PromptTask:
    """A task that uses a prompt and LLM to process inputs."""
    def __init__(self, prompt_template: str, llm=None):
        self.prompt_template = prompt_template
        self.llm = llm
        self.output: Artifact | None = None

    def run(self, artifact: Artifact) -> Artifact:
        if not self.llm:
            raise ValueError("LLM required for PromptTask")
        prompt = self.prompt_template.format(input=artifact.to_text())
        result = self.llm.complete(prompt)
        self.output = Artifact(value=result)
        return self.output


class ToolkitTask:
    """A task that can use multiple tools."""
    def __init__(self, prompt: str, tools: list[BaseTool] = None, llm=None):
        self.prompt = prompt
        self.tools = {t.name: t for t in (tools or [])}
        self.llm = llm
        self.tool_actions: list[ToolAction] = []

    def add_tool(self, tool: BaseTool) -> None:
        self.tools[tool.name] = tool

    def run(self, artifact: Artifact) -> Artifact:
        if not self.llm:
            raise ValueError("LLM required for ToolkitTask")
        context = f"Input: {artifact.to_text()}\nTools: {list(self.tools.keys())}"
        result = self.llm.complete(f"{self.prompt}\n{context}")
        return Artifact(value=result)


class Pipeline:
    """A sequential pipeline of tasks."""
    def __init__(self, tasks: list[PromptTask | ToolkitTask] = None):
        self.tasks = tasks or []

    def add_task(self, task: PromptTask | ToolkitTask) -> "Pipeline":
        self.tasks.append(task)
        return self

    def run(self, input_text: str) -> Artifact:
        artifact = Artifact(value=input_text)
        for task in self.tasks:
            artifact = task.run(artifact)
        return artifact

    @property
    def task_count(self) -> int:
        return len(self.tasks)


class GriptapeAgent:
    """A Griptape agent with memory and tool use."""
    def __init__(self, llm=None, tools: list[BaseTool] = None, stream: bool = False):
        self.llm = llm
        self.tools = {t.name: t for t in (tools or [])}
        self.stream = stream
        self._conversation: list[dict] = []

    def add_tool(self, tool: BaseTool) -> None:
        self.tools[tool.name] = tool

    def run(self, input_text: str) -> Artifact:
        if not self.llm:
            raise ValueError("LLM required")
        self._conversation.append({"role": "user", "content": input_text})
        result = self.llm.complete(input_text)
        self._conversation.append({"role": "assistant", "content": result})
        return Artifact(value=result)

    @property
    def conversation_length(self) -> int:
        return len(self._conversation)

    @property
    def tool_names(self) -> list[str]:
        return list(self.tools.keys())
