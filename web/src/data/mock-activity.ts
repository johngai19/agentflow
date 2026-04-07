export type ActivityType = 'commit' | 'deploy' | 'test' | 'review' | 'error' | 'fix' | 'config'

export interface ActivityEvent {
  id: string
  agentName: string
  project: string
  action: string
  type: ActivityType
  timestamp: Date
}

export const mockActivity: ActivityEvent[] = [
  {
    id: 'evt-1',
    agentName: 'SRE Agent',
    project: 'homelab-infra',
    action: 'Applied firewall rules to HK-Node-3',
    type: 'config',
    timestamp: new Date('2026-04-07T11:32:00'),
  },
  {
    id: 'evt-2',
    agentName: 'Product Dev Agent',
    project: 'ailame',
    action: 'Pushed 3 commits to feat/m3-cognitive-engine',
    type: 'commit',
    timestamp: new Date('2026-04-07T11:28:00'),
  },
  {
    id: 'evt-3',
    agentName: 'Full-stack Agent',
    project: 'ccapm',
    action: 'Deployed staging build v0.4.2',
    type: 'deploy',
    timestamp: new Date('2026-04-07T11:15:00'),
  },
  {
    id: 'evt-4',
    agentName: 'DevOps Agent',
    project: 'opsagent',
    action: 'CI pipeline passed — 24/24 tests green',
    type: 'test',
    timestamp: new Date('2026-04-07T11:05:00'),
  },
  {
    id: 'evt-5',
    agentName: 'Maintenance Agent',
    project: 'knowledge-base',
    action: 'Merge conflict detected in L3-knowledge/hosts.md',
    type: 'error',
    timestamp: new Date('2026-04-07T10:58:00'),
  },
  {
    id: 'evt-6',
    agentName: 'Content PM Agent',
    project: 'johngai-blog',
    action: 'Created draft: AI-native workflow patterns',
    type: 'commit',
    timestamp: new Date('2026-04-07T10:45:00'),
  },
  {
    id: 'evt-7',
    agentName: 'SRE Agent',
    project: 'homelab-infra',
    action: 'Hardened SSH config on MY-Node-1, MY-Node-2',
    type: 'config',
    timestamp: new Date('2026-04-07T10:30:00'),
  },
  {
    id: 'evt-8',
    agentName: 'Backend Dev Agent',
    project: 'companion-ai',
    action: 'Waiting for API schema review approval',
    type: 'review',
    timestamp: new Date('2026-04-07T10:20:00'),
  },
  {
    id: 'evt-9',
    agentName: 'Product Dev Agent',
    project: 'ailame',
    action: 'Fixed memory leak in reflection loop',
    type: 'fix',
    timestamp: new Date('2026-04-07T10:10:00'),
  },
  {
    id: 'evt-10',
    agentName: 'DevOps Agent',
    project: 'opsagent',
    action: 'Configured GitHub Actions staging workflow',
    type: 'config',
    timestamp: new Date('2026-04-07T10:00:00'),
  },
  {
    id: 'evt-11',
    agentName: 'Ecosystem Agent',
    project: 'plugin-market',
    action: 'Analyzed 12 plugin candidates — 4 approved',
    type: 'review',
    timestamp: new Date('2026-04-07T09:45:00'),
  },
  {
    id: 'evt-12',
    agentName: 'Research Agent',
    project: 'meeting-summary',
    action: 'Completed WorkLens incident trim report',
    type: 'commit',
    timestamp: new Date('2026-04-07T09:30:00'),
  },
  {
    id: 'evt-13',
    agentName: 'Full-stack Agent',
    project: 'ccapm',
    action: 'Added real-time WebSocket status endpoint',
    type: 'commit',
    timestamp: new Date('2026-04-07T09:15:00'),
  },
  {
    id: 'evt-14',
    agentName: 'Mobile Dev Agent',
    project: 'ailame-app',
    action: 'Completed chat UI component with animations',
    type: 'commit',
    timestamp: new Date('2026-04-07T08:20:00'),
  },
  {
    id: 'evt-15',
    agentName: 'SRE Agent',
    project: 'homelab-infra',
    action: 'Ran security audit across 9 servers',
    type: 'test',
    timestamp: new Date('2026-04-07T08:00:00'),
  },
]
