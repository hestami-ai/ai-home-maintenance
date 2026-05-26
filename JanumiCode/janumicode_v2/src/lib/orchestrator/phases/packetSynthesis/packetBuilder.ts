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
} from '../../../types/records';

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
      backing_tool?: string;
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
    expected_outcome?: string;
  }>;
}

export interface BuilderEvaluationCriterion {
  kind: 'functional' | 'quality' | 'reasoning';
  /** Eval shape varies between functional (functional_requirement_id) and quality (nonfunctional_requirement_id). */
  target_id: string;
  evaluation_method?: string;
  success_condition?: string;
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
}

// ── Helpers ────────────────────────────────────────────────────────

function findUserStoriesForTask(
  task: BuilderAtomicTask['content']['task'],
  userStories: BuilderUserStory[],
  componentsById: Map<string, BuilderComponent>,
): BuilderUserStory[] {
  const traces = new Set(task.traces_to ?? []);
  const matched: BuilderUserStory[] = [];

  // Pass 1 — task.traces_to literally cites US ids.
  for (const us of userStories) {
    if (traces.has(us.id)) matched.push(us);
  }
  if (matched.length > 0) return matched;

  // Pass 2 — fallback: match via the task's component → user stories whose
  // traces_to or any other reference cites the component id or one of its
  // responsibility ids.
  if (!task.component_id) return matched;
  const comp = componentsById.get(task.component_id);
  if (!comp) return matched;
  const compIds = new Set<string>([comp.id]);
  for (const r of comp.responsibilities ?? []) {
    if (r.id) compIds.add(r.id);
  }
  for (const us of userStories) {
    const usTraces = us.traces_to ?? [];
    if (usTraces.some((t) => compIds.has(t))) matched.push(us);
  }
  return matched;
}

function findNfrsForTask(
  task: BuilderAtomicTask['content']['task'],
  nfrs: BuilderNfr[],
  componentsById: Map<string, BuilderComponent>,
): BuilderNfr[] {
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

function findDataModelsForComponent(componentId: string, dataModels: BuilderDataModel[]): PacketDataModel[] {
  return dataModels
    .filter((dm) => dm.component_id === componentId)
    .map((dm) => ({
      id: dm.id,
      name: dm.name ?? '',
      component_id: dm.component_id ?? '',
      fields: (dm.fields ?? []).map((f) => ({
        name: f.name ?? '',
        type: f.type ?? '',
        constraints: f.constraints,
      })),
    }));
}

function findApisForComponent(componentId: string, apis: BuilderApiDef[]): PacketApiDefinition[] {
  return apis
    .filter((api) => api.component_id === componentId)
    .map((api) => ({
      id: api.id,
      method: api.method ?? '',
      path: api.path ?? '',
      description: api.description ?? '',
      request_shape: api.request_shape,
      response_shape: api.response_shape,
      error_codes: api.error_codes,
    }));
}

function findTestCasesForAcs(
  acIds: Set<string>,
  usIds: Set<string>,
  testSuites: BuilderTestSuite[],
): PacketTestCase[] {
  const out: PacketTestCase[] = [];
  for (const suite of testSuites) {
    for (const tc of suite.test_cases ?? []) {
      const refs = tc.acceptance_criterion_ids ?? [];
      // Strict match: an AC id appears directly OR a `${us}-${suffix}`
      // style ref is used (the ts-16 failure mode where test cases use a
      // composite-id namespace).
      const hits = refs.some((r) =>
        acIds.has(r) ||
        Array.from(usIds).some((us) => r === us || r.startsWith(`${us}-`)),
      );
      if (hits) {
        out.push({
          test_case_id: tc.test_case_id,
          type: tc.type ?? 'functional',
          acceptance_criterion_ids: refs,
          preconditions: tc.preconditions ?? [],
          expected_outcome: tc.expected_outcome ?? '',
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

function toPacketTask(t: BuilderAtomicTask): PacketTask {
  const task = t.content.task;
  return {
    id: task.id,
    node_id: t.content.node_id ?? t.node_id,
    name: task.name,
    description: task.description,
    task_type: task.task_type ?? 'standard',
    backing_tool: task.backing_tool ?? 'claude_code_cli',
    estimated_complexity: task.estimated_complexity ?? 'medium',
    completion_criteria: task.completion_criteria ?? [],
    write_directory_paths: task.write_directory_paths ?? [],
    read_directory_paths: task.read_directory_paths ?? [],
    dependency_task_ids: task.dependency_task_ids ?? [],
  };
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
    const matchedUs = findUserStoriesForTask(task, input.userStories, input.componentsById);
    const matchedNfrs = findNfrsForTask(task, input.nfrs, input.componentsById);

    const usIds = new Set(matchedUs.map((us) => us.id));
    const nfrIds = new Set(matchedNfrs.map((n) => n.id));
    const acIds = new Set<string>();
    for (const us of matchedUs) {
      for (const ac of us.acceptance_criteria ?? []) acIds.add(ac.id);
    }

    const componentId = task.component_id ?? '';
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

    const dataModels = findDataModelsForComponent(componentId, input.dataModels);
    const apis = findApisForComponent(componentId, input.apiDefinitions);
    const testCases = findTestCasesForAcs(acIds, usIds, input.testSuites);
    const evals = findEvalsForUserStoriesAndNfrs(usIds, nfrIds, input.evaluationCriteria);

    // Active constraints inherited from the atomic task's saturation node.
    const activeConstraintIds = task.active_constraints ?? [];
    const activeConstraints = buildActiveConstraints(activeConstraintIds, input.technicalConstraintsById);

    // Compliance items — gather all upstream COMP-*/VV-*/QA-* refs from
    // user_stories.traces_to + component.traces_to.
    const complianceRefs = new Set<string>();
    for (const us of matchedUs) {
      for (const t of us.traces_to ?? []) {
        if (/^(COMP|VV|QA)-/.test(t)) complianceRefs.add(t);
      }
    }
    if (comp) {
      for (const t of comp.traces_to ?? []) {
        if (/^(COMP|VV|QA)-/.test(t)) complianceRefs.add(t);
      }
    }
    const complianceItems = buildComplianceItems(complianceRefs, input.complianceItemsById);

    // depends_on_packets — translate dependency_task_ids → packet ids.
    const dependsOnPackets: string[] = [];
    for (const depTaskId of task.dependency_task_ids ?? []) {
      const depPacketId = packetIdByTaskId.get(depTaskId);
      if (depPacketId) dependsOnPackets.push(depPacketId);
    }

    const packetId = packetIdByTaskId.get(task.id) as string;

    packets.push({
      kind: 'implementation_packet',
      schemaVersion: '1.0',
      packet_id: packetId,
      task: toPacketTask(t),
      user_stories: matchedUs.map(toPacketUserStory),
      nfrs: matchedNfrs.map(toPacketNfr),
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
