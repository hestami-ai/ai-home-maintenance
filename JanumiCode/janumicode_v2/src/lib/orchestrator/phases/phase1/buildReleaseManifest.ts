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
  return { journeys: [], workflows: [], entities: [], compliance: [], integrations: [], vocabulary: [] };
}

function uniqSorted(xs: string[]): string[] {
  return Array.from(new Set(xs)).sort();
}

/**
 * Deterministic assignment. Returns a fully-populated
 * `ReleasePlanContentV2`-shaped manifest (minus schema metadata; caller
 * wraps) with every accepted artifact placed in exactly one release's
 * `contains[type]` or in `cross_cutting[type]`.
 */
export function buildReleaseManifest(input: BuildManifestInputs): BuildManifestResult {
  const llmReleases = [...input.releases].sort((a, b) => a.ordinal - b.ordinal);
  llmReleases.forEach((r, i) => { r.ordinal = i + 1; });

  // Release-keyed ReleaseContents; journeys populated from LLM output.
  // After filling, we compute the other types.
  const byRelease = new Map<string, ReleaseContents>();
  const llmByRelease = new Map<string, LlmReleaseSkeleton>();
  for (const r of llmReleases) {
    byRelease.set(r.release_id, emptyContains());
    llmByRelease.set(r.release_id, r);
  }

  // ── Journeys ─────────────────────────────────────────────────────
  // Place each accepted journey into the release the LLM chose. Any
  // journey the LLM missed is silently placed in REL-1 (or the first
  // release) as a safety default — the 1.8 verifier will surface a
  // gap if this happens, and we return the list for caller inspection.
  const acceptedJourneyIds = new Set(input.journeys.map(j => j.id));
  const journeyPlacement = new Map<string, string>(); // journeyId -> release_id
  const firstReleaseId = llmReleases[0]?.release_id;

  for (const r of llmReleases) {
    for (const jId of r.contains_journeys) {
      if (!acceptedJourneyIds.has(jId)) continue; // LLM invented an id — skip silently
      if (journeyPlacement.has(jId)) continue; // LLM double-placed — first one wins
      journeyPlacement.set(jId, r.release_id);
      byRelease.get(r.release_id)!.journeys.push(jId);
    }
  }
  const unplacedJourneys: string[] = [];
  for (const jId of acceptedJourneyIds) {
    if (!journeyPlacement.has(jId)) {
      unplacedJourneys.push(jId);
      if (firstReleaseId) {
        journeyPlacement.set(jId, firstReleaseId);
        byRelease.get(firstReleaseId)!.journeys.push(jId);
      }
    }
  }

  // ── Workflows ────────────────────────────────────────────────────
  // A workflow's release is the earliest release containing any
  // journey it backs (via kind:journey_step triggers). If the workflow
  // has no journey_step triggers, it goes to cross_cutting.
  const crossCuttingWorkflows: string[] = [];
  for (const w of input.workflows) {
    const journeyIds = w.triggers
      .filter((t): t is Extract<WorkflowV2['triggers'][number], { kind: 'journey_step' }> => t.kind === 'journey_step')
      .map(t => t.journey_id);
    if (journeyIds.length === 0) {
      crossCuttingWorkflows.push(w.id);
      continue;
    }
    // Find the earliest-ordinal release any of the backed journeys sit in.
    let earliest: { release_id: string; ordinal: number } | null = null;
    for (const jId of journeyIds) {
      const relId = journeyPlacement.get(jId);
      if (!relId) continue;
      const ord = llmByRelease.get(relId)!.ordinal;
      if (earliest === null || ord < earliest.ordinal) {
        earliest = { release_id: relId, ordinal: ord };
      }
    }
    if (earliest) {
      byRelease.get(earliest.release_id)!.workflows.push(w.id);
    } else {
      // All journey_step refs pointed at non-existent / non-placed journeys.
      // Fall back to cross_cutting rather than dropping the workflow.
      crossCuttingWorkflows.push(w.id);
    }
  }

  // ── Entities ─────────────────────────────────────────────────────
  // An entity goes in the earliest release that contains any journey
  // or workflow in the entity's businessDomainId. Entities are never
  // cross_cutting per schema — if no release has the entity's domain,
  // it defaults to REL-1 (and is reported as orphan).
  const domainToEarliestRelease = new Map<string, number>(); // domainId -> ordinal
  const registerDomain = (domainId: string, ordinal: number) => {
    const cur = domainToEarliestRelease.get(domainId);
    if (cur === undefined || ordinal < cur) domainToEarliestRelease.set(domainId, ordinal);
  };
  for (const j of input.journeys) {
    const relId = journeyPlacement.get(j.id);
    if (!relId) continue;
    const ord = llmByRelease.get(relId)!.ordinal;
    const domains = (j as unknown as { businessDomainIds?: string[] }).businessDomainIds ?? [];
    for (const d of domains) registerDomain(d, ord);
  }
  for (const w of input.workflows) {
    // A workflow's release is determined by its triggers; find it here
    // so we can map domain→ordinal.
    let wfOrdinal: number | undefined;
    for (const [relId, contents] of byRelease) {
      if (contents.workflows.includes(w.id)) {
        wfOrdinal = llmByRelease.get(relId)!.ordinal;
        break;
      }
    }
    if (wfOrdinal === undefined) continue; // workflow is cross_cutting
    registerDomain(w.businessDomainId, wfOrdinal);
  }
  const ordinalToReleaseId = new Map<number, string>();
  for (const [relId, r] of llmByRelease) ordinalToReleaseId.set(r.ordinal, relId);
  const orphanEntities: string[] = [];
  for (const e of input.entities) {
    const ord = domainToEarliestRelease.get(e.businessDomainId);
    if (ord !== undefined) {
      const relId = ordinalToReleaseId.get(ord)!;
      byRelease.get(relId)!.entities.push(e.id);
    } else {
      orphanEntities.push(e.id);
      if (firstReleaseId) byRelease.get(firstReleaseId)!.entities.push(e.id);
    }
  }

  // ── Compliance ───────────────────────────────────────────────────
  // Default: cross_cutting. Override: if any workflow's
  // kind:compliance trigger references the compliance id, the item
  // is placed in that workflow's release.
  const complianceToWorkflowRelease = new Map<string, number>(); // compId -> earliest workflow ordinal
  for (const w of input.workflows) {
    let wfOrdinal: number | undefined;
    for (const [relId, contents] of byRelease) {
      if (contents.workflows.includes(w.id)) {
        wfOrdinal = llmByRelease.get(relId)!.ordinal;
        break;
      }
    }
    if (wfOrdinal === undefined) continue;
    for (const t of w.triggers) {
      if (t.kind !== 'compliance') continue;
      const cur = complianceToWorkflowRelease.get(t.regime_id);
      if (cur === undefined || wfOrdinal < cur) complianceToWorkflowRelease.set(t.regime_id, wfOrdinal);
    }
  }
  const crossCuttingCompliance: string[] = [];
  for (const compId of input.complianceIds) {
    const ord = complianceToWorkflowRelease.get(compId);
    if (ord !== undefined) {
      byRelease.get(ordinalToReleaseId.get(ord)!)!.compliance.push(compId);
    } else {
      crossCuttingCompliance.push(compId);
    }
  }

  // ── Integrations ─────────────────────────────────────────────────
  // Default: cross_cutting. Override: if any workflow's
  // kind:integration trigger references the integration id, place
  // in the earliest such workflow's release.
  const integrationToWorkflowRelease = new Map<string, number>();
  for (const w of input.workflows) {
    let wfOrdinal: number | undefined;
    for (const [relId, contents] of byRelease) {
      if (contents.workflows.includes(w.id)) {
        wfOrdinal = llmByRelease.get(relId)!.ordinal;
        break;
      }
    }
    if (wfOrdinal === undefined) continue;
    for (const t of w.triggers) {
      if (t.kind !== 'integration') continue;
      const cur = integrationToWorkflowRelease.get(t.integration_id);
      if (cur === undefined || wfOrdinal < cur) integrationToWorkflowRelease.set(t.integration_id, wfOrdinal);
    }
  }
  const crossCuttingIntegrations: string[] = [];
  for (const it of input.integrations) {
    const ord = integrationToWorkflowRelease.get(it.id);
    if (ord !== undefined) {
      byRelease.get(ordinalToReleaseId.get(ord)!)!.integrations.push(it.id);
    } else {
      crossCuttingIntegrations.push(it.id);
    }
  }

  // ── Vocabulary ───────────────────────────────────────────────────
  // Always cross_cutting. Canonical vocabulary is product-wide.
  const crossCuttingVocabulary: string[] = input.vocabulary.map(v => v.id);

  // ── Assemble ─────────────────────────────────────────────────────
  const releases: ReleaseV2[] = llmReleases.map(r => {
    const c = byRelease.get(r.release_id)!;
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
      },
    };
  });

  return {
    releases,
    crossCutting: {
      workflows:    uniqSorted(crossCuttingWorkflows),
      compliance:   uniqSorted(crossCuttingCompliance),
      integrations: uniqSorted(crossCuttingIntegrations),
      vocabulary:   uniqSorted(crossCuttingVocabulary),
    },
    unplacedJourneys: unplacedJourneys.sort(),
    orphanEntities: orphanEntities.sort(),
  };
}
