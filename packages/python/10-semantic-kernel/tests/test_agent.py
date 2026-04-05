"""TDD tests for Semantic Kernel orchestration."""
import pytest
import asyncio
from src.agent import KernelArguments, FunctionResult, KernelFunction, KernelPlugin, Kernel


class TestKernelArguments:
    def test_create_arguments(self):
        args = KernelArguments(name="Alice", age=30)
        assert args.get("name") == "Alice"
        assert args.get("age") == 30

    def test_get_with_default(self):
        args = KernelArguments(name="Bob")
        assert args.get("missing", "default") == "default"

    def test_contains_key(self):
        args = KernelArguments(key="value")
        assert "key" in args
        assert "other" not in args


class TestFunctionResult:
    def test_create_result(self):
        result = FunctionResult(value="Hello", function_name="greet", plugin_name="TextPlugin")
        assert result.value == "Hello"
        assert result.function_name == "greet"

    def test_str_representation(self):
        result = FunctionResult(value=42, function_name="calc")
        assert str(result) == "42"


class TestKernelFunction:
    def test_invoke_function(self):
        def greet(args: KernelArguments) -> str:
            name = args.get("name", "World")
            return f"Hello, {name}!"

        func = KernelFunction("greet", "TextPlugin", greet, "Greets a person")
        args = KernelArguments(name="Alice")
        result = func.invoke(args)
        assert result.value == "Hello, Alice!"
        assert result.function_name == "greet"


class TestKernelPlugin:
    def test_add_and_get_function(self):
        plugin = KernelPlugin("MathPlugin", "Math operations")
        func = KernelFunction("add", "MathPlugin", lambda args: args.get("a") + args.get("b"))
        plugin.add_function(func)
        retrieved = plugin.get_function("add")
        assert retrieved is not None
        assert retrieved.name == "add"

    def test_function_names(self):
        plugin = KernelPlugin("TestPlugin")
        plugin.add_function(KernelFunction("func1", "TestPlugin", lambda a: a))
        plugin.add_function(KernelFunction("func2", "TestPlugin", lambda a: a))
        assert "func1" in plugin.function_names
        assert "func2" in plugin.function_names


class TestKernel:
    def make_kernel_with_plugin(self):
        kernel = Kernel()
        plugin = KernelPlugin("MathPlugin")
        plugin.add_function(KernelFunction(
            "add", "MathPlugin",
            lambda args: args.get("a", 0) + args.get("b", 0)
        ))
        kernel.add_plugin(plugin)
        return kernel

    def test_add_and_get_plugin(self):
        kernel = Kernel()
        plugin = KernelPlugin("TestPlugin")
        kernel.add_plugin(plugin)
        assert kernel.get_plugin("TestPlugin") is not None

    def test_plugin_count(self):
        kernel = self.make_kernel_with_plugin()
        assert kernel.plugin_count == 1

    def test_add_service(self):
        from unittest.mock import MagicMock
        kernel = Kernel()
        mock_llm = MagicMock()
        kernel.add_service("azure_openai", mock_llm)
        assert kernel.get_service("azure_openai") is mock_llm

    def test_invoke_sync(self):
        kernel = self.make_kernel_with_plugin()
        result = kernel.invoke_sync("MathPlugin", "add", KernelArguments(a=3, b=4))
        assert result.value == 7

    def test_invoke_async(self):
        kernel = self.make_kernel_with_plugin()
        result = asyncio.run(kernel.invoke("MathPlugin", "add", KernelArguments(a=10, b=5)))
        assert result.value == 15

    def test_invoke_missing_plugin_raises(self):
        kernel = Kernel()
        with pytest.raises(KeyError, match="not found"):
            kernel.invoke_sync("NonExistent", "func")

    def test_invoke_missing_function_raises(self):
        kernel = Kernel()
        kernel.add_plugin(KernelPlugin("EmptyPlugin"))
        with pytest.raises(KeyError, match="not found"):
            kernel.invoke_sync("EmptyPlugin", "nonexistent_func")
