/**
 * Replay agents — Wave 6 test fixture.
 *
 * Each replay agent emits a state-output payload sourced from the gold matter
 * fixture. This proves the orchestrator + manifest + agent registry +
 * activation-DAL + assertion runner pipeline runs end-to-end. Wave 7+ swaps
 * replay agents for LLM-backed implementations.
 */

import type { Agent, AgentExecutionInput, AgentExecutionOutput } from '../../lib/agents/agent.js';

export class ReplayAgent implements Agent {
  constructor(
    public readonly agentId: string,
    private readonly output: unknown,
  ) {}

  async execute(_input: AgentExecutionInput): Promise<AgentExecutionOutput> {
    return { status: 'completed', output: this.output };
  }
}
