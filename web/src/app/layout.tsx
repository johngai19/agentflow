import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Agent Frameworks Starter Collection",
  description: "Top 20 AI agent frameworks — TDD starters for Python, TypeScript, and Kubernetes orchestration.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.variable)}>
        <TopNavbar />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
