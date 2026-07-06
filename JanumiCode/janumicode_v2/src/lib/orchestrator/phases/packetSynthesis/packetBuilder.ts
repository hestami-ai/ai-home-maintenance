/**
 * Packet builder — joins upstream artifacts into one
 * `ImplementationPacketContent` per atomic Phase 6.1a task.
 *
 * Pure function: takes parsed upstream content + the atomic task list +
 * the upstream index, returns the packet records (WITHOUT yet running
 * the coherence verifier — that's a separate pure function consumed by
 * the synthesizer wrapper). This separation makes both halves
 * fixture-testable in isolation.
 *
 * See docs/design/implementation-packet-synthesis.md §3 step 3.
 */

import { randomUUID } from 'node:crypto';
import type {
  ImplementationPacketContent,
  PacketActiveConstraint,
  PacketApiDefinition,
  PacketComplianceItem,
  PacketComponent,
  PacketDataModel,
  PacketEvaluationCriterion,
  PacketNfr,
  PacketTask,
  PacketTestCase,
  PacketUserStory,
  PropertySpec,
} from '../../../types/records';
import { parentRefFromCompositeAc } from '../phase2/acIdNormalizer';
import type { RequirementLineage } from './idResolution';

// ── Input shapes (just enough structural typing to build the packet) ──

export interface BuilderAtomicTask {
  /** task_decomposition_node UUID */
  node_id: string;
  /** Phase 6.1a leaf node content — typed as { task: ..., depth, tier, ... } */
  content: {
    node_id: string;
    task: {
      id: string;
      name: string;
      description: string;
      task_type?: string;
      component_id?: string;
      component_responsibility?: string;
      estimated_complexity?: string;
      completion_criteria?: Array<{
        criterion_id: string;
        description: string;
        verification_method: string;
      }>;
      write_directory_paths?: string[];
      read_directory_paths?: string[];
      dependency_task_ids?: string[];
      active_constraints?: string[];
      traces_to?: string[];
    };
    release_id?: string | null;
    release_ordinal?: number | null;
    [key: string]: unknown;
  };
}

export interface BuilderUserStory {
  id: string;
  role?: string;
  action?: string;
  outcome?: string;
  priority?: string;
  traces_to?: string[];
  acceptance_criteria?: Array<{
    id: string;
    description?: string;
    measurable_condition?: string;
  }>;
}

export interface BuilderNfr {
  id: string;
  category?: string;
  description?: string;
  priority?: string;
  threshold?: string;
  measurement_method?: string;
  traces_to?: string[];
  /** FR ids (US-*) this NFR is bounded by. Phase 2.2 NFR bloom emits
   *  this when an NFR governs specific user stories rather than being
   *  cross-cutting. Used by the packetBuilder Pass-3 user-story matcher
   *  to bridge tasks → NFR → US (tasks trace SR-/NFR- but never US- in
   *  practice). */
  applies_to_requirements?: string[];
  acceptance_criteria?: Array<{
    id?: string;
    description?: string;
    measurable_condition?: string;
  }>;
}

export interface BuilderComponent {
  id: string;
  name?: string;
  domain_id?: string | null;
  responsibilities?: Array<{
    id?: string;
    description?: string;
    statement?: string;
  }>;
  dependencies?: Array<{
    component_id?: string;
    target_component_id?: string;
    kind?: string;
    dependency_type?: string;
  }>;
  active_constraints?: string[];
  traces_to?: string[];
}

export interface BuilderDataModel {
  id: string;
  name?: string;
  component_id?: string;
  fields?: Array<{ name?: string; type?: string; constraints?: string }>;
  /** PD-7: SR-/AC- ids this entity serves (Phase-5 minted; task→DM scoping). */
  traces_to?: string[];
}

export interface BuilderApiDef {
  id: string;
  method?: string;
  path?: string;
  description?: string;
  component_id?: string;
  request_shape?: unknown;
  response_shape?: unknown;
  error_codes?: string[];
  /** PD-7: SR-/AC- ids this endpoint implements (Phase-5 minted; task→API scoping). */
  traces_to?: string[];
}

export interface BuilderTestSuite {
  suite_id?: string;
  component_id?: string;
  test_type?: string;
  test_cases?: Array<{
    test_case_id: string;
    type?: string;
    acceptance_criterion_ids?: string[];
    preconditions?: string[];
    // The LLM (test_case_saturation) sometimes emits expected_outcome as an
    // ARRAY of outcome strings rather than a single string. Typed as unknown
    // so the coercion below is forced; never assume `.trim()` is callable.
    expected_outcome?: unknown;
    /** Present on 'property' test cases (Phase 7.1a) — carried to the packet for the executor. */
    property_spec?: PropertySpec;
  }>;
}

/**
 * Coerce an LLM-emitted expected_outcome (string | string[] | other) to a
 * single trimmed string. An array of outcomes becomes a `; `-joined string so
 * no assertion text is lost; non-string scalars stringify; nullish → ''.
 * Centralised so the packet producer and the coherence verifier agree.
 */
export function coerceOutcomeString(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean).join('; ');
  }
  if (raw == null) return '';
  return String(raw).trim();
}

export interface BuilderEvaluationCriterion {
  kind: 'functional' | 'quality' | 'reasoning';
  /** Eval shape varies between functional (functional_requirement_id) and quality (nonfunctional_requirement_id). */
  target_id: string;
  evaluation_method?: string;
  success_condition?: string;
  /** Present on a quality criterion whose NFR threshold is a generative property. */
  property_spec?: PropertySpec;
}

export interface BuilderTechnicalConstraint {
  id: string;
  category?: string;
  text?: string;
  technology?: string;
  rationale?: string;
}

export interface BuilderComplianceItem {
  id: string;
  kind: 'compliance' | 'vv_requirement' | 'quality_attribute';
  description?: string;
  measurable_condition?: string;
}

export interface BuilderInput {
  /** All atomic Phase 6.1a task leaves (status='atomic') for the active release. */
  atomicTasks: BuilderAtomicTask[];
  /** Phase 2 FR skeleton user stories. */
  userStories: BuilderUserStory[];
  /** Phase 2 NFR skeleton items. */
  nfrs: BuilderNfr[];
  /**
   * Component lookup — keyed by component id (both skeleton roots and
   * saturation-leaf children). The packet builder uses the leaf
   * component matching `task.component_id`.
   */
  componentsById: Map<string, BuilderComponent>;
  /** Phase 5 data models. */
  dataModels: BuilderDataModel[];
  /** Phase 5 API definitions. */
  apiDefinitions: BuilderApiDef[];
  /** Phase 7 test suites (skeleton — saturation atomic leaves carry the same test_case shape under content.test_case). */
  testSuites: BuilderTestSuite[];
  /** Phase 8 evaluation criteria (functional + quality + reasoning). */
  evaluationCriteria: BuilderEvaluationCriterion[];
  /** Phase 1.0c technical constraints lookup by id (TECH-*). */
  technicalConstraintsById: Map<string, BuilderTechnicalConstraint>;
  /** Phase 1.0d/0e/1.5 compliance / V&V / QA items lookup by id. */
  complianceItemsById: Map<string, BuilderComplianceItem>;
  /** Lever 1a cross-cutting NFR concerns (delivered as constraints, not tasks). */
  crossCuttingConstraints: BuilderCrossCuttingConstraint[];
  /** Pillar C — cross-phase SR→US/NFR resolver (the primary task→US/NFR join). */
  lineage: RequirementLineage;
}

export interface BuilderCrossCuttingConstraint {
  id: string;
  name: string;
  responsibilities: string[];
  applies_to_components: string[];
}

// ── Helpers ────────────────────────────────────────────────────────

function findUserStoriesForTask(
  task: BuilderAtomicTask['content']['task'],
  userStories: BuilderUserStory[],
  componentsById: Map<string, BuilderComponent>,
  matchedNfrs: BuilderNfr[],
  testCaseAcParents: Set<string>,
  lineage: RequirementLineage,
): BuilderUserStory[] {
  // Pass 0′ (MOST PRECISE) — task→leaf-AC→story. A Phase-6 task that cites the
  // specific leaf AC ids it implements (in traces_to) resolves to exactly the
  // leaf stories owning those ACs — the whole point of the Phase-6 binding.
  // Scopes the packet to the task's slice, not the whole component. Each matched
  // story is TRIMMED to the ACs the task actually cites (a leaf story can span
  // several tasks); otherwise the packet would carry sibling-task ACs that have
  // no test in THIS packet and fire P3. Falls through when a task carries no
  // leaf AC ids (refactoring tasks / pre-binding runs), preserving the passes below.
  const citedAcIds = new Set((task.traces_to ?? []).filter((t) => t.startsWith('AC-')));
  const { storyIds: acStoryIds } = lineage.resolveAcs(citedAcIds);
  if (acStoryIds.size > 0) {
    const mAc = userStories
      .filter((us) => acStoryIds.has(us.id))
      .map((us) => ({ ...us, acceptance_criteria: (us.acceptance_criteria ?? []).filter((ac) => citedAcIds.has(ac.id)) }))
      .filter((us) => us.acceptance_criteria.length > 0);
    if (mAc.length > 0) return mAc;
  }

  // Pass 0 (PRIMARY) — deterministic SR→US/NFR lineage bridge (Pillar C):
  // a task tracing SR-*/NFR-* resolves to the canonical US ids it serves via
  // system_requirements.source_requirement_ids + NFR.applies_to_requirements.
  // This is what fills user_stories (was ~0% before). The passes below remain
  // as fallback for runs where the lineage is incomplete.
  const { usIds: resolvedUs } = lineage.resolveTraces(task.traces_to ?? []);
  if (resolvedUs.size > 0) {
    const m0 = userStories.filter((us) => resolvedUs.has(us.id) || resolvedUs.has(lineage.canonicalize(us.id)));
    if (m0.length > 0) return m0;
  }
  // Each remaining pass is short-circuit: first non-empty result wins.
  let matched = matchUsViaTaskTraces(task, userStories);
  if (matched.length > 0) return matched;
  matched = matchUsViaComponent(task, userStories, componentsById);
  if (matched.length > 0) return matched;
  matched = matchUsViaNfrAppliesTo(userStories, matchedNfrs);
  if (matched.length > 0) return matched;
  // Pass 4 — composite AC parent extraction. ts-109 audit: when
  // task.traces_to/component.traces_to/NFR routes all miss, Phase 7
  // test cases (matched via suite.component_id == task.component_id)
  // still carry `acceptance_criterion_ids[]` referencing composite
  // ACs whose parent encodes the story id (`AC-FR-CAM-1.1-001` →
  // `FR-CAM-1.1`). Recovering the parent closes the gap.
  return matchUsViaCompositeAcParents(userStories, testCaseAcParents);
}

function matchUsViaTaskTraces(
  task: BuilderAtomicTask['content']['task'],
  userStories: BuilderUserStory[],
): BuilderUserStory[] {
  const traces = new Set(task.traces_to ?? []);
  if (traces.size === 0) return [];
  return userStories.filter((us) => traces.has(us.id));
}

function matchUsViaComponent(
  task: BuilderAtomicTask['content']['task'],
  userStories: BuilderUserStory[],
  componentsById: Map<string, BuilderComponent>,
): BuilderUserStory[] {
  if (!task.component_id) return [];
  const comp = componentsById.get(task.component_id);
  if (!comp) return [];
  const compIds = new Set<string>([comp.id]);
  for (const r of comp.responsibilities ?? []) {
    if (r.id) compIds.add(r.id);
  }
  return userStories.filter((us) =>
    (us.traces_to ?? []).some((t) => compIds.has(t)),
  );
}

function matchUsViaNfrAppliesTo(
  userStories: BuilderUserStory[],
  matchedNfrs: BuilderNfr[],
): BuilderUserStory[] {
  const usByIdFromNfrs = new Set<string>();
  for (const n of matchedNfrs) {
    for (const usId of n.applies_to_requirements ?? []) usByIdFromNfrs.add(usId);
  }
  if (usByIdFromNfrs.size === 0) return [];
  return userStories.filter((us) => usByIdFromNfrs.has(us.id));
}

function matchUsViaCompositeAcParents(
  userStories: BuilderUserStory[],
  testCaseAcParents: Set<string>,
): BuilderUserStory[] {
  if (testCaseAcParents.size === 0) return [];
  return userStories.filter((us) => testCaseAcParents.has(us.id));
}

function findNfrsForTask(
  task: BuilderAtomicTask['content']['task'],
  nfrs: BuilderNfr[],
  componentsById: Map<string, BuilderComponent>,
  lineage: RequirementLineage,
): BuilderNfr[] {
  // Pass 0 (PRIMARY) — lineage bridge: SR.source_requirement_ids carries the
  // NFR ids a task's SR traces derive from.
  const { nfrIds: resolvedNfr } = lineage.resolveTraces(task.traces_to ?? []);
  if (resolvedNfr.size > 0) {
    const m0 = nfrs.filter((n) => resolvedNfr.has(n.id) || resolvedNfr.has(lineage.canonicalize(n.id)));
    if (m0.length > 0) return m0;
  }
  const traces = new Set(task.traces_to ?? []);
  const matched: BuilderNfr[] = [];

  for (const n of nfrs) {
    if (traces.has(n.id)) matched.push(n);
  }
  if (matched.length > 0) return matched;

  if (!task.component_id) return matched;
  const comp = componentsById.get(task.component_id);
  if (!comp) return matched;
  const compIds = new Set<string>([comp.id, ...(comp.responsibilities ?? []).map((r) => r.id).filter(Boolean) as string[]]);
  for (const n of nfrs) {
    if ((n.traces_to ?? []).some((t) => compIds.has(t))) matched.push(n);
  }
  return matched;
}

/**
 * Collapse a matched user-story set to a single, consistent LEAF granularity
 * (the deterministic task→leaf binding). Group the stories by their canonical
 * root; for any group that contains a decomposed leaf, DROP the root and keep
 * the leaves — the root is represented by its leaves, which carry the leaf ACs
 * that the (leaf-grained) Phase-7 tests reference. A group with only its
 * never-decomposed root keeps the root unchanged.
 *
 * Without this, a packet double-lists `US-001` (root, ACs `AC-US001-001`) AND
 * its leaves (`US-001-01-1`, ACs `AC-US-001-01-1-001`); the root ACs have no
 * leaf test, so the coherence verifier fires P3_AC_NO_TEST on every one. After
 * collapse the packet carries only the leaf stories the task implements, whose
 * ACs the packet's tests cover.
 *
 * `canonicalize` MUST be the structural decomposition-tree resolver
 * (`lineage.canonicalize`) — leaf-vs-root is decided by walking the real
 * `requirement_decomposition_node` parent tree, never a regex on the id string
 * (no regex reliably models the LLM-minted leaf-id space).
 */
export function preferLeafStories<T extends { id: string }>(
  stories: T[],
  canonicalize: (id: string) => string,
): T[] {
  const byRoot = new Map<string, T[]>();
  for (const s of stories) {
    const root = canonicalize(s.id);
    const group = byRoot.get(root);
    if (group) group.push(s);
    else byRoot.set(root, [s]);
  }
  const out: T[] = [];
  for (const [root, group] of byRoot) {
    const leaves = group.filter((s) => s.id !== root);
    out.push(...(leaves.length > 0 ? leaves : group));
  }
  return out;
}

/**
 * Bridge NFRs to a task via the user stories the task implements: return
 * every NFR whose `applies_to_requirements` intersects `usIds` (which the
 * caller seeds with both leaf and canonical story ids). Complements
 * `findNfrsForTask` (trace/component passes) for the common case where
 * tasks trace SR-* and NFRs predate components, so the only link is
 * NFR→US.
 */
export function findNfrsByUserStories(usIds: Set<string>, nfrs: BuilderNfr[]): BuilderNfr[] {
  const out: BuilderNfr[] = [];
  for (const n of nfrs) {
    if ((n.applies_to_requirements ?? []).some((r) => usIds.has(r))) out.push(n);
  }
  return out;
}

function toPacketUserStory(us: BuilderUserStory): PacketUserStory {
  return {
    id: us.id,
    role: us.role ?? '',
    action: us.action ?? '',
    outcome: us.outcome ?? '',
    priority: us.priority ?? 'medium',
    acceptance_criteria: (us.acceptance_criteria ?? []).map((ac) => ({
      id: ac.id,
      description: ac.description ?? '',
      measurable_condition: ac.measurable_condition ?? '',
    })),
  };
}

function toPacketNfr(n: BuilderNfr): PacketNfr {
  const firstAc = (n.acceptance_criteria ?? [])[0];
  return {
    id: n.id,
    category: n.category ?? '',
    description: n.description ?? '',
    threshold: n.threshold,
    measurement_method: n.measurement_method,
    measurable_condition: firstAc?.measurable_condition,
  };
}

function toPacketComponent(comp: BuilderComponent): PacketComponent {
  return {
    id: comp.id,
    name: comp.name ?? '',
    domain_id: comp.domain_id ?? null,
    responsibilities: (comp.responsibilities ?? []).map((r) => ({
      id: r.id ?? '',
      description: r.description ?? r.statement ?? '',
      statement: r.statement,
    })).filter((r) => r.id && r.description),
    dependencies: (comp.dependencies ?? []).map((d) => ({
      component_id: d.component_id ?? d.target_component_id ?? '',
      kind: d.kind ?? d.dependency_type ?? 'sync_call',
    })).filter((d) => d.component_id),
    active_constraints: comp.active_constraints ?? [],
  };
}

function toPacketDataModel(dm: BuilderDataModel): PacketDataModel {
  return {
    id: dm.id,
    name: dm.name ?? '',
    component_id: dm.component_id ?? '',
    fields: (dm.fields ?? []).map((f) => ({
      name: f.name ?? '',
      type: f.type ?? '',
      constraints: f.constraints,
    })),
    ...(dm.traces_to && dm.traces_to.length > 0 ? { traces_to: dm.traces_to } : {}),
  };
}

function toPacketApi(api: BuilderApiDef): PacketApiDefinition {
  return {
    id: api.id,
    method: api.method ?? '',
    path: api.path ?? '',
    description: api.description ?? '',
    request_shape: api.request_shape,
    response_shape: api.response_shape,
    error_codes: api.error_codes,
    ...(api.traces_to && api.traces_to.length > 0 ? { traces_to: api.traces_to } : {}),
  };
}

/**
 * PD-7: bind API endpoints to a task, not just its component. `api_definitions`
 * are component-scoped (an endpoint's only structural key is `component_id`), so
 * a task got EVERY endpoint of its component and the executor could implement the
 * wrong contract. When Phase 5 minted `traces_to` (SR-/AC- ids) on the endpoints,
 * we keep only those whose traces intersect the task's requirement footprint
 * (`taskReqIds` = the task's SR/AC traces + the packet's US/AC/NFR ids). Endpoints
 * with NO linkage stay in (can't scope them — coverage-safe), and if NO endpoint
 * of the component is linked at all (pre-linkage run) we fall back to the whole
 * component set — so this never regresses an unlinked run, only narrows a linked one.
 */
function findApisForTask(
  componentId: string,
  apis: BuilderApiDef[],
  taskReqIds: Set<string>,
): PacketApiDefinition[] {
  const componentApis = apis.filter((api) => api.component_id === componentId);
  const anyLinked = componentApis.some((api) => (api.traces_to ?? []).length > 0);
  if (!anyLinked) return componentApis.map(toPacketApi); // pre-linkage run — no regression
  const scoped = componentApis.filter((api) => {
    const traces = api.traces_to ?? [];
    if (traces.length === 0) return true; // unlinked endpoint — keep (can't scope)
    return traces.some((t) => taskReqIds.has(t)); // linked — keep only if task-relevant
  });
  return scoped.map(toPacketApi);
}

/**
 * PD-7: the task's own component data models PLUS any cross-component entity the
 * task's requirement footprint reaches (the "missing write-target DM" symptom — a
 * DM a task writes that lives in another component). Component DMs are always
 * included (never lose the task's own entities); linked cross-component DMs are
 * ADDED only when their `traces_to` intersect `taskReqIds`. De-duped by id.
 */
function findDataModelsForTask(
  componentId: string,
  dataModels: BuilderDataModel[],
  taskReqIds: Set<string>,
): PacketDataModel[] {
  const out: PacketDataModel[] = [];
  const seen = new Set<string>();
  for (const dm of dataModels) {
    const own = dm.component_id === componentId;
    const linkedToTask = (dm.traces_to ?? []).some((t) => taskReqIds.has(t));
    if (!own && !linkedToTask) continue;
    if (seen.has(dm.id)) continue;
    seen.add(dm.id);
    out.push(toPacketDataModel(dm));
  }
  return out;
}

export function findTestCasesForAcs(
  acIds: Set<string>,
  usIds: Set<string>,
  testSuites: BuilderTestSuite[],
  componentId?: string,
): PacketTestCase[] {
  const out: PacketTestCase[] = [];
  for (const suite of testSuites) {
    // Suite→packet binding is driven by the AC/US id INTERSECTION below, not
    // by suite.component_id. Phase 7 organizes (and groups) its suites by the
    // coarse ROOT component model (comp-url-shortening), while Phase-9 packets
    // are scoped to the SATURATED LEAF components (comp-creation-api,
    // comp-slug-generator, …) that Phase 4.1a decomposed those roots into.
    // A hard `suite.component_id !== task.component_id` filter therefore
    // discarded every root-component suite from its own descendant leaf
    // packets, leaving them with zero test cases (the P3_AC_NO_TEST flood:
    // 162/192 packets had no tests though every packet AC was in fact covered
    // by a root-suite case). We no longer pre-filter by component.
    //
    // Bleed is prevented STRUCTURALLY by the leaf-AC namespace, not by the
    // component filter: since the task→leaf-AC binding, each packet's `acIds`
    // are the precise leaf ACs that one task implements (AC-US-001-1-003 maps
    // to exactly one leaf story → one task → one component). A test case binds
    // only when it references one of THIS packet's exact leaf ACs, so a
    // url-shortener case can never land in a persistence packet — their leaf
    // AC sets are disjoint. (The earlier cross-component bleed predated leaf-AC
    // binding, when packets carried whole-story ACs shared across components.)

    // Whole-suite pull — only when the suite is keyed to THIS task's exact
    // component. Kept narrow (exact match, never an ancestor) so a root suite
    // is NOT bulk-attached to every descendant leaf packet; the precise AC/US
    // intersection below is what pulls each leaf its own cases.
    const suiteMatchesComponent =
      !!componentId && !!suite.component_id && suite.component_id === componentId;

    for (const tc of suite.test_cases ?? []) {
      const refs = tc.acceptance_criterion_ids ?? [];
      // Pass 1 — strict AC id match. Phase 7 prompts (test_case_skeleton
      // + test_case_saturation) require `acceptance_criterion_ids[]`
      // verbatim from the FR summary; the matcher does not paper over
      // prompt drift with fuzzy id rewriting.
      const acMatch = refs.some((r) => acIds.has(r));
      // Direct US id matching is still legitimate when a test case
      // references a story rather than a specific AC.
      const usMatch = refs.some((r) => usIds.has(r));
      if (acMatch || usMatch || suiteMatchesComponent) {
        out.push({
          test_case_id: tc.test_case_id,
          type: tc.type ?? 'functional',
          acceptance_criterion_ids: refs,
          preconditions: tc.preconditions ?? [],
          expected_outcome: coerceOutcomeString(tc.expected_outcome),
          ...(tc.property_spec ? { property_spec: tc.property_spec } : {}),
        });
      }
    }
  }
  return out;
}

function findEvalsForUserStoriesAndNfrs(
  usIds: Set<string>,
  nfrIds: Set<string>,
  criteria: BuilderEvaluationCriterion[],
): PacketEvaluationCriterion[] {
  const out: PacketEvaluationCriterion[] = [];
  for (const c of criteria) {
    if (usIds.has(c.target_id) || nfrIds.has(c.target_id)) {
      out.push({
        kind: c.kind,
        target_id: c.target_id,
        evaluation_method: c.evaluation_method ?? '',
        success_condition: c.success_condition ?? '',
        ...(c.property_spec ? { property_spec: c.property_spec } : {}),
      });
    }
  }
  return out;
}

function buildActiveConstraints(
  ids: string[],
  byId: Map<string, BuilderTechnicalConstraint>,
): PacketActiveConstraint[] {
  const out: PacketActiveConstraint[] = [];
  for (const id of ids) {
    const tc = byId.get(id);
    if (tc) {
      out.push({
        id,
        category: tc.category ?? '',
        text: tc.text ?? '',
        technology: tc.technology,
        rationale: tc.rationale,
      });
    } else {
      // Constraint id referenced but not found — emit a placeholder so
      // the verifier flags it as an invented reference rather than
      // silently dropping it.
      out.push({ id, category: '', text: '' });
    }
  }
  return out;
}

function buildComplianceItems(
  refs: Iterable<string>,
  byId: Map<string, BuilderComplianceItem>,
): PacketComplianceItem[] {
  const out: PacketComplianceItem[] = [];
  for (const id of refs) {
    const item = byId.get(id);
    if (item) {
      out.push({
        id,
        kind: item.kind,
        description: item.description ?? '',
        measurable_condition: item.measurable_condition,
      });
    }
  }
  return out;
}

/**
 * Extract the set of upstream parent story/leaf ids that the given test
 * cases' `acceptance_criterion_ids[]` resolve back to. Used to bridge
 * the task→user_story join gap via composite AC IDs: a test case
 * referencing `AC-FR-CAM-1.1-001` tells us the originating story leaf
 * is `FR-CAM-1.1`, even when no other trace edge connects task and
 * story.
 */
function parentRefsFromTestCases(testCases: PacketTestCase[]): Set<string> {
  const out = new Set<string>();
  for (const tc of testCases) {
    for (const acRef of tc.acceptance_criterion_ids ?? []) {
      const parent = parentRefFromCompositeAc(acRef);
      if (parent) out.add(parent);
    }
  }
  return out;
}

function toPacketTask(t: BuilderAtomicTask): PacketTask {
  const task = t.content.task;
  return {
    id: task.id,
    node_id: t.content.node_id ?? t.node_id,
    name: task.name,
    description: task.description,
    task_type: task.task_type ?? 'standard',
    estimated_complexity: task.estimated_complexity ?? 'medium',
    completion_criteria: task.completion_criteria ?? [],
    write_directory_paths: task.write_directory_paths ?? [],
    read_directory_paths: task.read_directory_paths ?? [],
    dependency_task_ids: task.dependency_task_ids ?? [],
  };
}

/**
 * Bind each completion criterion to the packet test cases that cover it.
 * A criterion is covered by a test case when the test references one of the
 * criterion's `verifies_acceptance_criteria` (Phase-6 minted, validated) — or,
 * when the criterion cites no AC, by any of the task's own ACs (`taskAcIds`),
 * so leaf tasks whose criteria don't carry explicit AC links still bind to
 * their AC-bound tests. Returns the completion criteria with
 * `covered_by_test_ids` populated (deterministic; no fabrication).
 */
export function bindCompletionCriteriaToTests(
  completionCriteria: PacketTask['completion_criteria'],
  testCases: PacketTestCase[],
  taskAcIds: Set<string>,
): PacketTask['completion_criteria'] {
  return completionCriteria.map((cc) => {
    const linkedAcs = (cc.verifies_acceptance_criteria && cc.verifies_acceptance_criteria.length > 0)
      ? new Set(cc.verifies_acceptance_criteria)
      : taskAcIds;
    const covered = new Set<string>();
    for (const tc of testCases) {
      if ((tc.acceptance_criterion_ids ?? []).some((ac) => linkedAcs.has(ac))) {
        covered.add(tc.test_case_id);
      }
    }
    return { ...cc, covered_by_test_ids: [...covered] };
  });
}

// ── Main entry ─────────────────────────────────────────────────────

/**
 * Build one `ImplementationPacketContent` per atomic Phase 6.1a task.
 *
 * The output's `coherence` field is initialized to `passed: true` with
 * empty failures — the caller is expected to run the coherence verifier
 * (separate module) on each packet and overwrite this field with the
 * real result before persisting. We initialize defensively so the type
 * is satisfied and a no-coherence-check default emits a packet that
 * downstream code will still treat as if it had passed (matching the
 * conservative "synthesize as if coherent, then check" flow).
 */
export function buildPackets(input: BuilderInput): ImplementationPacketContent[] {
  const packets: ImplementationPacketContent[] = [];
  const packetIdByTaskId = new Map<string, string>();

  // Pre-allocate packet ids so depends_on_packets resolution works
  // regardless of build order.
  for (const t of input.atomicTasks) {
    packetIdByTaskId.set(t.content.task.id, randomUUID());
  }

  for (const t of input.atomicTasks) {
    const task = t.content.task;
    const componentId = task.component_id ?? '';
    // Provisional test-case match using only the suite.component_id
    // fallback — populated even when matchedUs/acIds are still empty.
    // We extract composite-AC parents from these and feed them into the
    // US/NFR matchers (Pass 4) so the join can recover from the
    // task-only-traces-to-component shape that broke ts-108/ts-109.
    const provisionalTestCases = findTestCasesForAcs(
      new Set(),
      new Set(),
      input.testSuites,
      componentId,
    );
    const provisionalAcParents = parentRefsFromTestCases(provisionalTestCases);

    // Match NFRs first — US matcher's Pass 3 walks matchedNfrs[].applies_to_requirements
    // to bridge the tasks-trace-NFR-but-not-US gap.
    const matchedNfrs = findNfrsForTask(task, input.nfrs, input.componentsById, input.lineage);
    const matchedUs = findUserStoriesForTask(
      task,
      input.userStories,
      input.componentsById,
      matchedNfrs,
      provisionalAcParents,
      input.lineage,
    );

    // Collapse to a consistent LEAF granularity for the packet CONTENT: the
    // leaf stories the task implements, matching its leaf-grained tests. The
    // canonical roots are dropped from `user_stories`/`acIds` (so P3 no longer
    // fires on un-tested root ACs) but kept in `usIds` below for the joins.
    // Leaf-vs-root is resolved STRUCTURALLY via the decomposition tree.
    const leafPreferredStories = preferLeafStories(matchedUs, input.lineage.canonicalize);

    // Fix 4 — cross-cutting fallback containment. A task with NO leaf-AC binding
    // (its traces_to cites no AC-* id) reaches the SR/component fallback, which
    // can leaf-expand a broad NFR-derived story (e.g. monitoring US-007/US-008)
    // into a dozen stories it doesn't really implement (the slice-135 13-story
    // packet). Cap such AC-less tasks to ONE representative per canonical root so
    // the packet doesn't balloon. Functional, AC-bound tasks are untouched.
    const taskCitesAc = (task.traces_to ?? []).some((x) => x.startsWith('AC-'));
    let packetStories = leafPreferredStories;
    if (!taskCitesAc && leafPreferredStories.length > 1) {
      const seenRoot = new Set<string>();
      packetStories = leafPreferredStories.filter((us) => {
        const root = input.lineage.canonicalize(us.id);
        if (seenRoot.has(root)) return false;
        seenRoot.add(root);
        return true;
      });
    }

    // Expand matched story ids (often DECOMPOSED leaves, e.g. US-004-1)
    // with their CANONICAL parents (US-004) so the NFR / eval / compliance
    // joins — which key on canonical US ids — resolve. ts-118: packets
    // matched leaf US-004-1 while NFR.applies_to_requirements and eval
    // target_id use canonical US-004, giving zero overlap → nfrs/evals/
    // compliance all 0%. (Built from matchedUs so both leaf + root ids are
    // present even after the content-level leaf collapse above.) Canonicalize
    // via the decomposition tree — handles every leaf form (US-002-1-D,
    // US-002-3-Leaf) that no regex could.
    const usIds = new Set<string>();
    for (const us of matchedUs) {
      usIds.add(us.id);
      usIds.add(input.lineage.canonicalize(us.id));
    }
    // Bridge NFRs that GOVERN the matched user stories. findNfrsForTask's
    // trace/component passes miss them here (tasks trace SR-*; NFRs predate
    // Phase-4 components), but NFR.applies_to_requirements carries the
    // canonical US ids the matched leaves normalize to.
    const directNfrIds = new Set(matchedNfrs.map((n) => n.id));
    const bridgedNfrs = findNfrsByUserStories(usIds, input.nfrs).filter((n) => !directNfrIds.has(n.id));
    const allNfrs = [...matchedNfrs, ...bridgedNfrs];
    const nfrIds = new Set(allNfrs.map((n) => n.id));
    const acIds = new Set<string>();
    for (const us of packetStories) {
      for (const ac of us.acceptance_criteria ?? []) acIds.add(ac.id);
    }

    const comp = componentId ? input.componentsById.get(componentId) : undefined;
    const packetComponent: PacketComponent = comp
      ? toPacketComponent(comp)
      : {
          id: componentId,
          name: '',
          domain_id: null,
          responsibilities: [],
          dependencies: [],
          active_constraints: [],
        };

    // PD-7 — the task's requirement footprint: the SR/AC ids the task traces, plus
    // the packet's resolved US/AC/NFR ids. API/DM endpoints minted with `traces_to`
    // are scoped to a task by intersecting against this set (see findApisForTask /
    // findDataModelsForTask); unlinked artifacts fall back to component scope.
    const taskReqIds = new Set<string>([
      ...(task.traces_to ?? []),
      ...acIds, ...usIds, ...nfrIds,
    ]);
    const dataModels = findDataModelsForTask(componentId, input.dataModels, taskReqIds);
    const apis = findApisForTask(componentId, input.apiDefinitions, taskReqIds);
    const testCases = findTestCasesForAcs(acIds, usIds, input.testSuites, componentId);
    const evals = findEvalsForUserStoriesAndNfrs(usIds, nfrIds, input.evaluationCriteria);

    // Active constraints inherited from the atomic task's saturation node.
    const activeConstraintIds = task.active_constraints ?? [];
    const activeConstraints = buildActiveConstraints(activeConstraintIds, input.technicalConstraintsById);
    // Lever 1a delivery: attach cross-cutting NFR concerns whose
    // applies_to_components includes this task's component (or that apply to
    // all). The executor receives them as constraints-to-honor, NOT as
    // separate modules/tasks to build.
    for (const cc of input.crossCuttingConstraints ?? []) {
      const applies = cc.applies_to_components ?? [];
      if (applies.length === 0 || applies.includes(componentId)) {
        activeConstraints.push({
          id: cc.id,
          category: 'cross_cutting_nfr',
          text: `NFR concern (${cc.name}): ${(cc.responsibilities ?? []).join('; ')}`,
        });
      }
    }

    // Compliance items — gather all upstream COMP-*/VV-*/QA-* refs from
    // every reachable trace path:
    //   user_stories.traces_to    (when US matching produces hits)
    //   component.traces_to       (when components reference compliance directly)
    //   task.traces_to            (rarely — tasks usually trace SR-/NFR-)
    //   matchedNfrs.traces_to     (the load-bearing path in ts-108 — tasks trace
    //                              NFR-* ids; those NFRs in turn trace VV-* ids)
    //
    // ts-108 audit: tasks emit only SR-*/NFR-* in their traces_to; without
    // walking matchedNfrs.traces_to, VV-* compliance items never reach
    // the packet. Same shape as the US-traces gap but one hop deeper.
    const complianceRefs = new Set<string>();
    const collectFromTraces = (traces: string[] | undefined): void => {
      if (!traces) return;
      for (const t of traces) {
        if (/^(COMP|VV|QA)-/.test(t)) complianceRefs.add(t);
      }
    };
    for (const us of matchedUs) collectFromTraces(us.traces_to);
    if (comp) collectFromTraces(comp.traces_to);
    collectFromTraces(task.traces_to);
    for (const n of allNfrs) collectFromTraces(n.traces_to);
    const complianceItems = buildComplianceItems(complianceRefs, input.complianceItemsById);

    // depends_on_packets — translate dependency_task_ids → packet ids.
    const dependsOnPackets: string[] = [];
    for (const depTaskId of task.dependency_task_ids ?? []) {
      const depPacketId = packetIdByTaskId.get(depTaskId);
      if (depPacketId) dependsOnPackets.push(depPacketId);
    }

    const packetId = packetIdByTaskId.get(task.id) as string;

    // Bind each completion criterion to its covering test cases (via its
    // verified ACs, or the task's AC set as fallback) so the executor's
    // authoritative deliverable is test-backed, not just the ACs.
    const packetTask = toPacketTask(t);
    packetTask.completion_criteria = bindCompletionCriteriaToTests(
      packetTask.completion_criteria, testCases, acIds,
    );

    packets.push({
      kind: 'implementation_packet',
      schemaVersion: '1.0',
      packet_id: packetId,
      task: packetTask,
      user_stories: packetStories.map(toPacketUserStory),
      nfrs: allNfrs.map(toPacketNfr),
      component: packetComponent,
      data_models: dataModels,
      api_definitions: apis,
      test_cases: testCases,
      evaluation_criteria: evals,
      active_constraints: activeConstraints,
      compliance_items: complianceItems,
      depends_on_packets: dependsOnPackets,
      coherence: {
        passed: true,
        blocking_failures: [],
        advisory_findings: [],
        annotations: { ai_proposed_root_count: 0, ai_proposed_root_ids: [] },
      },
      release_id: t.content.release_id ?? null,
      release_ordinal: t.content.release_ordinal ?? null,
    });
  }

  return packets;
}
