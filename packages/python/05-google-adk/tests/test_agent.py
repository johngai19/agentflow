"""TDD tests for Google ADK agent."""
import pytest
from unittest.mock import MagicMock
from src.agent import (
    ActionType, FunctionDeclaration, AgentAction,
    AgentSession, GoogleADKAgent
)


class TestFunctionDeclaration:
    def test_create_declaration(self):
        decl = FunctionDeclaration(
            name="search",
            description="Search the web",
            parameters={"query": {"type": "string"}}
        )
        assert decl.name == "search"
        assert "query" in decl.parameters

    def test_to_dict(self):
        decl = FunctionDeclaration(name="test", description="test func")
        d = decl.to_dict()
        assert d["name"] == "test"
        assert d["description"] == "test func"
        assert "parameters" in d


class TestAgentSession:
    def test_create_session(self):
        session = AgentSession(session_id="sess_001")
        assert session.session_id == "sess_001"
        assert session.messages == []

    def test_add_message(self):
        session = AgentSession(session_id="sess_001")
        session.add_message("user", "Hello")
        session.add_message("assistant", "Hi there!")
        assert len(session.messages) == 2
        assert session.messages[0]["role"] == "user"
        assert session.messages[1]["role"] == "assistant"

    def test_get_history_returns_copy(self):
        session = AgentSession(session_id="sess_001")
        session.add_message("user", "Test")
        history = session.get_history()
        history.append({"role": "extra", "content": "extra"})
        assert len(session.messages) == 1  # Original unchanged


class TestGoogleADKAgent:
    def test_register_tool(self):
        agent = GoogleADKAgent()
        decl = FunctionDeclaration("search", "Search web")
        agent.register_tool(decl, lambda query: f"Results for {query}")
        assert agent.tool_count == 1

    def test_get_tool_declarations(self):
        agent = GoogleADKAgent()
        decl = FunctionDeclaration("calc", "Calculator", {"expr": {"type": "string"}})
        agent.register_tool(decl, lambda expr: eval(expr))
        declarations = agent.get_tool_declarations()
        assert len(declarations) == 1
        assert declarations[0]["name"] == "calc"

    def test_execute_tool(self):
        agent = GoogleADKAgent()
        decl = FunctionDeclaration("greet", "Greet someone", {"name": {"type": "string"}})
        agent.register_tool(decl, lambda name: f"Hello, {name}!")
        result = agent.execute_tool("greet", {"name": "Alice"})
        assert result == "Hello, Alice!"

    def test_execute_unregistered_tool_raises(self):
        agent = GoogleADKAgent()
        with pytest.raises(KeyError, match="not registered"):
            agent.execute_tool("nonexistent", {})

    def test_set_system_prompt(self):
        agent = GoogleADKAgent()
        agent.set_system_prompt("You are a coding assistant.")
        assert agent._system_prompt == "You are a coding assistant."

    def test_run_requires_client(self):
        agent = GoogleADKAgent()
        with pytest.raises(ValueError, match="Model client required"):
            agent.run("Hello")

    def test_run_with_mock_client(self):
        mock_client = MagicMock()
        mock_client.generate.return_value = "Hello! How can I help?"
        agent = GoogleADKAgent(model_client=mock_client)
        result = agent.run("Say hello")
        assert "Hello" in result
        mock_client.generate.assert_called_once()

    def test_run_updates_session(self):
        mock_client = MagicMock()
        mock_client.generate.return_value = "Response text"
        agent = GoogleADKAgent(model_client=mock_client)
        session = AgentSession(session_id="test_session")
        agent.run("User input", session=session)
        assert len(session.messages) == 2
        assert session.messages[0]["role"] == "user"
        assert session.messages[1]["role"] == "assistant"
