/**
 * Bounded id resolver — resolve a (possibly LLM-drifted) id to a canonical id
 * from a small authoritative ORACLE set.
 *
 * Rationale: the LLM cannot be relied on to reproduce ids with separator /
 * case exactness (`comp-redirect_handling_service` vs the canonical
 * `comp-redirect-handling-service`), and chasing exact compliance via prompts
 * is brittle. Instead we resolve drift against the real id set, robustly but
 * SAFELY: the result is always a member of the oracle or `null` (never an
 * invented id). This is distinct from the prohibited free-form fuzzy matching —
 * it is anchored to a known, bounded oracle and only accepts high-confidence,
 * unambiguous matches.
 *
 * Regex-free (per the no-regex-for-id-resolution principle): normalization uses
 * character filtering / `replaceAll`, similarity uses Levenshtein distance.
 */

/**
 * Comparison key: lowercase, strip a leading namespace prefix (`comp-`,
 * `tech-`, …) and remove ALL separators (`-`, `_`, whitespace). So
 * `comp-redirect_handling_service`, `comp-redirect-handling-service`, and
 * `COMP-Redirect-Handling-Service` all collapse to `redirecthandlingservice`.
 */
export function idComparisonKey(id: string): string {
  let s = id.toLowerCase().trim();
  const dash = s.indexOf('-');
  // Strip a short alpha namespace prefix (e.g. comp-, tech-, us-, ac-) so two
  // ids that differ only by prefix-case still align on their body. Alpha-only
  // check is char-by-char (no regex).
  const prefixIsAlpha = dash > 0 && dash <= 5 && [...s.slice(0, dash)].every((c) => c >= 'a' && c <= 'z');
  if (prefixIsAlpha) s = s.slice(dash + 1);
  return [...s].filter((c) => c !== '-' && c !== '_' && c !== ' ').join('');
}

/** Levenshtein edit distance (iterative, two-row). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Similarity ratio in [0,1]: 1 - editDistance / maxLen. */
export function similarityRatio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

export interface ResolveOptions {
  /** Minimum similarity for the fuzzy fallback. Default 0.90 (conservative). */
  threshold?: number;
  /** Minimum margin the best match must beat the runner-up by. Default 0.05. */
  margin?: number;
}

/**
 * Resolve `candidate` to a canonical id in `oracleIds`:
 *   1. exact membership → candidate;
 *   2. unique normalized-key match (separator/case drift) → that oracle id;
 *   3. similarity fallback: the single best oracle id, only if its ratio ≥
 *      threshold AND it beats the runner-up by ≥ margin;
 *   otherwise `null` (no confident match — caller keeps the original + may flag).
 * Never returns a non-oracle id.
 */
export function resolveAgainstOracle(
  candidate: string,
  oracleIds: Iterable<string>,
  opts: ResolveOptions = {},
): string | null {
  const threshold = opts.threshold ?? 0.90;
  const margin = opts.margin ?? 0.05;
  const oracle = [...oracleIds];
  if (!candidate || oracle.length === 0) return null;
  if (oracle.includes(candidate)) return candidate;

  const candKey = idComparisonKey(candidate);
  const keyMatches = oracle.filter((o) => idComparisonKey(o) === candKey);
  if (keyMatches.length === 1) return keyMatches[0];
  if (keyMatches.length > 1) return null; // ambiguous after normalization — don't guess

  const scored = oracle
    .map((o) => ({ id: o, score: similarityRatio(candKey, idComparisonKey(o)) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (best && best.score >= threshold && (scored.length < 2 || best.score - scored[1].score >= margin)) {
    return best.id;
  }
  return null;
}

/**
 * TECH-* comparison key for constraint-id drift resolution.
 *
 * The canonical technical-constraint registry ids carry an enumeration suffix
 * (`TECH-CERBOS-1`, `TECH-NODEJS-BUN-1`, `TECH-POSTGRESQL-RLS-1`). The planner
 * routinely re-cites them WITHOUT the suffix (`TECH-CERBOS`), with a drifted
 * separator (`TECH-BETTER-AUTH` for `TECH-BETTERAUTH-1`, `TECH-WORKFLOWDBOS-1`
 * for `TECH-WORKFLOW-DBOS-1`), or with a small typo (`TECH-OPI-ZOD-1` for
 * `TECH-OAPI-ZOD-1`). This key collapses the suffix/separator/case so a drifted
 * emit aligns with its registry entry.
 *
 * Key = lowercase, strip a short alpha namespace prefix (`tech-`), strip ONE
 * trailing `-<digits>` enumeration segment, then remove all separators. Two ids
 * that collapse to the same key are the same constraint. Regex-free (char
 * scans), per the no-regex-for-id-resolution principle. NOTE: this deliberately
 * strips a trailing numeric segment, so it is TECH-specific and must NOT be used
 * for id classes where a trailing number is significant (`US-001`, `AC-…-002`).
 */
export function techIdBodyKey(id: string): string {
  let s = id.toLowerCase().trim();
  const dash = s.indexOf('-');
  const prefixIsAlpha = dash > 0 && dash <= 5 && [...s.slice(0, dash)].every((c) => c >= 'a' && c <= 'z');
  if (prefixIsAlpha) s = s.slice(dash + 1);
  // Strip ONE trailing "-<digits>" enumeration segment (e.g. the "-1" the schema
  // example carries) so `TECH-CERBOS` and `TECH-CERBOS-1` collapse to `cerbos`.
  const lastDash = s.lastIndexOf('-');
  if (lastDash > 0 && lastDash < s.length - 1) {
    const tail = s.slice(lastDash + 1);
    if ([...tail].every((c) => c >= '0' && c <= '9')) s = s.slice(0, lastDash);
  }
  return [...s].filter((c) => c !== '-' && c !== '_' && c !== ' ').join('');
}

/**
 * Resolve a possibly-drifted `TECH-*` id to its canonical form in `oracleIds`:
 *   1. exact membership → candidate;
 *   2. unique body-key match (suffix/separator/case drift — the dominant class);
 *   3. similarity fallback on body keys (close typos), threshold + margin
 *      guarded so only a single confident, unambiguous match wins;
 *   otherwise `null`. Semantic aliases (`TECH-BUN`→`TECH-NODEJS-BUN-1`,
 *   `TECH-DBOS`→`TECH-WORKFLOW-DBOS-1`, `TECH-POSTGRES`→`TECH-POSTGRESQL-RLS-1`)
 *   are NOT string-resolvable — the caller keeps the original + logs residual
 *   drift rather than guess. Never returns a non-oracle id; ambiguous → null.
 * Thresholds validated against the real cal-38 constraint registry: all 12
 * suffix/separator/typo drifts resolved, 0 canonical ids mis-resolved.
 */
export function resolveTechId(
  candidate: string,
  oracleIds: Iterable<string>,
  opts: ResolveOptions = {},
): string | null {
  const threshold = opts.threshold ?? 0.84;
  const margin = opts.margin ?? 0.08;
  const oracle = [...oracleIds];
  if (!candidate || oracle.length === 0) return null;
  if (oracle.includes(candidate)) return candidate;
  const candKey = techIdBodyKey(candidate);
  if (candKey.length === 0) return null;
  const keyMatches = oracle.filter((o) => techIdBodyKey(o) === candKey);
  if (keyMatches.length === 1) return keyMatches[0];
  if (keyMatches.length > 1) return null; // ambiguous after normalization — don't guess
  const scored = oracle
    .map((o) => ({ id: o, score: similarityRatio(candKey, techIdBodyKey(o)) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (best && best.score >= threshold && (scored.length < 2 || best.score - scored[1].score >= margin)) {
    return best.id;
  }
  return null;
}

/** Minimal constraint shape for semantic (name-token) TECH-id resolution. */
export interface TechConstraintRef {
  id: string;
  text?: string;
  technology?: string;
}

/**
 * Resolve a TECH id that STRING resolution can't — a semantic ALIAS: the planner
 * cites a shorthand NAME (`TECH-BUN`, `TECH-DBOS`, `TECH-POSTGRES`) for a
 * canonical id whose body is unrelated (`TECH-NODEJS-BUN-1`,
 * `TECH-WORKFLOW-DBOS-1`, `TECH-POSTGRESQL-RLS-1`). The alias is NOT string drift
 * so `resolveTechId` returns null — but the shorthand IS the vendor the
 * constraint names, so match a distinctive body token against the constraint's
 * own `technology` / `text` (an oracle anchored in the source-stated vendor).
 *
 * SAFE by construction: only a UNIQUE token match wins (a token in ≥2
 * constraints, or a generic word like `api`/`data`, is ambiguous → null); tokens
 * shorter than 3 chars are ignored; the `technology` field (the vendor name) is
 * tried before the fuller `text` (which carries generic category words). Meant
 * to fire ONLY after `resolveTechId` fails. Validated on cal-38: bun/dbos/
 * postgres(ql) resolved, 0 canonical mis-resolutions.
 */
export function resolveTechIdBySemantics(
  candidate: string,
  constraints: readonly TechConstraintRef[],
): string | null {
  if (!candidate.startsWith('TECH-') || constraints.length === 0) return null;
  let body = candidate.toLowerCase().slice('tech-'.length);
  const lastDash = body.lastIndexOf('-');
  if (lastDash > 0 && lastDash < body.length - 1 && [...body.slice(lastDash + 1)].every((c) => c >= '0' && c <= '9')) {
    body = body.slice(0, lastDash);
  }
  // Candidate tokens, most-distinctive (longest) first: the whole collapsed body
  // plus each hyphen segment, ≥3 chars.
  const tokens = [...new Set([body.replaceAll('-', ''), ...body.split('-')])]
    .filter((t) => t.length >= 3)
    .sort((a, b) => b.length - a.length);
  if (tokens.length === 0) return null;
  const rows = constraints.map((c) => ({
    id: c.id,
    tech: (c.technology ?? '').toLowerCase(),
    full: `${c.technology ?? ''} ${c.text ?? ''}`.toLowerCase(),
  }));
  for (const field of ['tech', 'full'] as const) {
    for (const tok of tokens) {
      const hits = rows.filter((r) => r[field].includes(tok));
      if (hits.length === 1) return hits[0].id;
    }
  }
  return null;
}

/**
 * Batch-resolve the `TECH-*` ids in a mixed id list against the canonical
 * constraint registry (the downstream `active_constraints` remapper — PA-9).
 * String drift is resolved by `resolveTechId`; when `constraints` (with their
 * `text`/`technology`) is supplied, a semantic ALIAS that string resolution
 * can't reach falls through to `resolveTechIdBySemantics`. Non-TECH ids and
 * still-unresolvable TECH ids pass through unchanged; returns the rewritten list
 * plus the applied `from→to` rewrites for drift logging (fail-safe: an
 * unresolvable residual is surfaced, not silently dropped).
 */
export function resolveTechConstraintIds(
  ids: readonly string[],
  techOracle: Iterable<string>,
  constraints?: readonly TechConstraintRef[],
): { ids: string[]; rewrites: string[] } {
  const oracle = [...techOracle];
  if (oracle.length === 0) return { ids: [...ids], rewrites: [] };
  const rewrites: string[] = [];
  const out = ids.map((id) => {
    if (!id.startsWith('TECH-')) return id;
    const hit = resolveTechId(id, oracle)
      ?? (constraints && constraints.length > 0 ? resolveTechIdBySemantics(id, constraints) : null);
    if (hit && hit !== id) {
      rewrites.push(`${id}→${hit}`);
      return hit;
    }
    return id;
  });
  return { ids: out, rewrites };
}

/**
 * Resolve a component id the LLM may have (a) drifted by separator/case, or
 * (b) FABRICATED as a composite `comp-<realComponent>-<entity>` — observed in
 * data-model saturation (`comp-appointment-core-auditlogentry` for the entity
 * AuditLogEntry under component `comp-appointment-core`; PA-4). Resolution:
 *   1. exact membership → candidate;
 *   2. `resolveAgainstOracle` — whole-id separator/case/typo drift;
 *   3. longest segment-aligned prefix that is an oracle member — the composite
 *      class; walking longest→shortest picks the MOST specific real component,
 *      so a genuine sub-component id still wins over its parent; the `>= 2`
 *      floor never collapses to a bare `comp` prefix;
 *   otherwise `null` (caller keeps the original + fails SAFE with a log, rather
 *   than silently injecting the whole component catalog). Never returns a
 *   non-oracle id. Regex-free (segment split + membership).
 */
export function resolveComponentId(
  candidate: string,
  oracleIds: Iterable<string>,
  opts: ResolveOptions = {},
): string | null {
  const oracle = [...oracleIds];
  if (!candidate || oracle.length === 0) return null;
  if (oracle.includes(candidate)) return candidate;
  const whole = resolveAgainstOracle(candidate, oracle, opts);
  if (whole) return whole;
  const oracleSet = new Set(oracle);
  const segs = candidate.split('-');
  for (let n = segs.length - 1; n >= 2; n--) {
    const prefix = segs.slice(0, n).join('-');
    if (oracleSet.has(prefix)) return prefix;
  }
  return null;
}

/**
 * Segment tokens of an id: lowercased, namespace prefix stripped, split on
 * `-` / `_` / space. Regex-free (string `split`), per the no-regex principle.
 */
function idSegmentTokens(id: string): Set<string> {
  let s = id.toLowerCase().trim();
  const dash = s.indexOf('-');
  const prefixIsAlpha = dash > 0 && dash <= 5 && [...s.slice(0, dash)].every((c) => c >= 'a' && c <= 'z');
  if (prefixIsAlpha) s = s.slice(dash + 1);
  return new Set(s.replaceAll('_', '-').replaceAll(' ', '-').split('-').filter((t) => t.length > 0));
}

/**
 * Resolve a TRUNCATED id — the LLM dropped a token from a canonical id
 * (`DOM-COMMUNICATION` for the accepted `DOM-COMMUNITY-COMMUNICATION`; gpt-oss
 * journey→domain drift, cal-39). String similarity can't reach this: the bodies
 * differ by a whole token (~0.6 ratio, below any safe threshold). Token-subset
 * can, SAFELY: the candidate's segment tokens must be a STRICT subset of exactly
 * ONE oracle member's tokens (a subset of ≥2 members → ambiguous → null), and
 * the candidate must carry at least one substantial (≥4-char) token so a trivial
 * fragment (`DOM-AI`) never resolves. Namespace-prefix aware, regex-free, never
 * returns a non-oracle id. Meant to fire AFTER `resolveAgainstOracle` fails.
 */
export function resolveByTokenSubset(
  candidate: string,
  oracleIds: Iterable<string>,
): string | null {
  const oracle = [...oracleIds];
  if (!candidate || oracle.length === 0) return null;
  if (oracle.includes(candidate)) return candidate;
  const candToks = idSegmentTokens(candidate);
  if (candToks.size === 0 || ![...candToks].some((t) => t.length >= 4)) return null;
  const hits = oracle.filter((o) => {
    const ot = idSegmentTokens(o);
    return ot.size > candToks.size && [...candToks].every((t) => ot.has(t));
  });
  return hits.length === 1 ? hits[0] : null;
}
