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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Apply a `prop` segment: for each plain-object value in `current` that owns
 * `name`, collect that property's value. Non-objects, arrays, null, and
 * objects missing the key are skipped (mirrors the original nested-if).
 */
function applyPropSegment(current: unknown[], name: string): unknown[] {
  const next: unknown[] = [];
  for (const v of current) {
    if (isPlainObject(v) && name in v) {
      next.push(v[name]);
    }
  }
  return next;
}

/**
 * Apply an `array` segment: flatten one array level, collecting each element.
 * Non-array values are skipped. Reports whether any array flattened here was
 * empty so the caller can OR it into the running `traversedEmptyArray` flag.
 */
function applyArraySegment(current: unknown[]): {
  next: unknown[];
  traversedEmptyArray: boolean;
} {
  const next: unknown[] = [];
  let traversedEmptyArray = false;
  for (const v of current) {
    if (Array.isArray(v)) {
      if (v.length === 0) traversedEmptyArray = true;
      for (const el of v) next.push(el);
    }
  }
  return { next, traversedEmptyArray };
}

export function evalJsonPathDetailed(root: unknown, path: string): JsonPathResult {
  const segments = parseJsonPath(path);
  let current: unknown[] = [root];
  let traversedEmptyArray = false;
  for (const seg of segments) {
    if (seg.kind === 'prop') {
      current = applyPropSegment(current, seg.name);
    } else {
      const applied = applyArraySegment(current);
      current = applied.next;
      if (applied.traversedEmptyArray) traversedEmptyArray = true;
    }
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
