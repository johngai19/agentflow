"""LangChain starter - Chain-based AI composition with tools."""
from typing import Any, Callable


class Tool:
    """A tool that an agent can use."""
    def __init__(self, name: str, description: str, func: Callable):
        self.name = name
        self.description = description
        self.func = func

    def run(self, input_str: str) -> str:
        return self.func(input_str)


class LLMChain:
    """Simulates a LangChain LLM chain."""
    def __init__(self, llm=None, prompt_template: str = "{input}"):
        self.llm = llm
        self.prompt_template = prompt_template

    def predict(self, **kwargs) -> str:
        """Run the chain with given inputs."""
        if not self.llm:
            raise ValueError("LLM client required")
        prompt = self.prompt_template.format(**kwargs)
        return self.llm.complete(prompt)


class AgentExecutor:
    """Executes an agent with tools using ReAct pattern."""
    def __init__(self, llm=None, tools: list[Tool] = None, max_iterations: int = 5):
        self.llm = llm
        self.tools = tools or []
        self.max_iterations = max_iterations
        self._tool_map = {t.name: t for t in self.tools}

    def add_tool(self, tool: Tool) -> None:
        """Add a tool to the executor."""
        self.tools.append(tool)
        self._tool_map[tool.name] = tool

    def get_tool(self, name: str) -> Tool | None:
        """Get a tool by name."""
        return self._tool_map.get(name)

    def run(self, input_str: str) -> str:
        """Execute the agent on the given input."""
        if not self.llm:
            raise ValueError("LLM required for agent execution")

        context = f"Input: {input_str}\nAvailable tools: {[t.name for t in self.tools]}"
        response = self.llm.complete(context)
        return response

    @property
    def tool_names(self) -> list[str]:
        return [t.name for t in self.tools]


def create_calculator_tool() -> Tool:
    """Factory: Create a simple calculator tool."""
    def calculate(expression: str) -> str:
        try:
            result = eval(expression, {"__builtins__": {}}, {})
            return str(result)
        except Exception as e:
            return f"Error: {e}"

    return Tool(
        name="calculator",
        description="Performs mathematical calculations",
        func=calculate
    )


def create_weather_tool(weather_client=None) -> Tool:
    """Factory: Create a weather lookup tool (injectable client)."""
    def get_weather(location: str) -> str:
        if weather_client:
            return weather_client.get(location)
        return f"Weather data not available for {location}"

    return Tool(
        name="weather",
        description="Gets current weather for a location",
        func=get_weather
    )
