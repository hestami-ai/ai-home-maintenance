/**
 * Phase 2 Sub-Phase 2.2c — Deterministic NFR coverage verifier (Wave 8, Pass 3 of 3).
 *
 * Runs after 2.2 skeleton bloom (Pass 1) and 2.2b threshold enrichment
 * (Pass 2). Confirms:
 *   - Every V&V requirement from Phase 1.0e is traced by ≥1 NFR, OR
 *     declared in `unreached_seeds[]` with an `absorbed_into` NFR id.
 *   - Every accepted compliance-extracted item is traced by ≥1 NFR OR
 *     declared in `unreached_seeds[]`.
 *   - Every `traces_to` id resolves to an accepted upstream artifact
 *     (VV-* / QA-# / TECH-* / COMP-* / UJ-*). FR-id leakage
 *     (`US-*` in traces_to) is flagged.
 *   - Every `applies_to_requirements` id resolves to an accepted FR id.
 *   - Every NFR has a non-empty `threshold` and `measurement_method`.
 *   - NFR ids are unique.
 *   - `unreached_seeds[]` integrity: seed id is real, absorbed_into is a
 *     real NFR id.
 */

import type {
  CoverageGapContent,
  ExtractedItem,
  TechnicalConstraint,
  UserJourney,
  VVRequirement,
} from '../../../types/records';

export interface NfrSkeleton {
  id: string;
  category: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  traces_to?: string[];
  applies_to_requirements?: string[];
  threshold?: string;
  measurement_method?: string;
}

export interface UnreachedSeedDeclaration {
  seed_id: string;
  absorbed_into: string;
  reason?: string;
}

export interface NfrCoverageVerifierInputs {
  vvRequirements: VVRequirement[];
  qualityAttributesCount: number;
  technicalConstraints: TechnicalConstraint[];
  complianceItems: ExtractedItem[];
  journeys: UserJourney[];
  /** Accepted FR ids from Sub-Phase 2.1 (for applies_to_requirements validation). */
  acceptedFrIds: string[];
  /** NFRs produced by Pass 1 + Pass 2 (enriched). */
  nfrs: NfrSkeleton[];
  unreachedSeeds?: UnreachedSeedDeclaration[];
}

export type NfrCoverageVerifierResult = CoverageGapContent[];

const SUB_PHASE = 'nfr_bloom_verifier' as const;

function uniqSorted(xs: string[]): string[] {
  return Array.from(new Set(xs)).sort((a, b) => a.localeCompare(b));
}

function mkGap(params: {
  check: string;
  assertion: string;
  severity: 'blocking' | 'advisory';
  expected: string[];
  actual: string[];
  missing: string[];
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
    resolution: 'pending',
  };
}

/** Every V&V requirement must be traced OR absorbed. */
function checkVVCoverage(i: NfrCoverageVerifierInputs): CoverageGapContent[] {
  const expected = i.vvRequirements.map(v => v.id);
  const traced = new Set<string>();
  for (const n of i.nfrs) {
    for (const t of n.traces_to ?? []) if (t.startsWith('VV-')) traced.add(t);
  }
  const absorbed = new Set((i.unreachedSeeds ?? []).map(u => u.seed_id));
  const missing: string[] = [];
  const actual: string[] = [];
  for (const id of expected) {
    if (traced.has(id) || absorbed.has(id)) actual.push(id);
    else missing.push(id);
  }
  if (missing.length === 0) return [];
  return [mkGap({
    check: 'vv_nfr_coverage',
    assertion: 'Every V&V requirement must be traced by at least one NFR, or absorbed into another NFR via unreached_seeds[]. A silently-dropped V&V requirement is a blocking gap.',
    severity: 'blocking',
    expected,
    actual,
    missing,
  })];
}

/** Every compliance-extracted item must be traced OR absorbed. */
function checkComplianceCoverage(i: NfrCoverageVerifierInputs): CoverageGapContent[] {
  const expected = i.complianceItems.map(c => c.id);
  const traced = new Set<string>();
  for (const n of i.nfrs) {
    for (const t of n.traces_to ?? []) if (t.startsWith('COMP-')) traced.add(t);
  }
  const absorbed = new Set((i.unreachedSeeds ?? []).map(u => u.seed_id));
  const missing: string[] = [];
  const actual: string[] = [];
  for (const id of expected) {
    if (traced.has(id) || absorbed.has(id)) actual.push(id);
    else missing.push(id);
  }
  if (missing.length === 0) return [];
  return [mkGap({
    check: 'compliance_nfr_coverage',
    assertion: 'Every accepted compliance-extracted item must be traced by at least one NFR, or absorbed via unreached_seeds[]. A silently-dropped compliance item is a blocking gap.',
    severity: 'blocking',
    expected,
    actual,
    missing,
  })];
}

/** `unreached_seeds[]` must name real seeds and real absorbing NFRs.
 *  Exception: the SYSTEM_INFERRED__AGENT_OMISSION sentinel is allowed
 *  in `absorbed_into` — that's the auto-flagger marking a seed the
 *  agent dropped entirely (see autoFlagDroppedSeeds.ts). It surfaces
 *  the gap for human review without blocking the run. */
function checkUnreachedSeedIntegrity(i: NfrCoverageVerifierInputs): CoverageGapContent[] {
  const SYSTEM_INFERRED_SENTINEL = 'SYSTEM_INFERRED__AGENT_OMISSION';
  const vvIds = new Set(i.vvRequirements.map(v => v.id));
  const compIds = new Set(i.complianceItems.map(c => c.id));
  const nfrIds = new Set(i.nfrs.map(n => n.id));
  const offenders: string[] = [];
  for (const u of i.unreachedSeeds ?? []) {
    const isValidSeed =
      vvIds.has(u.seed_id) || compIds.has(u.seed_id) ||
      u.seed_id.startsWith('QA-') || u.seed_id.startsWith('TECH-') || u.seed_id.startsWith('UJ-');
    if (!isValidSeed) offenders.push(`${u.seed_id}:seed-not-accepted`);
    const isValidAbsorber = u.absorbed_into === SYSTEM_INFERRED_SENTINEL || nfrIds.has(u.absorbed_into);
    if (!isValidAbsorber) offenders.push(`${u.seed_id}:absorbed_into-${u.absorbed_into}-not-accepted`);
  }
  if (offenders.length === 0) return [];
  return [mkGap({
    check: 'unreached_seeds_integrity',
    assertion: 'unreached_seeds[] entries must reference accepted seeds (VV-/COMP-/QA-/TECH-/UJ-) and absorbing NFR ids that exist in the NFR set.',
    severity: 'blocking',
    expected: [],
    actual: [],
    missing: offenders,
  })];
}

interface TraceRefIdSets {
  vvIds: Set<string>;
  techIds: Set<string>;
  compIds: Set<string>;
  journeyIds: Set<string>;
  qaMax: number;
}

type TraceRefVerdict = 'ok' | 'fr_leakage' | 'dangling' | 'unknown_prefix';

interface TraceRefBuckets {
  badUnknownPrefix: string[];
  badDangling: string[];
  frLeakage: string[];
}

/** `ok` when the id is a member of its accepted set, else `dangling`. */
function verdictFromSet(t: string, set: Set<string>): TraceRefVerdict {
  return set.has(t) ? 'ok' : 'dangling';
}

/** `ok` when `QA-<n>` names a 1-based index within the quality-attribute count. */
function verdictFromQaIndex(t: string, qaMax: number): TraceRefVerdict {
  const idx = Number(t.slice(3));
  const valid = Number.isInteger(idx) && idx >= 1 && idx <= qaMax;
  return valid ? 'ok' : 'dangling';
}

/** Classify a single `traces_to` id against the accepted upstream id sets. */
function classifyTraceRef(t: string, sets: TraceRefIdSets): TraceRefVerdict {
  if (t.startsWith('US-')) return 'fr_leakage';
  if (t.startsWith('VV-')) return verdictFromSet(t, sets.vvIds);
  if (t.startsWith('TECH-')) return verdictFromSet(t, sets.techIds);
  if (t.startsWith('COMP-')) return verdictFromSet(t, sets.compIds);
  if (t.startsWith('UJ-')) return verdictFromSet(t, sets.journeyIds);
  if (t.startsWith('QA-')) return verdictFromQaIndex(t, sets.qaMax);
  return 'unknown_prefix';
}

/** Assemble the traces_to gap records from the accumulated offender buckets. */
function buildTracesGaps(buckets: TraceRefBuckets): CoverageGapContent[] {
  const gaps: CoverageGapContent[] = [];
  if (buckets.badUnknownPrefix.length > 0) {
    gaps.push(mkGap({
      check: 'nfr_traces_to_unknown_prefix',
      assertion: 'Every NFR traces_to entry must use a known id prefix (VV-/QA-/TECH-/COMP-/UJ-).',
      severity: 'blocking',
      expected: [], actual: [], missing: buckets.badUnknownPrefix,
    }));
  }
  if (buckets.badDangling.length > 0) {
    gaps.push(mkGap({
      check: 'nfr_traces_to_dangling',
      assertion: 'Every NFR traces_to entry must reference an accepted upstream artifact.',
      severity: 'blocking',
      expected: [], actual: [], missing: buckets.badDangling,
    }));
  }
  if (buckets.frLeakage.length > 0) {
    gaps.push(mkGap({
      check: 'nfr_traces_to_fr_leakage',
      assertion: 'NFR traces_to must reference handoff items, not FR ids. FR linkage belongs in applies_to_requirements.',
      severity: 'blocking',
      expected: [], actual: [], missing: buckets.frLeakage,
    }));
  }
  return gaps;
}

/** Every `traces_to` id must resolve; FR-id leakage is flagged. */
function checkTracesReferentialIntegrity(i: NfrCoverageVerifierInputs): CoverageGapContent[] {
  const sets: TraceRefIdSets = {
    vvIds: new Set(i.vvRequirements.map(v => v.id)),
    techIds: new Set(i.technicalConstraints.map(t => t.id)),
    compIds: new Set(i.complianceItems.map(c => c.id)),
    journeyIds: new Set(i.journeys.map(j => j.id)),
    qaMax: i.qualityAttributesCount,
  };

  const buckets: TraceRefBuckets = { badUnknownPrefix: [], badDangling: [], frLeakage: [] };
  for (const n of i.nfrs) {
    for (const t of n.traces_to ?? []) {
      const verdict = classifyTraceRef(t, sets);
      if (verdict === 'fr_leakage') buckets.frLeakage.push(`${n.id}:${t}`);
      else if (verdict === 'dangling') buckets.badDangling.push(`${n.id}:${t}`);
      else if (verdict === 'unknown_prefix') buckets.badUnknownPrefix.push(`${n.id}:${t}`);
    }
  }
  return buildTracesGaps(buckets);
}

/** `applies_to_requirements` must reference accepted FR ids. */
function checkAppliesToRequirements(i: NfrCoverageVerifierInputs): CoverageGapContent[] {
  const frIds = new Set(i.acceptedFrIds);
  const offenders: string[] = [];
  for (const n of i.nfrs) {
    for (const fid of n.applies_to_requirements ?? []) {
      if (!frIds.has(fid)) offenders.push(`${n.id}:${fid}`);
    }
  }
  if (offenders.length === 0) return [];
  return [mkGap({
    check: 'nfr_applies_to_requirements_dangling',
    assertion: 'Every NFR.applies_to_requirements entry must reference an accepted FR id.',
    severity: 'blocking',
    expected: [], actual: [], missing: offenders,
  })];
}

/** Every NFR must carry a non-empty threshold AND measurement_method. */
function checkThresholdPresence(i: NfrCoverageVerifierInputs): CoverageGapContent[] {
  const missing: string[] = [];
  for (const n of i.nfrs) {
    if (!n.threshold || n.threshold.trim().length === 0) missing.push(`${n.id}:no-threshold`);
    if (!n.measurement_method || n.measurement_method.trim().length === 0) missing.push(`${n.id}:no-measurement-method`);
  }
  if (missing.length === 0) return [];
  return [mkGap({
    check: 'nfr_threshold_presence',
    assertion: 'Every NFR must carry a non-empty threshold AND measurement_method.',
    severity: 'blocking',
    expected: [], actual: [], missing,
  })];
}

/** NFR ids must be unique. */
function checkIdUniqueness(i: NfrCoverageVerifierInputs): CoverageGapContent[] {
  const seen = new Map<string, number>();
  for (const n of i.nfrs) seen.set(n.id, (seen.get(n.id) ?? 0) + 1);
  const dupes: string[] = [];
  for (const [id, n] of seen) if (n > 1) dupes.push(`${id}:x${n}`);
  if (dupes.length === 0) return [];
  return [mkGap({
    check: 'nfr_id_uniqueness',
    assertion: 'NFR ids must be unique.',
    severity: 'blocking',
    expected: [], actual: [], missing: dupes,
  })];
}

/** Advisory: traces_to must be non-empty. */
function checkTracesNonEmpty(i: NfrCoverageVerifierInputs): CoverageGapContent[] {
  const missing = i.nfrs.filter(n => !n.traces_to || n.traces_to.length === 0).map(n => n.id);
  if (missing.length === 0) return [];
  return [mkGap({
    check: 'nfr_traces_to_non_empty',
    assertion: 'Every NFR is expected to carry at least one traces_to reference. Advisory — an uncited NFR usually indicates an LLM miss.',
    severity: 'advisory',
    expected: i.nfrs.map(n => n.id),
    actual: i.nfrs.filter(n => (n.traces_to?.length ?? 0) > 0).map(n => n.id),
    missing,
  })];
}

/** Run all 2.2c predicates. */
export function verifyNfrCoverage(i: NfrCoverageVerifierInputs): NfrCoverageVerifierResult {
  return [
    ...checkIdUniqueness(i),
    ...checkThresholdPresence(i),
    ...checkVVCoverage(i),
    ...checkComplianceCoverage(i),
    ...checkUnreachedSeedIntegrity(i),
    ...checkTracesReferentialIntegrity(i),
    ...checkAppliesToRequirements(i),
    ...checkTracesNonEmpty(i),
  ];
}
