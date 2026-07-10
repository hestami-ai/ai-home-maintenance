/**
 * T4 — Principle invariants. Structural checks that flag failure modes
 * specific to design-principle decisions made in prompts (e.g.,
 * Single-Service Principle at Tier A, SRP at Tier C/D).
 *
 * Currently a single kind: `tier_a_srp_violation`. The check inspects a
 * list of top-tier components (path-configurable) for four smells that
 * indicate the decomposer applied SRP at Tier A instead of the
 * Single-Service Principle — the failure mode observed in cal-8 with
 * qwen's component decomposition:
 *
 *   A. same-noun sibling cluster with single-responsibility nodes
 *      ("Validate Order" + "Persist Order" + "Emit Order Event").
 *   B. ID suffix drift (`comp-foo-A`, `comp-foo-B`, `comp-foo-C` siblings).
 *   C. Tier-A nodes with exactly one verb-led responsibility
 *      (Tier A should bundle several responsibilities under one capability).
 *   D. cross-sibling dependency density above threshold
 *      (high mutual dependency = the siblings should be one component).
 *
 * Severity defaults to `advisory` — failures are reported in the result
 * but do not fail the overall assertion run. Promote to `blocking` after
 * a calibration cycle confirms the rules don't false-positive on
 * legitimate decompositions.
 */
import type { AssertionCheck, T4PrincipleAssertion } from '../fixtureSchema.js';
import { evalJsonPath } from '../jsonPath.js';

interface ComponentLike {
  id?: string;
  name?: string;
  tier?: string;
  responsibilities?: Array<{ id?: string; description?: string; statement?: string } | string>;
  dependencies?: Array<{ component_id?: string; target_component_id?: string }>;
}

// Words that look like a single imperative verb opening a responsibility
// statement. Detects Smell C (verb-led single responsibility at Tier A).
const SINGLE_VERB_RESPONSIBILITY_REGEX =
  /^\s*(validate|persist|emit|calculate|compute|fetch|store|generate|render|parse|format|serialize|deserialize|transform|filter|aggregate|notify|log|cache|encrypt|decrypt|hash|verify|authenticate|authorize|route|dispatch|publish|subscribe|enqueue|dequeue|sanitize|normalize|forward|deliver|sign|sign off|index|search|query|retrieve|load|save|delete|remove|update|create|insert|merge|split|broadcast|relay)\b/i;

// Detects Smell B (ID suffix drift). Captures a trailing `-A`, `-B`,
// `-_v1`, `-1`, `_v2`, etc., that strips out to expose a shared base.
const ID_SUFFIX_REGEX = /[-_]([A-Z]|v?\d+)$/i;

// Words to drop from a component's token pool before looking for shared
// nouns. These are the "verb-derived" or "role-suffix" words that are
// EXPECTED to differ across siblings — a noun-collision is when siblings
// share something OTHER than these.
const STOP_TOKENS = new Set([
  'comp', 'component', 'cmp', 'svc', 'service', 'module', 'mod',
  'validation', 'validator', 'validate', 'validating',
  'persistence', 'persister', 'persist', 'persisting',
  'emission', 'emitter', 'emit', 'emitting',
  'manager', 'manage', 'managing', 'management',
  'handler', 'handle', 'handling',
  'processor', 'process', 'processing',
  'controller', 'control', 'controlling',
  'coordinator', 'coordinate', 'coordinating',
  'engine', 'gateway', 'adapter', 'facade', 'proxy', 'agent',
  'a', 'b', 'c', 'd', 'e', 'f', 'g',
  'v1', 'v2', 'v3', 'v4',
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
]);

function significant_tokens(name: string | undefined, id: string | undefined): Set<string> {
  const pool = new Set<string>();
  const sources = [name ?? '', id ?? ''];
  for (const s of sources) {
    const tokens = s.toLowerCase().split(/[^a-z0-9]+/i).filter(t => t.length > 1);
    for (const t of tokens) {
      if (!STOP_TOKENS.has(t)) pool.add(t);
    }
  }
  return pool;
}

function id_base(id: string | undefined): string | null {
  if (!id) return null;
  return id.replace(ID_SUFFIX_REGEX, '');
}

function responsibility_text(r: NonNullable<ComponentLike['responsibilities']>[number]): string {
  if (typeof r === 'string') return r;
  return r.description ?? r.statement ?? '';
}

function responsibility_count(c: ComponentLike): number {
  return (c.responsibilities ?? []).filter(r => responsibility_text(r).trim().length > 0).length;
}

// ── Smell A: same-noun sibling cluster with ≤1 responsibility ─────────
// Detection: for each pair of top-tier siblings, intersect their
// significant-token pools (name + id, minus stop tokens like verb/role
// suffixes and prefix words like "comp"). Any token that appears in
// ≥2 siblings whose responsibility counts are all ≤1 is reported as a
// noun collision — these siblings likely share a business capability
// that was split SRP-style at Tier A.
//
// Maps every significant token to the components whose name/id contribute
// it (preserving component and token insertion order).
function build_token_to_comps(comps: ComponentLike[]): Map<string, ComponentLike[]> {
  const tokenToComps = new Map<string, ComponentLike[]>();
  for (const c of comps) {
    const tokens = significant_tokens(c.name, c.id);
    for (const t of tokens) {
      const arr = tokenToComps.get(t) ?? [];
      arr.push(c);
      tokenToComps.set(t, arr);
    }
  }
  return tokenToComps;
}

function noun_collision_smell(token: string, group: ComponentLike[]): string | null {
  if (group.length < 2) return null;
  const allLowResp = group.every(c => responsibility_count(c) <= 1);
  if (!allLowResp) return null;
  const ids = group.map(c => c.id ?? c.name ?? '(unnamed)');
  return `noun_collision: ${group.length} top-tier siblings share '${token}' (${ids.join(', ')}), each with ≤1 responsibility — should be one capability-shaped component (Single-Service Principle violation)`;
}

function detect_noun_collision(comps: ComponentLike[]): string[] {
  const tokenToComps = build_token_to_comps(comps);
  const smells: string[] = [];
  const reportedTokens = new Set<string>();
  for (const [token, group] of tokenToComps.entries()) {
    if (reportedTokens.has(token)) continue;
    const smell = noun_collision_smell(token, group);
    if (smell) {
      reportedTokens.add(token);
      smells.push(smell);
    }
  }
  return smells;
}

// ── Smell B: ID suffix drift ─────────────────────────────────────────
function detect_id_suffix_drift(comps: ComponentLike[]): string[] {
  const byBase = new Map<string, string[]>();
  for (const c of comps) {
    const base = id_base(c.id);
    if (!base || base === c.id) continue; // no suffix found
    const arr = byBase.get(base) ?? [];
    arr.push(c.id ?? '(no id)');
    byBase.set(base, arr);
  }
  const smells: string[] = [];
  for (const [base, ids] of byBase.entries()) {
    if (ids.length >= 2) {
      smells.push(
        `id_suffix_drift: ${ids.length} siblings share base id '${base}' with -A/-B/-N variants (${ids.slice(0, 5).join(', ')}) — capability was fragmented`,
      );
    }
  }
  return smells;
}

// ── Smell C: Tier-A node with exactly one verb-led responsibility ─────
function single_verb_offender(c: ComponentLike): string | null {
  const resps = c.responsibilities ?? [];
  if (resps.length !== 1) return null;
  const text = responsibility_text(resps[0]).trim();
  if (text.length === 0) return null;
  if (!SINGLE_VERB_RESPONSIBILITY_REGEX.test(text)) return null;
  return `${c.id ?? c.name ?? '(unnamed)'}: "${text.slice(0, 60)}"`;
}

function detect_single_verb_responsibility(comps: ComponentLike[]): string[] {
  const offenders: string[] = [];
  for (const c of comps) {
    const offender = single_verb_offender(c);
    if (offender) offenders.push(offender);
  }
  // A single Tier-A component with one verb-led responsibility may be
  // legitimate (atomic service like an audit-log writer). The smell is the
  // PATTERN — multiple Tier-A siblings each with a single verb-led
  // responsibility is sprawl.
  if (offenders.length < 2) return [];
  return [
    `single_verb_responsibility: ${offenders.length} top-tier components have exactly one verb-led responsibility (${offenders.slice(0, 3).join('; ')}${offenders.length > 3 ? '; …' : ''}) — SRP applied at Tier A`,
  ];
}

// ── Smell D: cross-sibling dependency density ─────────────────────────
function count_cross_sibling_deps(comps: ComponentLike[], idSet: Set<string>): number {
  let totalCrossDeps = 0;
  for (const c of comps) {
    const deps = c.dependencies ?? [];
    for (const d of deps) {
      const targetId = d.component_id ?? d.target_component_id;
      if (targetId && idSet.has(targetId)) totalCrossDeps++;
    }
  }
  return totalCrossDeps;
}

function detect_cross_sibling_dependency(comps: ComponentLike[], threshold: number): string[] {
  const idSet = new Set(comps.map(c => c.id).filter((s): s is string => !!s));
  if (idSet.size <= 1) return [];
  const avg = count_cross_sibling_deps(comps, idSet) / comps.length;
  if (avg <= threshold) return [];
  return [
    `cross_sibling_dependency_density: average ${avg.toFixed(2)} dependencies/component pointing at sibling top-tier components (threshold ${threshold}) — siblings are too entangled to be separate components`,
  ];
}

// Resolve the components to inspect, applying an optional tier filter
// (saturation output has children of mixed tiers; skeleton output is
// implicitly all top-tier). Returns `null` when a tier filter is set but
// matches nothing — a distinct "skipped" outcome from an empty path.
function apply_tier_filter(
  items: ComponentLike[],
  tierFilter: string | undefined,
): ComponentLike[] | null {
  if (!tierFilter) return items;
  const filtered = items.filter(c => c.tier === tierFilter);
  if (filtered.length === 0) return null;
  return filtered;
}

// Run each enabled smell detector and concatenate the reported violations
// in detector order (A → B → C → D).
function collect_smells(comps: ComponentLike[], assertion: T4PrincipleAssertion): string[] {
  const smells: string[] = [];
  if (assertion.noun_collision_check !== false) {
    smells.push(...detect_noun_collision(comps));
  }
  if (assertion.id_suffix_check !== false) {
    smells.push(...detect_id_suffix_drift(comps));
  }
  if (assertion.single_verb_responsibility_check !== false) {
    smells.push(...detect_single_verb_responsibility(comps));
  }
  if (assertion.cross_sibling_dependency_check !== false) {
    const threshold = assertion.cross_sibling_dependency_threshold ?? 2;
    smells.push(...detect_cross_sibling_dependency(comps, threshold));
  }
  return smells;
}

function t4_check(
  assertion: T4PrincipleAssertion,
  severity: AssertionCheck['severity'],
  passed: boolean,
  detail: string | undefined,
): AssertionCheck {
  return {
    tier: 'T4',
    name: assertion.name,
    passed,
    severity,
    detail,
  };
}

export function checkT4Principle(
  assertion: T4PrincipleAssertion,
  parsed: unknown,
): AssertionCheck {
  const severity = assertion.severity ?? 'advisory';
  if (parsed === null || parsed === undefined) {
    return t4_check(assertion, severity, false, 'no parsed JSON available');
  }

  // Resolve the list of components to inspect. Default for component_skeleton
  // is `$.components[*]`; for component_saturation it's `$.children[*]`.
  const items = evalJsonPath(parsed, assertion.path) as ComponentLike[];
  if (items.length === 0) {
    return t4_check(assertion, severity, true, 'no components matched path (skipped)');
  }

  const comps = apply_tier_filter(items, assertion.tier_filter);
  if (comps === null) {
    return t4_check(
      assertion,
      severity,
      true,
      `no components match tier_filter=${assertion.tier_filter}`,
    );
  }

  const smells = collect_smells(comps, assertion);
  const passed = smells.length === 0;
  const detail = passed
    ? undefined
    : `${smells.length} principle violation(s):\n    - ${smells.join('\n    - ')}`;
  return t4_check(assertion, severity, passed, detail);
}
