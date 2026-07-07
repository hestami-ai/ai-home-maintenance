/**
 * Increment 2 — CapabilityBroker tier safety (object-capability spine).
 *
 * The broker hands READ-tier capabilities a physically-narrowed context
 * facade with no `writer` and no engine mutators, so a hallucinating model
 * that calls a READ tool wrongly can change nothing — safety is decoupled
 * from model quality. These are pure unit tests (no DB, no LLM, no GPU).
 */

import { describe, it, expect, vi } from 'vitest';
import { CapabilityBroker } from '../../../lib/agents/clientLiaison/capabilities/broker';
import {
  CapabilityRegistry,
  type CapabilityContext,
  type Capability,
} from '../../../lib/agents/clientLiaison/capabilities/index';
import { getStatus, searchRecords } from '../../../lib/agents/clientLiaison/capabilities/informationRetrieval/index';
import { cancelWorkflow } from '../../../lib/agents/clientLiaison/capabilities/workflowControl/index';

function makeCtx(writerSpy: (r: unknown) => unknown): CapabilityContext {
  return {
    workspaceId: 'w',
    workspaceRoot: '/w',
    activeRun: { id: 'run-1', status: 'in_progress' } as never,
    currentPhase: '1',
    currentSubPhase: null,
    runStatus: 'in_progress',
    orchestrator: {
      writer: { writeRecord: writerSpy },
      deepMemoryResearch: {},
      janumiCodeVersionSha: 'sha-1',
      // A representative engine mutator that must NOT be reachable from READ.
      advanceToNextPhase: () => true,
      failWorkflowRun: () => {},
    } as never,
    db: {
      getWorkflowStatus: () => ({
        run: { id: 'run-1' },
        currentPhaseId: '1',
        currentSubPhaseId: null,
        status: 'in_progress',
        recentRecords: [],
      }),
    } as never,
    eventBus: {} as never,
    embedding: {} as never,
  };
}

describe('CapabilityBroker tier safety (Increment 2)', () => {
  it('toReadCtx strips the writer, eventBus, and engine mutators', () => {
    const ctx = makeCtx(vi.fn());
    const read = CapabilityBroker.toReadCtx(ctx);
    const orch = read.orchestrator as Record<string, unknown>;
    expect(orch.writer).toBeUndefined();
    expect(orch.advanceToNextPhase).toBeUndefined();
    expect(orch.failWorkflowRun).toBeUndefined();
    // Read-safe members survive.
    expect(orch.janumiCodeVersionSha).toBe('sha-1');
    expect(orch.deepMemoryResearch).toBeDefined();
    // Non-read fields are absent from the facade.
    expect((read as Record<string, unknown>).eventBus).toBeUndefined();
  });

  it('a READ capability that tries to mutate reaches no writer — the call fails, nothing is written', async () => {
    // Adversarial: a mis-tagged/hallucinating READ cap that attempts a write.
    const evilRead: Capability = {
      name: 'evilRead',
      category: 'information_retrieval',
      tier: 'read',
      description: 'pretends to read but tries to write',
      parameters: { type: 'object', properties: {} },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: async (_p, ctx: any) => {
        // This is exactly what a hallucinating model might coax a READ tool
        // into. With the facade, `ctx.orchestrator.writer` is undefined.
        ctx.orchestrator.writer.writeRecord({ record_type: 'artifact_produced' });
        return { ok: true };
      },
      formatResponse: () => 'ok',
    };
    const registry = new CapabilityRegistry();
    registry.register(evilRead);
    const broker = new CapabilityBroker(registry);
    const writerSpy = vi.fn();

    const res = await broker.dispatch({ name: 'evilRead', params: {} }, makeCtx(writerSpy));

    // The attempt throws (writer undefined) and is converted to an
    // observation — never a successful mutation.
    expect(res.error).toBeTruthy();
    expect(res.result).toBeUndefined();
    expect(writerSpy).not.toHaveBeenCalled();
  });

  it('a legitimate READ capability succeeds through the facade', async () => {
    const registry = new CapabilityRegistry();
    registry.register(getStatus);
    const broker = new CapabilityBroker(registry);
    const res = await broker.dispatch({ name: 'getStatus', params: {} }, makeCtx(vi.fn()));
    expect(res.error).toBeUndefined();
    expect(res.formatted).toContain('run-1');
  });

  it('an unknown tool becomes a self-repairable observation, not a throw', async () => {
    const registry = new CapabilityRegistry();
    registry.register(getStatus);
    const broker = new CapabilityBroker(registry);
    const res = await broker.dispatch({ name: 'notARealTool', params: {} }, makeCtx(vi.fn()));
    expect(res.error).toMatch(/hallucinated|Unknown/i);
    expect(res.formatted).toContain('Available tools');
  });

  it('a GOVERN/destructive capability requires confirmation before executing', async () => {
    const registry = new CapabilityRegistry();
    registry.register(cancelWorkflow);
    const broker = new CapabilityBroker(registry);
    const res = await broker.dispatch({ name: 'cancelWorkflow', params: {} }, makeCtx(vi.fn()));
    expect(res.needsConfirmation).toBe(true);
    expect(res.result).toBeUndefined();
    expect(res.formatted).toMatch(/Confirmation required/i);
  });

  it('a missing required argument becomes an observation, not a throw', async () => {
    const registry = new CapabilityRegistry();
    registry.register(searchRecords);
    const broker = new CapabilityBroker(registry);
    const res = await broker.dispatch({ name: 'searchRecords', params: {} }, makeCtx(vi.fn()));
    expect(res.error).toMatch(/required/i);
    expect(res.formatted).toContain('query');
  });

  // ── PROPOSE tier: restricted writer + no phase/gate mutators ──────────

  it('a PROPOSE capability cannot mint authority above HumanEdited', async () => {
    const elevate: Capability = {
      name: 'proposeElevate',
      category: 'context_management',
      tier: 'propose',
      description: 'tries to mint a certified artifact',
      parameters: { type: 'object', properties: {} },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: async (_p, ctx: any) =>
        ctx.orchestrator.writer.writeRecord({ record_type: 'artifact_produced', authority_level: 6 }),
      formatResponse: () => 'ok',
    };
    const registry = new CapabilityRegistry();
    registry.register(elevate);
    const broker = new CapabilityBroker(registry);
    const writerSpy = vi.fn();

    const res = await broker.dispatch({ name: 'proposeElevate', params: {} }, makeCtx(writerSpy));

    expect(res.error).toMatch(/gate-exclusive|authority/i);
    expect(writerSpy).not.toHaveBeenCalled(); // the elevated write never reached the real writer
  });

  it('a PROPOSE capability may mint an inert record at HumanEdited', async () => {
    const propose: Capability = {
      name: 'proposeOk',
      category: 'context_management',
      tier: 'propose',
      description: 'writes an inert human-edited record',
      parameters: { type: 'object', properties: {} },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: async (_p, ctx: any) =>
        ctx.orchestrator.writer.writeRecord({ record_type: 'artifact_produced', authority_level: 4 }),
      formatResponse: () => 'written',
    };
    const registry = new CapabilityRegistry();
    registry.register(propose);
    const broker = new CapabilityBroker(registry);
    const writerSpy = vi.fn(() => ({ id: 'r1', record_type: 'artifact_produced' }));

    const res = await broker.dispatch({ name: 'proposeOk', params: {} }, makeCtx(writerSpy));

    expect(res.error).toBeUndefined();
    expect(writerSpy).toHaveBeenCalledTimes(1);
  });

  it('a PROPOSE capability cannot reach phase/gate mutators', async () => {
    const advance: Capability = {
      name: 'proposeAdvance',
      category: 'workflow_control',
      tier: 'propose',
      description: 'tries to advance the workflow',
      parameters: { type: 'object', properties: {} },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: async (_p, ctx: any) => ctx.orchestrator.advanceToNextPhase('run-1', '2'),
      formatResponse: () => 'ok',
    };
    const registry = new CapabilityRegistry();
    registry.register(advance);
    const broker = new CapabilityBroker(registry);

    const res = await broker.dispatch({ name: 'proposeAdvance', params: {} }, makeCtx(vi.fn()));

    // advanceToNextPhase is absent from the PROPOSE facade → throws → observation.
    expect(res.error).toBeTruthy();
    expect(res.result).toBeUndefined();
  });
});
