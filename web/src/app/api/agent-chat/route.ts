/**
 * agent-chat — real Claude agent execution with tool_use streaming.
 *
 * Each agent has a set of tools that Claude can actually call.
 * We stream three event types to the client:
 *   {"type":"text",    "text":"..."}
 *   {"type":"tool_start","name":"kubectl","input":{...}}
 *   {"type":"tool_result","name":"kubectl","output":"..."}
 *
 * The client renders each event differently so the user sees real tool calls.
 *
 * Tool implementations are stubs that return realistic mock data while a real
 * backend (kagent / K8s API / Aliyun SDK) isn't connected. Swap TOOL_HANDLERS
 * entries for real implementations when you have credentials.
 */
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { runTool } from '@/lib/toolHandlers'

// Changed from edge to nodejs: kubectl handler uses child_process (not available in Edge runtime)
export const runtime = 'nodejs'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Tool definitions (sent to Claude) ───────────────────────────────────────
const ALL_TOOLS: Record<string, Anthropic.Tool> = {
  kubectl: {
    name: 'kubectl',
    description: 'Run kubectl commands against a Kubernetes cluster',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'kubectl subcommand, e.g. "get pods -n default"' },
      },
      required: ['command'],
    },
  },
  aliyun_ecs: {
    name: 'aliyun_ecs',
    description: 'Query or manage Alibaba Cloud ECS instances',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: { type: 'string', description: 'e.g. DescribeInstances, StartInstance' },
        params: { type: 'object', description: 'API parameters' },
      },
      required: ['action'],
    },
  },
  web_search: {
    name: 'web_search',
    description: 'Search the web for up-to-date information',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  security_scan: {
    name: 'security_scan',
    description: 'Scan cloud resources or code for vulnerabilities',
    input_schema: {
      type: 'object' as const,
      properties: {
        target: { type: 'string', description: 'Resource ARN, IP, or repository URL' },
        scan_type: { type: 'string', enum: ['CVE', 'IAM', 'network', 'code'], description: 'Scan type' },
      },
      required: ['target'],
    },
  },
  cost_analysis: {
    name: 'cost_analysis',
    description: 'Analyse cloud spend and identify optimization opportunities',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: { type: 'string', description: 'e.g. "last_30_days"' },
        service: { type: 'string', description: 'Cloud service filter, optional' },
      },
      required: ['period'],
    },
  },
  code_review: {
    name: 'code_review',
    description: 'Review code for bugs, security issues and best practices',
    input_schema: {
      type: 'object' as const,
      properties: {
        repo: { type: 'string', description: 'GitHub repo e.g. org/repo' },
        pr_number: { type: 'number', description: 'Pull request number' },
      },
      required: ['repo'],
    },
  },
  monitoring: {
    name: 'monitoring',
    description: 'Query Prometheus / CloudMonitor metrics',
    input_schema: {
      type: 'object' as const,
      properties: {
        metric: { type: 'string', description: 'Metric name, e.g. "cpu_usage_percent"' },
        duration: { type: 'string', description: 'Time range, e.g. "1h"' },
      },
      required: ['metric'],
    },
  },
  orchestrate: {
    name: 'orchestrate',
    description: 'Dispatch a task to another agent by name',
    input_schema: {
      type: 'object' as const,
      properties: {
        agent_name: { type: 'string', description: 'Target agent name, e.g. "Bob"' },
        task: { type: 'string', description: 'Task description' },
        zone: { type: 'string', description: 'Target work zone' },
      },
      required: ['agent_name', 'task'],
    },
  },
}

// ── SSE event helpers ─────────────────────────────────────────────────────────
function encodeEvent(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + '\n')
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { messages, agent, zone } = await req.json()

  // Select tools this agent actually has
  const agentTools = (agent.tools as string[])
    .map((t: string) => ALL_TOOLS[t])
    .filter(Boolean) as Anthropic.Tool[]

  const systemPrompt = `你是 ${agent.name}，一个真实运行中的 AI Agent。

【身份】
- 角色：${agent.role}
- 性格：${agent.personality}
- 当前区域：${zone?.name ?? '待命区'}
- 已完成：${agent.completedTasks} 项任务

【行为准则】
1. 你有真实可用的工具，遇到相关问题必须调用工具获取真实数据，不要编造
2. 调用工具前简短说明你要做什么；收到结果后分析并汇报
3. 保持 ${agent.name} 的个性，用第一人称，中文回复
4. 任务完成后给出结论和下一步建议
5. 如果没有合适工具，诚实说明并提供专业建议`

  const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Agentic loop: keep running until no more tool calls
        let loopMessages = [...anthropicMessages]
        const MAX_LOOPS = 5

        for (let loop = 0; loop < MAX_LOOPS; loop++) {
          const response = await anthropic.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 2048,
            system: systemPrompt,
            tools: agentTools.length > 0 ? agentTools : undefined,
            tool_choice: agentTools.length > 0 ? { type: 'auto' } : undefined,
            messages: loopMessages,
          })

          // Stream text content blocks
          for (const block of response.content) {
            if (block.type === 'text') {
              controller.enqueue(encodeEvent({ type: 'text', text: block.text }))
            }
          }

          // Handle tool uses
          const toolUses = response.content.filter(b => b.type === 'tool_use')
          if (toolUses.length === 0 || response.stop_reason === 'end_turn') break

          // Signal each tool call to the client, execute, return result
          const toolResultContent = await Promise.all(toolUses.map(async block => {
              if (block.type !== 'tool_use') return null!
              controller.enqueue(encodeEvent({
                type: 'tool_start',
                name: block.name,
                input: block.input,
              }))

              const output = await runTool(block.name, block.input as Record<string, unknown>)

              controller.enqueue(encodeEvent({
                type: 'tool_result',
                name: block.name,
                output,
              }))

              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: output,
              }
            })).then(r => r.filter(Boolean))

          const toolResults: Anthropic.MessageParam = {
            role: 'user',
            content: toolResultContent as Anthropic.ToolResultBlockParam[],
          }

          // Add assistant turn + tool results, continue loop
          loopMessages = [
            ...loopMessages,
            { role: 'assistant' as const, content: response.content },
            toolResults,
          ]
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(encodeEvent({ type: 'text', text: `⚠️ ${msg}` }))
      } finally {
        controller.enqueue(encodeEvent({ type: 'done' }))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
    },
  })
}
