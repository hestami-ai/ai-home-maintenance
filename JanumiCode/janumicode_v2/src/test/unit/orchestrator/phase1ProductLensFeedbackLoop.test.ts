/**
 * Wave 5 — free-text feedback re-bloom loop on product-lens prune gates.
 *
 * Pins v1 parity (plan §2): when the user submits free text on a prune
 * gate instead of accepting the menu, the current proposer re-runs with
 * that feedback injected into `{{human_feedback}}`, and a fresh bloom
 * artifact is emitted. The loop is capped at 3 iterations to prevent
 * livelock.
 *
 * The test injects feedback once on the 1.2 gate (Business Domains),
 * then auto-approves everything else. Expected outcome:
 *   - Two `business_domains_bloom` artifacts at sub_phase 1.2 (the
 *     original + the re-run).
 *   - The second proposer invocation's rendered prompt contains the
 *     feedback text in its `# Human Feedback` section.
 *   - Downstream rounds + synthesis + approval proceed normally on the
 *     re-bloomed domains/personas.
 *   - Overall phase succeeds.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { Phase1Handler } from '../../../lib/orchestrator/phases/phase1';
import { MockLLMProvider } from '../../helpers/mockLLMProvider';

describe('Phase 1 — product-lens free-text feedback re-bloom loop', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    engine = new OrchestratorEngine(db, configManager, workspacePath);
    engine.llmCaller.registerProvider({
      name: 'google',
      call: () => Promise.reject(new Error('stub — not routed')),
    });
    engine.registerPhase(new Phase1Handler());
    // Leave autoApproveDecisions OFF — we'll drive decisions manually via
    // the event bus so we can inject free_text_feedback on 1.2's first pass.
  });

  afterEach(() => { db.close(); });

  it('re-runs the 1.2 proposer with injected feedback, emits a second bloom artifact, and completes the phase', async () => {
    const domainsPromptsSeen: string[] = [];
    const mock = new MockLLMProvider();

    // Record the exact prompt each time the 1.2 proposer is called so we
    // can assert the feedback propagated in the second iteration.
    mock.setFixture('domains-round1', {
      match: 'PRODUCT DOMAIN PROPOSER',
      parsedJson: {
        domains: [
          { id: 'DOM-IDENTITY', name: 'Identity', description: 'd', rationale: 'r', entityPreview: ['User'], workflowPreview: ['Sign-up'] },
          { id: 'DOM-OPS', name: 'Operations', description: 'd', rationale: 'r', entityPreview: ['Workspace'], workflowPreview: ['Assign'] },
        ],
        personas: [
          { id: 'P-1', name: 'Operator', description: 'Runs it', goals: ['run'], painPoints: ['chaos'] },
          { id: 'P-2', name: 'Customer', description: 'Buys', goals: ['buy'], painPoints: ['friction'] },
        ],
      },
    });
    // Intercept llmCaller directly so we can observe what each 1.2 call
    // saw — MockLLMProvider doesn't expose prompts, so shim on top.
    const realCall = engine.llmCaller.call.bind(engine.llmCaller);
    (engine.llmCaller as unknown as { call: typeof engine.llmCaller.call }).call = async (opts) => {
      if (opts.traceContext?.subPhaseId === '1.2') {
        domainsPromptsSeen.push(opts.prompt);
      }
      return realCall(opts);
    };

    // Remaining fixtures — all pass through on first try.
    mock.setFixture('iqc', {
      match: 'Intent Quality Check',
      parsedJson: { overall_status: 'pass', completeness_findings: [], consistency_findings: [], coherence_findings: [] },
    });
    mock.setFixture('lens', {
      match: 'Intent Lens Classification',
      parsedJson: { lens: 'product', confidence: 0.9, rationale: 'Three-pillar product framing.' },
    });
    mock.setFixture('discovery', {
      match: 'PRODUCT DISCOVERY AGENT',
      parsedJson: {
        analysisSummary: 's',
        productVision: 'v',
        productDescription: 'd',
        personas: [{ id: 'P-1', name: 'Operator', description: 'd', goals: ['g'], painPoints: ['p'] }],
        userJourneys: [{ id: 'UJ-1', personaId: 'P-1', title: 't', scenario: 's',
          steps: [{ stepNumber: 1, actor: 'a', action: 'a', expectedOutcome: 'o' }],
          acceptanceCriteria: ['ac'], implementationPhase: 'Phase 1', priority: 'Phase 1' }],
        phasingStrategy: [{ phase: 'Phase 1', description: 'd', journeyIds: ['UJ-1'], rationale: 'r' }],
        successMetrics: [], uxRequirements: [],
        requirements: [], decisions: [], constraints: [], openQuestions: [],
      },
    });
    mock.setFixture('journeys', {
      match: 'PRODUCT JOURNEY & WORKFLOW PROPOSER',
      parsedJson: {
        userJourneys: [{ id: 'UJ-1', personaId: 'P-1', title: 't', scenario: 's',
          steps: [{ stepNumber: 1, actor: 'a', action: 'a', expectedOutcome: 'o' }],
          acceptanceCriteria: ['ac'], implementationPhase: 'Phase 1', source: 'ai-proposed' }],
        workflows: [{ id: 'WF-1', businessDomainId: 'DOM-IDENTITY', name: 'w', description: 'd', steps: ['s'], triggers: ['t'], actors: ['a'], source: 'domain-standard' }],
      },
    });
    mock.setFixture('entities', {
      match: 'PRODUCT DATA MODEL PROPOSER',
      parsedJson: {
        entities: [{ id: 'ENT-USER', businessDomainId: 'DOM-IDENTITY', name: 'User', description: 'd', keyAttributes: ['id'], relationships: ['has_one Role'], source: 'domain-standard' }],
      },
    });
    mock.setFixture('integrations', {
      match: 'PRODUCT INTEGRATION & QUALITY PROPOSER',
      parsedJson: {
        integrations: [{ id: 'INT-EMAIL', name: 'Email', category: 'communication', description: 'd', standardProviders: ['Postmark'], ownershipModel: 'delegated', rationale: 'r', source: 'domain-standard' }],
        qualityAttributes: ['quality constraint'],
      },
    });
    mock.setFixture('synthesis', {
      match: 'PRODUCT DESCRIPTION SYNTHESIZER',
      parsedJson: {
        kind: 'product_description_handoff',
        schemaVersion: '1.0',
        requestCategory: 'product_or_feature',
        productVision: 'v', productDescription: 'd', summary: 's',
        requirements: [], decisions: [], constraints: [], openQuestions: [],
        humanDecisions: [], openLoops: [],
      },
    });

    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setOrchestratorRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
    });

    // Drive decisions manually. First 1.2 bundle → free_text_feedback;
    // everything else → accept-all / approve.
    const FEEDBACK = 'Please add an Administrator persona — operators manage tenants on behalf of admins.';
    let firstDomainsGateSeen = false;
    engine.eventBus.on('decision:requested', ({ decisionId, surfaceType }) => {
      // Tiny delay to let the handler's writeRecord commit — then fetch
      // the presented record's sub_phase_id to route the resolution.
      const row = db.prepare(
        `SELECT sub_phase_id FROM governed_stream WHERE id = ?`,
      ).get(decisionId) as { sub_phase_id: string | null } | undefined;

      if (surfaceType === 'decision_bundle' && row?.sub_phase_id === '1.2' && !firstDomainsGateSeen) {
        firstDomainsGateSeen = true;
        engine.resolveDecision(decisionId, {
          type: 'decision_bundle_resolution',
          payload: { mirror_decisions: [], menu_selections: [], free_text_feedback: FEEDBACK },
        });
        return;
      }
      if (surfaceType === 'decision_bundle') {
        engine.resolveDecision(decisionId, {
          type: 'decision_bundle_resolution',
          payload: { mirror_decisions: [], menu_selections: [] },
        });
      } else if (surfaceType === 'mirror') {
        engine.resolveDecision(decisionId, { type: 'mirror_approval' });
      } else if (surfaceType === 'phase_gate') {
        engine.resolveDecision(decisionId, { type: 'phase_gate_approval' });
      }
    });

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    engine.writer.writeRecord({
      record_type: 'raw_intent_received',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { text: 'Build an integrated three-pillar platform.' },
    });

    const result = await engine.executeCurrentPhase(run.id);
    expect(result.success, `phase should succeed after re-bloom; error=${result.error}`).toBe(true);

    // Two 1.2 proposer invocations — the original and the re-bloom.
    expect(domainsPromptsSeen.length).toBe(2);
    // The first call's prompt has `# Human Feedback` = (none); the second
    // carries the feedback text.
    expect(domainsPromptsSeen[0]).toContain('# Human Feedback');
    expect(domainsPromptsSeen[0]).toContain('(none)');
    expect(domainsPromptsSeen[1]).toContain(FEEDBACK);

    // Two business_domains_bloom artifacts at sub_phase 1.2 — one per
    // proposer iteration.
    const artifacts = engine.writer.getRecordsByType(run.id, 'artifact_produced');
    const domainsBlooms = artifacts.filter(
      a => a.sub_phase_id === '1.2' && (a.content as { kind?: string }).kind === 'business_domains_bloom',
    );
    expect(domainsBlooms.length).toBe(2);

    // Two 1.2 decision_bundle_presented surfaces — one per iteration.
    const bundles = engine.writer.getRecordsByType(run.id, 'decision_bundle_presented');
    const bundlesAt12 = bundles.filter(b => b.sub_phase_id === '1.2');
    expect(bundlesAt12.length).toBe(2);

    // Final handoff still landed at 1.6.
    const handoffs = engine.writer.getRecordsByType(run.id, 'product_description_handoff');
    expect(handoffs.length).toBe(1);
  });
});
