"""TDD tests for PydanticAI research agent."""
import pytest
from unittest.mock import MagicMock, patch
from src.agent import ResearchAgent, SearchResult, AgentResponse


class TestSearchResult:
    def test_create_search_result(self):
        result = SearchResult(
            title="Test Article",
            url="https://example.com",
            snippet="This is a test snippet about AI agents."
        )
        assert result.title == "Test Article"
        assert result.url == "https://example.com"
        assert "AI agents" in result.snippet

    def test_search_result_is_dataclass(self):
        result = SearchResult(title="T", url="U", snippet="S")
        assert hasattr(result, "title")
        assert hasattr(result, "url")
        assert hasattr(result, "snippet")


class TestAgentResponse:
    def test_create_agent_response(self):
        sources = [SearchResult("T", "U", "S")]
        response = AgentResponse(
            answer="Test answer",
            sources=sources,
            confidence=0.9
        )
        assert response.answer == "Test answer"
        assert len(response.sources) == 1
        assert response.confidence == 0.9


class TestResearchAgent:
    def test_agent_has_tools(self):
        agent = ResearchAgent()
        tools = agent.available_tools()
        assert "search" in tools
        assert "summarize" in tools

    def test_summarize_short_text(self):
        agent = ResearchAgent()
        text = "Short text"
        result = agent._summarize_text(text, max_words=100)
        assert result == "Short text"

    def test_summarize_long_text_truncates(self):
        agent = ResearchAgent()
        text = " ".join([f"word{i}" for i in range(200)])
        result = agent._summarize_text(text, max_words=50)
        assert result.endswith("...")
        assert len(result.split()) <= 51  # 50 words + "..."

    def test_run_requires_client(self):
        agent = ResearchAgent()
        with pytest.raises(ValueError, match="Model client required"):
            agent.run("What is PydanticAI?")

    def test_run_with_mock_client(self):
        mock_client = MagicMock()
        mock_client.search.return_value = [
            {"title": "PydanticAI Docs", "url": "https://ai.pydantic.dev", "snippet": "Type-safe AI agent framework"}
        ]
        agent = ResearchAgent(model_client=mock_client)
        response = agent.run("What is PydanticAI?")
        assert isinstance(response, AgentResponse)
        assert len(response.sources) == 1
        assert response.confidence > 0
        mock_client.search.assert_called_once_with("What is PydanticAI?")

    def test_run_with_empty_results(self):
        mock_client = MagicMock()
        mock_client.search.return_value = []
        agent = ResearchAgent(model_client=mock_client)
        response = agent.run("Unknown topic")
        assert response.confidence == 0.0
        assert response.sources == []

    def test_search_without_client_returns_empty(self):
        agent = ResearchAgent()
        results = agent._search_web("test query")
        assert results == []
