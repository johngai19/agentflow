/**
 * agentWorker — drives autonomous agent execution when an agent enters a zone.
 *
 * Calls /api/agent-chat with a zone-triggered prompt, streams tool_use events
 * back, and keeps the Zustand store in sync so the UI stays live.
 *
 * Falls back to the local simulateWork() stub if the API is unavailable
 * (e.g. no ANTHROPIC_API_KEY set, or NEXT_PUBLIC_DEMO_MODE=true).
 */

import type { Agent, Zone } from '@/data/studioData'

interface WorkCallbacks {
  onStatus: (task: string) => void
  onProgress: (pct: number) => void
  onComplete: (summary: string) => void
  onError: () => void
  onMessage: (role: 'user' | 'assistant', content: string, toolEvents?: ToolEventCompact[]) => void
}

export interface ToolEventCompact {
  name: string
  input?: unknown
  output?: string
}

// Zone → autonomous work prompt
function zonePrompt(zone: Zone): string {
  const prompts: Record<string, string> = {
    cron:   '你已进入「定时巡检室」，请立刻开始一轮自动巡检。选择最合适的工具执行巡检任务，完成后输出简洁的巡检报告。',
    aliyun: '你已进入「阿里云区域」，请查询并分析云资源状态（ECS/VPC/RDS），找出异常或优化点，输出简洁报告。',
    deploy: '你已进入「部署流水线」，请检查 CI/CD 状态、K8s 集群健康度，若有问题给出修复建议。',
  }
  return prompts[zone.id] ?? `你已进入「${zone.name}」，请开始执行最合适的工作任务并给出结果报告。`
}

export async function runAgentInZone(
  agent: Agent,
  zone: Zone,
  callbacks: WorkCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

  if (isDemoMode) {
    // Demo mode: simulate with realistic fake output
    await runDemoWork(agent, zone, callbacks, signal)
    return
  }

  callbacks.onStatus('连接中...')
  callbacks.onProgress(5)

  const prompt = zonePrompt(zone)

  try {
    const res = await fetch('/api/agent-chat', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        agent: {
          name: agent.name,
          role: agent.role,
          personality: agent.personality,
          tools: agent.tools,
          completedTasks: agent.completedTasks,
        },
        zone: { name: zone.name },
      }),
    })

    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    let fullText = ''
    const tools: ToolEventCompact[] = []
    let progress = 10

    callbacks.onProgress(progress)

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (signal?.aborted) { reader.cancel(); break }

      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const ev = JSON.parse(line)
          if (ev.type === 'text') {
            fullText += ev.text
            progress = Math.min(85, progress + 5)
            callbacks.onProgress(progress)
          } else if (ev.type === 'tool_start') {
            tools.push({ name: ev.name, input: ev.input })
            callbacks.onStatus(`调用 ${ev.name}...`)
          } else if (ev.type === 'tool_result') {
            const t = tools.find(t => t.name === ev.name && !t.output)
            if (t) t.output = ev.output
            callbacks.onStatus(`${ev.name} 完成`)
            progress = Math.min(90, progress + 8)
            callbacks.onProgress(progress)
          } else if (ev.type === 'done') {
            callbacks.onProgress(100)
          }
        } catch { /* skip malformed line */ }
      }
    }

    const summary = fullText.split('\n')[0]?.slice(0, 60) ?? '任务完成'
    callbacks.onMessage('assistant', fullText || '任务已执行完毕。', tools)
    callbacks.onComplete(summary)
  } catch (err) {
    if (signal?.aborted) return
    const isNetworkError = err instanceof TypeError
    if (isNetworkError) {
      // API not reachable — fall back to demo mode
      await runDemoWork(agent, zone, callbacks, signal)
    } else {
      callbacks.onError()
    }
  }
}

// ── Demo / fallback simulation ────────────────────────────────────────────────
const DEMO_RESPONSES: Record<string, string[]> = {
  cron: [
    '✅ 定时巡检完成\n\n**SSL证书**: 3个域名，最近到期 87天 (api.example.com)\n**日志清理**: 释放 2.3GB 磁盘空间\n**安全扫描**: 未发现新漏洞\n\n巡检正常，下次执行: 6小时后',
    '✅ 资源使用报告\n\nCPU平均: 34% | 峰值: 71%\n内存: 68% 已用\n磁盘: 45% 已用\n网络出口: 正常\n\n所有指标在阈值内，系统健康。',
  ],
  aliyun: [
    '☁️ 阿里云资源巡检\n\n**ECS实例** (3/3 运行中)\n- i-bp1a1234 (ecs.c6.xlarge): CPU 45% 正常\n- i-bp1b5678 (ecs.g6.large): CPU 12% 可考虑降配\n\n**RDS**: 连接数 24/200, 正常\n**OSS存储**: 已用 234GB / 500GB\n\n💡 建议: i-bp1b5678 可降配节省 ¥800/月',
    '📊 成本分析报告\n\n本月已用: ¥14,230\n- ECS: ¥8,100 (57%)\n- RDS: ¥3,200 (22%)\n- OSS: ¥1,400 (10%)\n\n🔴 发现2台闲置ECS\n💡 开启预留实例可节省 ¥3,600/月',
  ],
  deploy: [
    '🚀 部署流水线状态\n\n**最近部署**: web-frontend v2.3.1 — ✅ 成功 (12分钟前)\n**K8s集群**: 3节点全部 Ready\n**Pod状态**: 8/8 Running\n\n```\nNAME              READY   STATUS\nweb-7d9-xk2pl     1/1     Running\napi-5c6-m8nqr     1/1     Running\n```\n\n流水线健康，无需干预。',
  ],
}

async function runDemoWork(
  agent: Agent,
  zone: Zone,
  callbacks: WorkCallbacks,
  signal?: AbortSignal,
) {
  const steps = [
    { pct: 10, task: '初始化任务...' },
    { pct: 30, task: `调用 ${agent.tools[0] ?? 'api'}...` },
    { pct: 60, task: '处理数据...' },
    { pct: 85, task: '生成报告...' },
  ]
  const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
  const stepMs = 1200 + Math.random() * 800

  for (const step of steps) {
    if (signal?.aborted) return
    callbacks.onStatus(step.task)
    callbacks.onProgress(step.pct)
    await delay(stepMs)
  }

  const responses = DEMO_RESPONSES[zone.id] ?? ['任务执行完成。']
  const content = responses[Math.floor(Math.random() * responses.length)]
  const summary = content.split('\n')[0].replace(/[✅☁️🚀📊💡🔴]/g, '').trim().slice(0, 50)

  callbacks.onProgress(100)
  callbacks.onMessage('assistant', content)
  callbacks.onComplete(summary)
}
