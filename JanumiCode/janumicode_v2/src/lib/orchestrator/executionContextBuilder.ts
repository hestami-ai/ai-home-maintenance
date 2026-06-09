/**
 * Execution Context Builder - builds context payloads for Phase 9 execution tasks.
 * Based on JanumiCode Spec v2.3, §4 Phase 9 and §7.2-7.3.
 *
 * Assembles execution-specific context from:
 *   - Implementation Plan (Phase 6)
 *   - Test Plan (Phase 7)
 *   - Evaluation Plans (Phase 8)
 *   - Component Model (Phase 4)
 *   - Technical Specs (Phase 5)
 *   - Architectural Decisions (Phase 4)
 *
 * Refactor (cal-23): the stdin assembly is now driven by the
 * `implementation_task_execution.system.md` template via TemplateLoader,
 * matching the render pipeline used by phases 1-8. The helpers in this
 * file produce single template-variable strings; the template owns the
 * section ordering and headings.
 */

import { ContextBuilder, type StdinContent, type DetailFileContent, type ContextPayload } from './contextBuilder';
import type { GovernedStreamWriter } from './governedStreamWriter';
import type { Database } from '../database/init';
import type { TemplateLoader } from './templateLoader';
import { normalizeWorkspacePath } from './phases/phase6';
import { getLogger } from '../logging';
import type { ReasoningReviewFindingRecordContent, ImplementationPacketContent } from '../types/records';

// Re-export types from contextBuilder for convenience
export type { StdinContent, DetailFileContent, ContextPayload };

// Execution-specific types

export interface ImplementationTask {
  id: string;
  task_type: 'standard' | 'refactoring';
  component_id: string;
  component_responsibility: string;
  description: string;
  /** Legacy slot retained for backward compat. Phase 6's emitted shape
   *  uses `traces_to` instead — both are merged at lineage-walk time. */
  technical_spec_ids?: string[];
  /** The canonical lineage field Phase 6's implementation_planner emits:
   *  an array of upstream identifiers (SR ids, FR ids, NFR ids, component
   *  ids) that the task satisfies. Used by lineage-aware filtering and
   *  upstream-findings walks in Phase 9. */
  traces_to?: string[];
  dependency_task_ids?: string[];
  estimated_complexity: 'low' | 'medium' | 'high';
  complexity_flag?: string;
  /** Technical-constraint ids (TECH-*) scoped to this task — the executor's
   *  binding constraints (full text rendered in the packet's Technical
   *  Constraints block). Distinct from the workflow's process governance. */
  active_constraints?: string[];
  completion_criteria: CompletionCriterion[];
  write_directory_paths?: string[];
  read_directory_paths?: string[];
  /** Set on records derived from upstream artifacts (FRs, NFRs, etc).
   *  Phase 6's emitted tasks don't carry this — use `traces_to` instead
   *  for task-level lineage. Retained for any caller that does set it. */
  derived_from_record_ids?: string[];
  // Refactoring task fields
  expected_pre_state_hash?: string;
  verification_step?: string;
  /** Pre-rendered refactoring directive (old/new def + member diff + files),
   *  surfaced verbatim by formatRefactoringConstraints. */
  refactoring_instructions?: string;
}

export interface CompletionCriterion {
  criterion_id: string;
  description: string;
  verification_method: 'schema_check' | 'invariant' | 'output_comparison' | 'test_execution';
  artifact_ref?: string;
  /** Packet test_case_id(s) covering this criterion (from packet synthesis). */
  covered_by_test_ids?: string[];
}

export interface TestCase {
  test_case_id: string;
  type: 'unit' | 'integration' | 'end_to_end';
  acceptance_criterion_ids: string[];
  component_ids?: string[];
  preconditions: string[];
  inputs?: Record<string, unknown>;
  execution_steps?: string[];
  expected_outcome: string;
  edge_cases?: string[];
  implementation_notes?: string;
}

export interface TestSuite {
  suite_id: string;
  component_id: string;
  test_type: 'unit' | 'integration' | 'end_to_end';
  runner_command?: string;
  test_cases: TestCase[];
}

export interface TestPlan {
  test_suites: TestSuite[];
  total_test_cases?: number;
  coverage_by_type?: { unit: number; integration: number; end_to_end: number };
}

export interface FunctionalEvalCriterion {
  functional_requirement_id: string;
  evaluation_method: string;
  success_condition: string;
}

export interface QualityEvalCriterion {
  nfr_id: string;
  category: string;
  evaluation_tool: string;
  threshold: string;
  measurement_method: string;
  fallback_if_tool_unavailable?: string;
}

export interface ReasoningScenario {
  id: string;
  description: string;
  pass_criteria: string;
}

export interface EvaluationPlans {
  functional?: { criteria: FunctionalEvalCriterion[] };
  quality?: { criteria: QualityEvalCriterion[] };
  reasoning?: { scenarios: ReasoningScenario[]; ai_subsystems_detected: boolean };
}

export interface ExecutionContextOptions {
  stdinMaxTokens: number;
  detailFileMaxBytes: number;
  detailFilePathTemplate: string;
  workspacePath: string;
  janumiCodeVersionSha: string;
  /** Active constraints text (project stack / governance). Optional;
   *  resolves to an empty placeholder if the caller didn't surface them. */
  activeConstraints?: string;
}

// Artifact content types for extraction

interface ArtifactContent {
  kind: string;
  [key: string]: unknown;
}

// ── Variable-render helpers ────────────────────────────────────────

/** Cap for upstream-finding count to keep prompt size reasonable. */
const UPSTREAM_FINDINGS_CAP = 30;

const EMPTY_TEST_CASES_FALLBACK =
  '(no test cases registered for this component — implement self-verifying tests from completion criteria)';
const EMPTY_UPSTREAM_FINDINGS_FALLBACK =
  '(no HIGH/MEDIUM upstream validator findings against motivating artifacts)';

function formatImplementationTaskHeader(task: ImplementationTask): string {
  return `${task.id} — ${task.description}`;
}

function formatComponentContext(
  task: ImplementationTask,
  componentModel: { components: Array<{ id: string; name: string; responsibility?: string; responsibilities?: Array<{ id?: string; statement?: string }> }> } | null,
): string {
  const component = componentModel ? lookupComponent(task.component_id, componentModel) : undefined;
  if (!component) {
    return `Component: ${task.component_id}\nResponsibility: ${task.component_responsibility}`;
  }
  // Component model emits `responsibilities[]` (plural) per Phase 4 schema.
  // The legacy `.responsibility` singular field was never produced; reading
  // it gave us `Responsibility: undefined` in every packet. Join the
  // statements when the plural array is present; fall back to the legacy
  // singular only if a caller wired it that way.
  const responsibilityText = Array.isArray(component.responsibilities) && component.responsibilities.length > 0
    ? component.responsibilities.map((r) => r.statement ?? '').filter(Boolean).join('; ')
    : (component.responsibility ?? task.component_responsibility);
  return `Name: ${component.name} (${component.id})\nResponsibility: ${responsibilityText}`;
}

function formatCompletionCriteria(criteria: CompletionCriterion[]): string {
  if (!criteria.length) return '(none specified)';
  const body = criteria.map((c, i) => {
    const verification = c.artifact_ref
      ? `${c.verification_method} (ref: ${c.artifact_ref})`
      : c.verification_method;
    // Make completion criteria the authoritative test gate. When packet
    // synthesis bound covering tests, name them; when none, the executor must
    // author one — do NOT rely on an incidentally-listed component test (it may
    // belong to a sibling task and verify different behavior).
    let testLine = '';
    if (c.verification_method === 'test_execution') {
      testLine = (c.covered_by_test_ids && c.covered_by_test_ids.length > 0)
        ? `\n   Covering test(s): ${c.covered_by_test_ids.join(', ')} — make these assert this criterion and pass.`
        : `\n   No pre-written test — you MUST author a test that asserts this criterion.`;
    }
    return `${i + 1}. [${c.criterion_id}] ${c.description}\n   Verification: ${verification}${testLine}`;
  }).join('\n');
  return `These completion criteria are the AUTHORITATIVE pass/fail gate for this task — passing the listed component test cases is neither necessary nor sufficient if it does not satisfy these.\n\n${body}`;
}

function formatWriteScopeConstraints(task: ImplementationTask, protectedPaths?: string[]): string {
  const denySection = (protectedPaths && protectedPaths.length)
    ? '\n\nNEVER create or modify these scaffold-owned paths (import from them instead — '
      + 'writing here is rejected and the task is retried):\n'
      + protectedPaths.map(p => `- ${p}`).join('\n')
    : '';
  if (!task.write_directory_paths?.length) {
    return '(no write scope declared — clarify before writing anything)' + denySection;
  }
  // Defensive normalize: legacy DBs persist absolute paths like
  // `/opt/hestami/PROP/...`. Strip system-root prefixes so Phase 9
  // resolves them against workspacePath consistently.
  const normalized = task.write_directory_paths.map(p => normalizeWorkspacePath(p));
  return 'Files may ONLY be created/modified in:\n' +
    normalized.map(p => `- ${p}`).join('\n') + denySection;
}

/**
 * Lever 2b — render the "import the shared modules, do NOT reinvent them"
 * directive from the scaffold manifest. Lists the canonical shared files and
 * the pinned project conventions (module system, test command). Empty string
 * when no scaffold is present so the template variable degrades gracefully.
 */
function formatSharedModuleConstraints(scaffold?: {
  conventions: string;
  sharedDir: string;
  canonicalFiles: string[];
} | null): string {
  if (!scaffold) return '(no shared scaffold for this run)';
  const lines: string[] = [];
  lines.push('A canonical project scaffold already exists. CONFORM to it:');
  lines.push('');
  lines.push(scaffold.conventions);
  if (scaffold.canonicalFiles.length) {
    lines.push('');
    lines.push('Canonical shared files (import these — do NOT redefine types, models, contracts, or config):');
    for (const f of scaffold.canonicalFiles) lines.push(`- ${f}`);
  }
  lines.push('');
  lines.push('Do NOT create another package.json/lockfile, your own copy of a shared '
    + 'module, or a divergent module system. Reuse the shared modules above.');
  return lines.join('\n');
}

interface ExtractedADR { id: string; title: string; decision: string; governs_components?: string[] }

function formatADRs(adrs: ExtractedADR[]): string {
  if (!adrs.length) return '(no architectural decisions recorded)';
  return adrs.map(adr => `### ${adr.id}: ${adr.title}\n${adr.decision}`).join('\n\n');
}

/**
 * Keep only the ADRs that govern THIS task's component, plus global/cross-cutting
 * ADRs (those with no `governs_components` list). Structural — uses the Phase-4
 * `governs_components` edges, never keyword matching on ADR text. Without this, a
 * 2-line AES task received all ~10 ADRs incl. "PDF Report Generation" as
 * "apply without exception" (Phase-9 prompt review).
 */
function filterADRsForTask(adrs: ExtractedADR[], componentId: string | undefined): ExtractedADR[] {
  if (!componentId) return adrs;
  return adrs.filter((adr) =>
    !adr.governs_components || adr.governs_components.length === 0 || adr.governs_components.includes(componentId),
  );
}

function formatRefactoringConstraints(task: ImplementationTask): string {
  if (task.task_type !== 'refactoring') return '(not applicable — standard implementation task)';

  // The substantive directive (old/new definition, member diff, target files),
  // pre-resolved by Phase 0.5 — this is what makes the refactor actionable.
  const instructions = task.refactoring_instructions?.trim();

  // Idempotency protocol. A refactoring task may legitimately have no recorded
  // pre-state hash (the prior-run file was absent when the scope was built); in
  // that case skip the hash gate but still deliver the instructions.
  const idempotency = task.expected_pre_state_hash
    ? `Expected pre-state hash: ${task.expected_pre_state_hash}\n` +
      `Verification step: ${task.verification_step ?? 'Not specified'}\n` +
      `If the target file's current hash matches the expected pre-state hash, the refactor is already applied — skip and report.`
    : `No pre-state hash recorded (the prior-run file was not resolvable when this task was created). Apply the change described above; do not assume it is already applied.`;

  return instructions ? `${instructions}\n\n### Idempotency\n${idempotency}` : idempotency;
}

function formatTestCasesForComponent(testPlan: TestPlan | null, componentId: string): string {
  if (!testPlan?.test_suites?.length) return EMPTY_TEST_CASES_FALLBACK;
  const relevantSuites = testPlan.test_suites.filter(s => componentIdMatches(s.component_id, componentId));
  if (relevantSuites.length === 0) return EMPTY_TEST_CASES_FALLBACK;
  return relevantSuites.map(suite => {
    const cases = suite.test_cases.map(tc =>
      `- [${tc.test_case_id}] (${tc.type}) ${tc.expected_outcome}`,
    ).join('\n') || '(suite registered but emitted no cases)';
    return `### Test Suite: ${suite.suite_id}\nType: ${suite.test_type}\n${cases}`;
  }).join('\n\n');
}

function formatDependencyTasks(
  task: ImplementationTask,
  implementationPlan: ImplementationTask[] | null,
): string {
  if (!task.dependency_task_ids?.length || !implementationPlan) return '(no dependency tasks)';
  const deps = implementationPlan.filter(t => task.dependency_task_ids?.includes(t.id));
  if (!deps.length) return '(declared dependencies not found in plan)';
  return deps.map(d => `- [${d.id}] ${d.description}`).join('\n');
}

// ── Relevance filtering for evaluation criteria ────────────────────

export interface FilteredEvalResult {
  rendered: string;
  filteredFunctional: number;
  filteredQuality: number;
  filteredReasoning: number;
  keptFunctional: number;
  keptQuality: number;
  keptReasoning: number;
  /** Task-scoped criteria objects (for the detail-file bundle). */
  keptCriteria: EvaluationPlans;
}

/**
 * Filter eval criteria by trace from FR/NFR id back to the task's
 * component_id. The implementation_plan / component_model lineage isn't
 * always populated; when the lineage data is missing we keep all
 * entries (coverage > precision when uncertain).
 */
export function filterEvalCriteriaForTask(
  plans: EvaluationPlans,
  task: ImplementationTask,
  componentModel: { components: Array<{ id: string; name: string; responsibility: string }> } | null,
  implementationPlan: ImplementationTask[] | null,
): FilteredEvalResult {
  // Compute the set of FR/NFR identifiers that trace to this component.
  // Walks implementation_plan tasks that share the component_id and
  // collects every technical_spec_id / criterion_id mentioned. Without
  // a lineage table this is a heuristic; when unknown we fall back to
  // "keep all".
  const initialRelated = collectRelatedIdentifiers(task, componentModel, implementationPlan);
  const componentToken = task.component_id;

  // Provisionally compute kept counts with the initial lineage. If the
  // filter would drop everything despite having lineage data, it almost
  // always means the lineage tokens (file paths, internal ids) don't
  // share a namespace with the eval criteria's FR/NFR ids — fall back
  // to "keep all" rather than starving the agent of context entirely.
  // The coverage > precision rule applies here just as it does when
  // lineage data is absent.
  const totalAll = (plans.functional?.criteria?.length ?? 0)
    + (plans.quality?.criteria?.length ?? 0)
    + (plans.reasoning?.scenarios?.length ?? 0);

  let relatedIdentifiers: Set<string> | null = initialRelated;
  let lineageEmptyMatch = false;
  if (initialRelated !== null && totalAll > 0) {
    const narrowed = initialRelated;
    const provisionalKept = (plans.functional?.criteria ?? []).filter(c => idMatches(c.functional_requirement_id, narrowed, componentToken)).length
      + (plans.quality?.criteria ?? []).filter(c => idMatches(c.nfr_id, narrowed, componentToken)).length
      + (plans.reasoning?.scenarios ?? []).filter(s => s.description.includes(componentToken)
          || idMatches(s.id, narrowed, componentToken)
          || [...narrowed].some(id => s.description.includes(id))).length;
    if (provisionalKept === 0) {
      // Treat lineage-present-but-zero-matches as lineage-effectively-missing.
      relatedIdentifiers = null;
      lineageEmptyMatch = true;
    }
  }

  let kf = 0, fq = 0, kq = 0, fqq = 0, kr = 0, fr = 0;
  let keptFunctionalCriteria: FunctionalEvalCriterion[] = [];
  let keptQualityCriteria: QualityEvalCriterion[] = [];
  let keptReasoningScenarios: ReasoningScenario[] = [];

  const sections: string[] = [];

  const effectiveRelated = relatedIdentifiers;

  if (plans.functional?.criteria?.length) {
    const all = plans.functional.criteria;
    const kept = effectiveRelated === null
      ? all
      : all.filter(c => idMatches(c.functional_requirement_id, effectiveRelated, componentToken));
    keptFunctionalCriteria = kept;
    kf = kept.length; fq = all.length - kept.length;
    if (kept.length) {
      sections.push('### Functional Criteria\n' + kept.map(c =>
        `- [${c.functional_requirement_id}] ${c.evaluation_method}: ${c.success_condition}`,
      ).join('\n'));
    }
  }

  if (plans.quality?.criteria?.length) {
    const all = plans.quality.criteria;
    const kept = effectiveRelated === null
      ? all
      : all.filter(c => idMatches(c.nfr_id, effectiveRelated, componentToken));
    keptQualityCriteria = kept;
    kq = kept.length; fqq = all.length - kept.length;
    if (kept.length) {
      sections.push('### Quality Criteria\n' + kept.map(c =>
        `- [${c.nfr_id}] ${c.category}: ${c.threshold} via ${c.evaluation_tool}`,
      ).join('\n'));
    }
  }

  if (plans.reasoning?.scenarios?.length) {
    const all = plans.reasoning.scenarios;
    const kept = effectiveRelated === null
      ? all
      : all.filter(s =>
        s.description.includes(componentToken)
        || idMatches(s.id, effectiveRelated, componentToken)
        || [...effectiveRelated].some(id => s.description.includes(id)),
      );
    keptReasoningScenarios = kept;
    kr = kept.length; fr = all.length - kept.length;
    if (kept.length) {
      sections.push('### Reasoning Scenarios\n' + kept.map(s =>
        `- [${s.id}] ${s.description} (pass: ${s.pass_criteria})`,
      ).join('\n'));
    }
  }

  const totalFiltered = fq + fqq + fr;

  let rendered = sections.length ? sections.join('\n\n') : '(no evaluation criteria registered)';
  if (totalAll > 0) {
    let suffix = '';
    if (lineageEmptyMatch) suffix = ' (lineage tokens did not match any eval criterion id — kept all as fallback)';
    else if (relatedIdentifiers === null) suffix = ' (lineage data missing — kept all as fallback)';
    rendered = `RELEVANCE FILTER NOTE: kept ${kf + kq + kr} of ${totalAll} eval criteria; ` +
      `filtered ${totalFiltered} as unrelated to component ${componentToken}` +
      suffix +
      `.\n\n` + rendered;
  }

  return { rendered, filteredFunctional: fq, filteredQuality: fqq, filteredReasoning: fr,
    keptFunctional: kf, keptQuality: kq, keptReasoning: kr,
    // The task-scoped criteria objects — used by the detail-file bundle so it
    // carries only this task's evals, not the full plan.
    keptCriteria: {
      functional: { criteria: keptFunctionalCriteria },
      quality: { criteria: keptQualityCriteria },
      reasoning: { scenarios: keptReasoningScenarios, ai_subsystems_detected: plans.reasoning?.ai_subsystems_detected ?? false },
    } as EvaluationPlans };
}

function idMatches(id: string, related: Set<string>, componentToken: string): boolean {
  if (!id) return true;
  if (related.has(id)) return true;
  if (id.includes(componentToken)) return true;
  return false;
}

/**
 * Returns the set of FR/NFR/related ids that map to the task's
 * component, or `null` to signal "lineage unknown, keep all".
 */
function collectRelatedIdentifiers(
  task: ImplementationTask,
  componentModel: { components: Array<{ id: string; name: string; responsibility: string }> } | null,
  implementationPlan: ImplementationTask[] | null,
): Set<string> | null {
  const ids = new Set<string>();
  let sawLineage = false;

  // Primary lineage source: Phase 6's `traces_to`. Legacy
  // `technical_spec_ids` slot is also folded in for callers that
  // populate it directly.
  const taskLineage = [...(task.traces_to ?? []), ...(task.technical_spec_ids ?? [])];
  if (taskLineage.length) {
    sawLineage = true;
    for (const sid of taskLineage) ids.add(sid);
  }
  for (const c of task.completion_criteria) {
    if (c.artifact_ref) { sawLineage = true; ids.add(c.artifact_ref); }
  }
  if (implementationPlan) {
    for (const t of implementationPlan) {
      if (componentIdMatches(t.component_id, task.component_id)) {
        const peerLineage = [...(t.traces_to ?? []), ...(t.technical_spec_ids ?? [])];
        for (const sid of peerLineage) { sawLineage = true; ids.add(sid); }
        for (const c of t.completion_criteria) {
          if (c.artifact_ref) { sawLineage = true; ids.add(c.artifact_ref); }
        }
      }
    }
  }
  if (componentModel) {
    // Component itself: id and name can serve as match tokens.
    const comp = lookupComponent(task.component_id, componentModel);
    if (comp) ids.add(comp.id);
  }
  return sawLineage ? ids : null;
}

/**
 * Defensive component-id matching: Phase 6's implementation_planner has
 * historically prepended `comp-` to component ids (the prompt's worked
 * examples show `comp-auth-middleware` etc.), while Phase 4's
 * component_model and Phase 7's test_plan emit the bare slug. Match
 * either way so the prefix mismatch doesn't poison lineage walks.
 */
function componentIdMatches(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const stripA = a.startsWith('comp-') ? a.slice(5) : a;
  const stripB = b.startsWith('comp-') ? b.slice(5) : b;
  return stripA === stripB;
}

/**
 * Look up a component in the component_model honoring the same
 * comp-prefix tolerance as `componentIdMatches`.
 */
function lookupComponent(
  taskComponentId: string,
  componentModel: { components: Array<{ id: string; name: string; responsibility?: string; responsibilities?: Array<{ id?: string; statement?: string }> }> },
): { id: string; name: string; responsibility?: string; responsibilities?: Array<{ id?: string; statement?: string }> } | undefined {
  return componentModel.components.find(c => componentIdMatches(c.id, taskComponentId));
}

// ── Upstream validator findings threading ──────────────────────────

/**
 * Walk task.derived_from_record_ids back to upstream artifacts (FR
 * blooms, NFR blooms, component skeletons, ADRs), then collect
 * HIGH/MEDIUM reasoning_review_finding_record entries whose
 * `derived_from_record_ids` cite those artifacts. Returns a formatted
 * string capped at UPSTREAM_FINDINGS_CAP entries.
 */
export function findUpstreamFindingsForTask(
  task: ImplementationTask,
  writer: GovernedStreamWriter,
  workflowRunId: string,
): string {
  let allFindings: Array<{ id: string; content: ReasoningReviewFindingRecordContent; sourceIds: string[] }>;
  try {
    const records = writer.getRecordsByType(workflowRunId, 'reasoning_review_finding_record');
    allFindings = records.map(r => ({
      id: r.id,
      content: r.content as unknown as ReasoningReviewFindingRecordContent,
      sourceIds: r.derived_from_record_ids ?? [],
    }));
  } catch (err) {
    getLogger().warn('workflow', 'findUpstreamFindingsForTask: failed to load findings', {
      error: err instanceof Error ? err.message : String(err),
    });
    return EMPTY_UPSTREAM_FINDINGS_FALLBACK;
  }

  if (!allFindings.length) return EMPTY_UPSTREAM_FINDINGS_FALLBACK;

  // Resolve the set of motivating artifact ids by walking the task's
  // declared lineage one hop. (A multi-hop walk would require iterating
  // the full governed stream; one hop catches the bloom / spec / ADR
  // records that Phase 6.1 typically cites.)
  //
  // Phase 6's emitted tasks use `traces_to` as the canonical lineage
  // field; `derived_from_record_ids` is retained for any caller that
  // populates it explicitly. Union both so we don't miss either.
  const motivatingIds = new Set<string>([
    ...(task.traces_to ?? []),
    ...(task.derived_from_record_ids ?? []),
  ]);

  const matched = allFindings.filter(f => {
    const severity = f.content.severity;
    if (severity !== 'HIGH' && severity !== 'MEDIUM') return false;
    if (motivatingIds.size === 0) return false;
    return f.sourceIds.some(sid => motivatingIds.has(sid));
  });

  if (!matched.length) return EMPTY_UPSTREAM_FINDINGS_FALLBACK;

  const capped = matched.slice(0, UPSTREAM_FINDINGS_CAP);
  const lines = capped.map(f => {
    const c = f.content;
    const sourceCite = f.sourceIds.length ? f.sourceIds[0] : '(unknown)';
    return `- [${c.severity}] ${c.validator_id} :: ${c.finding_type} — ${c.summary} ` +
      `(source: ${sourceCite}; location: ${c.location})`;
  });
  const header = matched.length > UPSTREAM_FINDINGS_CAP
    ? `(showing ${UPSTREAM_FINDINGS_CAP} of ${matched.length} HIGH/MEDIUM findings)\n`
    : '';
  return header + lines.join('\n');
}

/**
 * Execution Context Builder
 *
 * Builds context payloads specifically for Phase 9 implementation tasks.
 * Uses TemplateLoader to render the prompt body and the base
 * ContextBuilder for token-budget management of the assembled stdin.
 */
export class ExecutionContextBuilder {
  private readonly baseBuilder: ContextBuilder;

  constructor(
    private readonly db: Database,
    private readonly writer: GovernedStreamWriter,
    private readonly options: ExecutionContextOptions,
    /** Optional — when omitted, falls back to hardcoded inline assembly.
     *  The fallback preserves backward compatibility with older callers
     *  (tests, calibration shims) that haven't been updated to pass a
     *  loader yet. Production wiring (phase9.ts) supplies one. */
    private readonly templateLoader?: TemplateLoader,
  ) {
    this.baseBuilder = new ContextBuilder({
      stdinMaxTokens: options.stdinMaxTokens,
      detailFileMaxBytes: options.detailFileMaxBytes,
      detailFilePathTemplate: options.detailFilePathTemplate,
      workspacePath: options.workspacePath,
    });
  }

  /**
   * Build execution context for a single implementation task.
   */
  buildTaskContext(
    task: ImplementationTask,
    workflowRunId: string,
    invocationId: string,
    artifacts: {
      implementationPlan: ImplementationTask[] | null;
      testPlan: TestPlan | null;
      evaluationPlans: EvaluationPlans;
      componentModel: { summary: string; components: Array<{ id: string; name: string; responsibility: string }> } | null;
      technicalSpecs: Array<{ component_id: string; content: string }> | null;
      adrs: ExtractedADR[];
    },
    retryContext?: {
      invariantViolations?: string;
      reasoningReviewFindings?: string;
    },
    dmrPacket?: {
      activeConstraintsText: string;
      detailFileContent: string;
      detailFilePath?: string;
    } | null,
    scaffold?: {
      conventions: string;
      sharedDir: string;
      canonicalFiles: string[];
      protectedPaths: string[];
    } | null,
    /**
     * The task's implementation packet (Phase 9.0). When present it is the
     * SINGLE SOURCE OF TRUTH for the task's scoped context — its `test_cases`
     * and `evaluation_criteria` are already root/leaf-safe and task-scoped
     * (P3 leaf-AC binding + eval scoping). The detail bundle sources them from
     * here instead of re-deriving from raw artifacts, which historically
     * produced `test_cases: []` (root-vs-leaf component_id mismatch) and an
     * unfiltered whole-project `evaluation_criteria` (keep-all fallback) that
     * contradicted the inline packet block.
     */
    packet?: ImplementationPacketContent | null,
  ): ContextPayload {
    // ── 1. Assemble template variables ────────────────────────────
    const implementationTaskStr = formatImplementationTaskHeader(task);
    const componentContextStr = formatComponentContext(task, artifacts.componentModel);
    const componentModelSummary = artifacts.componentModel?.summary ?? '(component model unavailable)';
    // Prefer the packet's completion criteria — they carry `covered_by_test_ids`
    // (the CC→test binding from packet synthesis) which the raw task does not.
    const completionCriteriaForRender: CompletionCriterion[] = packet
      ? packet.task.completion_criteria.map(c => ({
          criterion_id: c.criterion_id,
          description: c.description,
          verification_method: (c.verification_method as CompletionCriterion['verification_method']) ?? 'test_execution',
          covered_by_test_ids: c.covered_by_test_ids,
        }))
      : task.completion_criteria;
    const completionCriteriaStr = formatCompletionCriteria(completionCriteriaForRender);
    const writeScopeStr = formatWriteScopeConstraints(task, scaffold?.protectedPaths);
    const sharedModulesStr = formatSharedModuleConstraints(scaffold);
    const governingADRsStr = formatADRs(filterADRsForTask(artifacts.adrs, task.component_id));
    const refactoringConstraintsStr = formatRefactoringConstraints(task);
    const testCasesStr = formatTestCasesForComponent(artifacts.testPlan, task.component_id);
    const evalFilterResult = filterEvalCriteriaForTask(
      artifacts.evaluationPlans, task, artifacts.componentModel, artifacts.implementationPlan,
    );
    const dependencyTasksStr = formatDependencyTasks(task, artifacts.implementationPlan);
    const upstreamFindingsStr = findUpstreamFindingsForTask(task, this.writer, workflowRunId);

    // ── 2. Build the detail file first, so we can inline its content
    //       and pass the path to the rendered template. ───────────
    // Issue #12: ADRs are already surfaced in the prompt via the
    // `governing_adrs` template variable. Including them again in
    // `decisionTraces` here causes the executor to read the same ADR
    // list twice (once in the governing section, once via the inlined
    // detail file). The detail file's other content (contextPacket,
    // technicalSpecs) is still preserved.
    const detailContent: DetailFileContent = {
      // The per-task implementation bundle — task + component + tests + eval.
      // Routed through `taskBundle` (not the DMR-labelled `contextPacket`) so
      // the executor file is no longer mis-titled "Deep Memory Research".
      taskBundle: JSON.stringify({
        task,
        component: artifacts.componentModel ? lookupComponent(task.component_id, artifacts.componentModel) : undefined,
        // Source the task's tests + evals from the PACKET (the single coherent,
        // task-scoped source) when available; the packet's `test_cases` are
        // root/leaf-safe (P3 binding) and its `evaluation_criteria` are scoped
        // to the packet's user-stories/NFRs. Fall back to the raw-artifact
        // re-derivation only for no-packet callers (tests / calibration shims),
        // where the naive component_id filter + keep-all eval fallback apply.
        test_cases: packet
          ? packet.test_cases
          : artifacts.testPlan?.test_suites
              .filter(s => componentIdMatches(s.component_id, task.component_id))
              .flatMap(s => s.test_cases),
        evaluation_criteria: packet
          ? packet.evaluation_criteria
          : evalFilterResult.keptCriteria,
      }, null, 2),
      technicalSpecs: artifacts.technicalSpecs?.filter(s =>
        task.technical_spec_ids?.includes(s.component_id)
        || (task.traces_to ?? []).includes(s.component_id)
        || componentIdMatches(s.component_id, task.component_id),
      ).map(s => ({ componentId: s.component_id, content: s.content })),
      decisionTraces: '',
    };

    const subPhaseId = `9.1_${task.id}`;
    const payload = this.baseBuilder.buildContextPayload(
      subPhaseId,
      invocationId,
      // We'll overwrite the stdin below with the rendered template.
      {
        governingConstraints: '',
        requiredOutputSpec: '',
        summaryContext: '',
        detailFileReference: '',
      },
      detailContent,
      workflowRunId,
    );

    const detailFilePath = payload.detailFile?.path ?? this.formatDetailFilePath(subPhaseId, invocationId, workflowRunId);
    const taskDetailFileContent = payload.detailFile?.content ?? '(detail file unavailable)';

    // When a per-task DMR packet was supplied, prefer its active
    // constraints (DMR-retrieved + authority-attributed) over the
    // builder-time fallback.
    //
    // Issue #11: the DMR detail-file content was being inlined verbatim
    // into every executor prompt, adding ~600 lines of materiality
    // scores and decision-trace UUIDs per task. The DMR content is also
    // written to disk via the detail-file path the executor already
    // knows about. We now embed only a one-line reference by default;
    // setting JANUMICODE_INLINE_DMR=1 restores the verbose inline mode
    // for cases where the executor cannot read the detail file from
    // disk (e.g. some CI sandboxes).
    // The executor's binding constraints are its TASK's technical constraints
    // (TECH-*), already resolved to full text under "Technical Constraints" in
    // the Implementation Packet Context block. Do NOT inject the workflow's
    // Authority-7 PROCESS governance (lossless stream, namespace prefixing,
    // phase gates, "agents never exercise judgment", "100% correctness — always")
    // — that is JanumiCode's own operating model: irrelevant to, and partly
    // contradictory for, a code executor, and it dominated the prompt's
    // GOVERNING CONSTRAINTS section with pure noise (Phase-9 prompt review).
    const taskConstraintIds = task.active_constraints ?? [];
    const activeConstraintsResolved = taskConstraintIds.length > 0
      ? `Honor the technical constraints scoped to THIS task (full text under "Technical Constraints" in the Implementation Packet Context above): ${taskConstraintIds.join(', ')}.`
      : '(No task-specific technical constraints. Honor the governing ADRs and write scope below.)';
    // The DMR detail file is now a CURATED, RESOLVED reference (governing
    // constraint bodies, supersession chains, contradictions, top findings) —
    // worth surfacing. Inline it when JANUMICODE_INLINE_DMR=1; otherwise point
    // the agent at its real path (NOT the executor-bundle file, which the old
    // pointer wrongly referenced) with a read-selectively note.
    const inlineDmr = process.env.JANUMICODE_INLINE_DMR === '1';
    const dmrDetailPath = dmrPacket?.detailFilePath;
    const detailFileContentInline = dmrPacket?.detailFileContent
      ? (inlineDmr
        ? `${taskDetailFileContent}\n\n---\n\n${dmrPacket.detailFileContent}`
        : `${taskDetailFileContent}\n\n---\n\n_A curated Deep Memory Research context reference (governing constraints, supersession chains, contradictions, material findings — with record references resolved to actual content) is on disk${dmrDetailPath ? `:\n\n    ${dmrDetailPath}` : ''}\n\nRead it selectively if you need supporting governing context beyond what is inlined above._`)
      : taskDetailFileContent;

    // ── 3. Render the template (when loader is available) ─────────
    const variables: Record<string, string> = {
      active_constraints: activeConstraintsResolved,
      implementation_task: implementationTaskStr,
      component_context: componentContextStr,
      component_model_summary: componentModelSummary,
      completion_criteria: completionCriteriaStr,
      write_scope_constraints: writeScopeStr,
      shared_module_constraints: sharedModulesStr,
      governing_adrs: governingADRsStr,
      task_specific_test_cases: testCasesStr,
      task_specific_eval_criteria: evalFilterResult.rendered,
      dependency_tasks_summary: dependencyTasksStr,
      upstream_validator_findings: upstreamFindingsStr,
      refactoring_constraints: refactoringConstraintsStr,
      // Prefer the curated DMR reference path (the template's "Consult for:
      // Technical Specs / API Definitions / Data Models" now lives there);
      // fall back to the executor-bundle file when DMR is unavailable.
      detail_file_path: dmrDetailPath ?? detailFilePath,
      detail_file_content: detailFileContentInline,
      janumicode_version_sha: this.options.janumiCodeVersionSha,
    };

    let renderedText: string | null = null;
    if (this.templateLoader) {
      const template = this.templateLoader.findTemplate('executor_agent', 'implementation_task_execution');
      if (template) {
        const result = this.templateLoader.render(template, variables);
        if (result.missing_variables.length > 0) {
          getLogger().warn('workflow', 'executionContextBuilder: template missing variables', {
            missing: result.missing_variables, taskId: task.id,
          });
        }
        renderedText = result.rendered;
      } else {
        getLogger().warn('workflow', 'executionContextBuilder: template not found, falling back to inline assembly',
          { agentRole: 'executor_agent', subPhase: 'implementation_task_execution' });
      }
    }

    // ── 4. Build the final stdin via the base builder so token-budget,
    //       retry-context, and detail-file-reference handling stay
    //       centralized. ─────────────────────────────────────────
    const stdinContent: StdinContent = renderedText
      ? {
        // The rendered template body already contains GOVERNING /
        // REQUIRED / CONTEXT / DETAIL sections; route it through
        // `requiredOutputSpec` so the base builder doesn't re-prefix
        // it with "GOVERNING CONSTRAINTS:" (the template already
        // owns its headings).
        governingConstraints: '',
        requiredOutputSpec: renderedText,
        summaryContext: '',
        detailFileReference: '',
        invariantViolations: retryContext?.invariantViolations,
        reasoningReviewFindings: retryContext?.reasoningReviewFindings,
      }
      : {
        // Fallback for callers without a templateLoader: synthesize
        // the same logical content into the legacy three-section
        // shape so older tests still get a populated prompt.
        governingConstraints: this.legacyGoverningConstraints(task, artifacts.adrs),
        requiredOutputSpec: this.legacyRequiredOutputSpec(task),
        summaryContext: this.legacySummaryContext(task, artifacts, evalFilterResult.rendered,
          componentContextStr, componentModelSummary, testCasesStr, dependencyTasksStr,
          upstreamFindingsStr),
        detailFileReference:
          `Full context available in detail file at .janumicode/runs/${workflowRunId}/context/9.1_${task.id}_${invocationId}.md`,
        invariantViolations: retryContext?.invariantViolations,
        reasoningReviewFindings: retryContext?.reasoningReviewFindings,
      };

    const stdin = this.baseBuilder.buildStdinDirective(stdinContent);
    return { stdin, detailFile: payload.detailFile };
  }

  private formatDetailFilePath(subPhaseId: string, invocationId: string, workflowRunId: string): string {
    return this.options.detailFilePathTemplate
      .replace('{sub_phase_id}', subPhaseId)
      .replace('{invocation_id}', invocationId)
      .replace('{workflow_run_id}', workflowRunId);
  }

  // ── Legacy fallback assemblers (no-templateLoader path) ────────

  private legacyGoverningConstraints(
    task: ImplementationTask,
    adrs: ExtractedADR[],
  ): string {
    return [
      `## Implementation Task: ${task.id}\nComponent: ${task.component_id}\nResponsibility: ${task.component_responsibility}\nType: ${task.task_type}`,
      `## Completion Criteria (MUST satisfy all)\n${formatCompletionCriteria(task.completion_criteria)}`,
      `## Write Scope Constraint\n${formatWriteScopeConstraints(task)}`,
      adrs.length ? `## Governing Architectural Decisions\n${formatADRs(adrs)}` : '',
      task.task_type === 'refactoring'
        ? `## Refactoring Idempotency Constraint\n${formatRefactoringConstraints(task)}`
        : '',
    ].filter(Boolean).join('\n\n');
  }

  private legacyRequiredOutputSpec(task: ImplementationTask): string {
    return `## Required Output\n\nImplement the following task:\n\n${task.description}\n\n` +
      `### Deliverables\n` +
      `1. Implementation artifacts (source files, configurations)\n` +
      `2. Test code implementing the test cases for this component\n` +
      `3. All completion criteria must be verifiable\n\n` +
      `### Constraints\n` +
      `- Do NOT modify files outside write_directory_paths\n` +
      `- Follow all governing ADRs\n` +
      `- Implement test cases before application code where possible`;
  }

  private legacySummaryContext(
    _task: ImplementationTask,
    _artifacts: unknown,
    evalCriteriaRendered: string,
    componentContext: string,
    componentModelSummary: string,
    testCases: string,
    dependencyTasks: string,
    upstreamFindings: string,
  ): string {
    const summary = componentModelSummary && componentModelSummary.trim().length > 0
      && componentModelSummary !== '(component model unavailable)'
      ? `### Component Model Summary\n${componentModelSummary}`
      : '';
    return [
      `## Component Context\n${componentContext}`,
      summary,
      `## Test Cases to Implement\n${testCases}`,
      `## Evaluation Criteria\n${evalCriteriaRendered}`,
      `## Dependency Tasks\n${dependencyTasks}`,
      `## Upstream Validator Findings\n${upstreamFindings}`,
    ].filter(Boolean).join('\n\n');
  }

  /**
   * Extract artifacts from the Governed Stream for a workflow run.
   */
  extractArtifacts(workflowRunId: string): {
    implementationPlan: ImplementationTask[] | null;
    testPlan: TestPlan | null;
    evaluationPlans: EvaluationPlans;
    componentModel: { summary: string; components: Array<{ id: string; name: string; responsibility: string }> } | null;
    technicalSpecs: Array<{ component_id: string; content: string }> | null;
    adrs: ExtractedADR[];
  } {
    const records = this.writer.getRecordsByType(workflowRunId, 'artifact_produced');

    let implementationPlan: ImplementationTask[] | null = null;
    let testPlan: TestPlan | null = null;
    const evaluationPlans: EvaluationPlans = {};
    let componentModel: { summary: string; components: Array<{ id: string; name: string; responsibility: string }> } | null = null;
    let technicalSpecs: Array<{ component_id: string; content: string }> | null = null;
    const adrs: ExtractedADR[] = [];

    for (const record of records) {
      const content = record.content as ArtifactContent;

      switch (content.kind) {
        case 'implementation_plan':
          implementationPlan = (content.tasks as ImplementationTask[]) ?? null;
          break;
        case 'test_plan':
          testPlan = content as unknown as TestPlan;
          break;
        case 'functional_evaluation_plan':
          evaluationPlans.functional = content as unknown as { criteria: FunctionalEvalCriterion[] };
          break;
        case 'quality_evaluation_plan':
          evaluationPlans.quality = content as unknown as { criteria: QualityEvalCriterion[] };
          break;
        case 'reasoning_evaluation_plan':
          evaluationPlans.reasoning = content as unknown as { scenarios: ReasoningScenario[]; ai_subsystems_detected: boolean };
          break;
        case 'component_model':
          componentModel = {
            summary: (content.summary as string) ?? '',
            components: (content.components as Array<{ id: string; name: string; responsibility: string }>) ?? [],
          };
          break;
        case 'technical_spec':
          technicalSpecs = [
            ...(technicalSpecs ?? []),
            {
              component_id: (content.component_id as string) ?? '',
              content: JSON.stringify(content, null, 2),
            },
          ];
          break;
        case 'adr':
          adrs.push({
            id: (content.id as string) ?? record.id,
            title: (content.title as string) ?? '',
            decision: (content.decision as string) ?? JSON.stringify(content, null, 2),
            governs_components: Array.isArray(content.governs_components) ? content.governs_components as string[] : undefined,
          });
          break;
        case 'architectural_decisions': {
          // Phase 4's adr_capture artifact carries a batch of ADRs under
          // `adrs[]`, not one ADR per record. Flatten so downstream
          // consumers see each ADR individually. Without this branch,
          // every workflow run reaches Phase 9 with an empty ADR set
          // even though Phase 4 produced a dozen well-formed entries.
          const batchedAdrs = (content as unknown as { adrs?: Array<{ id?: string; title?: string; decision?: string; governs_components?: string[] }> }).adrs ?? [];
          for (const a of batchedAdrs) {
            adrs.push({
              id: a.id ?? record.id,
              title: a.title ?? '',
              decision: a.decision ?? JSON.stringify(a, null, 2),
              governs_components: Array.isArray(a.governs_components) ? a.governs_components : undefined,
            });
          }
          break;
        }
      }
    }

    return {
      implementationPlan,
      testPlan,
      evaluationPlans,
      componentModel,
      technicalSpecs,
      adrs,
    };
  }

  /**
   * Get tasks in dependency order.
   */
  getTasksInDependencyOrder(tasks: ImplementationTask[]): ImplementationTask[] {
    const result: ImplementationTask[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (task: ImplementationTask) => {
      if (visited.has(task.id)) return;
      if (visiting.has(task.id)) {
        throw new Error(`Circular dependency detected in task ${task.id}`);
      }

      visiting.add(task.id);

      if (task.dependency_task_ids?.length) {
        for (const depId of task.dependency_task_ids) {
          const dep = tasks.find(t => t.id === depId);
          if (dep) visit(dep);
        }
      }

      visiting.delete(task.id);
      visited.add(task.id);
      result.push(task);
    };

    for (const task of tasks) {
      visit(task);
    }

    return result;
  }
}
