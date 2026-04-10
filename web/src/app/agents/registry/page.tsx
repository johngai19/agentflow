"use client"

import React, { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { agentRegistryApi, type AgentInfo } from '@/lib/opsagentApi'

type RegisterFormState = {
  name: string
  endpointUrl: string
  capabilityTags: string
}

const INITIAL_FORM: RegisterFormState = {
  name: '',
  endpointUrl: '',
  capabilityTags: '',
}

export function parseTagList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
    ),
  )
}

export function slugifyAgentName(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'agent'
}

export function formatLastSeen(value: string | null): string {
  if (!value) return 'Never'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function buildRegisterPayload(form: RegisterFormState) {
  const parsedUrl = new URL(form.endpointUrl.trim())
  const capabilities = parseTagList(form.capabilityTags)

  return {
    agent_id: slugifyAgentName(form.name),
    name: form.name.trim(),
    description: '',
    base_url: parsedUrl.origin,
    a2a_endpoint: parsedUrl.toString(),
    health_check_url: new URL('/health', parsedUrl.origin).toString(),
    capabilities: capabilities.map(name => ({
      name,
      description: `${name} capability`,
      intents: [name],
      input_schema: {},
      output_schema: {},
    })),
    tags: capabilities,
    metadata: {},
  }
}

export function applyHealthCheckResults(
  agents: AgentInfo[],
  results: Record<string, boolean>,
): AgentInfo[] {
  const now = new Date().toISOString()

  return agents.map(agent => {
    if (!(agent.agent_id in results)) return agent

    return {
      ...agent,
      is_healthy: results[agent.agent_id],
      last_seen: now,
    }
  })
}

function statusVariant(isHealthy: boolean): 'default' | 'destructive' {
  return isHealthy ? 'default' : 'destructive'
}

const AgentRegistryPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<RegisterFormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [checkingAgentId, setCheckingAgentId] = useState<string | null>(null)
  const [removingAgentId, setRemovingAgentId] = useState<string | null>(null)

  const capabilityPreview = useMemo(
    () => parseTagList(form.capabilityTags),
    [form.capabilityTags],
  )

  const loadAgents = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await agentRegistryApi.listAgents()
      setAgents(response.agents)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load registered agents.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAgents()
  }, [loadAgents])

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    try {
      const payload = buildRegisterPayload(form)
      setSubmitting(true)
      const registered = await agentRegistryApi.registerAgent(payload)

      setAgents(current => {
        const existing = current.filter(agent => agent.agent_id !== registered.agent_id)
        return [registered, ...existing]
      })
      setForm(INITIAL_FORM)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to register agent.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleHealthCheck = async (agentId: string) => {
    setError(null)
    setCheckingAgentId(agentId)

    try {
      const response = await agentRegistryApi.healthCheckAll()
      setAgents(current => applyHealthCheckResults(current, response.results))
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to run health check.')
      }
    } finally {
      setCheckingAgentId(null)
    }
  }

  const handleUnregister = async (agentId: string) => {
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm('Unregister this agent from the registry?')

    if (!confirmed) return

    setError(null)
    setRemovingAgentId(agentId)

    try {
      await agentRegistryApi.unregisterAgent(agentId)
      setAgents(current => current.filter(agent => agent.agent_id !== agentId))
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to unregister agent.')
      }
    } finally {
      setRemovingAgentId(null)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Registry</h1>
          <p className="mt-1 text-muted-foreground">
            Register, check, and remove OpsAgent workers from the live registry.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadAgents()} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registered Agents</CardTitle>
          <CardDescription>
            Health state comes from the workflow engine registry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map(agent => (
                <TableRow key={agent.agent_id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span>{agent.name}</span>
                      <span className="text-xs text-muted-foreground">{agent.a2a_endpoint}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(agent.is_healthy)}>
                      {agent.is_healthy ? 'Healthy' : 'Unhealthy'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {agent.capabilities.length > 0 ? (
                        agent.capabilities.map(capability => (
                          <Badge key={capability.name} variant="outline">
                            {capability.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatLastSeen(agent.last_seen)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleHealthCheck(agent.agent_id)}
                        disabled={checkingAgentId === agent.agent_id}
                      >
                        {checkingAgentId === agent.agent_id ? 'Checking...' : 'Health Check'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void handleUnregister(agent.agent_id)}
                        disabled={removingAgentId === agent.agent_id}
                      >
                        {removingAgentId === agent.agent_id ? 'Removing...' : 'Unregister'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!loading && agents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No agents are registered yet.
                  </TableCell>
                </TableRow>
              )}

              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Loading agents...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Register New Agent</CardTitle>
          <CardDescription>
            Provide the agent name, A2A endpoint URL, and comma-separated capability tags.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleRegister}>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Name</Label>
                <Input
                  id="agent-name"
                  value={form.name}
                  onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                  placeholder="Incident Triage Agent"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-endpoint">Endpoint URL</Label>
                <Input
                  id="agent-endpoint"
                  type="url"
                  value={form.endpointUrl}
                  onChange={event => setForm(current => ({ ...current, endpointUrl: event.target.value }))}
                  placeholder="https://agent.internal/a2a"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-capabilities">Capabilities Tags</Label>
              <Input
                id="agent-capabilities"
                value={form.capabilityTags}
                onChange={event => setForm(current => ({ ...current, capabilityTags: event.target.value }))}
                placeholder="triage, remediation, diagnostics"
              />
              <p className="text-sm text-muted-foreground">
                {capabilityPreview.length > 0
                  ? `Will register ${capabilityPreview.length} capabilities.`
                  : 'Tags are optional, but recommended for routing and discovery.'}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {capabilityPreview.map(tag => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Registering...' : 'Register Agent'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default AgentRegistryPage
