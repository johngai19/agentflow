"""TDD tests for LangGraph state graph implementation."""
import pytest
from src.agent import (
    NodeStatus, AgentState, GraphNode, ConditionalEdge,
    StateGraph, CompiledGraph
)


def make_state(**kwargs) -> AgentState:
    return AgentState(
        messages=kwargs.get("messages", []),
        current_step=kwargs.get("current_step", ""),
        context=kwargs.get("context", {}),
        final_answer=kwargs.get("final_answer", None),
    )


class TestGraphNode:
    def test_node_initial_status(self):
        node = GraphNode("test", lambda s: s)
        assert node.status == NodeStatus.PENDING

    def test_node_execute_changes_status(self):
        node = GraphNode("test", lambda s: s)
        state = make_state()
        node.execute(state)
        assert node.status == NodeStatus.COMPLETED

    def test_node_execute_returns_modified_state(self):
        def add_message(state):
            state["messages"].append({"role": "system", "content": "processed"})
            return state

        node = GraphNode("add_msg", add_message)
        state = make_state()
        result = node.execute(state)
        assert len(result["messages"]) == 1

    def test_node_execute_marks_failed_on_error(self):
        def failing_func(state):
            raise RuntimeError("Node failed")

        node = GraphNode("failing", failing_func)
        with pytest.raises(RuntimeError):
            node.execute(make_state())
        assert node.status == NodeStatus.FAILED


class TestConditionalEdge:
    def test_routes_based_on_condition(self):
        edge = ConditionalEdge(
            condition=lambda s: "done" if s["final_answer"] else "continue",
            routes={"done": "end", "continue": "process"}
        )
        state_done = make_state(final_answer="42")
        state_continue = make_state()
        assert edge.next_node(state_done) == "end"
        assert edge.next_node(state_continue) == "process"

    def test_default_route_is_end(self):
        edge = ConditionalEdge(
            condition=lambda s: "unknown_key",
            routes={"known": "target"}
        )
        assert edge.next_node(make_state()) == "end"


class TestStateGraph:
    def test_add_node(self):
        graph = StateGraph(AgentState)
        graph.add_node("process", lambda s: s)
        assert "process" in graph.nodes

    def test_add_edge(self):
        graph = StateGraph(AgentState)
        graph.add_edge("a", "b")
        assert graph.edges["a"] == "b"

    def test_compile_requires_entry_point(self):
        graph = StateGraph(AgentState)
        graph.add_node("node1", lambda s: s)
        with pytest.raises(ValueError, match="Entry point must be set"):
            graph.compile()

    def test_compile_succeeds_with_entry_point(self):
        graph = StateGraph(AgentState)
        graph.add_node("start", lambda s: s)
        graph.set_entry_point("start")
        compiled = graph.compile()
        assert isinstance(compiled, CompiledGraph)


class TestCompiledGraph:
    def test_invoke_simple_graph(self):
        def process(state):
            state["final_answer"] = "computed"
            return state

        graph = StateGraph(AgentState)
        graph.add_node("process", process)
        graph.set_entry_point("process")
        compiled = graph.compile()

        result = compiled.invoke(make_state())
        assert result["final_answer"] == "computed"
        assert result["current_step"] == "process"

    def test_invoke_multi_step_graph(self):
        steps = []

        def step1(state):
            steps.append("step1")
            state["context"]["step1"] = True
            return state

        def step2(state):
            steps.append("step2")
            state["final_answer"] = "done"
            return state

        graph = StateGraph(AgentState)
        graph.add_node("step1", step1)
        graph.add_node("step2", step2)
        graph.add_edge("step1", "step2")
        graph.set_entry_point("step1")
        compiled = graph.compile()

        result = compiled.invoke(make_state())
        assert steps == ["step1", "step2"]
        assert result["final_answer"] == "done"

    def test_invoke_with_conditional_routing(self):
        def router(state):
            return "needs_search" if not state["context"].get("searched") else "answer"

        def search(state):
            state["context"]["searched"] = True
            state["context"]["results"] = ["result1"]
            return state

        def answer(state):
            state["final_answer"] = "Found: " + str(state["context"]["results"])
            return state

        graph = StateGraph(AgentState)
        graph.add_node("route", lambda s: s)
        graph.add_node("search", search)
        graph.add_node("answer", answer)
        graph.add_conditional_edges("route", router, {"needs_search": "search", "answer": "answer"})
        graph.add_edge("search", "answer")
        graph.set_entry_point("route")
        compiled = graph.compile()

        result = compiled.invoke(make_state())
        assert "Found:" in result["final_answer"]
