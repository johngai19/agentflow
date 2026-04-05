"""TDD tests for LlamaIndex RAG agent."""
import pytest
from unittest.mock import MagicMock
from src.agent import Document, NodeWithScore, VectorIndex, Retriever, QueryEngine, RAGAgent


class TestDocument:
    def test_create_document(self):
        doc = Document(text="Hello world", metadata={"source": "test"}, doc_id="doc1")
        assert doc.text == "Hello world"
        assert doc.metadata["source"] == "test"
        assert doc.doc_id == "doc1"

    def test_document_default_metadata(self):
        doc = Document(text="Hello")
        assert doc.metadata == {}
        assert doc.doc_id == ""


class TestVectorIndex:
    def test_insert_document(self):
        index = VectorIndex()
        doc = Document(text="test document")
        index.insert(doc)
        assert index.document_count == 1

    def test_insert_many(self):
        index = VectorIndex()
        docs = [Document(text=f"doc {i}") for i in range(5)]
        index.insert_many(docs)
        assert index.document_count == 5

    def test_as_retriever(self):
        index = VectorIndex()
        retriever = index.as_retriever(similarity_top_k=2)
        assert isinstance(retriever, Retriever)
        assert retriever.similarity_top_k == 2


class TestRetriever:
    def setup_method(self):
        self.index = VectorIndex()
        self.index.insert_many([
            Document(text="Python is a programming language", metadata={"topic": "python"}),
            Document(text="JavaScript is used for web development", metadata={"topic": "js"}),
            Document(text="Machine learning with Python", metadata={"topic": "ml"}),
        ])
        self.retriever = self.index.as_retriever(similarity_top_k=2)

    def test_retrieve_returns_nodes(self):
        results = self.retriever.retrieve("Python programming")
        assert len(results) <= 2
        assert all(isinstance(n, NodeWithScore) for n in results)

    def test_retrieve_ranks_by_relevance(self):
        results = self.retriever.retrieve("Python")
        # Python-related docs should score higher
        assert len(results) > 0
        assert "Python" in results[0].text or "python" in results[0].text.lower()

    def test_retrieve_limits_by_top_k(self):
        retriever = self.index.as_retriever(similarity_top_k=1)
        results = retriever.retrieve("any query")
        assert len(results) <= 1


class TestQueryEngine:
    def test_query_without_llm(self):
        index = VectorIndex()
        index.insert(Document(text="Python is great for AI development"))
        retriever = index.as_retriever()
        engine = QueryEngine(retriever=retriever)
        result = engine.query("Python AI")
        assert "Python" in result

    def test_query_with_mock_llm(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "Python is a great language for AI."
        index = VectorIndex()
        index.insert(Document(text="Python programming"))
        retriever = index.as_retriever()
        engine = QueryEngine(retriever=retriever, llm=mock_llm)
        result = engine.query("Python")
        assert result == "Python is a great language for AI."
        mock_llm.complete.assert_called_once()

    def test_query_empty_index(self):
        index = VectorIndex()
        retriever = index.as_retriever()
        engine = QueryEngine(retriever=retriever)
        result = engine.query("anything")
        assert "No relevant" in result


class TestRAGAgent:
    def test_requires_documents_before_asking(self):
        agent = RAGAgent()
        with pytest.raises(ValueError, match="No documents loaded"):
            agent.ask("any question")

    def test_document_count_after_load(self):
        agent = RAGAgent()
        docs = [Document(text=f"doc {i}") for i in range(3)]
        agent.load_documents(docs)
        assert agent.document_count == 3

    def test_ask_returns_answer(self):
        agent = RAGAgent()
        agent.load_documents([
            Document(text="LlamaIndex is a data framework for LLM applications"),
            Document(text="RAG stands for Retrieval Augmented Generation"),
        ])
        answer = agent.ask("What is LlamaIndex?")
        assert isinstance(answer, str)
        assert len(answer) > 0

    def test_ask_with_mock_llm(self):
        mock_llm = MagicMock()
        mock_llm.complete.return_value = "LlamaIndex is an AI framework."
        agent = RAGAgent(llm=mock_llm)
        agent.load_documents([Document(text="LlamaIndex framework for building AI")])
        answer = agent.ask("What is LlamaIndex?")
        assert answer == "LlamaIndex is an AI framework."
