"""AutoGen starter - Microsoft's conversational multi-agent framework."""
from dataclasses import dataclass, field
from typing import Any, Callable
from enum import Enum


class MessageRole(Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    FUNCTION = "function"


@dataclass
class Message:
    role: MessageRole
    content: str
    name: str | None = None


class ConversableAgent:
    """An agent that can engage in conversations."""
    def __init__(self, name: str, system_message: str = "", llm_config: dict | None = None):
        self.name = name
        self.system_message = system_message
        self.llm_config = llm_config or {}
        self._chat_history: list[Message] = []
        self._reply_functions: list[Callable] = []

    def register_reply(self, func: Callable) -> None:
        """Register a custom reply function."""
        self._reply_functions.append(func)

    def generate_reply(self, messages: list[Message]) -> str | None:
        """Generate a reply given conversation history."""
        for func in self._reply_functions:
            reply = func(messages)
            if reply is not None:
                return reply
        return None

    def receive(self, message: str, sender: "ConversableAgent") -> None:
        """Receive a message from another agent."""
        self._chat_history.append(Message(MessageRole.USER, message, sender.name))

    def send(self, message: str, recipient: "ConversableAgent") -> None:
        """Send a message to another agent."""
        self._chat_history.append(Message(MessageRole.ASSISTANT, message, self.name))
        recipient.receive(message, self)

    @property
    def chat_history(self) -> list[Message]:
        return self._chat_history.copy()

    def clear_history(self) -> None:
        self._chat_history = []


class AssistantAgent(ConversableAgent):
    """An AI assistant agent powered by an LLM."""
    def __init__(self, name: str, llm=None, system_message: str = "You are a helpful AI assistant."):
        super().__init__(name, system_message)
        self._llm = llm

    def generate_reply(self, messages: list[Message]) -> str | None:
        if not self._llm:
            return None
        context = "\n".join(f"{m.role.value}: {m.content}" for m in messages[-5:])
        return self._llm.complete(f"System: {self.system_message}\n{context}")


class UserProxyAgent(ConversableAgent):
    """A proxy agent that represents the human user."""
    def __init__(self, name: str, human_input_mode: str = "NEVER",
                 max_consecutive_auto_reply: int = 10):
        super().__init__(name)
        self.human_input_mode = human_input_mode
        self.max_consecutive_auto_reply = max_consecutive_auto_reply
        self._auto_reply_count = 0

    def can_auto_reply(self) -> bool:
        return (self.human_input_mode == "NEVER" and
                self._auto_reply_count < self.max_consecutive_auto_reply)


class GroupChat:
    """A group chat with multiple agents."""
    def __init__(self, agents: list[ConversableAgent], messages: list[Message] | None = None,
                 max_round: int = 12):
        self.agents = agents
        self.messages = messages or []
        self.max_round = max_round

    def append(self, message: Message) -> None:
        self.messages.append(message)

    def agent_names(self) -> list[str]:
        return [a.name for a in self.agents]

    def next_speaker(self, last_speaker: ConversableAgent) -> ConversableAgent:
        """Select the next speaker (round-robin)."""
        if not self.agents:
            raise ValueError("No agents in group chat")
        idx = next((i for i, a in enumerate(self.agents) if a.name == last_speaker.name), -1)
        return self.agents[(idx + 1) % len(self.agents)]
