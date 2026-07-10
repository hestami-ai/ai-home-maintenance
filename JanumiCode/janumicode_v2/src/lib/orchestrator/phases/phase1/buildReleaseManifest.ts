/**
 * Phase 1.8 deterministic manifest builder.
 *
 * The LLM's 1.8 prompt produces only a narrow decision: how many
 * releases, their ordering and narrative, and which journeys go in
 * which release. Everything else in the release manifest — which
 * workflows, entities, compliance items, integrations, and vocabulary
 * terms belong to which release — is computed deterministically from
 * the journey assignment + upstream trigger/domain references.
 *
 * This matches JanumiCode's "deterministic where possible; LLM where
 * genuinely judgment-bearing" principle and eliminates the class of
 * small-model drift we observed in cal-14..cal-17 (invented entity
 * ids, free-text compliance references, partial populations).
 *
 * Pure function — no side effects, no LLM calls.
 */

import type {
  CrossCuttingContents,
  Entity,
  Integration,
  ReleaseContents,
  ReleaseV2,
  UserJourney,
  VocabularyTerm,
  WorkflowV2,
} from '../../../types/records';

export interface LlmReleaseSkeleton {
  /** Short form from the LLM (e.g. "REL-1"); caller replaces with UUID. */
  release_id: string;
  ordinal: number;
  name: string;
  description: string;
  rationale: string;
  /** UJ-* ids the LLM placed in this release. */
  contains_journeys: string[];
}

export interface BuildManifestInputs {
  releases: LlmReleaseSkeleton[];
  journeys: UserJourney[];
  workflows: WorkflowV2[];
  entities: Entity[];
  complianceIds: string[];
  integrations: Integration[];
  vocabulary: VocabularyTerm[];
  /**
   * Verification & validation requirement ids (VV-*) from Phase 1.0e
   * discovery. Routed to `cross_cutting.vv_requirements` by default —
   * V&V targets are typically product-wide thresholds, not release-
   * scheduled artefacts. Present so NFR decomposition roots that trace
   * exclusively to a VV-* id can anchor to a release (see
   * `assignReleaseToRoot` cross-cutting fallback in phase2.ts).
   */
  vvRequirementIds?: string[];
  /**
   * Quality attribute ids (synthetic QA-N indices over the accepted
   * `qualityAttributes[]` string list at the 1.5 gate). Routed to
   * `cross_cutting.quality_attributes`.
   */
  qualityAttributeIds?: string[];
  /**
   * Technical constraint ids (TECH-*) from Phase 1.0c discovery. Routed
   * to `cross_cutting.technical_constraints`.
   */
  technicalConstraintIds?: string[];
}

export interface BuildManifestResult {
  releases: ReleaseV2[];
  crossCutting: CrossCuttingContents;
  /** Journeys the LLM failed to place (defaulted to REL-1). */
  unplacedJourneys: string[];
  /** Entities whose domain has no journey/workflow surface (defaulted to REL-1). */
  orphanEntities: string[];
}

// ── Helpers ────────────────────────────────────────────────────────

function emptyContains(): ReleaseContents {
  return {
    journeys: [], workflows: [], entities: [],
    compliance: [], integrations: [], vocabulary: [],
    // VV / QA / TECH default to cross_cutting (see buildReleaseManifest
    // body). Per-release slots stay empty by default; a future trigger
    // rule (e.g. workflow.triggers.kind === 'vv_check') could promote a
    // specific id into a release's contains[type], at which point the
    // builder's per-release VV/QA/TECH loops would mirror the
    // compliance/integration override pattern.
    vv_requirements: [], quality_attributes: [], technical_constraints: [],
  };
}

function uniqSorted(xs: string[]): string[] {
  return Array.from(new Set(xs)).sort((a, b) => a.localeCompare(b));
}

type WorkflowTrigger = WorkflowV2['triggers'][number];
type ReleaseContentsMap = Map<string, ReleaseContents>;
type ReleaseSkeletonMap = Map<string, LlmReleaseSkeleton>;

/**
 * Record `ordinal` for `key` iff it is the earliest (lowest) seen so far.
 * Shared "earliest-release wins" reducer for domain / compliance /
 * integration id → release-ordinal maps.
 */
function setEarliestOrdinal(map: Map<string, number>, key: string, ordinal: number): void {
  const cur = map.get(key);
  if (cur === undefined || ordinal < cur) map.set(key, ordinal);
}

/**
 * The ordinal of the release a workflow was placed in, or `undefined`
 * when the workflow is cross-cutting (never placed in any release).
 */
function findWorkflowReleaseOrdinal(
  w: WorkflowV2,
  byRelease: ReleaseContentsMap,
  llmByRelease: ReleaseSkeletonMap,
): number | undefined {
  for (const [relId, contents] of byRelease) {
    if (contents.workflows.includes(w.id)) {
      return llmByRelease.get(relId)!.ordinal;
    }
  }
  return undefined;
}

/** Sort a copy by ordinal and renumber ordinals to contiguous 1..N. */
function sortAndRenumberReleases(releases: LlmReleaseSkeleton[]): LlmReleaseSkeleton[] {
  const llmReleases = [...releases].sort((a, b) => a.ordinal - b.ordinal);
  llmReleases.forEach((r, i) => { r.ordinal = i + 1; });
  return llmReleases;
}

/** Release-keyed empty ReleaseContents + skeleton lookup. */
function buildReleaseMaps(
  llmReleases: LlmReleaseSkeleton[],
): { byRelease: ReleaseContentsMap; llmByRelease: ReleaseSkeletonMap } {
  const byRelease: ReleaseContentsMap = new Map();
  const llmByRelease: ReleaseSkeletonMap = new Map();
  for (const r of llmReleases) {
    byRelease.set(r.release_id, emptyContains());
    llmByRelease.set(r.release_id, r);
  }
  return { byRelease, llmByRelease };
}

function buildOrdinalToReleaseId(llmByRelease: ReleaseSkeletonMap): Map<number, string> {
  const ordinalToReleaseId = new Map<number, string>();
  for (const [relId, r] of llmByRelease) ordinalToReleaseId.set(r.ordinal, relId);
  return ordinalToReleaseId;
}

/**
 * Place each accepted journey into the release the LLM chose. LLM-invented
 * ids (not accepted) are skipped; double-placed journeys keep the first
 * placement. Mutates `byRelease`; returns journeyId → release_id.
 */
function placeDeclaredJourneys(
  llmReleases: LlmReleaseSkeleton[],
  acceptedJourneyIds: Set<string>,
  byRelease: ReleaseContentsMap,
): Map<string, string> {
  const journeyPlacement = new Map<string, string>();
  for (const r of llmReleases) {
    for (const jId of r.contains_journeys) {
      if (!acceptedJourneyIds.has(jId)) continue; // LLM invented an id — skip silently
      if (journeyPlacement.has(jId)) continue; // LLM double-placed — first one wins
      journeyPlacement.set(jId, r.release_id);
      byRelease.get(r.release_id)!.journeys.push(jId);
    }
  }
  return journeyPlacement;
}

/**
 * Any accepted journey the LLM missed is placed in the first release as a
 * safety default. Mutates `byRelease` + `journeyPlacement`; returns the
 * list of unplaced journey ids (in accepted-set iteration order).
 */
function placeUnplacedJourneys(
  acceptedJourneyIds: Set<string>,
  journeyPlacement: Map<string, string>,
  byRelease: ReleaseContentsMap,
  firstReleaseId: string | undefined,
): string[] {
  const unplacedJourneys: string[] = [];
  for (const jId of acceptedJourneyIds) {
    if (journeyPlacement.has(jId)) continue;
    unplacedJourneys.push(jId);
    if (firstReleaseId) {
      journeyPlacement.set(jId, firstReleaseId);
      byRelease.get(firstReleaseId)!.journeys.push(jId);
    }
  }
  return unplacedJourneys;
}

function placeJourneys(
  llmReleases: LlmReleaseSkeleton[],
  journeys: UserJourney[],
  byRelease: ReleaseContentsMap,
  firstReleaseId: string | undefined,
): { journeyPlacement: Map<string, string>; unplacedJourneys: string[] } {
  const acceptedJourneyIds = new Set(journeys.map(j => j.id));
  const journeyPlacement = placeDeclaredJourneys(llmReleases, acceptedJourneyIds, byRelease);
  const unplacedJourneys = placeUnplacedJourneys(acceptedJourneyIds, journeyPlacement, byRelease, firstReleaseId);
  return { journeyPlacement, unplacedJourneys };
}

/** Earliest-ordinal release among the placed journeys backed by a workflow. */
function findEarliestReleaseForJourneys(
  journeyIds: string[],
  journeyPlacement: Map<string, string>,
  llmByRelease: ReleaseSkeletonMap,
): { release_id: string; ordinal: number } | null {
  let earliest: { release_id: string; ordinal: number } | null = null;
  for (const jId of journeyIds) {
    const relId = journeyPlacement.get(jId);
    if (!relId) continue;
    const ord = llmByRelease.get(relId)!.ordinal;
    if (earliest === null || ord < earliest.ordinal) {
      earliest = { release_id: relId, ordinal: ord };
    }
  }
  return earliest;
}

/**
 * A workflow's release is the earliest release containing any journey it
 * backs (via kind:journey_step triggers). Workflows with no journey_step
 * triggers — or whose refs all point at non-placed journeys — go to
 * cross_cutting. Mutates `byRelease`; returns cross-cutting workflow ids.
 */
function placeWorkflows(
  workflows: WorkflowV2[],
  journeyPlacement: Map<string, string>,
  llmByRelease: ReleaseSkeletonMap,
  byRelease: ReleaseContentsMap,
): string[] {
  const crossCuttingWorkflows: string[] = [];
  for (const w of workflows) {
    const journeyIds = w.triggers
      .filter((t): t is Extract<WorkflowTrigger, { kind: 'journey_step' }> => t.kind === 'journey_step')
      .map(t => t.journey_id);
    if (journeyIds.length === 0) {
      crossCuttingWorkflows.push(w.id);
      continue;
    }
    const earliest = findEarliestReleaseForJourneys(journeyIds, journeyPlacement, llmByRelease);
    if (earliest) {
      byRelease.get(earliest.release_id)!.workflows.push(w.id);
    } else {
      // All journey_step refs pointed at non-existent / non-placed journeys.
      // Fall back to cross_cutting rather than dropping the workflow.
      crossCuttingWorkflows.push(w.id);
    }
  }
  return crossCuttingWorkflows;
}

/**
 * domainId → earliest release ordinal, from journeys (via their
 * businessDomainIds) and workflows (via their placed release).
 */
function buildDomainToEarliestRelease(
  journeys: UserJourney[],
  workflows: WorkflowV2[],
  journeyPlacement: Map<string, string>,
  llmByRelease: ReleaseSkeletonMap,
  byRelease: ReleaseContentsMap,
): Map<string, number> {
  const domainToEarliestRelease = new Map<string, number>();
  for (const j of journeys) {
    const relId = journeyPlacement.get(j.id);
    if (!relId) continue;
    const ord = llmByRelease.get(relId)!.ordinal;
    const domains = (j as unknown as { businessDomainIds?: string[] }).businessDomainIds ?? [];
    for (const d of domains) setEarliestOrdinal(domainToEarliestRelease, d, ord);
  }
  for (const w of workflows) {
    const wfOrdinal = findWorkflowReleaseOrdinal(w, byRelease, llmByRelease);
    if (wfOrdinal === undefined) continue; // workflow is cross_cutting
    setEarliestOrdinal(domainToEarliestRelease, w.businessDomainId, wfOrdinal);
  }
  return domainToEarliestRelease;
}

/**
 * An entity goes in the earliest release that contains any journey or
 * workflow in its businessDomainId. Entities are never cross_cutting — if
 * no release has the entity's domain it defaults to the first release and
 * is reported as orphan. Mutates `byRelease`; returns orphan entity ids.
 */
function placeEntities(
  entities: Entity[],
  domainToEarliestRelease: Map<string, number>,
  ordinalToReleaseId: Map<number, string>,
  byRelease: ReleaseContentsMap,
  firstReleaseId: string | undefined,
): string[] {
  const orphanEntities: string[] = [];
  for (const e of entities) {
    const ord = domainToEarliestRelease.get(e.businessDomainId);
    if (ord !== undefined) {
      byRelease.get(ordinalToReleaseId.get(ord)!)!.entities.push(e.id);
      continue;
    }
    orphanEntities.push(e.id);
    if (firstReleaseId) byRelease.get(firstReleaseId)!.entities.push(e.id);
  }
  return orphanEntities;
}

function extractComplianceTriggerId(t: WorkflowTrigger): string | undefined {
  return t.kind === 'compliance' ? t.regime_id : undefined;
}

function extractIntegrationTriggerId(t: WorkflowTrigger): string | undefined {
  return t.kind === 'integration' ? t.integration_id : undefined;
}

/**
 * triggerId → earliest workflow-release ordinal, for triggers matched by
 * `extractId`. Used for the compliance / integration release overrides.
 */
function mapTriggerIdsToEarliestRelease(
  workflows: WorkflowV2[],
  byRelease: ReleaseContentsMap,
  llmByRelease: ReleaseSkeletonMap,
  extractId: (t: WorkflowTrigger) => string | undefined,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const w of workflows) {
    const wfOrdinal = findWorkflowReleaseOrdinal(w, byRelease, llmByRelease);
    if (wfOrdinal === undefined) continue;
    for (const t of w.triggers) {
      const id = extractId(t);
      if (id === undefined) continue;
      setEarliestOrdinal(result, id, wfOrdinal);
    }
  }
  return result;
}

/**
 * Split `ids` into per-release placements (via `idToOrdinal`, applied by
 * `place`) vs cross_cutting (returned). Mutates `byRelease` through `place`.
 */
function partitionByRelease(
  ids: string[],
  idToOrdinal: Map<string, number>,
  ordinalToReleaseId: Map<number, string>,
  byRelease: ReleaseContentsMap,
  place: (contents: ReleaseContents, id: string) => void,
): string[] {
  const crossCutting: string[] = [];
  for (const id of ids) {
    const ord = idToOrdinal.get(id);
    if (ord !== undefined) {
      place(byRelease.get(ordinalToReleaseId.get(ord)!)!, id);
    } else {
      crossCutting.push(id);
    }
  }
  return crossCutting;
}

function buildRelease(r: LlmReleaseSkeleton, c: ReleaseContents): ReleaseV2 {
  return {
    release_id: r.release_id,
    ordinal: r.ordinal,
    name: r.name,
    description: r.description,
    rationale: r.rationale,
    contains: {
      journeys: uniqSorted(c.journeys),
      workflows: uniqSorted(c.workflows),
      entities: uniqSorted(c.entities),
      compliance: uniqSorted(c.compliance),
      integrations: uniqSorted(c.integrations),
      vocabulary: uniqSorted(c.vocabulary),
      // New slots — empty until the builder caller is wired to feed
      // upstream VV / QA / TECH ids.
      vv_requirements: uniqSorted(c.vv_requirements),
      quality_attributes: uniqSorted(c.quality_attributes),
      technical_constraints: uniqSorted(c.technical_constraints),
    },
  };
}

function assembleReleases(
  llmReleases: LlmReleaseSkeleton[],
  byRelease: ReleaseContentsMap,
): ReleaseV2[] {
  return llmReleases.map(r => buildRelease(r, byRelease.get(r.release_id)!));
}

/**
 * Deterministic assignment. Returns a fully-populated
 * `ReleasePlanContentV2`-shaped manifest (minus schema metadata; caller
 * wraps) with every accepted artifact placed in exactly one release's
 * `contains[type]` or in `cross_cutting[type]`.
 */
export function buildReleaseManifest(input: BuildManifestInputs): BuildManifestResult {
  const llmReleases = sortAndRenumberReleases(input.releases);
  const { byRelease, llmByRelease } = buildReleaseMaps(llmReleases);
  const firstReleaseId = llmReleases[0]?.release_id;

  // ── Journeys ─────────────────────────────────────────────────────
  const { journeyPlacement, unplacedJourneys } =
    placeJourneys(llmReleases, input.journeys, byRelease, firstReleaseId);

  // ── Workflows ────────────────────────────────────────────────────
  const crossCuttingWorkflows =
    placeWorkflows(input.workflows, journeyPlacement, llmByRelease, byRelease);

  const ordinalToReleaseId = buildOrdinalToReleaseId(llmByRelease);

  // ── Entities ─────────────────────────────────────────────────────
  const domainToEarliestRelease = buildDomainToEarliestRelease(
    input.journeys, input.workflows, journeyPlacement, llmByRelease, byRelease,
  );
  const orphanEntities = placeEntities(
    input.entities, domainToEarliestRelease, ordinalToReleaseId, byRelease, firstReleaseId,
  );

  // ── Compliance ───────────────────────────────────────────────────
  // Default: cross_cutting. Override: earliest workflow whose
  // kind:compliance trigger references the compliance id.
  const complianceToWorkflowRelease = mapTriggerIdsToEarliestRelease(
    input.workflows, byRelease, llmByRelease, extractComplianceTriggerId,
  );
  const crossCuttingCompliance = partitionByRelease(
    input.complianceIds, complianceToWorkflowRelease, ordinalToReleaseId, byRelease,
    (c, id) => { c.compliance.push(id); },
  );

  // ── Integrations ─────────────────────────────────────────────────
  // Default: cross_cutting. Override: earliest workflow whose
  // kind:integration trigger references the integration id.
  const integrationToWorkflowRelease = mapTriggerIdsToEarliestRelease(
    input.workflows, byRelease, llmByRelease, extractIntegrationTriggerId,
  );
  const crossCuttingIntegrations = partitionByRelease(
    input.integrations.map(it => it.id), integrationToWorkflowRelease, ordinalToReleaseId, byRelease,
    (c, id) => { c.integrations.push(id); },
  );

  // ── Vocabulary ───────────────────────────────────────────────────
  // Always cross_cutting. Canonical vocabulary is product-wide.
  const crossCuttingVocabulary: string[] = input.vocabulary.map(v => v.id);

  // ── VV / QA / TECH ───────────────────────────────────────────────
  // Default routing: all three default to cross_cutting. These are
  // typically product-wide quality / verification / tech-stack
  // constraints, not release-specific deliverables, and the 1.8 LLM
  // does not currently produce a release placement for them. Anchoring
  // them in cross_cutting keeps the manifest coverage-clean while
  // letting `assignReleaseToRoot` resolve NFR roots whose only trace
  // ids point at a VV-* / QA-N / TECH-* (cross-cutting-only roots
  // anchor to Release 1 rather than Backlog — see phase2.ts).
  const crossCuttingVv: string[] = input.vvRequirementIds ?? [];
  const crossCuttingQa: string[] = input.qualityAttributeIds ?? [];
  const crossCuttingTech: string[] = input.technicalConstraintIds ?? [];

  // ── Assemble ─────────────────────────────────────────────────────
  const releases: ReleaseV2[] = assembleReleases(llmReleases, byRelease);

  return {
    releases,
    crossCutting: {
      workflows:    uniqSorted(crossCuttingWorkflows),
      compliance:   uniqSorted(crossCuttingCompliance),
      integrations: uniqSorted(crossCuttingIntegrations),
      vocabulary:   uniqSorted(crossCuttingVocabulary),
      vv_requirements:       uniqSorted(crossCuttingVv),
      quality_attributes:    uniqSorted(crossCuttingQa),
      technical_constraints: uniqSorted(crossCuttingTech),
    },
    unplacedJourneys: unplacedJourneys.sort((a, b) => a.localeCompare(b)),
    orphanEntities: orphanEntities.sort((a, b) => a.localeCompare(b)),
  };
}
