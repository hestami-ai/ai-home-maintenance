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
import { normalizeComponentDirForStack } from './phases/layoutContract';
import { getLogger } from '../logging';
import type { ImplementationPacketContent } from '../types/records';
import {
  selectReasoningFindings, findingInScope, renderFindingLine, dedupSurfacedFindings,
  type SurfacedFinding, type TaskScope,
} from '../review/findingSurfacing';

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

export function formatWriteScopeConstraints(task: ImplementationTask, protectedPaths?: string[], language?: string): string {
  // Stack-aware package normalization: a python (etc.) run cannot use a
  // hyphenated component dir as a package (`import data-governance` is a syntax
  // error). Persisted write_directory_paths minted by an earlier node-shaped
  // Phase 6 are hyphenated, so convert them to the stack's package convention
  // here — otherwise the executor writes to `src/data-governance` while every
  // import + the layout map use `src/data_governance` → fragmentation (slice-156).
  const pkg = (p: string): string => normalizeComponentDirForStack(p, language);
  const denySection = (protectedPaths && protectedPaths.length)
    ? '\n\nNEVER create or modify these scaffold-owned paths (import from them instead — '
      + 'writing here is rejected and the task is retried):\n'
      + protectedPaths.map(p => `- ${pkg(p)}`).join('\n')
    : '';
  if (!task.write_directory_paths?.length) {
    return '(no write scope declared — clarify before writing anything)' + denySection;
  }
  // Defensive normalize: legacy DBs persist absolute paths like
  // `/opt/hestami/PROP/...`. Strip system-root prefixes so Phase 9
  // resolves them against workspacePath consistently.
  const normalized = task.write_directory_paths.map(p => pkg(normalizeWorkspacePath(p)));
  // Precedence note: the task DESCRIPTION (LLM-authored upstream) sometimes names
  // a different target directory than this deterministic write scope (e.g.
  // "create … in src/config/security" while the scope is src/link-management).
  // Without this line the executor deadlocks trying to reconcile the two. The
  // write scope WINS — create the described artifact inside it.
  const authoritative =
    '\n\nThis write scope is AUTHORITATIVE. If the task description, goal, or any '
    + 'instruction names a DIFFERENT directory, ignore that path and create the '
    + 'described artifact INSIDE one of the write-scope directories above (creating '
    + 'subdirectories within them as needed). Use the EXACT path(s) above '
    + 'character-for-character (mind underscores vs hyphens); do NOT derive a '
    + 'directory name from the component id or task name.';
  return 'Files may ONLY be created/modified in:\n' +
    normalized.map(p => `- ${p}`).join('\n') + authoritative + denySection;
}

/**
 * Stack-aware "Common pitfalls" block for the executor prompt. The test-runner
 * pitfall is LANGUAGE-SPECIFIC — the hardcoded node `node --test` / `npm test`
 * guidance is wrong (and actively misleading) on a python/rust/go/java stack
 * (slice-156: a python executor was handed `node --test` / `package.json` advice).
 * The technology-drift + no-unverified-success bullets are universal. The signal
 * is the resolved stack/language (scaffold.language / recon primary_stack); an
 * unknown stack falls back to the node guidance (the prior behavior, and the
 * dominant case), with the universal drift bullet covering "clarify if unsure".
 */
export function formatCommonPitfalls(language?: string): string {
  const lang = (language ?? '').trim().toLowerCase();
  const universal = [
    '- **Technology drift.** Honor the project\'s declared stack (carried in the active constraints / shared modules above). Do NOT substitute your own preferred language, framework, or test runner even if the task description is vague. If the stack is genuinely unspecified, surface that as a clarification rather than inventing one.',
    '- **`success: true` without evidence.** Reasoning Review flags `completeness_shortcut` whenever the final summary asserts success without a verifiable trace (compile output, test pass count, build-artifact path). Make verification commands part of your tool-call sequence, even when the result feels obvious.',
  ];
  let runner: string[];
  switch (lang) {
    case 'python':
      runner = [
        '- **pytest discovery.** The orchestrator runs the project\'s declared test command (pytest) during Phase 9.2. pytest only collects files named `test_*.py` / `*_test.py` and functions/classes named `test_*` / `Test*` — a test file that does not match is silently NOT run, so Phase 9.2 reports zero tests and the gate fails. Run `pytest` (or `python -m pytest`) and SEE it collect your tests before claiming success.',
      ];
      break;
    case 'rust':
      runner = [
        '- **cargo test.** The orchestrator runs `cargo test` during Phase 9.2. Tests live in `#[cfg(test)]` modules or under `tests/`; a compile error in any of them reports zero passing tests and fails the gate. Run `cargo test` locally and see it pass before claiming success.',
      ];
      break;
    case 'go':
      runner = [
        '- **go test.** The orchestrator runs `go test ./...` during Phase 9.2. Test files MUST end in `_test.go` and functions be `func TestXxx(t *testing.T)` — anything else is not collected. Run `go test ./...` locally before claiming success.',
      ];
      break;
    case 'java':
      runner = [
        '- **mvn/gradle test.** The orchestrator runs the project\'s build test goal (e.g. `mvn test` / `gradle test`) during Phase 9.2. Tests must be on the test source path with the runner\'s naming/annotations (`@Test`). Run the test goal locally before claiming success.',
      ];
      break;
    default:
      // node (typescript/javascript) and the unknown-stack fallback: the original
      // node guidance — unchanged so the node path is byte-for-byte as before.
      runner = [
        '- **Node.js `node --test` test script.** `node --test test` is interpreted by Node as a test-NAME pattern, NOT a directory. To run tests in a `test/`/`tests/` directory write `node --test test/` (trailing slash) or a glob `node --test \'test/**/*.test.js\'`. Verify by running the script before declaring success.',
        '- **Test command from `package.json` `scripts.test`.** The orchestrator runs the workspace\'s declared `test` script during Phase 9.2. If it can\'t actually invoke the tests you wrote, Phase 9.2 reports zero suites and the gate fails. Run `npm test` locally and SEE it pass before the final summary.',
      ];
      break;
  }
  return [...runner, ...universal].join('\n');
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

/** Generous cap on the DMR context inlined into a leaf prompt (chars). */
const DMR_INLINE_BUDGET = 12000;

/**
 * PD-6 (P9 prompt audit): the per-task DMR context is inlined into every leaf
 * prompt (the sandbox cannot read the on-disk copy — slice-151), but with
 * `scopeTier:'all_runs'` a large cross-run / whole-catalog dump can dominate the
 * prompt as dead context (the A1/A4/A2 "raw cross-component Deep-Memory JSON"
 * finding). The DMR's findings are MATERIALITY-RANKED (the task's own artifacts
 * are seeded known-relevant at 1.0 and rank first), so a budgeted TAIL-drop at
 * blank-line section boundaries sheds the LEAST-material context while never
 * clipping mid-structure. Generous budget: only oversized dumps are trimmed;
 * ordinary task-scoped DMR passes through untouched. The full curated context
 * remains on disk at the detail-file path (audit / non-sandboxed runs).
 */
/**
 * PD-11: the base ContextBuilder titles the detail-file body
 * `# JanumiCode Context Detail File`, but the executor template already renders a
 * `# DETAIL FILE` header above the inlined body — two competing detail-file H1s
 * back-to-back. Drop the redundant inner title so there is exactly ONE header.
 * No-op when the title is absent (e.g. the "(detail file unavailable)" fallback).
 */
export function stripRedundantDetailHeader(content: string): string {
  if (typeof content !== 'string') return content;
  return content.replace(/^# JanumiCode Context Detail File[^\n]*\n+/, '');
}

export function capInlinedDmrContext(text: string, budget: number = DMR_INLINE_BUDGET): string {
  if (typeof text !== 'string' || text.length <= budget) return text;
  const blocks = text.split('\n\n');
  const kept: string[] = [];
  let used = 0;
  let dropped = 0;
  for (const b of blocks) {
    if (used + b.length + 2 > budget && kept.length > 0) { dropped++; continue; }
    kept.push(b);
    used += b.length + 2;
  }
  let out = kept.join('\n\n');
  if (dropped > 0) {
    out += `\n\n… (${dropped} lower-materiality Deep-Memory section(s) elided for prompt economy — the full curated context is on disk at the detail-file path)`;
  }
  return out;
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
 * Derive a task's logical scope from its packet — the US / AC / NFR /
 * component ids the task implements. Phase-9 packet tasks carry EMPTY
 * `traces_to`/`derived_from_record_ids`, so the packet is the only source
 * of the task's logical identity. Falls back to the task's own ids when no
 * packet is present.
 */
export function taskScopeFromPacket(
  task: ImplementationTask,
  packet: ImplementationPacketContent | null | undefined,
): TaskScope {
  if (packet) {
    return {
      userStoryIds: packet.user_stories.map(u => u.id),
      acceptanceCriterionIds: packet.user_stories.flatMap(u => (u.acceptance_criteria ?? []).map(a => a.id)),
      nfrIds: packet.nfrs.map(n => n.id),
      componentId: packet.component?.id ?? task.component_id,
    };
  }
  return {
    userStoryIds: [],
    acceptanceCriterionIds: task.traces_to ?? [],
    nfrIds: [],
    componentId: task.component_id,
  };
}

/**
 * Surface the substantive, unadjudicated reasoning-review findings scoped to
 * THIS task's requirements (its packet's US/AC/NFR/component). Excludes the
 * auto-fix bucket, auto-mitigated findings, superseded findings, and
 * reasoning-PROCESS validators (see findingSurfacing.ts). Returns a formatted
 * string capped at UPSTREAM_FINDINGS_CAP entries.
 *
 * Replaces the prior record-UUID intersection, which never matched: findings
 * derive from the harness record (not the artifact) and packet tasks carry no
 * lineage, so the old matcher always returned the empty fallback.
 */
export function findUpstreamFindingsForTask(
  writer: GovernedStreamWriter,
  workflowRunId: string,
  scope: TaskScope,
): string {
  let selected: SurfacedFinding[];
  try {
    selected = selectReasoningFindings(writer, workflowRunId, { forExecutor: true });
  } catch (err) {
    getLogger().warn('workflow', 'findUpstreamFindingsForTask: failed to load findings', {
      error: err instanceof Error ? err.message : String(err),
    });
    return EMPTY_UPSTREAM_FINDINGS_FALLBACK;
  }

  const matched = selected.filter(f => findingInScope(f, scope));
  if (!matched.length) return EMPTY_UPSTREAM_FINDINGS_FALLBACK;

  // PD-8 (P9 prompt audit): the same upstream issue is often emitted across many
  // validator records (per-AC / per-artifact) with distinct recordIds but IDENTICAL
  // rendered content, so the same finding line was injected repeatedly (~16×) —
  // noise that crowded distinct findings out from under the cap. Collapse by
  // rendered line so the executor sees each finding ONCE and the cap counts distinct.
  const deduped = dedupSurfacedFindings(matched);

  const capped = deduped.slice(0, UPSTREAM_FINDINGS_CAP);
  const header = deduped.length > UPSTREAM_FINDINGS_CAP
    ? `(showing ${UPSTREAM_FINDINGS_CAP} of ${deduped.length} HIGH/MEDIUM findings)\n`
    : '';
  return header + capped.map(renderFindingLine).join('\n');
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
      /** Primary stack/language — drives package-dir normalization (python etc). */
      language?: string;
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
    const writeScopeStr = formatWriteScopeConstraints(task, scaffold?.protectedPaths, scaffold?.language);
    const sharedModulesStr = formatSharedModuleConstraints(scaffold);
    const governingADRsStr = formatADRs(filterADRsForTask(artifacts.adrs, task.component_id));
    const refactoringConstraintsStr = formatRefactoringConstraints(task);
    const testCasesStr = formatTestCasesForComponent(artifacts.testPlan, task.component_id);
    const evalFilterResult = filterEvalCriteriaForTask(
      artifacts.evaluationPlans, task, artifacts.componentModel, artifacts.implementationPlan,
    );
    const dependencyTasksStr = formatDependencyTasks(task, artifacts.implementationPlan);
    const upstreamFindingsStr = findUpstreamFindingsForTask(
      this.writer, workflowRunId, taskScopeFromPacket(task, packet),
    );

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
      //
      // OMITTED when a packet is present (slice-156): the scheduler prepends the
      // human-readable "# Implementation Packet Context" block
      // (formatPacketAsExecutorContext) carrying the SAME task/component/tests/
      // evals, so re-serializing them here as ~160 lines of JSON is pure
      // duplication. The no-packet path (tests / calibration shims) keeps the
      // bundle — there it is the only structured task context.
      taskBundle: packet ? undefined : JSON.stringify({
        task,
        component: artifacts.componentModel ? lookupComponent(task.component_id, artifacts.componentModel) : undefined,
        // No-packet re-derivation: the naive component_id filter + keep-all eval
        // fallback (the packet path is gone above — its tests/evals are root/
        // leaf-safe and already rendered in the top packet block).
        test_cases: artifacts.testPlan?.test_suites
          .filter(s => componentIdMatches(s.component_id, task.component_id))
          .flatMap(s => s.test_cases),
        evaluation_criteria: evalFilterResult.keptCriteria,
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
    // PD-11: strip the body's own `# JanumiCode Context Detail File` H1 — the
    // template renders a `# DETAIL FILE` header above it, so keeping both duplicates.
    const taskDetailFileContent = stripRedundantDetailHeader(payload.detailFile?.content ?? '(detail file unavailable)');

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
    // Inline the curated DMR context BY DEFAULT. The Phase-9 executor runs
    // inside the projectRoot cwd-sandbox, so the on-disk detail-file pointer
    // (control-plane `.janumicode/runs/…`) is unreadable — outside the cwd and
    // behind the executor's `external_directory: deny` policy. Issue #11
    // de-inlined this for token economy, but a dead pointer means the executor
    // silently loses the curated governing context (supersession chains,
    // contradictions, resolved constraints, material findings) — worse than the
    // tokens (slice-151: 0/23 leaves could read it). Set JANUMICODE_INLINE_DMR=0
    // to force the on-disk pointer instead — only safe when the executor cwd can
    // actually read `.janumicode/` (e.g. a non-sandboxed run).
    const inlineDmr = process.env.JANUMICODE_INLINE_DMR !== '0';
    const dmrDetailPath = dmrPacket?.detailFilePath;
    const detailFileContentInline = dmrPacket?.detailFileContent
      ? (inlineDmr
        // PD-6: budget-cap the inlined DMR (materiality-ordered tail-drop, never
        // clip) so a cross-run whole-catalog dump can't dominate the leaf prompt.
        ? `${taskDetailFileContent}\n\n---\n\n${capInlinedDmrContext(dmrPacket.detailFileContent)}`
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
      // The template's "# DETAIL FILE — Path: {detail_file_path}" pointer. When
      // the curated context is inlined (the sandbox default), there is NO
      // readable on-disk file: the path lives in the control-plane
      // `.janumicode/runs/…`, outside the executor's projectRoot cwd and behind
      // its `external_directory: deny` policy. Pointing a sandboxed agent at it
      // just wastes a tool call on an unreadable file (slice-151). Surface a
      // sentinel that tells the agent the content is inlined; keep the real path
      // only for the non-sandboxed opt-out (INLINE_DMR=0).
      detail_file_path: inlineDmr
        ? '(the full curated context is inlined above — there is no separate file to read)'
        : (dmrDetailPath ?? detailFilePath),
      detail_file_content: detailFileContentInline,
      // Stack-aware "Common pitfalls" — the test-runner pitfall must match the
      // resolved stack (python pytest / rust cargo / … ), not the hardcoded node
      // `node --test`/`npm test` advice that misleads a non-node executor.
      common_pitfalls: formatCommonPitfalls(scaffold?.language),
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
