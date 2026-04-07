import Link from "next/link";
import { FrameworkCard } from "@/components/frameworks/FrameworkCard";
import { frameworks, pythonFrameworks, typescriptFrameworks, orchestrationFrameworks } from "@/data/frameworks";

export default function Home() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Agent Studio Banner */}
      <Link
        href="/studio"
        className="group flex items-center justify-between gap-4 mb-8 px-5 py-4 rounded-2xl
          bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950
          border border-indigo-700/50 hover:border-indigo-500/80 transition-all duration-200
          hover:shadow-lg hover:shadow-indigo-950/50"
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎮</span>
          <div>
            <div className="font-bold text-white text-sm">Agent Studio — 游戏化控制台 (NEW)</div>
            <div className="text-xs text-indigo-300/70">拖拽分配 Agent · 点击对话 · 语音下达指令 · AI 自动纠错专业术语</div>
          </div>
        </div>
        <span className="text-indigo-400 group-hover:text-white transition-colors text-sm font-medium flex-shrink-0">
          进入体验 →
        </span>
      </Link>

      {/* Hero */}
      <div className="text-center mb-16">
        <div className="text-6xl mb-4">🤖</div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Agent Frameworks Starter Collection
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
          Top 20 AI agent frameworks — ready-to-run starters with TDD tests.
          Python, TypeScript, and Kubernetes orchestration.
        </p>
        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
            All tests passing
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
            {frameworks.length} frameworks
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"></span>
            TDD approach
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-16">
        {[
          { label: "Python", count: pythonFrameworks.length, icon: "🐍", color: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950" },
          { label: "TypeScript", count: typescriptFrameworks.length, icon: "🟦", color: "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950" },
          { label: "Orchestration", count: orchestrationFrameworks.length + 1, icon: "⚙️", color: "border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl border p-6 text-center ${stat.color}`}>
            <div className="text-3xl mb-2">{stat.icon}</div>
            <div className="text-3xl font-bold">{stat.count}</div>
            <div className="text-sm text-muted-foreground mt-1">{stat.label} frameworks</div>
          </div>
        ))}
      </div>

      {/* Python Section */}
      <section id="python" className="mb-16 scroll-mt-20">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">🐍</span>
          <div>
            <h2 className="text-2xl font-bold">Python Frameworks</h2>
            <p className="text-muted-foreground text-sm">pip install · pytest · unittest.mock</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pythonFrameworks.map((fw) => (
            <FrameworkCard key={fw.id} framework={fw} />
          ))}
        </div>
      </section>

      {/* TypeScript Section */}
      <section id="typescript" className="mb-16 scroll-mt-20">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">🟦</span>
          <div>
            <h2 className="text-2xl font-bold">TypeScript Frameworks</h2>
            <p className="text-muted-foreground text-sm">npm install · vitest · vi.mock</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {typescriptFrameworks.map((fw) => (
            <FrameworkCard key={fw.id} framework={fw} />
          ))}
        </div>
      </section>

      {/* Orchestration Section */}
      <section id="orchestration" className="mb-16 scroll-mt-20">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">⚙️</span>
          <div>
            <h2 className="text-2xl font-bold">Orchestration & Infrastructure</h2>
            <p className="text-muted-foreground text-sm">Kubernetes · GitOps · Cloud-native</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orchestrationFrameworks.map((fw) => (
            <FrameworkCard key={fw.id} framework={fw} />
          ))}
        </div>
      </section>

      {/* TDD Section */}
      <section className="rounded-2xl border bg-card p-8 mb-8">
        <h2 className="text-xl font-bold mb-4">TDD Approach</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: "✅", title: "Tests First", desc: "Every framework has tests written before implementation, ensuring correctness by design." },
            { icon: "🔒", title: "No Real API Keys", desc: "All tests use mocks and fixtures — run the entire suite offline without any credentials." },
            { icon: "🚀", title: "Instant Runnable", desc: "Clone, install, run tests. Each starter is self-contained and works out of the box." },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div>
                <div className="font-semibold mb-1">{item.title}</div>
                <div className="text-sm text-muted-foreground">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Start */}
      <section className="rounded-2xl border bg-muted/30 p-8">
        <h2 className="text-xl font-bold mb-4">Quick Start</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">Python framework:</p>
            <pre className="bg-background rounded-lg p-4 text-sm overflow-x-auto border">
              <code>{`cd packages/python/01-pydantic-ai
pip install -r requirements.txt
python -m pytest tests/ -v`}</code>
            </pre>
          </div>
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">TypeScript framework:</p>
            <pre className="bg-background rounded-lg p-4 text-sm overflow-x-auto border">
              <code>{`cd packages/typescript/11-mastra
npm install
npm test`}</code>
            </pre>
          </div>
        </div>
      </section>
    </main>
  );
}
