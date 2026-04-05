# LlamaIndex Agent Starter

LlamaIndex (formerly GPT Index) is a data framework purpose-built for connecting LLMs to your own data through Retrieval-Augmented Generation (RAG). While LangChain is a general-purpose orchestration framework, LlamaIndex specializes in the indexing and retrieval pipeline: ingesting documents from diverse sources, chunking them intelligently, embedding them into vector stores, and retrieving the most relevant chunks at query time. This specialization makes it the go-to choice when building knowledge bases, document Q&A systems, and enterprise search applications.

LlamaIndex's architecture centers around three key abstractions: `Document` (the raw content), `Index` (the structured representation for retrieval), and `QueryEngine` (the synthesis layer that turns retrieved chunks into answers). The framework supports dozens of vector store backends, embedding models, and LLM providers, making it straightforward to swap components without restructuring your entire pipeline. Its node-based retrieval system gives fine-grained control over chunking, metadata filtering, and re-ranking.

This starter demonstrates a `RAGAgent` that loads documents into an in-memory `VectorIndex`, performs keyword-scored retrieval via a `Retriever`, and synthesizes answers using a `QueryEngine`. An injectable LLM client pattern keeps all tests runnable without API credentials.

## Installation

```bash
pip install -r requirements.txt
```

## Running Tests

```bash
python -m pytest tests/ -v
```

## Running with Coverage

```bash
python -m pytest tests/ -v --cov=src --cov-report=term-missing
```

## Project Structure

```
04-llamaindex/
├── src/
│   └── agent.py        # Document, VectorIndex, Retriever, QueryEngine, RAGAgent
├── tests/
│   └── test_agent.py   # TDD tests using mocks (no API key needed)
├── pyproject.toml
├── requirements.txt
└── README.md
```
