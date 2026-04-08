/**
 * agentPositionRegistry — a lightweight pub/sub position map for AgentCharacter nodes.
 *
 * Instead of having WorkflowEdges query the DOM every rAF tick, each AgentCharacter
 * registers its own position via ResizeObserver + IntersectionObserver when it
 * mounts/moves. WorkflowEdges subscribes once and only repaints when a position
 * actually changes — eliminating per-frame layout thrashing.
 */

export interface AgentPosition {
  x: number
  y: number
}

type Subscriber = (positions: Map<string, AgentPosition>) => void

class AgentPositionRegistry {
  private positions = new Map<string, AgentPosition>()
  private subscribers = new Set<Subscriber>()

  /** Called by AgentCharacter via ResizeObserver/useEffect */
  update(agentId: string, position: AgentPosition) {
    const prev = this.positions.get(agentId)
    if (prev && Math.abs(prev.x - position.x) < 0.5 && Math.abs(prev.y - position.y) < 0.5) {
      return // no meaningful change — skip notify
    }
    this.positions.set(agentId, position)
    this.notify()
  }

  /** Called when AgentCharacter unmounts */
  remove(agentId: string) {
    if (this.positions.has(agentId)) {
      this.positions.delete(agentId)
      this.notify()
    }
  }

  /** Subscribe to position changes. Returns unsubscribe fn. */
  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn)
    // Immediately deliver current snapshot
    fn(new Map(this.positions))
    return () => this.subscribers.delete(fn)
  }

  /** Get a one-time snapshot */
  snapshot(): Map<string, AgentPosition> {
    return new Map(this.positions)
  }

  private notify() {
    const snap = new Map(this.positions)
    this.subscribers.forEach(fn => fn(snap))
  }
}

// Module-level singleton — safe because Next.js Client Components all share the
// same browser JS context.
export const agentPositionRegistry = new AgentPositionRegistry()
