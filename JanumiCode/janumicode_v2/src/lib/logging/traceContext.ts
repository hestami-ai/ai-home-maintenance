/**
 * TraceContext - correlation context that flows through all log entries
 * for a single user request.
 */

export interface TraceContext {
  /** Unique ID for this request trace (propagates through all agents) */
  trace_id: string;
  /** Current workflow run ID */
  workflow_run_id: string | null;
  /** Current phase ID */
  phase_id: string | null;
  /** Current sub-phase ID */
  sub_phase_id: string | null;
  /** Agent role currently executing */
  agent_role: string | null;
  /** Parent record ID for causal chains */
  parent_record_id: string | null;
}

/**
 * Create a new trace context with a unique trace_id.
 */
export function createTraceContext(overrides: Partial<TraceContext> = {}): TraceContext {
  return {
    trace_id: overrides.trace_id ?? generateTraceId(),
    workflow_run_id: overrides.workflow_run_id ?? null,
    phase_id: overrides.phase_id ?? null,
    sub_phase_id: overrides.sub_phase_id ?? null,
    agent_role: overrides.agent_role ?? null,
    parent_record_id: overrides.parent_record_id ?? null,
  };
}

/**
 * Create a child trace context (inherits trace_id, updates other fields).
 */
export function childTraceContext(parent: TraceContext, overrides: Partial<TraceContext> = {}): TraceContext {
  return {
    ...parent,
    ...overrides,
  };
}

/**
 * Generate a unique trace ID (8-character hex for readability).
 */
function generateTraceId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
