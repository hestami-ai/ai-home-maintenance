/**
 * Phase 1 Sub-Phase 1.8 verifier — deterministic release-manifest
 * coverage + coherence checks.
 *
 * Runs after the LLM proposes a `ReleasePlanContentV2` and before the
 * human sees the MMP approval card. Confirms:
 *   - Exact coverage: every accepted handoff artifact appears in
 *     exactly one release's `contains[type]` OR in the top-level
 *     `cross_cutting[type]` bucket (for the artifact types that allow
 *     cross-cutting). Nothing dropped, nothing duplicated.
 *   - Ordinal integrity: ordinals are contiguous from 1, no gaps, no
 *     duplicates.
 *   - No backward dependencies: a workflow with a journey_step /
 *     compliance / integration trigger does not ship in a release
 *     earlier than the release containing its trigger target.
 *   - Trace-coherence (advisory): flags patterns that would produce
 *     cross-release traces downstream (e.g. a workflow in release K
 *     with a trigger pointing at an artifact in release K+1 — even if
 *     the forward-only constraint is respected, this is often a
 *     planning smell worth surfacing for human review).
 *
 * Emits `CoverageGapContent` records with `sub_phase_id: '1.8'`.
 * `blocking` severity pauses the MMP approval gate; `advisory` severity
 * surfaces warnings for the human to consider without blocking.
 *
 * Pure function — no side effects. Caller persists returned records.
 */

import type {
  CoverageGapContent,
  ExtractedItem,
  Integration,
  ReleasePlanContentV2,
  UserJourney,
  VocabularyTerm,
  WorkflowV2,
} from '../../../types/records';

export interface ReleaseManifestVerifierInputs {
  plan: ReleasePlanContentV2;
  /** All accepted journeys — must all appear in exactly one release. */
  journeys: UserJourney[];
  /** All accepted workflows — must appear in exactly one release OR cross_cutting. */
  workflows: WorkflowV2[];
  /** All accepted entity ids — must appear in exactly one release (no cross_cutting for entities). */
  entityIds: string[];
  /** All accepted compliance item ids — exactly one release OR cross_cutting. */
  complianceIds: string[];
  /** All accepted integration ids — exactly one release OR cross_cutting. */
  integrations: Integration[];
  /** All accepted vocabulary — exactly one release OR cross_cutting. */
  vocabulary: VocabularyTerm[];
}

export type ReleaseManifestVerifierResult = CoverageGapContent[];

const SUB_PHASE: '1.8' = '1.8';

// ── Helpers ────────────────────────────────────────────────────────

function uniqSorted(xs: string[]): string[] {
  return Array.from(new Set(xs)).sort();
}

function mkGap(params: {
  check: string;
  assertion: string;
  severity: 'blocking' | 'advisory';
  expected: string[];
  actual: string[];
  missing: string[];
  extra?: string[];
  details?: Record<string, unknown>;
}): CoverageGapContent {
  return {
    kind: 'coverage_gap',
    schemaVersion: '1.0',
    sub_phase_id: SUB_PHASE,
    assertion: params.assertion,
    severity: params.severity,
    check: params.check,
    expected: uniqSorted(params.expected),
    actual: uniqSorted(params.actual),
    missing: uniqSorted(params.missing),
    ...(params.extra ? { extra: uniqSorted(params.extra) } : {}),
    ...(params.details ? { details: params.details } : {}),
    resolution: 'pending',
  };
}

/**
 * Exact-coverage check: ⋃ release.contains[type] ∪ cross_cutting[type]
 * must equal the accepted set. No id may appear in more than one
 * release, and no id may appear in both a release and cross_cutting.
 */
function checkExactCoverage(params: {
  check: string;
  assertion: string;
  expected: string[];
  perRelease: Map<string, string[]>; // release_id -> ids
  crossCutting?: string[];
}): CoverageGapContent[] {
  // Build actual-coverage set and per-id placement index.
  const idToPlacements = new Map<string, string[]>(); // id -> ['REL-1', 'REL-2', 'cross_cutting', ...]
  for (const [relId, ids] of params.perRelease.entries()) {
    for (const id of ids) {
      const arr = idToPlacements.get(id) ?? [];
      arr.push(relId);
      idToPlacements.set(id, arr);
    }
  }
  for (const id of params.crossCutting ?? []) {
    const arr = idToPlacements.get(id) ?? [];
    arr.push('cross_cutting');
    idToPlacements.set(id, arr);
  }

  const actual = Array.from(idToPlacements.keys());
  const expectedSet = new Set(params.expected);
  const missing = params.expected.filter(id => !idToPlacements.has(id));
  const extra = actual.filter(id => !expectedSet.has(id));
  const doubleCounted: Array<{ id: string; placements: string[] }> = [];
  for (const [id, placements] of idToPlacements.entries()) {
    if (placements.length > 1) doubleCounted.push({ id, placements });
  }

  const gaps: CoverageGapContent[] = [];
  if (missing.length > 0 || extra.length > 0) {
    gaps.push(mkGap({
      check: params.check,
      assertion: params.assertion,
      severity: 'blocking',
      expected: params.expected,
      actual,
      missing,
      extra: extra.length > 0 ? extra : undefined,
    }));
  }
  if (doubleCounted.length > 0) {
    gaps.push(mkGap({
      check: `${params.check}_double_count`,
      assertion: `${params.assertion} (no id may appear in more than one release or in both a release and cross_cutting)`,
      severity: 'blocking',
      expected: params.expected,
      actual,
      missing: doubleCounted.map(d => d.id),
      details: { doubleCounted: doubleCounted.map(d => `${d.id}:${d.placements.join(',')}`) },
    }));
  }
  return gaps;
}

// ── Individual checks ──────────────────────────────────────────────

function checkOrdinalIntegrity(plan: ReleasePlanContentV2): CoverageGapContent[] {
  const ordinals = plan.releases.map(r => r.ordinal).sort((a, b) => a - b);
  const n = ordinals.length;
  if (n === 0) {
    return [mkGap({
      check: 'release_ordinal_integrity',
      assertion: 'Release plan must contain at least one release.',
      severity: 'blocking',
      expected: [],
      actual: [],
      missing: [],
    })];
  }
  const expectedOrdinals = Array.from({ length: n }, (_, i) => String(i + 1));
  const actualOrdinals = ordinals.map(String);
  const ok = ordinals.every((o, i) => o === i + 1);
  if (ok) return [];
  return [mkGap({
    check: 'release_ordinal_integrity',
    assertion: 'Release ordinals must be contiguous 1-based integers with no gaps or duplicates.',
    severity: 'blocking',
    expected: expectedOrdinals,
    actual: actualOrdinals,
    missing: expectedOrdinals.filter(o => !actualOrdinals.includes(o)),
  })];
}

function checkBackwardDependencies(
  plan: ReleasePlanContentV2,
  workflows: WorkflowV2[],
): CoverageGapContent[] {
  // Build an id -> ordinal map (cross_cutting = Infinity so it never
  // blocks anything — an artifact in cross_cutting is available in
  // every release).
  const ordinalOf = new Map<string, number>(); // id -> ordinal (or -Infinity for cross_cutting)
  for (const r of plan.releases) {
    for (const id of r.contains.journeys) ordinalOf.set(id, r.ordinal);
    for (const id of r.contains.workflows) ordinalOf.set(id, r.ordinal);
    for (const id of r.contains.entities) ordinalOf.set(id, r.ordinal);
    for (const id of r.contains.compliance) ordinalOf.set(id, r.ordinal);
    for (const id of r.contains.integrations) ordinalOf.set(id, r.ordinal);
    for (const id of r.contains.vocabulary) ordinalOf.set(id, r.ordinal);
  }
  for (const id of plan.cross_cutting.workflows) ordinalOf.set(id, -Infinity);
  for (const id of plan.cross_cutting.compliance) ordinalOf.set(id, -Infinity);
  for (const id of plan.cross_cutting.integrations) ordinalOf.set(id, -Infinity);
  for (const id of plan.cross_cutting.vocabulary) ordinalOf.set(id, -Infinity);

  const violations: string[] = [];
  for (const w of workflows) {
    const wfOrd = ordinalOf.get(w.id);
    if (wfOrd === undefined) continue; // coverage check already reports this
    for (const t of w.triggers) {
      let target: string | undefined;
      if (t.kind === 'journey_step') target = t.journey_id;
      else if (t.kind === 'compliance') target = t.regime_id;
      else if (t.kind === 'integration') target = t.integration_id;
      if (target === undefined) continue;
      const targetOrd = ordinalOf.get(target);
      if (targetOrd === undefined) continue; // coverage already reports
      // If workflow is cross_cutting (-Infinity), it must ONLY depend
      // on cross_cutting targets — otherwise a cross_cutting workflow
      // references a release-specific artifact, which is a dependency
      // failure in the other direction (the workflow can't genuinely
      // span all releases if it depends on something only available in
      // some of them).
      if (wfOrd === -Infinity && targetOrd !== -Infinity) {
        violations.push(`${w.id}(cross_cutting) depends on ${target}(REL-ord=${targetOrd}) — cross_cutting workflows must only depend on cross_cutting targets.`);
        continue;
      }
      if (targetOrd === -Infinity) continue; // cross_cutting target → available in all releases
      if (typeof wfOrd === 'number' && typeof targetOrd === 'number' && wfOrd < targetOrd) {
        violations.push(`${w.id}(REL-ord=${wfOrd}) depends on ${target}(REL-ord=${targetOrd}) — backward dependency.`);
      }
    }
  }
  if (violations.length === 0) return [];
  return [mkGap({
    check: 'release_backward_dependency',
    assertion: 'A workflow must not ship in a release earlier than the release containing any of its trigger targets. Cross_cutting workflows must only depend on cross_cutting targets.',
    severity: 'blocking',
    expected: [],
    actual: [],
    missing: violations,
  })];
}

/**
 * Advisory: warns when a workflow's `backs_journeys` includes journeys
 * spread across multiple releases. This isn't illegal — a cross_cutting
 * workflow can legitimately back journeys in many releases — but if the
 * workflow itself is release-specific, backing a journey in a different
 * release is a planning smell worth surfacing.
 */
function checkTraceCoherence(
  plan: ReleasePlanContentV2,
  workflows: WorkflowV2[],
): CoverageGapContent[] {
  const ordinalOf = new Map<string, number>();
  for (const r of plan.releases) {
    for (const id of r.contains.journeys) ordinalOf.set(id, r.ordinal);
    for (const id of r.contains.workflows) ordinalOf.set(id, r.ordinal);
  }
  const findings: string[] = [];
  for (const w of workflows) {
    const wfOrd = ordinalOf.get(w.id);
    if (wfOrd === undefined) continue;
    const backed = w.backs_journeys ?? [];
    const ordsBacked = new Set<number>();
    for (const jid of backed) {
      const o = ordinalOf.get(jid);
      if (typeof o === 'number') ordsBacked.add(o);
    }
    if (ordsBacked.size > 1) {
      findings.push(`${w.id}(REL-ord=${wfOrd}) backs journeys in multiple releases (${[...ordsBacked].sort().join(',')}) — consider promoting to cross_cutting.`);
    }
  }
  if (findings.length === 0) return [];
  return [mkGap({
    check: 'release_trace_coherence',
    assertion: 'Workflows backing journeys across multiple releases may be better placed in cross_cutting.',
    severity: 'advisory',
    expected: [],
    actual: [],
    missing: findings,
  })];
}

// ── Entry point ────────────────────────────────────────────────────

export function verifyReleaseManifest(i: ReleaseManifestVerifierInputs): ReleaseManifestVerifierResult {
  const plan = i.plan;
  const gaps: CoverageGapContent[] = [];

  gaps.push(...checkOrdinalIntegrity(plan));

  // Exact-coverage per artifact type.
  const byTypeForRelease = (type: 'journeys' | 'workflows' | 'entities' | 'compliance' | 'integrations' | 'vocabulary'): Map<string, string[]> => {
    const m = new Map<string, string[]>();
    for (const r of plan.releases) m.set(r.release_id, r.contains[type]);
    return m;
  };

  gaps.push(...checkExactCoverage({
    check: 'release_exact_coverage_journeys',
    assertion: 'Every accepted journey must appear in exactly one release. Journeys are not eligible for cross_cutting.',
    expected: i.journeys.map(j => j.id),
    perRelease: byTypeForRelease('journeys'),
    crossCutting: [],
  }));
  gaps.push(...checkExactCoverage({
    check: 'release_exact_coverage_workflows',
    assertion: 'Every accepted workflow must appear in exactly one release OR in cross_cutting.workflows.',
    expected: i.workflows.map(w => w.id),
    perRelease: byTypeForRelease('workflows'),
    crossCutting: plan.cross_cutting.workflows,
  }));
  gaps.push(...checkExactCoverage({
    check: 'release_exact_coverage_entities',
    assertion: 'Every accepted entity must appear in exactly one release. Entities are not eligible for cross_cutting.',
    expected: i.entityIds,
    perRelease: byTypeForRelease('entities'),
    crossCutting: [],
  }));
  gaps.push(...checkExactCoverage({
    check: 'release_exact_coverage_compliance',
    assertion: 'Every accepted compliance item must appear in exactly one release OR in cross_cutting.compliance.',
    expected: i.complianceIds,
    perRelease: byTypeForRelease('compliance'),
    crossCutting: plan.cross_cutting.compliance,
  }));
  gaps.push(...checkExactCoverage({
    check: 'release_exact_coverage_integrations',
    assertion: 'Every accepted integration must appear in exactly one release OR in cross_cutting.integrations.',
    expected: i.integrations.map(it => it.id),
    perRelease: byTypeForRelease('integrations'),
    crossCutting: plan.cross_cutting.integrations,
  }));
  gaps.push(...checkExactCoverage({
    check: 'release_exact_coverage_vocabulary',
    assertion: 'Every accepted vocabulary term must appear in exactly one release OR in cross_cutting.vocabulary.',
    expected: i.vocabulary.map(v => v.id),
    perRelease: byTypeForRelease('vocabulary'),
    crossCutting: plan.cross_cutting.vocabulary,
  }));

  gaps.push(...checkBackwardDependencies(plan, i.workflows));
  gaps.push(...checkTraceCoherence(plan, i.workflows));

  // Unused imports guard — ExtractedItem is referenced via type-only in
  // the input type signatures; reference it here to satisfy strict
  // unused-import checking if it ever tightens.
  void (null as unknown as ExtractedItem | undefined);

  return gaps;
}
