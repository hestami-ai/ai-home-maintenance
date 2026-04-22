/**
 * Phase context extraction — gathers rich structured data from prior
 * phase artifacts for use in downstream prompts.
 *
 * Replaces the lossy `.slice(0, 500)` summaries that caused hallucination
 * cascades: phases were receiving "1 components: Core Module" instead of
 * the actual component list with responsibilities, IDs, and dependencies.
 *
 * Each extractor returns:
 *   - `summary`: a compact human-readable summary for the prompt CONTEXT section
 *   - `structured`: the full JSON for the detail file or inline context
 *   - `ids`: all artifact IDs referenced (for derived_from_record_ids)
 */

import type { GovernedStreamRecord } from '../../types/records';

// ── Types ──────────────────────────────────────────────────────────

export interface PriorPhaseContext {
  /** Phase 1 outputs */
  intentStatement: ArtifactContext | null;
  /** Phase 2 outputs */
  functionalRequirements: ArtifactContext | null;
  nonFunctionalRequirements: ArtifactContext | null;
  /** Phase 3 outputs */
  systemBoundary: ArtifactContext | null;
  systemRequirements: ArtifactContext | null;
  interfaceContracts: ArtifactContext | null;
  /** Phase 4 outputs */
  softwareDomains: ArtifactContext | null;
  componentModel: ArtifactContext | null;
  architecturalDecisions: ArtifactContext | null;
  /** Phase 5 outputs */
  dataModels: ArtifactContext | null;
  apiDefinitions: ArtifactContext | null;
  errorHandlingStrategies: ArtifactContext | null;
  configurationParameters: ArtifactContext | null;
  /** Phase 6 outputs */
  implementationPlan: ArtifactContext | null;
  /** Phase 7 outputs */
  testPlan: ArtifactContext | null;
  testCoverageReport: ArtifactContext | null;
  /** Phase 8 outputs */
  functionalEvalPlan: ArtifactContext | null;
  qualityEvalPlan: ArtifactContext | null;
  /** Derived from IDs for all found artifacts */
  allRecordIds: string[];
  /** Project type description from system boundary */
  projectTypeDescription: string;
}

export interface ArtifactContext {
  recordId: string;
  /** Full content (minus the `kind` field) for inline/detail context */
  content: Record<string, unknown>;
  /** Compact summary for the prompt CONTEXT section */
  summary: string;
}

// ── Extractor ──────────────────────────────────────────────────────

/**
 * Extract rich structured context from all prior phase artifacts.
 * Call this once at the start of a phase handler, then use the
 * `.summary` and `.content` fields in prompt templates.
 */
export function extractPriorPhaseContext(
  allArtifacts: GovernedStreamRecord[],
): PriorPhaseContext {
  const ctx: PriorPhaseContext = {
    intentStatement: null,
    functionalRequirements: null,
    nonFunctionalRequirements: null,
    systemBoundary: null,
    systemRequirements: null,
    interfaceContracts: null,
    softwareDomains: null,
    componentModel: null,
    architecturalDecisions: null,
    dataModels: null,
    apiDefinitions: null,
    errorHandlingStrategies: null,
    configurationParameters: null,
    implementationPlan: null,
    testPlan: null,
    testCoverageReport: null,
    functionalEvalPlan: null,
    qualityEvalPlan: null,
    allRecordIds: [],
    projectTypeDescription: '',
  };

  for (const record of allArtifacts) {
    const content = record.content as Record<string, unknown>;
    const kind = content.kind as string | undefined;
    if (!kind) continue;

    const base = { ...content };
    delete base.kind;

    switch (kind) {
      case 'intent_statement':
        ctx.intentStatement = {
          recordId: record.id,
          content: base,
          summary: summarizeIntentStatement(base),
        };
        break;
      case 'functional_requirements':
        ctx.functionalRequirements = {
          recordId: record.id,
          content: base,
          summary: summarizeFunctionalRequirements(base),
        };
        break;
      case 'non_functional_requirements':
        ctx.nonFunctionalRequirements = {
          recordId: record.id,
          content: base,
          summary: summarizeNonFunctionalRequirements(base),
        };
        break;
      case 'system_boundary':
        ctx.systemBoundary = {
          recordId: record.id,
          content: base,
          summary: summarizeSystemBoundary(base),
        };
        break;
      case 'system_requirements':
        ctx.systemRequirements = {
          recordId: record.id,
          content: base,
          summary: summarizeSystemRequirements(base),
        };
        break;
      case 'interface_contracts':
        ctx.interfaceContracts = {
          recordId: record.id,
          content: base,
          summary: summarizeInterfaceContracts(base),
        };
        break;
      case 'software_domains':
        ctx.softwareDomains = {
          recordId: record.id,
          content: base,
          summary: summarizeSoftwareDomains(base),
        };
        break;
      case 'component_model':
        ctx.componentModel = {
          recordId: record.id,
          content: base,
          summary: summarizeComponentModel(base),
        };
        break;
      case 'architectural_decisions':
        ctx.architecturalDecisions = {
          recordId: record.id,
          content: base,
          summary: summarizeArchitecturalDecisions(base),
        };
        break;
      case 'data_models':
        ctx.dataModels = {
          recordId: record.id,
          content: base,
          summary: summarizeDataModels(base),
        };
        break;
      case 'api_definitions':
        ctx.apiDefinitions = {
          recordId: record.id,
          content: base,
          summary: summarizeApiDefinitions(base),
        };
        break;
      case 'error_handling_strategies':
        ctx.errorHandlingStrategies = {
          recordId: record.id,
          content: base,
          summary: summarizeGenericArtifact('Error Handling Strategies', base),
        };
        break;
      case 'configuration_parameters':
        ctx.configurationParameters = {
          recordId: record.id,
          content: base,
          summary: summarizeGenericArtifact('Configuration Parameters', base),
        };
        break;
      case 'implementation_plan':
        ctx.implementationPlan = {
          recordId: record.id,
          content: base,
          summary: summarizeImplementationPlan(base),
        };
        break;
      case 'test_plan':
        ctx.testPlan = {
          recordId: record.id,
          content: base,
          summary: summarizeTestPlan(base),
        };
        break;
      case 'test_coverage_report':
        ctx.testCoverageReport = {
          recordId: record.id,
          content: base,
          summary: summarizeGenericArtifact('Test Coverage Report', base),
        };
        break;
      case 'functional_evaluation_plan':
        ctx.functionalEvalPlan = {
          recordId: record.id,
          content: base,
          summary: summarizeGenericArtifact('Functional Evaluation Plan', base),
        };
        break;
      case 'quality_evaluation_plan':
        ctx.qualityEvalPlan = {
          recordId: record.id,
          content: base,
          summary: summarizeGenericArtifact('Quality Evaluation Plan', base),
        };
        break;
    }
  }

  // Collect all record IDs
  const fields = Object.values(ctx).filter(
    (v): v is ArtifactContext => v !== null && typeof v === 'object' && 'recordId' in v,
  );
  ctx.allRecordIds = fields.map(f => f.recordId);

  // Build project type description from system boundary
  ctx.projectTypeDescription = buildProjectTypeDescription(ctx);

  return ctx;
}

// ── Summary builders ───────────────────────────────────────────────
// These produce compact but ID-preserving summaries. The key principle:
// ALWAYS include IDs so downstream phases can reference them correctly.

function summarizeIntentStatement(c: Record<string, unknown>): string {
  const pc = c.product_concept as Record<string, unknown> | undefined;
  if (!pc) return 'No intent statement';
  return [
    `Product: ${pc.name} — ${pc.description}`,
    `Who it serves: ${pc.who_it_serves}`,
    `Problem: ${pc.problem_it_solves}`,
    `Confirmed assumptions: ${JSON.stringify(c.confirmed_assumptions ?? [])}`,
    `Confirmed constraints: ${JSON.stringify(c.confirmed_constraints ?? [])}`,
    `Out of scope: ${JSON.stringify(c.out_of_scope ?? [])}`,
  ].join('\n');
}

function summarizeFunctionalRequirements(c: Record<string, unknown>): string {
  const stories = (c.user_stories as Array<Record<string, unknown>>) ?? [];
  const lines = stories.map(s => {
    const acs = (s.acceptance_criteria as Array<Record<string, unknown>>) ?? [];
    const acList = acs.map(ac => `    ${ac.id}: ${ac.measurable_condition ?? ac.description}`).join('\n');
    return `  ${s.id} [${s.priority}]: As a ${s.role}, I want ${s.action}, so that ${s.outcome}\n    Acceptance Criteria:\n${acList}`;
  });
  return `${stories.length} User Stories:\n${lines.join('\n')}`;
}

function summarizeNonFunctionalRequirements(c: Record<string, unknown>): string {
  const reqs = (c.requirements as Array<Record<string, unknown>>) ?? [];
  const lines = reqs.map(r =>
    `  ${r.id} [${r.category}]: ${r.description} — threshold: ${r.threshold}`,
  );
  return `${reqs.length} NFRs:\n${lines.join('\n')}`;
}

function summarizeSystemBoundary(c: Record<string, unknown>): string {
  const inScope = (c.in_scope as string[]) ?? [];
  const outScope = (c.out_of_scope as string[]) ?? [];
  const external = (c.external_systems as Array<Record<string, unknown>>) ?? [];
  return [
    `In scope: ${inScope.join('; ')}`,
    `Out of scope: ${outScope.join('; ')}`,
    `External systems: ${external.map(e => `${e.id}: ${e.name} (${e.interface_type})`).join('; ') || 'none'}`,
  ].join('\n');
}

function summarizeSystemRequirements(c: Record<string, unknown>): string {
  const items = (c.items as Array<Record<string, unknown>>) ?? [];
  const lines = items.map(i =>
    `  ${i.id} [${i.priority}]: ${i.statement} (traces to: ${JSON.stringify(i.source_requirement_ids)})`,
  );
  return `${items.length} System Requirements:\n${lines.join('\n')}`;
}

function summarizeInterfaceContracts(c: Record<string, unknown>): string {
  const contracts = (c.contracts as Array<Record<string, unknown>>) ?? [];
  const lines = contracts.map(ic =>
    `  ${ic.id}: ${(ic.systems_involved as string[])?.join(' <-> ')} via ${ic.protocol} (${ic.data_format})`,
  );
  return `${contracts.length} Interface Contracts:\n${lines.join('\n')}`;
}

function summarizeSoftwareDomains(c: Record<string, unknown>): string {
  const domains = (c.domains as Array<Record<string, unknown>>) ?? [];
  const lines = domains.map(d => {
    const terms = (d.ubiquitous_language as Array<Record<string, unknown>>) ?? [];
    const termList = terms.map(t => `${t.term}: ${t.definition}`).join('; ');
    const reqIds = (d.system_requirement_ids as string[]) ?? [];
    return `  ${d.id}: ${d.name} (reqs: ${reqIds.join(', ')})\n    Terms: ${termList}`;
  });
  return `${domains.length} Software Domains:\n${lines.join('\n')}`;
}

function summarizeComponentModel(c: Record<string, unknown>): string {
  const components = (c.components as Array<Record<string, unknown>>) ?? [];
  const lines = components.map(comp => {
    const resps = (comp.responsibilities as Array<Record<string, unknown>>) ?? [];
    const respList = resps.map(r => `    ${r.id}: ${r.statement}`).join('\n');
    const deps = (comp.dependencies as Array<Record<string, unknown>>) ?? [];
    const depList = deps.map(d => `${d.target_component_id} (${d.dependency_type})`).join(', ');
    return `  ${comp.id}: ${comp.name} (domain: ${comp.domain_id ?? 'unassigned'})\n    Responsibilities:\n${respList}\n    Dependencies: ${depList || 'none'}`;
  });
  return `${components.length} Components:\n${lines.join('\n')}`;
}

function summarizeArchitecturalDecisions(c: Record<string, unknown>): string {
  const adrs = (c.adrs as Array<Record<string, unknown>>) ?? [];
  const lines = adrs.map(a =>
    `  ${a.id}: ${a.title} [${a.status}] — Decision: ${a.decision}`,
  );
  return `${adrs.length} ADRs:\n${lines.join('\n')}`;
}

function summarizeDataModels(c: Record<string, unknown>): string {
  const models = (c.models as Array<Record<string, unknown>>) ?? [];
  const lines = models.map(m => {
    const entities = (m.entities as Array<Record<string, unknown>>) ?? [];
    const entList = entities.map(e => {
      const fields = (e.fields as Array<Record<string, unknown>>) ?? [];
      return `    ${e.name}: ${fields.map(f => `${f.name}:${f.type}`).join(', ')}`;
    }).join('\n');
    return `  Component ${m.component_id}:\n${entList}`;
  });
  return `${models.length} Data Models:\n${lines.join('\n')}`;
}

function summarizeApiDefinitions(c: Record<string, unknown>): string {
  const defs = (c.definitions as Array<Record<string, unknown>>) ?? [];
  const lines = defs.map(d => {
    const endpoints = (d.endpoints as Array<Record<string, unknown>>) ?? [];
    const epList = endpoints.map(e => `    ${e.method} ${e.path} (auth: ${e.auth_requirement ?? 'none'})`).join('\n');
    return `  Component ${d.component_id}:\n${epList}`;
  });
  return `${defs.length} API Definitions:\n${lines.join('\n')}`;
}

function summarizeImplementationPlan(c: Record<string, unknown>): string {
  const tasks = (c.tasks as Array<Record<string, unknown>>) ?? [];
  const lines = tasks.map(t => {
    const criteria = (t.completion_criteria as Array<Record<string, unknown>>) ?? [];
    return `  ${t.id} [${t.estimated_complexity}]: ${t.description}\n    Component: ${t.component_id}, Responsibility: ${t.component_responsibility}\n    Backing tool: ${t.backing_tool}\n    Dependencies: ${JSON.stringify(t.dependency_task_ids ?? [])}\n    Completion criteria: ${criteria.map(cc => cc.description).join('; ')}`;
  });
  return `${tasks.length} Implementation Tasks:\n${lines.join('\n')}`;
}

function summarizeTestPlan(c: Record<string, unknown>): string {
  const suites = (c.test_suites as Array<Record<string, unknown>>) ?? [];
  const lines = suites.map(s => {
    const cases = (s.test_cases as Array<Record<string, unknown>>) ?? [];
    const caseList = cases.map(tc =>
      `    ${tc.test_case_id} [${tc.type}]: traces to ${JSON.stringify(tc.acceptance_criterion_ids)}, expected: ${tc.expected_outcome}`,
    ).join('\n');
    return `  ${s.suite_id} (${s.test_type}, component: ${s.component_id}):\n${caseList}`;
  });
  return `${suites.length} Test Suites:\n${lines.join('\n')}`;
}

function summarizeGenericArtifact(name: string, c: Record<string, unknown>): string {
  return `${name}:\n${JSON.stringify(c, null, 2).slice(0, 2000)}`;
}

/**
 * Build a project-type description from the system boundary and intent.
 * This is forwarded to all downstream phases so the LLM knows whether
 * it's building a CLI app, web service, mobile app, etc.
 */
function buildProjectTypeDescription(ctx: PriorPhaseContext): string {
  const parts: string[] = [];

  if (ctx.intentStatement) {
    const pc = ctx.intentStatement.content.product_concept as Record<string, unknown> | undefined;
    if (pc) parts.push(`${pc.name}: ${pc.description}`);
  }

  if (ctx.systemBoundary) {
    const inScope = (ctx.systemBoundary.content.in_scope as string[]) ?? [];
    const outScope = (ctx.systemBoundary.content.out_of_scope as string[]) ?? [];
    if (inScope.length > 0) parts.push(`Capabilities: ${inScope.join('; ')}`);
    if (outScope.length > 0) parts.push(`Excluded: ${outScope.join('; ')}`);
  }

  return parts.join('\n') || 'No project type information available';
}

// ── Product Description Handoff reader (wave 5) ────────────────────
//
// Downstream phase handlers (Phase 2 first; 3–9 follow in later waves)
// consult this helper to locate the latest product_description_handoff
// record for a workflow run. When the run ran under the product lens
// this record is dense (all the decomposed extractions + bloom outputs
// composed into one handoff); when the run used the default lens,
// no handoff exists and consumers fall back to reading
// `intent_statement` via `extractPriorPhaseContext`.

/**
 * Locate the latest `product_description_handoff` record in the
 * workflow's stream. Returns null when the handoff isn't present —
 * callers then fall back to the thin `intent_statement` path.
 *
 * Shape-wise, the returned record has its `content` already parsed as
 * the ProductDescriptionHandoffContent object. We don't typecast to
 * that specific type here to keep this helper lens-agnostic; callers
 * can narrow via `import type` when they need specific fields.
 */
export function findProductDescriptionHandoff(
  records: ReadonlyArray<GovernedStreamRecord>,
): { recordId: string; content: Record<string, unknown> } | null {
  // Walk newest-first so a re-run (rare under phase-limit 1, but
  // possible on partial resume) picks up the latest.
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r.record_type !== 'product_description_handoff') continue;
    if (!r.content || typeof r.content !== 'object') continue;
    return { recordId: r.id, content: r.content };
  }
  return null;
}

// ── Wave 6 — frozen-leaf projection for downstream phases ──────────

/**
 * Shape returned from the frozen-leaf projection. Each leaf carries its
 * node_id so callers can key back into the decomposition tree when they
 * need parent context. The `user_story` shape matches the FR artifact's
 * `user_stories[]` shape, so callers can treat it interchangeably.
 */
export interface FrozenFrLeaf {
  /** Logical UUID (content.node_id) — stable across revisions. */
  node_id: string;
  /** Root's logical UUID. */
  root_fr_id: string;
  /** Sibling-unique human label (content.display_key) — for summaries + UIs. */
  display_key: string;
  /** Root's human label, if resolvable from the stream. Falls back to root_fr_id (UUID). */
  root_display_key: string;
  depth: number;
  tier: 'A' | 'B' | 'C' | 'D' | null;
  user_story: {
    id: string;
    role: string;
    action: string;
    outcome: string;
    acceptance_criteria: Array<{ id: string; description: string; measurable_condition: string }>;
    priority: string;
    traces_to?: string[];
  };
}

/**
 * Wave 6 — walk all requirement_decomposition_node records and return
 * the set of frozen leaves: nodes whose current-version status is
 * `atomic`. Used by downstream phase handlers (4/5/7/8) that want to
 * consume the leaf-level FR tree rather than the coarse root FRs from
 * the `functional_requirements` artifact.
 *
 * Fallback behavior: if there are no decomposition-node records (e.g.
 * default-lens runs that skipped Phase 2.1a), returns an empty array.
 * Callers should check `.length === 0` and fall back to the root FRs
 * from `extractPriorPhaseContext(...).functionalRequirements`.
 *
 * Supersession handling: records with the same `content.node_id` may
 * appear multiple times (e.g. a `pending` record superseded by
 * `pruned` / `deferred` / `downgraded` / `atomic`). We pick the latest
 * version per `node_id` by `produced_at` and only include nodes whose
 * latest version has `status: 'atomic'`.
 */
/**
 * Compute the "effective FR set" for a downstream phase handler: a pair
 * of (stories, summary) sourced from the frozen leaves when present,
 * otherwise from the root `functional_requirements` artifact. `source`
 * indicates which path was taken so callers can log or attribute
 * accordingly. Writer-type note: `decompositionNodes` is whatever
 * `getRecordsByType(runId, 'requirement_decomposition_node')` returns;
 * the caller passes it in rather than this helper reaching into the
 * engine to keep this module framework-agnostic.
 */
export interface EffectiveFrView {
  stories: Array<Record<string, unknown>>;
  summary: string;
  source: 'leaves' | 'roots' | 'none';
  leafCount: number;
  rootCount: number;
}

export function buildEffectiveFrView(
  decompositionNodes: GovernedStreamRecord[],
  prior: PriorPhaseContext,
): EffectiveFrView {
  const leaves = getFrozenFrLeaves(decompositionNodes);
  const rootStories = (prior.functionalRequirements?.content.user_stories as Array<Record<string, unknown>>) ?? [];
  if (leaves.length > 0) {
    const storyRecords = leaves.map(l => l.user_story as unknown as Record<string, unknown>);
    const summaryLines = leaves.map(l =>
      `${l.display_key} [${l.user_story.priority}] (Tier ${l.tier ?? '?'} leaf under ${l.root_display_key}): As a ${l.user_story.role}, I want ${l.user_story.action}, so that ${l.user_story.outcome}.`,
    );
    return {
      stories: storyRecords,
      summary: summaryLines.join('\n'),
      source: 'leaves',
      leafCount: leaves.length,
      rootCount: rootStories.length,
    };
  }
  if (rootStories.length > 0) {
    return {
      stories: rootStories,
      summary: prior.functionalRequirements?.summary ?? '',
      source: 'roots',
      leafCount: 0,
      rootCount: rootStories.length,
    };
  }
  return {
    stories: [],
    summary: 'No functional requirements available',
    source: 'none',
    leafCount: 0,
    rootCount: 0,
  };
}

export function getFrozenFrLeaves(
  allArtifacts: GovernedStreamRecord[],
): FrozenFrLeaf[] {
  // Collect current version per node_id (logical UUID).
  const latestByNodeId = new Map<string, GovernedStreamRecord>();
  for (const r of allArtifacts) {
    if (r.record_type !== 'requirement_decomposition_node') continue;
    const c = r.content as Record<string, unknown>;
    const nodeId = typeof c.node_id === 'string' ? c.node_id : null;
    if (!nodeId) continue;
    const existing = latestByNodeId.get(nodeId);
    if (!existing || r.produced_at > existing.produced_at) {
      latestByNodeId.set(nodeId, r);
    }
  }
  // Root display-key lookup: root's logical UUID → its display_key (if
  // available). Roots are depth-0 nodes; their display_key is the LLM's
  // raw story.id (sibling-collision-suffixed if required).
  const rootDisplayKeyByUuid = new Map<string, string>();
  for (const r of latestByNodeId.values()) {
    const c = r.content as Record<string, unknown>;
    if (c.depth !== 0) continue;
    const rootUuid = typeof c.node_id === 'string' ? c.node_id : null;
    const display = typeof c.display_key === 'string' ? c.display_key : null;
    if (rootUuid && display) rootDisplayKeyByUuid.set(rootUuid, display);
  }
  const leaves: FrozenFrLeaf[] = [];
  for (const r of latestByNodeId.values()) {
    const c = r.content as Record<string, unknown>;
    if (c.status !== 'atomic') continue;
    const story = c.user_story as FrozenFrLeaf['user_story'] | undefined;
    if (!story) continue;
    const rootFrId = typeof c.root_fr_id === 'string' ? c.root_fr_id : '';
    leaves.push({
      node_id: typeof c.node_id === 'string' ? c.node_id : '',
      root_fr_id: rootFrId,
      display_key: typeof c.display_key === 'string' ? c.display_key : (story.id ?? ''),
      root_display_key: rootDisplayKeyByUuid.get(rootFrId) ?? rootFrId,
      depth: typeof c.depth === 'number' ? c.depth : 0,
      tier: (c.tier === 'A' || c.tier === 'B' || c.tier === 'C' || c.tier === 'D')
        ? c.tier as FrozenFrLeaf['tier']
        : null,
      user_story: story,
    });
  }
  return leaves;
}
