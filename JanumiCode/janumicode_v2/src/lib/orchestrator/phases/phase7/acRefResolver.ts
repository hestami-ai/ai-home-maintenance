/**
 * Phase 7 deterministic bridge for `acceptance_criterion_ids[]` drift.
 *
 * The LLM is asked to reference canonical AC ids (e.g. `AC-001`,
 * `AC-007`) listed in the FR summary. Probabilistic models reliably
 * drift in this kind of high-fidelity copy task — observed modes
 * from real runs:
 *
 *   AC-URL-001       (component-flavoured: `AC-<component-token>-NNN`)
 *   AC-US-002-atomic (story-prefixed with tier suffix)
 *   ac-001           (case drift)
 *   AC-1             (zero-padding drift)
 *   AC-LOGIN-FAILURE (description-derived; no trailing number)
 *
 * Per the project-wide rule that each phase exits with corrections
 * applied (see `feedback_phase_exit_corrections.md`), this resolver
 * runs inside Phase 7's producer — both the 7.1 skeleton emit and
 * every 7.1a saturation child — before the test plan / decomposition
 * node is persisted. Downstream consumers (packet synthesis, coverage
 * analysis) get canonical ids and never need to bridge drift
 * themselves.
 *
 * Resolution order per ref (first hit wins):
 *   1. Exact id match.
 *   2. Normalized id match (lowercase, non-alphanumerics stripped).
 *   3. Trailing-number reconciliation: extract the last numeric run
 *      from the ref; if exactly one canonical AC ends in that number
 *      (with leading zeros allowed), resolve to it.
 *   4. Text similarity: if the LLM provided a `expected_outcome` or
 *      `description` alongside the ref, match it against AC text
 *      (description / measurable_condition) using normalized token
 *      Jaccard. Threshold 0.5.
 *
 * If no rule fires, the original ref is returned unchanged — coverage
 * analysis will flag it, which is the right operator signal that the
 * prompt drifted further than the resolver can reach.
 */

export interface CanonicalAcEntry {
  id: string;
  story_id?: string;
  description?: string;
  measurable_condition?: string;
}

export interface CanonicalAcIndex {
  /** All canonical AC ids in insertion order, for stable diagnostics. */
  ids: string[];
  /** Exact id → canonical id (identity map, used for membership). */
  byId: Map<string, string>;
  /** Normalized id → canonical id. Multiple inputs may normalize to the same canonical id. */
  byNormalizedId: Map<string, string>;
  /**
   * Composite key (`us{N}_ac{M}`) → canonical id. Built from canonical
   * AC ids in composite form (`AC-US{nnn}-{mmm}`). Catches the common
   * drift modes when the LLM emits the right pair of numbers but with
   * minor format mistakes: `AC-US001-1` (lost zero-padding),
   * `AC-US-001-001` (extra hyphen), `US001-AC001` (reordered).
   */
  byCompositeKey: Map<string, string>;
  /** Trailing-number key (e.g. "1", "47") → set of canonical ids ending in that number. */
  byTrailingNumber: Map<string, string[]>;
  /** Lookup of canonical id → AC entry (for text-match fallback). */
  byCanonicalId: Map<string, CanonicalAcEntry>;
}

export type ResolutionVia =
  | 'exact'
  | 'normalized_id'
  | 'composite_key'
  | 'trailing_number'
  | 'text_match'
  | 'unresolved';

export interface ResolutionLogEntry {
  originalRef: string;
  resolvedTo: string | null;
  via: ResolutionVia;
}

export interface ResolveOptions {
  /**
   * Optional text payload (test case's `expected_outcome`, child name,
   * step descriptions joined, etc.) used by the text-similarity
   * fallback when id-based resolution misses.
   */
  contextText?: string;
}

export interface ResolutionResult {
  resolvedIds: string[];
  log: ResolutionLogEntry[];
  /** Distinct count of refs that the resolver had to bridge (non-`exact`, non-`unresolved`). */
  bridgedCount: number;
  /** Distinct count of refs that could not be resolved at all. */
  unresolvedCount: number;
}

/* ── Index construction ───────────────────────────────────────────── */

export function buildCanonicalAcIndex(
  stories: ReadonlyArray<Record<string, unknown>>,
): CanonicalAcIndex {
  const index: CanonicalAcIndex = {
    ids: [],
    byId: new Map(),
    byNormalizedId: new Map(),
    byCompositeKey: new Map(),
    byTrailingNumber: new Map(),
    byCanonicalId: new Map(),
  };
  for (const story of stories) {
    const storyId = typeof story.id === 'string' ? story.id : undefined;
    const acs = (story.acceptance_criteria as Array<Record<string, unknown>> | undefined) ?? [];
    for (const ac of acs) addAcToIndex(ac, storyId, index);
  }
  return index;
}

function addAcToIndex(
  ac: Record<string, unknown>,
  storyId: string | undefined,
  index: CanonicalAcIndex,
): void {
  const id = typeof ac.id === 'string' ? ac.id.trim() : '';
  if (!id || index.byId.has(id)) return;
  index.ids.push(id);
  index.byId.set(id, id);

  const normalized = normalizeId(id);
  if (normalized && !index.byNormalizedId.has(normalized)) {
    index.byNormalizedId.set(normalized, id);
  }

  const trailing = extractTrailingNumber(id);
  if (trailing != null) {
    const key = String(trailing);
    const bucket = index.byTrailingNumber.get(key) ?? [];
    bucket.push(id);
    index.byTrailingNumber.set(key, bucket);
  }

  const composite = extractCompositeKey(id);
  if (composite && !index.byCompositeKey.has(composite)) {
    index.byCompositeKey.set(composite, id);
  }

  index.byCanonicalId.set(id, {
    id,
    story_id: storyId,
    description: typeof ac.description === 'string' ? ac.description : undefined,
    measurable_condition: typeof ac.measurable_condition === 'string' ? ac.measurable_condition : undefined,
  });
}

/* ── Per-ref resolution ───────────────────────────────────────────── */

export function resolveAcReferences(
  refs: ReadonlyArray<string>,
  index: CanonicalAcIndex,
  opts: ResolveOptions = {},
): ResolutionResult {
  const log: ResolutionLogEntry[] = [];
  const seen = new Set<string>();
  const resolvedIds: string[] = [];
  let bridgedCount = 0;
  let unresolvedCount = 0;

  for (const rawRef of refs) {
    const ref = typeof rawRef === 'string' ? rawRef.trim() : '';
    if (!ref) continue;

    const resolution = resolveOne(ref, index, opts);
    log.push(resolution);

    if (resolution.resolvedTo == null) {
      unresolvedCount++;
      // Preserve original so consumers / coverage can report the drift.
      if (!seen.has(ref)) {
        seen.add(ref);
        resolvedIds.push(ref);
      }
      continue;
    }
    if (resolution.via !== 'exact') bridgedCount++;
    if (!seen.has(resolution.resolvedTo)) {
      seen.add(resolution.resolvedTo);
      resolvedIds.push(resolution.resolvedTo);
    }
  }

  return { resolvedIds, log, bridgedCount, unresolvedCount };
}

function resolveOne(
  ref: string,
  index: CanonicalAcIndex,
  opts: ResolveOptions,
): ResolutionLogEntry {
  // 1 — exact
  if (index.byId.has(ref)) {
    return { originalRef: ref, resolvedTo: ref, via: 'exact' };
  }

  // 2 — normalized id
  const normalized = normalizeId(ref);
  const normalizedHit = normalized ? index.byNormalizedId.get(normalized) : undefined;
  if (normalizedHit) {
    return { originalRef: ref, resolvedTo: normalizedHit, via: 'normalized_id' };
  }

  // 3 — composite-key extraction: when the ref encodes both a story
  //    number and an AC ordinal (in any order), match against the
  //    canonical `us{N}_ac{M}` key. Handles drift like `AC-US-001-001`
  //    (extra hyphen), `AC-US001-1` (lost zero-padding), `US001-AC001`
  //    (reordered), even when normalized_id doesn't catch them.
  const compositeKey = extractCompositeKey(ref);
  if (compositeKey) {
    const compositeHit = index.byCompositeKey.get(compositeKey);
    if (compositeHit) {
      return { originalRef: ref, resolvedTo: compositeHit, via: 'composite_key' };
    }
  }

  // 4 — trailing-number reconciliation (only fires when the canonical
  //    set has a single AC ending in that number — otherwise ambiguous).
  const trailing = extractTrailingNumber(ref);
  if (trailing != null) {
    const bucket = index.byTrailingNumber.get(String(trailing));
    if (bucket?.length === 1) {
      return { originalRef: ref, resolvedTo: bucket[0], via: 'trailing_number' };
    }
  }

  // 4 — text match
  if (opts.contextText) {
    const match = bestTextMatch(opts.contextText, index);
    if (match) {
      return { originalRef: ref, resolvedTo: match, via: 'text_match' };
    }
  }

  return { originalRef: ref, resolvedTo: null, via: 'unresolved' };
}

/* ── Normalizers ──────────────────────────────────────────────────── */

function normalizeId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractTrailingNumber(s: string): number | null {
  // Linear equivalent of /(\d+)(?!.*\d)/ (no `s` flag, so `.` stops at
  // newlines): capture the last contiguous digit run on the first line
  // that contains any digit. Byte-identical output, no backtracking.
  const isDigit = (c: number | undefined): boolean => c !== undefined && c >= 48 && c <= 57;

  // First digit anywhere in the string selects the matching line.
  let firstDigit = -1;
  for (let i = 0; i < s.length; i++) {
    if (isDigit(s.codePointAt(i))) {
      firstDigit = i;
      break;
    }
  }
  if (firstDigit === -1) return null;

  // The regex match lives on that line only; bound the scan at its newline.
  let lineEnd = s.indexOf('\n', firstDigit);
  if (lineEnd === -1) lineEnd = s.length;

  // Last digit run within [firstDigit, lineEnd).
  let end = lineEnd;
  while (end > firstDigit && !isDigit(s.codePointAt(end - 1))) end--;
  let start = end;
  while (start > firstDigit && isDigit(s.codePointAt(start - 1))) start--;

  const n = Number.parseInt(s.slice(start, end), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extract the composite `(US number, AC ordinal)` from a ref of any
 * plausible shape and return a canonical key `us{N}_ac{M}` (no
 * zero-padding) suitable for index lookup. Returns null when the ref
 * doesn't carry both numbers.
 *
 * Patterns recognized:
 *   AC-US001-001     →  us1_ac1     (canonical form)
 *   AC-US-001-001    →  us1_ac1     (extra hyphen)
 *   AC-US001-1       →  us1_ac1     (lost zero-padding)
 *   US001-AC001      →  us1_ac1     (reordered)
 *   AC-US-7-2        →  us7_ac2
 */
const COMPOSITE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bus[-_]?(\d+)\b\D*\bac[-_]?(\d+)\b/i,  // US-first: US001-AC001, US001 AC001
  /\bac[-_]?(?:us[-_]?)?(\d+)[-_]+(\d+)\b/i,    // AC-first: AC-US001-001, AC-US-001-001, AC-001-001
];

function extractCompositeKey(s: string): string | null {
  for (const re of COMPOSITE_PATTERNS) {
    const m = re.exec(s);
    if (!m) continue;
    // For US-first the order is (us, ac). For AC-first the same.
    const a = Number.parseInt(m[1], 10);
    const b = Number.parseInt(m[2], 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    return `us${a}_ac${b}`;
  }
  return null;
}

const TOKEN_SPLIT = /[^a-z0-9]+/;
const STOP_WORDS = new Set([
  'a','an','and','are','as','at','be','by','for','from','has','have','in','is',
  'it','its','of','on','or','that','the','this','to','was','were','will','with',
  'when','then','if','should','must','shall','can','may','given',
]);

function tokenize(s: string): Set<string> {
  const out = new Set<string>();
  for (const t of s.toLowerCase().split(TOKEN_SPLIT)) {
    if (t.length < 3) continue;
    if (STOP_WORDS.has(t)) continue;
    out.add(t);
  }
  return out;
}

/**
 * Asymmetric coverage — fraction of the smaller side's tokens that
 * appear in the larger side. Catches the common case where a test
 * case's expected_outcome is terse compared to the AC's full text
 * (or vice versa). Symmetric Jaccard under-scores asymmetric overlap.
 */
function coverage(a: Set<string>, b: Set<string>): { score: number; overlap: number } {
  if (a.size === 0 || b.size === 0) return { score: 0, overlap: 0 };
  let overlap = 0;
  for (const x of a) if (b.has(x)) overlap++;
  const score = Math.max(overlap / a.size, overlap / b.size);
  return { score, overlap };
}

function bestTextMatch(contextText: string, index: CanonicalAcIndex): string | null {
  const ctx = tokenize(contextText);
  if (ctx.size === 0) return null;
  let best: { id: string; score: number } | null = null;
  for (const id of index.ids) {
    const entry = index.byCanonicalId.get(id);
    if (!entry) continue;
    const acText = `${entry.measurable_condition ?? ''} ${entry.description ?? ''}`.trim();
    if (!acText) continue;
    const { score, overlap } = coverage(ctx, tokenize(acText));
    // Require both a coverage threshold and a minimum absolute overlap
    // — guards against matching on a single shared common word.
    if (score >= 0.5 && overlap >= 3 && (!best || score > best.score)) {
      best = { id, score };
    }
  }
  return best?.id ?? null;
}
