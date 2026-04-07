"""Agno starter - Fast async agent framework (formerly Phidata)."""
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator, Callable
from enum import Enum


class RunStatus(Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class RunResponse:
    """Response from an agent run."""
    content: str
    status: RunStatus = RunStatus.COMPLETED
    metrics: dict = field(default_factory=dict)
    messages: list[dict] = field(default_factory=list)

    @property
    def is_success(self) -> bool:
        return self.status == RunStatus.COMPLETED


@dataclass
class Memory:
    """Agent memory for conversation history."""
    max_messages: int = 10
    _messages: list[dict] = field(default_factory=list)

    def add(self, role: str, content: str) -> None:
        self._messages.append({"role": role, "content": content})
        if len(self._messages) > self.max_messages:
            self._messages = self._messages[-self.max_messages:]

    def get_messages(self) -> list[dict]:
        return self._messages.copy()

    def clear(self) -> None:
        self._messages = []

    @property
    def message_count(self) -> int:
        return len(self._messages)


class AgnoAgent:
    """A fast, structured agent using Agno patterns."""
    def __init__(
        self,
        model=None,
        tools: list[Callable] = None,
        memory: Memory | None = None,
        instructions: list[str] | None = None,
        markdown: bool = True,
    ):
        self.model = model
        self.tools = tools or []
        self.memory = memory or Memory()
        self.instructions = instructions or []
        self.markdown = markdown
        self._run_status = RunStatus.IDLE

    def run(self, message: str) -> RunResponse:
        """Synchronously run the agent."""
        if not self.model:
            raise ValueError("Model required to run agent")

        self._run_status = RunStatus.RUNNING
        self.memory.add("user", message)

        try:
            system = "\n".join(self.instructions) if self.instructions else "You are a helpful assistant."
            response_text = self.model.complete(
                system=system,
                messages=self.memory.get_messages(),
            )
            self.memory.add("assistant", response_text)
            self._run_status = RunStatus.COMPLETED
            return RunResponse(
                content=response_text,
                status=RunStatus.COMPLETED,
                messages=self.memory.get_messages(),
            )
        except Exception as e:
            self._run_status = RunStatus.FAILED
            return RunResponse(content=str(e), status=RunStatus.FAILED)

    def add_instruction(self, instruction: str) -> None:
        self.instructions.append(instruction)

    @property
    def status(self) -> RunStatus:
        return self._run_status

    @property
    def tool_count(self) -> int:
        return len(self.tools)


class AgnoTeam:
    """A team of Agno agents working together."""
    def __init__(self, members: list[AgnoAgent], mode: str = "coordinate"):
        self.members = members
        self.mode = mode

    def run(self, task: str) -> list[RunResponse]:
        """Run all team members on the task."""
        return [member.run(task) for member in self.members]

    @property
    def member_count(self) -> int:
        return len(self.members)
