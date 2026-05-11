/**
 * Agent runtime — invocation flow with envelope validation, capability
 * checking, op-track logging, and capability-policy enforcement.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 2 §2.3:
 *   - AgentInvocationScope envelope mandatory on every agent call.
 *   - Capability-group exclusivity enforcement.
 *   - mayApproveRelease=true rejected for AI agents.
 *   - Op-track logging for every invocation start/finish.
 */

import { randomUUID } from 'node:crypto';
import type { Agent, AgentExecutionInput, AgentExecutionOutput } from './agent.js';
import { validateEnvelope, type AgentInvocationScope } from '../scope/agentInvocationScope.js';
import type { AgentRegistry, AgentRegistryEntry } from '../registry/agentRegistry.js';
import type { OpStreamDal } from '../database/opStreamDal.js';

export class AgentInvocationError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'AgentInvocationError';
  }
}

export interface AgentRuntimeOptions {
  readonly registry: AgentRegistry;
  readonly opStream: OpStreamDal;
}

export class AgentRuntime {
  private readonly agents = new Map<string, Agent>();

  constructor(private readonly options: AgentRuntimeOptions) {}

  /** Bind an agent implementation to a registered agentId. */
  bindAgent(agent: Agent): void {
    if (!this.options.registry.has(agent.agentId)) {
      throw new AgentInvocationError(
        `agent ${agent.agentId} not registered; register it before binding an implementation`,
        'AGENT_NOT_REGISTERED',
      );
    }
    this.agents.set(agent.agentId, agent);
  }

  hasBoundAgent(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Invoke an agent.
   *
   * Performs (in order):
   *   1. Envelope validation — required fields, no forbidden self-scope.
   *   2. Registry lookup + capability-policy enforcement.
   *   3. Lens/state permission check.
   *   4. Op-track 'agent_invoked' write.
   *   5. Agent execution.
   *   6. Op-track 'agent_completed' or 'agent_failed' write.
   */
  async invoke(agentId: string, input: AgentExecutionInput): Promise<AgentExecutionOutput> {
    const env = input.envelope;
    const valid = validateEnvelope(env);
    if (!valid.ok) {
      throw new AgentInvocationError(`envelope invalid: ${valid.errors.join('; ')}`, 'ENVELOPE_INVALID');
    }

    const entry = this.options.registry.get(agentId);
    if (!entry) {
      throw new AgentInvocationError(`agent ${agentId} not in registry`, 'AGENT_NOT_REGISTERED');
    }

    if (entry.confidencePolicy.mayApproveRelease) {
      // Defence in depth — agentRegistry.register already rejects this; check again here.
      throw new AgentInvocationError(
        `agent ${agentId} declares mayApproveRelease=true; AI agents may not approve release`,
        'CAPABILITY_POLICY_VIOLATION',
      );
    }

    const lensAllowed = entry.permittedLenses.includes(env.lensId) || entry.permittedLenses.includes('*');
    if (!lensAllowed) {
      throw new AgentInvocationError(
        `agent ${agentId} not permitted on lens ${env.lensId}`,
        'LENS_NOT_PERMITTED',
      );
    }
    const stateAllowed = entry.permittedStates.includes(env.stateId) || entry.permittedStates.includes('*');
    if (!stateAllowed) {
      throw new AgentInvocationError(
        `agent ${agentId} not permitted in state ${env.stateId}`,
        'STATE_NOT_PERMITTED',
      );
    }

    const impl = this.agents.get(agentId);
    if (!impl) {
      throw new AgentInvocationError(`no implementation bound for agent ${agentId}`, 'NO_IMPLEMENTATION');
    }

    const runId = randomUUID();
    this.options.opStream.write({
      eventType: 'agent_invoked',
      firmId: env.firmId,
      clientId: env.clientId,
      matterId: env.matterId,
      payload: this.opMetadata(agentId, env, entry, runId),
    });

    try {
      const output = await impl.execute(input);
      this.options.opStream.write({
        eventType: 'agent_completed',
        firmId: env.firmId,
        clientId: env.clientId,
        matterId: env.matterId,
        payload: { ...this.opMetadata(agentId, env, entry, runId), status: output.status },
      });
      return output;
    } catch (err) {
      this.options.opStream.write({
        eventType: 'agent_failed',
        firmId: env.firmId,
        clientId: env.clientId,
        matterId: env.matterId,
        payload: { ...this.opMetadata(agentId, env, entry, runId), errorClass: (err as Error).name },
      });
      throw err;
    }
  }

  /** Op-track metadata only — no client identifiers, no substantive content. */
  private opMetadata(agentId: string, env: AgentInvocationScope, entry: AgentRegistryEntry, runId: string): Record<string, unknown> {
    return {
      agentId,
      agentVersion: entry.version,
      tier: entry.tier,
      lensId: env.lensId,
      lensVersion: env.lensVersion,
      stateId: env.stateId,
      runId,
      authorizedSourceCount: env.authorizedSources.length,
      authorizedArtifactCount: env.authorizedPriorArtifacts.length,
      authorizedMMPCount: env.authorizedMMP.length,
      forbiddenScopeCount: env.forbiddenScopes.length,
    };
  }
}

