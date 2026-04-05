# kagent Starter

Kubernetes-native agent orchestration framework.

kagent deploys AI agents as Kubernetes Custom Resources (CRDs), enabling cloud-native lifecycle management, scaling, and observability. Agents are defined declaratively as YAML manifests and managed by the kagent controller.

## Key Concepts

- **KagentManifest**: Kubernetes CRD representing an agent with system prompt, model config, and tools
- **TeamManifest**: Multi-agent team with participants and turn limits
- **createAgentManifest**: Helper to construct valid agent manifests
- **validateManifest**: Programmatic manifest validation before deployment

## Usage

```typescript
import { createAgentManifest, validateManifest } from './src/agent.js'

const manifest = createAgentManifest('my-agent', {
  description: 'A helpful coding assistant',
  systemPrompt: 'You are an expert software engineer',
  modelConfigName: 'claude-model',
  tools: [{ type: 'McpServer', name: 'filesystem' }],
})

const { valid, errors } = validateManifest(manifest)
// Deploy with: kubectl apply -f manifest.yaml
```

## Tests

```bash
npm install
npm test
```
