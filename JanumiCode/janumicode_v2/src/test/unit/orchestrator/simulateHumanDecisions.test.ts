/**
 * Headless simulate-human-decisions mode — verifies the auto-advance loop
 * CERTIFIES each phase gate (writes phase_gate_approved + ingests it →
 * `validates` edges → Authority-6 elevation) instead of advancing silently.
 *
 * This is the headless exerciser for the DMR's active_constraints
 * accumulation, which is otherwise dormant because auto-approve never
 * produces a phase_gate_approved record (Finding 1 of the DMR audit).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import type { PhaseContext, PhaseHandler, PhaseResult } from '../../../lib/orchestrator/orchestratorEngine';
import type { PhaseId } from '../../../lib/types/records';

/**
 * A phase handler that emits a governing artifact plus a phase_gate_evaluation
 * deriving from it — exactly what a real phase produces and what the
 * certification reads to know which artifacts the gate certifies.
 */
class GateEmittingHandler implements PhaseHandler {
  public artifactId = '';
  public gateId = '';
  constructor(
    public readonly phaseId: PhaseId,
    private readonly engine: OrchestratorEngine,
  ) {}
  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const runId = ctx.workflowRun.id;
    const artifact = this.engine.writer.writeRecord({
      record_type: 'artifact_produced', schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: this.phaseId, janumicode_version_sha: this.engine.janumiCodeVersionSha,
      content: { kind: 'system_boundary', statement: 'single-tenant' },
    });
    this.artifactId = artifact.id;
    const gate = this.engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation', schema_version: '1.0',
      workflow_run_id: runId, phase_id: this.phaseId,
      janumicode_version_sha: this.engine.janumiCodeVersionSha,
      derived_from_record_ids: [artifact.id],
      content: { kind: 'gate' },
    });
    this.gateId = gate.id;
    return { success: true, artifactIds: [artifact.id, gate.id] };
  }
}

describe('OrchestratorEngine — simulate-human-decisions gate certification', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const extensionPath = path.resolve(__dirname, '..', '..', '..', '..');
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));
    engine = new OrchestratorEngine(db, configManager, workspacePath, extensionPath);
    engine.setAutoApproveDecisions(true);
  });

  afterEach(() => { db.close(); });

  it('certifies the phase gate (phase_gate_approved + validates edges) when enabled', async () => {
    engine.setSimulateHumanDecisions(true);
    engine.setPhaseLimit('1'); // certify phase 1's gate, then stop.
    const handler = new GateEmittingHandler('1', engine);
    engine.registerPhase(new GateEmittingHandler('0', engine));
    engine.registerPhase(handler);

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    await engine.executeCurrentPhase(run.id);

    // The gate was certified: a phase_gate_approved record carries the
    // certified artifact top-level, and a system_asserted `validates` edge
    // points to it.
    const approved = engine.writer.getRecordsByType(run.id, 'phase_gate_approved');
    expect(approved.length).toBe(1);
    expect(approved[0].content.approved_artifact_ids).toEqual([handler.artifactId]);

    const edges = db.prepare(
      `SELECT target_record_id FROM memory_edge
       WHERE edge_type='validates' AND status='system_asserted' AND source_record_id=?`,
    ).all(approved[0].id) as Array<{ target_record_id: string }>;
    expect(edges.map(e => e.target_record_id)).toEqual([handler.artifactId]);
  });

  it('does NOT certify gates when simulate mode is off (default headless behavior)', async () => {
    engine.setPhaseLimit('1');
    engine.registerPhase(new GateEmittingHandler('0', engine));
    engine.registerPhase(new GateEmittingHandler('1', engine));

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    await engine.executeCurrentPhase(run.id);

    // No phase_gate_approved — auto-approve advanced silently (the dormancy
    // the simulate flag exists to lift).
    expect(engine.writer.getRecordsByType(run.id, 'phase_gate_approved').length).toBe(0);
  });

  it('decision agent (opt-in) records the LLM selection + rationale on the trace', async () => {
    process.env.JANUMICODE_SIMULATE_DECISION_AGENT = '1';
    try {
      // Stub the orchestrator-routed LLM the decision agent calls.
      (engine as unknown as { callForRole: unknown }).callForRole = async () => ({
        parsed: { selection: 'approve', rationale: 'Single-tenant fits the stated scope and avoids premature multi-tenant complexity.' },
        text: '', raw: '',
      });

      const { run } = engine.startWorkflowRun('ws-1', 'test');
      const surface = engine.writer.writeRecord({
        record_type: 'mirror_presented', schema_version: '1.0', workflow_run_id: run.id,
        phase_id: '1', janumicode_version_sha: engine.janumiCodeVersionSha,
        content: { kind: 'mirror', assumptions: [{ id: 'a1', text: 'single tenant' }] },
      });

      const resolution = await engine.pauseForDecision(run.id, surface.id, 'mirror');
      expect(resolution.type).toBe('mirror_approval');

      const trace = engine.writer.getRecordsByType(run.id, 'decision_trace')
        .find(r => (r.content as Record<string, unknown>).attribution === 'simulated_decision_agent');
      expect(trace, 'a simulated_decision_agent trace should be written').toBeDefined();
      const c = trace!.content as Record<string, unknown>;
      expect(c.human_selection).toBe('approve');
      expect(String(c.rationale_captured)).toMatch(/single-tenant/i);
    } finally {
      delete process.env.JANUMICODE_SIMULATE_DECISION_AGENT;
    }
  });

  it('passes the FULL surface to the decision agent (no premature truncation)', async () => {
    // Regression for the 4000-char cap that cut a 4539-char requirements mirror
    // mid-acceptance-criterion → the agent rejected the "incomplete" artifact →
    // phase failed. The whole surface must reach the prompt.
    process.env.JANUMICODE_SIMULATE_DECISION_AGENT = '1';
    let capturedPrompt = '';
    try {
      (engine as unknown as { callForRole: unknown }).callForRole = async (_role: string, opts: { prompt: string }) => {
        capturedPrompt = opts.prompt;
        return { parsed: { selection: 'approve', rationale: 'Complete and well-scoped.' }, text: '', raw: '' };
      };

      const { run } = engine.startWorkflowRun('ws-1', 'test');
      // A surface whose JSON far exceeds the old 4000-char cap, with a sentinel
      // only present near the very end (inside the last story's criteria).
      const sentinel = 'TAIL_SENTINEL_US060_FINAL_AC';
      const bigStories = Array.from({ length: 60 }, (_, i) => ({
        id: `US-${String(i + 1).padStart(3, '0')}`,
        text: `As a user I want capability number ${i} so that the documented outcome ${i} is met`,
        acceptance_criteria: [`AC for story ${i} — the system behaves per WF-${i}`],
      }));
      bigStories[bigStories.length - 1].acceptance_criteria.push(sentinel);
      const surface = engine.writer.writeRecord({
        record_type: 'mirror_presented', schema_version: '1.0', workflow_run_id: run.id,
        phase_id: '2', janumicode_version_sha: engine.janumiCodeVersionSha,
        content: { kind: 'requirements_mirror', user_stories: bigStories },
      });

      await engine.pauseForDecision(run.id, surface.id, 'mirror');

      expect(capturedPrompt.length).toBeGreaterThan(4000);
      expect(capturedPrompt, 'the tail of a >4KB surface must reach the prompt uncut').toContain(sentinel);
    } finally {
      delete process.env.JANUMICODE_SIMULATE_DECISION_AGENT;
    }
  });

  it('endorsing a bloom decision_bundle keeps the whole set (coverage-safe, no prune)', async () => {
    // Fidelity: the fixture stands in for a stakeholder building the FULL
    // product, so on an expansive "keep what belongs" bundle it endorses with
    // "approve" → empty menu_selections → keep-all. Prior infidelity (prune to a
    // subset) dropped coverage and failed the Phase 1.8 manifest gate.
    process.env.JANUMICODE_SIMULATE_DECISION_AGENT = '1';
    let capturedPrompt = '';
    try {
      (engine as unknown as { callForRole: unknown }).callForRole = async (_role: string, opts: { prompt: string }) => {
        capturedPrompt = opts.prompt;
        return { parsed: { selection: 'approve', rationale: 'All proposed domains belong to the full product.' }, text: '', raw: '' };
      };

      const { run } = engine.startWorkflowRun('ws-1', 'test');
      const surface = engine.writer.writeRecord({
        record_type: 'decision_bundle_presented', schema_version: '1.0', workflow_run_id: run.id,
        phase_id: '1', janumicode_version_sha: engine.janumiCodeVersionSha,
        content: { kind: 'product_bloom_mirror', title: 'Review Business Domains',
          mirror: { items: [{ id: 'DOM-A' }, { id: 'DOM-B' }, { id: 'DOM-C' }] }, menu: [] },
      });

      const resolution = await engine.pauseForDecision(run.id, surface.id, 'decision_bundle');

      // Endorsement keeps everything — empty menu_selections is the keep-all default.
      expect(resolution.type).toBe('decision_bundle_resolution');
      const payload = (resolution as { payload?: { menu_selections?: unknown[] } }).payload;
      expect(payload?.menu_selections).toEqual([]);
      // The prompt frames the fixture as building the full product, not minimizing scope.
      expect(capturedPrompt).toMatch(/FULL product/);
      expect(capturedPrompt).toMatch(/keep the whole proposed set|keep all/i);
    } finally {
      delete process.env.JANUMICODE_SIMULATE_DECISION_AGENT;
    }
  });
});
