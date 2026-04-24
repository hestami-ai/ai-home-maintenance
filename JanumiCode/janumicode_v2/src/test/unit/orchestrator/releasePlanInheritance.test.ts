/**
 * Release-prioritization v1 — behavioural tests.
 *
 * Covers the Phase 2 write + propagation contract after Phase 1.8
 * produces an approved ReleasePlan:
 *
 *   - FR + NFR depth-0 roots get `release_id` / `release_ordinal`
 *     populated from the plan's traces_to_journeys lookup. Backlog
 *     (null) when no journey match.
 *   - Every descendant (depth ≥ 1) inherits the parent's release.
 *   - Supersession records (downgrade, pruned, deferred) PRESERVE the
 *     release assignment — revising a node never silently relocates
 *     it across releases (design doc Q2).
 *   - rebuildSaturationStateFromStream recovers release assignments
 *     on resume so fresh passes keep inheriting correctly.
 *
 * Uses MockLLMProvider + auto-approved decisions so the full Phase 1
 * → Phase 2 chain runs hermetically.
 */

import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { Phase1Handler } from '../../../lib/orchestrator/phases/phase1';
import { Phase2Handler } from '../../../lib/orchestrator/phases/phase2';
import { MockLLMProvider } from '../../helpers/mockLLMProvider';

describe('Release prioritization — Phase 1.8 → Phase 2 propagation', () => {
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
    engine.registerPhase(new Phase2Handler());
    engine.setAutoApproveDecisions(true);
  });

  afterEach(() => { db.close(); });

  /**
   * Seed a minimal product-lens Phase 1 fixture chain that produces:
   *   - 2 journeys: UJ-1, UJ-2
   *   - A ReleasePlan assigning UJ-1 → Release 1, UJ-2 → Release 2.
   */
  function seedProductLensChain(mock: MockLLMProvider): void {
    mock.setFixture('iqc', {
      match: 'Intent Quality Check',
      parsedJson: { overall_status: 'pass', completeness_findings: [], consistency_findings: [], coherence_findings: [] },
    });
    mock.setFixture('lens', {
      match: 'Intent Lens Classification',
      parsedJson: { lens: 'product', confidence: 0.9, rationale: 'r' },
    });
    mock.setFixture('discovery', {
      match: 'PRODUCT DISCOVERY AGENT',
      parsedJson: {
        analysisSummary: 's',
        productVision: 'v', productDescription: 'd',
        discoveredPersonas: [
          { id: 'P-1', name: 'Operator', description: 'ops', goals: ['g'], painPoints: ['p'], source: 'ai-proposed' },
          { id: 'P-2', name: 'Customer', description: 'cust', goals: ['g'], painPoints: ['p'], source: 'ai-proposed' },
        ],
        discoveredJourneys: [
          { id: 'UJ-1', personaId: 'P-1', title: 'Onboard', scenario: 's',
            steps: [{ stepNumber: 1, actor: 'Operator', action: 'sign up', expectedOutcome: 'in' }],
            acceptanceCriteria: ['ok'], implementationPhase: 'Phase 1', source: 'document-specified' },
          { id: 'UJ-2', personaId: 'P-2', title: 'Order', scenario: 's',
            steps: [{ stepNumber: 1, actor: 'Customer', action: 'buy', expectedOutcome: 'ok' }],
            acceptanceCriteria: ['ok'], implementationPhase: 'Phase 2', source: 'ai-proposed' },
        ],
        phasingStrategy: [
          { phase: 'Phase 1', description: 'onboarding', journeyIds: ['UJ-1'], rationale: 'r' },
          { phase: 'Phase 2', description: 'ordering', journeyIds: ['UJ-2'], rationale: 'r' },
        ],
        successMetrics: [], requirements: [], decisions: [], constraints: [], openQuestions: [],
        humanDecisions: [], openLoops: [],
      },
    });
    mock.setFixture('technical',   { match: 'TECHNICAL CONSTRAINT EXTRACTOR',  parsedJson: { technicalConstraints: [] } });
    mock.setFixture('compliance',  { match: 'COMPLIANCE & RETENTION EXTRACTOR', parsedJson: { complianceExtractedItems: [] } });
    mock.setFixture('vv',          { match: 'VERIFICATION & VALIDATION REQUIREMENTS EXTRACTOR', parsedJson: { vvRequirements: [] } });
    mock.setFixture('vocabulary',  { match: 'CANONICAL VOCABULARY EXTRACTOR',  parsedJson: { canonicalVocabulary: [] } });
    mock.setFixture('domains', {
      match: 'PRODUCT DOMAIN PROPOSER',
      parsedJson: {
        domains: [
          { id: 'DOM-IDENTITY', name: 'Identity', description: 'd', rationale: 'r', entityPreview: [], workflowPreview: [], source: 'domain-standard' },
          { id: 'DOM-OPS',      name: 'Ops',      description: 'd', rationale: 'r', entityPreview: [], workflowPreview: [], source: 'ai-proposed' },
        ],
        personas: [
          { id: 'P-1', name: 'Operator', description: 'ops', goals: ['g'], painPoints: ['p'], source: 'ai-proposed' },
          { id: 'P-2', name: 'Customer', description: 'cust', goals: ['g'], painPoints: ['p'], source: 'ai-proposed' },
        ],
      },
    });
    // Wave 7 — 1.3a journey bloom. Every persona (P-1, P-2) initiates
    // ≥1 journey; both domains (DOM-IDENTITY, DOM-OPS) are hosted.
    mock.setFixture('journeys-1.3a', {
      match: 'PRODUCT USER-JOURNEY PROPOSER',
      parsedJson: {
        kind: 'user_journey_bloom',
        userJourneys: [
          { id: 'UJ-1', personaId: 'P-1', title: 'Onboard', scenario: 's',
            businessDomainIds: ['DOM-IDENTITY'],
            steps: [{ stepNumber: 1, actor: 'System', action: 'provision', expectedOutcome: 'in', automatable: true }],
            acceptanceCriteria: ['ok'], implementationPhase: 'Phase 1', umbrella: false, source: 'document-specified',
            surfaces: { compliance_regimes: [], retention_rules: [], vv_requirements: [], integrations: [] } },
          { id: 'UJ-2', personaId: 'P-2', title: 'Order', scenario: 's',
            businessDomainIds: ['DOM-OPS'],
            steps: [{ stepNumber: 1, actor: 'System', action: 'persist order', expectedOutcome: 'ok', automatable: true }],
            acceptanceCriteria: ['ok'], implementationPhase: 'Phase 2', umbrella: false, source: 'ai-proposed',
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
          { id: 'WF-1', businessDomainId: 'DOM-IDENTITY', name: 'Provision', description: 'd',
            steps: [{ stepNumber: 1, actor: 'System', action: 'a', expectedOutcome: 'o' }],
            triggers: [{ kind: 'journey_step', journey_id: 'UJ-1', step_number: 1 }],
            actors: ['System'], backs_journeys: ['UJ-1'], umbrella: false, source: 'domain-standard',
            surfaces: { compliance_regimes: [], retention_rules: [], vv_requirements: [], integrations: [] } },
          { id: 'WF-2', businessDomainId: 'DOM-OPS', name: 'Persist order', description: 'd',
            steps: [{ stepNumber: 1, actor: 'System', action: 'a', expectedOutcome: 'o' }],
            triggers: [{ kind: 'journey_step', journey_id: 'UJ-2', step_number: 1 }],
            actors: ['System'], backs_journeys: ['UJ-2'], umbrella: false, source: 'ai-proposed',
            surfaces: { compliance_regimes: [], retention_rules: [], vv_requirements: [], integrations: [] } },
        ],
        step_backing_map: [
          { journey_id: 'UJ-1', step_number: 1, workflow_ids: ['WF-1'] },
          { journey_id: 'UJ-2', step_number: 1, workflow_ids: ['WF-2'] },
        ],
      },
    });
    mock.setFixture('entities', {
      match: 'PRODUCT DATA MODEL PROPOSER',
      parsedJson: {
        entities: [
          { id: 'ENT-USER', businessDomainId: 'DOM-IDENTITY', name: 'User', description: 'd',
            keyAttributes: ['id'], relationships: [], source: 'domain-standard' },
        ],
      },
    });
    mock.setFixture('integrations', {
      match: 'PRODUCT INTEGRATION & QUALITY PROPOSER',
      parsedJson: { integrations: [], qualityAttributes: [] },
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
    // Wave 7 Path C — narrow 1.8 shape: LLM places journeys in releases;
    // workflows/entities derive deterministically from triggers + domains.
    // UJ-1 → REL-1, UJ-2 → REL-2. FR roots tracing to UJ-1/UJ-2 resolve
    // through the manifest; roots tracing to UJ-999 remain backlog.
    mock.setFixture('release-plan', {
      match: 'RELEASE PLANNER',
      parsedJson: {
        kind: 'release_plan',
        schemaVersion: '2.0',
        releases: [
          { release_id: 'REL-1', ordinal: 1, name: 'Onboarding',
            description: 'Onboard operators + customers', rationale: 'Must ship first',
            contains_journeys: ['UJ-1'] },
          { release_id: 'REL-2', ordinal: 2, name: 'Core Ordering',
            description: 'Customers can order', rationale: 'Depends on Release 1',
            contains_journeys: ['UJ-2'] },
        ],
      },
    });
  }

  /**
   * Seed Phase 2 fixtures that bloom ONE FR per journey (so roots' traces_to
   * map cleanly to the ReleasePlan journeys), produce a Tier-D atomic child,
   * and skip NFR decomposition for brevity.
   */
  function seedPhase2Fixtures(mock: MockLLMProvider): void {
    mock.setFixture('fr-bloom', {
      match: 'product-lens Functional Requirements Bloom',
      parsedJson: {
        user_stories: [
          {
            id: 'FR-ONBOARD', role: 'operator', action: 'onboard to platform', outcome: 'logged in',
            acceptance_criteria: [{ id: 'AC-001', description: 'auth-works-uniq-onboard', measurable_condition: 'login succeeds' }],
            priority: 'critical', traces_to: ['UJ-1'],
          },
          {
            id: 'FR-ORDER', role: 'customer', action: 'place order', outcome: 'order persisted',
            acceptance_criteria: [{ id: 'AC-001', description: 'order-saved-uniq-order', measurable_condition: 'row exists' }],
            priority: 'high', traces_to: ['UJ-2'],
          },
          {
            id: 'FR-UNASSIGNED', role: 'admin', action: 'future work', outcome: 'future outcome',
            acceptance_criteria: [{ id: 'AC-001', description: 'future-uniq-unassigned', measurable_condition: 'n/a' }],
            priority: 'low', traces_to: ['UJ-999'],
          },
        ],
      },
    });
    mock.setFixture('fr-decompose', {
      match: 'auth-works-uniq-onboard',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root' },
        children: [
          {
            id: 'FR-ONBOARD-1', tier: 'D', role: 'operator', action: 'click verify link', outcome: 'email confirmed',
            acceptance_criteria: [{ id: 'AC-001', description: 'link works', measurable_condition: 'redirects' }],
            priority: 'critical', traces_to: ['UJ-1'],
          },
        ],
        surfaced_assumptions: [],
      },
    });
    mock.setFixture('fr-decompose-order', {
      match: 'order-saved-uniq-order',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root' },
        children: [
          {
            id: 'FR-ORDER-1', tier: 'D', role: 'customer', action: 'submit order', outcome: 'row in orders',
            acceptance_criteria: [{ id: 'AC-001', description: 'row exists', measurable_condition: 'count=1' }],
            priority: 'high', traces_to: ['UJ-2'],
          },
        ],
        surfaced_assumptions: [],
      },
    });
    mock.setFixture('fr-decompose-unassigned', {
      match: 'future-uniq-unassigned',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root' },
        children: [
          {
            id: 'FR-UNASSIGNED-1', tier: 'D', role: 'admin', action: 'future atomic', outcome: 'future',
            acceptance_criteria: [{ id: 'AC-001', description: 'future', measurable_condition: 'future' }],
            priority: 'low', traces_to: ['UJ-999'],
          },
        ],
        surfaced_assumptions: [],
      },
    });
    mock.setFixture('nfr-bloom', {
      match: 'product-lens Non-Functional Requirements Bloom',
      parsedJson: {
        requirements: [
          {
            id: 'NFR-AUDIT', category: 'security', description: 'audit trail is immutable',
            threshold: 'every write is append-only', measurement_method: 'schema check', traces_to: ['UJ-1'],
          },
        ],
      },
    });
    mock.setFixture('nfr-decompose', {
      match: 'audit trail is immutable',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root' },
        children: [
          {
            id: 'NFR-AUDIT-1', tier: 'D', role: 'system', action: 'enforce append-only',
            outcome: 'audit rows immutable',
            acceptance_criteria: [{ id: 'AC-001', description: 'ddl constraint', measurable_condition: 'UPDATE fails' }],
            priority: 'critical', traces_to: ['UJ-1'],
          },
        ],
        surfaced_assumptions: [],
      },
    });
  }

  it('propagates release_id + release_ordinal from plan → FR roots → children; unmatched roots → backlog', async () => {
    const mock = new MockLLMProvider();
    seedProductLensChain(mock);
    seedPhase2Fixtures(mock);
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setOrchestratorRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
    });
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
      temperature: 0.5,
    });

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    engine.writer.writeRecord({
      record_type: 'raw_intent_received', schema_version: '1.0', workflow_run_id: run.id, phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { text: 'Build a two-capability platform with onboarding and ordering.' },
    });

    const p1 = await engine.executeCurrentPhase(run.id);
    expect(p1.success, `phase 1 should succeed; error=${p1.error}`).toBe(true);
    // Active ReleasePlan pointer must be set.
    const postP1 = engine.stateMachine.getWorkflowRun(run.id);
    expect(postP1?.active_release_plan_record_id).toBeTruthy();

    engine.advanceToNextPhase(run.id, '2');
    const p2 = await engine.executeCurrentPhase(run.id);
    expect(p2.success, `phase 2 should succeed; error=${p2.error}`).toBe(true);

    // Resolve the approved plan so we can assert against its release UUIDs.
    const planRec = engine.writer.getRecord(postP1!.active_release_plan_record_id!);
    const plan = planRec!.content as unknown as {
      releases: Array<{ release_id: string; ordinal: number; contains: { journeys: string[] } }>;
    };
    const r1 = plan.releases.find(r => r.contains.journeys.includes('UJ-1'))!;
    const r2 = plan.releases.find(r => r.contains.journeys.includes('UJ-2'))!;
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    expect(r1.ordinal).toBe(1);
    expect(r2.ordinal).toBe(2);

    // Depth-0 FR roots: UJ-1 → R1, UJ-2 → R2, UJ-999 → backlog.
    const nodes = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_node');
    const roots = nodes.filter(n => {
      const c = n.content as { depth?: number; root_kind?: string };
      return c.depth === 0 && (c.root_kind ?? 'fr') === 'fr';
    });
    const byDisplay = new Map<string, Record<string, unknown>>();
    for (const r of roots) {
      const c = r.content as { display_key: string };
      byDisplay.set(c.display_key, r.content as Record<string, unknown>);
    }
    expect(byDisplay.get('FR-ONBOARD')?.release_id).toBe(r1.release_id);
    expect(byDisplay.get('FR-ONBOARD')?.release_ordinal).toBe(1);
    expect(byDisplay.get('FR-ORDER')?.release_id).toBe(r2.release_id);
    expect(byDisplay.get('FR-ORDER')?.release_ordinal).toBe(2);
    // Unassigned root → backlog.
    expect(byDisplay.get('FR-UNASSIGNED')?.release_id).toBeNull();
    expect(byDisplay.get('FR-UNASSIGNED')?.release_ordinal).toBeNull();

    // Depth-1 atomic children inherit their parent's release.
    const children = nodes.filter(n => {
      const c = n.content as { depth?: number; root_kind?: string };
      return c.depth === 1 && (c.root_kind ?? 'fr') === 'fr';
    });
    const childByDisplay = new Map<string, Record<string, unknown>>();
    for (const c of children) {
      const content = c.content as { display_key: string };
      childByDisplay.set(content.display_key, c.content as Record<string, unknown>);
    }
    expect(childByDisplay.get('FR-ONBOARD-1')?.release_id).toBe(r1.release_id);
    expect(childByDisplay.get('FR-ONBOARD-1')?.release_ordinal).toBe(1);
    expect(childByDisplay.get('FR-ORDER-1')?.release_id).toBe(r2.release_id);
    expect(childByDisplay.get('FR-ORDER-1')?.release_ordinal).toBe(2);
    expect(childByDisplay.get('FR-UNASSIGNED-1')?.release_id).toBeNull();
    expect(childByDisplay.get('FR-UNASSIGNED-1')?.release_ordinal).toBeNull();

    // NFR root that traces to UJ-1 also gets Release 1.
    const nfrRoots = nodes.filter(n => {
      const c = n.content as { depth?: number; root_kind?: string };
      return c.depth === 0 && c.root_kind === 'nfr';
    });
    expect(nfrRoots).toHaveLength(1);
    const nfrContent = nfrRoots[0].content as Record<string, unknown>;
    expect(nfrContent.release_id).toBe(r1.release_id);
    expect(nfrContent.release_ordinal).toBe(1);
  });
});
