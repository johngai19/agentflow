"""Google ADK starter - Google's Agent Development Kit."""
from dataclasses import dataclass, field
from typing import Any, Callable
from enum import Enum


class ActionType(Enum):
    FUNCTION_CALL = "function_call"
    FINAL_ANSWER = "final_answer"
    ERROR = "error"


@dataclass
class FunctionDeclaration:
    """Declares a function/tool for the ADK agent."""
    name: str
    description: str
    parameters: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }


@dataclass
class AgentAction:
    """An action taken by the agent."""
    action_type: ActionType
    content: str
    function_name: str | None = None
    function_args: dict = field(default_factory=dict)


@dataclass
class AgentSession:
    """A session tracking agent conversation history."""
    session_id: str
    messages: list[dict] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    def add_message(self, role: str, content: str) -> None:
        self.messages.append({"role": role, "content": content})

    def get_history(self) -> list[dict]:
        return self.messages.copy()


class GoogleADKAgent:
    """An agent built with Google's Agent Development Kit patterns."""
    def __init__(self, model_client=None, model: str = "gemini-2.0-flash"):
        self._client = model_client
        self.model = model
        self._tools: dict[str, tuple[FunctionDeclaration, Callable]] = {}
        self._system_prompt = "You are a helpful AI assistant."

    def register_tool(self, declaration: FunctionDeclaration, func: Callable) -> None:
        """Register a tool/function with the agent."""
        self._tools[declaration.name] = (declaration, func)

    def set_system_prompt(self, prompt: str) -> None:
        """Set the system instruction for the agent."""
        self._system_prompt = prompt

    def get_tool_declarations(self) -> list[dict]:
        """Get all tool declarations as dicts."""
        return [decl.to_dict() for decl, _ in self._tools.values()]

    def execute_tool(self, name: str, args: dict) -> Any:
        """Execute a registered tool by name."""
        if name not in self._tools:
            raise KeyError(f"Tool '{name}' not registered")
        _, func = self._tools[name]
        return func(**args)

    def run(self, user_message: str, session: AgentSession | None = None) -> str:
        """Run the agent on a user message."""
        if not self._client:
            raise ValueError("Model client required")

        if session:
            session.add_message("user", user_message)

        tools = self.get_tool_declarations()
        response = self._client.generate(
            model=self.model,
            system=self._system_prompt,
            message=user_message,
            tools=tools,
        )

        if session:
            session.add_message("assistant", str(response))

        return str(response)

    @property
    def tool_count(self) -> int:
        return len(self._tools)
