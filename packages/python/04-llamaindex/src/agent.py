"""LlamaIndex starter - Data-augmented agents with RAG capabilities."""
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Document:
    """A document for indexing."""
    text: str
    metadata: dict = field(default_factory=dict)
    doc_id: str = ""


@dataclass
class NodeWithScore:
    """A retrieved node with similarity score."""
    text: str
    score: float
    metadata: dict = field(default_factory=dict)


class VectorIndex:
    """Simple in-memory vector index for documents."""
    def __init__(self, embed_model=None):
        self._documents: list[Document] = []
        self._embed_model = embed_model

    def insert(self, document: Document) -> None:
        """Add a document to the index."""
        self._documents.append(document)

    def insert_many(self, documents: list[Document]) -> None:
        for doc in documents:
            self.insert(doc)

    def as_retriever(self, similarity_top_k: int = 3) -> "Retriever":
        return Retriever(self, similarity_top_k=similarity_top_k)

    @property
    def document_count(self) -> int:
        return len(self._documents)


class Retriever:
    """Retrieves relevant nodes from an index."""
    def __init__(self, index: VectorIndex, similarity_top_k: int = 3):
        self.index = index
        self.similarity_top_k = similarity_top_k

    def retrieve(self, query: str) -> list[NodeWithScore]:
        """Retrieve relevant documents for a query."""
        docs = self.index._documents
        # Simple keyword matching (production would use embeddings)
        scored = []
        query_words = set(query.lower().split())
        for doc in docs:
            doc_words = set(doc.text.lower().split())
            overlap = len(query_words & doc_words)
            score = overlap / max(len(query_words), 1)
            scored.append(NodeWithScore(text=doc.text, score=score, metadata=doc.metadata))

        scored.sort(key=lambda x: x.score, reverse=True)
        return scored[:self.similarity_top_k]


class QueryEngine:
    """Query engine that retrieves and synthesizes answers."""
    def __init__(self, retriever: Retriever, llm=None):
        self.retriever = retriever
        self.llm = llm

    def query(self, question: str) -> str:
        """Query the index and generate an answer."""
        nodes = self.retriever.retrieve(question)
        context = "\n".join(n.text for n in nodes)

        if self.llm:
            prompt = f"Context:\n{context}\n\nQuestion: {question}\nAnswer:"
            return self.llm.complete(prompt)

        if nodes:
            return f"Based on retrieved context: {nodes[0].text[:200]}"
        return "No relevant information found."


class RAGAgent:
    """A Retrieval-Augmented Generation agent using LlamaIndex."""
    def __init__(self, llm=None):
        self.llm = llm
        self._index = VectorIndex()
        self._query_engine: QueryEngine | None = None

    def load_documents(self, documents: list[Document]) -> None:
        """Load documents into the index."""
        self._index.insert_many(documents)
        retriever = self._index.as_retriever(similarity_top_k=3)
        self._query_engine = QueryEngine(retriever=retriever, llm=self.llm)

    def ask(self, question: str) -> str:
        """Ask a question against loaded documents."""
        if not self._query_engine:
            raise ValueError("No documents loaded. Call load_documents() first.")
        return self._query_engine.query(question)

    @property
    def document_count(self) -> int:
        return self._index.document_count
