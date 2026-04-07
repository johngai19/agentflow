/**
 * kagent starter - Kubernetes-native agent orchestration
 * https://kagent.dev
 *
 * kagent uses CRDs (Custom Resource Definitions) to define agents as Kubernetes resources.
 * This starter shows how to structure kagent manifests and validate them programmatically.
 */

export interface KubernetesMetadata {
  name: string
  namespace?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

export interface ModelConfig {
  apiKeySecretRef: { name: string; key: string }
}

export interface AgentTool {
  type: 'McpServer' | 'Function' | 'Agent'
  name?: string
  ref?: string
}

export interface KagentSpec {
  description: string
  systemPrompt: string
  modelConfig: { apiGroup: string; name: string }
  tools?: AgentTool[]
  memory?: { windowSize: number }
}

export interface KagentManifest {
  apiVersion: string
  kind: 'Agent'
  metadata: KubernetesMetadata
  spec: KagentSpec
}

export function createAgentManifest(
  name: string,
  spec: Omit<KagentSpec, 'modelConfig'> & { modelConfigName?: string }
): KagentManifest {
  return {
    apiVersion: 'kagent.dev/v1alpha1',
    kind: 'Agent',
    metadata: { name, namespace: 'default' },
    spec: {
      description: spec.description,
      systemPrompt: spec.systemPrompt,
      modelConfig: { apiGroup: 'kagent.dev/v1alpha1', name: spec.modelConfigName ?? 'default-model' },
      tools: spec.tools ?? [],
      memory: spec.memory,
    }
  }
}

export function validateManifest(manifest: KagentManifest): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (manifest.apiVersion !== 'kagent.dev/v1alpha1') errors.push('Invalid apiVersion')
  if (manifest.kind !== 'Agent') errors.push('kind must be Agent')
  if (!manifest.metadata.name) errors.push('metadata.name is required')
  if (!manifest.spec.systemPrompt) errors.push('spec.systemPrompt is required')
  if (!manifest.spec.description) errors.push('spec.description is required')
  if (!manifest.spec.modelConfig.name) errors.push('spec.modelConfig.name is required')
  return { valid: errors.length === 0, errors }
}

export interface TeamManifest {
  apiVersion: string
  kind: 'Team'
  metadata: KubernetesMetadata
  spec: {
    participants: Array<{ name: string; role?: string }>
    maxTurns?: number
  }
}

export function createTeamManifest(name: string, agentNames: string[], maxTurns = 10): TeamManifest {
  return {
    apiVersion: 'kagent.dev/v1alpha1',
    kind: 'Team',
    metadata: { name, namespace: 'default' },
    spec: {
      participants: agentNames.map(n => ({ name: n })),
      maxTurns,
    }
  }
}
