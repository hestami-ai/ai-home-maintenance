/**
 * Phase 2 product-lens end-to-end — exercises Phase2Handler.execute with a
 * `product_description_handoff` record pre-seeded in the stream. Covers:
 *
 *   1. Phase 2 detects the handoff and resolves the product-lens
 *      template (requirements_agent / 02_1_functional_requirements /
 *      lens=product).
 *   2. FR and NFR artifacts carry traces_to[] populated from the
 *      mock LLM's response.
 *   3. Non-product-lens runs (no handoff present) keep using the
 *      default template path (regression isolation).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { Phase2Handler } from '../../../lib/orchestrator/phases/phase2';
import { MockLLMProvider } from '../../helpers/mockLLMProvider';
import type { ProductDescriptionHandoffContent } from '../../../lib/types/records';

describe('Phase 2 — product-lens handoff consumption', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    engine = new OrchestratorEngine(db, configManager, workspacePath);
    engine.llmCaller.registerProvider({
      name: 'google',
      call: () => Promise.reject(new Error('stub')),
    });
    engine.registerPhase(new Phase2Handler());
    engine.setAutoApproveDecisions(true);
  });

  afterEach(() => { db.close(); });

  /** Minimal viable handoff — small counts, just enough for oracle. */
  function tinyHandoff(): ProductDescriptionHandoffContent {
    return {
      kind: 'product_description_handoff',
      schemaVersion: '1.1',
      requestCategory: 'product_or_feature',
      productVision: 'v',
      productDescription: 'd',
      summary: 's',
      personas: [
        { id: 'P-1', name: 'Operator', description: 'Runs things', goals: ['run'], painPoints: ['chaos'] },
      ],
      userJourneys: [
        { id: 'UJ-1', personaId: 'P-1', title: 'Onboard', scenario: 'First login',
          steps: [{ stepNumber: 1, actor: 'Operator', action: 'sign up', expectedOutcome: 'account created' }],
          acceptanceCriteria: ['operator can log in'], implementationPhase: 'Phase 1' },
      ],
      phasingStrategy: [{ phase: 'Phase 1', description: 'core', journeyIds: ['UJ-1'], rationale: 'foundation' }],
      successMetrics: ['metric'],
      businessDomainProposals: [
        { id: 'DOM-AUTH', name: 'Auth', description: 'auth', rationale: 'r', entityPreview: ['User'], workflowPreview: ['signin'] },
      ],
      entityProposals: [
        { id: 'ENT-USER', businessDomainId: 'DOM-AUTH', name: 'User', description: 'u', keyAttributes: ['id', 'email'], relationships: ['has_one Session'] },
      ],
      workflowProposals: [
        { id: 'WF-1', businessDomainId: 'DOM-AUTH', name: 'Sign-up', description: 'flow',
          steps: ['v', 'c'], triggers: ['req'], actors: ['User'] },
      ],
      integrationProposals: [
        { id: 'INT-EMAIL', name: 'Email', category: 'communication', description: 'notifications',
          standardProviders: ['Postmark'], ownershipModel: 'delegated', rationale: 'needed' },
      ],
      qualityAttributes: ['Tenant isolation via RLS'],
      uxRequirements: ['mobile-first'],
      requirements: [],
      decisions: [],
      constraints: [],
      openQuestions: [],
      technicalConstraints: [
        { id: 'TECH-1', category: 'database', text: 'PostgreSQL with RLS', technology: 'PostgreSQL',
          source_ref: { document_path: 'spec.md', excerpt: 'PostgreSQL with RLS' } },
      ],
      complianceExtractedItems: [],
      vvRequirements: [
        { id: 'VV-1', category: 'security', target: 'Tenant isolation', measurement: 'pen test', threshold: '0 cross-tenant leaks',
          source_ref: { document_path: 'spec.md', excerpt: 'Multi-tenant with RLS' } },
      ],
      canonicalVocabulary: [
        { id: 'VOC-1', term: 'Tenant', definition: 'An isolated org boundary.', synonyms: ['org'],
          source_ref: { document_path: 'spec.md', excerpt: 'Each tenant is an isolated org.' } },
      ],
      humanDecisions: [],
      openLoops: [],
    };
  }

  function seedPriorPhaseRecords(runId: string, handoff: ProductDescriptionHandoffContent | null): void {
    // Minimal Phase 1 output — intent_statement + optional handoff.
    engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '1',
      sub_phase_id: '1.6',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: {
        kind: 'intent_statement',
        product_concept: { name: 'Test', description: 'Test platform', who_it_serves: 'Operators', problem_it_solves: 'Chaos' },
        confirmed_assumptions: [],
        confirmed_constraints: [],
        out_of_scope: [],
      },
    });
    if (handoff) {
      engine.writer.writeRecord({
        record_type: 'product_description_handoff',
        schema_version: '1.1',
        workflow_run_id: runId,
        phase_id: '1',
        sub_phase_id: '1.6',
        produced_by_agent_role: 'domain_interpreter',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        content: handoff as unknown as Record<string, unknown>,
      });
    }
  }

  it('routes Phase 2.1 through the product-lens template when a handoff is present and propagates traces_to', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('fr-product', {
      match: 'product-lens Functional Requirements Bloom',
      parsedJson: {
        user_stories: [{
          id: 'US-001', role: 'Operator', action: 'sign up', outcome: 'can access the platform',
          acceptance_criteria: [{ id: 'AC-001', description: 'account created', measurable_condition: 'POST /users returns 201' }],
          priority: 'critical',
          traces_to: ['UJ-1', 'ENT-USER'],
        }],
      },
    });
    mock.setFixture('nfr-product', {
      match: 'product-lens Non-Functional Requirements Bloom',
      parsedJson: {
        requirements: [{
          id: 'NFR-001', category: 'security', description: 'Tenant isolation',
          threshold: '0 cross-tenant leaks in pen-test', measurement_method: 'automated scan',
          traces_to: ['VV-1', 'TECH-1'],
        }],
      },
    });
    // Also need to satisfy the default-path LLM call just in case.
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
      temperature: 0.5,
    });

    const { run } = engine.startWorkflowRun('ws', 'test');
    engine.advanceToNextPhase(run.id, '1');
    // Skip the Phase 0/1 steps — seed records directly + advance to Phase 2.
    seedPriorPhaseRecords(run.id, tinyHandoff());
    engine.advanceToNextPhase(run.id, '2');
    const result = await engine.executeCurrentPhase(run.id);

    expect(result.success, `phase 2 should succeed; error=${result.error}`).toBe(true);
    const artifacts = engine.writer.getRecordsByType(run.id, 'artifact_produced');
    const findKind = (k: string) => artifacts.find(a => (a.content as { kind?: string }).kind === k);

    const fr = findKind('functional_requirements');
    expect(fr).toBeDefined();
    const frContent = fr!.content as { user_stories: Array<{ traces_to?: string[] }> };
    expect(frContent.user_stories[0].traces_to).toEqual(['UJ-1', 'ENT-USER']);

    const nfr = findKind('non_functional_requirements');
    expect(nfr).toBeDefined();
    const nfrContent = nfr!.content as { requirements: Array<{ traces_to?: string[] }> };
    expect(nfrContent.requirements[0].traces_to).toEqual(['VV-1', 'TECH-1']);
  });

  it('Wave 6 Step 4a — Pass-1 produces Tier-D atomic children; saturation loop terminates', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('fr-product', {
      match: 'product-lens Functional Requirements Bloom',
      parsedJson: {
        user_stories: [{
          id: 'FR-ACCT-0', role: 'CAM operator', action: 'manage HOA accounting',
          outcome: 'books are accurate, auditable, and compliant',
          acceptance_criteria: [{ id: 'AC-001', description: 'GL is authoritative', measurable_condition: 'all postings balance' }],
          priority: 'critical',
          traces_to: ['UJ-1', 'ENT-USER'],
        }],
      },
    });
    // Match on parent ID (present in the rendered parent_story block).
    mock.setFixture('decompose-root', {
      match: 'FR-ACCT-0',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root is a functional sub-area' },
        children: [
          {
            id: 'FR-ACCT-1', tier: 'D', role: 'CAM operator',
            action: 'post and reconcile general-ledger entries',
            outcome: 'GL is authoritative source of association financial state',
            acceptance_criteria: [{ id: 'AC-001', description: 'All postings balance', measurable_condition: 'sum(debits) === sum(credits)' }],
            priority: 'critical', traces_to: ['UJ-1'],
            decomposition_rationale: 'Named leaf operation under the GL area.',
          },
          {
            id: 'FR-ACCT-2', tier: 'D', role: 'CAM operator',
            action: 'bill and collect assessments',
            outcome: 'AR is current and reconciled',
            acceptance_criteria: [{ id: 'AC-001', description: 'Assessments billed monthly', measurable_condition: 'invoice rows generated by 1st of month' }],
            priority: 'high', traces_to: ['UJ-1'],
            decomposition_rationale: 'Named leaf operation under the AR area.',
          },
        ],
        surfaced_assumptions: [
          { text: 'GAAP applies to association financial reporting', category: 'domain_regime', citations: ['VV-1'] },
          { text: 'Accrual basis (assessments billed in advance)', category: 'domain_regime' },
        ],
      },
    });
    mock.setFixture('nfr-product', {
      match: 'product-lens Non-Functional Requirements Bloom',
      parsedJson: {
        requirements: [{
          id: 'NFR-001', category: 'security', description: 'Tenant isolation',
          threshold: '0 leaks', measurement_method: 'pen-test',
          traces_to: ['VV-1', 'TECH-1'],
        }],
      },
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
      temperature: 0.5,
    });

    const { run } = engine.startWorkflowRun('ws', 'test');
    engine.advanceToNextPhase(run.id, '1');
    seedPriorPhaseRecords(run.id, tinyHandoff());
    engine.advanceToNextPhase(run.id, '2');
    const result = await engine.executeCurrentPhase(run.id);
    expect(result.success, `phase 2 should succeed; error=${result.error}`).toBe(true);

    const nodes = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_node');
    // Filter to FR-kind roots only; Wave 6 NFR recursion also produces
    // depth-0 NFR nodes (root_kind='nfr') under sub-phase 2.2.
    const roots = nodes.filter(n =>
      (n.content as { depth?: number }).depth === 0
      && (n.content as { root_kind?: string }).root_kind !== 'nfr');
    expect(roots, 'expected one depth-0 FR root node').toHaveLength(1);
    expect(roots[0].content.node_id).toBe('FR-ACCT-0');
    expect(roots[0].sub_phase_id).toBe('2.1');

    const children = nodes.filter(n => (n.content as { depth?: number }).depth === 1);
    expect(children).toHaveLength(2);
    expect(children.every(c => c.sub_phase_id === '2.1a')).toBe(true);
    expect(children.every(c => (c.content as { parent_node_id?: string }).parent_node_id === 'FR-ACCT-0')).toBe(true);
    // Tier-D children are written with status='atomic' (terminal).
    expect(children.every(c => (c.content as { tier: string }).tier === 'D')).toBe(true);
    expect(children.every(c => (c.content as { status: string }).status === 'atomic')).toBe(true);
    expect(children.map(c => (c.content as { node_id: string }).node_id).sort((a, b) => a.localeCompare(b)))
      .toEqual(['FR-ACCT-1', 'FR-ACCT-2']);

    const snapshots = engine.writer.getRecordsByType(run.id, 'assumption_set_snapshot');
    // FR saturation snapshots carry root_fr_id='*'; NFR uses '*nfr*'.
    const pass1Snaps = snapshots.filter(s =>
      (s.content as { pass_number: number }).pass_number === 1
      && (s.content as { root_fr_id: string }).root_fr_id === '*');
    expect(pass1Snaps, 'expected a pass-1 FR assumption snapshot').toHaveLength(1);
    const snap = pass1Snaps[0].content as { pass_number: number; assumptions: unknown[]; delta_from_previous_pass: number };
    expect(snap.assumptions).toHaveLength(2);
    expect(snap.delta_from_previous_pass).toBe(2);
  });

  it('Wave 6 Step 4a — Pass producing Tier-B children fires a depth-2 mirror gate bundle per parent', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('fr-product', {
      match: 'product-lens Functional Requirements Bloom',
      parsedJson: {
        user_stories: [{
          id: 'FR-ACCT-0', role: 'CAM operator', action: 'manage HOA accounting',
          outcome: 'books are accurate',
          acceptance_criteria: [{ id: 'AC-001', description: 'GL is authoritative', measurable_condition: 'all postings balance' }],
          priority: 'critical', traces_to: ['UJ-1'],
        }],
      },
    });
    // Pass-1 decomposing the root produces two Tier-B scope commitments.
    mock.setFixture('decompose-root', {
      match: 'FR-ACCT-0',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root' },
        children: [
          {
            id: 'FR-ACCT-1', tier: 'B', role: 'CAM operator', action: 'post GL entries under GAAP', outcome: 'GL authoritative',
            acceptance_criteria: [{ id: 'AC-001', description: 'GAAP applies', measurable_condition: 'debits===credits' }],
            priority: 'critical', traces_to: ['UJ-1'],
          },
          {
            id: 'FR-ACCT-2', tier: 'B', role: 'CAM operator', action: 'bill assessments on accrual', outcome: 'AR current',
            acceptance_criteria: [{ id: 'AC-001', description: 'accrual', measurable_condition: 'invoices by 1st' }],
            priority: 'high', traces_to: ['UJ-1'],
          },
        ],
        surfaced_assumptions: [{ text: 'GAAP applies', category: 'domain_regime' }],
      },
    });
    mock.setFixture('nfr-product', {
      match: 'product-lens Non-Functional Requirements Bloom',
      parsedJson: {
        requirements: [{
          id: 'NFR-001', category: 'security', description: 'iso', threshold: 't', measurement_method: 'm',
          traces_to: ['VV-1'],
        }],
      },
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
      temperature: 0.5,
    });

    const { run } = engine.startWorkflowRun('ws', 'test');
    engine.advanceToNextPhase(run.id, '1');
    seedPriorPhaseRecords(run.id, tinyHandoff());
    engine.advanceToNextPhase(run.id, '2');
    const result = await engine.executeCurrentPhase(run.id);
    expect(result.success, `error=${result.error}`).toBe(true);

    const nodes = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_node');
    const depth1 = nodes.filter(n => (n.content as { depth?: number }).depth === 1);
    // Two Tier-B children produced and written at depth 1 (not "depth 2" —
    // tier and depth are independent now).
    expect(depth1).toHaveLength(2);
    expect(depth1.every(n => (n.content as { tier: string }).tier === 'B')).toBe(true);

    // One mirror gate bundle per parent with Tier-B children. In this test
    // only the root has Tier-B children, so exactly one bundle.
    const bundles = engine.writer.getRecordsByType(run.id, 'decision_bundle_presented');
    const gateBundles = bundles.filter(b =>
      typeof (b.content as { surface_id?: string }).surface_id === 'string'
      && (b.content as { surface_id: string }).surface_id.startsWith('decomp-gate-'));
    expect(gateBundles).toHaveLength(1);

    const snapshots = engine.writer.getRecordsByType(run.id, 'assumption_set_snapshot');
    expect(snapshots.length).toBeGreaterThanOrEqual(1);
    const pass1 = snapshots.find(s => (s.content as { pass_number: number }).pass_number === 1);
    expect(pass1).toBeDefined();
  });

  it('Wave 6 Step 3 — rejecting a Level-2 child at the depth-2 gate writes a pruned supersession record', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('fr-product', {
      match: 'product-lens Functional Requirements Bloom',
      parsedJson: {
        user_stories: [{
          id: 'FR-ROOT', role: 'op', action: 'manage area', outcome: 'area managed',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'critical', traces_to: ['UJ-1'],
        }],
      },
    });
    // Pass-1 decomposing FR-ROOT emits two Tier-B children. The gate
    // fires; the test's resolver rejects FR-L2-DROP (child-1) and accepts
    // FR-L2-KEEP (child-0). Accepted FR-L2-KEEP re-enters the queue; its
    // decomposition call has no fixture match so returns empty children
    // and the loop terminates cleanly.
    mock.setFixture('decompose-root', {
      match: 'FR-ROOT',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root' },
        children: [
          { id: 'FR-L2-KEEP', tier: 'B', role: 'op', action: 'kept', outcome: 'keep it',
            acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
            priority: 'high', traces_to: ['UJ-1'] },
          { id: 'FR-L2-DROP', tier: 'B', role: 'op', action: 'dropped', outcome: 'reject it',
            acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
            priority: 'low', traces_to: ['UJ-1'] },
        ],
        surfaced_assumptions: [],
      },
    });
    mock.setFixture('nfr-product', {
      match: 'product-lens Non-Functional Requirements Bloom',
      parsedJson: { requirements: [{ id: 'NFR-1', category: 'security', description: 'd', threshold: 't', measurement_method: 'm', traces_to: ['VV-1'] }] },
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
      temperature: 0.5,
    });

    // Run with per-decision resolution (not blanket auto-approve) so we
    // can inject a rejection for ONE child at the depth-2 gate while
    // auto-approving everything else.
    engine.setAutoApproveDecisions(false);
    const { run } = engine.startWorkflowRun('ws', 'test');
    engine.advanceToNextPhase(run.id, '1');
    seedPriorPhaseRecords(run.id, tinyHandoff());
    engine.advanceToNextPhase(run.id, '2');

    const decompGateHandled = new Set<string>();
    engine.eventBus.on('decision:requested', ({ decisionId }) => {
      if (decompGateHandled.has(decisionId)) return;
      decompGateHandled.add(decisionId);
      const rec = engine.writer.getRecord(decisionId);
      const content = rec?.content as { surface_id?: string; mirror?: { items: Array<{ id: string }> } } | undefined;
      const surfaceId = content?.surface_id;
      if (surfaceId?.startsWith('decomp-gate-')) {
        // Reject the 'FR-L2-DROP' item, accept others.
        const items = content?.mirror?.items ?? [];
        const mirrorDecisions = items.map(it => ({
          item_id: it.id,
          action: (it.id === 'child-1' ? 'rejected' : 'accepted') as 'rejected' | 'accepted',
        }));
        engine.resolveDecision(decisionId, {
          type: 'decision_bundle_resolution',
          payload: { mirror_decisions: mirrorDecisions, menu_selections: [] },
        });
      } else {
        // All other pending decisions: auto-approve.
        engine.resolveDecision(decisionId, { type: 'mirror_approval' });
      }
    });

    const result = await engine.executeCurrentPhase(run.id);
    expect(result.success, `error=${result.error}`).toBe(true);

    const allNodes = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_node', false);
    const pruned = allNodes.filter(n =>
      (n.content as { node_id: string }).node_id === 'FR-L2-DROP'
      && (n.content as { status: string }).status === 'pruned');
    expect(pruned, 'expected a pruned supersession record for FR-L2-DROP').toHaveLength(1);
    expect((pruned[0].content as { pruning_reason?: string }).pruning_reason).toBe('human-rejected');
  });

  it('Wave 6 Step 4b — accepted Tier-B whose children are also Tier-B is downgraded and flagged with context note', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('fr-product', {
      match: 'product-lens Functional Requirements Bloom',
      parsedJson: {
        user_stories: [{
          id: 'FR-MISLABEL', role: 'op', action: 'manage x', outcome: 'x managed',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'critical', traces_to: ['UJ-1'],
        }],
      },
    });
    // Pass 1 on the root: produces one Tier-B child FR-B1.
    mock.setFixture('decompose-root', {
      match: 'FR-MISLABEL',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root' },
        children: [{
          id: 'FR-B1', tier: 'B', role: 'op', action: 'first commitment', outcome: 'first outcome',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'critical', traces_to: ['UJ-1'],
        }],
        surfaced_assumptions: [],
      },
    });
    // Pass 2 on FR-B1 (tierHint='B' after acceptance): returns ANOTHER
    // Tier-B child FR-B2. That's the mislabel signal — accepted-B parent
    // still has commitment layers. FR-B1 should be downgraded.
    mock.setFixture('decompose-B1', {
      match: 'FR-B1',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: false, rationale: 'still has commitments underneath' },
        children: [{
          id: 'FR-B2', tier: 'B', role: 'op', action: 'sub commitment', outcome: 'sub outcome',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'high', traces_to: ['UJ-1'],
        }],
        surfaced_assumptions: [],
      },
    });
    mock.setFixture('nfr-product', {
      match: 'product-lens Non-Functional Requirements Bloom',
      parsedJson: { requirements: [{ id: 'NFR-1', category: 'security', description: 'd', threshold: 't', measurement_method: 'm', traces_to: ['VV-1'] }] },
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
      temperature: 0.5,
    });

    const { run } = engine.startWorkflowRun('ws', 'test');
    engine.advanceToNextPhase(run.id, '1');
    seedPriorPhaseRecords(run.id, tinyHandoff());
    engine.advanceToNextPhase(run.id, '2');
    const result = await engine.executeCurrentPhase(run.id);
    expect(result.success, `error=${result.error}`).toBe(true);

    // A supersession record with status='downgraded' should exist for FR-B1.
    const allNodes = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_node', false);
    const downgraded = allNodes.filter(n =>
      (n.content as { node_id: string }).node_id === 'FR-B1'
      && (n.content as { status: string }).status === 'downgraded');
    expect(downgraded, 'expected a downgraded supersession record for FR-B1').toHaveLength(1);
    expect((downgraded[0].content as { pruning_reason?: string }).pruning_reason)
      .toMatch(/^tier_downgrade:/);

    // The follow-up gate bundle for FR-B1 (gating its Tier-B child FR-B2)
    // should carry the [Scope expansion] context note in its summary.
    const bundles = engine.writer.getRecordsByType(run.id, 'decision_bundle_presented');
    const followupBundle = bundles.find(b => {
      const c = b.content as { surface_id?: string };
      return c.surface_id === 'decomp-gate-FR-B1';
    });
    expect(followupBundle, 'expected a follow-up gate bundle for FR-B1').toBeDefined();
    const bundleContent = followupBundle!.content as { summary?: string };
    expect(bundleContent.summary).toBeDefined();
    expect(bundleContent.summary ?? '').toContain('[Scope expansion]');
    expect(bundleContent.summary ?? '').toContain('FR-B1');
  });

  it('Wave 6 NFR — Phase 2.2 emits depth-0 NFR nodes and 2.2a runs the saturation loop with root_kind=nfr', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('fr-product', {
      match: 'product-lens Functional Requirements Bloom',
      parsedJson: {
        user_stories: [{
          id: 'FR-ROOT', role: 'op', action: 'do thing', outcome: 'result',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'high', traces_to: ['UJ-1'],
        }],
      },
    });
    // FR decomposer returns atomic Tier-D children (terminate fast).
    mock.setFixture('decompose-fr', {
      match: 'FR-ROOT',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root' },
        children: [{
          id: 'FR-LEAF', tier: 'D', role: 'op', action: 'leaf action', outcome: 'leaf outcome',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'high', traces_to: ['UJ-1'],
        }],
        surfaced_assumptions: [],
      },
    });
    mock.setFixture('nfr-product', {
      match: 'product-lens Non-Functional Requirements Bloom',
      parsedJson: {
        requirements: [{
          id: 'NFR-AUDIT', category: 'auditability',
          description: 'Tamper-evident audit trail',
          threshold: '0 undetected historical rewrites per audit replay',
          measurement_method: 'scheduled audit-chain replay',
          traces_to: ['VV-12'],
        }],
      },
    });
    // NFR decomposer returns atomic Tier-D children so 2.2a terminates.
    mock.setFixture('decompose-nfr', {
      match: 'NFR-AUDIT',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root nfr' },
        children: [{
          id: 'NFR-AUDIT-LEAF', tier: 'D', role: 'system',
          action: 'emit audit_hash row per journal entry',
          outcome: 'hash row exists for every journal_entries row',
          acceptance_criteria: [{ id: 'AC-001', description: 'hash row exists', measurable_condition: 'count(audit_hash) === count(journal_entries)' }],
          priority: 'high', traces_to: ['VV-12'],
          applies_to_requirements: ['FR-LEAF'],
        }],
        surfaced_assumptions: [
          { text: 'SHA-256 is the audit-chain hash', category: 'constraint' },
        ],
      },
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
      temperature: 0.5,
    });

    const { run } = engine.startWorkflowRun('ws', 'test');
    engine.advanceToNextPhase(run.id, '1');
    seedPriorPhaseRecords(run.id, tinyHandoff());
    engine.advanceToNextPhase(run.id, '2');
    const result = await engine.executeCurrentPhase(run.id);
    expect(result.success, `error=${result.error}`).toBe(true);

    // Depth-0 NFR root node exists with root_kind='nfr' under sub-phase 2.2.
    const nodes = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_node');
    const nfrRoot = nodes.find(n =>
      (n.content as { depth?: number }).depth === 0
      && (n.content as { root_kind?: string }).root_kind === 'nfr');
    expect(nfrRoot, 'expected a depth-0 NFR root node').toBeDefined();
    expect(nfrRoot!.sub_phase_id).toBe('2.2');
    expect((nfrRoot!.content as { node_id: string }).node_id).toBe('NFR-AUDIT');

    // Depth-1 NFR leaf exists with root_kind='nfr' under sub-phase 2.2a.
    const nfrLeaves = nodes.filter(n =>
      (n.content as { depth?: number }).depth === 1
      && (n.content as { root_kind?: string }).root_kind === 'nfr');
    expect(nfrLeaves).toHaveLength(1);
    expect(nfrLeaves[0].sub_phase_id).toBe('2.2a');
    expect((nfrLeaves[0].content as { tier?: string }).tier).toBe('D');
    expect((nfrLeaves[0].content as { status: string }).status).toBe('atomic');

    // NFR-specific assumption snapshot carries root_fr_id='*nfr*'.
    const snapshots = engine.writer.getRecordsByType(run.id, 'assumption_set_snapshot');
    const nfrSnap = snapshots.find(s =>
      (s.content as { root_fr_id: string }).root_fr_id === '*nfr*');
    expect(nfrSnap, 'expected an NFR assumption snapshot').toBeDefined();
    const nfrSnapContent = nfrSnap!.content as { delta_from_previous_pass: number };
    expect(nfrSnapContent.delta_from_previous_pass).toBe(1);
  });

  it('Wave 6 Step 4c — clean post-gate Tier-C decomposition triggers AC-shape audit and records findings', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('fr-product', {
      match: 'product-lens Functional Requirements Bloom',
      parsedJson: {
        user_stories: [{
          id: 'FR-AUDIT-ROOT', role: 'op', action: 'manage area', outcome: 'area managed',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'critical', traces_to: ['UJ-1'],
        }],
      },
    });
    // Pass 1: root decomposes to a single Tier-B commitment.
    mock.setFixture('decompose-root', {
      match: 'FR-AUDIT-ROOT',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root' },
        children: [{
          id: 'FR-COMMITMENT', tier: 'B', role: 'op', action: 'commitment action',
          outcome: 'commitment outcome',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'critical', traces_to: ['UJ-1'],
        }],
        surfaced_assumptions: [],
      },
    });
    // Pass 2 (after gate acceptance): FR-COMMITMENT decomposes into Tier-C
    // implementation children — a clean post-gate decomposition. This is
    // where the 4c audit should fire.
    mock.setFixture('decompose-commitment', {
      match: 'FR-COMMITMENT',
      parsedJson: {
        parent_tier_assessment: { tier: 'B', agrees_with_hint: true, rationale: 'real commitment' },
        children: [
          {
            id: 'FR-IMPL-1', tier: 'C', role: 'op', action: 'concrete impl 1', outcome: 'works',
            acceptance_criteria: [{ id: 'AC-001', description: 'deterministic', measurable_condition: 'sum==total' }],
            priority: 'high', traces_to: ['UJ-1'],
          },
          {
            id: 'FR-IMPL-2', tier: 'C', role: 'op', action: 'concrete impl 2', outcome: 'also works',
            acceptance_criteria: [{ id: 'AC-001', description: 'state-disclosure', measurable_condition: 'state-mandated disclosure language per jurisdiction' }],
            priority: 'high', traces_to: ['UJ-1'],
          },
        ],
        surfaced_assumptions: [],
      },
    });
    // Step 4c audit response: flags FR-IMPL-2 as policy-shaped.
    mock.setFixture('ac-shape-audit', {
      match: 'structural acceptance-criteria audit',
      parsedJson: {
        findings: [
          { child_id: 'FR-IMPL-1', verdict: 'verification', rationale: 'AC cites deterministic arithmetic invariant.' },
          { child_id: 'FR-IMPL-2', verdict: 'policy', rationale: 'AC references jurisdiction-dependent language with no jurisdiction named.' },
        ],
        summary: '1 of 2 children have policy-shaped ACs.',
      },
    });
    mock.setFixture('nfr-product', {
      match: 'product-lens Non-Functional Requirements Bloom',
      parsedJson: { requirements: [{ id: 'NFR-1', category: 'security', description: 'd', threshold: 't', measurement_method: 'm', traces_to: ['VV-1'] }] },
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    // Wire both routing roles to ollama so the audit call also routes
    // through the mock provider.
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
      temperature: 0.5,
    });
    const cfg = engine.configManager.get();
    cfg.llm_routing.reasoning_review = {
      primary: { provider: 'ollama', model: 'qwen3.5:9b' },
      temperature: 0.2,
      trace_max_tokens: 4000,
    };
    cfg.decomposition.reasoning_review_on_tier_c = true;

    const { run } = engine.startWorkflowRun('ws', 'test');
    engine.advanceToNextPhase(run.id, '1');
    seedPriorPhaseRecords(run.id, tinyHandoff());
    engine.advanceToNextPhase(run.id, '2');
    const result = await engine.executeCurrentPhase(run.id);
    expect(result.success, `error=${result.error}`).toBe(true);

    const reviews = engine.writer.getRecordsByType(run.id, 'reasoning_review_record');
    const auditRecords = reviews.filter(r => {
      const c = r.content as { kind?: string };
      return c.kind === 'tier_c_ac_shape_audit';
    });
    expect(auditRecords, 'expected a 4c AC-shape audit record').toHaveLength(1);
    const audit = auditRecords[0].content as {
      parent_node_id: string;
      children_reviewed: string[];
      findings: Array<{ child_id: string; verdict: string }>;
      policy_count: number;
    };
    expect(audit.parent_node_id).toBe('FR-COMMITMENT');
    expect(audit.children_reviewed.sort()).toEqual(['FR-IMPL-1', 'FR-IMPL-2']);
    expect(audit.policy_count).toBe(1);
    const imp2 = audit.findings.find(f => f.child_id === 'FR-IMPL-2');
    expect(imp2?.verdict).toBe('policy');
  });

  it('Wave 6 follow-up — emits requirement_decomposition_pipeline records for FR and NFR with final totals', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('fr-product', {
      match: 'product-lens Functional Requirements Bloom',
      parsedJson: {
        user_stories: [{
          id: 'FR-ROOT', role: 'op', action: 'do thing', outcome: 'result',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'high', traces_to: ['UJ-1'],
        }],
      },
    });
    mock.setFixture('decompose-fr', {
      match: 'FR-ROOT',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root' },
        children: [{
          id: 'FR-LEAF', tier: 'D', role: 'op', action: 'leaf action', outcome: 'leaf outcome',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'high', traces_to: ['UJ-1'],
        }],
        surfaced_assumptions: [{ text: 'assumption', category: 'scope' }],
      },
    });
    mock.setFixture('nfr-product', {
      match: 'product-lens Non-Functional Requirements Bloom',
      parsedJson: {
        requirements: [{
          id: 'NFR-1', category: 'security', description: 'iso', threshold: 't',
          measurement_method: 'm', traces_to: ['VV-1'],
        }],
      },
    });
    mock.setFixture('decompose-nfr', {
      match: 'NFR-1',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root nfr' },
        children: [{
          id: 'NFR-LEAF', tier: 'D', role: 'system', action: 'nfr leaf', outcome: 'nfr outcome',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'high', traces_to: ['VV-1'],
        }],
        surfaced_assumptions: [],
      },
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
      temperature: 0.5,
    });

    const { run } = engine.startWorkflowRun('ws', 'test');
    engine.advanceToNextPhase(run.id, '1');
    seedPriorPhaseRecords(run.id, tinyHandoff());
    engine.advanceToNextPhase(run.id, '2');
    const result = await engine.executeCurrentPhase(run.id);
    expect(result.success, `error=${result.error}`).toBe(true);

    // All pipeline records (incremental + final) exist.
    const allPipelines = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_pipeline', false);
    expect(allPipelines.length).toBeGreaterThanOrEqual(4); // open + ≥1 per-pass + final, per root_kind

    // The FINAL version of each pipeline (one FR, one NFR) is current_version=1.
    const currentPipelines = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_pipeline', true);
    const frPipeline = currentPipelines.find(p =>
      (p.content as { root_fr_id: string }).root_fr_id === '*');
    const nfrPipeline = currentPipelines.find(p =>
      (p.content as { root_fr_id: string }).root_fr_id === '*nfr*');
    expect(frPipeline, 'expected an FR pipeline container').toBeDefined();
    expect(nfrPipeline, 'expected an NFR pipeline container').toBeDefined();

    const frContent = frPipeline!.content as {
      final_leaf_count?: number;
      total_llm_calls?: number;
      passes: Array<{ termination_reason?: string; assumption_delta: number }>;
    };
    expect(frContent.final_leaf_count).toBeGreaterThanOrEqual(1);
    expect(frContent.total_llm_calls).toBeGreaterThanOrEqual(1);
    const lastPass = frContent.passes[frContent.passes.length - 1];
    expect(lastPass.termination_reason).toBe('fixed_point');
  });

  it('Wave 6 resume — re-entering Phase 2 with existing FR nodes doesn\'t duplicate them (idempotent Phase 2.1)', async () => {
    const mock = new MockLLMProvider();
    // First run: the bloom produces one root FR, the decomposer returns
    // ONE pending Tier-C child (which cannot yet go atomic — requires
    // another pass). We use a throw-on-next-call trick to simulate a
    // stall mid-way: after the first decomposer fires, the next call
    // throws so the saturation loop exits with a deferred supersession.
    mock.setFixture('fr-product', {
      match: 'product-lens Functional Requirements Bloom',
      parsedJson: {
        user_stories: [{
          id: 'FR-ROOT', role: 'op', action: 'manage thing', outcome: 'thing managed',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'critical', traces_to: ['UJ-1'],
        }],
      },
    });
    mock.setFixture('decompose-root', {
      match: 'FR-ROOT',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root' },
        children: [{
          id: 'FR-CHILD', tier: 'C', role: 'op', action: 'sub action', outcome: 'sub outcome',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'high', traces_to: ['UJ-1'],
        }],
        surfaced_assumptions: [
          { text: 'pre-stall assumption', category: 'scope' },
        ],
      },
    });
    // No fixture for 'FR-CHILD' decomposition — its call returns empty
    // children from the mock's default-empty behavior, so the loop
    // terminates cleanly with FR-CHILD still pending.
    mock.setFixture('nfr-product', {
      match: 'product-lens Non-Functional Requirements Bloom',
      parsedJson: { requirements: [] },
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
      temperature: 0.5,
    });

    // ── First run ──
    const { run } = engine.startWorkflowRun('ws', 'test');
    engine.advanceToNextPhase(run.id, '1');
    seedPriorPhaseRecords(run.id, tinyHandoff());
    engine.advanceToNextPhase(run.id, '2');
    const result1 = await engine.executeCurrentPhase(run.id);
    expect(result1.success, `first run should succeed; error=${result1.error}`).toBe(true);

    const nodesAfterFirst = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_node');
    const frRootCount = nodesAfterFirst.filter(n => {
      const c = n.content as unknown as { depth?: number; root_kind?: string };
      return c.depth === 0 && (c.root_kind ?? 'fr') === 'fr';
    }).length;
    expect(frRootCount, 'one FR root').toBe(1);
    const firstRunSnapshots = engine.writer.getRecordsByType(run.id, 'assumption_set_snapshot', false);
    const frSnapshots = firstRunSnapshots.filter(s => {
      const c = s.content as unknown as { root_fr_id?: string };
      return (c.root_fr_id ?? '*') === '*';
    });
    expect(frSnapshots.length).toBeGreaterThan(0);

    // First run wrote one FR-ROOT depth-0 node. If Phase 2.1 is
    // idempotent on resume, running it a SECOND time (via the
    // executeCurrentPhase/execute path) must NOT emit a duplicate
    // depth-0 node for the same node_id. We verify the underlying
    // idempotency by directly re-invoking the handler with existing
    // nodes in place — no need to round-trip through the state machine.
    const existingFrNodes = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_node')
      .filter(n => {
        const c = n.content as unknown as { depth?: number; root_kind?: string; node_id?: string };
        return c.depth === 0 && (c.root_kind ?? 'fr') === 'fr';
      });
    expect(existingFrNodes.length, 'exactly one FR-ROOT after first run').toBe(1);
    // Re-run executeCurrentPhase pretending we're still on phase 2.
    // The state machine doesn't allow backward transitions, so this
    // directly tests the idempotency check in Phase2Handler's execute
    // method: it queries existing depth-0 FR nodes at the top and
    // skips the bloom + depth-0 write when any are present.
    const handler = new (await import('../../../lib/orchestrator/phases/phase2')).Phase2Handler();
    const ctx = {
      workflowRun: engine.stateMachine.getWorkflowRun(run.id)!,
      engine,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    } as never;
    const result2 = await handler.execute(ctx);
    expect(result2.success, `resume execute should succeed; error=${result2.error}`).toBe(true);

    // Still exactly ONE FR-ROOT after re-execute.
    const finalFrNodes = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_node')
      .filter(n => {
        const c = n.content as unknown as { depth?: number; root_kind?: string; node_id?: string };
        return c.depth === 0 && (c.root_kind ?? 'fr') === 'fr' && c.node_id === 'FR-ROOT';
      });
    expect(finalFrNodes.length, 'still exactly one FR-ROOT after re-execute').toBe(1);
  });

  it('Wave 6 Step 2 — drops malformed children and still decomposes the valid ones', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('fr-product', {
      match: 'product-lens Functional Requirements Bloom',
      parsedJson: {
        user_stories: [{
          id: 'FR-ROOT', role: 'op', action: 'do thing', outcome: 'result',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'high', traces_to: ['UJ-1'],
        }],
      },
    });
    mock.setFixture('decompose-root-malformed', {
      match: 'FR-ROOT',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root' },
        children: [
          { /* missing id/role/action/outcome */ priority: 'high', tier: 'D' },
          { id: 'FR-OK', tier: 'D', role: 'op', action: 'do subthing', outcome: 'sub result',
            acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
            priority: 'medium', traces_to: ['UJ-1'] },
          { id: 'FR-NO-AC', tier: 'D', role: 'op', action: 'do x', outcome: 'y',
            acceptance_criteria: [], priority: 'low', traces_to: ['UJ-1'] },
        ],
        surfaced_assumptions: [],
      },
    });
    mock.setFixture('nfr-product', {
      match: 'product-lens Non-Functional Requirements Bloom',
      parsedJson: { requirements: [{ id: 'NFR-001', category: 'security', description: 'd', threshold: 't', measurement_method: 'm', traces_to: ['VV-1'] }] },
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
      temperature: 0.5,
    });

    const { run } = engine.startWorkflowRun('ws', 'test');
    engine.advanceToNextPhase(run.id, '1');
    seedPriorPhaseRecords(run.id, tinyHandoff());
    engine.advanceToNextPhase(run.id, '2');
    const result = await engine.executeCurrentPhase(run.id);
    expect(result.success).toBe(true);

    const nodes = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_node');
    const children = nodes.filter(n => (n.content as { depth?: number }).depth === 1);
    expect(children).toHaveLength(1);
    expect((children[0].content as { node_id: string }).node_id).toBe('FR-OK');
  });

  it('Wave 6 Step 2 — default-lens (no handoff) skips 2.1a and emits no decomposition records beyond depth-0', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('fr-default', {
      match: 'Functional Requirements Bloom for Sub-Phase 2.1',
      parsedJson: {
        user_stories: [{
          id: 'US-001', role: 'user', action: 'use it', outcome: 'get value',
          acceptance_criteria: [{ id: 'AC-001', description: 'works', measurable_condition: 'responds within 2s' }],
          priority: 'high',
        }],
      },
    });
    mock.setFixture('nfr-default', {
      match: 'Non-Functional Requirements Bloom for Sub-Phase 2.2',
      parsedJson: {
        requirements: [{ id: 'NFR-001', category: 'performance', description: 'latency', threshold: '<500ms', measurement_method: 'load test' }],
      },
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));

    const { run } = engine.startWorkflowRun('ws', 'test');
    engine.advanceToNextPhase(run.id, '1');
    seedPriorPhaseRecords(run.id, null);
    engine.advanceToNextPhase(run.id, '2');
    const result = await engine.executeCurrentPhase(run.id);
    expect(result.success, `error=${result.error}`).toBe(true);

    const nodes = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_node');
    expect(nodes).toHaveLength(1);
    expect((nodes[0].content as { depth: number }).depth).toBe(0);
    const snapshots = engine.writer.getRecordsByType(run.id, 'assumption_set_snapshot');
    expect(snapshots).toHaveLength(0);
  });

  it('keeps the default-lens path when no handoff is present (regression isolation)', async () => {
    const mock = new MockLLMProvider();
    // Default template match — the existing non-product template is matched
    // by "Functional Requirements Bloom" without the "product-lens" suffix.
    mock.setFixture('fr-default', {
      match: 'Functional Requirements Bloom for Sub-Phase 2.1',
      parsedJson: {
        user_stories: [{
          id: 'US-001', role: 'user', action: 'use it', outcome: 'get value',
          acceptance_criteria: [{ id: 'AC-001', description: 'works', measurable_condition: 'responds within 2s' }],
          priority: 'high',
        }],
      },
    });
    mock.setFixture('nfr-default', {
      match: 'Non-Functional Requirements Bloom for Sub-Phase 2.2',
      parsedJson: {
        requirements: [{
          id: 'NFR-001', category: 'performance', description: 'latency',
          threshold: '<500ms p95', measurement_method: 'load test',
        }],
      },
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));

    const { run } = engine.startWorkflowRun('ws', 'test');
    engine.advanceToNextPhase(run.id, '1');
    seedPriorPhaseRecords(run.id, null); // NO handoff
    engine.advanceToNextPhase(run.id, '2');
    const result = await engine.executeCurrentPhase(run.id);

    expect(result.success, `phase 2 should succeed without handoff; error=${result.error}`).toBe(true);
    const artifacts = engine.writer.getRecordsByType(run.id, 'artifact_produced');
    const fr = artifacts.find(a => (a.content as { kind?: string }).kind === 'functional_requirements');
    expect(fr).toBeDefined();
    // Default-lens FR has no traces_to (or empty).
    const frContent = fr!.content as { user_stories: Array<{ traces_to?: string[] }> };
    const t = frContent.user_stories[0].traces_to ?? [];
    expect(t).toEqual([]);
  });
});
