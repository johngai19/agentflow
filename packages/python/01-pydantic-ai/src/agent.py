"""PydanticAI starter - Type-safe AI agents with Pydantic validation."""
from dataclasses import dataclass
from typing import Any
from unittest.mock import MagicMock


@dataclass
class SearchResult:
    """Structured result from web search."""
    title: str
    url: str
    snippet: str


@dataclass
class AgentResponse:
    """Structured agent response with validation."""
    answer: str
    sources: list[SearchResult]
    confidence: float


class ResearchAgent:
    """A research agent using PydanticAI for type-safe responses."""

    def __init__(self, model_client=None):
        """Initialize with optional model client (injectable for testing)."""
        self._client = model_client
        self._tools = {
            "search": self._search_web,
            "summarize": self._summarize_text,
        }

    def _search_web(self, query: str) -> list[SearchResult]:
        """Tool: Search the web for information."""
        if self._client:
            raw = self._client.search(query)
            return [SearchResult(**r) for r in raw]
        return []

    def _summarize_text(self, text: str, max_words: int = 100) -> str:
        """Tool: Summarize text to specified word count."""
        words = text.split()
        if len(words) <= max_words:
            return text
        return " ".join(words[:max_words]) + "..."

    def run(self, query: str) -> AgentResponse:
        """Execute the research agent pipeline."""
        if not self._client:
            raise ValueError("Model client required for production use")

        results = self._search_web(query)
        snippets = " ".join(r.snippet for r in results)
        answer = self._summarize_text(snippets)

        return AgentResponse(
            answer=answer,
            sources=results,
            confidence=0.85 if results else 0.0,
        )

    def available_tools(self) -> list[str]:
        """Return list of available tool names."""
        return list(self._tools.keys())
