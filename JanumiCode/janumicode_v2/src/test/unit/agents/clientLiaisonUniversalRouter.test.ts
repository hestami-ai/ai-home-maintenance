/**
 * Regression tests for the Universal Router / Client Liaison Agent
 * improvements introduced in Phases 1–3:
 *
 *   Phase 1 — DMR delegation for retrieval-type queries
 *   Phase 2a — escalateInconsistency capability (replaces dead double-write)
 *   Phase 2b — multi-turn conversation history pairing
 *   Phase 2c — declarative confirmation ritual on destructive capabilities
 *   Phase 3  — dryRunResearch capability
 *
 * Each section pins the contract so a future refactor that breaks the
 * assumption (e.g. silently skips DMR, drops `confirmation`, rewires
 * `escalateInconsistency`) surfaces as a test failure instead of a
 * mystery UX regression.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { EmbeddingService } from '../../../lib/embedding/embeddingService';

import { Retriever } from '../../../lib/agents/clientLiaison/retriever';
import { ClientLiaisonDBImpl } from '../../../lib/agents/clientLiaison/db';
import { escalateInconsistency } from '../../../lib/agents/clientLiaison/capabilities/decisionHistory/index';
import { cancelWorkflow } from '../../../lib/agents/clientLiaison/capabilities/workflowControl/index';
import { dryRunResearch } from '../../../lib/agents/clientLiaison/capabilities/informationRetrieval/index';

import type { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import type { CapabilityContext } from '../../../lib/agents/clientLiaison/capabilities/index';
import type {
  ContextPacket,
  RetrievalBrief,
} from '../../../lib/agents/deepMemoryResearch';
import type { OpenQuery, QueryType } from '../../../lib/agents/clientLiaison/types';
import type { WorkflowRun } from '../../../lib/types/records';

// ── Fixture helpers ─────────────────────────────────────────────────

let idCounter = 0;
function testId(): string { return `ur-${++idCounter}`; }

function makeQuery(overrides: Partial<OpenQuery> = {}): OpenQuery {
  return {
    id: 'q-1',
    text: 'explain the authentication design',
    workflowRunId: 'run-1',
    currentPhaseId: '1',
    references: [],
    ...overrides,
  };
}

function stubContextPacket(overrides: Partial<ContextPacket> = {}): ContextPacket {
  return {
    queryDecomposition: {
      topicEntities: ['authentication'],
      decisionTypesSought: [],
      temporalScope: { from: '', to: '' },
      authorityLevelsIncluded: [],
      sourcesInScope: ['governed_stream'],
    },
    completenessStatus: 'complete',
    completenessNarrative: 'full coverage',
    unavailableSources: [],
    materialFindings: [],
    activeConstraints: [],
    supersessionChains: [],
    contradictions: [],
    openQuestions: [],
    implicitDecisions: [],
    recommendedDrilldowns: [],
    coverageAssessment: {
      sourcesQueried: ['governed_stream'],
      sourcesUnavailable: [],
      knownGaps: [],
      confidence: 0.95,
    },
    ...overrides,
  };
}

function stubWorkflowRun(id = 'run-1'): WorkflowRun {
  return {
    id,
    workspace_id: 'ws-1',
    janumicode_version_sha: 'abc',
    initiated_at: '2026-01-01T00:00:00Z',
    completed_at: null,
    status: 'in_progress',
    current_phase_id: '1',
    current_sub_phase_id: '1.2',
    raw_intent_record_id: null,
    scope_classification_ref: null,
    compliance_context_ref: null,
    cross_run_impact_triggered: false,
  };
}

// ── Phase 1: DMR delegation ─────────────────────────────────────────

describe('Retriever — DMR delegation (Phase 1)', () => {
  let db: Database;
  let cdb: ClientLiaisonDBImpl;
  let embedding: EmbeddingService;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'in_progress')
    `).run();
    embedding = new EmbeddingService(db, { provider: 'ollama', model: 'x', maxParallel: 1 });
    cdb = new ClientLiaisonDBImpl(db, embedding);
  });

  afterEach(() => { db.close(); });

  function stubEngine(research: (b: RetrievalBrief) => Promise<ContextPacket>): OrchestratorEngine {
    return {
      deepMemoryResearch: { research },
    } as unknown as OrchestratorEngine;
  }

  const DMR_DELEGATED: QueryType[] = [
    'historical_lookup',
    'rationale_request',
    'forward_implication',
    'ambient_clarification',
    'artifact_request',
    'consistency_challenge',
  ];

  for (const queryType of DMR_DELEGATED) {
    it(`delegates ${queryType} to DMR and attaches contextPacket`, async () => {
      const research = vi.fn().mockResolvedValue(stubContextPacket());
      const retriever = new Retriever(cdb, stubEngine(research));

      const result = await retriever.retrieve(queryType, makeQuery());

      expect(research).toHaveBeenCalledTimes(1);
      const brief = research.mock.calls[0][0] as RetrievalBrief;
      expect(brief.requestingAgentRole).toBe('client_liaison_agent');
      expect(brief.subPhaseId).toBe(`liaison:${queryType}`);
      expect(brief.scopeTier).toBe('all_runs');
      expect(result.strategy).toBe(`dmr:${queryType}`);
      expect(result.contextPacket).toBeDefined();
    });
  }

  it('does NOT invoke DMR for workflow_initiation', async () => {
    const research = vi.fn().mockResolvedValue(stubContextPacket());
    const retriever = new Retriever(cdb, stubEngine(research));

    const result = await retriever.retrieve('workflow_initiation', makeQuery());

    expect(research).not.toHaveBeenCalled();
    expect(result.strategy).toBe('no_retrieval');
    expect(result.contextPacket).toBeUndefined();
  });

  it('does NOT invoke DMR for status_check', async () => {
    const research = vi.fn().mockResolvedValue(stubContextPacket());
    const retriever = new Retriever(cdb, stubEngine(research));

    const result = await retriever.retrieve('status_check', makeQuery());

    expect(research).not.toHaveBeenCalled();
    expect(result.strategy).toBe('workflow_state');
    expect(result.contextPacket).toBeUndefined();
  });

  it('falls back to legacy strategy when DMR throws', async () => {
    const research = vi.fn().mockRejectedValue(new Error('DMR boom'));
    const retriever = new Retriever(cdb, stubEngine(research));

    const result = await retriever.retrieve('historical_lookup', makeQuery());

    expect(research).toHaveBeenCalledTimes(1);
    expect(result.strategy).toMatch(/^legacy_/);
    expect(result.contextPacket).toBeUndefined();
  });

  it('legacy-only retriever (no engine) never reaches DMR', async () => {
    const retriever = new Retriever(cdb); // no engine
    const result = await retriever.retrieve('historical_lookup', makeQuery());
    expect(result.strategy).toMatch(/^legacy_/);
    expect(result.contextPacket).toBeUndefined();
  });
});

// ── Phase 2a: escalateInconsistency capability ──────────────────────

describe('escalateInconsistency capability (Phase 2a)', () => {
  function buildCtx(args: {
    activeRun: WorkflowRun | null;
    escalateSpy?: ReturnType<typeof vi.fn>;
  }): CapabilityContext {
    const escalateSpy = args.escalateSpy ?? vi.fn(() => 'esc-1');
    return {
      workspaceId: 'ws-1',
      workspaceRoot: '/ws',
      activeRun: args.activeRun,
      currentPhase: '1',
      currentSubPhase: '1.2',
      runStatus: null,
      orchestrator: {
        escalateInconsistency: escalateSpy,
      } as unknown as CapabilityContext['orchestrator'],
      db: {} as CapabilityContext['db'],
      eventBus: {} as CapabilityContext['eventBus'],
      embedding: {} as CapabilityContext['embedding'],
    };
  }

  it('calls orchestrator.escalateInconsistency with the conflicting records', async () => {
    const escalateSpy = vi.fn(() => 'esc-42');
    const ctx = buildCtx({ activeRun: stubWorkflowRun(), escalateSpy });

    const out = await escalateInconsistency.execute(
      {
        description: 'ADR contradicts chosen stack',
        conflicting_record_ids: ['rec-a', 'rec-b'],
      },
      ctx,
    );

    expect(escalateSpy).toHaveBeenCalledTimes(1);
    const call = escalateSpy.mock.calls[0][0] as {
      runId: string;
      userQueryRecordId: string;
      conflictingRecordIds: string[];
      description: string;
    };
    expect(call.runId).toBe('run-1');
    expect(call.conflictingRecordIds).toEqual(['rec-a', 'rec-b']);
    expect(call.userQueryRecordId).toBe('rec-a');
    expect(out.escalationRecordId).toBe('esc-42');
    expect(out.conflictingRecordIds).toEqual(['rec-a', 'rec-b']);
  });

  it('precondition blocks escalation when there is no active run', () => {
    const ctx = buildCtx({ activeRun: null });
    const result = escalateInconsistency.preconditions?.(ctx);
    expect(result).toBe('No active workflow run — nothing to escalate.');
  });

  it('rejects fewer than two conflicting record IDs', async () => {
    const ctx = buildCtx({ activeRun: stubWorkflowRun() });
    await expect(
      escalateInconsistency.execute(
        { description: 'solo conflict', conflicting_record_ids: ['only-one'] },
        ctx,
      ),
    ).rejects.toThrow(/at least two/i);
  });

  it('formatResponse cites all conflicting record IDs', () => {
    const text = escalateInconsistency.formatResponse({
      escalationRecordId: 'esc-1',
      conflictingRecordIds: ['r-a', 'r-b', 'r-c'],
      description: 'three-way contradiction',
    });
    expect(text).toContain('esc-1');
    expect(text).toContain('r-a');
    expect(text).toContain('r-b');
    expect(text).toContain('r-c');
    expect(text).toContain('three-way contradiction');
  });
});

// ── Phase 2b: multi-turn conversation history ───────────────────────

describe('getRecentConversationTurns (Phase 2b)', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let embedding: EmbeddingService;
  let cdb: ClientLiaisonDBImpl;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'in_progress')
    `).run();
    writer = new GovernedStreamWriter(db, testId);
    embedding = new EmbeddingService(db, { provider: 'ollama', model: 'x', maxParallel: 1 });
    cdb = new ClientLiaisonDBImpl(db, embedding);
  });

  afterEach(() => { db.close(); });

  it('pairs each client_liaison_response with its originating query record', () => {
    const q1 = writer.writeRecord({
      record_type: 'open_query_received',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: { text: 'first question' },
    });
    writer.writeRecord({
      record_type: 'client_liaison_response',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      derived_from_record_ids: [q1.id],
      content: { response_text: 'first answer' },
    });
    const q2 = writer.writeRecord({
      record_type: 'open_query_received',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: { text: 'second question' },
    });
    writer.writeRecord({
      record_type: 'client_liaison_response',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      derived_from_record_ids: [q2.id],
      content: { response_text: 'second answer' },
    });

    const turns = cdb.getRecentConversationTurns('run-1', 5);

    expect(turns).toHaveLength(2);
    // Assert correct pairing regardless of sub-millisecond sort order:
    // the invariant we care about is that each response is paired with
    // the right query, not the exact ordering between same-millisecond
    // inserts (which cannot occur in real usage).
    const texts = turns.map(t => t.queryRecord.content.text as string).sort();
    expect(texts).toEqual(['first question', 'second question']);
    for (const t of turns) {
      const q = t.queryRecord.content.text as string;
      const a = t.responseRecord.content.response_text as string;
      const ordinal = q.split(' ')[0]; // 'first' or 'second'
      expect(a).toBe(`${ordinal} answer`);
    }
  });

  it('skips responses whose originating record is not a query type', () => {
    // A response derived_from a decision_trace (not a query) must be
    // filtered out — it isn't a user turn.
    const someOtherRecord = writer.writeRecord({
      record_type: 'decision_trace',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: { decision_type: 'menu_selection' },
    });
    writer.writeRecord({
      record_type: 'client_liaison_response',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      derived_from_record_ids: [someOtherRecord.id],
      content: { response_text: 'not really a turn' },
    });

    const turns = cdb.getRecentConversationTurns('run-1', 5);
    expect(turns).toHaveLength(0);
  });

  it('respects the limit parameter', () => {
    for (let i = 0; i < 7; i++) {
      const q = writer.writeRecord({
        record_type: 'open_query_received',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { text: `question ${i}` },
      });
      writer.writeRecord({
        record_type: 'client_liaison_response',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        derived_from_record_ids: [q.id],
        content: { response_text: `answer ${i}` },
      });
    }

    const turns = cdb.getRecentConversationTurns('run-1', 3);
    expect(turns).toHaveLength(3);
  });
});

// ── Phase 2c: declarative confirmation ritual ───────────────────────

describe('cancelWorkflow confirmation ritual (Phase 2c)', () => {
  it('declares a confirmation prompt instead of relying on execute() throwing', () => {
    expect(cancelWorkflow.confirmation).toBeDefined();
    expect(typeof cancelWorkflow.confirmation?.prompt).toBe('function');
  });

  it('does not mark `confirmed` as required — framework handles it declaratively', () => {
    const params = cancelWorkflow.parameters as {
      required?: string[];
    };
    expect(params.required ?? []).not.toContain('confirmed');
  });

  it('confirmation prompt names the workflow run it will cancel', () => {
    const run = stubWorkflowRun('run-42');
    const ctx = {
      activeRun: run,
      orchestrator: {
        stateMachine: {
          getWorkflowRun: () => run,
          failWorkflowRun: vi.fn(),
        },
      },
    } as unknown as CapabilityContext;

    const prompt = cancelWorkflow.confirmation!.prompt({}, ctx);
    expect(prompt).toContain('run-42');
    expect(prompt.toLowerCase()).toContain('cancel');
    expect(prompt).toContain('Confirm?');
  });

  it('execute() proceeds without checking a `confirmed` flag (framework gates it)', async () => {
    const failSpy = vi.fn();
    const run = stubWorkflowRun('run-7');
    const ctx = {
      activeRun: run,
      orchestrator: {
        stateMachine: {
          getWorkflowRun: () => run,
          failWorkflowRun: failSpy,
        },
      },
    } as unknown as CapabilityContext;

    const result = await cancelWorkflow.execute({}, ctx);

    expect(failSpy).toHaveBeenCalledWith('run-7');
    expect(result.status).toBe('cancelled');
  });
});

// ── Phase 3: dryRunResearch capability ──────────────────────────────

describe('dryRunResearch capability (Phase 3)', () => {
  function buildCtx(
    research: (b: RetrievalBrief) => Promise<ContextPacket>,
    opts: { currentSubPhase?: string | null } = {},
  ): CapabilityContext {
    return {
      workspaceId: 'ws-1',
      workspaceRoot: '/ws',
      activeRun: stubWorkflowRun('run-9'),
      currentPhase: '2',
      currentSubPhase: opts.currentSubPhase ?? null,
      runStatus: null,
      orchestrator: {
        deepMemoryResearch: { research },
      } as unknown as CapabilityContext['orchestrator'],
      db: {} as CapabilityContext['db'],
      eventBus: {} as CapabilityContext['eventBus'],
      embedding: {} as CapabilityContext['embedding'],
    };
  }

  it('invokes DMR with the user query and scope', async () => {
    const research = vi.fn().mockResolvedValue(stubContextPacket());
    const ctx = buildCtx(research);

    const result = await dryRunResearch.execute(
      { query: 'what do we know about session tokens', scope: 'all_runs' },
      ctx,
    );

    expect(research).toHaveBeenCalledTimes(1);
    const brief = research.mock.calls[0][0] as RetrievalBrief;
    expect(brief.query).toBe('what do we know about session tokens');
    expect(brief.scopeTier).toBe('all_runs');
    expect(brief.requestingAgentRole).toBe('client_liaison_agent');
    // When ctx.currentSubPhase is null the capability falls back to the
    // diagnostic 'liaison:dry_run' marker so DMR records it clearly.
    expect(brief.subPhaseId).toBe('liaison:dry_run');
    expect(result.query).toBe('what do we know about session tokens');
    expect(result.scope).toBe('all_runs');
  });

  it('defaults scope to all_runs when omitted', async () => {
    const research = vi.fn().mockResolvedValue(stubContextPacket());
    const ctx = buildCtx(research);

    await dryRunResearch.execute({ query: 'anything' }, ctx);

    const brief = research.mock.calls[0][0] as RetrievalBrief;
    expect(brief.scopeTier).toBe('all_runs');
  });

  it('flattens ContextPacket into the summary shape (materialFindings clipped to 10)', async () => {
    const findings = Array.from({ length: 15 }, (_, i) => ({
      id: `f-${i}`,
      recordType: 'artifact',
      authorityLevel: 5,
      governingStatus: 'active' as const,
      summary: `finding ${i}`,
      sourceRecordIds: [],
      materialityScore: 0.5,
    }));
    const research = vi.fn().mockResolvedValue(stubContextPacket({
      materialFindings: findings,
      activeConstraints: [
        { id: 'c-1', statement: 'must be auditable', authorityLevel: 7, sourceRecordIds: [] },
      ],
      supersessionChains: [
        { subject: 's-1', chain: [{ recordId: 'r-a', position: 'current_governing', timestamp: 't' }] },
      ],
      contradictions: [
        { recordIds: ['x', 'y'], explanation: 'mismatch', resolutionStatus: 'unresolved' },
      ],
    }));
    const ctx = buildCtx(research);

    const result = await dryRunResearch.execute({ query: 'big query' }, ctx);

    expect(result.materialFindings).toHaveLength(10);
    expect(result.activeConstraints).toEqual([
      { id: 'c-1', statement: 'must be auditable', authorityLevel: 7 },
    ]);
    expect(result.supersessionCount).toBe(1);
    expect(result.contradictionCount).toBe(1);
  });

  it('formatResponse renders a markdown report with section headers', () => {
    const text = dryRunResearch.formatResponse({
      query: 'auth strategy',
      scope: 'all_runs',
      completenessStatus: 'complete',
      completenessNarrative: 'full coverage',
      topicEntities: ['authentication', 'oauth'],
      materialFindings: [
        { id: 'f-1', recordType: 'decision_trace', authorityLevel: 7, governingStatus: 'active', summary: 'picked oauth', materialityScore: 0.9 },
      ],
      activeConstraints: [
        { id: 'c-1', statement: 'must use oauth', authorityLevel: 7 },
      ],
      supersessionCount: 0,
      contradictionCount: 0,
      openQuestions: [],
      knownGaps: [],
    });

    expect(text).toContain('Deep Memory Research');
    expect(text).toContain('auth strategy');
    expect(text).toContain('all_runs');
    expect(text).toContain('complete');
    expect(text).toContain('authentication, oauth');
    expect(text).toContain('[ref:f-1]');
    expect(text).toContain('[ref:c-1]');
  });
});
