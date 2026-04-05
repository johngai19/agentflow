"""TDD tests for Smolagents lightweight agent."""
import pytest
from unittest.mock import MagicMock, patch
from src.agent import ToolInput, ToolOutput, Tool, CodeInterpreterTool, WebSearchTool, SmolAgent


class TestToolOutput:
    def test_success_output(self):
        output = ToolOutput(value="result")
        assert output.value == "result"
        assert not output.is_error

    def test_error_output(self):
        output = ToolOutput(value=None, error="Something went wrong")
        assert output.is_error
        assert output.error == "Something went wrong"


class TestCodeInterpreterTool:
    def test_tool_metadata(self):
        tool = CodeInterpreterTool()
        assert tool.name == "code_interpreter"
        assert "Python" in tool.description

    def test_execute_simple_code(self):
        tool = CodeInterpreterTool()
        output = tool(code="result = 2 + 2")
        assert not output.is_error
        assert "4" in str(output.value)

    def test_execute_list_operation(self):
        tool = CodeInterpreterTool()
        output = tool(code="result = sum([1, 2, 3, 4, 5])")
        assert "15" in str(output.value)

    def test_handles_no_result_variable(self):
        tool = CodeInterpreterTool()
        output = tool(code="x = 42")
        assert not output.is_error
        assert "executed successfully" in str(output.value)


class TestWebSearchTool:
    def test_tool_metadata(self):
        tool = WebSearchTool()
        assert tool.name == "web_search"
        assert len(tool.description) > 0

    def test_search_without_client(self):
        tool = WebSearchTool()
        output = tool(query="AI agents")
        assert not output.is_error
        assert "AI agents" in str(output.value)

    def test_search_with_mock_client(self):
        mock_client = MagicMock()
        mock_client.search.return_value = "Found: AI agents are software entities"
        tool = WebSearchTool(search_client=mock_client)
        output = tool(query="AI agents")
        assert "Found:" in str(output.value)
        mock_client.search.assert_called_with("AI agents")


class TestSmolAgent:
    def test_agent_with_tools(self):
        agent = SmolAgent(tools=[WebSearchTool(), CodeInterpreterTool()])
        assert "web_search" in agent.tools
        assert "code_interpreter" in agent.tools

    def test_add_tool(self):
        agent = SmolAgent(tools=[])
        agent.add_tool(WebSearchTool())
        assert "web_search" in agent.tools

    def test_run_requires_llm(self):
        agent = SmolAgent(tools=[])
        with pytest.raises(ValueError, match="LLM required"):
            agent.run("Do something")

    def test_run_returns_final_answer(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "ANSWER:Smolagents is a lightweight framework"
        agent = SmolAgent(tools=[], llm=mock_llm)
        result = agent.run("What is smolagents?")
        assert "Smolagents" in result

    def test_run_uses_tool_then_answers(self):
        mock_llm = MagicMock()
        mock_llm.complete.side_effect = [
            "TOOL:web_search|ARGS:smolagents framework",
            "ANSWER:It is a HuggingFace framework"
        ]
        agent = SmolAgent(tools=[WebSearchTool()], llm=mock_llm)
        result = agent.run("Tell me about smolagents")
        assert "HuggingFace" in result
        assert agent.step_count == 2

    def test_max_steps_terminates(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "TOOL:web_search|ARGS:query"
        agent = SmolAgent(tools=[WebSearchTool()], llm=mock_llm, max_steps=3)
        result = agent.run("Infinite loop task")
        assert "Max steps" in result
