/**
 * Phase 4 — Architecture Definition.
 * Based on JanumiCode Spec v2.3, §4 Phase 4.
 *
 * Sub-phases:
 *   4.1 — Software Domain Identification (Architecture Agent LLM call)
 *   4.2 — Component Decomposition (Architecture Agent LLM call)
 *   4.3 — Architectural Decision Capture (Architecture Agent LLM call)
 *   4.4 — Architecture Mirror and Menu (human review + implementability)
 *   4.5 — Consistency Check and Approval (phase gate)
 */

import { randomUUID } from 'node:crypto';
import { displayComponentDependency } from './summaryFormat';
import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type {
  PhaseId,
  ProductDescriptionHandoffContent,
  TechnicalConstraint,
  DecompositionComponent,
  ComponentDecompositionNodeContent,
} from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext, buildEffectiveComponentView } from './phaseContext';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';
import { pickItemsArray } from '../parsedResponseHelpers';
import { resolveAgainstOracle } from '../idResolver';
import { chunkedCoverageBloom } from './chunkedCoverageBloom';
import { runComponentSaturationLoop } from './phase4_2a';
import { runDownstreamScopeGatekeeper } from './downstreamGatekeeper';
import { buildRequirementLineage } from './packetSynthesis/idResolution';
import {
  normalizeComponentKinds,
  partitionComponentsByKind,
  buildCrossCuttingConstraints,
  computeComponentBudget,
  consolidateToBudget,
  type ShapingComponent,
} from './phase4ScopeShaping';
import { emit as aoddEmit } from '../../aodd';

// ── Artifact shape interfaces ──────────────────────────────────────

interface UbiquitousLanguageTerm {
  term: string;
  definition: string;
}

interface SoftwareDomain {
  id: string;
  name: string;
  ubiquitous_language: UbiquitousLanguageTerm[];
  system_requirement_ids?: string[];
  /**
   * Business-domain ids (Phase 1.2 `DOM-*`) this software domain
   * realizes. Used by the deterministic 2-hop component scope filter:
   * a component is in scope iff its software domain maps to >=1 accepted
   * business domain. The LLM emits this; it isn't gatekept at 4.1.
   */
  maps_to_business_domains?: string[];
}

interface SoftwareDomains {
  domains: SoftwareDomain[];
}

interface Responsibility {
  id: string;
  statement: string;
}

interface Dependency {
  target_component_id: string;
  dependency_type: string;
}

interface Component {
  id: string;
  name: string;
  domain_id?: string;
  responsibilities: Responsibility[];
  dependencies?: Dependency[];
  /** IDs of requirements this component satisfies (for Architecture Canvas edges) */
  satisfies_requirement_ids?: string[];
  /**
   * Accepted user-story ids this component serves. Emitted by the 4.2
   * proposer (the canonical US ↔ component edge). Used by the
   * deterministic component-scope filter: a component with traces_to but
   * NO accepted story is out of scope; empty traces_to = cross-cutting.
   */
  traces_to?: string[];
  /**
   * Lever 1a — 'functional' (a buildable service realizing user stories)
   * or 'cross_cutting' (an NFR concern: latency/encryption/availability/
   * security/compliance). Cross-cutting components are NOT decomposed or
   * built as standalone services; they become cross_cutting_constraints
   * attached to the functional components they apply to. Absent ⇒
   * 'functional' (backward compatible).
   */
  component_kind?: 'functional' | 'cross_cutting';
  /** Lever 1a — functional component ids a cross-cutting concern applies to. */
  applies_to_components?: string[];
}

interface ComponentModel {
  components: Component[];
}

interface ADR {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context?: string;
  decision: string;
  alternatives?: string[];
  rationale: string;
  consequences?: string[];
  /** IDs of components this ADR governs (for Architecture Canvas edges) */
  governs_components?: string[];
}

interface ArchitecturalDecisions {
  adrs: ADR[];
}

// ── Deterministic component domain-scope filter ─────────────────────

/**
 * Deterministic 2-hop domain scope filter for Phase 4.2 components.
 *
 * Components reference Phase 4.1 SOFTWARE-domain ids in `domain_id`
 * (e.g. `domain-shortening`), a DIFFERENT namespace from the Phase 1.2
 * BUSINESS domains (`DOM-*`). A component is in scope iff its software
 * domain maps (via `maps_to_business_domains`) to at least one ACCEPTED
 * business domain. Returns the components that FAIL this check, each with
 * a rationale. Pure set math — kept out of the LLM gatekeeper, which
 * proved unreliable at cross-namespace membership (ts-112/113).
 *
 * Conservative: a component whose software domain is unknown, or whose
 * software domain declares no `maps_to_business_domains`, is treated as
 * OUT of scope (dropped) — an unmapped component has no demonstrable link
 * to accepted business scope.
 */
export function deterministicDomainScopeDrops(
  components: Array<{ id: string; domain_id?: string | null }>,
  softwareDomains: Array<{ id: string; maps_to_business_domains?: string[] }>,
  acceptedBusinessDomainIds: Set<string>,
): Array<{ id: string; reason: string }> {
  // Normalize ids for comparison: LLM id formatting drifts between
  // sub-phases (ts-113 emitted `DOM-URL_SHORTENING`, ts-116 emitted
  // `DOM-URL-SHORTENING` for the same domain). business_domains_bloom and
  // software_domains generate their ids independently, so an exact-string
  // join would silently drop every component on a hyphen/underscore/case
  // mismatch — the same catastrophic 0-component failure this filter
  // exists to prevent. Canonicalize both sides before intersecting.
  const norm = (s: string): string => s.trim().toUpperCase().replace(/_/g, '-');
  const acceptedNorm = new Set([...acceptedBusinessDomainIds].map(norm));
  const swMaps = new Map<string, string[]>(
    softwareDomains.map(d => [norm(d.id), d.maps_to_business_domains ?? []]),
  );
  const drops: Array<{ id: string; reason: string }> = [];
  for (const c of components) {
    const maps = swMaps.get(norm(c.domain_id ?? '')) ?? [];
    const inScope = maps.some(b => acceptedNorm.has(norm(b)));
    if (!inScope) {
      drops.push({
        id: c.id,
        reason: `Deterministic 2-hop domain scope: software domain '${c.domain_id ?? '(none)'}' maps_to_business_domains=[${maps.join(', ') || 'none'}], none accepted (accepted: ${[...acceptedBusinessDomainIds].join(', ') || 'none'}). Component out of scope.`,
      });
    }
  }
  return drops;
}

/**
 * Authoritative deterministic component-scope filter (ts-116 full fix).
 *
 * Decides which Phase 4.2 components are in scope using TWO deterministic
 * checks, returning the components that FAIL (to be dropped):
 *
 *   1. Domain scope (2-hop): the component's SOFTWARE domain maps to >=1
 *      ACCEPTED business domain. (see `deterministicDomainScopeDrops`.)
 *   2. User-story coverage: a component that declares `traces_to` stories
 *      but has NONE in the accepted user-story set is unbacked → dropped.
 *      A component with EMPTY traces_to is treated as cross-cutting
 *      (monitoring/logging/encryption) and is NOT dropped on this ground.
 *
 * This REPLACES the LLM gatekeeper as the binding decision for components.
 * The LLM proved unreliable here — it dropped `comp-encryption-service`
 * (ts-116) even though that component traces to accepted stories
 * US-009/010/011, which would have lost URL-decryption coverage. The LLM
 * gatekeeper still runs as an ADVISORY pass (its `scope_prune_decision`
 * is recorded for audit / disagreement visibility) but no longer binds.
 *
 * The result drives BOTH the `component_model` artifact AND the Phase
 * 4.2a saturation seed, so they stay consistent (the prior bug: artifact
 * pruned to 3 while saturation re-expanded to the un-pruned 7).
 */
export function deterministicComponentDrops(
  components: Array<{ id: string; domain_id?: string | null; traces_to?: string[] }>,
  softwareDomains: Array<{ id: string; maps_to_business_domains?: string[] }>,
  acceptedBusinessDomainIds: Set<string>,
  acceptedUserStoryIds: Set<string>,
  /**
   * Maps a leaf user-story id to its decomposition ROOT (structural tree walk,
   * no regex — see idResolution.buildRequirementLineage). Components trace to
   * LEAF-grained story ids (the Phase-4 FR view is leaf-aware, e.g. `US-001-D`)
   * while `acceptedUserStoryIds` is ROOT-grained (`US-001`). Without
   * canonicalizing before membership, EVERY leaf-tracing component fails
   * coverage and the whole component model is wiped (slice-140). Defaults to
   * identity for back-compat.
   */
  canonicalizeStoryId: (id: string) => string = (id) => id,
): Array<{ id: string; reason: string }> {
  const drops = new Map<string, string>();
  // 1. Domain 2-hop (hard scope).
  for (const d of deterministicDomainScopeDrops(components, softwareDomains, acceptedBusinessDomainIds)) {
    drops.set(d.id, d.reason);
  }
  // 2. User-story coverage — backed if ANY trace, raw OR canonicalized-to-root,
  //    is in the accepted set.
  for (const c of components) {
    if (drops.has(c.id)) continue;
    const traces = Array.isArray(c.traces_to) ? c.traces_to : [];
    const backed = traces.some(
      us => acceptedUserStoryIds.has(us) || acceptedUserStoryIds.has(canonicalizeStoryId(us)),
    );
    if (traces.length > 0 && !backed) {
      drops.set(
        c.id,
        `Deterministic user-story coverage: component traces_to=[${traces.join(', ')}] (canonicalized roots: [${traces.map(canonicalizeStoryId).join(', ')}]), none in the accepted user-story set. No accepted story backs this component.`,
      );
    }
  }
  return [...drops.entries()].map(([id, reason]) => ({ id, reason }));
}

// ── SD-2 — per-domain ADR capture (chunked pure fan-out) ────────────

/**
 * Component shape consumed by the per-domain ADR fan-out. Structurally
 * compatible with BOTH the leaf-projected shape (buildEffectiveComponentView
 * 'leaves') and the flat `component_model` fallback (`Component`).
 */
interface AdrCaptureComponent {
  id: string;
  name: string;
  domain_id?: string;
  responsibilities: Array<{ id: string; statement: string }>;
  dependencies?: Array<{ target_component_id: string; dependency_type: string }>;
}

/** One per-domain ADR chunk — its components + the software-domain key. */
interface AdrDomainChunk {
  domainId: string;
  components: AdrCaptureComponent[];
}

/**
 * Render a component roster block for an ADR prompt (id, domain,
 * responsibilities, dependencies). Same convention as the pre-SD-2 monolithic
 * `componentSummary`, now applied to a SINGLE domain's slice per call.
 */
function renderAdrComponentBlock(components: AdrCaptureComponent[]): string {
  return components.map(c => {
    const resps = c.responsibilities.map(r => `  ${r.id}: ${r.statement}`).join('\n');
    const deps = (c.dependencies ?? []).map(displayComponentDependency).join(', ');
    return `${c.id}: ${c.name} (domain: ${c.domain_id ?? 'unassigned'})\n  Responsibilities:\n${resps}\n  Dependencies: ${deps || 'none'}`;
  }).join('\n');
}

/**
 * Group leaf components by their `domain_id` (Phase 4.1 SOFTWARE domain),
 * preserving first-seen order. Components with no domain fall into an
 * 'unassigned' chunk. Pure — no id resolution.
 */
function groupComponentsByDomain(components: AdrCaptureComponent[]): AdrDomainChunk[] {
  const byDomain = new Map<string, AdrCaptureComponent[]>();
  const order: string[] = [];
  for (const c of components) {
    const key = c.domain_id && c.domain_id.length > 0 ? c.domain_id : 'unassigned';
    if (!byDomain.has(key)) {
      byDomain.set(key, []);
      order.push(key);
    }
    byDomain.get(key)!.push(c);
  }
  return order.map(domainId => ({ domainId, components: byDomain.get(domainId)! }));
}

export interface AdrCaptureBloomArgs {
  /** Leaf components (each carrying a `domain_id`) the ADRs govern. */
  adrComponents: AdrCaptureComponent[];
  /** Full software-domain roster — passed to every chunk as reference-only. */
  domainsSummary: string;
  /**
   * Canonical TECH-* roster (Phase 1.0c). Passed verbatim to EVERY domain
   * chunk: TECH-* constraints are global binding commitments (e.g. "no
   * microservices" applies to all domains), and the whole point of the block
   * is the model's non-contradiction self-check, so the full roster is the
   * correct per-chunk scope. A finer per-domain TECH slice awaits a TECH→domain
   * mapping (PA-6); there is none today, and regex-matching TECH text to a
   * domain would violate the no-regex-id-resolution house rule.
   */
  technicalConstraintsSummary: string;
  /** DMR packet — supplies `active_constraints`. */
  dmr: PhaseContextPacketResult;
}

/**
 * SD-2 — capture Architectural Decision Records via PER-SOFTWARE-DOMAIN
 * chunked fan-out (replaces the monolithic "every significant choice across
 * all ~53 components in one call" ask that under-covered component-model
 * thresholds).
 *
 * PURE FAN-OUT (empty coverage set, 0 reconciliation passes): ADRs are not a
 * clean enumerable coverage set — "significant architectural choices" can't be
 * listed up front — so there is no coverage oracle. Cardinality is the disease;
 * one focused ADR call per software domain (its components + the TECH-* roster)
 * is the whole cure. See `chunkedCoverageBloom` and
 * SKELETON-DECOMPOSITION-DESIGN §SD-2.
 *
 * House rules preserved:
 *  - NO fabrication — a failing domain chunk returns []; the single ADR-001
 *    fallback survives ONLY when the WHOLE bloom yields zero ADRs.
 *  - ADR ids are globally unique across domain chunks — deterministically
 *    re-id'd (`ADR-###`) AFTER merge (each domain independently emits ADR-001;
 *    a per-chunk id namespace prevents the helper's idOf-dedup from silently
 *    dropping a second domain's ADR-001 as a "duplicate").
 *  - `governs_components` oracle resolution is NOT done here — the caller runs
 *    it ONCE post-merge over the FULL component oracle (a domain-A ADR may
 *    validly govern a domain-B component id).
 */
export async function runAdrCaptureBloom(
  ctx: PhaseContext,
  args: AdrCaptureBloomArgs,
): Promise<ArchitecturalDecisions> {
  const { engine } = ctx;
  const template = engine.templateLoader.findTemplate('architecture_agent', 'adr_capture');

  const fallback: ArchitecturalDecisions = {
    adrs: [{
      id: 'ADR-001',
      title: 'Primary technology stack',
      status: 'proposed',
      context: 'Technology selection for initial implementation',
      decision: 'Use the technology stack implied by the requirements',
      alternatives: ['Alternative stack'],
      rationale: 'Best fit for the described requirements and constraints',
      consequences: ['Team must have expertise in chosen stack'],
    }],
  };

  const domainChunks = groupComponentsByDomain(args.adrComponents);
  if (!template || domainChunks.length === 0) return fallback;

  const { produced } = await chunkedCoverageBloom<AdrDomainChunk, ADR>({
    chunks: domainChunks,
    generateForChunk: async (chunk, index) => {
      const rendered = engine.templateLoader.render(template, {
        active_constraints: args.dmr.activeConstraintsText,
        active_software_domain: `${chunk.domainId} (${chunk.components.length} component(s): ${chunk.components.map(c => c.id).join(', ')})`,
        component_model_summary: renderAdrComponentBlock(chunk.components),
        software_domains_summary: args.domainsSummary,
        technical_constraints_summary: args.technicalConstraintsSummary,
        janumicode_version_sha: engine.janumiCodeVersionSha,
      });
      if (rendered.missing_variables.length > 0) return [];
      try {
        // LLM throws are caught here (a single domain must not sink the bloom).
        // Route through requirements_agent routing for llamacpp via llama-swap.
        const result = await engine.callForRole('requirements_agent', {
          prompt: rendered.rendered,
          responseFormat: 'json',
          temperature: 0.4,
          traceContext: {
            workflowRunId: ctx.workflowRun.id,
            phaseId: '4',
            subPhaseId: 'adr_capture',
            agentRole: 'architecture_agent',
            label: `Phase 4.3 — Architectural Decision Capture (${chunk.domainId})`,
          },
        });
        // Envelope-tolerant parse — same cal-21 SR-loss pattern the monolithic
        // call guarded against (`{ architectural_decisions: [...] }` vs `{ adrs }`).
        const parsed = result.parsed as Record<string, unknown> | null;
        const adrs = pickItemsArray<ADR>(parsed, ['architectural_decisions', 'adrs']) ?? [];
        // Namespace each id with the chunk index BEFORE dedup so two domains
        // both emitting `ADR-001` are NOT collapsed by the helper's idOf-dedup
        // (they are distinct decisions, not duplicates). Genuine within-chunk
        // repeats still collapse. Clean sequential re-id happens post-merge.
        return adrs.map((adr, j) => ({
          ...adr,
          id: `d${index}-${typeof adr.id === 'string' && adr.id.length > 0 ? adr.id : `ADR-${j + 1}`}`,
        }));
      } catch (err) {
        getLogger().warn('workflow', 'Phase 4.3 per-domain ADR generation failed — continuing', {
          domain_id: chunk.domainId, error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }
    },
    idOf: (adr) => (typeof adr.id === 'string' ? adr.id : ''),
    // Pure fan-out: ADR "significant choices" are not a clean enumerable set,
    // so there is NO coverage oracle and NO reconciliation. `coveredBy` is
    // dedup/context only (unused while the target set is empty).
    targetCoverageSet: new Set<string>(),
    coveredBy: (adr) => (Array.isArray(adr.governs_components) ? adr.governs_components : []),
    maxReconPasses: 0,
    logLabel: 'Phase 4.3',
  });

  if (produced.length === 0) return fallback;

  // Deterministic global re-id AFTER merge — strip the per-chunk namespace and
  // assign unique sequential `ADR-###` ids. Does NOT touch governs_components
  // (component ids), so the caller's post-merge oracle resolution is unaffected.
  const adrs = produced.map((adr, i) => ({ ...adr, id: `ADR-${String(i + 1).padStart(3, '0')}` }));
  return { adrs };
}

// ── Handler ────────────────────────────────────────────────────────

export class Phase4Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '4';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Gather prior phase outputs ──────────────────────────────
    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const prior = extractPriorPhaseContext(allArtifacts);

    const boundarySummary = `PROJECT TYPE: ${prior.projectTypeDescription}\n\n${prior.systemBoundary?.summary ?? 'No system boundary available'}`;
    const sysReqSummary = prior.systemRequirements?.summary ?? 'No system requirements available';
    const sysReqItems = (prior.systemRequirements?.content.items as Array<Record<string, unknown>>) ?? [];
    const derivedFromIds = prior.allRecordIds;

    // ── 4.1 — Software Domain Identification ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'software_domains');

    const srIds = sysReqItems.map(i => i.id as string).filter(Boolean);
    const dmr41Seeds = [
      ...(prior.systemBoundary ? [prior.systemBoundary.recordId] : []),
      ...(prior.systemRequirements ? [prior.systemRequirements.recordId] : []),
      ...(prior.functionalRequirements ? [prior.functionalRequirements.recordId] : []),
      ...(prior.nonFunctionalRequirements ? [prior.nonFunctionalRequirements.recordId] : []),
    ];
    const dmr41 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'software_domains',
      requestingAgentRole: 'architecture_agent',
      query: `Software domains for system_boundary ${prior.systemBoundary?.recordId ?? 'unknown'} covering system_requirements ${srIds.join(', ')}.`,
      knownRelevantRecordIds: dmr41Seeds,
      detailFileLabel: 'p4_1_domains',
      requiredOutputSpec: 'software_domains JSON — domains array with ubiquitous_language',
    });

    const businessDomainsSummary = prior.businessDomainsBloom?.summary
      ?? 'No Phase 1 business domains available (maps_to_business_domains may be left empty).';
    const domainsContent = await this.runSoftwareDomainIdentification(
      ctx, boundarySummary, sysReqSummary, businessDomainsSummary, dmr41,
    );

    const domainsRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: 'software_domains',
      produced_by_agent_role: 'architecture_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: derivedFromIds,
      content: { kind: 'software_domains', ...domainsContent },
    });
    artifactIds.push(domainsRecord.id);
    engine.ingestionPipeline.ingest(domainsRecord);

    // ── 4.2 — Component Decomposition ─────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'component_skeleton');

    // PA-6: build the per-domain block once, keyed by id, so component_saturation
    // can scope each node to its own domain (domainContextById) + a thin index
    // (domainIndex). domainsSummary stays byte-identical (same order/format) as
    // the full-catalog fallback.
    const domainContextById: Record<string, string> = {};
    for (const d of domainsContent.domains) {
      const terms = d.ubiquitous_language.map(t => `${t.term}: ${t.definition}`).join('; ');
      domainContextById[d.id] = `${d.id}: ${d.name} (reqs: ${(d.system_requirement_ids ?? []).join(', ')})\n  Terms: ${terms}`;
    }
    const domainsSummary = domainsContent.domains.map(d => domainContextById[d.id]).join('\n');
    const domainIndex = domainsContent.domains.map(d => `${d.id}: ${d.name}`).join('\n');

    const domainIds = domainsContent.domains.map(d => d.id).filter(Boolean);
    const dmr42Seeds = [
      domainsRecord.id,
      ...(prior.systemRequirements ? [prior.systemRequirements.recordId] : []),
      ...(prior.functionalRequirements ? [prior.functionalRequirements.recordId] : []),
      ...(prior.nonFunctionalRequirements ? [prior.nonFunctionalRequirements.recordId] : []),
    ];
    const dmr42 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'component_skeleton',
      requestingAgentRole: 'architecture_agent',
      query: `Component decomposition for domains ${domainIds.join(', ')} (software_domains ${domainsRecord.id}) implementing system_requirements ${srIds.join(', ')}.`,
      knownRelevantRecordIds: dmr42Seeds,
      detailFileLabel: 'p4_2_components',
      requiredOutputSpec: 'component_model JSON — components with responsibilities and dependencies',
    });

    // Gap #2 keystone: Phase 4.2 needs functional_requirements_summary
    // so the LLM can declare `component.traces_to: [US-...]` — the
    // canonical US ↔ component edge that downstream phases (especially
    // Phase 9 packet builder Pass 2) rely on to populate per-task user
    // story context without per-task LLM annotation.
    const frSummary = prior.functionalRequirements?.summary
      ?? 'No Phase 2 user stories available (traces_to may be left empty).';
    const componentContent = await this.runComponentDecomposition(
      ctx, domainsSummary, sysReqSummary, frSummary, dmr42,
    );

    // ── Lever 1a — NFRs are cross-cutting concerns, not services ───
    // Partition the LLM's components into functional (buildable services
    // realizing user stories) and cross_cutting (NFR concerns: latency,
    // encryption, availability, security, compliance). Cross-cutting
    // components are NEVER decomposed/built as standalone services — they
    // are persisted as `cross_cutting_constraints` attached to the
    // functional components they apply to. The NFR information still reaches
    // the executor independently via the packet's NFR section, so nothing
    // is lost. Only the FUNCTIONAL set flows into the component_model
    // artifact and the saturation loop below.
    // Normalize first: local models often omit the per-component
    // `component_kind` field (schema-adherence wobble). Infer it structurally
    // (empty traces_to / applies_to_components present ⇒ cross_cutting) so 1a
    // is not a silent no-op when the field is missing.
    const kindNorm = normalizeComponentKinds(
      componentContent.components as unknown as Array<{ component_kind?: string; traces_to?: string[]; applies_to_components?: string[] }>,
    );
    if (kindNorm.inferred > 0) {
      componentContent.components = kindNorm.components as unknown as Component[];
      getLogger().info('workflow', 'Lever 1a: inferred component_kind for components missing the field', {
        workflow_run_id: workflowRun.id, inferred: kindNorm.inferred,
      });
    }
    const kindPartition = partitionComponentsByKind(
      componentContent.components as unknown as Array<{ component_kind?: string }>,
    );
    const crossCuttingComponents = kindPartition.crossCutting as unknown as Component[];
    if (crossCuttingComponents.length > 0) {
      componentContent.components = kindPartition.functional as unknown as Component[];
      const ccContent = buildCrossCuttingConstraints(
        crossCuttingComponents as unknown as ShapingComponent[],
      );
      const ccRecord = engine.writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '4',
        sub_phase_id: 'component_skeleton',
        produced_by_agent_role: 'architecture_agent',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: [domainsRecord.id],
        content: ccContent as unknown as Record<string, unknown>,
      });
      artifactIds.push(ccRecord.id);
      engine.ingestionPipeline.ingest(ccRecord);
      getLogger().info('workflow', 'Lever 1a: NFR/cross-cutting components reified as constraints (not services)', {
        workflow_run_id: workflowRun.id,
        cross_cutting: crossCuttingComponents.map(c => c.id),
        functional_remaining: componentContent.components.length,
      });
    }

    let componentRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: 'component_skeleton',
      produced_by_agent_role: 'architecture_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [domainsRecord.id],
      content: { kind: 'component_model', ...componentContent },
    });
    artifactIds.push(componentRecord.id);
    engine.ingestionPipeline.ingest(componentRecord);

    // Phase-exit scope gatekeeper. Component scope is decided
    // DETERMINISTICALLY (domain 2-hop + user-story coverage) and is
    // authoritative; the LLM gatekeeper runs only as an ADVISORY pass
    // whose `scope_prune_decision` is recorded for audit/disagreement
    // visibility but does NOT bind (ts-116: the LLM dropped
    // comp-encryption-service though it traces to accepted stories,
    // which would have lost URL-decryption coverage). The deterministic
    // result drives BOTH the artifact AND the 4.2a saturation seed so
    // they stay consistent.
    const compItems = ((componentContent as unknown as { components?: Array<Record<string, unknown>> }).components ?? []).map(c => ({
      id: typeof c.id === 'string' ? c.id : '',
      label: `${c.id}: ${c.name} [domain: ${(c as Record<string, unknown>).domain_id ?? '?'}]`,
      description: typeof c.description === 'string' ? c.description : undefined,
      tradeoffs: Array.isArray(c.traces_to) ? `traces_to: ${(c.traces_to as string[]).join(', ')}` : undefined,
    }));
    const compPrune = await runDownstreamScopeGatekeeper(ctx, {
      phaseId: '4',
      subPhaseId: 'component_skeleton',
      bloomDescription: 'software components',
      items: compItems,
      originalArtifactId: componentRecord.id,
      // ADVISORY ONLY — recorded but non-binding. Domain scope AND
      // user-story coverage are both enforced deterministically below.
      overlay: 'ADVISORY pass only — your decision is recorded but not binding (scope is enforced by deterministic code). For reference: a component is out of scope if its software domain maps to no accepted business domain, OR it traces only to dropped user stories. Cross-cutting components (monitoring/logging/encryption) with no traces_to are in scope.',
    });

    // ── Deterministic component-scope filter (ts-114 + ts-116) ─────
    // Authoritative: domain 2-hop + user-story coverage. See
    // `deterministicComponentDrops`. Accepted business domains come from
    // the Phase 1.2 post-gatekeeper set; accepted user stories from the
    // Phase 2.1 post-gatekeeper functional_requirements artifact.
    const acceptedBizDomainIds = new Set(
      allArtifacts
        .filter(r => r.is_current_version && (r.content as Record<string, unknown>).kind === 'business_domains_bloom')
        .flatMap(r => (((r.content as Record<string, unknown>).domains as Array<{ id?: string }>) ?? []))
        .map(d => d.id)
        .filter((x): x is string => typeof x === 'string'),
    );
    const acceptedUserStoryIds = new Set(
      allArtifacts
        .filter(r => r.is_current_version && (r.content as Record<string, unknown>).kind === 'functional_requirements')
        .flatMap(r => (((r.content as Record<string, unknown>).user_stories as Array<{ id?: string }>) ?? []))
        .map(s => s.id)
        .filter((x): x is string => typeof x === 'string'),
    );
    // Requirement decomposition lineage canonicalizes the components' LEAF
    // story traces (`US-001-D`) to their accepted ROOT (`US-001`) before the
    // coverage check — without it every leaf-tracing component is dropped and
    // the whole model wiped (slice-140 root cause).
    const reqDecompNodes = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node');
    const reqLineage = buildRequirementLineage([...allArtifacts, ...reqDecompNodes]);
    const componentDrops = deterministicComponentDrops(
      componentContent.components, domainsContent.domains, acceptedBizDomainIds, acceptedUserStoryIds,
      reqLineage.canonicalize,
    );
    const compDropSet = new Set(componentDrops.map(d => d.id));
    // finalKeptComps drives BOTH the artifact and the 4.2a saturation seed.
    let finalKeptComps = componentContent.components.filter(c => !compDropSet.has(c.id));

    // ── Keep-all-on-total-wipeout guard ───────────────────────────
    // A deterministic filter that drops EVERY component is a filter failure,
    // not a real result — an empty component_model superseding the real one
    // breaks all of Phase 9 (decomposition, packets, scaffold, ownership). When
    // the proposer produced components but the filter would keep none, KEEP ALL
    // and log loudly (defense-in-depth beneath the leaf→root canonicalization
    // above). Mirrors the release_plan / domains total-wipeout guards.
    if (componentContent.components.length > 0 && finalKeptComps.length === 0) {
      getLogger().warn('workflow', 'Phase 4: deterministic component filter dropped ALL components — keeping all (filter failure, not a real wipeout)', {
        workflow_run_id: workflowRun.id,
        proposed: componentContent.components.length,
        drop_reasons: componentDrops.slice(0, 3).map(d => d.reason),
      });
      finalKeptComps = componentContent.components;
      compDropSet.clear();
      componentDrops.length = 0;
    }

    // ── Lever 1b — decomposition scale budget ──────────────────────
    // Right-size the functional component count to intent scale, keyed to
    // upstream artifact counts (accepted user stories + software domains),
    // NOT a hardcoded number. When the proposed set exceeds the budget,
    // consolidate by merging within the same software domain (union-ing
    // coverage so no accepted user story is dropped). A `decomposition_
    // scale_decision` record audits the result; a consolidation that would
    // drop coverage is rejected (fail-safe: original set kept).
    const scaleRatio = (engine.configManager.get().decomposition as unknown as {
      component_scale_ratio?: number;
    }).component_scale_ratio ?? 1.0;
    // Floor on the domains that actually host a FUNCTIONAL component (post-1a /
    // post-drop), NOT the total software-domain count. Otherwise NFR domains
    // (which 1a strips at the component level but which remain in
    // domainsContent.domains) inflate the floor and the gate never bites.
    const functionalDomainCount = new Set(
      finalKeptComps.map(c => c.domain_id).filter((d): d is string => typeof d === 'string'),
    ).size;
    const componentBudget = computeComponentBudget(
      acceptedUserStoryIds.size, functionalDomainCount, scaleRatio,
    );
    let scaleConsolidated = false;
    if (Number.isFinite(componentBudget) && finalKeptComps.length > componentBudget) {
      const consolidation = consolidateToBudget(
        finalKeptComps as unknown as ShapingComponent[],
        componentBudget,
        acceptedUserStoryIds,
      );
      const accepted = consolidation.coveragePreserved && consolidation.merges.length > 0;
      if (accepted) {
        finalKeptComps = consolidation.components as unknown as Component[];
        scaleConsolidated = true;
      }
      engine.writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '4',
        sub_phase_id: 'component_skeleton',
        produced_by_agent_role: 'architecture_agent',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: [componentRecord.id],
        content: {
          kind: 'decomposition_scale_decision',
          budget: componentBudget,
          scale_ratio: scaleRatio,
          accepted_user_story_count: acceptedUserStoryIds.size,
          software_domain_count: domainsContent.domains.length,
          functional_domain_count: functionalDomainCount,
          proposed_functional_count: componentContent.components.length,
          post_drop_count: componentContent.components.filter(c => !compDropSet.has(c.id)).length,
          consolidated: accepted,
          coverage_preserved: consolidation.coveragePreserved,
          merges: consolidation.merges,
          final_count: finalKeptComps.length,
        },
      });
      getLogger().info('workflow', 'Lever 1b: decomposition scale budget applied', {
        workflow_run_id: workflowRun.id,
        budget: componentBudget, proposed: componentContent.components.length,
        consolidated: accepted, coverage_preserved: consolidation.coveragePreserved,
        final: finalKeptComps.length,
      });
    }

    // Surface LLM-vs-deterministic disagreement for the audit trail.
    const llmDroppedIds = new Set(compPrune.skipped ? [] : compPrune.dropped.map(d => d.id));
    const disagreements = componentContent.components
      .filter(c => llmDroppedIds.has(c.id) && !compDropSet.has(c.id))
      .map(c => c.id);
    if (componentDrops.length > 0 || disagreements.length > 0) {
      getLogger().info('workflow', 'Deterministic component-scope filter (authoritative)', {
        workflow_run_id: workflowRun.id,
        deterministic_dropped: componentDrops.map(d => d.id),
        llm_advisory_dropped: [...llmDroppedIds],
        kept_over_llm_advice: disagreements,
        accepted_business_domains: [...acceptedBizDomainIds],
      });
    }

    if (componentDrops.length > 0 || scaleConsolidated) {
      const prunedCompContent = { ...componentContent, components: finalKeptComps };
      const prunedCompRecord = engine.writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '4',
        sub_phase_id: 'component_skeleton',
        produced_by_agent_role: 'architecture_agent',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: [componentRecord.id],
        content: { kind: 'component_model', ...prunedCompContent },
      });
      engine.writer.supersedByRollback(componentRecord.id, prunedCompRecord.id);
      engine.ingestionPipeline.ingest(prunedCompRecord);
      componentRecord = prunedCompRecord;
      artifactIds.push(prunedCompRecord.id);
    }
    // Authoritative deterministic audit record (the LLM's advisory
    // scope_prune_decision was already written by runDownstreamScopeGatekeeper).
    if (componentDrops.length > 0) {
      engine.writer.writeRecord({
        record_type: 'scope_prune_decision',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '4',
        sub_phase_id: 'component_skeleton',
        produced_by_agent_role: 'architecture_agent',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: [componentRecord.id],
        content: {
          kind: 'scope_prune_decision',
          schemaVersion: '1.0',
          sub_phase_id: 'component_skeleton',
          original_artifact_id: componentRecord.id,
          pruned_artifact_id: componentRecord.id,
          kept_ids: finalKeptComps.map(c => c.id),
          dropped: componentDrops.map(d => ({ id: d.id, reason: d.reason })),
          rationale_summary: 'Authoritative deterministic component-scope filter: domain 2-hop (software domain must map to an accepted business domain) + user-story coverage (must trace to >=1 accepted story, unless cross-cutting with no traces_to). LLM gatekeeper is advisory only.',
          gatekeeper_provider: 'deterministic',
          gatekeeper_model: 'component_scope_filter_v2',
          duration_ms: 0,
        } as unknown as Record<string, unknown>,
      });
    }

    // Collapse the in-memory component set to the kept components so EVERY
    // downstream use within this phase (4.2a saturation seed, 4.3 ADR
    // capture, 4.5 consistency check, metrics) sees the same pruned set.
    // Safe: the original un-pruned artifact (written above) was already
    // serialized to the DB; this mutation only affects in-memory reads.
    componentContent.components = finalKeptComps;

    // ── 4.2a — Recursive Component Decomposition (Wave 7) ─────
    engine.stateMachine.setSubPhase(workflowRun.id, 'component_saturation');

    // Read prerequisites: product handoff + Phase 1.0c technical
    // constraints. The constraints anchor each leaf component to the
    // user's stated stack (SvelteKit / Bun / PostgreSQL / etc.) so
    // downstream phases don't reinvent defaults from training data.
    const handoffRecord = engine.writer.getRecordsByType(workflowRun.id, 'product_description_handoff')[0];
    const handoff = (handoffRecord?.content ?? {}) as unknown as ProductDescriptionHandoffContent;
    const techConstraintsRecord = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced')
      .find(r => (r.content as Record<string, unknown>).kind === 'technical_constraints_discovery');
    const technicalConstraints: TechnicalConstraint[] = techConstraintsRecord
      ? (((techConstraintsRecord.content as Record<string, unknown>).technicalConstraints) as TechnicalConstraint[] ?? [])
      : [];

    // Convert Phase 4.2's flat ComponentModel shape into the
    // DecompositionComponent shape Wave 7 uses, and emit depth-0
    // component_decomposition_node records as seeds for the saturation
    // loop. Resume guard — skip if depth-0 nodes already exist (the
    // loop's resume helper will pick up from the prior state).
    const existingRoots = engine.writer.getRecordsByType(workflowRun.id, 'component_decomposition_node')
      .filter(r => (r.content as unknown as ComponentDecompositionNodeContent).depth === 0);
    let rootComponents: DecompositionComponent[];
    let rootNodeRecordIds: string[];
    let rootLogicalIds: string[];
    if (existingRoots.length > 0) {
      getLogger().info('workflow', 'Phase 4.2a RESUME: depth-0 nodes already present', {
        existingRoots: existingRoots.length,
      });
      rootComponents = existingRoots.map(r => (r.content as unknown as ComponentDecompositionNodeContent).component);
      rootNodeRecordIds = existingRoots.map(r => r.id);
      rootLogicalIds = existingRoots.map(r => (r.content as unknown as ComponentDecompositionNodeContent).node_id);
    } else {
      // Seed saturation from the DETERMINISTICALLY PRUNED set (finalKeptComps),
      // NOT the un-pruned componentContent.components — otherwise the
      // gatekeeper/scope prune is cosmetic and dropped components re-enter
      // downstream as depth-0 roots (ts-116: artifact said 3, saturation
      // re-expanded to 7).
      rootComponents = finalKeptComps.map(c => ({
        id: c.id,
        name: c.name,
        domain_id: c.domain_id ?? null,
        responsibilities: c.responsibilities.map(r => ({ id: r.id, description: r.statement })),
        dependencies: (c.dependencies ?? []).map(d => ({
          component_id: d.target_component_id,
          // Phase 4.2's `dependency_type` is free-form string; coerce to the
          // four kinds Wave 7 supports — fall back to sync_call for unknowns.
          kind: ((['sync_call', 'async_event', 'data_read', 'data_write'] as const) as readonly string[])
            .includes(d.dependency_type)
            ? (d.dependency_type as 'sync_call' | 'async_event' | 'data_read' | 'data_write')
            : 'sync_call',
        })),
        active_constraints: technicalConstraints.map(t => t.id),
        traces_to: c.satisfies_requirement_ids,
      }));
      rootNodeRecordIds = [];
      rootLogicalIds = [];
      for (const rc of rootComponents) {
        const logicalNodeId = randomUUID();
        const rec = engine.writer.writeRecord({
          record_type: 'component_decomposition_node',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '4',
          sub_phase_id: 'component_saturation',
          produced_by_agent_role: 'architecture_agent',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: [componentRecord.id],
          content: {
            kind: 'component_decomposition_node',
            node_id: logicalNodeId,
            parent_node_id: null,
            display_key: rc.id,
            root_component_id: logicalNodeId,
            depth: 0,
            pass_number: 0,
            status: 'pending',
            component: rc,
            surfaced_assumption_ids: [],
            release_id: null,
            release_ordinal: null,
          } satisfies ComponentDecompositionNodeContent,
        });
        rootNodeRecordIds.push(rec.id);
        rootLogicalIds.push(logicalNodeId);
        artifactIds.push(rec.id);
      }
    }

    // Run the saturation loop. Throws on configuration errors
    // (missing template etc.); per-node decomposition failures are
    // captured as `status='deferred'` rows inside the loop and never
    // halt the phase.
    if (rootComponents.length > 0) {
      await runComponentSaturationLoop(ctx, {
        handoff,
        technicalConstraints,
        domainsSummary,
        domainContextById, // PA-6: per-domain scoping (full fallback via domainsSummary)
        domainIndex,
        rootComponents,
        rootNodeRecordIds,
        rootLogicalIds,
      });
    }

    // ── 4.3 — Architectural Decision Capture ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'adr_capture');

    // Wave 7 — prefer leaf components for ADR capture so decisions
    // attach to the actual modules that will be implemented, not the
    // coarse Phase 4.2 roots. Falls back to the flat list when no
    // tree exists.
    const decompNodesForAdr = engine.writer.getRecordsByType(
      workflowRun.id, 'component_decomposition_node',
    );
    const effectiveForAdr = buildEffectiveComponentView(decompNodesForAdr, prior);
    const adrComponentsSource = effectiveForAdr.source === 'leaves'
      ? effectiveForAdr.components.map(c => ({
          id: c.id as string,
          name: c.name as string,
          domain_id: c.domain_id as string | undefined,
          responsibilities: (c.responsibilities as Array<{ id: string; statement?: string; description?: string }>)
            .map(r => ({ id: r.id, statement: r.statement ?? r.description ?? '' })),
          dependencies: (c.dependencies as Array<{ target_component_id?: string; component_id?: string; dependency_type?: string; kind?: string }>)
            .map(d => ({
              target_component_id: d.target_component_id ?? d.component_id ?? '',
              dependency_type: d.dependency_type ?? d.kind ?? 'sync_call',
            })),
        }))
      : componentContent.components;

    const adrComponentIds = adrComponentsSource.map(c => c.id).filter(Boolean);
    const dmr43Seeds = [
      componentRecord.id,
      domainsRecord.id,
      ...(techConstraintsRecord ? [techConstraintsRecord.id] : []),
    ];
    const dmr43 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'adr_capture',
      requestingAgentRole: 'architecture_agent',
      query: `Architectural decisions governing components ${adrComponentIds.join(', ')} across domains ${domainIds.join(', ')} (component_model ${componentRecord.id}).`,
      knownRelevantRecordIds: dmr43Seeds,
      detailFileLabel: 'p4_3_adrs',
      requiredOutputSpec: 'architectural_decisions JSON — adrs with context, decision, alternatives, consequences',
    });

    // ts-103 surfaced ADR-009 contradicting TECH-CONTAINER-1 ("no
    // microservices") because the ADR prompt only received the
    // DMR-derived `active_constraints` narrative, not the canonical
    // TECH-* roster. Pass the verbatim roster so the LLM can do a
    // text-level non-contradiction check on its own decisions.
    const technicalConstraintsSummary = technicalConstraints.length === 0
      ? 'No technical_constraints_discovery artifact available'
      : technicalConstraints
          .map(t => {
            const id = (t as { id?: string }).id ?? '';
            const tech = (t as { technology?: string; name?: string }).technology
              ?? (t as { name?: string }).name ?? '';
            const category = (t as { category?: string }).category ?? '';
            const text = (t as { text?: string; rationale?: string }).text
              ?? (t as { rationale?: string }).rationale ?? '';
            return [id, tech, category, text].filter(Boolean).join(' — ');
          })
          .filter(Boolean)
          .join('\n');

    // SD-2 — capture ADRs via PER-DOMAIN chunked fan-out (one focused call per
    // software domain) instead of a single all-components roll-up. Pure fan-out:
    // no coverage oracle (ADR "significant choices" aren't enumerable). ADR ids
    // are globally re-id'd post-merge inside the bloom.
    const adrsContent = await runAdrCaptureBloom(ctx, {
      adrComponents: adrComponentsSource,
      domainsSummary,
      technicalConstraintsSummary,
      dmr: dmr43,
    });

    // Resolve drifted component ids in each ADR's governs_components against the
    // real component-id oracle, so the downstream per-task ADR filter
    // (filterADRsForTask) matches. Drop ids that don't resolve (LLM invented a
    // non-component); an empty list stays empty = global ADR.
    {
      const componentOracle = new Set(adrComponentIds);
      for (const adr of adrsContent.adrs ?? []) {
        if (!Array.isArray(adr.governs_components)) continue;
        adr.governs_components = adr.governs_components
          .map((id) => resolveAgainstOracle(id, componentOracle))
          .filter((id): id is string => id !== null);
      }
    }

    const adrsRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: 'adr_capture',
      produced_by_agent_role: 'architecture_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [domainsRecord.id, componentRecord.id],
      content: { kind: 'architectural_decisions', ...adrsContent },
    });
    artifactIds.push(adrsRecord.id);
    engine.ingestionPipeline.ingest(adrsRecord);

    // ── 4.4 — Architecture Mirror and Menu ────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'architecture_synthesis');

    // Surface Wave 7 leaf-count + tier distribution in the architecture
    // mirror so the human sees how recursive decomposition expanded the
    // root components. Falls back to root count when no tree exists.
    const decompNodesForMirror = engine.writer.getRecordsByType(
      workflowRun.id, 'component_decomposition_node',
    );
    const effectiveForMirror = buildEffectiveComponentView(decompNodesForMirror, prior);
    const tierDistribution = decompNodesForMirror.reduce<Record<string, number>>((acc, r) => {
      const c = r.content as unknown as ComponentDecompositionNodeContent;
      if (c.tier) acc[c.tier] = (acc[c.tier] ?? 0) + 1;
      return acc;
    }, {});

    const archMirror = engine.mirrorGenerator.generate({
      artifactId: componentRecord.id,
      artifactType: 'architecture_definition',
      content: {
        domains: domainsContent,
        components_count: componentContent.components.length,
        leaf_components_count: effectiveForMirror.leafCount,
        component_tier_distribution: tierDistribution,
        adrs_count: adrsContent.adrs.length,
      },
    });

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: 'architecture_synthesis',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [domainsRecord.id, componentRecord.id, adrsRecord.id],
      content: {
        kind: 'architecture_mirror',
        mirror_id: archMirror.mirrorId,
        artifact_id: componentRecord.id,
        artifact_type: 'architecture_definition',
        fields: archMirror.fields,
        domains_count: domainsContent.domains.length,
        components_count: componentContent.components.length,
        leaf_components_count: effectiveForMirror.leafCount,
        component_tier_distribution: tierDistribution,
        adrs_count: adrsContent.adrs.length,
      },
    });
    artifactIds.push(mirrorRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: archMirror.mirrorId,
      artifactType: 'architecture_definition',
    });

    try {
      const resolution = await engine.pauseForDecision(
        workflowRun.id, mirrorRecord.id, 'mirror',
      );
      if (resolution.type === 'mirror_rejection') {
        return { success: false, error: 'User rejected architecture definition', artifactIds };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 4 review failed', { error: String(err) });
      return { success: false, error: 'Architecture review failed', artifactIds };
    }

    // ── 4.5 — Consistency Check and Approval ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'architecture_gate');

    const consistencyReport = this.runConsistencyCheck(
      componentContent, adrsContent, sysReqItems,
    );

    const consistencyRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: 'architecture_gate',
      produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [domainsRecord.id, componentRecord.id, adrsRecord.id],
      content: { kind: 'consistency_report', ...consistencyReport },
    });
    artifactIds.push(consistencyRecord.id);
    engine.ingestionPipeline.ingest(consistencyRecord);

    // Phase Gate
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: 'architecture_gate',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [domainsRecord.id, componentRecord.id, adrsRecord.id, consistencyRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '4',
        software_domains_record_id: domainsRecord.id,
        component_model_record_id: componentRecord.id,
        architectural_decisions_record_id: adrsRecord.id,
        consistency_pass: consistencyReport.overall_pass,
        has_unresolved_warnings: consistencyReport.warnings.length > 0,
        has_high_severity_flaws: !consistencyReport.overall_pass,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '4' });
    aoddEmit('gate.pending', { gate_kind: 'phase_gate' });

    return { success: true, artifactIds };
  }

  // ── LLM call helpers ──────────────────────────────────────────

  private async runSoftwareDomainIdentification(
    ctx: PhaseContext,
    boundarySummary: string,
    sysReqSummary: string,
    businessDomainsSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<SoftwareDomains> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('architecture_agent', 'software_domains');

    const fallback: SoftwareDomains = {
      domains: [{
        id: 'DOM-001',
        name: 'Core Domain',
        ubiquitous_language: [{ term: 'application', definition: 'The primary system being built' }],
        system_requirement_ids: ['SR-001'],
      }],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      system_boundary_summary: boundarySummary,
      system_requirements_summary: sysReqSummary,
      business_domains_summary: businessDomainsSummary,
      detail_file_path: dmr.detailFilePath,
      detail_file_content: dmr.detailFileContent,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    // Route through requirements_agent routing for llamacpp via
    // llama-swap. See phase3.ts for the rationale.
    const result = await engine.callForRole('requirements_agent', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.4,
      traceContext: {
        workflowRunId: ctx.workflowRun.id,
        phaseId: '4',
        subPhaseId: 'software_domains',
        agentRole: 'architecture_agent',
        label: 'Phase 4.1 — Software Domain Identification',
      },
    });

    // Defensive parse — see parsedResponseHelpers.ts for the cal-21
    // SR-loss bug pattern this guards against. Phase 4.1 happens to
    // currently emit `{ domains: [...] }` (schema key) but the model
    // is free to switch to the kind-name envelope on retry.
    const parsed = result.parsed as Record<string, unknown> | null;
    const domains = pickItemsArray<SoftwareDomain>(parsed, ['software_domains', 'domains']);
    if (domains && domains.length > 0) return { domains };
    return fallback;
  }

  private async runComponentDecomposition(
    ctx: PhaseContext,
    domainsSummary: string,
    sysReqSummary: string,
    functionalRequirementsSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<ComponentModel> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('architecture_agent', 'component_skeleton');

    const fallback: ComponentModel = {
      components: [{
        id: 'COMP-001',
        name: 'Core Module',
        domain_id: 'DOM-001',
        responsibilities: [{ id: 'RESP-001', statement: 'Implement core application logic' }],
        dependencies: [],
      }],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      software_domains_summary: domainsSummary,
      system_requirements_summary: sysReqSummary,
      functional_requirements_summary: functionalRequirementsSummary,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    // Route through requirements_agent routing for llamacpp via
    // llama-swap. See phase3.ts for the rationale.
    const result = await engine.callForRole('requirements_agent', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.4,
      traceContext: {
        workflowRunId: ctx.workflowRun.id,
        phaseId: '4',
        subPhaseId: 'component_skeleton',
        agentRole: 'architecture_agent',
        label: 'Phase 4.2 — Component Decomposition',
      },
    });

    const parsed = result.parsed as Record<string, unknown> | null;
    const components = pickItemsArray<Component>(parsed, ['component_model', 'components']);
    if (components && components.length > 0) return { components };
    return fallback;
  }

  /**
   * Deterministic consistency check across Phase 4 artifacts.
   */
  private runConsistencyCheck(
    components: ComponentModel,
    adrs: ArchitecturalDecisions,
    _sysReqItems: Array<Record<string, unknown>>,
  ): { overall_pass: boolean; traceability_results: unknown[]; semantic_findings: unknown[]; blocking_failures: string[]; warnings: string[] } {
    const blockingFailures: string[] = [];
    const warnings: string[] = [];
    const traceability: unknown[] = [];

    // Invariant: Every Component has at least one Responsibility
    const emptyComponents = components.components.filter(
      c => !c.responsibilities || c.responsibilities.length === 0,
    );
    if (emptyComponents.length > 0) {
      blockingFailures.push('components-without-responsibilities');
      traceability.push({
        assertion: 'Every Component has at least one Responsibility (CM-002)',
        pass: false,
        failures: emptyComponents.map(c => ({ item_id: c.id, explanation: `Component ${c.name} has no responsibilities` })),
      });
    }

    // Invariant: No conjunction in responsibility statements (CM-001)
    const conjunctionViolations: Array<{ item_id: string; explanation: string }> = [];
    for (const comp of components.components) {
      for (const resp of comp.responsibilities ?? []) {
        if (/\band\b/i.test(resp.statement) || /\bor\b/i.test(resp.statement)) {
          conjunctionViolations.push({
            item_id: resp.id,
            explanation: `Responsibility "${resp.statement.slice(0, 80)}" contains a conjunction — split into separate responsibilities`,
          });
        }
      }
    }
    if (conjunctionViolations.length > 0) {
      warnings.push('responsibility-conjunction-violations');
      traceability.push({
        assertion: 'No Component Responsibility contains conjunctions (CM-001)',
        pass: false,
        failures: conjunctionViolations,
      });
    }

    // Invariant: Every ADR has decision and rationale
    const incompleteAdrs = adrs.adrs.filter(a => !a.decision || !a.rationale);
    if (incompleteAdrs.length > 0) {
      warnings.push('incomplete-adrs');
      traceability.push({
        assertion: 'Every ADR has decision and rationale (ADR-001, ADR-002)',
        pass: false,
        failures: incompleteAdrs.map(a => ({ item_id: a.id, explanation: `ADR ${a.title} missing decision or rationale` })),
      });
    }

    // Check: circular dependencies
    const depGraph = new Map<string, string[]>();
    for (const comp of components.components) {
      depGraph.set(comp.id, (comp.dependencies ?? []).map(d => d.target_component_id));
    }
    const cycles = this.detectCycles(depGraph);
    if (cycles.length > 0) {
      warnings.push('circular-dependencies');
      traceability.push({
        assertion: 'No circular Dependencies without explicit ADR justification',
        pass: false,
        failures: cycles.map(cycle => ({ item_id: cycle.join('->'), explanation: `Circular dependency: ${cycle.join(' -> ')}` })),
      });
    }

    return {
      overall_pass: blockingFailures.length === 0,
      traceability_results: traceability,
      semantic_findings: [],
      blocking_failures: blockingFailures,
      warnings,
    };
  }

  /** Simple DFS cycle detection on the component dependency graph. */
  private detectCycles(graph: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (node: string, path: string[]) => {
      if (inStack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart >= 0) cycles.push(path.slice(cycleStart).concat(node));
        return;
      }
      if (visited.has(node)) return;
      visited.add(node);
      inStack.add(node);
      for (const neighbor of graph.get(node) ?? []) {
        dfs(neighbor, [...path, node]);
      }
      inStack.delete(node);
    };

    for (const node of graph.keys()) {
      dfs(node, []);
    }
    return cycles;
  }
}
