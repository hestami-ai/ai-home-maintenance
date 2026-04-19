/**
 * Wave 4 — lens-aware Phase 1 contract + shape/coverage oracle.
 *
 * These tests pin the harness oracle that grades product-lens Phase 1
 * runs against the v1-shaped product_description_handoff (plan §10.1 +
 * §10.2):
 *
 *   1. `getPhaseContract('1', 'product')` resolves PHASE1_CONTRACT_PRODUCT,
 *      not PHASE1_CONTRACT_DEFAULT. Other lenses fall back to the default.
 *   2. `validateLineage` reads `intent_lens` from the workflow run and
 *      uses it to pick the right contract.
 *   3. The `validateProductDescriptionHandoffShape` invariant emits
 *      shape/coverage gaps with correct likely_source pointers when a
 *      handoff violates the plan-§10.2 ranges.
 *   4. A well-formed handoff satisfies the oracle with zero gaps.
 *   5. Structured gaps carry stable gap_id + likely_source + reproduce
 *      fields — the load-bearing artifact for the virtuous-cycle loop.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import {
  getPhaseContract,
  PHASE1_CONTRACT,
  PHASE1_CONTRACT_PRODUCT,
} from '../../../test/harness/phaseContracts';
import { validateLineage } from '../../../test/harness/lineageValidator';
import type { ProductDescriptionHandoffContent } from '../../../lib/types/records';

describe('Wave 4 — lens-aware Phase 1 contract resolution', () => {
  it('routes product-classified runs to PHASE1_CONTRACT_PRODUCT', () => {
    const contract = getPhaseContract('1', 'product');
    expect(contract).toBe(PHASE1_CONTRACT_PRODUCT);
  });

  it('falls back to the default Phase 1 contract for non-product lenses', () => {
    for (const lens of ['feature', 'bug', 'infra', 'legal', 'unclassified'] as const) {
      const contract = getPhaseContract('1', lens);
      expect(contract, `lens=${lens} should fall back to default`).toBe(PHASE1_CONTRACT);
    }
  });

  it('falls back to the default contract when no lens is provided', () => {
    expect(getPhaseContract('1')).toBe(PHASE1_CONTRACT);
    expect(getPhaseContract('1', null)).toBe(PHASE1_CONTRACT);
  });

  it('asserts every product-lens sub-phase in its required artifacts', () => {
    const subPhases = new Set(
      (PHASE1_CONTRACT_PRODUCT.required_artifacts
        .map(r => r.sub_phase_id)
        .filter((s): s is string => typeof s === 'string')),
    );
    // The plan's §3 table — all ten sub-phases must appear somewhere
    // in the required-artifacts list.
    for (const sp of ['1.0', '1.0a', '1.0b', '1.1b', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7']) {
      expect(subPhases.has(sp), `product contract missing sub-phase ${sp}`).toBe(true);
    }
  });
});

// ── Shape/coverage oracle tests — requires a live DB + writer ──────

describe('Wave 4 — product_description_handoff shape/coverage oracle', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  const runId = 'test-run-product-lens';

  /** Well-formed handoff matching all plan §10.2 ranges. */
  function validHandoff(): ProductDescriptionHandoffContent {
    const personas = Array.from({ length: 5 }, (_, i) => ({
      id: `P-${i + 1}`,
      name: `Persona ${i + 1}`,
      description: 'desc',
      goals: ['goal'],
      painPoints: ['pain'],
    }));
    const domains = Array.from({ length: 8 }, (_, i) => ({
      id: `DOM-${i + 1}`,
      name: `Domain ${i + 1}`,
      description: 'desc',
      rationale: 'r',
      entityPreview: ['E1', 'E2', 'E3'],
      workflowPreview: ['W1'],
    }));
    const journeys = Array.from({ length: 7 }, (_, i) => ({
      id: `UJ-${i + 1}`,
      personaId: 'P-1',
      title: `Journey ${i + 1}`,
      scenario: 's',
      steps: [
        { stepNumber: 1, actor: 'A', action: 'a', expectedOutcome: 'o' },
        { stepNumber: 2, actor: 'A', action: 'a', expectedOutcome: 'o' },
        { stepNumber: 3, actor: 'A', action: 'a', expectedOutcome: 'o' },
      ],
      acceptanceCriteria: ['ac'],
      implementationPhase: 'Phase 1',
    }));
    const entities = Array.from({ length: 25 }, (_, i) => ({
      id: `ENT-${i + 1}`,
      businessDomainId: 'DOM-1',
      name: `Entity ${i + 1}`,
      description: 'desc',
      keyAttributes: ['id', 'name'],
      relationships: ['belongs_to X'],
    }));
    const workflows = Array.from({ length: 4 }, (_, i) => ({
      id: `WF-${i + 1}`,
      businessDomainId: 'DOM-1',
      name: `WF ${i + 1}`,
      description: 'desc',
      steps: ['s1', 's2', 's3'],
      triggers: ['t1'],
      actors: ['System'],
    }));
    const integrations = Array.from({ length: 6 }, (_, i) => ({
      id: `INT-${i + 1}`,
      name: `Int ${i + 1}`,
      category: 'payment',
      description: 'desc',
      standardProviders: ['Stripe'],
      ownershipModel: 'delegated' as const,
      rationale: 'r',
    }));
    return {
      kind: 'product_description_handoff',
      schemaVersion: '1.1',
      requestCategory: 'product_or_feature',
      productVision: 'v',
      productDescription: 'd',
      summary: 's',
      personas,
      userJourneys: journeys,
      phasingStrategy: [
        { phase: 'Phase 1', description: 'd', journeyIds: ['UJ-1', 'UJ-2'], rationale: 'r' },
        { phase: 'Phase 2', description: 'd', journeyIds: ['UJ-3'], rationale: 'r' },
      ],
      successMetrics: ['m'],
      businessDomainProposals: domains,
      entityProposals: entities,
      workflowProposals: workflows,
      integrationProposals: integrations,
      qualityAttributes: Array.from({ length: 10 }, (_, i) => `QA ${i + 1}`),
      uxRequirements: ['ux'],
      requirements: [],
      decisions: [],
      constraints: [],
      openQuestions: [],
      // iter-4 decomposed extraction fields — empty arrays are valid
      // under the oracle (lower bound 0 for all four).
      technicalConstraints: [],
      complianceExtractedItems: [],
      vvRequirements: [],
      canonicalVocabulary: [],
      humanDecisions: [],
      openLoops: [],
    };
  }

  beforeEach(() => {
    db = createTestDatabase();
    let counter = 0;
    writer = new GovernedStreamWriter(db, () => `rec-${++counter}`);
    // Seed a workflow run with intent_lens='product' so the validator
    // picks up the product-lens contract.
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status, current_phase_id, intent_lens)
      VALUES (?, 'ws-1', 'test-sha', ?, 'in_progress', '1', 'product')
    `).run(runId, now);
  });

  afterEach(() => { db.close(); });

  /** Seed the full suite of product-lens Phase 1 records (minus the handoff). */
  function seedPhase1ProductLensRun(handoff: ProductDescriptionHandoffContent): void {
    writer.writeRecord({
      record_type: 'intent_quality_report',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '1',
      sub_phase_id: '1.0',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'test-sha',
      content: { overall_status: 'pass' },
    });
    const stub = (subPhaseId: string, kind: string, role = 'domain_interpreter') => {
      writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: runId,
        phase_id: '1',
        sub_phase_id: subPhaseId,
        produced_by_agent_role: role,
        janumicode_version_sha: 'test-sha',
        content: { kind },
      });
    };
    stub('1.0a', 'intent_lens_classification', 'orchestrator');
    stub('1.0b', 'intent_discovery');
    stub('1.0c', 'technical_constraints_discovery');
    stub('1.0d', 'compliance_retention_discovery');
    stub('1.0e', 'vv_requirements_discovery');
    stub('1.0f', 'canonical_vocabulary_discovery');
    stub('1.0g', 'intent_discovery_bundle', 'orchestrator');
    stub('1.1b', 'scope_classification', 'orchestrator');
    stub('1.1b', 'compliance_context', 'orchestrator');
    stub('1.2', 'business_domains_bloom');
    stub('1.3', 'journeys_workflows_bloom');
    stub('1.4', 'entities_bloom');
    stub('1.5', 'integrations_qa_bloom');
    // 1.2–1.5 decision bundles
    for (const sp of ['1.2', '1.3', '1.4', '1.5']) {
      writer.writeRecord({
        record_type: 'decision_bundle_presented',
        schema_version: '1.0',
        workflow_run_id: runId,
        phase_id: '1',
        sub_phase_id: sp,
        produced_by_agent_role: 'orchestrator',
        janumicode_version_sha: 'test-sha',
        content: { surface_id: `s-${sp}` },
      });
    }
    // 1.6 handoff + derived intent_statement
    writer.writeRecord({
      record_type: 'product_description_handoff',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '1',
      sub_phase_id: '1.6',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: 'test-sha',
      content: handoff as unknown as Record<string, unknown>,
    });
    writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '1',
      sub_phase_id: '1.6',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: 'test-sha',
      content: {
        kind: 'intent_statement',
        product_concept: { name: 'N', description: 'D', who_it_serves: 'W', problem_it_solves: 'P' },
      },
    });
    // 1.7 mirror + phase gate
    writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '1',
      sub_phase_id: '1.7',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'test-sha',
      content: { kind: 'product_description_handoff_mirror' },
    });
    writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '1',
      sub_phase_id: '1.7',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'test-sha',
      content: { kind: 'phase_gate', phase_id: '1' },
    });
  }

  it('passes validation for a well-formed handoff inside the coverage ranges', () => {
    seedPhase1ProductLensRun(validHandoff());
    const result = validateLineage(db, runId, ['1']);
    expect(result.valid, `unexpected gaps: ${JSON.stringify(result.gaps, null, 2)}`).toBe(true);
    expect(result.gaps).toHaveLength(0);
  });

  it('emits coverage_violation gaps when arrays fall below the expected ranges', () => {
    const thin = validHandoff();
    thin.personas = thin.personas.slice(0, 2); // below min of 3
    thin.entityProposals = thin.entityProposals.slice(0, 5); // below min of 20
    seedPhase1ProductLensRun(thin);

    const result = validateLineage(db, runId, ['1']);
    expect(result.valid).toBe(false);

    const personaGap = result.gaps.find(g => g.expected && (g.expected.field === 'personas'));
    expect(personaGap, 'expected a gap for personas coverage').toBeDefined();
    expect(personaGap!.category).toBe('coverage_violation');
    expect(personaGap!.sub_phase_id).toBe('1.6');
    expect(personaGap!.likely_source.templates[0]).toContain('product_description_synthesis.product.system.md');

    const entityGap = result.gaps.find(g => g.expected && (g.expected.field === 'entityProposals'));
    expect(entityGap, 'expected a gap for entityProposals coverage').toBeDefined();
    expect(entityGap!.category).toBe('coverage_violation');
  });

  it('emits shape_violation gaps when element-level invariants fail', () => {
    const broken = validHandoff();
    // persona with no goals/painPoints
    broken.personas[0] = { ...broken.personas[0], goals: [], painPoints: [] };
    // entity referencing unknown domain id
    broken.entityProposals[0] = { ...broken.entityProposals[0], businessDomainId: 'DOM-ALIEN' };
    seedPhase1ProductLensRun(broken);

    const result = validateLineage(db, runId, ['1']);
    expect(result.valid).toBe(false);

    const personaShape = result.gaps.find(g => typeof g.expected.field === 'string' && (g.expected.field as string).startsWith('personas[id='));
    expect(personaShape, 'expected element-level persona shape gap').toBeDefined();
    expect(personaShape!.category).toBe('shape_violation');

    const entityShape = result.gaps.find(g => typeof g.expected.field === 'string' && (g.expected.field as string).startsWith('entityProposals[id='));
    expect(entityShape, 'expected element-level entity shape gap').toBeDefined();
    expect((entityShape!.observed.value as string)).toContain('UNKNOWN');
  });

  it('emits a missing_artifact gap with likely_source when the handoff is absent entirely', () => {
    // Seed everything except the handoff itself.
    const handoff = validHandoff();
    seedPhase1ProductLensRun(handoff);
    // Remove the handoff record
    db.prepare(`DELETE FROM governed_stream WHERE record_type = 'product_description_handoff' AND workflow_run_id = ?`).run(runId);

    const result = validateLineage(db, runId, ['1']);
    expect(result.valid).toBe(false);
    const missingHandoff = result.gaps.find(g => g.category === 'missing_artifact' && typeof g.expected.record_type === 'string' && g.expected.record_type === 'product_description_handoff');
    expect(missingHandoff, 'expected a missing_artifact gap for product_description_handoff').toBeDefined();
    expect(missingHandoff!.sub_phase_id).toBe('1.6');
    expect(missingHandoff!.likely_source.templates[0]).toContain('product_description_synthesis.product.system.md');
    expect(missingHandoff!.likely_source.handlers[0]).toContain('runProductDescriptionSynthesis');
    expect(missingHandoff!.reproduce.command).toContain('vitest');
  });

  it('structured gaps carry a stable gap_id suitable for deduplication', () => {
    const thin = validHandoff();
    thin.personas = thin.personas.slice(0, 1);
    seedPhase1ProductLensRun(thin);
    const a = validateLineage(db, runId, ['1']);
    const b = validateLineage(db, runId, ['1']);
    const ids = (res: typeof a) => res.gaps.map(g => g.gap_id).sort();
    expect(ids(a)).toEqual(ids(b));
  });
});
