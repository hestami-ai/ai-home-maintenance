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

import * as fs from 'node:fs';
import * as os from 'node:os';
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
  const extensionPath = path.resolve(__dirname, '..', '..', '..', '..');
  const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    engine = new OrchestratorEngine(db, configManager, workspacePath, extensionPath);
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
    // UJ-1 → REL-1, UJ-2 → REL-2. Exact-coverage (verifyReleaseManifest)
    // REQUIRES every accepted artifact to be placed, and assignReleaseToRoot
    // matches an FR's traces_to against ALL placed artifact types — so backlog
    // is reached only by an FR left with NO accepted trace (see FR-BACKLOG in
    // seedPhase2Fixtures).
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
   * Seed Phase 2 fixtures for the SD-5 per-journey FR bloom.
   *
   * Under SD-5 the Pass-1 skeleton is fanned out ONE accepted journey at a time
   * (chunkedCoverageBloom), so a single monolithic fixture matched on the shared
   * template header would fire on EVERY per-journey call → the same FR ids
   * surface once per journey → a raw-id collision across the merged set →
   * frBloomThreePass deterministically renumbers ALL stories to sequential
   * `US-###`, destroying the verbatim `FR-*` display keys the release assertions
   * look up. We therefore register ONE fixture per journey, matched on a
   * substring that anchors the FR-skeleton template's per-journey header directly
   * to the scoped journey id: `fully covered)\n- UJ-1 [`. The phrase "MUST be
   * fully covered)" is unique to the fr_bloom_skeleton template (the NFR bloom
   * uses a different "Accepted User Journeys ..." header; the 1.8 release planner
   * has neither) and renders immediately before `{{accepted_journeys}}`, which in
   * a per-journey call holds ONLY the scoped journey — so the match fires on
   * exactly that journey's skeleton call and nothing else. (Matching on the
   * journey id alone fails: `formatWorkflows` leaks `journey_step(UJ-1#1)` into
   * every call; matching on a scenario/title token leaks into any call that
   * renders the full journey roster — most damagingly the 1.8 release planner,
   * whose call such a fixture would hijack, emptying the plan → "no releases
   * remain".)
   *
   *   - UJ-1's call → FR-ONBOARD (traces UJ-1) + FR-BACKLOG, which the model
   *     mis-traces to a NON-accepted journey (UJ-999). assignReleaseToRoot does a
   *     WIDENED lookup — an FR that traces ANY accepted artifact (journey,
   *     workflow, entity, compliance, integration, vocabulary, or a cross_cutting
   *     item) resolves to that artifact's release — and exact-coverage guarantees
   *     every accepted artifact IS placed. So the ONLY route to backlog is an FR
   *     with no accepted trace: Pass-1 self-heal strips the unresolvable UJ-999,
   *     leaving traces_to empty → assignReleaseToRoot returns null. This is
   *     exactly the hallucinated-trace case self-heal exists to absorb.
   *   - UJ-2's call → FR-ORDER (traces UJ-2).
   *
   * Distinct FR ids across journeys ⇒ no id collision ⇒ the merge preserves the
   * verbatim `FR-*` ids (renumber doesn't fire). Decomposition + the monolithic
   * NFR bloom are unchanged by SD-5.
   *
   * The header anchor isolates the per-journey bloom fixtures, so registration
   * order isn't load-bearing here; the remaining fixtures match on disjoint keys
   * (nfr-bloom on its own header, the decompose fixtures on unique AC
   * descriptions), so they can't collide with each other or with the anchors.
   */
  function seedPhase2Fixtures(mock: MockLLMProvider): void {
    // Per-journey skeleton fixtures — anchored to the fr_bloom_skeleton header
    // immediately preceding the scoped journey, so each fires on exactly one
    // per-journey call.
    mock.setFixture('fr-bloom-uj1', {
      match: 'fully covered)\n- UJ-1 [',
      parsedJson: {
        user_stories: [
          {
            id: 'FR-ONBOARD', role: 'operator', action: 'onboard to platform', outcome: 'logged in',
            acceptance_criteria: [{ id: 'AC-001', description: 'auth-works-uniq-onboard', measurable_condition: 'login succeeds' }],
            priority: 'critical', traces_to: ['UJ-1'],
          },
          {
            // Mis-traced FR: cites a NON-accepted journey (UJ-999). Pass-1
            // self-heal strips it → empty traces_to → backlog (see docstring).
            id: 'FR-BACKLOG', role: 'admin', action: 'future work', outcome: 'future outcome',
            acceptance_criteria: [{ id: 'AC-001', description: 'backlog-uniq', measurable_condition: 'n/a' }],
            priority: 'low', traces_to: ['UJ-999'],
          },
        ],
      },
    });
    mock.setFixture('fr-bloom-uj2', {
      match: 'fully covered)\n- UJ-2 [',
      parsedJson: {
        user_stories: [
          {
            id: 'FR-ORDER', role: 'customer', action: 'place order', outcome: 'order persisted',
            acceptance_criteria: [{ id: 'AC-001', description: 'order-saved-uniq-order', measurable_condition: 'row exists' }],
            priority: 'high', traces_to: ['UJ-2'],
          },
        ],
      },
    });
    // Monolithic NFR bloom (SD-5 is FR-only) — matched on its own distinct
    // header, which the FR-skeleton anchor never collides with.
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
    // Decomposition fixtures — matched on each root's unique AC description
    // (disjoint from every other fixture's key).
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
    mock.setFixture('fr-decompose-backlog', {
      match: 'backlog-uniq',
      parsedJson: {
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'root' },
        children: [
          {
            id: 'FR-BACKLOG-1', tier: 'D', role: 'admin', action: 'future atomic', outcome: 'future',
            acceptance_criteria: [{ id: 'AC-001', description: 'future', measurable_condition: 'future' }],
            priority: 'low', traces_to: ['UJ-999'],
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
    engine.llmCaller.registerProvider(mock.bindAsProvider('llamacpp'));
    engine.configManager.setOrchestratorRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'llamacpp', model: 'qwen3.5:9b' },
    });
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'llamacpp', model: 'qwen3.5:9b' },
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
    // SD-5 invariant: exactly the three bloomed FR roots survive (UJ-1 →
    // FR-ONBOARD + mis-traced FR-BACKLOG, UJ-2 → FR-ORDER). A regression to the
    // pre-SD-5 monolithic path would surface each FR once per journey, collide,
    // and renumber to US-### — so both the count and the verbatim display keys
    // below pin the per-journey fan-out.
    expect(roots).toHaveLength(3);
    expect(byDisplay.get('FR-ONBOARD')?.release_id).toBe(r1.release_id);
    expect(byDisplay.get('FR-ONBOARD')?.release_ordinal).toBe(1);
    expect(byDisplay.get('FR-ORDER')?.release_id).toBe(r2.release_id);
    expect(byDisplay.get('FR-ORDER')?.release_ordinal).toBe(2);
    // FR whose only trace (UJ-999) was self-healed away → no accepted trace → backlog.
    expect(byDisplay.get('FR-BACKLOG')?.release_id).toBeNull();
    expect(byDisplay.get('FR-BACKLOG')?.release_ordinal).toBeNull();

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
    // Child of the backlog root inherits backlog (null), not a journey lookup.
    expect(childByDisplay.get('FR-BACKLOG-1')?.release_id).toBeNull();
    expect(childByDisplay.get('FR-BACKLOG-1')?.release_ordinal).toBeNull();

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
