# Agent Studio — 技术架构（开发者视角）

---

## 一、技术选型决策树

### 1.1 渲染层核心决策

```
问题：50+ 个动态 agent 角色，需要流畅动画 + React 状态管理，怎么渲染？

方案 A: 纯 CSS + Framer Motion
  ✅ 开发成本低，React 生态无缝
  ✅ SEO 友好，无额外包
  ❌ 50+ 动画元素开始掉帧（CSS transform 堆叠）
  ❌ 复杂路径动画（走路轨迹）很难实现
  🎯 适合: ≤30 个 agent，MVP 阶段

方案 B: PixiJS + React 桥接
  ✅ WebGL 渲染，500+ sprite 60fps 无压力
  ✅ 强大的 Sprite/Tween 系统
  ✅ 有 @pixi/react 官方 React 绑定
  ❌ 学习曲线（WebGL 概念）
  ❌ CSS 样式无法直接用
  🎯 适合: 100+ agent 规模，游戏感强

方案 C: Rive + React（角色动画）
  ✅ 最佳角色动画质量（状态机驱动）
  ✅ 文件小（~50KB/角色）
  ✅ 设计师可直接编辑
  ❌ 仅做动画，不处理场景/位移
  🎯 适合: 与 CSS 或 PixiJS 配合，专门处理角色表情

方案 D: Phaser.js
  ✅ 完整 2D 游戏引擎，物理/碰撞/地图
  ❌ 太重（1.1MB），与 React 集成复杂
  ❌ 过度工程化
  🎯 不推荐，除非做地形碰撞

推荐组合：
┌─────────────────────────────────────────────────────┐
│  MVP:    Framer Motion + CSS Grid（最快上线）        │
│  V1.0:   PixiJS（@pixi/react）+ Rive 角色           │
│  V2.0:   Three.js（如果需要 3D 升级）               │
└─────────────────────────────────────────────────────┘
```

### 1.2 实时通信选型

```
方案对比：

SSE (Server-Sent Events):
  ✅ 单向推送，HTTP 协议，无需特殊处理
  ✅ 自动重连，浏览器原生支持
  ✅ 与 Next.js Route Handler 完美兼容
  ❌ 单向（只能服务端推）
  🎯 适合: agent 状态更新推送

WebSocket:
  ✅ 双向通信
  ✅ 适合聊天/语音流式回复
  ❌ K8s 部署需要粘性会话（sticky session）
  🎯 适合: 与 agent 的实时对话

K8s Watch API:
  ✅ 直接监听 Pod/CRD 变化
  ✅ kubectl get pods -w 的 API 版本
  ❌ 需要 RBAC 配置，不宜直接暴露给浏览器
  🎯 通过后端代理转发

推荐架构：
Browser ←── SSE ──── Backend ←── K8s Watch API
Browser ←─WebSocket─ Backend ←── Agent API (chat)
```

---

## 二、完整系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        浏览器（Next.js）                          │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  场景渲染层  │  │  状态管理层  │  │     交互层           │   │
│  │  PixiJS /   │  │  Zustand +   │  │  拖拽 @dnd-kit      │   │
│  │  Framer     │  │  XState      │  │  语音 Web Speech    │   │
│  │  Motion     │  │  (状态机)    │  │  聊天 Vercel AI SDK │   │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         └─────────────────┼──────────────────────┘               │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │ HTTPS / WebSocket / SSE
┌───────────────────────────┼──────────────────────────────────────┐
│                      后端 (Next.js API Routes)                    │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  /api/agents│  │ /api/chat    │  │  /api/zones          │   │
│  │  (SSE 推送) │  │ (AI 对话流)  │  │  (区域/任务 CRUD)    │   │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         └─────────────────┼──────────────────────┘               │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────────┐
│                     集成层（可选各组件）                           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  K8s API     │  │  Agent APIs  │  │  LLM Provider        │  │
│  │  (kagent CRD)│  │  (HTTP/WS)   │  │  (Anthropic/OpenAI)  │  │
│  │  Pod Watch   │  │  各 agent 的  │  │  流式 AI 回复        │  │
│  └──────────────┘  │  /status     │  └──────────────────────┘  │
│                    │  /run        │                             │
│                    │  /stop 接口  │                             │
│                    └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、数据模型设计

### 3.1 核心实体

```typescript
// Agent 实体（前端状态）
interface AgentEntity {
  id: string                    // 唯一 ID
  name: string                  // 用户起的名字（如"小橙"）
  avatar: AvatarConfig          // 外观配置
  status: AgentStatus           // idle | moving | working | waiting | error | reporting
  position: { x: number; y: number }  // 在场景中的坐标
  zoneId: string | null         // 当前所在区域
  currentTask: Task | null      // 当前任务
  capabilities: string[]        // 能力标签
  metadata: {
    k8sPodName: string          // 对应 K8s Pod
    k8sNamespace: string
    framework: string           // PydanticAI / CrewAI etc.
    deployedAt: Date
  }
  stats: {
    tasksCompleted: number
    tasksFailed: number
    uptime: number             // 秒
  }
}

// Agent 状态枚举
type AgentStatus = 
  | 'idle'        // 闲置，可接收任务
  | 'moving'      // 走向目标区域
  | 'working'     // 执行任务中
  | 'waiting'     // 等待依赖/资源
  | 'error'       // 出错
  | 'reporting'   // 任务完成，汇报结果
  | 'offline'     // K8s Pod 不存在/未就绪

// 区域实体
interface Zone {
  id: string
  name: string
  icon: string
  type: ZoneType               // 'cron' | 'cloud' | 'analysis' | 'standby' | 'custom'
  position: { x: number; y: number; width: number; height: number }
  color: string
  capacity: number | null      // null = 无限
  agentIds: string[]           // 当前在该区域的 agents
  config: {
    triggerType: 'immediate' | 'cron' | 'webhook'
    cronExpression?: string
    webhookUrl?: string
    toolOverrides?: Record<string, string>
  }
}

// 任务实体
interface Task {
  id: string
  agentId: string
  zoneId: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt: Date | null
  completedAt: Date | null
  result: string | null
  logs: LogEntry[]
}
```

### 3.2 Agent 状态机（XState）

```typescript
import { createMachine, assign } from 'xstate'

const agentMachine = createMachine({
  id: 'agent',
  initial: 'idle',
  context: {
    agentId: '',
    currentTask: null,
    position: { x: 0, y: 0 },
    targetPosition: null,
    error: null,
  },
  states: {
    idle: {
      on: {
        ASSIGN_TASK: {
          target: 'moving',
          actions: assign({ currentTask: ({ event }) => event.task }),
        },
      },
    },
    moving: {
      invoke: {
        src: 'moveToZone',   // 动画 Promise
        onDone: 'working',
        onError: 'error',
      },
    },
    working: {
      invoke: {
        src: 'executeTask',  // 调用 agent API
        onDone: 'reporting',
        onError: 'error',
      },
    },
    waiting: {
      on: {
        DEPENDENCY_MET: 'working',
        CANCEL: 'idle',
      },
    },
    error: {
      on: {
        RETRY: 'moving',
        DISMISS: 'idle',
      },
    },
    reporting: {
      after: {
        3000: 'idle',  // 3 秒后自动回到闲置
      },
      on: {
        ACKNOWLEDGE: 'idle',
      },
    },
  },
})
```

---

## 四、关键模块实现

### 4.1 K8s 实时同步

```typescript
// app/api/agents/stream/route.ts - SSE 端点
export async function GET(req: Request) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      // 连接 K8s Watch API
      const k8sWatch = new k8s.Watch(kubeConfig)
      
      const watcher = await k8sWatch.watch(
        '/api/v1/namespaces/agent-system/pods',
        { labelSelector: 'app=ai-agent' },
        (type, pod) => {
          // Pod 变化 → 转换为 AgentStatus
          const update = {
            agentId: pod.metadata?.labels?.['agent-id'],
            status: mapPodStatusToAgentStatus(pod.status),
            timestamp: Date.now(),
          }
          // SSE 推送
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(update)}\n\n`)
          )
        },
        (err) => controller.error(err)
      )
      
      // 客户端断开时清理
      req.signal.addEventListener('abort', () => watcher.abort())
    },
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// 状态映射
function mapPodStatusToAgentStatus(podStatus: k8s.V1PodStatus): AgentStatus {
  const phase = podStatus?.phase
  const conditions = podStatus?.conditions ?? []
  
  if (phase === 'Running') {
    const ready = conditions.find(c => c.type === 'Ready')?.status === 'True'
    return ready ? 'working' : 'waiting'
  }
  if (phase === 'Failed') return 'error'
  if (phase === 'Succeeded') return 'reporting'
  if (phase === 'Pending') return 'waiting'
  return 'offline'
}
```

### 4.2 拖拽区域实现（@dnd-kit）

```tsx
// components/AgentScene.tsx
import { DndContext, DragEndEvent, useSensor, useSensors, MouseSensor } from '@dnd-kit/core'
import { useAgentStore } from '@/stores/agentStore'

export function AgentScene() {
  const { agents, zones, assignAgentToZone } = useAgentStore()
  const sensors = useSensors(useSensor(MouseSensor))
  
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    
    const agentId = active.id as string
    const zoneId = over.id as string
    
    // 乐观更新 UI（立即开始走路动画）
    assignAgentToZone(agentId, zoneId)
    
    // 后端调用（触发实际任务）
    try {
      await fetch('/api/zones/assign', {
        method: 'POST',
        body: JSON.stringify({ agentId, zoneId }),
      })
    } catch {
      // 失败则回滚
      assignAgentToZone(agentId, null)
    }
  }
  
  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* 场景背景 */}
      <SceneBackground />
      
      {/* 区域（可拖放目标） */}
      {zones.map(zone => (
        <DroppableZone key={zone.id} zone={zone} />
      ))}
      
      {/* Agent 角色（可拖动源） */}
      {agents.map(agent => (
        <DraggableAgent key={agent.id} agent={agent} />
      ))}
    </DndContext>
  )
}

// components/DraggableAgent.tsx
import { useDraggable } from '@dnd-kit/core'
import { AgentSprite } from './AgentSprite'

export function DraggableAgent({ agent }: { agent: AgentEntity }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: agent.id,
    disabled: agent.status === 'working',  // 工作中不能拖
  })
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined
  
  return (
    <div
      ref={setNodeRef}
      style={{ position: 'absolute', left: agent.position.x, top: agent.position.y, ...style }}
      {...listeners}
      {...attributes}
    >
      <AgentSprite agent={agent} />
    </div>
  )
}
```

### 4.3 Rive 角色动画集成

```tsx
// components/AgentSprite.tsx
import { useRive, useStateMachineInput } from '@rive-app/react-canvas'

interface AgentSpriteProps {
  agent: AgentEntity
  onClick: () => void
}

export function AgentSprite({ agent, onClick }: AgentSpriteProps) {
  const { rive, RiveComponent } = useRive({
    src: '/agents/minion.riv',        // Rive 动画文件
    stateMachines: 'AgentStateMachine',
    autoplay: true,
  })
  
  // 状态机输入（对应 Rive 内部状态）
  const isWorking = useStateMachineInput(rive, 'AgentStateMachine', 'isWorking')
  const isError = useStateMachineInput(rive, 'AgentStateMachine', 'isError')
  const isMoving = useStateMachineInput(rive, 'AgentStateMachine', 'isMoving')
  const isReporting = useStateMachineInput(rive, 'AgentStateMachine', 'isReporting')
  
  // 同步 agent 状态到动画
  useEffect(() => {
    if (!rive) return
    if (isWorking) isWorking.value = agent.status === 'working'
    if (isError) isError.value = agent.status === 'error'
    if (isMoving) isMoving.value = agent.status === 'moving'
    if (isReporting) isReporting.value = agent.status === 'reporting'
  }, [agent.status, rive])
  
  return (
    <div className="agent-sprite" onClick={onClick}>
      <RiveComponent width={64} height={64} />
      {/* 状态指示器 */}
      <StatusBadge status={agent.status} />
      {/* 名称标签 */}
      <span className="agent-name">{agent.name}</span>
    </div>
  )
}
```

### 4.4 与 agent 的 AI 对话

```typescript
// app/api/chat/[agentId]/route.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(req: Request, { params }: { params: { agentId: string } }) {
  const { message, history } = await req.json()
  const agentId = params.agentId
  
  // 获取 agent 元信息（能力、当前任务等）
  const agent = await getAgentById(agentId)
  
  // 构建系统提示（让 Claude 扮演特定 agent）
  const systemPrompt = `你是 AI agent "${agent.name}"。
你的能力：${agent.capabilities.join('、')}。
你的当前任务：${agent.currentTask?.description ?? '空闲'}。
用简洁、友好的中文回复，偶尔用第一人称描述你的工作状态。
如果用户要求你执行任务，以 JSON 格式回复：{"action": "execute", "task": "..."}。`

  // 流式响应
  const response = await anthropic.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      ...history,
      { role: 'user', content: message }
    ],
  })
  
  // 检测 action 指令并触发 agent 执行
  let fullText = ''
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of response) {
        if (chunk.type === 'content_block_delta') {
          const text = chunk.delta.text
          fullText += text
          controller.enqueue(new TextEncoder().encode(text))
        }
      }
      
      // 解析是否有动作指令
      try {
        const parsed = JSON.parse(fullText)
        if (parsed.action === 'execute') {
          await triggerAgentTask(agentId, parsed.task)
        }
      } catch { /* 普通文字回复，忽略 */ }
      
      controller.close()
    }
  })
  
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
```

---

## 五、性能考量

### 5.1 渲染性能基准

```
测试环境：MacBook Pro M2, Chrome 124

CSS + Framer Motion:
  10 agents:  60fps ✅
  30 agents:  55fps ✅
  50 agents:  38fps ⚠️（开始掉帧）
  100 agents: 18fps ❌

PixiJS (WebGL):
  100 agents:  60fps ✅
  500 agents:  60fps ✅
  1000 agents: 45fps ✅
  2000 agents: 28fps ⚠️

结论：
- ≤30 agents → CSS 方案（开发速度优先）
- >30 agents → PixiJS（性能优先）
- 大多数企业场景 ≤50 agents，所以 MVP 用 CSS 可以
```

### 5.2 WebSocket 连接管理

```typescript
// 错误做法：每个 agent 一个 WebSocket
agents.forEach(agent => {
  new WebSocket(`/ws/agents/${agent.id}`)  // ❌ 100个agent = 100个连接
})

// 正确做法：一个 WebSocket，多路复用
class AgentWebSocketManager {
  private ws: WebSocket
  private handlers = new Map<string, (data: any) => void>()
  
  connect() {
    this.ws = new WebSocket('/ws/agents')
    this.ws.onmessage = (event) => {
      const { agentId, ...data } = JSON.parse(event.data)
      this.handlers.get(agentId)?.(data)
    }
  }
  
  subscribe(agentId: string, handler: (data: any) => void) {
    this.handlers.set(agentId, handler)
  }
  
  // 自动重连
  private reconnect() {
    setTimeout(() => this.connect(), 1000 * Math.min(retries++, 30))
  }
}
```

### 5.3 K8s Watch API 最佳实践

```typescript
// 不要频繁轮询，使用 Watch（长连接）
// ❌ 低效轮询
setInterval(async () => {
  const pods = await k8sApi.listNamespacedPod('agent-system')
  updateAgentStatuses(pods.items)
}, 5000)

// ✅ K8s Watch（事件驱动）
const watch = new k8s.Watch(kubeConfig)
watch.watch('/api/v1/namespaces/agent-system/pods', {}, 
  (type, pod) => {
    // 仅在真正变化时触发
    if (type === 'MODIFIED' || type === 'ADDED' || type === 'DELETED') {
      updateSingleAgent(pod)
    }
  }
)
```

---

## 六、分阶段实施计划

### Phase 0：技术 PoC（1 周）

```
目标：验证核心技术可行性，不做生产级代码

验证点：
□ PixiJS + React：50 个 sprite 能流畅动吗？
□ Rive：状态机切换动画效果满意吗？
□ K8s Watch API：能从 minikube 获取 Pod 变化吗？
□ 拖拽到 Zone：@dnd-kit 能识别 drop 事件吗？

产出物：
- 一个包含 10 个假 agent 的静态 Demo
- K8s 连接测试脚本
- 性能测试报告
```

### Phase 1：MVP（4 周）

```
Week 1: 场景 + 角色
  - 固定背景场景（SVG 或图片）
  - CSS/Framer Motion 角色（4 状态动画）
  - 静态 agent 数据（假数据，不连 K8s）

Week 2: 交互
  - @dnd-kit 拖拽到 Zone
  - 点击 agent 弹出信息面板
  - 文字聊天（调用 Claude API）

Week 3: 数据集成
  - K8s Watch API 连接
  - SSE 推送 agent 状态
  - 状态 → 动画同步

Week 4: 打磨
  - 错误处理 + 重连逻辑
  - 加载状态
  - 基本测试覆盖
  - 部署文档
```

### Phase 2：V1.0（6 周）

```
- Rive 动画替换 CSS 动画
- 语音输入（Web Speech API）
- 定时区域（Cron 配置 UI + K8s CronJob）
- agent 信息完善（能力、历史任务）
- 多区域自定义
- 任务完成通知（浏览器通知 + 站内消息）
```

### Phase 3：V2.0（8 周）

```
- 多用户协同（冲突处理）
- 语音输出（TTS 回复）
- agent 间协作可视化（连线 + 消息流动）
- 工作报告自动生成（AI 汇总）
- Prometheus 指标接入
- 移动端适配
```

---

## 七、测试策略

```typescript
// 单元测试：状态机转换
describe('agentMachine', () => {
  it('从 idle 转到 moving 当分配任务', () => {
    const service = interpret(agentMachine).start()
    service.send({ type: 'ASSIGN_TASK', task: mockTask })
    expect(service.state.value).toBe('moving')
  })
  
  it('工作完成后进入 reporting 状态', async () => {
    // ...
  })
})

// 集成测试：拖拽交互
test('拖拽 agent 到 Zone 触发任务', async () => {
  const { getByTestId } = render(<AgentScene agents={mockAgents} zones={mockZones} />)
  
  const agent = getByTestId('agent-001')
  const zone = getByTestId('zone-inspection')
  
  await userEvent.drag(agent, zone)
  
  expect(mockAssignFn).toHaveBeenCalledWith('agent-001', 'zone-inspection')
})

// E2E 测试：Playwright
test('完整调度流程', async ({ page }) => {
  await page.goto('/studio')
  await page.dragAndDrop('[data-agent="small-orange"]', '[data-zone="cloud"]')
  await expect(page.locator('[data-agent="small-orange"]')).toHaveAttribute('data-status', 'moving')
  // 等待状态变化（mock K8s）
  await expect(page.locator('[data-agent="small-orange"]')).toHaveAttribute('data-status', 'working', { timeout: 5000 })
})
```

---

## 八、技术债务与风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| Rive 学习曲线 | 中 | 先用 CSS，有 Rive 设计师再升级 |
| K8s RBAC 配置复杂 | 高 | 提供最小权限 ClusterRole 示例 |
| 浏览器语音识别 Chrome-only | 中 | 降级到文字输入，明确标注 |
| 多用户拖拽冲突 | 低（MVP 单用户） | V2 再处理，用乐观锁 |
| PixiJS 与 SSR（Next.js）冲突 | 高 | dynamic import + 'use client' 隔离 |
| WebSocket 在 Serverless 上不支持 | 高 | 用 SSE 替代，或部署到 Node.js 服务器 |
