"""TDD tests for CrewAI multi-agent collaboration."""
import pytest
from unittest.mock import MagicMock
from src.agent import AgentRole, CrewAgent, Task, Crew


class TestCrewAgent:
    def make_agent(self, llm=None):
        return CrewAgent(
            name="Alice",
            role=AgentRole.RESEARCHER,
            goal="Research topics thoroughly",
            backstory="Expert researcher with 10 years experience",
            llm=llm,
        )

    def test_create_agent(self):
        agent = self.make_agent()
        assert agent.name == "Alice"
        assert agent.role == AgentRole.RESEARCHER
        assert agent.goal == "Research topics thoroughly"

    def test_execute_task_requires_llm(self):
        agent = self.make_agent()
        with pytest.raises(ValueError, match="requires an LLM"):
            agent.execute_task("Research AI trends")

    def test_execute_task_with_mock_llm(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "Research complete: AI is advancing rapidly."
        agent = self.make_agent(llm=mock_llm)
        result = agent.execute_task("Research AI trends")
        assert "AI" in result
        mock_llm.complete.assert_called_once()

    def test_can_use_tool(self):
        mock_tool = MagicMock()
        mock_tool.name = "web_search"
        agent = CrewAgent(
            name="Bob", role=AgentRole.RESEARCHER,
            goal="Search", backstory="Searcher", tools=[mock_tool]
        )
        assert agent.can_use_tool("web_search") is True
        assert agent.can_use_tool("unknown_tool") is False


class TestTask:
    def test_create_task(self):
        task = Task(description="Write a report", expected_output="A detailed report")
        assert task.description == "Write a report"
        assert task.result is None
        assert not task.is_assigned()

    def test_assign_task(self):
        agent = CrewAgent("Writer", AgentRole.WRITER, "Write", "Expert writer")
        task = Task(description="Write intro", expected_output="Introduction paragraph")
        task.assign_to(agent)
        assert task.is_assigned()
        assert task.agent.name == "Writer"


class TestCrew:
    def make_crew(self):
        mock_llm = MagicMock()
        mock_llm.complete.side_effect = ["Research done.", "Article written."]
        researcher = CrewAgent("Alice", AgentRole.RESEARCHER, "Research", "Researcher", llm=mock_llm)
        writer = CrewAgent("Bob", AgentRole.WRITER, "Write", "Writer", llm=mock_llm)
        task1 = Task("Research AI", "Research findings", agent=researcher)
        task2 = Task("Write article", "Article text", agent=writer)
        return Crew(agents=[researcher, writer], tasks=[task1, task2])

    def test_crew_properties(self):
        crew = self.make_crew()
        assert crew.agent_count == 2
        assert crew.task_count == 2

    def test_kickoff_executes_all_tasks(self):
        crew = self.make_crew()
        result = crew.kickoff()
        assert "Research done." in result
        assert "Article written." in result

    def test_kickoff_fails_unassigned_task(self):
        mock_llm = MagicMock()
        agent = CrewAgent("Alice", AgentRole.RESEARCHER, "Research", "Researcher", llm=mock_llm)
        unassigned_task = Task("Unassigned work", "Some output")
        crew = Crew(agents=[agent], tasks=[unassigned_task])
        with pytest.raises(ValueError, match="no assigned agent"):
            crew.kickoff()

    def test_get_agent_by_role(self):
        crew = self.make_crew()
        researcher = crew.get_agent_by_role(AgentRole.RESEARCHER)
        assert researcher is not None
        assert researcher.role == AgentRole.RESEARCHER

    def test_get_nonexistent_role_returns_none(self):
        crew = self.make_crew()
        coordinator = crew.get_agent_by_role(AgentRole.COORDINATOR)
        assert coordinator is None
