/**
 * Phase 4 scope-shaping helpers (Levers 1a + 1b).
 *
 * Pure, deterministic, unit-testable functions that right-size the Phase 4.2
 * component set BEFORE it seeds the saturation loop:
 *
 *   1a — partitionComponentsByKind: split functional components (buildable
 *        services realizing user stories) from cross-cutting NFR concerns
 *        (latency/encryption/availability/security/compliance). Cross-cutting
 *        components are NOT decomposed/built as standalone services; they
 *        become `cross_cutting_constraints` attached to the functional
 *        components they apply to (the NFR info still reaches the executor
 *        via the packet's NFR section — no information loss).
 *
 *   1b — computeComponentBudget + consolidateToBudget: cap the FUNCTIONAL
 *        component count to a budget keyed to upstream intent scale
 *        (accepted user stories + software domains), not a hardcoded number.
 *        Over-budget sets are consolidated by merging within the same
 *        software domain, UNION-ing coverage so no accepted user story is
 *        ever dropped (a coverage guard the caller re-verifies).
 *
 * Everything here is structural — no domain keywords — so it generalizes
 * across any future intent.
 */

// Minimal structural shape these helpers need. Mirrors phase4.ts `Component`
// without importing it (keeps this module dependency-light + testable).
export interface ShapingComponent {
  id: string;
  name: string;
  domain_id?: string;
  responsibilities: Array<{ id: string; statement: string }>;
  dependencies?: Array<{ target_component_id: string; dependency_type: string }>;
  satisfies_requirement_ids?: string[];
  traces_to?: string[];
  component_kind?: 'functional' | 'cross_cutting';
  applies_to_components?: string[];
}

// ── 1a — functional vs cross-cutting partition ──────────────────────

/**
 * Fill in `component_kind` when the LLM omitted it (local models have
 * schema-adherence wobble — probe showed gpt-oss grouping by kind rather than
 * emitting the per-component field). Inference is STRUCTURAL, matching the
 * template contract: cross-cutting components declare `applies_to_components`
 * and carry NO user-story `traces_to`, whereas functional components MUST
 * trace to ≥1 user story. So an absent kind with empty `traces_to` ⇒
 * cross_cutting; otherwise ⇒ functional. This mirrors the pre-1a "empty
 * traces_to = cross-cutting infrastructure" exemption, so it never reclassifies
 * a properly-traced functional component. Returns a NEW array (no mutation).
 */
export function normalizeComponentKinds<T extends {
  component_kind?: string; traces_to?: string[]; applies_to_components?: string[];
}>(components: T[]): { components: T[]; inferred: number } {
  let inferred = 0;
  const out = components.map(c => {
    if (c.component_kind === 'functional' || c.component_kind === 'cross_cutting') return c;
    const hasTraces = Array.isArray(c.traces_to) && c.traces_to.length > 0;
    const hasApplies = Array.isArray(c.applies_to_components) && c.applies_to_components.length > 0;
    // cross_cutting when it declares applies_to_components OR carries no
    // user-story traces (the contract's signal); functional otherwise.
    const kind = hasApplies || !hasTraces ? 'cross_cutting' : 'functional';
    inferred++;
    return { ...c, component_kind: kind } as T;
  });
  return { components: out, inferred };
}

export function partitionComponentsByKind<T extends { component_kind?: string }>(
  components: T[],
): { functional: T[]; crossCutting: T[] } {
  const functional: T[] = [];
  const crossCutting: T[] = [];
  for (const c of components) {
    if (c.component_kind === 'cross_cutting') crossCutting.push(c);
    else functional.push(c);
  }
  return { functional, crossCutting };
}

export interface CrossCuttingConstraint {
  id: string;
  name: string;
  responsibilities: string[];
  applies_to_components: string[];
}

/**
 * Build the `cross_cutting_constraints` artifact content from the
 * cross-cutting components. `applies_to_components` falls back to the
 * concern's `traces_to` (the components/stories it referenced) when the LLM
 * did not populate it explicitly.
 */
export function buildCrossCuttingConstraints(
  crossCutting: ShapingComponent[],
): { kind: 'cross_cutting_constraints'; concerns: CrossCuttingConstraint[] } {
  return {
    kind: 'cross_cutting_constraints',
    concerns: crossCutting.map(c => ({
      id: c.id,
      name: c.name,
      responsibilities: (c.responsibilities ?? []).map(r => r.statement),
      applies_to_components: c.applies_to_components ?? c.traces_to ?? [],
    })),
  };
}

// ── 1b — scale budget + consolidation ───────────────────────────────

/**
 * Functional-component budget keyed to intent scale:
 *   max(#acceptedDomains, ceil(ratio × #acceptedUserStories), 1)
 * `ratio <= 0` disables the gate (returns Infinity).
 */
export function computeComponentBudget(
  acceptedUserStoryCount: number,
  acceptedDomainCount: number,
  ratio: number,
): number {
  if (ratio <= 0) return Number.POSITIVE_INFINITY;
  const byStories = Math.ceil(ratio * acceptedUserStoryCount);
  return Math.max(acceptedDomainCount, byStories, 1);
}

function unionIds(a?: string[], b?: string[]): string[] {
  return [...new Set([...(a ?? []), ...(b ?? [])])];
}

export interface ConsolidationResult {
  components: ShapingComponent[];
  merges: Array<{ into: string; merged: string[] }>;
  /** True when the merge kept every accepted user story covered. */
  coveragePreserved: boolean;
}

/**
 * Deterministically consolidate a functional component set down toward
 * `budget` by merging components within the SAME software domain (the merge
 * with the least architectural blast radius). Coverage (`traces_to` +
 * `satisfies_requirement_ids`) is UNION-ed into the surviving component, and
 * dependency edges that targeted a merged component are remapped to the
 * survivor, so no accepted user story is dropped.
 *
 * Cannot reduce below the number of distinct domains without cross-domain
 * merges (which we don't do) — that floor matches the budget floor.
 * Returns the original set untouched when already within budget.
 */
export function consolidateToBudget(
  input: ShapingComponent[],
  budget: number,
  acceptedUserStoryIds: Set<string>,
): ConsolidationResult {
  // Coverage the original set provides (intersected with accepted stories).
  const coveredBefore = coverageOf(input, acceptedUserStoryIds);

  if (!Number.isFinite(budget) || input.length <= budget) {
    return { components: input, merges: [], coveragePreserved: true };
  }

  // Deep clone so callers' inputs are never mutated.
  const components: ShapingComponent[] = input.map(c => ({
    ...c,
    responsibilities: [...(c.responsibilities ?? [])],
    dependencies: [...(c.dependencies ?? [])],
    satisfies_requirement_ids: [...(c.satisfies_requirement_ids ?? [])],
    traces_to: [...(c.traces_to ?? [])],
  }));

  const byDomain = new Map<string, ShapingComponent[]>();
  for (const c of components) {
    const d = c.domain_id ?? '__none__';
    const g = byDomain.get(d);
    if (g) g.push(c); else byDomain.set(d, [c]);
  }

  const merges: Array<{ into: string; merged: string[] }> = [];
  const remap = new Map<string, string>(); // merged id → survivor id
  let total = components.length;

  while (total > budget) {
    // Largest domain group with ≥2 members is the next merge target.
    let target: ShapingComponent[] | null = null;
    for (const g of byDomain.values()) {
      if (g.length >= 2 && (!target || g.length > target.length)) target = g;
    }
    if (!target) break; // every domain has ≤1 component — at the floor

    const into = target[0];
    const victim = target.pop() as ShapingComponent;
    into.responsibilities = [...into.responsibilities, ...victim.responsibilities];
    into.satisfies_requirement_ids = unionIds(into.satisfies_requirement_ids, victim.satisfies_requirement_ids);
    into.traces_to = unionIds(into.traces_to, victim.traces_to);
    into.dependencies = [...(into.dependencies ?? []), ...(victim.dependencies ?? [])];
    remap.set(victim.id, into.id);
    const existing = merges.find(m => m.into === into.id);
    if (existing) existing.merged.push(victim.id);
    else merges.push({ into: into.id, merged: [victim.id] });
    total--;
  }

  const result = [...byDomain.values()].flat();

  // Remap dependency edges pointing at a merged component to its survivor,
  // drop self-edges and duplicates.
  for (const c of result) {
    const seen = new Set<string>();
    c.dependencies = (c.dependencies ?? [])
      .map(d => ({ ...d, target_component_id: remap.get(d.target_component_id) ?? d.target_component_id }))
      .filter(d => {
        if (d.target_component_id === c.id) return false;
        const key = `${d.target_component_id}|${d.dependency_type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  const coveredAfter = coverageOf(result, acceptedUserStoryIds);
  const coveragePreserved = [...coveredBefore].every(id => coveredAfter.has(id));

  return { components: result, merges, coveragePreserved };
}

function coverageOf(components: ShapingComponent[], acceptedUserStoryIds: Set<string>): Set<string> {
  const covered = new Set<string>();
  for (const c of components) {
    for (const us of c.traces_to ?? []) if (acceptedUserStoryIds.has(us)) covered.add(us);
  }
  return covered;
}
