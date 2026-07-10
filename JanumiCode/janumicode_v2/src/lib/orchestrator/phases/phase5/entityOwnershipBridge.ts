/**
 * Phase 5.1b — entity_ownership_reconciliation (pure, DDD).
 *
 * The P5 data_model_skeleton runs ONCE PER COMPONENT in isolation, so every
 * bounded context that merely REFERENCES a concept (WorkOrder, PhotoEvidence)
 * independently re-models it as a full owned aggregate — and saturation then
 * deep-decomposes all N copies (cal-41: 152/172 duplicate-named roots, ~8h).
 *
 * DDD-correct resolution — NOT a merge to a shared kernel (that is the coupling
 * we must avoid, and it breaks the modular-monolith → microservices path):
 *   - exactly ONE context OWNS each aggregate (source of truth) → deep-decompose ONCE;
 *   - every other context keeps a thin REFERENCE by id (+ its own local fields) →
 *     never deep-decomposed;
 *   - a true VALUE OBJECT (immutable, no identity) is copied BY VALUE into each
 *     context (no owner, no reference) → never deep-decomposed.
 *
 * Reference-by-id is precisely the seam that survives extracting a context into
 * its own service later. Divergent per-context field sets are PRESERVED (each
 * context's own needs), not merged.
 *
 * Intelligence is placed where it pays and nowhere else:
 *   - grouping + owner ELECTION are deterministic (structural natural-key walk +
 *     the P1 businessDomainId → software_domain → component chain; no regex);
 *   - the semantic aggregate-vs-value-object-vs-separate classification and the
 *     within-context owner tie-break come from an INJECTED adjudicator (LLM),
 *     whose proposal the producer VALIDATES (an owner it names must be a real
 *     member) — "each phase normalizes its own output; deterministic bridges
 *     live in the producer".
 *
 * This module is PURE (the adjudicator is injected) so it is unit-testable with
 * no DB/LLM. The caller (phase5.ts) builds the ownership context from the DB and
 * supplies the adjudicator.
 */

import { slug, mintEntityId } from './dataModelIdMinter';
import type {
  EntityOwnershipRole,
  EntityOwnershipVerdict,
  EntityOwnershipDecision,
  EntityOwnershipMapContent,
} from '../../../types/records';

// ── Shapes (loose — matches the P5 skeleton data_models entity) ─────

export interface BridgeField { name?: string; type?: string; constraints?: string }
export interface BridgeEntity {
  id?: string;
  name: string;
  fields?: BridgeField[];
  relationships?: string[];
  traces_to?: string[];
  // written back by the bridge:
  ownership_role?: EntityOwnershipRole;
  owner_entity_id?: string;
  owner_component_id?: string;
}
export interface BridgeModel { component_id: string; entities: BridgeEntity[] }

/** Ownership context the CALLER derives from the DB (no I/O in this module). */
export interface OwnershipContext {
  /** conceptKey (slug of a P1 entity name) → its single owning business-domain id. */
  conceptBusinessDomain: Map<string, string>;
  /** software-domain id → the business-domain id(s) it maps to. */
  domainBusinessDomains: Map<string, string[]>;
  /** component id → its software-domain id. */
  componentDomain: Map<string, string>;
}

export interface AdjudicationRequest {
  concept_key: string;
  concept_name: string;
  members: Array<{ component_id: string; fields: string[] }>;
}
export interface AdjudicationVerdict {
  concept_key: string;
  verdict: EntityOwnershipVerdict;
  /** Suggested owner (validated against real members by the producer). */
  owner_component_id?: string;
  rationale?: string;
}
export type Adjudicator = (reqs: AdjudicationRequest[]) => Promise<AdjudicationVerdict[]>;

export interface ReconcileResult {
  ownershipMap: EntityOwnershipMapContent;
  stats: { concepts: number; multiComponent: number; owned: number; referenced: number; value_object: number; separate: number; adjudicated: number };
}

// ── Context construction (pure; caller supplies the raw upstream arrays) ──

/** The business-domain id(s) a software domain maps to (either upstream key). */
function pickBusinessDomains(d: { maps_to_business_domains?: string[]; business_domain_ids?: string[] }): string[] {
  if (Array.isArray(d.maps_to_business_domains)) return d.maps_to_business_domains;
  if (Array.isArray(d.business_domain_ids)) return d.business_domain_ids;
  return [];
}

/**
 * Build the {@link OwnershipContext} from raw upstream artifact arrays — the P1
 * entity catalog (concept → single owning business domain), the P4 software
 * domains (→ business domains), and the components (→ software domain). Pure +
 * tolerant: missing signals just leave the domain chain silent (the bridge then
 * falls back to the adjudicator / field-richness tie-break).
 */
export function buildOwnershipContext(input: {
  p1Entities: Array<{ name?: string; businessDomainId?: string }>;
  softwareDomains: Array<{ id?: string; maps_to_business_domains?: string[]; business_domain_ids?: string[] }>;
  components: Array<{ id?: string; domain_id?: string | null }>;
}): OwnershipContext {
  const conceptBusinessDomain = new Map<string, string>();
  for (const e of input.p1Entities ?? []) {
    const n = (e.name ?? '').trim();
    if (n && typeof e.businessDomainId === 'string' && e.businessDomainId) conceptBusinessDomain.set(slug(n), e.businessDomainId);
  }
  const domainBusinessDomains = new Map<string, string[]>();
  for (const d of input.softwareDomains ?? []) {
    if (typeof d.id === 'string' && d.id) {
      domainBusinessDomains.set(d.id, pickBusinessDomains(d));
    }
  }
  const componentDomain = new Map<string, string>();
  for (const c of input.components ?? []) {
    if (typeof c.id === 'string' && c.id && typeof c.domain_id === 'string' && c.domain_id) componentDomain.set(c.id, c.domain_id);
  }
  return { conceptBusinessDomain, domainBusinessDomains, componentDomain };
}

/** Render a compact "id — responsibility [domain]" block to help the adjudicator. */
export function buildComponentContextLines(
  components: Array<{ id?: string; name?: string; responsibility?: string; description?: string; domain_id?: string | null }>,
): string {
  return (components ?? [])
    .filter((c) => typeof c.id === 'string' && c.id)
    .map((c) => {
      let detail = '';
      if (c.responsibility) detail = ` — ${c.responsibility}`;
      else if (c.description) detail = ` — ${c.description}`;
      const namePart = c.name ? ` (${c.name})` : '';
      const domainPart = c.domain_id ? ` [${c.domain_id}]` : '';
      return `- ${c.id}${namePart}${detail}${domainPart}`;
    })
    .join('\n');
}

// ── Helpers ─────────────────────────────────────────────────────────

function fieldNames(e: BridgeEntity): Set<string> {
  return new Set((e.fields ?? []).map((f) => (f.name ?? '').trim().toLowerCase()).filter(Boolean));
}

/** A concept is a COINCIDENTAL collision (→ 'separate', keep all owned) when no
 *  field name is shared by any two of its members. Otherwise it is one shared
 *  concept whose ownership must be resolved. */
function anySharedField(members: Array<{ fields: Set<string> }>): boolean {
  const seen = new Map<string, number>();
  for (const m of members) for (const f of m.fields) seen.set(f, (seen.get(f) ?? 0) + 1);
  for (const n of seen.values()) if (n >= 2) return true;
  return false;
}

/** Deterministic owner election via the P1 domain chain, then tie-breaks.
 *  Returns the elected component id + how it was decided. Never throws. */
function electOwner(
  conceptKey: string,
  members: Array<{ component_id: string; fieldCount: number }>,
  ctx: OwnershipContext,
  suggested?: string,
): { owner: string; source: EntityOwnershipDecision['source'] } {
  const candidates = members.map((m) => m.component_id);
  const validSuggested = suggested && candidates.includes(suggested) ? suggested : undefined;

  // PRIMARY — the P1 chain: concept → business-domain → software-domain(s) → component(s).
  const bizId = ctx.conceptBusinessDomain.get(conceptKey);
  const owningDomains = new Set<string>();
  if (bizId) {
    for (const [domId, bizIds] of ctx.domainBusinessDomains) if (bizIds.includes(bizId)) owningDomains.add(domId);
  }
  const domainMatched = candidates.filter((c) => {
    const d = ctx.componentDomain.get(c);
    return d !== undefined && owningDomains.has(d);
  });

  if (domainMatched.length === 1) return { owner: domainMatched[0], source: 'deterministic' };
  // Domain silent or spans multiple components → prefer a valid adjudicator suggestion.
  if (validSuggested && (domainMatched.length === 0 || domainMatched.includes(validSuggested))) {
    return { owner: validSuggested, source: 'adjudicator' };
  }
  // Deterministic tie-break over the domain-matched set (else all candidates):
  // richest field set (fullest aggregate), then lexicographically-smallest id.
  const pool = domainMatched.length > 0 ? domainMatched : candidates;
  const byMember = new Map(members.map((m) => [m.component_id, m.fieldCount]));
  const owner = [...pool].sort((a, b) => {
    const byFields = (byMember.get(b) ?? 0) - (byMember.get(a) ?? 0);
    if (byFields) return byFields;
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  })[0];
  return { owner, source: 'deterministic' };
}

// ── Reconciliation steps (pure; each extracted for a single responsibility) ──

type ConceptMember = { component_id: string; entity: BridgeEntity };
type ConceptGroups = Map<string, ConceptMember[]>;
type ReconcileStats = ReconcileResult['stats'];

/** Group per-component entity copies by concept (structural natural-key slug).
 *  Entities without a (trimmed) name are skipped. Insertion order = model order. */
function groupByConcept(models: BridgeModel[]): ConceptGroups {
  const groups: ConceptGroups = new Map();
  for (const m of models) {
    for (const e of m.entities ?? []) {
      const name = (e.name ?? '').trim();
      if (!name) continue;
      const key = slug(name);
      const g = groups.get(key) ?? [];
      g.push({ component_id: m.component_id, entity: e });
      groups.set(key, g);
    }
  }
  return groups;
}

/** Pre-classify each group: single-component (tagged 'owned' here), coincidental
 *  collision (no shared field → separate), or genuinely shared (needs a verdict).
 *  Mutates `stats.owned` / `stats.multiComponent` and single-component entities. */
function preClassifyGroups(
  groups: ConceptGroups,
  stats: ReconcileStats,
): { needsVerdict: string[]; separateKeys: Set<string> } {
  const needsVerdict: string[] = [];
  const separateKeys = new Set<string>();
  for (const [key, members] of groups) {
    if (members.length === 1) {
      members[0].entity.ownership_role = 'owned';
      stats.owned++;
      continue;
    }
    stats.multiComponent++;
    const withFields = members.map((m) => ({ fields: fieldNames(m.entity) }));
    if (!anySharedField(withFields)) separateKeys.add(key);
    else needsVerdict.push(key);
  }
  return { needsVerdict, separateKeys };
}

/** Ask the injected adjudicator for a semantic verdict on each shared concept.
 *  Fail-open: no adjudicator / no shared concepts / any error → no verdicts.
 *  Mutates `stats.adjudicated` only when the adjudicator actually ran. */
async function adjudicateSharedConcepts(
  needsVerdict: string[],
  groups: ConceptGroups,
  adjudicate: Adjudicator | undefined,
  stats: ReconcileStats,
): Promise<Map<string, AdjudicationVerdict>> {
  const verdictByKey = new Map<string, AdjudicationVerdict>();
  if (needsVerdict.length === 0 || !adjudicate) return verdictByKey;
  const reqs: AdjudicationRequest[] = needsVerdict.map((key) => {
    const members = groups.get(key)!;
    return {
      concept_key: key,
      concept_name: members[0].entity.name,
      members: members.map((m) => ({ component_id: m.component_id, fields: [...fieldNames(m.entity)] })),
    };
  });
  let out: AdjudicationVerdict[] = [];
  try { out = (await adjudicate(reqs)) ?? []; } catch { out = []; }
  for (const v of out) if (v && typeof v.concept_key === 'string') verdictByKey.set(v.concept_key, v);
  stats.adjudicated = verdictByKey.size;
  return verdictByKey;
}

/** Decide the final verdict: coincidental collision → 'separate'; otherwise the
 *  adjudicator's verdict if it is one of the three valid values, else 'owned_aggregate'. */
function resolveVerdict(isCoincidental: boolean, v: AdjudicationVerdict | undefined): EntityOwnershipVerdict {
  if (isCoincidental) return 'separate';
  if (v?.verdict === 'shared_value_object' || v?.verdict === 'separate' || v?.verdict === 'owned_aggregate') {
    return v.verdict;
  }
  return 'owned_aggregate';
}

/** Elect an owner for a genuinely-shared aggregate, tag members owned/referenced
 *  (reference stubs keep their own fields), and record the decision. */
function applyOwnedAggregate(
  key: string,
  members: ConceptMember[],
  ctx: OwnershipContext,
  decisions: EntityOwnershipDecision[],
  stats: ReconcileStats,
  verdict: { suggested?: string; source0?: EntityOwnershipDecision['source']; rationale?: string } = {},
): void {
  const { suggested, source0, rationale } = verdict;
  const { owner, source } = electOwner(
    key,
    members.map((m) => ({ component_id: m.component_id, fieldCount: fieldNames(m.entity).size })),
    ctx,
    suggested,
  );
  const ownerName = members.find((m) => m.component_id === owner)?.entity.name ?? members[0].entity.name;
  const ownerEntityId = mintEntityId(owner, ownerName);
  for (const { component_id, entity } of members) {
    if (component_id === owner) {
      entity.ownership_role = 'owned';
      stats.owned++;
    } else {
      entity.ownership_role = 'referenced';
      entity.owner_entity_id = ownerEntityId;
      entity.owner_component_id = owner;
      stats.referenced++;
    }
  }
  decisions.push({
    concept_key: key,
    concept_name: ownerName,
    verdict: 'owned_aggregate',
    owner_component_id: owner,
    owner_entity_id: ownerEntityId,
    member_component_ids: members.map((m) => m.component_id),
    source: source0 === 'adjudicator' ? 'adjudicator' : source,
    rationale,
  });
}

/** Coincidental collision or adjudicated 'separate': keep every copy owned and
 *  surface the concept as unresolved. `isCoincidental` selects source/rationale. */
function applySeparate(
  key: string,
  members: ConceptMember[],
  isCoincidental: boolean,
  v: AdjudicationVerdict | undefined,
  decisions: EntityOwnershipDecision[],
  unresolved: string[],
  stats: ReconcileStats,
): void {
  for (const { entity } of members) { entity.ownership_role = 'owned'; stats.owned++; }
  stats.separate++;
  decisions.push({
    concept_key: key, concept_name: members[0].entity.name, verdict: 'separate',
    member_component_ids: members.map((m) => m.component_id),
    source: isCoincidental ? 'fail_open' : 'adjudicator',
    rationale: isCoincidental ? 'coincidental name collision (no shared field) — kept all owned' : v?.rationale,
  });
  unresolved.push(key);
}

/** Adjudicated shared value object: copied by value into every context (no owner). */
function applyValueObject(
  key: string,
  members: ConceptMember[],
  v: AdjudicationVerdict | undefined,
  decisions: EntityOwnershipDecision[],
  stats: ReconcileStats,
): void {
  for (const { entity } of members) { entity.ownership_role = 'shared_value_object'; stats.value_object++; }
  decisions.push({
    concept_key: key, concept_name: members[0].entity.name, verdict: 'shared_value_object',
    member_component_ids: members.map((m) => m.component_id),
    source: 'adjudicator', rationale: v?.rationale,
  });
}

/** Apply every multi-component concept's verdict in `[...separateKeys, ...needsVerdict]`
 *  order, dispatching to the per-verdict tagger. Mutates entities/decisions/unresolved/stats. */
function applyDecisions(
  groups: ConceptGroups,
  separateKeys: Set<string>,
  needsVerdict: string[],
  verdictByKey: Map<string, AdjudicationVerdict>,
  ctx: OwnershipContext,
  out: { decisions: EntityOwnershipDecision[]; unresolved: string[]; stats: ReconcileStats },
): void {
  const { decisions, unresolved, stats } = out;
  for (const key of [...separateKeys, ...needsVerdict]) {
    const members = groups.get(key)!;
    const v = verdictByKey.get(key);
    const isCoincidental = separateKeys.has(key);
    const verdict = resolveVerdict(isCoincidental, v);
    if (verdict === 'separate') {
      applySeparate(key, members, isCoincidental, v, decisions, unresolved, stats);
    } else if (verdict === 'shared_value_object') {
      applyValueObject(key, members, v, decisions, stats);
    } else {
      applyOwnedAggregate(key, members, ctx, decisions, stats, { suggested: v?.owner_component_id, source0: v ? 'adjudicator' : undefined, rationale: v?.rationale });
    }
  }
}

// ── Main entry ──────────────────────────────────────────────────────

/**
 * Reconcile cross-component entity ownership IN PLACE: every entity in `models`
 * is tagged `ownership_role` (+ owner ids for references), and an
 * `entity_ownership_map` is returned. Owned aggregates keep `ownership_role:'owned'`
 * so seeding still deep-decomposes them; referenced / shared-value-object copies
 * are tagged so seeding writes them as terminal nodes saturation never enqueues.
 * The per-context fields of every copy are preserved verbatim.
 */
export async function reconcileEntityOwnership(
  models: BridgeModel[],
  ctx: OwnershipContext,
  adjudicate?: Adjudicator,
): Promise<ReconcileResult> {
  // Group per-component copies by concept (structural natural key).
  const groups = groupByConcept(models);

  const decisions: EntityOwnershipDecision[] = [];
  const unresolved: string[] = [];
  const stats: ReconcileStats = { concepts: groups.size, multiComponent: 0, owned: 0, referenced: 0, value_object: 0, separate: 0, adjudicated: 0 };

  // Pre-classify (single / coincidental / shared), then adjudicate the shared set
  // and apply every verdict — each step mutates decisions/unresolved/stats/entities.
  const { needsVerdict, separateKeys } = preClassifyGroups(groups, stats);
  const verdictByKey = await adjudicateSharedConcepts(needsVerdict, groups, adjudicate, stats);
  applyDecisions(groups, separateKeys, needsVerdict, verdictByKey, ctx, { decisions, unresolved, stats });

  const ownershipMap: EntityOwnershipMapContent = { kind: 'entity_ownership_map', decisions, unresolved };
  return { ownershipMap, stats };
}
