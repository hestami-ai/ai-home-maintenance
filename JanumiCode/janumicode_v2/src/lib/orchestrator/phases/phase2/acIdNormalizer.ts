/**
 * Phase 2 exit normalizer for Acceptance Criterion ids.
 *
 * Background — Acceptance Criteria nest inside `user_stories[]`, so the
 * LLM-emitted ids restart at `AC-001` per story. That makes the AC
 * namespace non-unique at workflow scope: `AC-001` exists under every
 * story, and a downstream reference like `acceptance_criterion_ids:
 * ["AC-001"]` is ambiguous about *which* story's AC-001 is meant.
 *
 * Drift modes seen in real runs (ts-108) — `AC-URL-001`, `AC-US-002-atomic`
 * — were the LLM's own attempts to invent a story-scoped namespace because
 * the prompt didn't give it one.
 *
 * Per the project-wide rule that each phase exits with corrections
 * applied (`feedback_phase_exit_corrections.md`), this normalizer runs
 * inside Phase 2 fr_bloom_skeleton's producer (and any sub-phase that
 * mints new ACs) — rewriting `user_stories[].acceptance_criteria[].id`
 * to a workflow-globally-unique composite that encodes the parent story:
 *
 *   `AC-US{nnn}-{mmm}` where {nnn} = story's numeric suffix, {mmm} =
 *   per-story 1-based counter. Examples: AC-US001-001, AC-US001-002,
 *   AC-US002-001.
 *
 * Why this shape:
 *   - Single token (no slashes / spaces); survives copy-paste through
 *     LLM prompts, JSON, and DB joins.
 *   - Keeps the `AC-` prefix so existing greps and pattern-matchers
 *     still locate ACs.
 *   - Self-describing — `AC-US007-002` reads as "second AC of US-007".
 *   - Cleanly parses back to (story_id, ordinal) via `/^AC-US(\d+)-(\d+)$/`.
 *
 * Idempotent — re-running the normalizer over already-minted stories
 * preserves existing composite ids and continues the per-story counter
 * for newly-added ACs (used by fr_bloom_enrichment which may extend the
 * AC array on a second LLM call). Stories whose `id` doesn't match the
 * `US-{nnn}` pattern are skipped (no anchor to namespace against); the
 * caller should validate story-id shape upstream.
 */

export interface AcStoryLike {
  id?: unknown;
  acceptance_criteria?: unknown;
}

export interface AcLike {
  id?: unknown;
}

export interface MintResult {
  /** Stories whose `id` didn't match the `US-{nnn}` shape — ACs left alone. */
  skippedStoryIds: string[];
  /** Count of AC ids that were freshly minted (excluding already-composite ids). */
  minted: number;
  /** Count of AC ids that were already in composite form and left unchanged. */
  preserved: number;
}

const STORY_ID_RE = /^US-(\d+)$/;
const COMPOSITE_AC_TAIL_RE = /-(\d+)$/;
/**
 * Safe-id chars for the anchor: alphanumerics, hyphens, dots, underscores.
 * Excludes whitespace and JSON-breaking punctuation. Anchor passes through
 * verbatim into the AC id, so anything we accept here becomes part of
 * downstream join keys.
 */
const SAFE_ANCHOR_RE = /^[A-Za-z0-9_.-]+$/;

/**
 * Compute the AC-id prefix for a story. Canonical `US-{nnn}` stories
 * get the compact `AC-US{nnn}-` prefix (matches Phase 2.1 bloom skeleton
 * output). Other story-id shapes (saturation leaves like `FR-URL-CREATION-1`,
 * `US-002-atomic`, `FR-DELETE-URL-1.1`) get a verbatim-anchor prefix
 * `AC-{story.id}-` — each leaf carries its own AC namespace so ACs
 * across different leaves never collide globally.
 *
 * Returns null when the story id is empty or contains unsafe characters.
 */
function acPrefixForStory(storyId: string): string | null {
  if (!storyId) return null;
  const m = STORY_ID_RE.exec(storyId);
  if (m) return `AC-US${m[1]}-`;
  if (!SAFE_ANCHOR_RE.test(storyId)) return null;
  return `AC-${storyId}-`;
}

/**
 * Rewrites `user_stories[].acceptance_criteria[].id` in place to
 * composite form. Mutates the input. Returns aggregate counters for
 * audit logging.
 */
export function mintCompositeAcIds(stories: ReadonlyArray<AcStoryLike>): MintResult {
  const result: MintResult = { skippedStoryIds: [], minted: 0, preserved: 0 };
  for (const story of stories) mintStory(story, result);
  return result;
}

function mintStory(story: AcStoryLike, result: MintResult): void {
  const storyId = typeof story.id === 'string' ? story.id : '';
  const expectedPrefix = acPrefixForStory(storyId);
  if (!expectedPrefix) {
    if (storyId) result.skippedStoryIds.push(storyId);
    return;
  }
  const acs = Array.isArray(story.acceptance_criteria)
    ? (story.acceptance_criteria as AcLike[])
    : [];
  let counter = 1;
  for (const ac of acs) counter = mintAc(ac, expectedPrefix, counter, result);
}

function mintAc(
  ac: AcLike,
  expectedPrefix: string,
  counter: number,
  result: MintResult,
): number {
  if (!ac || typeof ac !== 'object') return counter;
  const existing = typeof ac.id === 'string' ? ac.id : '';
  if (existing.startsWith(expectedPrefix)) {
    // Already composite — preserve and advance counter past it.
    const tail = COMPOSITE_AC_TAIL_RE.exec(existing);
    if (tail) {
      const n = Number.parseInt(tail[1], 10);
      if (Number.isFinite(n)) counter = Math.max(counter, n + 1);
    }
    result.preserved++;
    return counter;
  }
  (ac as { id: string }).id = `${expectedPrefix}${pad3(counter)}`;
  result.minted++;
  return counter + 1;
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

/**
 * Inverse helper — extracts `(storyId, ordinal)` from a composite AC id
 * in compact canonical form (`AC-US{nnn}-{mmm}`).
 * Returns null if the ref isn't in that form.
 */
export function parseCompositeAcId(ref: string): { storyId: string; ordinal: number } | null {
  const m = /^AC-US(\d+)-(\d+)$/.exec(ref);
  if (!m) return null;
  return { storyId: `US-${m[1]}`, ordinal: Number.parseInt(m[2], 10) };
}

/**
 * Recover the parent story id from any composite AC id shape — both the
 * compact canonical (`AC-US{nnn}-{mmm}` for US-{nnn} roots) and the
 * verbatim-anchor form (`AC-{leaf-id}-{mmm}` for saturation leaves like
 * `FR-CAM-1.1` or `US-004-AUTH-D1`). Lets downstream consumers
 * (packet_synthesis) recover the originating story/leaf identity from a
 * test case's `acceptance_criterion_ids[]` — closing the
 * task→component→story join gap that pre-dated the composite-namespace
 * design.
 *
 * Returns null for anything that doesn't look like a composite AC id.
 */
export function parentRefFromCompositeAc(ref: string): string | null {
  if (typeof ref !== 'string') return null;
  // 1) Compact canonical: AC-US{nnn}-{mmm} → US-{nnn}
  const compact = /^AC-US(\d+)-\d+$/.exec(ref);
  if (compact) return `US-${compact[1]}`;
  // 2) Verbatim anchor: AC-{parent}-{mmm} → parent (parent may contain
  //    hyphens). The trailing `-\d+$` is anchored, so the greedy `(.+)`
  //    safely captures the parent even when it embeds digits.
  const verbatim = /^AC-(.+)-\d+$/.exec(ref);
  if (verbatim) return verbatim[1];
  return null;
}
