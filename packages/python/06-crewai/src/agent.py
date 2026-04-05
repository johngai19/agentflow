"""CrewAI starter - Multi-agent collaboration with role-based agents."""
from dataclasses import dataclass, field
from typing import Any, Callable
from enum import Enum


class AgentRole(Enum):
    RESEARCHER = "researcher"
    WRITER = "writer"
    ANALYST = "analyst"
    COORDINATOR = "coordinator"


@dataclass
class CrewAgent:
    """An individual agent with a role and goal."""
    name: str
    role: AgentRole
    goal: str
    backstory: str
    llm: Any = None
    tools: list = field(default_factory=list)

    def execute_task(self, task_description: str) -> str:
        """Execute a task using this agent's capabilities."""
        if not self.llm:
            raise ValueError(f"Agent '{self.name}' requires an LLM to execute tasks")
        prompt = f"Role: {self.role.value}\nGoal: {self.goal}\nTask: {task_description}"
        return self.llm.complete(prompt)

    def can_use_tool(self, tool_name: str) -> bool:
        return tool_name in [t.name if hasattr(t, 'name') else str(t) for t in self.tools]


@dataclass
class Task:
    """A task to be executed by an agent."""
    description: str
    expected_output: str
    agent: CrewAgent | None = None
    result: str | None = None

    def assign_to(self, agent: CrewAgent) -> None:
        self.agent = agent

    def is_assigned(self) -> bool:
        return self.agent is not None


class Crew:
    """Orchestrates multiple agents working together."""
    def __init__(self, agents: list[CrewAgent], tasks: list[Task], verbose: bool = False):
        self.agents = agents
        self.tasks = tasks
        self.verbose = verbose
        self._results: list[str] = []

    def kickoff(self) -> str:
        """Start the crew's work and return combined output."""
        self._results = []
        for task in self.tasks:
            if not task.is_assigned():
                raise ValueError(f"Task '{task.description[:50]}' has no assigned agent")
            result = task.agent.execute_task(task.description)
            task.result = result
            self._results.append(result)
        return "\n".join(self._results)

    @property
    def agent_count(self) -> int:
        return len(self.agents)

    @property
    def task_count(self) -> int:
        return len(self.tasks)

    def get_agent_by_role(self, role: AgentRole) -> CrewAgent | None:
        for agent in self.agents:
            if agent.role == role:
                return agent
        return None
