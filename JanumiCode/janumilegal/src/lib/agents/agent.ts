/**
 * Agent interface.
 *
 * An agent is a bounded executor: it receives an AgentInvocationScope
 * envelope plus typed input, and returns typed output. The agent does not
 * decide workflow control — that lives in the orchestrator.
 *
 * Per docs/janumilegal_product_description.md §Bounded Agent Execution.
 */

import type { AgentInvocationScope } from '../scope/agentInvocationScope.js';

export interface AgentExecutionInput {
  readonly envelope: AgentInvocationScope;
  /** State input — schema-bound JSON. */
  readonly input: unknown;
}

export interface AgentExecutionOutput {
  readonly status: 'completed' | 'escalated' | 'blocked';
  readonly output?: unknown;
  readonly escalationReason?: string;
  readonly blockReason?: string;
  /** Agent-internal telemetry; written to the operational track only. */
  readonly metrics?: Record<string, number | string>;
}

export interface Agent {
  readonly agentId: string;
  execute(input: AgentExecutionInput): Promise<AgentExecutionOutput>;
}
