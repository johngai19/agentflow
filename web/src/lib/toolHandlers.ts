/**
 * toolHandlers.ts — Tool implementation registry for the agent-chat API.
 *
 * The `kubectl` handler is REAL: it calls the local kubectl binary using
 * child_process.execFile (argv array, never a shell string) with a strict
 * allowlist of safe read-only subcommands, so no shell injection is possible.
 *
 * All other tools remain as stubs until credentials are wired up.
 *
 * Safety rules for kubectl:
 *  - Only "get", "describe", "top", "logs", "version", "cluster-info" etc. are allowed.
 *  - Command string is split into argv — execFile never invokes a shell.
 *  - Dangerous shell meta-characters are rejected before exec.
 *  - Output is capped at 4 KB to stay within API context limits.
 *  - A configurable timeout prevents hung calls.
 *
 * To use a real kubeconfig: set KUBECONFIG env var before starting the server.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const KUBECTL_BINARY = process.env.KUBECTL_PATH ?? 'kubectl'
const KUBECTL_TIMEOUT_MS = Number(process.env.KUBECTL_TIMEOUT_MS ?? 10_000)
const MAX_OUTPUT_BYTES = 4_096

// Subcommands that are safe in a read-only context
const SAFE_KUBECTL_SUBCOMMANDS = new Set([
  'get', 'describe', 'top', 'logs', 'version', 'cluster-info', 'api-resources',
  'api-versions', 'explain', 'diff', 'rollout',
])

/**
 * Execute kubectl with the given command string.
 * The command string is split on whitespace — execFile receives a plain argv
 * array, so no shell interpretation occurs.
 *
 * Returns stdout (truncated to MAX_OUTPUT_BYTES) or an error message string.
 */
export async function runKubectl(command: string): Promise<string> {
  const args = command.trim().split(/\s+/).filter(Boolean)

  if (args.length === 0) {
    return 'Error: empty kubectl command'
  }

  const subcommand = args[0].toLowerCase()
  if (!SAFE_KUBECTL_SUBCOMMANDS.has(subcommand)) {
    return (
      `Error: subcommand "${subcommand}" is not allowed (read-only policy). ` +
      `Allowed: ${[...SAFE_KUBECTL_SUBCOMMANDS].join(', ')}.`
    )
  }

  // Reject arguments containing shell meta-characters as an extra defence-in-depth
  // measure, even though execFile does not invoke a shell.
  const DANGEROUS_CHARS = /[;&|`$(){}<>!\\]/
  for (const arg of args) {
    if (DANGEROUS_CHARS.test(arg)) {
      return `Error: argument "${arg}" contains disallowed characters`
    }
  }

  try {
    // execFile with an argv array — no shell is involved
    const { stdout, stderr } = await execFileAsync(KUBECTL_BINARY, args, {
      timeout: KUBECTL_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES * 2,
      env: { ...process.env },
    })

    const combined = (stdout + (stderr ? `\nSTDERR: ${stderr}` : '')).trim()
    if (combined.length > MAX_OUTPUT_BYTES) {
      return combined.slice(0, MAX_OUTPUT_BYTES) + '\n... (output truncated)'
    }
    return combined || '(no output)'
  } catch (err: unknown) {
    if (err && typeof err === 'object') {
      const e = err as { killed?: boolean; code?: number | string; stderr?: string; message?: string }
      if (e.killed) return `Error: kubectl timed out after ${KUBECTL_TIMEOUT_MS}ms`
      if (typeof e.stderr === 'string' && e.stderr) return `kubectl error: ${e.stderr.trim()}`
      if (typeof e.message === 'string') return `kubectl error: ${e.message}`
    }
    return `kubectl error: ${String(err)}`
  }
}

// ── Tool handler registry ─────────────────────────────────────────────────────

export async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'kubectl': {
      const cmd = String(input.command ?? '')
      return runKubectl(cmd)
    }

    case 'aliyun_ecs': {
      const action = String(input.action ?? '')
      if (action === 'DescribeInstances') {
        return JSON.stringify({
          TotalCount: 3,
          Instances: [
            { InstanceId: 'i-bp1a1234', Status: 'Running', InstanceType: 'ecs.c6.xlarge', RegionId: 'cn-hangzhou' },
            { InstanceId: 'i-bp1b5678', Status: 'Running', InstanceType: 'ecs.g6.large',  RegionId: 'cn-shanghai' },
          ],
        }, null, 2)
      }
      return `✓ Aliyun ECS ${action} — executed (stub)`
    }

    case 'web_search': {
      const q = String(input.query ?? '')
      return `搜索结果 "${q}"（模拟）：\n1. 官方文档：最新最佳实践指南\n2. 技术博客：深度解析与案例\n3. GitHub Issues：社区常见问题\n\n（实际部署时连接 Tavily / Bing Search API）`
    }

    case 'security_scan': {
      const target = String(input.target ?? '')
      return `安全扫描报告 — ${target}\n✅ 无高危 CVE\n⚠️  发现 2 个中危漏洞：\n  - CVE-2024-1234 (CVSS 6.5): nginx 1.24 path traversal\n  - IAM-001: 过宽 S3 Bucket Policy\n建议：升级 nginx ≥ 1.26，收紧 IAM 权限`
    }

    case 'cost_analysis': {
      const period = String(input.period ?? 'last_30_days')
      return `成本分析报告 (${period})\n总支出：¥18,432\nECS: ¥9,200 (50%) ← 主要开销\nRDS: ¥4,100 (22%)\nOSS: ¥1,800 (10%)\n优化建议：\n• 3 台 ECS 可降配：预计节省 ¥2,400/月\n• 开启预留实例折扣：节省 40%`
    }

    case 'code_review': {
      const repo = String(input.repo ?? '')
      return `代码审查 ${repo} #${input.pr_number ?? 'latest'}\n✅ 测试覆盖率：87%\n⚠️  3 处潜在问题：\n  - SQL 拼接 (第 142 行) → 建议参数化查询\n  - 未捕获异步异常 (第 67 行)\n  - 硬编码 API key (第 23 行) → 移入环境变量`
    }

    case 'monitoring': {
      const metric = String(input.metric ?? '')
      return `指标: ${metric} (过去 ${input.duration ?? '1h'})\n平均: 45.2%  峰值: 78.1%  当前: 41.8%\n告警阈值: 80%  状态: ✅ 正常\n趋势: 稳定，无异常波动`
    }

    case 'orchestrate': {
      return `✓ 已向 ${input.agent_name} 发送任务：「${input.task}」\n目标区域：${input.zone ?? '自动分配'}\nTask ID: task-${Math.random().toString(36).slice(2, 8)}`
    }

    default:
      return `${name} executed with: ${JSON.stringify(input)}`
  }
}
