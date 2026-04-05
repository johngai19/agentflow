"""LangGraph starter - Graph-based stateful agent workflows."""
from typing import Any, TypedDict, Callable
from enum import Enum


class NodeStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentState(TypedDict):
    """State that flows through the graph."""
    messages: list[dict]
    current_step: str
    context: dict
    final_answer: str | None


class GraphNode:
    """A node in the agent graph."""
    def __init__(self, name: str, func: Callable[[AgentState], AgentState]):
        self.name = name
        self.func = func
        self.status = NodeStatus.PENDING

    def execute(self, state: AgentState) -> AgentState:
        self.status = NodeStatus.RUNNING
        try:
            result = self.func(state)
            self.status = NodeStatus.COMPLETED
            return result
        except Exception:
            self.status = NodeStatus.FAILED
            raise


class ConditionalEdge:
    """Routes between graph nodes based on state."""
    def __init__(self, condition: Callable[[AgentState], str], routes: dict[str, str]):
        self.condition = condition
        self.routes = routes

    def next_node(self, state: AgentState) -> str:
        key = self.condition(state)
        return self.routes.get(key, "end")


class StateGraph:
    """A directed graph for agent state machines."""
    def __init__(self, state_schema: type):
        self.state_schema = state_schema
        self.nodes: dict[str, GraphNode] = {}
        self.edges: dict[str, str | ConditionalEdge] = {}
        self.entry_point: str | None = None

    def add_node(self, name: str, func: Callable) -> None:
        self.nodes[name] = GraphNode(name, func)

    def add_edge(self, from_node: str, to_node: str) -> None:
        self.edges[from_node] = to_node

    def add_conditional_edges(self, from_node: str, condition: Callable, routes: dict) -> None:
        self.edges[from_node] = ConditionalEdge(condition, routes)

    def set_entry_point(self, node_name: str) -> None:
        self.entry_point = node_name

    def compile(self) -> "CompiledGraph":
        if not self.entry_point:
            raise ValueError("Entry point must be set before compiling")
        return CompiledGraph(self)


class CompiledGraph:
    """A compiled, executable graph."""
    def __init__(self, graph: StateGraph):
        self.graph = graph

    def invoke(self, initial_state: AgentState) -> AgentState:
        state = initial_state.copy()
        current = self.graph.entry_point
        visited = set()
        max_steps = 50

        while current and current != "end" and len(visited) < max_steps:
            if current not in self.graph.nodes:
                break
            node = self.graph.nodes[current]
            state = node.execute(state)
            visited.add(current)
            state["current_step"] = current

            edge = self.graph.edges.get(current)
            if edge is None:
                break
            elif isinstance(edge, ConditionalEdge):
                current = edge.next_node(state)
            else:
                current = edge

        return state
