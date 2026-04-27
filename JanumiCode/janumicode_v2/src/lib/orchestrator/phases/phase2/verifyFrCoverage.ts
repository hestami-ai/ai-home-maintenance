/**
 * Phase 2 Sub-Phase 2.1c — Deterministic FR coverage verifier (Wave 8, Pass 3 of 3).
 *
 * Runs after 2.1 skeleton bloom (Pass 1) and 2.1b AC enrichment (Pass 2)
 * have produced the full FR list. Confirms:
 *   - Every accepted journey from Phase 1.3a is traced by ≥1 FR, OR the
 *     bloom explicitly listed it in `unreached_journeys[]` with a reason.
 *   - Every `traces_to` id resolves to an accepted upstream artifact
 *     (UJ-* / ENT-* / WF-* / COMP-* / VOC-* / OPEN-* / Q-*).
 *   - Every FR has ≥1 acceptance criterion with a non-empty
 *     `measurable_condition`.
 *   - FR ids are unique within `user_stories[]`.
 *
 * Same design principles as 1.3c:
 *   - Pure function; caller persists returned gaps.
 *   - Exhaustive — all predicates run; gaps returned together.
 *   - Deterministic — sorted arrays, stable iteration.
 *   - Severity-tagged — `blocking` pauses phase; `advisory` logs only.
 */

import type {
  CoverageGapContent,
  Entity,
  ExtractedItem,
  UserJourney,
  VocabularyTerm,
  WorkflowV2,
} from '../../../types/records';

export interface UserStorySkeleton {
  id: string;
  role: string;
  action: string;
  outcome: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  traces_to?: string[];
  acceptance_criteria: Array<{
    id: string;
    description: string;
    measurable_condition: string;
  }>;
}

export interface UnreachedJourneyDeclaration {
  journey_id: string;
  reason: string;
}

export interface FrCoverageVerifierInputs {
  /** Accepted journeys from Sub-Phase 1.3a. */
  journeys: UserJourney[];
  /** Accepted entities from Sub-Phase 1.2b. */
  entities: Entity[];
  /** Accepted workflows from Sub-Phase 1.3b. */
  workflows: WorkflowV2[];
  /** Accepted compliance items from 1.0d. */
  complianceItems: ExtractedItem[];
  /** Canonical vocabulary from 1.0f. */
  vocabulary: VocabularyTerm[];
  /** Open-question ids resolvable by FRs (from 1.0-era question register). */
  openQuestionIds: string[];
  /** FRs produced by Pass 1 + Pass 2 (enriched). */
  userStories: UserStorySkeleton[];
  /**
   * Journeys the bloom explicitly reported as unreached. Verifier
   * treats these as acknowledged — they do not contribute to
   * `missing`.
   */
  unreachedJourneys?: UnreachedJourneyDeclaration[];
}

export type FrCoverageVerifierResult = CoverageGapContent[];

const SUB_PHASE: '2.1c' = '2.1c';

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
 * Every accepted journey must be traced by ≥1 FR OR appear in
 * `unreached_journeys[]`. Silent drops (journey neither traced nor
 * declared) are a blocking gap — this is the spine guarantee of 2.1.
 */
function checkJourneyCoverage(i: FrCoverageVerifierInputs): CoverageGapContent[] {
  const expected = i.journeys.map(j => j.id);
  const tracedJourneys = new Set<string>();
  for (const s of i.userStories) {
    for (const t of s.traces_to ?? []) {
      if (t.startsWith('UJ-')) tracedJourneys.add(t);
    }
  }
  const declaredUnreached = new Set((i.unreachedJourneys ?? []).map(u => u.journey_id));
  const actual: string[] = [];
  const missing: string[] = [];
  for (const id of expected) {
    if (tracedJourneys.has(id) || declaredUnreached.has(id)) {
      actual.push(id);
    } else {
      missing.push(id);
    }
  }
  if (missing.length === 0) return [];
  return [mkGap({
    check: 'journey_fr_coverage',
    assertion: 'Every accepted user journey must be traced by at least one FR, or be explicitly declared in unreached_journeys[] with a reason. A silently-dropped journey is a blocking gap.',
    severity: 'blocking',
    expected,
    actual,
    missing,
  })];
}

/**
 * `unreached_journeys[]` declarations must name real accepted journeys,
 * and each must carry a non-empty reason.
 */
function checkUnreachedJourneyIntegrity(i: FrCoverageVerifierInputs): CoverageGapContent[] {
  const journeyIds = new Set(i.journeys.map(j => j.id));
  const offenders: string[] = [];
  for (const u of i.unreachedJourneys ?? []) {
    if (!journeyIds.has(u.journey_id)) offenders.push(`${u.journey_id}:not-accepted`);
    if (!u.reason || u.reason.trim().length === 0) offenders.push(`${u.journey_id}:empty-reason`);
  }
  if (offenders.length === 0) return [];
  return [mkGap({
    check: 'unreached_journeys_integrity',
    assertion: 'unreached_journeys[] entries must reference accepted journeys and carry a non-empty reason.',
    severity: 'blocking',
    expected: [],
    actual: [],
    missing: offenders,
  })];
}

/**
 * Every `traces_to` id must resolve to an accepted upstream artifact.
 * Unknown prefixes and dangling refs are blocking.
 */
function checkTracesReferentialIntegrity(i: FrCoverageVerifierInputs): CoverageGapContent[] {
  const journeyIds = new Set(i.journeys.map(j => j.id));
  const entityIds = new Set(i.entities.map(e => e.id));
  const workflowIds = new Set(i.workflows.map(w => w.id));
  const complianceIds = new Set(i.complianceItems.map(c => c.id));
  const vocabIds = new Set(i.vocabulary.map(v => v.id));
  const openQIds = new Set(i.openQuestionIds);

  const badUnknownPrefix: string[] = [];
  const badDangling: string[] = [];
  for (const s of i.userStories) {
    for (const t of s.traces_to ?? []) {
      if (t.startsWith('UJ-')) { if (!journeyIds.has(t)) badDangling.push(`${s.id}:${t}`); continue; }
      if (t.startsWith('ENT-')) { if (!entityIds.has(t)) badDangling.push(`${s.id}:${t}`); continue; }
      if (t.startsWith('WF-')) { if (!workflowIds.has(t)) badDangling.push(`${s.id}:${t}`); continue; }
      if (t.startsWith('COMP-')) { if (!complianceIds.has(t)) badDangling.push(`${s.id}:${t}`); continue; }
      if (t.startsWith('VOC-')) { if (!vocabIds.has(t)) badDangling.push(`${s.id}:${t}`); continue; }
      if (t.startsWith('OPEN-') || t.startsWith('Q-')) { if (!openQIds.has(t)) badDangling.push(`${s.id}:${t}`); continue; }
      badUnknownPrefix.push(`${s.id}:${t}`);
    }
  }
  const gaps: CoverageGapContent[] = [];
  if (badUnknownPrefix.length > 0) {
    gaps.push(mkGap({
      check: 'traces_to_unknown_prefix',
      assertion: 'Every FR traces_to entry must use a known id prefix (UJ-/ENT-/WF-/COMP-/VOC-/OPEN-/Q-).',
      severity: 'blocking',
      expected: [],
      actual: [],
      missing: badUnknownPrefix,
    }));
  }
  if (badDangling.length > 0) {
    gaps.push(mkGap({
      check: 'traces_to_dangling',
      assertion: 'Every FR traces_to entry must reference an accepted upstream artifact.',
      severity: 'blocking',
      expected: [],
      actual: [],
      missing: badDangling,
    }));
  }
  return gaps;
}

/** Every FR has ≥1 AC with a non-empty measurable_condition. */
function checkAcPresence(i: FrCoverageVerifierInputs): CoverageGapContent[] {
  const missing: string[] = [];
  for (const s of i.userStories) {
    const acs = s.acceptance_criteria ?? [];
    if (acs.length === 0) { missing.push(`${s.id}:no-acs`); continue; }
    const hasMeasurable = acs.some(ac => ac.measurable_condition && ac.measurable_condition.trim().length > 0);
    if (!hasMeasurable) missing.push(`${s.id}:no-measurable-condition`);
  }
  if (missing.length === 0) return [];
  return [mkGap({
    check: 'ac_presence',
    assertion: 'Every FR must carry at least one acceptance criterion with a non-empty measurable_condition.',
    severity: 'blocking',
    expected: [],
    actual: [],
    missing,
  })];
}

/** FR ids are unique. */
function checkIdUniqueness(i: FrCoverageVerifierInputs): CoverageGapContent[] {
  const seen = new Map<string, number>();
  for (const s of i.userStories) seen.set(s.id, (seen.get(s.id) ?? 0) + 1);
  const dupes: string[] = [];
  for (const [id, n] of seen) if (n > 1) dupes.push(`${id}:x${n}`);
  if (dupes.length === 0) return [];
  return [mkGap({
    check: 'fr_id_uniqueness',
    assertion: 'FR ids must be unique within user_stories[].',
    severity: 'blocking',
    expected: [],
    actual: [],
    missing: dupes,
  })];
}

/**
 * Advisory: every `traces_to` must be non-empty. A spineless FR
 * (no handoff traceability) is legal but usually indicates the LLM
 * failed to cite its upstream source.
 */
function checkTracesNonEmpty(i: FrCoverageVerifierInputs): CoverageGapContent[] {
  const missing = i.userStories.filter(s => !s.traces_to || s.traces_to.length === 0).map(s => s.id);
  if (missing.length === 0) return [];
  return [mkGap({
    check: 'traces_to_non_empty',
    assertion: 'Every FR is expected to carry at least one traces_to reference. Advisory — an uncited FR may be legitimately scope-only but usually indicates an LLM miss.',
    severity: 'advisory',
    expected: i.userStories.map(s => s.id),
    actual: i.userStories.filter(s => (s.traces_to?.length ?? 0) > 0).map(s => s.id),
    missing,
  })];
}

/** Run all 2.1c predicates. Returns a (possibly empty) gap list. */
export function verifyFrCoverage(i: FrCoverageVerifierInputs): FrCoverageVerifierResult {
  return [
    ...checkIdUniqueness(i),
    ...checkAcPresence(i),
    ...checkJourneyCoverage(i),
    ...checkUnreachedJourneyIntegrity(i),
    ...checkTracesReferentialIntegrity(i),
    ...checkTracesNonEmpty(i),
  ];
}
