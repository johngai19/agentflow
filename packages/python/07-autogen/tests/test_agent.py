"""TDD tests for AutoGen conversational agents."""
import pytest
from unittest.mock import MagicMock
from src.agent import MessageRole, Message, ConversableAgent, AssistantAgent, UserProxyAgent, GroupChat


class TestMessage:
    def test_create_message(self):
        msg = Message(MessageRole.USER, "Hello!", "Alice")
        assert msg.role == MessageRole.USER
        assert msg.content == "Hello!"
        assert msg.name == "Alice"

    def test_message_without_name(self):
        msg = Message(MessageRole.SYSTEM, "System prompt")
        assert msg.name is None


class TestConversableAgent:
    def test_create_agent(self):
        agent = ConversableAgent("TestAgent", "You are helpful")
        assert agent.name == "TestAgent"
        assert agent.system_message == "You are helpful"

    def test_register_and_use_reply(self):
        agent = ConversableAgent("Agent")
        agent.register_reply(lambda msgs: "Custom reply")
        result = agent.generate_reply([])
        assert result == "Custom reply"

    def test_generate_reply_returns_none_with_no_functions(self):
        agent = ConversableAgent("Agent")
        result = agent.generate_reply([])
        assert result is None

    def test_send_receive_updates_history(self):
        agent_a = ConversableAgent("A")
        agent_b = ConversableAgent("B")
        agent_a.send("Hello from A", agent_b)
        assert len(agent_a.chat_history) == 1
        assert len(agent_b.chat_history) == 1

    def test_clear_history(self):
        agent_a = ConversableAgent("A")
        agent_b = ConversableAgent("B")
        agent_a.send("Hi", agent_b)
        agent_a.clear_history()
        assert len(agent_a.chat_history) == 0

    def test_chat_history_returns_copy(self):
        agent = ConversableAgent("Agent")
        history = agent.chat_history
        history.append(Message(MessageRole.USER, "injected"))
        assert len(agent.chat_history) == 0


class TestAssistantAgent:
    def test_generate_reply_without_llm(self):
        agent = AssistantAgent("Assistant")
        result = agent.generate_reply([Message(MessageRole.USER, "Hello")])
        assert result is None

    def test_generate_reply_with_mock_llm(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "I can help with that."
        agent = AssistantAgent("Assistant", llm=mock_llm)
        msgs = [Message(MessageRole.USER, "What is AutoGen?")]
        result = agent.generate_reply(msgs)
        assert result == "I can help with that."
        mock_llm.complete.assert_called_once()

    def test_uses_system_message_in_prompt(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "Response"
        agent = AssistantAgent("Coder", llm=mock_llm, system_message="You are a coding expert.")
        agent.generate_reply([Message(MessageRole.USER, "Write code")])
        call_arg = mock_llm.complete.call_args[0][0]
        assert "coding expert" in call_arg


class TestUserProxyAgent:
    def test_can_auto_reply_when_mode_never(self):
        proxy = UserProxyAgent("User", human_input_mode="NEVER", max_consecutive_auto_reply=5)
        assert proxy.can_auto_reply() is True

    def test_cannot_auto_reply_when_mode_always(self):
        proxy = UserProxyAgent("User", human_input_mode="ALWAYS")
        assert proxy.can_auto_reply() is False


class TestGroupChat:
    def test_group_chat_agent_names(self):
        agents = [ConversableAgent("Alice"), ConversableAgent("Bob")]
        gc = GroupChat(agents=agents)
        assert "Alice" in gc.agent_names()
        assert "Bob" in gc.agent_names()

    def test_next_speaker_round_robin(self):
        alice = ConversableAgent("Alice")
        bob = ConversableAgent("Bob")
        gc = GroupChat(agents=[alice, bob])
        assert gc.next_speaker(alice).name == "Bob"
        assert gc.next_speaker(bob).name == "Alice"

    def test_append_message(self):
        gc = GroupChat(agents=[ConversableAgent("A")])
        gc.append(Message(MessageRole.USER, "Hello"))
        assert len(gc.messages) == 1
