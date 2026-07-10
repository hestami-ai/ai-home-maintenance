/**
 * Render an `ImplementationPacketContent` as a markdown context block
 * for the executor agent's stdin. This is the structural ts-16 fix:
 * the executor receives user stories, ACs, component contract, data
 * models, API definitions, test cases, eval criteria, technical
 * constraints, and compliance items — all the upstream context it
 * needs to implement the task without inventing.
 *
 * Pure function: takes a packet, returns a markdown string. No side
 * effects. Unit-testable from any test that constructs a packet by hand.
 *
 * See docs/design/implementation-packet-synthesis.md §6.
 */

import type {
  ImplementationPacketContent,
  PacketActiveConstraint,
  PacketApiDefinition,
  PacketComplianceItem,
  PacketComponent,
  PacketComponentDependency,
  PacketComponentResponsibility,
  PacketCoherenceResult,
  PacketDataModel,
  PacketEvaluationCriterion,
  PacketNfr,
  PacketTestCase,
  PacketUserStory,
  PacketUserStoryAc,
  PropertySpec,
} from '../../../types/records';
import { categorizeCoherence } from '../../../review/findingSurfacing';

type CategorizedCoherence = ReturnType<typeof categorizeCoherence>;
type ActionableFinding = CategorizedCoherence['actionable'][number];

export function formatPacketAsExecutorContext(packet: ImplementationPacketContent): string {
  return [
    ...buildHeaderLines(),
    ...formatUserStories(packet.user_stories),
    ...formatNfrs(packet.nfrs),
    ...formatComponentContract(packet.component),
    ...formatDataModels(packet.data_models),
    ...formatApiDefinitions(packet.api_definitions),
    ...formatTestCases(packet.test_cases),
    ...formatEvaluationCriteria(packet.evaluation_criteria),
    ...formatActiveConstraints(packet.active_constraints),
    ...formatComplianceItems(packet.compliance_items),
    ...formatCoherenceFindings(packet.coherence),
    ...formatCoherenceNotes(packet.coherence),
  ].join('\n');
}

// ── Header ──────────────────────────────────────────────────────────
function buildHeaderLines(): string[] {
  return [
    '# Implementation Packet Context',
    '',
    'Your authoritative deliverable is the **Implementation Task** and its **Completion Criteria** (in the GOVERNING CONSTRAINTS section below) — that is exactly what you must build and what you will be judged on.',
    '',
    'The sections below are the surrounding **component context**: the user stories, test cases, and evaluation methods for the *whole component* this task belongs to. Your task implements ONE slice of this component, not all of it. Use this context to stay consistent with the component — do NOT attempt to satisfy every story, test, or evaluation listed here in this single task, and do NOT invent ACs, tests, components, APIs, or constraints beyond what is given.',
    '',
  ];
}

// ── User Stories ────────────────────────────────────────────────────
function formatUserStories(userStories: PacketUserStory[]): string[] {
  if (userStories.length === 0) return [];
  const lines = ['## Component Context — User Stories', ''];
  for (const us of userStories) lines.push(...formatUserStory(us));
  return lines;
}

function formatUserStory(us: PacketUserStory): string[] {
  const lines = [
    `### ${us.id} — As a ${us.role || '(no role)'}, I want to ${us.action || '(no action)'}, so that ${us.outcome || '(no outcome)'}.`,
    `Priority: ${us.priority || 'medium'}`,
    '',
  ];
  if (us.acceptance_criteria.length === 0) return lines;
  lines.push('**Acceptance criteria for this story (component-level — your task may satisfy only the subset within its scope):**');
  for (const ac of us.acceptance_criteria) lines.push(...formatAcceptanceCriterion(ac));
  lines.push('');
  return lines;
}

function formatAcceptanceCriterion(ac: PacketUserStoryAc): string[] {
  const lines = [`- **${ac.id}** — ${ac.description}`];
  if (ac.measurable_condition) lines.push(`  Measurable: ${ac.measurable_condition}`);
  return lines;
}

// ── NFRs ────────────────────────────────────────────────────────────
function formatNfrs(nfrs: PacketNfr[]): string[] {
  if (nfrs.length === 0) return [];
  const lines = ['## Non-Functional Requirements That Apply', ''];
  for (const n of nfrs) lines.push(...formatNfr(n));
  lines.push('');
  return lines;
}

function formatNfr(n: PacketNfr): string[] {
  const lines = [`- **${n.id}** (${n.category}): ${n.description}`];
  if (n.threshold) lines.push(`  Threshold: ${n.threshold}`);
  if (n.measurement_method) lines.push(`  Measurement: ${n.measurement_method}`);
  if (n.measurable_condition) lines.push(`  Measurable: ${n.measurable_condition}`);
  return lines;
}

// ── Component contract ──────────────────────────────────────────────
function formatComponentContract(component: PacketComponent): string[] {
  if (!component.id) return [];
  const lines = [
    '## Component Contract',
    '',
    `Component: \`${component.id}\` — ${component.name || '(no name)'}`,
  ];
  if (component.domain_id) lines.push(`Domain: \`${component.domain_id}\``);
  lines.push(
    ...formatResponsibilities(component.responsibilities),
    ...formatDependencies(component.dependencies),
    '',
  );
  return lines;
}

function formatResponsibilities(responsibilities: PacketComponentResponsibility[]): string[] {
  if (responsibilities.length === 0) return [];
  const lines = ['', 'Responsibilities:'];
  for (const r of responsibilities) {
    const idPrefix = r.id ? `\`${r.id}\`: ` : '';
    lines.push(`- ${idPrefix}${r.description || r.statement || ''}`);
  }
  return lines;
}

function formatDependencies(dependencies: PacketComponentDependency[]): string[] {
  if (dependencies.length === 0) return [];
  const lines = ['', 'Component dependencies:'];
  for (const d of dependencies) lines.push(`- \`${d.component_id}\` (${d.kind})`);
  return lines;
}

// ── Data models ─────────────────────────────────────────────────────
function formatDataModels(dataModels: PacketDataModel[]): string[] {
  if (dataModels.length === 0) return [];
  const lines = ['## Data Models You May Read/Write', ''];
  for (const dm of dataModels) lines.push(...formatDataModel(dm));
  return lines;
}

function formatDataModel(dm: PacketDataModel): string[] {
  const lines = [`### ${dm.id} — ${dm.name || '(no name)'}`];
  if (dm.fields.length === 0) return lines;
  lines.push('Fields:');
  for (const f of dm.fields) {
    const c = f.constraints ? ` _(${f.constraints})_` : '';
    lines.push(`- \`${f.name}\`: \`${f.type}\`${c}`);
  }
  lines.push('');
  return lines;
}

// ── API endpoints ───────────────────────────────────────────────────
// PD-7: this list is the COMPONENT's endpoints (component-scoped join), which
// may exceed the one(s) THIS task implements — the executor was observed picking
// the wrong contract (e.g. `POST /board-decisions` when the task was
// `/decisions/{id}/approve`). Frame it as scoped context and hedge on count:
// when more than one endpoint is present, tell the executor to implement only
// the one(s) its task + completion criteria call for (mirrors the test-case hedge).
function formatApiDefinitions(apiDefinitions: PacketApiDefinition[]): string[] {
  if (apiDefinitions.length === 0) return [];
  const heading = apiDefinitions.length > 1
    ? '## Component API Endpoints (context — implement ONLY the one(s) your task + completion criteria require; the rest belong to sibling tasks)'
    : '## API Endpoints You Implement';
  const lines = [heading, ''];
  for (const api of apiDefinitions) lines.push(...formatApiDefinition(api));
  return lines;
}

function formatApiDefinition(api: PacketApiDefinition): string[] {
  const lines = [`### ${api.id} — \`${api.method} ${api.path}\``];
  if (api.description) lines.push(api.description);
  if (api.request_shape) {
    lines.push('Request shape:', '```json', JSON.stringify(api.request_shape, null, 2), '```');
  }
  if (api.response_shape) {
    lines.push('Response shape:', '```json', JSON.stringify(api.response_shape, null, 2), '```');
  }
  if (api.error_codes && api.error_codes.length > 0) {
    lines.push(`Error codes: ${api.error_codes.join(', ')}`);
  }
  lines.push('');
  return lines;
}

// ── Test cases ──────────────────────────────────────────────────────
function formatTestCases(testCases: PacketTestCase[]): string[] {
  if (testCases.length === 0) return [];
  const lines = ['## Component Test Cases (context — may belong to sibling tasks; your gate is the Completion Criteria, not these)', ''];
  for (const tc of testCases) lines.push(...formatTestCase(tc));
  return lines;
}

function formatTestCase(tc: PacketTestCase): string[] {
  const refs = tc.acceptance_criterion_ids.join(', ');
  const lines = [`### ${tc.test_case_id} (${tc.type}) — verifies ${refs}`];
  lines.push(
    ...formatTestCasePreconditions(tc.preconditions),
    `Expected outcome: ${tc.expected_outcome}`,
  );
  if (tc.property_spec) lines.push(...formatTestCasePropertySpec(tc.property_spec));
  lines.push('');
  return lines;
}

function formatTestCasePreconditions(preconditions: string[]): string[] {
  if (preconditions.length === 0) return [];
  const lines = ['Preconditions:'];
  for (const p of preconditions) lines.push(`- ${p}`);
  return lines;
}

function formatTestCasePropertySpec(ps: PropertySpec): string[] {
  const lines = [
    `PROPERTY TEST (${ps.property_kind}) — implement with the stack's property-based-testing library (fast-check / Hypothesis / proptest / gopter), not a single example:`,
    `  Invariant (must hold for ALL inputs): ${ps.invariant}`,
    `  Input domain to generate over: ${ps.input_domain}`,
  ];
  if (ps.generators && ps.generators.length > 0) lines.push(`  Suggested generators: ${ps.generators.join(', ')}`);
  if (ps.oracle) lines.push(`  Oracle: ${ps.oracle}`);
  if (ps.metamorphic_relation) lines.push(`  Metamorphic relation: ${ps.metamorphic_relation}`);
  return lines;
}

// ── Evaluation criteria ─────────────────────────────────────────────
function formatEvaluationCriteria(evaluationCriteria: PacketEvaluationCriterion[]): string[] {
  if (evaluationCriteria.length === 0) return [];
  const lines = ['## How This Component Is Evaluated (context — these are component/system-level methods, not your task\'s unit of work)', ''];
  for (const ec of evaluationCriteria) lines.push(...formatEvaluationCriterion(ec));
  lines.push('');
  return lines;
}

function formatEvaluationCriterion(ec: PacketEvaluationCriterion): string[] {
  const lines = [
    `- Target \`${ec.target_id}\` (${ec.kind})`,
    `  Method: ${ec.evaluation_method}`,
    `  Success: ${ec.success_condition}`,
  ];
  if (!ec.property_spec) return lines;
  const ps = ec.property_spec;
  const oracleSuffix = ps.oracle ? ` (oracle: ${ps.oracle})` : '';
  lines.push(`  PROPERTY (${ps.property_kind}) — verify generatively with the stack's PBT library: assert "${ps.invariant}" for all inputs in {${ps.input_domain}}${oracleSuffix}.`);
  return lines;
}

// ── Active technical constraints ────────────────────────────────────
// PD-11: an unresolved constraint reference is carried as a placeholder with an
// EMPTY body (buildActiveConstraints, so the coherence verifier's P7 flags it) —
// but rendering `- **TECH-BUN** (): ` under "apply without exception" tells the
// executor to honor a rule with no content (dangling/ungrounded id). Split them:
// present only RESOLVED constraints as binding; list unresolved ids separately as
// an upstream gap the executor must NOT invent a rule for.
function formatActiveConstraints(activeConstraints: PacketActiveConstraint[]): string[] {
  if (activeConstraints.length === 0) return [];
  const resolved = activeConstraints.filter(isResolvedConstraint);
  const unresolved = activeConstraints.filter((c) => !isResolvedConstraint(c));
  return [
    ...formatResolvedConstraints(resolved),
    ...formatUnresolvedConstraints(unresolved),
  ];
}

function isResolvedConstraint(c: PacketActiveConstraint): boolean {
  return typeof c.text === 'string' && c.text.trim().length > 0;
}

function formatResolvedConstraints(resolved: PacketActiveConstraint[]): string[] {
  if (resolved.length === 0) return [];
  const lines = ['## Technical Constraints (apply without exception)', ''];
  for (const c of resolved) lines.push(...formatResolvedConstraint(c));
  lines.push('');
  return lines;
}

function formatResolvedConstraint(c: PacketActiveConstraint): string[] {
  const tech = c.technology ? ` [${c.technology}]` : '';
  const lines = [`- **${c.id}**${tech} (${c.category}): ${c.text}`];
  if (c.rationale) lines.push(`  Rationale: ${c.rationale}`);
  return lines;
}

function formatUnresolvedConstraints(unresolved: PacketActiveConstraint[]): string[] {
  if (unresolved.length === 0) return [];
  return [
    '## Unresolved constraint references (upstream gap — do NOT invent a rule for these; flagged for maintainers)',
    '',
    unresolved.map((c) => `\`${c.id}\``).join(', '),
    '',
  ];
}

// ── Compliance / V&V / Quality items ────────────────────────────────
function formatComplianceItems(complianceItems: PacketComplianceItem[]): string[] {
  if (complianceItems.length === 0) return [];
  const lines = ['## Compliance / V&V / Quality Items That Apply', ''];
  for (const c of complianceItems) {
    lines.push(`- **${c.id}** (${c.kind}): ${c.description}`);
    if (c.measurable_condition) lines.push(`  Measurable: ${c.measurable_condition}`);
  }
  lines.push('');
  return lines;
}

// ── Upstream coherence findings (un-suppressed; reverses ts-17).
// The packet's coherence verifier already scoped these to THIS task. The
// executor CAN act on several (author a missing test, don't trust an
// invented id, implement an unmeasurable eval to the spec); the rest are
// upstream gaps it can't fix but should be aware of. Categorized so the
// prompt distinguishes "act on these" from "FYI".
function formatCoherenceFindings(coherence: PacketCoherenceResult): string[] {
  const coherenceCodes = [
    ...coherence.blocking_failures,
    ...coherence.advisory_findings,
  ];
  if (coherenceCodes.length === 0) return [];
  const { actionable, fyi } = categorizeCoherence(coherenceCodes);
  return [
    '## Upstream Coherence Findings (gaps in THIS task\'s inputs)',
    '',
    ...formatActionableFindings(actionable),
    ...formatFyiFindings(fyi),
  ];
}

function formatActionableFindings(actionable: ActionableFinding[]): string[] {
  if (actionable.length === 0) return [];
  const lines = ['Act on these:'];
  for (const a of actionable) lines.push(`- ${a.line} → ${a.remedy}`);
  lines.push('');
  return lines;
}

function formatFyiFindings(fyi: string[]): string[] {
  if (fyi.length === 0) return [];
  const lines = ['FYI (upstream gaps you can\'t directly fix — anticipate, honor the spec):'];
  for (const f of fyi) lines.push(`- ${f}`);
  lines.push('');
  return lines;
}

// ai_proposed root count — some upstream ids were not user-confirmed; honor
// spec text when those refs conflict.
function formatCoherenceNotes(coherence: PacketCoherenceResult): string[] {
  const count = coherence.annotations.ai_proposed_root_count;
  if (count <= 0) return [];
  return [
    '## Packet Coherence Notes',
    '',
    `_${count} upstream id(s) trace to ai-proposed Phase 1 items. Honor the spec text where it conflicts with these._`,
    '',
  ];
}
