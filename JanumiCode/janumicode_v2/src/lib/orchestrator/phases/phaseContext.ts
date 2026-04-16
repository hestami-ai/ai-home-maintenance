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
