/**
 * API route tests: /api/orchestrations/trigger
 *
 * Tests the POST and GET handlers directly without a running Next.js server.
 * We construct minimal NextRequest objects and inspect the Response.
 */
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { POST, GET } from '@/app/api/orchestrations/trigger/route'

function makeRequest(body: unknown, method = 'POST'): NextRequest {
  return new NextRequest('http://localhost/api/orchestrations/trigger', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/orchestrations/trigger', () => {
  it('returns 202 Accepted when orchestrationId is provided', async () => {
    const req = makeRequest({ orchestrationId: 'deploy-pipeline', trigger: 'webhook' })
    const res = await POST(req)
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.accepted).toBe(true)
    expect(body.orchestrationId).toBe('deploy-pipeline')
    expect(body.trigger).toBe('webhook')
  })

  it('defaults trigger to "webhook" when not provided', async () => {
    const req = makeRequest({ orchestrationId: 'infra-health-check' })
    const res = await POST(req)
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.trigger).toBe('webhook')
  })

  it('returns 400 when orchestrationId is missing', async () => {
    const req = makeRequest({ trigger: 'manual' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('includes receivedAt timestamp in response', async () => {
    const req = makeRequest({ orchestrationId: 'nightly-security-scan' })
    const res = await POST(req)
    const body = await res.json()
    expect(typeof body.receivedAt).toBe('string')
    // should parse as a valid date
    expect(new Date(body.receivedAt).toString()).not.toBe('Invalid Date')
  })

  it('echoes back optional payload', async () => {
    const payload = { branch: 'main', commit: 'abc123' }
    const req = makeRequest({ orchestrationId: 'deploy-pipeline', payload })
    const res = await POST(req)
    const body = await res.json()
    expect(body.payload).toEqual(payload)
  })
})

describe('GET /api/orchestrations/trigger', () => {
  it('returns 200 with status ok', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.endpoint).toContain('trigger')
  })
})
