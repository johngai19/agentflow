/**
 * toolHandlers tests
 *
 * Tests runKubectl() — the real kubectl integration — and the runTool() registry.
 * kubectl calls use the locally installed binary (read-only subcommands only).
 */
import { describe, it, expect } from 'vitest'
import { runKubectl, runTool } from '@/lib/toolHandlers'

describe('runKubectl — input validation', () => {
  it('returns error for empty command', async () => {
    const result = await runKubectl('')
    expect(result).toContain('Error:')
    expect(result).toContain('empty')
  })

  it('rejects mutating subcommand "delete"', async () => {
    const result = await runKubectl('delete pod my-pod')
    expect(result).toContain('Error:')
    expect(result).toContain('not allowed')
  })

  it('rejects mutating subcommand "apply"', async () => {
    const result = await runKubectl('apply -f deployment.yaml')
    expect(result).toContain('Error:')
  })

  it('rejects mutating subcommand "scale"', async () => {
    const result = await runKubectl('scale deployment web --replicas=0')
    expect(result).toContain('Error:')
  })

  it('rejects argument with shell meta-characters', async () => {
    const result = await runKubectl('get pods; rm -rf /')
    expect(result).toContain('Error:')
    expect(result).toContain('disallowed characters')
  })

  it('rejects argument with backtick injection', async () => {
    const result = await runKubectl('get pods `id`')
    expect(result).toContain('Error:')
  })

  it('rejects argument with dollar-sign injection', async () => {
    const result = await runKubectl('get pods $(id)')
    expect(result).toContain('Error:')
  })
})

describe('runKubectl — real kubectl calls', () => {
  it('kubectl version returns client version string', async () => {
    const result = await runKubectl('version --client')
    // Could be "Client Version: vX.Y.Z" or JSON depending on --output flag
    // Should NOT be an error
    expect(result).not.toMatch(/^Error:/)
    expect(result.length).toBeGreaterThan(0)
  }, 15_000)

  it('kubectl api-versions returns a list of API groups', async () => {
    const result = await runKubectl('api-versions')
    if (result.startsWith('kubectl error:')) {
      // No cluster reachable — the binary is present but no context; acceptable
      expect(result).toContain('kubectl error:')
    } else {
      // Cluster connected: expect API version lines like "v1", "apps/v1"
      expect(result).toMatch(/v1/)
    }
  }, 15_000)
})

describe('runTool — registry dispatch', () => {
  it('routes kubectl to runKubectl (returns string)', async () => {
    const result = await runTool('kubectl', { command: 'version --client' })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  }, 15_000)

  it('returns aliyun_ecs DescribeInstances stub', async () => {
    const result = await runTool('aliyun_ecs', { action: 'DescribeInstances' })
    const parsed = JSON.parse(result)
    expect(parsed.TotalCount).toBeGreaterThan(0)
    expect(Array.isArray(parsed.Instances)).toBe(true)
  })

  it('returns web_search stub for a query', async () => {
    const result = await runTool('web_search', { query: 'kubernetes best practices' })
    expect(result).toContain('kubernetes best practices')
  })

  it('returns security_scan stub', async () => {
    const result = await runTool('security_scan', { target: 'ecs-instance-001' })
    expect(result).toContain('ecs-instance-001')
  })

  it('returns cost_analysis stub', async () => {
    const result = await runTool('cost_analysis', { period: 'last_7_days' })
    expect(result).toContain('last_7_days')
  })

  it('returns code_review stub', async () => {
    const result = await runTool('code_review', { repo: 'org/my-repo', pr_number: 42 })
    expect(result).toContain('org/my-repo')
    expect(result).toContain('42')
  })

  it('returns monitoring stub', async () => {
    const result = await runTool('monitoring', { metric: 'cpu_usage_percent', duration: '30m' })
    expect(result).toContain('cpu_usage_percent')
    expect(result).toContain('30m')
  })

  it('returns orchestrate stub', async () => {
    const result = await runTool('orchestrate', { agent_name: 'Bob', task: '检查集群', zone: 'cron' })
    expect(result).toContain('Bob')
    expect(result).toContain('检查集群')
  })

  it('handles unknown tool gracefully', async () => {
    const result = await runTool('unknown_tool', { foo: 'bar' })
    expect(result).toContain('unknown_tool')
  })
})
