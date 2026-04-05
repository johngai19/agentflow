"""Smolagents starter - HuggingFace lightweight agent framework."""
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class ToolInput:
    name: str
    description: str
    type: str = "string"
    required: bool = True


@dataclass
class ToolOutput:
    value: Any
    error: str | None = None

    @property
    def is_error(self) -> bool:
        return self.error is not None


class Tool:
    """A tool usable by smolagents."""
    name: str = ""
    description: str = ""
    inputs: dict[str, ToolInput] = {}
    output_type: str = "string"

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)

    def forward(self, **kwargs) -> Any:
        raise NotImplementedError("Subclasses must implement forward()")

    def __call__(self, **kwargs) -> ToolOutput:
        try:
            result = self.forward(**kwargs)
            return ToolOutput(value=result)
        except Exception as e:
            return ToolOutput(value=None, error=str(e))


class CodeInterpreterTool(Tool):
    """Tool to execute Python code snippets safely."""
    name = "code_interpreter"
    description = "Executes Python code and returns the result"
    inputs = {"code": ToolInput("code", "Python code to execute")}
    output_type = "string"

    def forward(self, code: str) -> str:
        # Sandboxed execution (only allow safe operations)
        allowed_globals = {"__builtins__": {"print": print, "len": len, "range": range, "str": str, "int": int, "float": float, "list": list, "dict": dict, "sum": sum, "max": max, "min": min}}
        local_vars = {}
        exec(code, allowed_globals, local_vars)
        return str(local_vars.get("result", "Code executed successfully"))


class WebSearchTool(Tool):
    """Tool to search the web."""
    name = "web_search"
    description = "Searches the web for information"
    inputs = {"query": ToolInput("query", "Search query string")}
    output_type = "string"

    def __init__(self, search_client=None):
        self._client = search_client

    def forward(self, query: str) -> str:
        if self._client:
            return self._client.search(query)
        return f"Search results for: {query} (no client configured)"


class SmolAgent:
    """A lightweight agent using the smolagents pattern."""
    def __init__(self, tools: list[Tool], llm=None, max_steps: int = 10):
        self.tools = {t.name: t for t in tools}
        self.llm = llm
        self.max_steps = max_steps
        self._step_logs: list[dict] = []

    def add_tool(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def run(self, task: str) -> str:
        """Run the agent on a task."""
        if not self.llm:
            raise ValueError("LLM required to run agent")

        self._step_logs = []
        step = 0
        context = task

        while step < self.max_steps:
            response = self.llm.complete(
                f"Task: {context}\nAvailable tools: {list(self.tools.keys())}\nRespond with TOOL:<name>|ARGS:<args> or ANSWER:<final_answer>"
            )
            log = {"step": step, "llm_response": response}

            if response.startswith("ANSWER:"):
                final_answer = response[7:].strip()
                log["type"] = "final_answer"
                log["answer"] = final_answer
                self._step_logs.append(log)
                return final_answer
            elif response.startswith("TOOL:"):
                parts = response.split("|ARGS:")
                tool_name = parts[0][5:].strip()
                args_str = parts[1].strip() if len(parts) > 1 else ""
                log["type"] = "tool_call"
                log["tool"] = tool_name

                if tool_name in self.tools:
                    output = self.tools[tool_name](query=args_str)
                    log["tool_output"] = str(output.value)
                    context = f"{context}\nTool {tool_name} returned: {output.value}"

            self._step_logs.append(log)
            step += 1

        return "Max steps reached without final answer"

    @property
    def step_count(self) -> int:
        return len(self._step_logs)
