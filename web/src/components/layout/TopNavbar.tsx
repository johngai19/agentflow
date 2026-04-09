"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

export function TopNavbar() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="text-2xl">🤖</span>
            <span>Agent Starters</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/#python" className="text-muted-foreground hover:text-foreground transition-colors">Python</Link>
            <Link href="/#typescript" className="text-muted-foreground hover:text-foreground transition-colors">TypeScript</Link>
            <Link href="/#orchestration" className="text-muted-foreground hover:text-foreground transition-colors">Orchestration</Link>
            <Link href="/studio" className="text-muted-foreground hover:text-foreground transition-colors">Studio</Link>
            <Link href="/orchestrations" className="text-muted-foreground hover:text-foreground transition-colors">编排</Link>
            <Link href="/agents" className="text-muted-foreground hover:text-foreground transition-colors">Agents</Link>
            <Link href="/projects" className="text-muted-foreground hover:text-foreground transition-colors">Projects</Link>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="/workflows/runs" className="text-muted-foreground hover:text-foreground transition-colors">Runs</Link>
            <Link href="/workflows/designer" className="text-muted-foreground hover:text-foreground transition-colors">Designer</Link>
            <Link href="/audit" className="text-muted-foreground hover:text-foreground transition-colors">审计</Link>
            <a
              href="https://github.com/johngai19/nextjskickstart"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <NotificationCenter />
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
}
