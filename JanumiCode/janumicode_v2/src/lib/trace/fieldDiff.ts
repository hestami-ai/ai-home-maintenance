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

/**
 * Compute a field-diff between an input value and an output value.
 * Both should be objects (records). Non-object inputs yield an empty
 * diff (no signal to emit).
 */
export function computeFieldDiff(input: unknown, output: unknown): TransformationFieldDiff {
  const diff: TransformationFieldDiff = {};

  if (!isPlainObject(input) || !isPlainObject(output)) {
    return diff;
  }

  const inRec = input as Record<string, unknown>;
  const outRec = output as Record<string, unknown>;
  const inKeys = new Set(Object.keys(inRec));
  const outKeys = new Set(Object.keys(outRec));

  const { added, removed } = partitionAddedRemoved(inKeys, outKeys);
  const { type_changed, size_changed } = computeSharedKeyChanges(inRec, outRec, inKeys, outKeys);
  const renamed = detectRenames(inRec, outRec, removed, added);

  assignAddedRemovedRenamed(diff, added, removed, renamed);
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

/**
 * Split the two key sets into keys that only appear on the output side
 * (added) and keys that only appear on the input side (removed).
 * Iteration order matches the original: added follows outKeys order,
 * removed follows inKeys order.
 */
function partitionAddedRemoved(
  inKeys: Set<string>,
  outKeys: Set<string>,
): { added: string[]; removed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  for (const k of outKeys) {
    if (!inKeys.has(k)) added.push(k);
  }
  for (const k of inKeys) {
    if (!outKeys.has(k)) removed.push(k);
  }
  return { added, removed };
}

/** Discriminated result of comparing a key present on both sides. */
type SharedKeyChange =
  | { kind: 'type' }
  | { kind: 'size'; from: number; to: number }
  | null;

/**
 * Classify how a single shared key's value changed. Shape mismatch wins
 * (type change) and short-circuits before the array-length check, mirroring
 * the original `continue` after pushing a type_changed key.
 */
function classifySharedKeyChange(a: unknown, b: unknown): SharedKeyChange {
  if (jsonShape(a) !== jsonShape(b)) {
    return { kind: 'type' };
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) {
    return { kind: 'size', from: a.length, to: b.length };
  }
  return null;
}

/**
 * Per-key shape comparison for keys present on both sides. Produces the
 * type_changed and size_changed collections in inKeys iteration order.
 */
function computeSharedKeyChanges(
  inRec: Record<string, unknown>,
  outRec: Record<string, unknown>,
  inKeys: Set<string>,
  outKeys: Set<string>,
): { type_changed: string[]; size_changed: Array<{ field: string; from: number; to: number }> } {
  const type_changed: string[] = [];
  const size_changed: Array<{ field: string; from: number; to: number }> = [];
  for (const k of inKeys) {
    if (!outKeys.has(k)) continue;
    const change = classifySharedKeyChange(inRec[k], outRec[k]);
    if (change?.kind === 'type') {
      type_changed.push(k);
    } else if (change?.kind === 'size') {
      size_changed.push({ field: k, from: change.from, to: change.to });
    }
  }
  return { type_changed, size_changed };
}

/**
 * True when an added key's value is a plausible rename target for a
 * removed value: same coarse shape, and (for arrays) matching length to
 * reduce false positives. Preserves the original short-circuit order.
 */
function shapesRenameCompatible(
  removedVal: unknown,
  removedShape: string,
  addedVal: unknown,
): boolean {
  if (jsonShape(addedVal) !== removedShape) return false;
  // For arrays, also require length match to reduce false positives.
  if (
    Array.isArray(removedVal) &&
    Array.isArray(addedVal) &&
    removedVal.length !== addedVal.length
  ) {
    return false;
  }
  // Bonus: case-insensitive match boosts confidence. Don't filter on
  // it, but it's the common case (snake_case / camelCase) we expect.
  return true;
}

/**
 * Find the first not-yet-used added key whose value is shape-compatible
 * with the given removed value. Returns the added key or null. Equivalent
 * to the original inner loop with its `break` on first match.
 */
function findRenameTarget(
  removedVal: unknown,
  outRec: Record<string, unknown>,
  added: string[],
  usedAdded: Set<string>,
): string | null {
  const removedShape = jsonShape(removedVal);
  for (const a of added) {
    if (usedAdded.has(a)) continue;
    if (!shapesRenameCompatible(removedVal, removedShape, outRec[a])) continue;
    return a;
  }
  return null;
}

/**
 * Heuristic rename detection: pair `removed` keys to `added` keys when
 * shapes match. O(n*m) over typically tiny key sets — fine. Each added
 * key is consumed at most once, matching the original usedAdded logic.
 */
function detectRenames(
  inRec: Record<string, unknown>,
  outRec: Record<string, unknown>,
  removed: string[],
  added: string[],
): Array<{ from: string; to: string }> {
  const renamed: Array<{ from: string; to: string }> = [];
  const usedAdded = new Set<string>();
  for (const r of removed) {
    const target = findRenameTarget(inRec[r], outRec, added, usedAdded);
    if (target !== null) {
      renamed.push({ from: r, to: target });
      usedAdded.add(target);
    }
  }
  return renamed;
}

/**
 * Write added/removed/renamed onto the diff, subtracting rename pairs from
 * added/removed to avoid double-counting. Empty collections are omitted so
 * the diff carries only real signal.
 */
function assignAddedRemovedRenamed(
  diff: TransformationFieldDiff,
  added: string[],
  removed: string[],
  renamed: Array<{ from: string; to: string }>,
): void {
  if (!renamed.length) {
    if (added.length) diff.added = added;
    if (removed.length) diff.removed = removed;
    return;
  }
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
}

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
