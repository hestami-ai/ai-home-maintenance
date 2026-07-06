/**
 * Finding surfacing — selects the *unadjudicated, substantive, requirement-
 * anchored* validator findings worth showing to a downstream role, and scopes
 * them to a task's logical id-set.
 *
 * Two consumers share this module:
 *   - Phase 9 executor (per-task, "anticipate/resolve while building")
 *   - Phase 10.1 consistency/adjudication agent (run-wide, "verify + adjudicate")
 *
 * Why this exists: reasoning_review_finding records are written once, immutably,
 * with NO adjudication field, and ~61% are auto-fix noise (json discipline,
 * id-traceability normalization, schema-retry, final_synthesis rollups) that the
 * system already resolved internally. The selection here drops that noise plus
 * findings the MitigationEngine already acted on (auto_mitigation_action) and
 * findings whose reviewed output was superseded by a revision — leaving the
 * substantive concerns about artifacts that survived into the implementation.
 *
 * Scoping bridges root→leaf id drift structurally (via the composite-AC parser),
 * never by fuzzy regex id resolution (see feedback_no_regex_id_resolution).
 */
import type { GovernedStreamWriter } from '../orchestrator/governedStreamWriter';
import type {
  ReasoningReviewFindingRecordContent,
  ReasoningReviewHarnessRecordContent,
  AutoMitigationActionContent,
} from '../types/records';
import { parentRefFromCompositeAc } from '../orchestrator/phases/phase2/acIdNormalizer';

/**
 * Validators whose findings are auto-resolved internally and immediately, or
 * are not artifact-content concerns. Excluded from surfacing.
 *   - json_output_discipline_check → json_repair recovers the output
 *   - extraction_id_traceability   → deterministic id-format normalization
 *   - contract_schema_validator    → schema enforcement, fixed on retry
 *   - final_synthesis              → the harness rollup verdict, not a finding
 */
export const AUTO_FIX_VALIDATORS: ReadonlySet<string> = new Set([
  'json_output_discipline_check',
  'extraction_id_traceability',
  'contract_schema_validator',
  'final_synthesis',
]);

/**
 * Reasoning-PROCESS validators — they critique upstream agent cognition
 * (dropped commitments, unjustified leaps in thinking-chains), not the code a
 * Phase-9 task implements. Not executor-actionable; excluded from the executor
 * path. (The 10.1 adjudicator may still consider them run-wide if desired.)
 */
export const REASONING_PROCESS_VALIDATORS: ReadonlySet<string> = new Set([
  'reasoning_quality_validator',
  'reasoning_to_response_faithfulness',
  'bloom_completeness_vs_thinking',
]);

/** Coherence codes the executor can act on, with a canned remedy. */
export const COHERENCE_ACTIONABLE: ReadonlyMap<string, string> = new Map([
  ['P8_CC_NO_TEST', 'Author a covering test for this completion criterion.'],
  ['A3_UNMEASURABLE_EVAL_CRITERION', 'Implement to the spec text; do not invent a numeric threshold.'],
  ['P3_AC_NO_TEST', 'This acceptance criterion has no upstream test — author one as you implement it.'],
  ['P7_INVENTED_ID_REFERENCE', 'This id is not grounded upstream — do not treat it as authoritative; honor the spec text.'],
  ['A1_TASK_OUTSIDE_COMPONENT_BOUNDARY', 'Keep changes within this component\'s write scope.'],
  ['A2_DUPLICATE_TEST_CASE', 'Avoid duplicating this test; reuse the existing one.'],
]);

/** Coherence codes that are upstream gaps the executor cannot directly fix (FYI). */
export const COHERENCE_FYI_PREFIXES: readonly string[] = [
  'P4_USER_STORY_NO_EVAL', 'P5_NFR_NO_EVAL', 'P1_NO_USER_STORY',
  'P2_USER_STORY_NO_AC', 'P6_COMPONENT_CONTRACT_MISSING',
  'C1_', 'C2_', 'C3_', 'C4_',
];

export type FindingSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SurfacedFinding {
  recordId: string;
  validatorId: string;
  severity: FindingSeverity;
  findingType: string;
  summary: string;
  location: string;
  recommendation: string;
  /** Logical ids parsed from target_identifier + location (AC/US/NFR/component). */
  citedIds: string[];
}

/** Token shapes for upstream logical ids that can appear in a finding. */
const ID_TOKEN = /\b(?:AC|US|NFR|COMP|comp)-[A-Za-z0-9_.-]+/g;

/**
 * Extract logical id tokens from a finding's target_identifier + location.
 * This is id EXTRACTION from free text (not leaf→root reduction); the reduction
 * step below is structural via parentRefFromCompositeAc.
 */
export function extractCitedIds(content: ReasoningReviewFindingRecordContent): string[] {
  const out = new Set<string>();
  const ti = content.target_identifier;
  if (typeof ti === 'string' && /^(AC|US|NFR|COMP|comp)-/.test(ti)) out.add(ti);
  for (const src of [content.location, content.summary]) {
    if (typeof src !== 'string') continue;
    for (const m of src.matchAll(ID_TOKEN)) out.add(m[0]);
  }
  return [...out];
}

/**
 * Reduce a US/AC id to a story-level base key for root↔leaf comparison.
 * AC ids reduce to their parent story (structural, via the composite parser);
 * US leaf markers (US-001-D) reduce to the root (US-001). NFR/COMP pass through.
 */
export function baseScopeKey(id: string): string {
  const parent = parentRefFromCompositeAc(id); // AC-* → US-* (root or leaf)
  let key = parent ?? id;
  // Strip a trailing saturation-leaf marker so root US-001 ≡ leaf US-001-D.
  key = key.replace(/-[A-Z]\d*$/i, '');
  return key;
}

/**
 * The logical id-set a task is scoped to, drawn from its packet.
 */
export interface TaskScope {
  userStoryIds: string[];
  acceptanceCriterionIds: string[];
  nfrIds: string[];
  componentId?: string | null;
}

/** Build the comparison key-set for a task scope. */
function scopeKeys(scope: TaskScope): Set<string> {
  const keys = new Set<string>();
  for (const id of scope.userStoryIds) keys.add(baseScopeKey(id));
  for (const id of scope.acceptanceCriterionIds) keys.add(baseScopeKey(id));
  for (const id of scope.nfrIds) keys.add(id); // NFR ids are stable root→leaf
  if (scope.componentId) keys.add(scope.componentId);
  return keys;
}

/** Does a finding's cited ids intersect the task scope? */
export function findingInScope(finding: SurfacedFinding, scope: TaskScope): boolean {
  const keys = scopeKeys(scope);
  if (keys.size === 0) return false;
  for (const id of finding.citedIds) {
    if (keys.has(id)) return true;       // exact (NFR/component)
    if (keys.has(baseScopeKey(id))) return true; // story-level bridge (US/AC)
  }
  return false;
}

/**
 * Select the surfaceable reasoning-review findings for a run: substantive,
 * HIGH/MEDIUM, not auto-fix, not auto-mitigated, not superseded. `forExecutor`
 * additionally drops reasoning-PROCESS validators (executor-irrelevant).
 */
export function selectReasoningFindings(
  writer: GovernedStreamWriter,
  workflowRunId: string,
  opts: { forExecutor: boolean },
): SurfacedFinding[] {
  const findingRecords = writer.getRecordsByType(workflowRunId, 'reasoning_review_finding_record');

  // auto_mitigation_action.finding_record_id → already acted on by the engine.
  const mitigated = new Set<string>();
  for (const r of writer.getRecordsByType(workflowRunId, 'auto_mitigation_action')) {
    const c = r.content as unknown as AutoMitigationActionContent;
    if (typeof c.finding_record_id === 'string') mitigated.add(c.finding_record_id);
  }

  // harness logical id (content.harness_id) → reviewed_agent_output_id, so we can
  // check whether the reviewed artifact was later superseded.
  const reviewedOutputByHarness = new Map<string, string>();
  for (const r of writer.getRecordsByType(workflowRunId, 'reasoning_review_harness_record')) {
    const c = r.content as unknown as ReasoningReviewHarnessRecordContent;
    if (typeof c.harness_id === 'string' && typeof c.reviewed_agent_output_id === 'string') {
      reviewedOutputByHarness.set(c.harness_id, c.reviewed_agent_output_id);
    }
  }
  const isSuperseded = (harnessId: string): boolean => {
    const outId = reviewedOutputByHarness.get(harnessId);
    if (!outId) return false; // unknown → fail open (keep the finding)
    const rec = writer.getRecord(outId);
    return rec !== null && rec.is_current_version === false;
  };

  const out: SurfacedFinding[] = [];
  for (const r of findingRecords) {
    if (mitigated.has(r.id)) continue;
    const c = r.content as unknown as ReasoningReviewFindingRecordContent;
    if (c.severity !== 'HIGH' && c.severity !== 'MEDIUM') continue;
    if (AUTO_FIX_VALIDATORS.has(c.validator_id)) continue;
    if (opts.forExecutor && REASONING_PROCESS_VALIDATORS.has(c.validator_id)) continue;
    if (typeof c.harness_id === 'string' && isSuperseded(c.harness_id)) continue;
    out.push({
      recordId: r.id,
      validatorId: c.validator_id,
      severity: c.severity,
      findingType: c.finding_type,
      summary: c.summary,
      location: c.location,
      recommendation: c.recommendation,
      citedIds: extractCitedIds(c),
    });
  }
  return out;
}

/** Render one finding as a single executor-facing line (summary + recommendation). */
export function renderFindingLine(f: SurfacedFinding): string {
  const fix = f.recommendation ? ` → Fix: ${f.recommendation}` : '';
  return `- [${f.severity}] ${f.validatorId} :: ${f.findingType} — ${f.summary}${fix}`;
}

/**
 * Collapse findings that render to an IDENTICAL line (PD-8). A single upstream
 * issue is often emitted across many validator records (per-AC / per-artifact)
 * with distinct recordIds but identical rendered content, so the same line would
 * otherwise be injected many times (~16×) — noise that crowds distinct findings
 * out from under the display cap. Order-preserving; keeps the first occurrence.
 */
export function dedupSurfacedFindings(findings: SurfacedFinding[]): SurfacedFinding[] {
  const seen = new Set<string>();
  const out: SurfacedFinding[] = [];
  for (const f of findings) {
    const key = renderFindingLine(f);
    if (!seen.has(key)) { seen.add(key); out.push(f); }
  }
  return out;
}

/** Split a packet's coherence strings into the actionable vs FYI buckets. */
export function categorizeCoherence(codes: readonly string[]): {
  actionable: { code: string; line: string; remedy: string }[];
  fyi: string[];
} {
  const actionable: { code: string; line: string; remedy: string }[] = [];
  const fyi: string[] = [];
  for (const line of codes) {
    const code = line.split(':')[0]?.trim() ?? '';
    const remedy = COHERENCE_ACTIONABLE.get(code);
    if (remedy) actionable.push({ code, line, remedy });
    else if (COHERENCE_FYI_PREFIXES.some((p) => code.startsWith(p) || code === p)) fyi.push(line);
    else fyi.push(line); // unknown code → FYI (don't claim it's actionable)
  }
  return { actionable, fyi };
}
