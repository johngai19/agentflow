import { NextRequest, NextResponse } from 'next/server'

// This is a lightweight webhook endpoint.
// The actual state mutation happens in the Zustand store (client-side).
// For a production system, this would persist to a DB and enqueue a job.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { orchestrationId, trigger = 'webhook', payload } = body as {
      orchestrationId?: string
      trigger?: string
      payload?: unknown
    }

    if (!orchestrationId) {
      return NextResponse.json({ error: 'orchestrationId is required' }, { status: 400 })
    }

    // In production: push to job queue (BullMQ, Temporal, etc.)
    // For now: return 202 Accepted — client will poll and update its Zustand store
    return NextResponse.json({
      accepted: true,
      orchestrationId,
      trigger,
      receivedAt: new Date().toISOString(),
      message: 'Run enqueued. Poll /orchestrations for status.',
      payload,
    }, { status: 202 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

// Simple GET for webhook verification (like GitHub webhooks ping)
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: '/api/orchestrations/trigger' })
}
