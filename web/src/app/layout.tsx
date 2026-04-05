import type { Metadata } from "next";
import "./globals.css";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Agent Frameworks Starter Collection",
  description: "Top 20 AI agent frameworks — TDD starters for Python, TypeScript, and Kubernetes orchestration.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <TopNavbar />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
