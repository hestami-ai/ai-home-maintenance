/**
 * Increment 5 — regenerateCollection ("generate more") routing.
 *
 * Verifies the GOVERN capability's deterministic routing through the broker
 * (no DB, no LLM, no GPU):
 *   - confirmation is required before it acts;
 *   - Case A (an open bloom gate) resolves that gate with the guidance as
 *     free_text_feedback, waking the existing bloom feedback loop;
 *   - Case B (no open gate) records the governed request for the next revision;
 *   - a collection_regeneration_requested record is always written.
 *
 * The live re-bloom execution (delta-only re-cert of a certified collection +
 * the scope-gatekeeper human-authored exclusion) is deferred to work that must
 * be validated on a cal run; this covers the routing decision only.
 */

import { describe, it, expect, vi } from 'vitest';
import { CapabilityBroker } from '../../../lib/agents/clientLiaison/capabilities/broker';
import { CapabilityRegistry, type CapabilityContext } from '../../../lib/agents/clientLiaison/capabilities/index';
import { regenerateCollection } from '../../../lib/agents/clientLiaison/capabilities/workflowControl/index';

interface Spies {
  writeRecord: ReturnType<typeof vi.fn>;
  resolveDecision: ReturnType<typeof vi.fn>;
  pendingDecisionSurfaces: ReturnType<typeof vi.fn>;
}

function makeCtx(opts: {
  pending?: Array<{ decisionId: string; surfaceType: string }>;
  resolveReturns?: boolean;
}): { ctx: CapabilityContext; spies: Spies } {
  const writeRecord = vi.fn((rec: Record<string, unknown>) => ({ id: 'req-1', ...rec }));
  const resolveDecision = vi.fn(() => opts.resolveReturns ?? false);
  const pendingDecisionSurfaces = vi.fn(() => opts.pending ?? []);
  const ctx = {
    workspaceId: 'w', workspaceRoot: '/w',
    activeRun: { id: 'run-1', status: 'in_progress' } as never,
    currentPhase: '1', currentSubPhase: null, runStatus: 'in_progress',
    orchestrator: {
      writer: { writeRecord },
      janumiCodeVersionSha: 'sha',
      resolveDecision,
      pendingDecisionSurfaces,
    } as never,
    db: {} as never,
    eventBus: {} as never,
    embedding: {} as never,
  };
  return { ctx, spies: { writeRecord, resolveDecision, pendingDecisionSurfaces } };
}

function brokerFor() {
  const registry = new CapabilityRegistry();
  registry.register(regenerateCollection);
  return new CapabilityBroker(registry);
}

describe('regenerateCollection routing (Increment 5)', () => {
  it('requires confirmation before doing anything', async () => {
    const broker = brokerFor();
    const { ctx, spies } = makeCtx({});
    const res = await broker.dispatch(
      { name: 'regenerateCollection', params: { collectionKind: 'user_journeys', guidance: 'more admin journeys' } },
      ctx,
    );
    expect(res.needsConfirmation).toBe(true);
    expect(spies.writeRecord).not.toHaveBeenCalled();
    expect(spies.resolveDecision).not.toHaveBeenCalled();
  });

  it('Case A — resolves an open bloom gate with the guidance as free_text_feedback', async () => {
    const broker = brokerFor();
    const { ctx, spies } = makeCtx({
      pending: [{ decisionId: 'bundle-1', surfaceType: 'decision_bundle' }],
      resolveReturns: true,
    });
    const res = await broker.dispatch(
      {
        name: 'regenerateCollection',
        params: { collectionKind: 'user_journeys', guidance: 'more admin journeys', confirmed: true },
      },
      ctx,
    );
    const result = res.result as { mode: string; decisionId?: string };
    expect(result.mode).toBe('rebloom_pending_gate');
    expect(result.decisionId).toBe('bundle-1');
    // The gate was resolved with free-text feedback carrying the guidance.
    expect(spies.resolveDecision).toHaveBeenCalledWith('bundle-1', {
      type: 'decision_bundle_resolution',
      payload: { free_text_feedback: 'more admin journeys' },
    });
    // The governed request record was written.
    expect(spies.writeRecord).toHaveBeenCalledTimes(1);
    expect(spies.writeRecord.mock.calls[0][0].record_type).toBe('collection_regeneration_requested');
  });

  it('Case B — no open gate: records the governed request for the next revision', async () => {
    const broker = brokerFor();
    const { ctx, spies } = makeCtx({ pending: [] });
    const res = await broker.dispatch(
      {
        name: 'regenerateCollection',
        params: { collectionKind: 'requirements', guidance: 'more NFR coverage', confirmed: true },
      },
      ctx,
    );
    const result = res.result as { mode: string };
    expect(result.mode).toBe('recorded_pending_revision');
    expect(spies.resolveDecision).not.toHaveBeenCalled();
    expect(spies.writeRecord).toHaveBeenCalledTimes(1);
    const rec = spies.writeRecord.mock.calls[0][0];
    expect(rec.record_type).toBe('collection_regeneration_requested');
    expect((rec.content as { collection_kind?: string }).collection_kind).toBe('requirements');
    expect((rec.content as { preserve_accepted?: boolean }).preserve_accepted).toBe(true);
  });
});
