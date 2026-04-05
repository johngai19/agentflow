"""Semantic Kernel starter - Microsoft's AI orchestration framework."""
from dataclasses import dataclass, field
from typing import Any, Callable
from enum import Enum


@dataclass
class KernelArguments:
    """Arguments passed to kernel functions."""
    _args: dict = field(default_factory=dict)

    def __init__(self, **kwargs):
        self._args = kwargs

    def get(self, key: str, default: Any = None) -> Any:
        return self._args.get(key, default)

    def __getitem__(self, key: str) -> Any:
        return self._args[key]

    def __contains__(self, key: str) -> bool:
        return key in self._args


@dataclass
class FunctionResult:
    """Result from a kernel function invocation."""
    value: Any
    function_name: str
    plugin_name: str = ""
    metadata: dict = field(default_factory=dict)

    def __str__(self) -> str:
        return str(self.value)


class KernelFunction:
    """A function registered in the semantic kernel."""
    def __init__(self, name: str, plugin_name: str, func: Callable, description: str = ""):
        self.name = name
        self.plugin_name = plugin_name
        self._func = func
        self.description = description

    def invoke(self, arguments: KernelArguments) -> FunctionResult:
        result = self._func(arguments)
        return FunctionResult(value=result, function_name=self.name, plugin_name=self.plugin_name)


class KernelPlugin:
    """A plugin containing related kernel functions."""
    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description
        self._functions: dict[str, KernelFunction] = {}

    def add_function(self, func: KernelFunction) -> None:
        self._functions[func.name] = func

    def get_function(self, name: str) -> KernelFunction | None:
        return self._functions.get(name)

    @property
    def function_names(self) -> list[str]:
        return list(self._functions.keys())


class Kernel:
    """The Semantic Kernel - orchestrates AI models and plugins."""
    def __init__(self):
        self._plugins: dict[str, KernelPlugin] = {}
        self._services: dict[str, Any] = {}

    def add_plugin(self, plugin: KernelPlugin) -> None:
        self._plugins[plugin.name] = plugin

    def add_service(self, service_id: str, service: Any) -> None:
        self._services[service_id] = service

    def get_plugin(self, name: str) -> KernelPlugin | None:
        return self._plugins.get(name)

    def get_service(self, service_id: str) -> Any | None:
        return self._services.get(service_id)

    async def invoke(self, plugin_name: str, function_name: str,
                     arguments: KernelArguments | None = None) -> FunctionResult:
        plugin = self.get_plugin(plugin_name)
        if not plugin:
            raise KeyError(f"Plugin '{plugin_name}' not found")
        func = plugin.get_function(function_name)
        if not func:
            raise KeyError(f"Function '{function_name}' not found in plugin '{plugin_name}'")
        return func.invoke(arguments or KernelArguments())

    def invoke_sync(self, plugin_name: str, function_name: str,
                    arguments: KernelArguments | None = None) -> FunctionResult:
        plugin = self.get_plugin(plugin_name)
        if not plugin:
            raise KeyError(f"Plugin '{plugin_name}' not found")
        func = plugin.get_function(function_name)
        if not func:
            raise KeyError(f"Function '{function_name}' not found in plugin '{plugin_name}'")
        return func.invoke(arguments or KernelArguments())

    @property
    def plugin_count(self) -> int:
        return len(self._plugins)
