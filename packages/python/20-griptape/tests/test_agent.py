"""TDD tests for Griptape agent framework."""
import pytest
from unittest.mock import MagicMock
from src.agent import ArtifactType, Artifact, BaseTool, PromptTask, ToolkitTask, Pipeline, GriptapeAgent


class TestArtifact:
    def test_create_text_artifact(self):
        a = Artifact(value="Hello", artifact_type=ArtifactType.TEXT)
        assert a.to_text() == "Hello"
        assert not a.is_error

    def test_error_artifact(self):
        a = Artifact(value="Error occurred", artifact_type=ArtifactType.ERROR)
        assert a.is_error

    def test_default_type_is_text(self):
        a = Artifact(value="test")
        assert a.artifact_type == ArtifactType.TEXT


class TestPromptTask:
    def test_requires_llm(self):
        task = PromptTask("Process: {input}")
        with pytest.raises(ValueError, match="LLM required"):
            task.run(Artifact(value="test"))

    def test_run_with_mock_llm(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "Processed result"
        task = PromptTask("Process: {input}", llm=mock_llm)
        result = task.run(Artifact(value="raw data"))
        assert result.value == "Processed result"
        mock_llm.complete.assert_called_with("Process: raw data")

    def test_stores_output(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "Output"
        task = PromptTask("{input}", llm=mock_llm)
        task.run(Artifact(value="input"))
        assert task.output is not None
        assert task.output.value == "Output"


class TestPipeline:
    def test_empty_pipeline(self):
        pipeline = Pipeline()
        assert pipeline.task_count == 0

    def test_add_task(self):
        pipeline = Pipeline()
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "ok"
        pipeline.add_task(PromptTask("{input}", llm=mock_llm))
        assert pipeline.task_count == 1

    def test_run_single_task(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "Processed"
        pipeline = Pipeline([PromptTask("{input}", llm=mock_llm)])
        result = pipeline.run("raw input")
        assert result.value == "Processed"

    def test_run_chained_tasks(self):
        mock_llm = MagicMock()
        mock_llm.complete.side_effect = ["step1_result", "final_result"]
        pipeline = Pipeline([
            PromptTask("Step1: {input}", llm=mock_llm),
            PromptTask("Step2: {input}", llm=mock_llm),
        ])
        result = pipeline.run("start")
        assert result.value == "final_result"
        assert mock_llm.complete.call_count == 2

    def test_fluent_add_task(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "ok"
        pipeline = (Pipeline()
            .add_task(PromptTask("{input}", llm=mock_llm))
            .add_task(PromptTask("{input}", llm=mock_llm)))
        assert pipeline.task_count == 2


class TestGriptapeAgent:
    def test_requires_llm(self):
        agent = GriptapeAgent()
        with pytest.raises(ValueError, match="LLM required"):
            agent.run("test")

    def test_run_with_mock_llm(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "Agent response"
        agent = GriptapeAgent(llm=mock_llm)
        result = agent.run("Hello")
        assert result.value == "Agent response"

    def test_tracks_conversation(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "Response"
        agent = GriptapeAgent(llm=mock_llm)
        agent.run("Message 1")
        agent.run("Message 2")
        assert agent.conversation_length == 4  # 2 user + 2 assistant

    def test_add_tool(self):
        class MyTool(BaseTool):
            name = "my_tool"
            description = "Test tool"
            def run(self, a): return a
        agent = GriptapeAgent()
        agent.add_tool(MyTool())
        assert "my_tool" in agent.tool_names
