/**
 * Phase 1 Sub-Phase 1.3c — Deterministic coverage verifier.
 *
 * Runs after 1.3a (user journeys) and 1.3b (system workflows) have both
 * reached human acceptance. Structural pass-closure for 1.3: confirms
 * that the accepted journeys + workflows cover the upstream inputs they
 * were meant to cover. Emits one `coverage_gap` governed-stream record
 * per failed predicate; the orchestrator routes gaps to MMP where the
 * human chooses `accepted_as_scope_cut` or `rebloom_requested`.
 *
 * Design principles (aligned with Wave 7 Phase 1 redesign):
 * - Pure function — no side effects, no LLM calls, no DB writes.
 *   Caller is responsible for persisting returned `CoverageGapContent`
 *   records to the governed stream.
 * - Exhaustive — runs every structural predicate in one pass and
 *   returns all gaps. Caller does not re-invoke after fixing a single
 *   gap; the full set is shown to the human as a checklist.
 * - Deterministic — same input always produces the same output (sorted
 *   arrays, stable iteration order).
 * - Severity-tagged — `blocking` gaps pause phase progression;
 *   `advisory` gaps log but do not block.
 */

import type {
  CoverageGapContent,
  ExtractedItem,
  Integration,
  Persona,
  UserJourney,
  VVRequirement,
  VocabularyTerm,
  WorkflowV2,
  WorkflowTrigger,
} from '../../../types/records';

/** Inputs to the coverage check — all post-MMP, all accepted. */
export interface CoverageVerifierInputs {
  /** Accepted personas from Sub-Phase 1.2. */
  personas: Persona[];
  /** Accepted business-domain ids from Sub-Phase 1.2. */
  domainIds: string[];
  /** Accepted journeys from Sub-Phase 1.3a. */
  journeys: UserJourney[];
  /** Accepted workflows from Sub-Phase 1.3b. */
  workflows: WorkflowV2[];
  /** Compliance regimes (accepted compliance_extracted_items) from 1.0d. */
  complianceItems: ExtractedItem[];
  /**
   * Retention rules — compliance items that explicitly carry a
   * retention obligation. In the current handoff shape retention is
   * represented as compliance items with specific language; callers
   * pre-filter into this list to keep the verifier stable.
   */
  retentionRules: ExtractedItem[];
  /** V&V requirements from 1.0e. */
  vvRequirements: VVRequirement[];
  /** Integrations from 1.5. */
  integrations: Integration[];
  /** Canonical vocabulary from 1.0f (used for referential-integrity checks). */
  vocabulary: VocabularyTerm[];
  /**
   * Business-domain ids the 1.3a bloom reported as unreached (i.e. the
   * LLM explicitly said no journey exists there). Passed through to the
   * verifier so a null domain-coverage result can be distinguished
   * between "bloom output was incomplete" and "bloom explicitly
   * excluded it" — only the former should block.
   */
  blomExplicitlyUnreachedDomains?: string[];
  /** Personas the bloom explicitly reported as unreached. Same semantics as above. */
  bloomExplicitlyUnreachedPersonas?: string[];
}

/** Output of the verifier — empty array means "all checks passed". */
export type CoverageVerifierResult = CoverageGapContent[];

const SUB_PHASE = 'coverage_verifier';

// ── Predicate helpers ──────────────────────────────────────────────

function difference(a: string[], b: string[]): string[] {
  const bSet = new Set(b);
  return a.filter(id => !bSet.has(id));
}

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

// ── Individual checks ──────────────────────────────────────────────

/**
 * Every accepted persona initiates at least one journey. A persona the
 * bloom explicitly reported as unreached is not a gap — the bloom
 * made an explicit judgment that the human approved. A persona missing
 * silently IS a gap.
 */
function checkPersonaCoverage(i: CoverageVerifierInputs): CoverageGapContent[] {
  const expectedIds = i.personas.map(p => p.id);
  const initiatingPersonas = new Set(i.journeys.map(j => j.personaId));
  const explicitlyUnreached = new Set(i.bloomExplicitlyUnreachedPersonas ?? []);
  const actualIds: string[] = [];
  const missingIds: string[] = [];
  for (const id of expectedIds) {
    if (initiatingPersonas.has(id) || explicitlyUnreached.has(id)) {
      actualIds.push(id);
    } else {
      missingIds.push(id);
    }
  }
  if (missingIds.length === 0) return [];
  return [mkGap({
    check: 'persona_coverage',
    assertion: 'Every accepted persona is expected to initiate at least one journey, or be explicitly reported as unreached. Advisory — an uncovered persona may legitimately be a deferred/secondary actor the human accepts.',
    severity: 'advisory',
    expected: expectedIds,
    actual: actualIds,
    missing: missingIds,
  })];
}

/**
 * Every accepted domain hosts at least one journey AND at least one
 * workflow. A domain the bloom explicitly excluded is not a gap.
 */
function checkDomainCoverage(i: CoverageVerifierInputs): CoverageGapContent[] {
  const expectedIds = i.domainIds;
  const journeyDomains = new Set<string>();
  for (const j of i.journeys) {
    const ids = (j as unknown as { businessDomainIds?: string[] }).businessDomainIds ?? [];
    ids.forEach(d => journeyDomains.add(d));
  }
  const workflowDomains = new Set(i.workflows.map(w => w.businessDomainId));
  const explicitlyUnreached = new Set(i.blomExplicitlyUnreachedDomains ?? []);

  const missingJourney: string[] = [];
  const missingWorkflow: string[] = [];
  for (const id of expectedIds) {
    if (explicitlyUnreached.has(id)) continue;
    if (!journeyDomains.has(id)) missingJourney.push(id);
    if (!workflowDomains.has(id)) missingWorkflow.push(id);
  }
  const gaps: CoverageGapContent[] = [];
  if (missingJourney.length > 0) {
    gaps.push(mkGap({
      check: 'domain_journey_coverage',
      assertion: 'Every accepted domain is expected to host at least one journey, or be explicitly reported as unreached. Advisory — a purely back-office domain with no user-journey surface is legitimate.',
      severity: 'advisory',
      expected: expectedIds,
      actual: expectedIds.filter(d => journeyDomains.has(d) || explicitlyUnreached.has(d)),
      missing: missingJourney,
    }));
  }
  if (missingWorkflow.length > 0) {
    gaps.push(mkGap({
      check: 'domain_workflow_coverage',
      assertion: 'Every accepted domain is expected to host at least one workflow, or be explicitly reported as unreached. Advisory — a domain may legitimately have no workflow surface at Phase 1 and be served by Phase 4 architecture.',
      severity: 'advisory',
      expected: expectedIds,
      actual: expectedIds.filter(d => workflowDomains.has(d) || explicitlyUnreached.has(d)),
      missing: missingWorkflow,
    }));
  }
  return gaps;
}

/**
 * Every journey step with `automatable: true` is claimed by at least
 * one workflow with a `journey_step` trigger pointing at
 * (journey.id, step.stepNumber). This is the load-bearing coverage
 * check that replaces the legacy 1.3's prose instruction.
 */
function checkAutomatableStepBacking(i: CoverageVerifierInputs): CoverageGapContent[] {
  // Build the expected set: every automatable journey step.
  // `automatable` is emergent — either explicitly flagged `true` by 1.3a
  // OR implicitly promoted because a workflow backs it via a journey_step
  // trigger. The union is the authoritative "this step has system backing"
  // set. We only emit a gap when the step was EXPLICITLY flagged
  // automatable (1.3a said "this needs system backing") but no workflow
  // claimed it (1.3b forgot). Workflow-backed-but-not-flagged is treated
  // as implicit promotion, not a gap.
  const expected: string[] = [];
  for (const j of i.journeys) {
    for (const s of j.steps) {
      if (s.automatable === true) expected.push(`${j.id}#${s.stepNumber}`);
    }
  }
  const actual = new Set<string>();
  for (const w of i.workflows) {
    for (const t of w.triggers) {
      if (t.kind === 'journey_step') {
        actual.add(`${t.journey_id}#${t.step_number}`);
      }
    }
  }
  const missing = expected.filter(k => !actual.has(k));
  if (missing.length === 0) return [];
  return [mkGap({
    check: 'automatable_step_backing',
    assertion: 'Every explicitly-automatable journey step is expected to be backed by a workflow. Advisory — an unbacked automatable step may indicate an LLM miss the human can address by accepting or re-blooming.',
    severity: 'advisory',
    expected,
    actual: Array.from(actual).filter(k => expected.includes(k)),
    missing,
  })];
}

/**
 * Every accepted compliance regime with a runtime obligation is
 * surfaced by at least one journey OR workflow. Implemented as a
 * coverage check against both artifact types' `surfaces.compliance_regimes`
 * (journeys) and `surfaces.compliance_regimes` (workflows) + workflow
 * triggers of kind 'compliance'.
 *
 * All accepted compliance items are treated as having runtime
 * obligations unless a future schema version adds an explicit
 * "obligation: 'design_time' | 'runtime'" tag. Until then, any compliance
 * item not surfaced by any artifact fails the check.
 */
function checkComplianceCoverage(i: CoverageVerifierInputs): CoverageGapContent[] {
  const expected = i.complianceItems.map(c => c.id);
  const actual = new Set<string>();
  const collect = (xs?: string[]) => { (xs ?? []).forEach(id => actual.add(id)); };
  for (const j of i.journeys) {
    collect((j as unknown as { surfaces?: { compliance_regimes?: string[] } }).surfaces?.compliance_regimes);
  }
  for (const w of i.workflows) {
    collect((w as unknown as { surfaces?: { compliance_regimes?: string[] } }).surfaces?.compliance_regimes);
    for (const t of w.triggers) {
      if (t.kind === 'compliance') actual.add(t.regime_id);
    }
  }
  const missing = difference(expected, Array.from(actual));
  if (missing.length === 0) return [];
  return [mkGap({
    check: 'compliance_coverage',
    assertion: 'Every accepted compliance item is expected to be surfaced by at least one journey or workflow (via surfaces.compliance_regimes or a compliance trigger). Advisory — an uncovered compliance item may indicate an LLM miss OR may be a legitimate scope cut the human should accept.',
    severity: 'advisory',
    expected,
    actual: expected.filter(id => actual.has(id)),
    missing,
  })];
}

/**
 * Every accepted retention rule is ideally surfaced by at least one
 * workflow — retention is operational, so a workflow is its natural
 * home. Advisory severity: a retention rule without a surfacing
 * workflow may indicate a missing workflow OR may be a legitimate
 * deferred obligation (e.g. manual process the human accepts).
 */
function checkRetentionCoverage(i: CoverageVerifierInputs): CoverageGapContent[] {
  const expected = i.retentionRules.map(r => r.id);
  const actual = new Set<string>();
  for (const w of i.workflows) {
    const surfaced = (w as unknown as { surfaces?: { retention_rules?: string[] } }).surfaces?.retention_rules ?? [];
    surfaced.forEach(id => actual.add(id));
    for (const t of w.triggers) {
      if (t.kind === 'compliance') actual.add(t.regime_id);
    }
  }
  const missing = difference(expected, Array.from(actual));
  if (missing.length === 0) return [];
  return [mkGap({
    check: 'retention_coverage',
    assertion: 'Every accepted retention rule is expected to be surfaced by at least one workflow (via surfaces.retention_rules or a compliance trigger). Advisory — an uncovered retention rule may be a legitimate deferred obligation.',
    severity: 'advisory',
    expected,
    actual: expected.filter(id => actual.has(id)),
    missing,
  })];
}

/**
 * Every accepted integration is ideally surfaced by at least one
 * workflow. Advisory: an uncovered integration may indicate dead
 * weight on the handoff OR may be used only at a downstream phase
 * (e.g. Phase 4 architecture) the human wants to defer to.
 */
function checkIntegrationCoverage(i: CoverageVerifierInputs): CoverageGapContent[] {
  const expected = i.integrations.map(it => it.id);
  const actual = new Set<string>();
  for (const w of i.workflows) {
    const surfaced = (w as unknown as { surfaces?: { integrations?: string[] } }).surfaces?.integrations ?? [];
    surfaced.forEach(id => actual.add(id));
    for (const t of w.triggers) {
      if (t.kind === 'integration') actual.add(t.integration_id);
    }
  }
  const missing = difference(expected, Array.from(actual));
  if (missing.length === 0) return [];
  return [mkGap({
    check: 'integration_coverage',
    assertion: 'Every accepted integration is expected to be surfaced by at least one workflow (via surfaces.integrations or an integration trigger). Advisory — an uncovered integration may be consumed at a downstream phase.',
    severity: 'advisory',
    expected,
    actual: expected.filter(id => actual.has(id)),
    missing,
  })];
}

/**
 * Every V&V requirement is surfaced by at least one journey (for
 * user-visible assertions like confirmation screens) or workflow (for
 * continuous monitoring, latency SLOs, integrity checks). This is the
 * check that ensures V&V wasn't captured in 1.0e only to be forgotten
 * during 1.3's bloom.
 */
function checkVVCoverage(i: CoverageVerifierInputs): CoverageGapContent[] {
  const expected = i.vvRequirements.map(v => v.id);
  const actual = new Set<string>();
  for (const j of i.journeys) {
    const xs = (j as unknown as { surfaces?: { vv_requirements?: string[] } }).surfaces?.vv_requirements ?? [];
    xs.forEach(id => actual.add(id));
  }
  for (const w of i.workflows) {
    const xs = (w as unknown as { surfaces?: { vv_requirements?: string[] } }).surfaces?.vv_requirements ?? [];
    xs.forEach(id => actual.add(id));
  }
  const missing = difference(expected, Array.from(actual));
  if (missing.length === 0) return [];
  return [mkGap({
    check: 'vv_coverage',
    assertion: 'Every accepted V&V requirement is expected to be surfaced by at least one journey or workflow (via surfaces.vv_requirements). Advisory — an uncovered V&V requirement may legitimately be deferred to Phase 2 NFR bloom or Phase 7 test planning.',
    severity: 'advisory',
    expected,
    actual: expected.filter(id => actual.has(id)),
    missing,
  })];
}

/**
 * Referential integrity across 1.3a + 1.3b output:
 *   - every journey.personaId resolves to an accepted persona
 *   - every journey step's actor resolves to a persona, "System", or an integration
 *   - every journey.businessDomainIds resolve to accepted domains
 *   - every workflow.businessDomainId resolves to an accepted domain
 *   - every workflow trigger resolves:
 *       journey_step → (journey_id, step_number) points at a real step
 *       compliance  → regime_id is an accepted compliance item
 *       integration → integration_id is an accepted integration
 *   - every workflow step's actor resolves
 *   - every workflow.backs_journeys entry matches the distinct journey_ids in its triggers
 *   - every id in any surfaces[] array resolves to an accepted item
 *
 * Single gap per category keeps the blast radius small if a pattern of
 * bad references shows up — the human sees one gap per category rather
 * than a flood of one-gap-per-offender.
 */
/** Surfaces block shared by journeys and workflows (structurally cast). */
type SurfacesShape = {
  compliance_regimes?: string[];
  retention_rules?: string[];
  vv_requirements?: string[];
  integrations?: string[];
};

/** Pre-computed accepted-id lookup sets for referential-integrity checks. */
interface RefIntegrityCtx {
  personaIds: Set<string>;
  domainIds: Set<string>;
  integrationIds: Set<string>;
  complianceIds: Set<string>;
  retentionIds: Set<string>;
  vvIds: Set<string>;
  vocabularyIds: Set<string>;
  journeyByIdAndStep: Map<string, UserJourney>;
}

function buildRefIntegrityCtx(i: CoverageVerifierInputs): RefIntegrityCtx {
  const journeyByIdAndStep = new Map<string, UserJourney>();
  for (const j of i.journeys) journeyByIdAndStep.set(j.id, j);
  return {
    personaIds: new Set(i.personas.map(p => p.id)),
    domainIds: new Set(i.domainIds),
    integrationIds: new Set(i.integrations.map(it => it.id)),
    complianceIds: new Set(i.complianceItems.map(c => c.id)),
    retentionIds: new Set(i.retentionRules.map(r => r.id)),
    vvIds: new Set(i.vvRequirements.map(v => v.id)),
    vocabularyIds: new Set(i.vocabulary.map(v => v.id)),
    journeyByIdAndStep,
  };
}

/** Structural read of the (untyped) businessDomainIds field on a journey. */
function readBusinessDomainIds(j: UserJourney): string[] {
  return (j as unknown as { businessDomainIds?: string[] }).businessDomainIds ?? [];
}

/** Structural read of the (untyped) surfaces block on a journey or workflow. */
function readSurfaces(item: UserJourney | WorkflowV2): SurfacesShape | undefined {
  return (item as unknown as { surfaces?: SurfacesShape }).surfaces;
}

/**
 * Offenders for a single step's actor. An actor is valid when it is the
 * literal "System", a `P-` id that resolves to an accepted persona, or an
 * `INT-` id that resolves to an accepted integration. Preserves the
 * original two-`if` structure (a malformed id could in principle match
 * neither prefix and produce no offender).
 */
function badActorRefs(
  ownerId: string,
  stepNumber: number,
  actor: string,
  personaIds: Set<string>,
  integrationIds: Set<string>,
): string[] {
  if (actor === 'System') return [];
  const out: string[] = [];
  if (actor.startsWith('P-') && !personaIds.has(actor)) out.push(`${ownerId}#${stepNumber}:${actor}`);
  if (actor.startsWith('INT-') && !integrationIds.has(actor)) out.push(`${ownerId}#${stepNumber}:${actor}`);
  return out;
}

/**
 * Offenders for a single owner's surfaces block. Emits in the fixed order
 * compliance → retention → vv → integration, matching the original loop.
 * A retention id is valid if it resolves to an accepted retention rule OR
 * an accepted compliance item.
 */
function badSurfaceRefs(ownerId: string, surfaces: SurfacesShape | undefined, ctx: RefIntegrityCtx): string[] {
  if (!surfaces) return [];
  const out: string[] = [];
  for (const id of surfaces.compliance_regimes ?? []) if (!ctx.complianceIds.has(id)) out.push(`${ownerId}:compliance:${id}`);
  for (const id of surfaces.retention_rules ?? []) if (!ctx.retentionIds.has(id) && !ctx.complianceIds.has(id)) out.push(`${ownerId}:retention:${id}`);
  for (const id of surfaces.vv_requirements ?? []) if (!ctx.vvIds.has(id)) out.push(`${ownerId}:vv:${id}`);
  for (const id of surfaces.integrations ?? []) if (!ctx.integrationIds.has(id)) out.push(`${ownerId}:integration:${id}`);
  return out;
}

function collectBadJourneyPersonas(journeys: UserJourney[], personaIds: Set<string>): string[] {
  const out: string[] = [];
  for (const j of journeys) if (!personaIds.has(j.personaId)) out.push(`${j.id}:${j.personaId}`);
  return out;
}

function collectBadJourneyDomains(journeys: UserJourney[], domainIds: Set<string>): string[] {
  const out: string[] = [];
  for (const j of journeys) {
    for (const d of readBusinessDomainIds(j)) if (!domainIds.has(d)) out.push(`${j.id}:${d}`);
  }
  return out;
}

function collectBadJourneyStepActors(journeys: UserJourney[], personaIds: Set<string>, integrationIds: Set<string>): string[] {
  const out: string[] = [];
  for (const j of journeys) {
    for (const s of j.steps) out.push(...badActorRefs(j.id, s.stepNumber, s.actor, personaIds, integrationIds));
  }
  return out;
}

function collectBadJourneySurfaces(journeys: UserJourney[], ctx: RefIntegrityCtx): string[] {
  const out: string[] = [];
  for (const j of journeys) out.push(...badSurfaceRefs(j.id, readSurfaces(j), ctx));
  return out;
}

function collectBadWorkflowDomains(workflows: WorkflowV2[], domainIds: Set<string>): string[] {
  const out: string[] = [];
  for (const w of workflows) if (!domainIds.has(w.businessDomainId)) out.push(`${w.id}:${w.businessDomainId}`);
  return out;
}

function collectBadWorkflowTriggers(workflows: WorkflowV2[], ctx: RefIntegrityCtx): string[] {
  const out: string[] = [];
  for (const w of workflows) {
    for (const t of w.triggers) {
      const bad = triggerIsInvalid(t, ctx);
      if (bad) out.push(`${w.id}:${bad}`);
    }
  }
  return out;
}

function collectBadWorkflowStepActors(workflows: WorkflowV2[], personaIds: Set<string>, integrationIds: Set<string>): string[] {
  const out: string[] = [];
  for (const w of workflows) {
    for (const s of w.steps) out.push(...badActorRefs(w.id, s.stepNumber, s.actor, personaIds, integrationIds));
  }
  return out;
}

function collectBadWorkflowSurfaces(workflows: WorkflowV2[], ctx: RefIntegrityCtx): string[] {
  const out: string[] = [];
  for (const w of workflows) out.push(...badSurfaceRefs(w.id, readSurfaces(w), ctx));
  return out;
}

/**
 * Offenders for one workflow's backs_journeys cache. `backs_journeys` must
 * equal the distinct set of journey_ids across its `journey_step` triggers;
 * missing entries are emitted before extras (matching the original order).
 */
function backsJourneysOffenders(w: WorkflowV2): string[] {
  const derived = new Set<string>();
  for (const t of w.triggers) if (t.kind === 'journey_step') derived.add(t.journey_id);
  const declared = new Set(w.backs_journeys ?? []);
  const out: string[] = [];
  for (const id of derived) if (!declared.has(id)) out.push(`${w.id}:missing-in-backs_journeys:${id}`);
  for (const id of declared) if (!derived.has(id)) out.push(`${w.id}:extra-in-backs_journeys:${id}`);
  return out;
}

function collectBadBacksJourneys(workflows: WorkflowV2[]): string[] {
  const out: string[] = [];
  for (const w of workflows) out.push(...backsJourneysOffenders(w));
  return out;
}

/** Push a single blocking referential-integrity gap when offenders exist. */
function pushGapIfOffenders(gaps: CoverageGapContent[], check: string, assertion: string, offenders: string[]): void {
  if (offenders.length === 0) return;
  gaps.push(mkGap({
    check,
    assertion,
    severity: 'blocking',
    expected: [],
    actual: [],
    missing: offenders,
  }));
}

function checkReferentialIntegrity(i: CoverageVerifierInputs): CoverageGapContent[] {
  const ctx = buildRefIntegrityCtx(i);
  const gaps: CoverageGapContent[] = [];

  // Journey references.
  pushGapIfOffenders(
    gaps,
    'referential_integrity_journey_persona',
    'Every journey.personaId must reference an accepted persona.',
    collectBadJourneyPersonas(i.journeys, ctx.personaIds),
  );
  pushGapIfOffenders(
    gaps,
    'referential_integrity_journey_domain',
    'Every journey.businessDomainIds entry must reference an accepted domain.',
    collectBadJourneyDomains(i.journeys, ctx.domainIds),
  );
  pushGapIfOffenders(
    gaps,
    'referential_integrity_journey_step_actor',
    'Every journey step actor must be a persona id, an integration id, or the literal "System".',
    collectBadJourneyStepActors(i.journeys, ctx.personaIds, ctx.integrationIds),
  );

  // Journey surfaces.
  pushGapIfOffenders(
    gaps,
    'referential_integrity_journey_surfaces',
    'Every journey.surfaces[] id must reference an accepted item of the corresponding type.',
    collectBadJourneySurfaces(i.journeys, ctx),
  );

  // Workflow references.
  pushGapIfOffenders(
    gaps,
    'referential_integrity_workflow_domain',
    'Every workflow.businessDomainId must reference an accepted domain.',
    collectBadWorkflowDomains(i.workflows, ctx.domainIds),
  );
  pushGapIfOffenders(
    gaps,
    'referential_integrity_workflow_triggers',
    'Every workflow trigger must resolve: journey_step -> real (journey, step); compliance -> accepted regime; integration -> accepted integration.',
    collectBadWorkflowTriggers(i.workflows, ctx),
  );
  pushGapIfOffenders(
    gaps,
    'referential_integrity_workflow_step_actor',
    'Every workflow step actor must be a persona id, an integration id, or the literal "System".',
    collectBadWorkflowStepActors(i.workflows, ctx.personaIds, ctx.integrationIds),
  );
  pushGapIfOffenders(
    gaps,
    'referential_integrity_workflow_surfaces',
    'Every workflow.surfaces[] id must reference an accepted item of the corresponding type.',
    collectBadWorkflowSurfaces(i.workflows, ctx),
  );
  pushGapIfOffenders(
    gaps,
    'referential_integrity_backs_journeys',
    'workflow.backs_journeys[] must equal the distinct journey_id set across kind:journey_step triggers.',
    collectBadBacksJourneys(i.workflows),
  );

  // Used-but-not-referenced vocabulary is not a gap in 1.3c — vocabulary
  // coverage is checked via the release manifest in 1.8 (every VOC-*
  // must appear in some release or cross_cutting). Kept here as a no-op
  // so the shape of the check is obvious on future schema changes.
  void ctx.vocabularyIds;

  return gaps;
}

function triggerIsInvalid(
  t: WorkflowTrigger,
  ctx: {
    journeyByIdAndStep: Map<string, UserJourney>;
    complianceIds: Set<string>;
    integrationIds: Set<string>;
  },
): string | null {
  if (t.kind === 'journey_step') {
    const j = ctx.journeyByIdAndStep.get(t.journey_id);
    if (!j) return `journey_step:${t.journey_id}#${t.step_number}:journey-not-accepted`;
    const stepExists = j.steps.some(s => s.stepNumber === t.step_number);
    if (!stepExists) return `journey_step:${t.journey_id}#${t.step_number}:step-missing`;
    // Note: we do NOT require step.automatable === true here. Automatable
    // is emergent — when a workflow backs a step, that step IS automatable
    // by definition, regardless of whether 1.3a flagged it. This matches
    // the natural information flow (1.3b knows what it needs to back).
    return null;
  }
  if (t.kind === 'compliance') {
    if (!ctx.complianceIds.has(t.regime_id)) return `compliance:${t.regime_id}:regime-not-accepted`;
    return null;
  }
  if (t.kind === 'integration') {
    if (!ctx.integrationIds.has(t.integration_id)) return `integration:${t.integration_id}:integration-not-accepted`;
    return null;
  }
  // schedule + event have no referential integrity to check (they name
  // implementation-local things).
  return null;
}

// ── Entry point ────────────────────────────────────────────────────

/**
 * Run all 1.3c coverage checks. Returns a (possibly empty) list of
 * gaps; caller persists each as a `coverage_gap` governed-stream
 * record and routes to MMP for resolution.
 */
export function verifyCoverage(i: CoverageVerifierInputs): CoverageVerifierResult {
  return [
    ...checkPersonaCoverage(i),
    ...checkDomainCoverage(i),
    ...checkAutomatableStepBacking(i),
    ...checkComplianceCoverage(i),
    ...checkRetentionCoverage(i),
    ...checkIntegrationCoverage(i),
    ...checkVVCoverage(i),
    ...checkReferentialIntegrity(i),
  ];
}
