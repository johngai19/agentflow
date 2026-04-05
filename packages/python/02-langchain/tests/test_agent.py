"""TDD tests for LangChain agent implementation."""
import pytest
from unittest.mock import MagicMock
from src.agent import Tool, LLMChain, AgentExecutor, create_calculator_tool, create_weather_tool


class TestTool:
    def test_tool_creation(self):
        tool = Tool("test", "A test tool", lambda x: f"result: {x}")
        assert tool.name == "test"
        assert tool.description == "A test tool"

    def test_tool_run(self):
        tool = Tool("echo", "Echoes input", lambda x: x)
        assert tool.run("hello") == "hello"

    def test_calculator_tool(self):
        calc = create_calculator_tool()
        assert calc.name == "calculator"
        assert calc.run("2 + 2") == "4"
        assert calc.run("10 * 5") == "50"

    def test_calculator_handles_errors(self):
        calc = create_calculator_tool()
        result = calc.run("invalid expression !!!")
        assert "Error" in result

    def test_weather_tool_without_client(self):
        weather = create_weather_tool()
        result = weather.run("London")
        assert "London" in result
        assert "not available" in result

    def test_weather_tool_with_client(self):
        mock_client = MagicMock()
        mock_client.get.return_value = "Sunny, 22°C"
        weather = create_weather_tool(weather_client=mock_client)
        result = weather.run("London")
        assert result == "Sunny, 22°C"
        mock_client.get.assert_called_with("London")


class TestLLMChain:
    def test_requires_llm(self):
        chain = LLMChain()
        with pytest.raises(ValueError, match="LLM client required"):
            chain.predict(input="test")

    def test_predict_with_mock_llm(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "Mocked response"
        chain = LLMChain(llm=mock_llm, prompt_template="Query: {input}")
        result = chain.predict(input="What is LangChain?")
        assert result == "Mocked response"
        mock_llm.complete.assert_called_with("Query: What is LangChain?")

    def test_prompt_template_formatting(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "ok"
        chain = LLMChain(llm=mock_llm, prompt_template="Name: {name}, Age: {age}")
        chain.predict(name="Alice", age=30)
        mock_llm.complete.assert_called_with("Name: Alice, Age: 30")


class TestAgentExecutor:
    def test_add_tool(self):
        executor = AgentExecutor()
        tool = Tool("test", "test", lambda x: x)
        executor.add_tool(tool)
        assert "test" in executor.tool_names

    def test_get_tool(self):
        calc = create_calculator_tool()
        executor = AgentExecutor(tools=[calc])
        found = executor.get_tool("calculator")
        assert found is not None
        assert found.name == "calculator"

    def test_get_nonexistent_tool(self):
        executor = AgentExecutor()
        assert executor.get_tool("nonexistent") is None

    def test_run_requires_llm(self):
        executor = AgentExecutor()
        with pytest.raises(ValueError, match="LLM required"):
            executor.run("test input")

    def test_run_with_mock_llm(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "Agent completed task"
        executor = AgentExecutor(llm=mock_llm, tools=[create_calculator_tool()])
        result = executor.run("Calculate 2+2")
        assert result == "Agent completed task"

    def test_tool_names_property(self):
        tools = [create_calculator_tool(), create_weather_tool()]
        executor = AgentExecutor(tools=tools)
        assert "calculator" in executor.tool_names
        assert "weather" in executor.tool_names
