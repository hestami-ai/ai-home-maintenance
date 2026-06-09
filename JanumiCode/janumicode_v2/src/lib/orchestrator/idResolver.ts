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
