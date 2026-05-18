/**
 * Minimal JSONPath evaluator for fixture assertions.
 *
 * Supported notation:
 *   key                — simple property
 *   key.subkey         — nested property
 *   key[]              — array (returns array element values)
 *   key[].subkey       — array of objects, drills into each element
 *
 * Returns the flat list of values matched at the path. When the path
 * descends through one or more `[]` segments, the result is the
 * flattened sequence of leaf values. Missing intermediate keys are
 * skipped silently (the assertion layer reports the mismatch).
 */

export type JsonPathSegment =
  | { kind: 'prop'; name: string }
  | { kind: 'array' };

export function parseJsonPath(path: string): JsonPathSegment[] {
  const segments: JsonPathSegment[] = [];
  // Tokens are property names optionally followed by [] markers.
  const parts = path.split('.');
  for (const raw of parts) {
    if (!raw) continue;
    let name = raw;
    let arrayCount = 0;
    while (name.endsWith('[]')) {
      arrayCount++;
      name = name.slice(0, -2);
    }
    if (name) segments.push({ kind: 'prop', name });
    for (let i = 0; i < arrayCount; i++) segments.push({ kind: 'array' });
  }
  return segments;
}

export function evalJsonPath(root: unknown, path: string): unknown[] {
  return evalJsonPathDetailed(root, path).values;
}

/**
 * Detailed evaluator. Tracks whether a `[]` segment was applied to an
 * empty array during traversal. The caller can use `traversedEmptyArray`
 * to distinguish "no values because an array was empty" (vacuously
 * satisfied) from "no values because a property was missing" (failure).
 */
export interface JsonPathResult {
  values: unknown[];
  traversedEmptyArray: boolean;
}

export function evalJsonPathDetailed(root: unknown, path: string): JsonPathResult {
  const segments = parseJsonPath(path);
  let current: unknown[] = [root];
  let traversedEmptyArray = false;
  for (const seg of segments) {
    const next: unknown[] = [];
    for (const v of current) {
      if (seg.kind === 'prop') {
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          const obj = v as Record<string, unknown>;
          if (seg.name in obj) next.push(obj[seg.name]);
        }
      } else if (Array.isArray(v)) {
        if (v.length === 0) traversedEmptyArray = true;
        for (const el of v) next.push(el);
      }
    }
    current = next;
  }
  return { values: current, traversedEmptyArray };
}

/**
 * Type-check a single value against a declared shape type.
 * Returns null on success, error description on failure.
 */
export function typeCheck(value: unknown, expected: string): string | null {
  switch (expected) {
    case 'string':
      return typeof value === 'string' ? null : `expected string, got ${describeType(value)}`;
    case 'number':
      return typeof value === 'number' ? null : `expected number, got ${describeType(value)}`;
    case 'boolean':
      return typeof value === 'boolean' ? null : `expected boolean, got ${describeType(value)}`;
    case 'array':
      return Array.isArray(value) ? null : `expected array, got ${describeType(value)}`;
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? null : `expected object, got ${describeType(value)}`;
    case 'null':
      return value === null ? null : `expected null, got ${describeType(value)}`;
    default:
      return `unknown expected type "${expected}"`;
  }
}

export function describeType(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}
