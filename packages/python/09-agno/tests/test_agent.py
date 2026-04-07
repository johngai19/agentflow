"""TDD tests for Agno agent framework."""
import pytest
from unittest.mock import MagicMock
from src.agent import RunStatus, RunResponse, Memory, AgnoAgent, AgnoTeam


class TestRunResponse:
    def test_success_response(self):
        r = RunResponse(content="Done!", status=RunStatus.COMPLETED)
        assert r.is_success
        assert r.content == "Done!"

    def test_failed_response(self):
        r = RunResponse(content="Error", status=RunStatus.FAILED)
        assert not r.is_success


class TestMemory:
    def test_add_messages(self):
        mem = Memory()
        mem.add("user", "Hello")
        mem.add("assistant", "Hi!")
        assert mem.message_count == 2

    def test_max_messages_limit(self):
        mem = Memory(max_messages=3)
        for i in range(5):
            mem.add("user", f"Message {i}")
        assert mem.message_count == 3

    def test_get_messages_returns_copy(self):
        mem = Memory()
        mem.add("user", "Hi")
        msgs = mem.get_messages()
        msgs.append({"role": "injected", "content": "bad"})
        assert mem.message_count == 1

    def test_clear_memory(self):
        mem = Memory()
        mem.add("user", "Hello")
        mem.clear()
        assert mem.message_count == 0


class TestAgnoAgent:
    def make_agent(self, model=None):
        return AgnoAgent(
            model=model,
            instructions=["Be concise", "Be helpful"],
        )

    def test_initial_status(self):
        agent = self.make_agent()
        assert agent.status == RunStatus.IDLE

    def test_run_requires_model(self):
        agent = self.make_agent()
        with pytest.raises(ValueError, match="Model required"):
            agent.run("Hello")

    def test_run_with_mock_model(self):
        mock_model = MagicMock()
        mock_model.complete.return_value = "Agno is a fast agent framework."
        agent = self.make_agent(model=mock_model)
        response = agent.run("What is Agno?")
        assert response.is_success
        assert "Agno" in response.content
        assert agent.status == RunStatus.COMPLETED

    def test_run_stores_in_memory(self):
        mock_model = MagicMock()
        mock_model.complete.return_value = "Response"
        agent = self.make_agent(model=mock_model)
        agent.run("Question")
        assert agent.memory.message_count == 2  # user + assistant

    def test_add_instruction(self):
        agent = self.make_agent()
        agent.add_instruction("Always respond in JSON")
        assert "Always respond in JSON" in agent.instructions

    def test_run_failed_status_on_error(self):
        mock_model = MagicMock()
        mock_model.complete.side_effect = RuntimeError("API error")
        agent = self.make_agent(model=mock_model)
        response = agent.run("test")
        assert not response.is_success
        assert agent.status == RunStatus.FAILED


class TestAgnoTeam:
    def test_team_member_count(self):
        agents = [AgnoAgent(), AgnoAgent()]
        team = AgnoTeam(members=agents)
        assert team.member_count == 2

    def test_team_run_all_members(self):
        mock_model = MagicMock()
        mock_model.complete.return_value = "Team response"
        agents = [AgnoAgent(model=mock_model), AgnoAgent(model=mock_model)]
        team = AgnoTeam(members=agents)
        results = team.run("Team task")
        assert len(results) == 2
        assert all(r.is_success for r in results)
