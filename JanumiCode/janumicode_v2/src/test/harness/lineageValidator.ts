/**
 * Lineage Validator — match a workflow run against the phase contracts.
 *
 * For each completed phase, the validator:
 *   1. Resolves every `RequiredArtifact` against actual records. Match
 *      is by record_type AND (for artifact_produced) content.kind.
 *      Optional sub_phase_id + produced_by_agent_role tighten the match.
 *   2. Runs the phase's invariant validators over the record set.
 *   3. Runs authority rules per record_type.
 *
 * Missing required artifacts become `MissingRecord` gaps; invariant
 * failures become `AssertionFailure`s; authority mismatches become
 * `SchemaViolation`s. The caller builds a `GapReport` from these.
 */

import type { Database } from '../../lib/database/init';
import type { IntentLens, PhaseId } from '../../lib/types/records';
import { getPhaseContract } from './phaseContracts';
import type {
  AssertionFailure,
  GapReport,
  MissingRecord,
  RequiredArtifact,
  SchemaViolation,
  StructuredGap,
  StructuredGapCategory,
} from './types';

export interface LineageValidationResult {
  valid: boolean;
  missingRecords: MissingRecord[];
  violations: SchemaViolation[];
  assertionFailures: AssertionFailure[];
  /**
   * Structured per-gap entries (Wave 4). Every item corresponds to an
   * entry in one of the legacy arrays above — this is the additive
   * representation the virtuous-cycle coding agent reads.
   */
  gaps: StructuredGap[];
}

interface StreamRecord {
  id: string;
  record_type: string;
  phase_id: string | null;
  sub_phase_id: string | null;
  produced_by_agent_role: string | null;
  authority_level: number | null;
  content: string | null;
  produced_at: string;
}

// ── Public entry points ────────────────────────────────────────────

export function validateLineage(
  db: Database,
  workflowRunId: string,
  completedPhases: PhaseId[],
): LineageValidationResult {
  const missingRecords: MissingRecord[] = [];
  const violations: SchemaViolation[] = [];
  const assertionFailures: AssertionFailure[] = [];
  const gaps: StructuredGap[] = [];

  const records = getRecordsForRun(db, workflowRunId);
  // Resolve the run's intent_lens once so contract lookup stays cheap
  // across all phases. Phases that don't have a lens-specific contract
  // fall back to the default via getPhaseContract's own logic.
  const lens = getIntentLensForRun(db, workflowRunId);

  for (const phaseId of completedPhases) {
    const contract = getPhaseContract(phaseId, lens);
    if (!contract) continue;
    validateAgainstContract(records, phaseId, contract, {
      missingRecords, violations, assertionFailures, gaps,
    });
  }

  return {
    valid: missingRecords.length === 0 && violations.length === 0 && assertionFailures.length === 0,
    missingRecords,
    violations,
    assertionFailures,
    gaps,
  };
}

/**
 * Read the persisted intent_lens from the workflow_runs table. Returns
 * null when the column is empty (Phase 1.0a hasn't run yet) or the run
 * is missing. Defensive — catches both "column doesn't exist" (pre-
 * migration DBs) and plain null values.
 */
function getIntentLensForRun(db: Database, workflowRunId: string): IntentLens | null {
  try {
    const row = db
      .prepare(`SELECT intent_lens FROM workflow_runs WHERE id = ?`)
      .get(workflowRunId) as { intent_lens?: string | null } | undefined;
    const lens = row?.intent_lens;
    if (!lens) return null;
    return lens as IntentLens;
  } catch {
    return null;
  }
}

export function buildGapReport(
  result: LineageValidationResult,
  failedPhase: PhaseId,
  failedSubPhase?: string,
): GapReport {
  // Derive a sub-phase hint from the validator output when the caller
  // didn't supply one — prefer the first missing record (matches the
  // phase's first broken artifact), then fall back to the first
  // assertion failure. This lets the gap report carry locality even
  // when the caller has no prior signal.
  let subPhase = failedSubPhase;
  if (!subPhase) {
    const missingForPhase = result.missingRecords.find((m) => m.phase === failedPhase);
    if (missingForPhase?.sub_phase) subPhase = missingForPhase.sub_phase;
  }
  if (!subPhase) {
    const assertionForPhase = result.assertionFailures.find((a) => a.phase === failedPhase);
    if (assertionForPhase?.sub_phase && assertionForPhase.sub_phase !== 'unknown') {
      subPhase = assertionForPhase.sub_phase;
    }
  }
  return {
    phase: failedPhase,
    subPhase,
    failed_at_phase: failedPhase,
    failed_at_sub_phase: subPhase,
    missing_records: result.missingRecords,
    schema_violations: result.violations,
    assertion_failures: result.assertionFailures,
    gaps: result.gaps,
    suggested_fix: generateFixSuggestion(result),
    spec_references: getSpecReferences(result),
  };
}

// ── Artifact matching ──────────────────────────────────────────────

function artifactDisplay(req: RequiredArtifact): string {
  if (req.record_type === 'artifact_produced' && req.content_kind) {
    return `artifact_produced[kind=${req.content_kind}]`;
  }
  return req.record_type;
}

function findArtifact(records: StreamRecord[], req: RequiredArtifact): StreamRecord | null {
  for (const r of records) {
    if (r.record_type !== req.record_type) continue;
    if (req.sub_phase_id && r.sub_phase_id !== req.sub_phase_id) continue;
    if (req.produced_by_agent_role && r.produced_by_agent_role !== req.produced_by_agent_role) {
      // Role mismatch is a softer signal — record_type + content_kind
      // carry the semantic weight. We'd rather match and flag a role
      // drift via a separate invariant than refuse the match and
      // report a phantom missing record.
    }
    if (req.record_type === 'artifact_produced' && req.content_kind) {
      const kind = tryParseContent(r.content)?.kind;
      if (kind !== req.content_kind) continue;
    }
    return r;
  }
  return null;
}

// ── Invariant runners ──────────────────────────────────────────────

type InvariantCheck = (records: StreamRecord[]) => boolean;

const INVARIANT_VALIDATORS: Record<string, InvariantCheck> = {
  validateIntentStatementScope: (recs) => {
    const stmt = findArtifactByKind(recs, 'intent_statement');
    if (!stmt) return false;
    const content = tryParseContent(stmt.content) ?? {};
    const concept = (content.product_concept ?? {}) as { name?: unknown; description?: unknown };
    return typeof concept.name === 'string' && concept.name.length > 0
      && typeof concept.description === 'string' && concept.description.length > 0;
  },

  validateRequirementSources: (recs) => {
    const fr = findArtifactByKind(recs, 'functional_requirements');
    if (!fr) return true; // no requirements yet — nothing to validate
    const content = tryParseContent(fr.content) ?? {};
    const reqs = Array.isArray(content.requirements) ? content.requirements : [];
    if (reqs.length === 0) return true;
    return reqs.every((r: Record<string, unknown>) => {
      const sources = r.sources ?? r.source_ids ?? r.provenance;
      return Array.isArray(sources) && sources.length > 0;
    });
  },

  validateArchitectureComponents: (recs) => {
    const cm = findArtifactByKind(recs, 'component_model');
    if (!cm) return false;
    const content = tryParseContent(cm.content) ?? {};
    const components = Array.isArray(content.components) ? content.components : [];
    return components.length >= 2;
  },

  validateComponentResponsibilities: (recs) => {
    const cm = findArtifactByKind(recs, 'component_model');
    if (!cm) return true;
    const content = tryParseContent(cm.content) ?? {};
    const components = Array.isArray(content.components) ? content.components : [];
    return components.every((c: Record<string, unknown>) => {
      const resp = c.responsibilities ?? c.responsibility;
      if (typeof resp === 'string') return resp.length > 0;
      return Array.isArray(resp) && resp.length > 0;
    });
  },

  validateTaskEstimates: (recs) => {
    const plan = findArtifactByKind(recs, 'implementation_plan');
    if (!plan) return true;
    const content = tryParseContent(plan.content) ?? {};
    const tasks = Array.isArray(content.tasks) ? content.tasks : [];
    if (tasks.length === 0) return true;
    return tasks.every(
      (t: Record<string, unknown>) =>
        t.estimated_complexity !== undefined ||
        t.estimate !== undefined ||
        t.estimated_effort !== undefined,
    );
  },

  validateAcyclicDependencies: (recs) => {
    const plan = findArtifactByKind(recs, 'implementation_plan');
    if (!plan) return true;
    const content = tryParseContent(plan.content) ?? {};
    // Accept either an explicit graph or infer from per-task `depends_on`.
    const graph: Record<string, string[]> = {};
    if (content.dependency_graph && typeof content.dependency_graph === 'object') {
      Object.assign(graph, content.dependency_graph);
    } else {
      const tasks = Array.isArray(content.tasks) ? content.tasks : [];
      for (const t of tasks as Array<{ id?: string; depends_on?: unknown }>) {
        if (typeof t.id !== 'string') continue;
        graph[t.id] = Array.isArray(t.depends_on) ? (t.depends_on as string[]) : [];
      }
    }
    return !hasCycles(graph);
  },

  validateTestResults: (recs) => {
    const results = recs.filter(
      (r) =>
        r.record_type === 'artifact_produced' &&
        tryParseContent(r.content)?.kind === 'test_results',
    );
    if (results.length === 0) return false;
    return results.every((r) => {
      const content = tryParseContent(r.content) ?? {};
      const outcomes = content.outcomes ?? content.results ?? content.suites;
      return outcomes !== undefined;
    });
  },

  validateEvalResults: (recs) => {
    const results = findArtifactByKind(recs, 'evaluation_results');
    if (!results) return false;
    const content = tryParseContent(results.content) ?? {};
    const criteria =
      content.criteria ?? content.criterion_outcomes ?? content.results ?? null;
    return Array.isArray(criteria) ? criteria.length > 0 : !!criteria;
  },

  validateCommitMessage: (recs) => {
    const commit = findArtifactByKind(recs, 'commit_record');
    if (!commit) return true;
    const content = tryParseContent(commit.content) ?? {};
    const msg = (content.message ?? content.commit_message) as string | undefined;
    return typeof msg === 'string' && msg.length >= 10;
  },

  validateCommitReferencesIntent: (recs) => {
    const commit = findArtifactByKind(recs, 'commit_record');
    if (!commit) return true;
    const content = tryParseContent(commit.content) ?? {};
    const msg = (content.message ?? content.commit_message ?? '') as string;
    // Simple heuristic: commit should reference a run id, intent id, or
    // include an explicit reference marker.
    return msg.includes('#')
      || msg.includes('intent')
      || typeof content.intent_record_id === 'string'
      || typeof content.workflow_run_id === 'string';
  },
};

function runInvariant(
  records: StreamRecord[],
  invariant: { name: string; validator: string; severity: 'error' | 'warning'; sub_phase_id?: string },
  phaseId: PhaseId,
): AssertionFailure[] {
  const fn = INVARIANT_VALIDATORS[invariant.validator];
  if (!fn) return [];
  const passed = fn(records);
  if (passed) return [];
  return [
    {
      phase: phaseId,
      sub_phase: invariant.sub_phase_id ?? 'unknown',
      assertion: invariant.name,
      expected: 'true',
      actual: 'false',
    },
  ];
}

/**
 * Extended per-contract validation loop. Same three buckets as the
 * legacy validator (missing artifacts, invariant failures, authority
 * violations) but also emits structured gaps.
 */
function validateAgainstContract(
  records: StreamRecord[],
  phaseId: PhaseId,
  contract: import('./types').PhaseContract,
  out: {
    missingRecords: MissingRecord[];
    violations: SchemaViolation[];
    assertionFailures: AssertionFailure[];
    gaps: StructuredGap[];
  },
): void {
  for (const req of contract.required_artifacts) {
    if (findArtifact(records, req) || req.optional) continue;
    const display = artifactDisplay(req);
    out.missingRecords.push({
      record_type: display,
      phase: phaseId,
      sub_phase: req.sub_phase_id,
      reason: req.reason,
    });
    out.gaps.push(buildMissingArtifactGap(phaseId, req, display));
  }

  for (const invariant of contract.invariants) {
    const result = runInvariantRich(records, invariant, phaseId);
    if (!result.passed) {
      out.assertionFailures.push(...result.legacyFailures);
      out.gaps.push(...result.gaps);
    }
  }

  for (const rule of contract.authority_rules) {
    const ruleViolations = runAuthorityRule(records, rule);
    out.violations.push(...ruleViolations);
    for (const v of ruleViolations) {
      out.gaps.push(buildSchemaViolationGap(phaseId, v));
    }
  }
}

interface RichInvariantResult {
  passed: boolean;
  legacyFailures: AssertionFailure[];
  gaps: StructuredGap[];
}

/**
 * Run an invariant and return both the legacy AssertionFailure[] for
 * back-compat AND structured gaps for the virtuous-cycle loop. Some
 * invariants (shape/coverage) emit multiple failures per run; this
 * path supports that natively.
 */
function runInvariantRich(
  records: StreamRecord[],
  invariant: { name: string; description: string; validator: string; severity: 'error' | 'warning'; sub_phase_id?: string },
  phaseId: PhaseId,
): RichInvariantResult {
  // Shape/coverage oracles produce multi-failure output; they live in
  // MULTI_FAILURE_VALIDATORS and return per-field gaps directly.
  const multi = MULTI_FAILURE_VALIDATORS[invariant.validator];
  if (multi) {
    const findings = multi(records);
    if (findings.length === 0) return { passed: true, legacyFailures: [], gaps: [] };
    const legacy: AssertionFailure[] = findings.map(f => ({
      phase: phaseId,
      sub_phase: invariant.sub_phase_id ?? f.sub_phase_id ?? 'unknown',
      assertion: `${invariant.name}:${f.field}`,
      expected: f.expected,
      actual: f.actual,
    }));
    const gaps: StructuredGap[] = findings.map(f => buildShapeCoverageGap(phaseId, invariant, f));
    return { passed: false, legacyFailures: legacy, gaps };
  }

  const legacy = runInvariant(records, invariant, phaseId);
  if (legacy.length === 0) return { passed: true, legacyFailures: [], gaps: [] };
  const gaps: StructuredGap[] = legacy.map(f => buildInvariantGap(phaseId, invariant, f));
  return { passed: false, legacyFailures: legacy, gaps };
}

// ── Shape/coverage oracles (Wave 4, plan §10.2) ────────────────────

interface ShapeCoverageFinding {
  field: string;
  expected: string;
  actual: string;
  sub_phase_id?: string;
}

type MultiFailureCheck = (records: StreamRecord[]) => ShapeCoverageFinding[];

const MULTI_FAILURE_VALIDATORS: Record<string, MultiFailureCheck> = {
  /**
   * Product description handoff shape/coverage oracle. Thresholds are
   * derived from the v1 Hestami handoff (see plan §10.2). Uses ranges
   * rather than exact counts because v1 is an *approximate* gold
   * reference — generative outputs vary run-to-run even under the same
   * intent.
   */
  validateProductDescriptionHandoffShape: (recs) => {
    const findings: ShapeCoverageFinding[] = [];
    const rec = recs.find(r => r.record_type === 'product_description_handoff');
    if (!rec) {
      findings.push({
        field: 'record_type:product_description_handoff',
        expected: 'present at 1.6',
        actual: 'missing',
        sub_phase_id: '1.6',
      });
      return findings;
    }
    const content = tryParseContent(rec.content) ?? {};

    const pushRange = (field: string, actualCount: number, min: number, max: number) => {
      if (actualCount < min || actualCount > max) {
        findings.push({
          field,
          expected: `length in [${min}, ${max}]`,
          actual: `length=${actualCount}`,
          sub_phase_id: '1.6',
        });
      }
    };
    const arr = (k: string): unknown[] => Array.isArray(content[k]) ? content[k] as unknown[] : [];

    // Ranges widened in iter-3c to accommodate Codex gpt-5.4's richer
    // generation. qwen3.5:9b produced outputs near the v1 reference
    // counts (6 personas / 45 entities etc.); Codex produces 2–2.5x
    // more (13 personas / 106 entities). Upper bounds reflect the
    // capable-CLI reality; lower bounds are unchanged — same minimum
    // quality floor regardless of backing.
    pushRange('personas', arr('personas').length, 3, 15);
    pushRange('userJourneys', arr('userJourneys').length, 5, 15);
    pushRange('businessDomainProposals', arr('businessDomainProposals').length, 6, 30);
    pushRange('entityProposals', arr('entityProposals').length, 20, 150);
    pushRange('workflowProposals', arr('workflowProposals').length, 3, 30);
    pushRange('integrationProposals', arr('integrationProposals').length, 5, 35);
    pushRange('qualityAttributes', arr('qualityAttributes').length, 8, 25);
    pushRange('phasingStrategy', arr('phasingStrategy').length, 2, 5);
    // iter-4 decomposed extraction fields — lower bound is 0 because a
    // simple intent (e.g. a one-line "build a todo app") legitimately
    // has no stated technical constraints / compliance regimes / V&V
    // targets / vocabulary. Upper bounds reflect what Codex produces
    // for a rich spec like Hestami.
    pushRange('technicalConstraints', arr('technicalConstraints').length, 0, 40);
    pushRange('complianceExtractedItems', arr('complianceExtractedItems').length, 0, 30);
    pushRange('vvRequirements', arr('vvRequirements').length, 0, 40);
    pushRange('canonicalVocabulary', arr('canonicalVocabulary').length, 0, 60);

    // Element-level shape checks
    for (const p of arr('personas') as Array<Record<string, unknown>>) {
      if (!p.name || !Array.isArray(p.goals) || (p.goals as unknown[]).length < 1 ||
          !Array.isArray(p.painPoints) || (p.painPoints as unknown[]).length < 1) {
        findings.push({
          field: `personas[id=${p.id ?? '?'}]`,
          expected: 'name + goals[≥1] + painPoints[≥1]',
          actual: `goals=${Array.isArray(p.goals) ? (p.goals as unknown[]).length : 0}, painPoints=${Array.isArray(p.painPoints) ? (p.painPoints as unknown[]).length : 0}`,
          sub_phase_id: '1.6',
        });
      }
    }
    for (const j of arr('userJourneys') as Array<Record<string, unknown>>) {
      if (!Array.isArray(j.steps) || (j.steps as unknown[]).length < 3 ||
          !Array.isArray(j.acceptanceCriteria) || (j.acceptanceCriteria as unknown[]).length < 1 ||
          typeof j.implementationPhase !== 'string') {
        findings.push({
          field: `userJourneys[id=${j.id ?? '?'}]`,
          expected: 'steps[≥3] + acceptanceCriteria[≥1] + implementationPhase',
          actual: `steps=${Array.isArray(j.steps) ? (j.steps as unknown[]).length : 0}, acceptanceCriteria=${Array.isArray(j.acceptanceCriteria) ? (j.acceptanceCriteria as unknown[]).length : 0}, implementationPhase=${typeof j.implementationPhase}`,
          sub_phase_id: '1.6',
        });
      }
    }
    for (const d of arr('businessDomainProposals') as Array<Record<string, unknown>>) {
      if (!Array.isArray(d.entityPreview) || (d.entityPreview as unknown[]).length < 3 ||
          !Array.isArray(d.workflowPreview) || (d.workflowPreview as unknown[]).length < 1) {
        findings.push({
          field: `businessDomainProposals[id=${d.id ?? '?'}]`,
          expected: 'entityPreview[≥3] + workflowPreview[≥1]',
          actual: `entityPreview=${Array.isArray(d.entityPreview) ? (d.entityPreview as unknown[]).length : 0}, workflowPreview=${Array.isArray(d.workflowPreview) ? (d.workflowPreview as unknown[]).length : 0}`,
          sub_phase_id: '1.6',
        });
      }
    }
    const domainIds = new Set((arr('businessDomainProposals') as Array<Record<string, unknown>>).map(d => d.id as string));
    for (const e of arr('entityProposals') as Array<Record<string, unknown>>) {
      const ka = Array.isArray(e.keyAttributes) ? (e.keyAttributes as unknown[]).length : 0;
      const rel = Array.isArray(e.relationships) ? (e.relationships as unknown[]).length : 0;
      const bdi = e.businessDomainId as string | undefined;
      const unknownDomain = bdi && !domainIds.has(bdi);
      if (ka < 2 || rel < 1 || unknownDomain) {
        findings.push({
          field: `entityProposals[id=${e.id ?? '?'}]`,
          expected: 'keyAttributes[≥2] + relationships[≥1] + businessDomainId in domains',
          actual: `keyAttributes=${ka}, relationships=${rel}, businessDomainId=${bdi ?? 'missing'}${unknownDomain ? ' (UNKNOWN)' : ''}`,
          sub_phase_id: '1.6',
        });
      }
    }
    for (const w of arr('workflowProposals') as Array<Record<string, unknown>>) {
      const s = Array.isArray(w.steps) ? (w.steps as unknown[]).length : 0;
      const t = Array.isArray(w.triggers) ? (w.triggers as unknown[]).length : 0;
      if (s < 3 || t < 1) {
        findings.push({
          field: `workflowProposals[id=${w.id ?? '?'}]`,
          expected: 'steps[≥3] + triggers[≥1]',
          actual: `steps=${s}, triggers=${t}`,
          sub_phase_id: '1.6',
        });
      }
    }
    const allowedOwnership = new Set(['delegated', 'synced', 'consumed', 'owned']);
    for (const i of arr('integrationProposals') as Array<Record<string, unknown>>) {
      const sp = Array.isArray(i.standardProviders) ? (i.standardProviders as unknown[]).length : 0;
      const om = i.ownershipModel as string | undefined;
      if (sp < 1 || !om || !allowedOwnership.has(om)) {
        findings.push({
          field: `integrationProposals[id=${i.id ?? '?'}]`,
          expected: 'standardProviders[≥1] + ownershipModel in {delegated,synced,consumed,owned}',
          actual: `standardProviders=${sp}, ownershipModel=${om ?? 'missing'}`,
          sub_phase_id: '1.6',
        });
      }
    }
    const journeyIds = new Set((arr('userJourneys') as Array<Record<string, unknown>>).map(j => j.id as string));
    for (const ph of arr('phasingStrategy') as Array<Record<string, unknown>>) {
      const jids = Array.isArray(ph.journeyIds) ? ph.journeyIds as string[] : [];
      const unknownJourneys = jids.filter(id => !journeyIds.has(id));
      if (unknownJourneys.length > 0) {
        findings.push({
          field: `phasingStrategy[phase=${ph.phase ?? '?'}].journeyIds`,
          expected: 'all ids refer to real userJourneys',
          actual: `unknown journey ids: ${unknownJourneys.join(', ')}`,
          sub_phase_id: '1.6',
        });
      }
    }

    // iter-4 traceability spine: each captured item in the decomposed
    // extraction categories SHOULD carry source_ref.excerpt (load-
    // bearing for downstream drift-detection chains). A missing
    // source_ref is a warning, not a hard failure — extraction passes
    // running against intents with no external source doc legitimately
    // lack provenance targets.
    const provenanceCheck = (field: string, items: Array<Record<string, unknown>>) => {
      const missing = items.filter(it => {
        const ref = it.source_ref as Record<string, unknown> | undefined;
        return !ref || typeof ref.excerpt !== 'string' || (ref.excerpt as string).length === 0;
      });
      if (missing.length > 0 && items.length > 0) {
        findings.push({
          field: `${field}[].source_ref`,
          expected: `each item has source_ref.excerpt (traceability spine)`,
          actual: `${missing.length}/${items.length} items missing source_ref.excerpt`,
          sub_phase_id: '1.6',
        });
      }
    };
    provenanceCheck('technicalConstraints', arr('technicalConstraints') as Array<Record<string, unknown>>);
    provenanceCheck('complianceExtractedItems', arr('complianceExtractedItems') as Array<Record<string, unknown>>);
    provenanceCheck('vvRequirements', arr('vvRequirements') as Array<Record<string, unknown>>);
    provenanceCheck('canonicalVocabulary', arr('canonicalVocabulary') as Array<Record<string, unknown>>);

    return findings;
  },

  /**
   * Phase 2 product-lens traceability invariant (wave 5).
   * Every FR user_story and every NFR must carry a non-empty
   * `traces_to[]` whose ids resolve against the handoff. Walks the
   * handoff catalog once, then verifies each FR / NFR entry.
   */
  validateRequirementsProductTraceability: (recs) => {
    const findings: ShapeCoverageFinding[] = [];
    // Build the set of valid trace-target ids from the latest handoff.
    const handoff = recs.find(r => r.record_type === 'product_description_handoff');
    if (!handoff) return findings; // Non-product lens — invariant doesn't apply.
    const h = tryParseContent(handoff.content) ?? {};
    const collectIds = (key: string): string[] => {
      const a = Array.isArray(h[key]) ? h[key] as Array<Record<string, unknown>> : [];
      return a.map(x => typeof x.id === 'string' ? x.id : '').filter(Boolean);
    };
    const validIds = new Set<string>([
      ...collectIds('personas'),
      ...collectIds('userJourneys'),
      ...collectIds('businessDomainProposals'),
      ...collectIds('entityProposals'),
      ...collectIds('workflowProposals'),
      ...collectIds('integrationProposals'),
      ...collectIds('technicalConstraints'),
      ...collectIds('vvRequirements'),
      ...collectIds('complianceExtractedItems'),
      ...collectIds('canonicalVocabulary'),
      ...collectIds('requirements'),
      ...collectIds('decisions'),
      ...collectIds('constraints'),
      ...collectIds('openQuestions'),
    ]);
    // QA-# ids are synthetic — build them by index.
    const qaCount = Array.isArray(h.qualityAttributes) ? (h.qualityAttributes as unknown[]).length : 0;
    for (let i = 1; i <= qaCount; i++) validIds.add(`QA-${i}`);

    const checkItem = (artifactKind: string, items: Array<Record<string, unknown>>, subPhase: string) => {
      for (const it of items) {
        const id = typeof it.id === 'string' ? it.id : '?';
        const traces = Array.isArray(it.traces_to) ? it.traces_to as string[] : [];
        if (traces.length === 0) {
          findings.push({
            field: `${artifactKind}[id=${id}].traces_to`,
            expected: 'non-empty traces_to[] referencing handoff item ids',
            actual: 'empty',
            sub_phase_id: subPhase,
          });
          continue;
        }
        const unknown = traces.filter(t => !validIds.has(t));
        if (unknown.length > 0) {
          findings.push({
            field: `${artifactKind}[id=${id}].traces_to`,
            expected: 'all traces_to ids resolve to real handoff items',
            actual: `unknown trace ids: ${unknown.join(', ')}`,
            sub_phase_id: subPhase,
          });
        }
      }
    };

    const fr = recs.find(r => r.record_type === 'artifact_produced'
      && tryParseContent(r.content)?.kind === 'functional_requirements');
    if (fr) {
      const frc = tryParseContent(fr.content) ?? {};
      const stories = Array.isArray(frc.user_stories) ? frc.user_stories as Array<Record<string, unknown>> : [];
      checkItem('functional_requirements.user_stories', stories, '2.1');
    }
    // Build the set of FR user_story ids for applies_to_requirements validation.
    const frStoryIds = new Set<string>();
    if (fr) {
      const frc = tryParseContent(fr.content) ?? {};
      const stories = Array.isArray(frc.user_stories) ? frc.user_stories as Array<Record<string, unknown>> : [];
      for (const s of stories) if (typeof s.id === 'string') frStoryIds.add(s.id);
    }

    const nfr = recs.find(r => r.record_type === 'artifact_produced'
      && tryParseContent(r.content)?.kind === 'non_functional_requirements');
    if (nfr) {
      const nfrc = tryParseContent(nfr.content) ?? {};
      const items = Array.isArray(nfrc.requirements) ? nfrc.requirements as Array<Record<string, unknown>> : [];
      checkItem('non_functional_requirements.requirements', items, '2.2');
      // Wave 5 trace-id fix: applies_to_requirements (when present) must
      // reference real FR user_story ids. This catches the qwen failure
      // mode where US-* ids were stuffed into traces_to.
      for (const it of items) {
        const id = typeof it.id === 'string' ? it.id : '?';
        const applies = Array.isArray(it.applies_to_requirements)
          ? it.applies_to_requirements as string[] : [];
        if (applies.length === 0) continue;
        const unknownFr = applies.filter(a => !frStoryIds.has(a));
        if (unknownFr.length > 0) {
          findings.push({
            field: `non_functional_requirements.requirements[id=${id}].applies_to_requirements`,
            expected: 'all ids resolve to FR user_story ids from sub-phase 2.1',
            actual: `unknown FR ids: ${unknownFr.join(', ')}`,
            sub_phase_id: '2.2',
          });
        }
      }
    }
    return findings;
  },

  /**
   * Warning-level coverage invariant: every accepted userJourney in
   * the handoff should have at least one user_story tracing to it.
   * Reports per-journey coverage failures.
   */
  validateJourneyCoverageByFRs: (recs) => {
    const findings: ShapeCoverageFinding[] = [];
    const handoff = recs.find(r => r.record_type === 'product_description_handoff');
    if (!handoff) return findings;
    const h = tryParseContent(handoff.content) ?? {};
    const journeys = Array.isArray(h.userJourneys) ? h.userJourneys as Array<Record<string, unknown>> : [];
    if (journeys.length === 0) return findings;

    const fr = recs.find(r => r.record_type === 'artifact_produced'
      && tryParseContent(r.content)?.kind === 'functional_requirements');
    if (!fr) {
      findings.push({
        field: 'functional_requirements',
        expected: 'present for product-lens journey coverage check',
        actual: 'missing',
        sub_phase_id: '2.1',
      });
      return findings;
    }
    const frc = tryParseContent(fr.content) ?? {};
    const stories = Array.isArray(frc.user_stories) ? frc.user_stories as Array<Record<string, unknown>> : [];
    const coveredJourneys = new Set<string>();
    for (const s of stories) {
      const traces = Array.isArray(s.traces_to) ? s.traces_to as string[] : [];
      for (const t of traces) if (t.startsWith('UJ-')) coveredJourneys.add(t);
    }
    for (const j of journeys) {
      const jid = typeof j.id === 'string' ? j.id : '?';
      if (!coveredJourneys.has(jid)) {
        findings.push({
          field: `userJourneys[id=${jid}].coverage`,
          expected: `≥ 1 user_story with traces_to containing ${jid}`,
          actual: 'no functional requirement covers this journey',
          sub_phase_id: '2.1',
        });
      }
    }
    return findings;
  },
};

// ── Structured-gap builders ────────────────────────────────────────

/**
 * Stable-ish gap id derived from the payload. Collisions across runs
 * on the same contract-failure signature are intentional — they let
 * the gap report dedup gaps that have persisted across retries.
 */
function gapIdFor(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(':').replace(/[^A-Za-z0-9:_\-\[\].=]/g, '_');
}

function buildMissingArtifactGap(
  phaseId: PhaseId,
  req: RequiredArtifact,
  display: string,
): StructuredGap {
  const category: StructuredGapCategory = 'missing_artifact';
  return {
    gap_id: gapIdFor(['phase', phaseId, 'sub', req.sub_phase_id, 'missing', display]),
    phase_id: phaseId,
    sub_phase_id: req.sub_phase_id,
    severity: 'error',
    category,
    summary: `Phase ${phaseId}${req.sub_phase_id ? ` sub-phase ${req.sub_phase_id}` : ''} did not emit ${display}.`,
    expected: {
      record_type: req.record_type,
      content_kind: req.content_kind,
      sub_phase_id: req.sub_phase_id,
      produced_by_agent_role: req.produced_by_agent_role,
    },
    observed: { status: 'missing' },
    likely_source: guessLikelySourceForArtifact(phaseId, req),
    reproduce: {
      command: 'pnpm exec vitest run src/test/unit/orchestrator/phase1ProductLens.test.ts',
    },
  };
}

function buildShapeCoverageGap(
  phaseId: PhaseId,
  invariant: { name: string; description: string; sub_phase_id?: string },
  finding: ShapeCoverageFinding,
): StructuredGap {
  // product_description_handoff shape/coverage gaps are the primary
  // signal that drives the virtuous-cycle repair loop — keep the
  // likely_source pointers specific (the 1.6 synthesis template is
  // the first place a fixer should look).
  return {
    gap_id: gapIdFor(['phase', phaseId, 'sub', invariant.sub_phase_id ?? finding.sub_phase_id, invariant.name, finding.field]),
    phase_id: phaseId,
    sub_phase_id: invariant.sub_phase_id ?? finding.sub_phase_id,
    severity: 'error',
    category: finding.field.startsWith('length') || finding.expected.startsWith('length') ? 'coverage_violation' : 'shape_violation',
    summary: `${invariant.name}: field ${finding.field} — expected ${finding.expected}, actual ${finding.actual}.`,
    expected: { field: finding.field, description: finding.expected },
    observed: { field: finding.field, value: finding.actual },
    likely_source: {
      templates: ['.janumicode/prompts/phases/phase_01_intent_capture/sub_phase_01_6_product_description_synthesis/product_description_synthesis.product.system.md'],
      handlers: ['src/lib/orchestrator/phases/phase1.ts:runProductDescriptionSynthesis'],
      schemas: ['.janumicode/schemas/artifacts/product_description_handoff.schema.json'],
    },
    reproduce: {
      command: 'pnpm exec vitest run src/test/unit/harness/phase1ProductLensContract.test.ts',
    },
  };
}

function buildInvariantGap(
  phaseId: PhaseId,
  invariant: { name: string; description: string; sub_phase_id?: string },
  failure: AssertionFailure,
): StructuredGap {
  return {
    gap_id: gapIdFor(['phase', phaseId, 'sub', invariant.sub_phase_id, 'invariant', invariant.name]),
    phase_id: phaseId,
    sub_phase_id: invariant.sub_phase_id ?? failure.sub_phase,
    severity: 'error',
    category: 'invariant_violation',
    summary: `Invariant ${invariant.name} failed: ${invariant.description}`,
    expected: { value: failure.expected },
    observed: { value: failure.actual },
    likely_source: {
      templates: [],
      handlers: ['src/lib/orchestrator/phases/phase1.ts'],
      schemas: [],
    },
    reproduce: { command: 'pnpm exec vitest run' },
  };
}

function buildSchemaViolationGap(phaseId: PhaseId, violation: SchemaViolation): StructuredGap {
  return {
    gap_id: gapIdFor(['phase', phaseId, 'schema', violation.record_type, violation.field]),
    phase_id: phaseId,
    severity: 'error',
    category: 'schema_violation',
    summary: `Schema violation on ${violation.record_type}.${violation.field}: ${violation.error}`,
    expected: { field: violation.field, schema_version: violation.schema_version },
    observed: { record_id: violation.record_id, error: violation.error },
    likely_source: { templates: [], handlers: [], schemas: [] },
    reproduce: { command: 'pnpm exec vitest run' },
  };
}

/**
 * Best-effort pointer to the handler + template most likely to own a
 * missing artifact. Covers the Phase 1 product-lens surfaces; falls
 * back to generic pointers for artifacts we don't recognise.
 */
function guessLikelySourceForArtifact(
  phaseId: PhaseId,
  req: RequiredArtifact,
): { templates: string[]; handlers: string[]; schemas: string[] } {
  const base = `src/lib/orchestrator/phases/phase${phaseId}.ts`;
  const empty = { templates: [] as string[], handlers: [base], schemas: [] as string[] };
  if (phaseId !== '1') return empty;

  const kind = req.content_kind;
  const map: Record<string, { template?: string; schema?: string }> = {
    intent_discovery: { template: '.janumicode/prompts/phases/phase_01_intent_capture/sub_phase_01_0b_intent_discovery/intent_discovery.product.system.md' },
    business_domains_bloom: { template: '.janumicode/prompts/phases/phase_01_intent_capture/sub_phase_01_2_business_domains_bloom/business_domains_bloom.product.system.md' },
    journeys_workflows_bloom: { template: '.janumicode/prompts/phases/phase_01_intent_capture/sub_phase_01_3_journeys_workflows_bloom/journeys_workflows_bloom.product.system.md' },
    entities_bloom: { template: '.janumicode/prompts/phases/phase_01_intent_capture/sub_phase_01_4_entities_bloom/entities_bloom.product.system.md' },
    integrations_qa_bloom: { template: '.janumicode/prompts/phases/phase_01_intent_capture/sub_phase_01_5_integrations_qa_bloom/integrations_qa_bloom.product.system.md' },
    intent_statement: { schema: '(derived at 1.6 from product_description_handoff)' },
    intent_lens_classification: { template: '.janumicode/prompts/phases/phase_01_intent_capture/sub_phase_01_0a_intent_lens_classification/intent_lens_classification.system.md', schema: '.janumicode/schemas/artifacts/intent_lens_classification.schema.json' },
  };
  const hint = kind ? map[kind] : undefined;
  if (req.record_type === 'product_description_handoff') {
    return {
      templates: ['.janumicode/prompts/phases/phase_01_intent_capture/sub_phase_01_6_product_description_synthesis/product_description_synthesis.product.system.md'],
      handlers: ['src/lib/orchestrator/phases/phase1.ts:runProductDescriptionSynthesis'],
      schemas: ['.janumicode/schemas/artifacts/product_description_handoff.schema.json'],
    };
  }
  return {
    templates: hint?.template ? [hint.template] : [],
    handlers: [base],
    schemas: hint?.schema ? [hint.schema] : [],
  };
}

function runAuthorityRule(
  records: StreamRecord[],
  rule: { record_type: string; min_authority: number; max_authority: number },
): SchemaViolation[] {
  const violations: SchemaViolation[] = [];
  for (const r of records) {
    if (r.record_type !== rule.record_type) continue;
    const authority = r.authority_level ?? 0;
    if (authority < rule.min_authority || authority > rule.max_authority) {
      violations.push({
        record_id: r.id,
        record_type: r.record_type,
        field: 'authority_level',
        error: `Authority ${authority} outside allowed range [${rule.min_authority}, ${rule.max_authority}]`,
        schema_version: '1.0',
      });
    }
  }
  return violations;
}

// ── Gap-report helpers ─────────────────────────────────────────────

function generateFixSuggestion(result: LineageValidationResult): string {
  const lines: string[] = [];
  if (result.missingRecords.length > 0) {
    const missing = result.missingRecords.map((r) => r.record_type).join(', ');
    lines.push(
      `Missing artifacts: ${missing}. Check the matching phase handler in src/lib/orchestrator/phases/ and the RequiredArtifact entries in src/test/harness/phaseContracts.ts.`,
    );
  }
  if (result.violations.length > 0) {
    lines.push(
      'Authority violations detected. Verify the record writer sets the right authority_level for the owning agent role.',
    );
  }
  if (result.assertionFailures.length > 0) {
    const failed = result.assertionFailures.map((f) => f.assertion).join(', ');
    lines.push(
      `Invariant failures: ${failed}. Review the invariant implementations in src/test/harness/lineageValidator.ts and the handler logic that produces the relevant artifacts.`,
    );
  }
  return lines.join(' ') || 'No issues found.';
}

function getSpecReferences(result: LineageValidationResult): string[] {
  const refs = new Set<string>();
  for (const m of result.missingRecords) {
    refs.add(`phase ${m.phase}` + (m.sub_phase ? `, sub-phase ${m.sub_phase}` : ''));
  }
  for (const v of result.violations) refs.add(`record_type ${v.record_type}`);
  for (const a of result.assertionFailures) refs.add(`invariant ${a.assertion}`);
  return [...refs];
}

// ── DB + parsing helpers ───────────────────────────────────────────

function getRecordsForRun(db: Database, workflowRunId: string): StreamRecord[] {
  return db
    .prepare(
      `SELECT id, record_type, phase_id, sub_phase_id, produced_by_agent_role,
              authority_level, content, produced_at
         FROM governed_stream
         WHERE workflow_run_id = ?
         ORDER BY produced_at ASC`,
    )
    .all(workflowRunId) as StreamRecord[];
}

function findArtifactByKind(records: StreamRecord[], kind: string): StreamRecord | null {
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (tryParseContent(r.content)?.kind === kind) return r;
  }
  return null;
}

function tryParseContent(content: string | null): Record<string, unknown> | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasCycles(graph: Record<string, string[]>): boolean {
  const visited = new Set<string>();
  const stack = new Set<string>();
  function dfs(node: string): boolean {
    if (stack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    stack.add(node);
    for (const next of graph[node] ?? []) {
      if (dfs(next)) return true;
    }
    stack.delete(node);
    return false;
  }
  for (const n of Object.keys(graph)) {
    if (dfs(n)) return true;
  }
  return false;
}
