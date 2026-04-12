/**
 * EventBus — typed pub/sub for communication between extension host components
 * and for pushing real-time updates to the webview.
 * Based on JanumiCode Spec v2.3, §17.4.
 *
 * The extension host emits events; the webview panel subscribes and
 * translates them into postMessage calls.
 */

import { getLogger } from '../logging';

// ── Event Types ─────────────────────────────────────────────────────

export type EventType =
  | 'record:added'
  | 'record:updated'
  | 'record:quarantined'
  | 'phase:started'
  | 'phase:completed'
  | 'phase_gate:pending'
  | 'phase_gate:approved'
  | 'phase_gate:rejected'
  | 'agent:invocation_started'
  | 'agent:invocation_completed'
  | 'agent:reasoning_step'
  | 'agent:self_correction'
  | 'agent:tool_call'
  | 'mirror:presented'
  | 'menu:presented'
  | 'workflow:started'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'decision:requested'
  | 'decision:resolved'
  | 'inconsistency:escalated'
  | 'llm:queued'
  | 'llm:started'
  | 'llm:finished'
  | 'context:updated'
  | 'error:occurred';

export interface EventPayload {
  'record:added': { record: SerializedRecord };
  'record:updated': { id: string; fields: Record<string, unknown> };
  'record:quarantined': { id: string };
  'phase:started': { phaseId: string; phaseName: string };
  'phase:completed': { phaseId: string; phaseName: string };
  'phase_gate:pending': { phaseId: string };
  'phase_gate:approved': { phaseId: string };
  'phase_gate:rejected': { phaseId: string; reason: string };
  'agent:invocation_started': { invocationId: string; agentRole: string };
  'agent:invocation_completed': { invocationId: string; success: boolean };
  'agent:reasoning_step': { invocationId: string; content: string; sequencePosition: number };
  'agent:self_correction': { invocationId: string; content: string; sequencePosition: number };
  'agent:tool_call': { invocationId: string; toolName: string; params: string; sequencePosition: number };
  'mirror:presented': { mirrorId: string; artifactType: string };
  'menu:presented': { menuId: string; options: string[] };
  'workflow:started': { workflowRunId: string };
  'workflow:completed': { workflowRunId: string };
  'workflow:failed': { workflowRunId: string; error: string };
  'decision:requested': {
    runId: string;
    decisionId: string;
    surfaceType: 'mirror' | 'menu' | 'decision_bundle' | 'phase_gate';
  };
  'decision:resolved': {
    runId: string;
    decisionId: string;
    resolution: { type: string; payload?: Record<string, unknown> };
  };
  'inconsistency:escalated': {
    runId: string;
    escalationRecordId: string;
    description: string;
  };
  'llm:queued': { provider: string; lane: 'phase' | 'user_query'; queueDepth: number };
  'llm:started': { provider: string; lane: 'phase' | 'user_query' };
  'llm:finished': { provider: string; lane: 'phase' | 'user_query'; durationMs: number };
  'context:updated': {
    runId: string;
    summary: { activeFile: string | null; constraintCount: number; referenceCount: number };
  };
  'error:occurred': { message: string; context: string };
}

/** Minimal record shape sent to the webview */
export interface SerializedRecord {
  id: string;
  record_type: string;
  phase_id: string | null;
  sub_phase_id: string | null;
  produced_by_agent_role: string | null;
  produced_at: string;
  authority_level: number;
  quarantined: boolean;
  content: Record<string, unknown>;
}

type EventHandler<T extends EventType> = (payload: EventPayload[T]) => void;

// ── EventBus ────────────────────────────────────────────────────────

export class EventBus {
  private handlers = new Map<EventType, Set<EventHandler<EventType>>>();

  /**
   * Subscribe to an event type.
   * Returns a dispose function to unsubscribe.
   */
  on<T extends EventType>(event: T, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const set = this.handlers.get(event)!;
    set.add(handler as EventHandler<EventType>);

    return () => {
      set.delete(handler as EventHandler<EventType>);
    };
  }

  /**
   * Emit an event to all subscribers.
   */
  emit<T extends EventType>(event: T, payload: EventPayload[T]): void {
    const set = this.handlers.get(event);
    if (!set) return;

    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        getLogger().error('event', `Handler error for ${event}`, {
          error: err instanceof Error ? err.message : String(err),
          event,
        });
      }
    }
  }

  /**
   * Remove all handlers for an event type.
   */
  off(event: EventType): void {
    this.handlers.delete(event);
  }

  /**
   * Remove all handlers for all events.
   */
  clear(): void {
    this.handlers.clear();
  }
}
