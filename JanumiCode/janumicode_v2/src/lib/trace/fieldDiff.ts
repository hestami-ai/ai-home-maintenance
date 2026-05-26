/**
 * Field-diff computation for the transformation trace layer.
 *
 * Pure: no I/O, no globals, deterministic. Operates on plain objects
 * (the inputs and outputs of a transformation). The output is a
 * TransformationFieldDiff that the trace layer attaches to the step
 * record so the walk-back CLI can highlight where a field appeared,
 * disappeared, was renamed, or changed shape.
 *
 * Scope of the diff:
 *  - Top-level keys (added / removed / type_changed).
 *  - Array-typed top-level fields where the length changed (size_changed).
 *    Specifically called out because "user_stories: [16 items] -> []" is
 *    the signature of a silent drop.
 *  - Heuristic rename detection: a top-level key disappears and another
 *    top-level key appears in the same step with the same JSON shape
 *    (same type + same array length for arrays). Flagged as a candidate
 *    rename — caller decides whether it's a real rename or a coincidence.
 *
 * Deliberately *not* recursive into nested objects. Two reasons:
 *  1. Most silent drops happen at the top level (LLM emits userStories
 *     vs user_stories, normalizer reads only one). Deep recursion adds
 *     noise without finding more bugs.
 *  2. The walk-back CLI can resort to dumping the payload files when
 *     deeper inspection is warranted. The diff is a signal, not a full
 *     comparison.
 */

import type { TransformationFieldDiff } from '../types/records';

type Json = unknown;

/**
 * Compute a field-diff between an input value and an output value.
 * Both should be objects (records). Non-object inputs yield an empty
 * diff (no signal to emit).
 */
export function computeFieldDiff(input: Json, output: Json): TransformationFieldDiff {
  const diff: TransformationFieldDiff = {};

  if (!isPlainObject(input) || !isPlainObject(output)) {
    return diff;
  }

  const inKeys = new Set(Object.keys(input));
  const outKeys = new Set(Object.keys(output));

  const added: string[] = [];
  const removed: string[] = [];
  const type_changed: string[] = [];
  const size_changed: Array<{ field: string; from: number; to: number }> = [];

  for (const k of outKeys) {
    if (!inKeys.has(k)) added.push(k);
  }
  for (const k of inKeys) {
    if (!outKeys.has(k)) removed.push(k);
  }

  // Per-key shape comparison for keys present on both sides.
  for (const k of inKeys) {
    if (!outKeys.has(k)) continue;
    const a = (input as Record<string, unknown>)[k];
    const b = (output as Record<string, unknown>)[k];
    const ta = jsonShape(a);
    const tb = jsonShape(b);
    if (ta !== tb) {
      type_changed.push(k);
      continue;
    }
    if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) {
      size_changed.push({ field: k, from: a.length, to: b.length });
    }
  }

  // Heuristic rename: pair `removed` keys to `added` keys when shapes match.
  // O(n*m) over typically tiny key sets — fine.
  const renamed: Array<{ from: string; to: string }> = [];
  const usedAdded = new Set<string>();
  for (const r of removed) {
    const removedVal = (input as Record<string, unknown>)[r];
    const removedShape = jsonShape(removedVal);
    for (const a of added) {
      if (usedAdded.has(a)) continue;
      const addedVal = (output as Record<string, unknown>)[a];
      if (jsonShape(addedVal) !== removedShape) continue;
      // For arrays, also require length match to reduce false positives.
      if (
        Array.isArray(removedVal) &&
        Array.isArray(addedVal) &&
        removedVal.length !== addedVal.length
      ) continue;
      // Bonus: case-insensitive match boosts confidence. Don't filter on
      // it, but it's the common case (snake_case ↔ camelCase) we expect.
      renamed.push({ from: r, to: a });
      usedAdded.add(a);
      break;
    }
  }

  // Subtract rename pairs from added/removed to avoid double-counting.
  if (renamed.length) {
    const renamedFrom = new Set(renamed.map((p) => p.from));
    const renamedTo = new Set(renamed.map((p) => p.to));
    if (added.length) {
      const filtered = added.filter((k) => !renamedTo.has(k));
      if (filtered.length) diff.added = filtered;
    }
    if (removed.length) {
      const filtered = removed.filter((k) => !renamedFrom.has(k));
      if (filtered.length) diff.removed = filtered;
    }
    diff.renamed = renamed;
  } else {
    if (added.length) diff.added = added;
    if (removed.length) diff.removed = removed;
  }

  if (type_changed.length) diff.type_changed = type_changed;
  if (size_changed.length) diff.size_changed = size_changed;

  return diff;
}

/**
 * Returns true when the diff carries any signal. Useful to skip
 * emitting field_diff on the step record when nothing changed.
 */
export function fieldDiffIsEmpty(diff: TransformationFieldDiff): boolean {
  return (
    (!diff.added || diff.added.length === 0) &&
    (!diff.removed || diff.removed.length === 0) &&
    (!diff.renamed || diff.renamed.length === 0) &&
    (!diff.type_changed || diff.type_changed.length === 0) &&
    (!diff.size_changed || diff.size_changed.length === 0)
  );
}

// ── internals ──────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Coarse JSON-shape token. Two values share a "shape" when they have
 * the same token. Used by the rename heuristic and the type_changed
 * detector. Intentionally coarse — we want a few classes, not a
 * structural fingerprint.
 */
function jsonShape(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'object') return 'object';
  return t; // 'string' | 'number' | 'boolean' | 'undefined'
}
