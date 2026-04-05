import type { Framework } from "@/components/frameworks/FrameworkCard";

export const frameworks: Framework[] = [
  // Python Frameworks
  {
    id: 1, name: "PydanticAI", language: "python",
    description: "Type-safe AI agents built on Pydantic v2. Define structured inputs/outputs with full Python type safety and validation.",
    tags: ["type-safe", "structured outputs", "async", "multi-model"],
    githubPath: "01-pydantic-ai",
    docsUrl: "https://ai.pydantic.dev",
  },
  {
    id: 2, name: "LangChain", language: "python",
    description: "The most popular LLM framework. Build chains, agents, and RAG pipelines with 100s of integrations.",
    tags: ["chains", "RAG", "tools", "memory", "ecosystem"],
    githubPath: "02-langchain",
    docsUrl: "https://python.langchain.com",
  },
  {
    id: 3, name: "LangGraph", language: "python",
    description: "Build stateful, multi-actor applications as graphs. Perfect for complex agent workflows with cycles.",
    tags: ["graphs", "stateful", "multi-agent", "ReAct"],
    githubPath: "03-langgraph",
    docsUrl: "https://langchain-ai.github.io/langgraph",
  },
  {
    id: 4, name: "LlamaIndex", language: "python",
    description: "Data framework for LLM applications. Build RAG systems, query engines, and data-augmented agents.",
    tags: ["RAG", "data", "indexing", "query engine"],
    githubPath: "04-llamaindex",
    docsUrl: "https://docs.llamaindex.ai",
  },
  {
    id: 5, name: "Google ADK", language: "python",
    description: "Google's Agent Development Kit for building production-ready agents with Gemini models.",
    tags: ["Google", "Gemini", "multi-agent", "sessions"],
    githubPath: "05-google-adk",
    docsUrl: "https://google.github.io/adk-docs",
  },
  {
    id: 6, name: "CrewAI", language: "python",
    description: "Framework for orchestrating role-playing, autonomous AI agents that work as a team.",
    tags: ["multi-agent", "roles", "collaboration", "tasks"],
    githubPath: "06-crewai",
    docsUrl: "https://docs.crewai.com",
  },
  {
    id: 7, name: "AutoGen", language: "python",
    description: "Microsoft's framework for building multi-agent conversational AI systems with code execution.",
    tags: ["Microsoft", "conversational", "code execution", "multi-agent"],
    githubPath: "07-autogen",
    docsUrl: "https://microsoft.github.io/autogen",
  },
  {
    id: 8, name: "Smolagents", language: "python",
    description: "HuggingFace's lightweight agent library. Minimal code, maximum capability with code agents.",
    tags: ["HuggingFace", "lightweight", "code agents", "tools"],
    githubPath: "08-smolagents",
    docsUrl: "https://huggingface.co/docs/smolagents",
  },
  {
    id: 9, name: "Agno", language: "python",
    description: "Fast, async-first agent framework (formerly Phidata). Built for production with structured outputs.",
    tags: ["async", "fast", "structured", "memory", "teams"],
    githubPath: "09-agno",
    docsUrl: "https://docs.agno.com",
  },
  {
    id: 10, name: "Semantic Kernel", language: "python",
    description: "Microsoft's enterprise AI SDK for orchestrating AI models, plugins, and planners.",
    tags: ["Microsoft", "enterprise", "plugins", "planners", "C#/Python"],
    githubPath: "10-semantic-kernel",
    docsUrl: "https://learn.microsoft.com/semantic-kernel",
  },
  // TypeScript Frameworks
  {
    id: 11, name: "Mastra", language: "typescript",
    description: "Modern TypeScript-first agent framework with workflows, integrations, and type-safe tools.",
    tags: ["TypeScript", "workflows", "integrations", "modern"],
    githubPath: "11-mastra",
    docsUrl: "https://mastra.ai/docs",
  },
  {
    id: 12, name: "Claude Agent SDK", language: "typescript",
    description: "Anthropic's official SDK for building agents with Claude. Full tool use and multi-turn support.",
    tags: ["Anthropic", "Claude", "tool use", "official"],
    githubPath: "12-claude-agent-sdk",
    docsUrl: "https://docs.anthropic.com",
  },
  {
    id: 13, name: "OpenAI Agents SDK", language: "typescript",
    description: "OpenAI's agent framework with Assistants API, function calling, and handoff patterns.",
    tags: ["OpenAI", "GPT-4o", "assistants", "handoffs"],
    githubPath: "13-openai-agents",
    docsUrl: "https://platform.openai.com/docs",
  },
  {
    id: 14, name: "Vercel AI SDK", language: "typescript",
    description: "Build streaming AI interfaces. Provider-agnostic with React hooks and server actions.",
    tags: ["streaming", "React", "Next.js", "provider-agnostic"],
    githubPath: "14-vercel-ai-sdk",
    docsUrl: "https://sdk.vercel.ai/docs",
  },
  {
    id: 15, name: "LangChain.js", language: "typescript",
    description: "JavaScript/TypeScript version of LangChain. Build chains and agents in Node.js or browser.",
    tags: ["chains", "RAG", "tools", "JavaScript"],
    githubPath: "15-langchain-js",
    docsUrl: "https://js.langchain.com",
  },
  {
    id: 16, name: "LangGraph.js", language: "typescript",
    description: "TypeScript graph-based agent framework. Build stateful multi-agent systems with cycles.",
    tags: ["graphs", "stateful", "TypeScript", "multi-agent"],
    githubPath: "16-langgraph-js",
    docsUrl: "https://langchain-ai.github.io/langgraphjs",
  },
  {
    id: 17, name: "Genkit", language: "typescript",
    description: "Google's Firebase AI framework for TypeScript. Flows, prompts, and Gemini integration.",
    tags: ["Google", "Firebase", "flows", "Gemini", "TypeScript"],
    githubPath: "17-genkit",
    docsUrl: "https://firebase.google.com/docs/genkit",
  },
  {
    id: 18, name: "Bee Agent Framework", language: "typescript",
    description: "IBM's open-source TypeScript agent framework. ReAct pattern with structured tool definitions.",
    tags: ["IBM", "ReAct", "open-source", "structured tools"],
    githubPath: "18-bee-agent-framework",
    docsUrl: "https://i-am-bee.github.io/bee-agent-framework",
  },
  // Orchestration
  {
    id: 19, name: "kagent", language: "orchestration",
    description: "Kubernetes-native agent orchestration. Define AI agents as K8s CRDs with GitOps workflows.",
    tags: ["Kubernetes", "CRDs", "GitOps", "cloud-native", "YAML"],
    githubPath: "19-kagent",
    docsUrl: "https://kagent.dev",
  },
  {
    id: 20, name: "Griptape", language: "python",
    description: "Enterprise Python framework for building reliable agent pipelines with fine-grained control.",
    tags: ["enterprise", "pipelines", "Python", "structured", "production"],
    githubPath: "20-griptape",
    docsUrl: "https://docs.griptape.ai",
  },
];

export const pythonFrameworks = frameworks.filter(f => f.language === "python");
export const typescriptFrameworks = frameworks.filter(f => f.language === "typescript");
export const orchestrationFrameworks = frameworks.filter(f => f.language === "orchestration");
