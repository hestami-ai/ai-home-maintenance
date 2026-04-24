/**
 * Phase 1 product-lens end-to-end — exercises `Phase1Handler.executeProductLens`
 * from 1.0 IQC through 1.7 handoff approval with mock LLM fixtures.
 *
 * This test pins the Wave 3 contract (per docs/phase1_product_lens_intake_plan.md
 * §11 Wave 3 + §10.1 PHASE1_CONTRACT_PRODUCT):
 *
 *   - Product-classified intents route to executeProductLens, not the
 *     default collapsed flow.
 *   - Every sub-phase in the product-lens order emits its expected
 *     artifact kind at the expected sub_phase_id.
 *   - 1.6 emits BOTH a `product_description_handoff` record AND a
 *     derived `intent_statement` record (the Option A downstream-compat
 *     strategy — Phase 2+ keeps reading intent_statement unchanged).
 *   - Happy path with auto-approved decisions completes successfully.
 *
 * The assertion style is deliberately shape+presence, not exact-content:
 * the plan's §10.2 oracle layer will add shape/coverage grading when
 * lens-aware contracts ship in Wave 4. This test just pins that the
 * pipeline plumbing is correct.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { Phase1Handler } from '../../../lib/orchestrator/phases/phase1';
import { MockLLMProvider } from '../../helpers/mockLLMProvider';

describe('Phase 1 — product-lens end-to-end flow', () => {
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
    engine.setAutoApproveDecisions(true);
  });

  afterEach(() => { db.close(); });

  /** Register the seven fixtures the product lens needs. */
  function seedProductLensFixtures(mock: MockLLMProvider): void {
    mock.setFixture('iqc', {
      match: 'Intent Quality Check',
      parsedJson: {
        overall_status: 'pass',
        completeness_findings: [],
        consistency_findings: [],
        coherence_findings: [],
      },
    });
    mock.setFixture('lens', {
      match: 'Intent Lens Classification',
      parsedJson: {
        lens: 'product',
        confidence: 0.92,
        rationale: 'Raw intent frames a full integrated product with multiple personas and pillars.',
      },
    });
    mock.setFixture('discovery', {
      match: 'PRODUCT DISCOVERY AGENT',
      parsedJson: {
        analysisSummary: 'Test product discovery summary.',
        productVision: 'An integrated platform that helps stakeholders coordinate work.',
        productDescription: 'A three-pillar platform spanning operators, customers, and administrators.',
        personas: [
          { id: 'P-1', name: 'Operator', description: 'Runs the platform', goals: ['operate'], painPoints: ['chaos'] },
          { id: 'P-2', name: 'Customer', description: 'Buys from it',     goals: ['buy'],     painPoints: ['friction'] },
        ],
        userJourneys: [
          { id: 'UJ-1', personaId: 'P-1', title: 'Onboard the operator',
            scenario: 'First login', steps: [{ stepNumber: 1, actor: 'Operator', action: 'sign up', expectedOutcome: 'account created' }],
            acceptanceCriteria: ['operator can log in'], implementationPhase: 'Phase 1', priority: 'Phase 1' },
        ],
        phasingStrategy: [
          { phase: 'Phase 1', description: 'Operator core loop', journeyIds: ['UJ-1'], rationale: 'Foundational.' },
        ],
        successMetrics: ['Weekly active operators'],
        uxRequirements: ['Mobile-first operator console'],
        requirements: [{ id: 'REQ-1', type: 'REQUIREMENT', text: 'Auth is required.' }],
        decisions: [{ id: 'DEC-1', type: 'DECISION', text: 'Use passwordless login.' }],
        constraints: [{ id: 'CON-1', type: 'CONSTRAINT', text: 'SOC2 required.' }],
        openQuestions: [{ id: 'Q-1', type: 'OPEN_QUESTION', text: 'What is the MVP surface?' }],
      },
    });
    // iter-4 decomposed extraction fixtures — each sibling pass
    // returns an empty-but-valid array so the pipeline exercises the
    // new 1.0c/1.0d/1.0e/1.0f sub-phases without requiring Hestami-
    // scale content in a unit test.
    mock.setFixture('technical', {
      match: 'TECHNICAL CONSTRAINT EXTRACTOR',
      parsedJson: { kind: 'technical_constraints_discovery', technicalConstraints: [] },
    });
    mock.setFixture('compliance', {
      match: 'COMPLIANCE & RETENTION EXTRACTOR',
      parsedJson: { kind: 'compliance_retention_discovery', complianceExtractedItems: [] },
    });
    mock.setFixture('vv', {
      match: 'VERIFICATION & VALIDATION REQUIREMENTS EXTRACTOR',
      parsedJson: { kind: 'vv_requirements_discovery', vvRequirements: [] },
    });
    mock.setFixture('vocabulary', {
      match: 'CANONICAL VOCABULARY EXTRACTOR',
      parsedJson: { kind: 'canonical_vocabulary_discovery', canonicalVocabulary: [] },
    });
    mock.setFixture('domains', {
      match: 'PRODUCT DOMAIN PROPOSER',
      parsedJson: {
        domains: [
          { id: 'DOM-IDENTITY', name: 'Identity', description: 'Auth + RBAC', rationale: 'Every persona needs it. Source: domain-standard',
            entityPreview: ['User', 'Role'], workflowPreview: ['Sign-up', 'Permission grant'], source: 'domain-standard' },
          { id: 'DOM-OPS',      name: 'Operations', description: 'Core operator loop', rationale: 'Primary Phase 1 surface. Source: user-specified',
            entityPreview: ['Workspace', 'Task'], workflowPreview: ['Assign'], source: 'user-specified' },
        ],
        personas: [
          { id: 'P-1', name: 'Operator', description: 'Runs the platform', goals: ['operate'], painPoints: ['chaos'] },
          { id: 'P-2', name: 'Customer', description: 'Buys from it',     goals: ['buy'],     painPoints: ['friction'] },
          { id: 'P-3', name: 'Administrator', description: 'Manages tenants', goals: ['manage'], painPoints: ['complexity'] },
        ],
      },
    });
    // Wave 7 — 1.3a journey bloom. Every accepted persona initiates ≥1
    // journey; every accepted domain hosts ≥1 journey. Steps tagged
    // automatable so 1.3b can back them with workflows.
    mock.setFixture('journeys-1.3a', {
      match: 'PRODUCT USER-JOURNEY PROPOSER',
      parsedJson: {
        kind: 'user_journey_bloom',
        userJourneys: [
          { id: 'UJ-1', personaId: 'P-1', title: 'Onboard the operator', scenario: 'First login',
            businessDomainIds: ['DOM-IDENTITY'],
            steps: [
              { stepNumber: 1, actor: 'P-1', action: 'sign up', expectedOutcome: 'account created', automatable: false },
              { stepNumber: 2, actor: 'System', action: 'provision identity', expectedOutcome: 'account persisted', automatable: true },
            ],
            acceptanceCriteria: ['operator can log in'], implementationPhase: 'Phase 1', umbrella: false, source: 'document-specified',
            surfaces: { compliance_regimes: [], retention_rules: [], vv_requirements: [], integrations: [] } },
          { id: 'UJ-2', personaId: 'P-2', title: 'Place an order', scenario: 'Customer places first order',
            businessDomainIds: ['DOM-OPS'],
            steps: [
              { stepNumber: 1, actor: 'P-2', action: 'search catalog', expectedOutcome: 'results shown', automatable: false },
              { stepNumber: 2, actor: 'System', action: 'persist order', expectedOutcome: 'order recorded', automatable: true },
            ],
            acceptanceCriteria: ['order persists'], implementationPhase: 'Phase 1', umbrella: false, source: 'ai-proposed',
            surfaces: { compliance_regimes: [], retention_rules: [], vv_requirements: [], integrations: [] } },
          { id: 'UJ-3', personaId: 'P-3', title: 'Manage tenants', scenario: 'Admin provisions a tenant',
            businessDomainIds: ['DOM-IDENTITY', 'DOM-OPS'],
            steps: [
              { stepNumber: 1, actor: 'P-3', action: 'create tenant', expectedOutcome: 'tenant created', automatable: true },
            ],
            acceptanceCriteria: ['admin can provision a tenant'], implementationPhase: 'Phase 1', umbrella: false, source: 'ai-proposed',
            surfaces: { compliance_regimes: [], retention_rules: [], vv_requirements: [], integrations: [] } },
        ],
        unreached_personas: [],
        unreached_domains: [],
      },
    });
    // Wave 7 — 1.3b workflow bloom. Every automatable step backed by
    // ≥1 workflow with a journey_step trigger; domain coverage for
    // both DOM-IDENTITY and DOM-OPS.
    mock.setFixture('workflows-1.3b', {
      match: 'PRODUCT SYSTEM-WORKFLOW PROPOSER',
      parsedJson: {
        kind: 'system_workflow_bloom',
        workflows: [
          { id: 'WF-1', businessDomainId: 'DOM-IDENTITY', name: 'Provision identity',
            description: 'Create the persisted account for a signing-up user',
            steps: [{ stepNumber: 1, actor: 'System', action: 'validate email', expectedOutcome: 'email format accepted' },
                    { stepNumber: 2, actor: 'System', action: 'persist user record', expectedOutcome: 'account row committed' }],
            triggers: [{ kind: 'journey_step', journey_id: 'UJ-1', step_number: 2 }],
            actors: ['System'], backs_journeys: ['UJ-1'], umbrella: false, source: 'domain-standard',
            surfaces: { compliance_regimes: [], retention_rules: [], vv_requirements: [], integrations: [] } },
          { id: 'WF-2', businessDomainId: 'DOM-OPS', name: 'Persist order',
            description: 'Record a new customer order',
            steps: [{ stepNumber: 1, actor: 'System', action: 'persist order record', expectedOutcome: 'order committed' }],
            triggers: [{ kind: 'journey_step', journey_id: 'UJ-2', step_number: 2 }],
            actors: ['System'], backs_journeys: ['UJ-2'], umbrella: false, source: 'ai-proposed',
            surfaces: { compliance_regimes: [], retention_rules: [], vv_requirements: [], integrations: [] } },
          { id: 'WF-3', businessDomainId: 'DOM-IDENTITY', name: 'Provision tenant',
            description: 'Create a new tenant scope',
            steps: [{ stepNumber: 1, actor: 'System', action: 'create tenant row', expectedOutcome: 'tenant committed' }],
            triggers: [{ kind: 'journey_step', journey_id: 'UJ-3', step_number: 1 }],
            actors: ['System'], backs_journeys: ['UJ-3'], umbrella: false, source: 'ai-proposed',
            surfaces: { compliance_regimes: [], retention_rules: [], vv_requirements: [], integrations: [] } },
        ],
        step_backing_map: [
          { journey_id: 'UJ-1', step_number: 2, workflow_ids: ['WF-1'] },
          { journey_id: 'UJ-2', step_number: 2, workflow_ids: ['WF-2'] },
          { journey_id: 'UJ-3', step_number: 1, workflow_ids: ['WF-3'] },
        ],
      },
    });
    mock.setFixture('entities', {
      match: 'PRODUCT DATA MODEL PROPOSER',
      parsedJson: {
        entities: [
          { id: 'ENT-USER',    businessDomainId: 'DOM-IDENTITY', name: 'User',    description: 'Authn principal',
            keyAttributes: ['userId', 'email'], relationships: ['has_one Role'], source: 'domain-standard' },
          { id: 'ENT-ROLE',    businessDomainId: 'DOM-IDENTITY', name: 'Role',    description: 'RBAC role',
            keyAttributes: ['roleId', 'name'], relationships: ['belongs_to Tenant'], source: 'domain-standard' },
          { id: 'ENT-WORKSPACE', businessDomainId: 'DOM-OPS',     name: 'Workspace', description: 'Operator scope',
            keyAttributes: ['workspaceId', 'ownerId'], relationships: ['has_many Task'], source: 'ai-proposed' },
        ],
      },
    });
    mock.setFixture('integrations', {
      match: 'PRODUCT INTEGRATION & QUALITY PROPOSER',
      parsedJson: {
        integrations: [
          { id: 'INT-EMAIL', name: 'Transactional email', category: 'communication',
            description: 'Send verification + notification emails', standardProviders: ['Postmark', 'SendGrid'],
            ownershipModel: 'delegated', rationale: 'Required for WF-1 Sign-up.', source: 'domain-standard' },
        ],
        qualityAttributes: [
          'Multi-tenant data isolation must be enforced at the Tenant boundary.',
          'All authn secrets must be hashed with argon2id or equivalent.',
          'Mobile-first UX for operator console.',
        ],
      },
    });
    // Wave 7 Path C — 1.8 is now narrow: LLM outputs release structure
    // + journey placement only. Everything else (workflows, entities,
    // compliance, integrations, vocabulary) is computed deterministically
    // from triggers + domain references by buildReleaseManifest.
    mock.setFixture('release-plan', {
      match: 'RELEASE PLANNER',
      parsedJson: {
        kind: 'release_plan',
        schemaVersion: '2.0',
        releases: [
          {
            release_id: 'REL-1',
            ordinal: 1,
            name: 'Onboarding',
            description: 'Operators and customers can sign up and authenticate.',
            rationale: 'Identity and signup must ship first for any other capability to land.',
            contains_journeys: ['UJ-1', 'UJ-3'],
          },
          {
            release_id: 'REL-2',
            ordinal: 2,
            name: 'Core Ordering',
            description: 'Customers can browse and place orders.',
            rationale: 'Requires onboarding (Release 1) before orders can be attributed.',
            contains_journeys: ['UJ-2'],
          },
        ],
      },
    });
    mock.setFixture('synthesis', {
      match: 'PRODUCT DESCRIPTION SYNTHESIZER',
      parsedJson: {
        kind: 'product_description_handoff',
        schemaVersion: '1.0',
        requestCategory: 'product_or_feature',
        productVision: 'An integrated platform that helps stakeholders coordinate work.',
        productDescription: 'Three-pillar platform spanning operators, customers, and administrators.',
        summary: 'Consolidated handoff summary.',
        // personas/domains/journeys/etc. omitted — the handler's carry-forward
        // guarantees they come from the accepted bloom outputs.
        requirements: [{ id: 'REQ-1', type: 'REQUIREMENT', text: 'Auth is required.' }],
        decisions: [{ id: 'DEC-1', type: 'DECISION', text: 'Use passwordless login.' }],
        constraints: [{ id: 'CON-1', type: 'CONSTRAINT', text: 'SOC2 required.' }],
        openQuestions: [{ id: 'Q-1', type: 'OPEN_QUESTION', text: 'What is the MVP surface?' }],
        humanDecisions: [],
        openLoops: [{ category: 'deferred_decision', description: 'What is the MVP surface?', priority: 'high' }],
      },
    });
  }

  it('routes a product-classified intent through 1.0b → 1.8 and emits every expected artifact', async () => {
    const mock = new MockLLMProvider();
    seedProductLensFixtures(mock);
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setOrchestratorRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
    });

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    engine.writer.writeRecord({
      record_type: 'raw_intent_received',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { text: 'Build an integrated three-pillar platform for operators, customers, and admins.' },
    });

    const result = await engine.executeCurrentPhase(run.id);
    expect(result.success, `Phase 1 should succeed under product lens; error=${result.error}`).toBe(true);

    const updatedRun = engine.stateMachine.getWorkflowRun(run.id);
    expect(updatedRun?.intent_lens).toBe('product');

    const artifacts = engine.writer.getRecordsByType(run.id, 'artifact_produced');
    const findByKind = (kind: string) => artifacts.find(a => (a.content as { kind?: string }).kind === kind);

    // Every product-lens sub-phase writes its expected artifact kind.
    expect(findByKind('intent_lens_classification')?.sub_phase_id).toBe('1.0a');
    expect(findByKind('intent_discovery')?.sub_phase_id).toBe('1.0b');
    // iter-4 decomposed extraction sub-phases each emit a record.
    expect(findByKind('technical_constraints_discovery')?.sub_phase_id).toBe('1.0c');
    expect(findByKind('compliance_retention_discovery')?.sub_phase_id).toBe('1.0d');
    expect(findByKind('vv_requirements_discovery')?.sub_phase_id).toBe('1.0e');
    expect(findByKind('canonical_vocabulary_discovery')?.sub_phase_id).toBe('1.0f');
    expect(findByKind('intent_discovery_bundle')?.sub_phase_id).toBe('1.0g');
    expect(findByKind('scope_classification')?.sub_phase_id).toBe('1.1b');
    expect(findByKind('compliance_context')?.sub_phase_id).toBe('1.1b');
    expect(findByKind('business_domains_bloom')?.sub_phase_id).toBe('1.2');
    // Wave 7 — 1.3 is split into 1.3a (journeys) + 1.3b (workflows).
    expect(findByKind('user_journey_bloom')?.sub_phase_id).toBe('1.3a');
    expect(findByKind('system_workflow_bloom')?.sub_phase_id).toBe('1.3b');
    expect(findByKind('entities_bloom')?.sub_phase_id).toBe('1.4');
    expect(findByKind('integrations_qa_bloom')?.sub_phase_id).toBe('1.5');
    expect(findByKind('intent_statement')?.sub_phase_id).toBe('1.6');

    // The quality report lives on its own record_type.
    const qualityReports = engine.writer.getRecordsByType(run.id, 'intent_quality_report');
    expect(qualityReports.length).toBe(1);

    // The product description handoff lives on its own record_type.
    const handoffs = engine.writer.getRecordsByType(run.id, 'product_description_handoff');
    expect(handoffs.length).toBe(1);
    expect(handoffs[0].sub_phase_id).toBe('1.6');
    const handoff = handoffs[0].content as Record<string, unknown>;
    expect(handoff.kind).toBe('product_description_handoff');
    // Carry-forward sanity: the accepted bloom outputs flow through
    // synthesis verbatim because the LLM fixture omitted those arrays
    // and the handler falls back to the accepted inputs.
    expect(handoff.personas).toBeDefined();
    expect((handoff.personas as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect((handoff.businessDomainProposals as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect((handoff.entityProposals as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect((handoff.integrationProposals as unknown[]).length).toBeGreaterThanOrEqual(1);

    // Decision bundles: 1.2 + 1.3a + 1.3b + 1.4 + 1.5 + 1.8 (Wave 7 split).
    const bundles = engine.writer.getRecordsByType(run.id, 'decision_bundle_presented');
    const bundleSubPhases = bundles.map(b => b.sub_phase_id).sort();
    expect(bundleSubPhases).toEqual(['1.2', '1.3a', '1.3b', '1.4', '1.5', '1.8']);

    // 1.7 handoff approval emitted its mirror; phase gate now fires at 1.8.
    const mirrors = engine.writer.getRecordsByType(run.id, 'mirror_presented');
    const mirrorAt17 = mirrors.find(m => m.sub_phase_id === '1.7');
    expect(mirrorAt17).toBeDefined();
    const gates = engine.writer.getRecordsByType(run.id, 'phase_gate_evaluation');
    expect(gates.some(g => g.sub_phase_id === '1.8')).toBe(true);

    // 1.8 release plan: at least two artifact_produced records of
    // kind=release_plan (the proposer output + the final approved
    // record). The approved record has approved=true and is pointed
    // at by workflow_runs.active_release_plan_record_id.
    const releasePlans = artifacts.filter(a =>
      (a.content as { kind?: string }).kind === 'release_plan');
    expect(releasePlans.length).toBeGreaterThanOrEqual(2);
    const approvedPlan = releasePlans.find(a =>
      (a.content as { approved?: boolean }).approved === true);
    expect(approvedPlan, 'final approved release plan').toBeDefined();
    const approvedContent = approvedPlan!.content as {
      releases: Array<{ ordinal: number; name: string; release_id: string }>;
    };
    expect(approvedContent.releases.length).toBe(2);
    expect(approvedContent.releases.map(r => r.ordinal).sort((a, b) => a - b)).toEqual([1, 2]);
    // The active pointer on workflow_runs matches the approved record.
    expect(updatedRun?.active_release_plan_record_id).toBe(approvedPlan!.id);
    // Release IDs on the approved record are server-minted UUIDs (the
    // LLM's `REL-1` short form is discarded).
    for (const r of approvedContent.releases) {
      expect(r.release_id).toMatch(/^[0-9a-f]{8}-/i);
    }
  });

  it('does NOT route non-product lenses into the product-lens flow', async () => {
    // Feature-classified intents should land in the default collapsed
    // flow — no product_description_handoff record should exist.
    const mock = new MockLLMProvider();
    mock.setFixture('iqc', {
      match: 'Intent Quality Check',
      parsedJson: { overall_status: 'pass', completeness_findings: [], consistency_findings: [], coherence_findings: [] },
    });
    mock.setFixture('lens-feature', {
      match: 'Intent Lens Classification',
      parsedJson: { lens: 'feature', confidence: 0.9, rationale: 'Small feature add.' },
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setOrchestratorRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
    });

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    engine.writer.writeRecord({
      record_type: 'raw_intent_received',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { text: 'Add a CSV export to the reports page.' },
    });

    await engine.executeCurrentPhase(run.id);
    const handoffs = engine.writer.getRecordsByType(run.id, 'product_description_handoff');
    expect(handoffs.length).toBe(0);
  });
});
