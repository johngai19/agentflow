import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { rawTranscript, agentName, agentRole, agentTools, zoneName, recentContext } = await req.json()

    if (!rawTranscript?.trim()) {
      return NextResponse.json({ corrected: rawTranscript })
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', // fast model for real-time correction
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `你是一个专业的语音识别纠错助手。以下是用户对 AI Agent 发出的语音指令，通过语音识别转录后可能含有错误，请根据上下文智能纠正。

【Agent 背景】
- 名称：${agentName}
- 角色：${agentRole}
- 可用工具：${agentTools?.join('、') ?? '通用工具'}
- 当前工作区域：${zoneName}

【最近对话】
${recentContext || '（无历史对话）'}

【语音识别原文】
${rawTranscript}

【纠错规则】
1. 云计算术语：ECS、VPC、OSS、RDS、SLB、CDN、K8s（Kubernetes）、Docker、Helm、Terraform、ArgoCD
2. 阿里云专有名词：函数计算（FC）、容器服务（ACK）、对象存储（OSS）、云数据库（RDS）、负载均衡（SLB）
3. 编程相关：TypeScript、Python、Node.js、npm、pip、Git、GitHub、CI/CD
4. AI/Agent 相关：LangChain、AutoGen、CrewAI、LlamaIndex、PydanticAI、向量数据库、嵌入（Embedding）
5. 运维相关：监控（Monitoring）、告警（Alert）、日志（Log）、指标（Metric）、Pod、Namespace
6. 数字和命令不要擅自修改
7. 若原文语义清晰，仅需最小化修改

只返回纠正后的文本，不要有任何解释或前缀。若无需纠正，原样返回。`,
      }],
    })

    const corrected = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : rawTranscript

    return NextResponse.json({ corrected, original: rawTranscript })
  } catch {
    return NextResponse.json({ corrected: '' })
  }
}
