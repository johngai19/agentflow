/**
 * voice-transcribe — server-side Whisper transcription with domain hints.
 *
 * Works with both OpenAI (api.openai.com) and Azure OpenAI; set the relevant
 * env vars to switch:
 *
 *   OpenAI:  OPENAI_API_KEY
 *   Azure:   AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_DEPLOYMENT
 *
 * The client sends raw PCM/webm audio as multipart/form-data.
 * We do a quick pre-validation (size / type) then call the Whisper API.
 * The result is passed to voice-correct for context-aware LLM correction.
 */
import OpenAI, { AzureOpenAI } from 'openai'
import { NextRequest, NextResponse } from 'next/server'

// ── Client factory (OpenAI vs Azure) ────────────────────────────────────────
function makeClient(): OpenAI {
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
    return new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: '2024-06-01',
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'whisper',
    })
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// Cloud / DevOps domain prompt — steers Whisper toward correct terminology
const DOMAIN_PROMPT =
  'ECS, VPC, OSS, RDS, SLB, CDN, Kubernetes, K8s, Docker, Helm, Terraform, ' +
  'ArgoCD, kubectl, Prometheus, Grafana, Nginx, Redis, MySQL, GitLab, CI/CD, ' +
  'LangChain, AutoGen, CrewAI, PydanticAI, LlamaIndex, MCP, agent, workflow'

export const runtime = 'nodejs' // needs Node.js for FormData / File

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const audioBlob = form.get('audio') as File | null
    const lang = (form.get('lang') as string | null) ?? 'zh'
    const agentContext = (form.get('agentContext') as string | null) ?? ''

    // ── Validation ────────────────────────────────────────────────────────────
    if (!audioBlob || audioBlob.size === 0) {
      return NextResponse.json({ error: 'No audio data' }, { status: 400 })
    }
    // Reject unreasonably large uploads (> 24 MB — Whisper limit is 25 MB)
    if (audioBlob.size > 24 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio too large (max 24 MB)' }, { status: 413 })
    }
    // Reject very short clips (< 0.5 KB) — likely silence
    if (audioBlob.size < 512) {
      return NextResponse.json({ text: '' })
    }

    // ── Build combined prompt (domain + agent context) ─────────────────────
    const prompt = agentContext
      ? `${agentContext.slice(0, 200)}. ${DOMAIN_PROMPT}`
      : DOMAIN_PROMPT

    // ── Call Whisper ──────────────────────────────────────────────────────────
    const client = makeClient()
    const transcription = await client.audio.transcriptions.create({
      file: audioBlob,
      model: 'whisper-1',
      language: lang,
      prompt,
      response_format: 'verbose_json', // includes segments for confidence check
      temperature: 0,                  // deterministic
    })

    // Filter out "no speech" hallucinations (Whisper sometimes returns these)
    const noSpeechPhrases = ['谢谢观看', '谢谢', '请不吝点赞', '字幕', '感谢收看', 'Thank you']
    const rawText: string = transcription.text ?? ''
    if (noSpeechPhrases.some(p => rawText.trim() === p)) {
      return NextResponse.json({ text: '', filtered: true })
    }

    return NextResponse.json({ text: rawText.trim() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Return a graceful error so the UI can fall back to Web Speech API
    return NextResponse.json({ error: msg, text: '' }, { status: 500 })
  }
}
