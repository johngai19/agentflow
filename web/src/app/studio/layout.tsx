import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Agent Studio — 游戏化 Agent 控制台',
  description: '拖拽分配 AI Agent，语音下达指令，实时监控工作状态',
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
