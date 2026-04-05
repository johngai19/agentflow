import Link from "next/link";

export interface Framework {
  id: number;
  name: string;
  description: string;
  language: "python" | "typescript" | "orchestration";
  tags: string[];
  githubPath: string;
  docsUrl?: string;
  stars?: string;
}

const languageBadgeColor: Record<Framework["language"], string> = {
  python: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  typescript: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  orchestration: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const languageIcon: Record<Framework["language"], string> = {
  python: "🐍",
  typescript: "🟦",
  orchestration: "⚙️",
};

export function FrameworkCard({ framework }: { framework: Framework }) {
  return (
    <div className="group relative flex flex-col rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{languageIcon[framework.language]}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${languageBadgeColor[framework.language]}`}>
            {framework.language}
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">#{framework.id.toString().padStart(2, "0")}</span>
      </div>

      <h3 className="font-semibold text-base mb-1.5 group-hover:text-primary transition-colors">
        {framework.name}
      </h3>
      <p className="text-sm text-muted-foreground flex-1 mb-3 leading-relaxed">
        {framework.description}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {framework.tags.map((tag) => (
          <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <a
          href={`https://github.com/johngai19/nextjskickstart/tree/claude/agent-frameworks-starter-L0IVQ/packages/${framework.language}/${framework.githubPath}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>📁</span> View Code
        </a>
        {framework.docsUrl && (
          <>
            <span className="text-muted-foreground">·</span>
            <a
              href={framework.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>📖</span> Docs
            </a>
          </>
        )}
      </div>
    </div>
  );
}
