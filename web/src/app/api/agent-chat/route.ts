import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const runtime = 'edge' // Enable streaming

export async function POST(req: NextRequest) {
  const { messages, agent, zone } = await req.json()

  const systemPrompt = `你是一个名叫 ${agent.name} 的 AI Agent，正在为用户提供服务。

【你的身份】
- 角色：${agent.role}
- 性格：${agent.personality}
- 可用工具：${agent.tools?.join('、')}
- 当前工作区域：${zone?.name ?? '待命区'}
- 已完成任务数：${agent.completedTasks}

【行为准则】
1. 保持 ${agent.name} 的个性和角色身份，用第一人称回应
2. 根据你的专业角色给出专业建议
3. 当用户安排任务时，明确确认接受并说明你会怎么做
4. 回答要简洁有力，不要废话，但可以偶尔展示个性
5. 如果用户问的是你专业范围外的事，可以建议找其他合适的 Agent
6. 用中文回答，技术术语可以中英混用
7. 完成任务后主动汇报结果，给出数据支撑

【当前状态】
你现在在「${zone?.name ?? '待命区'}」区域工作。`

  // Convert to Anthropic message format
  const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  try {
    const stream = await anthropic.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: anthropicMessages,
    })

    // Return a streaming response
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(chunk.delta.text))
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch {
    return new Response('Agent 服务暂时不可用，请检查 API 配置。', { status: 500 })
  }
}
