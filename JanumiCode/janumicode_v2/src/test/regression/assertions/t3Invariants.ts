/**
 * T3 — counted invariants. Five kinds:
 *   array_length            — count of values at path within [min, max]
 *   forbidden_value_pattern — no string value at path matches the regex
 *   required_value_pattern  — every string value at path matches the regex
 *   enum_subset             — every value at path is in `allowed`
 *   unique_values           — values at path are unique
 */
import type {
  AssertionCheck,
  T3InvariantAssertion,
} from '../fixtureSchema.js';
import { evalJsonPath } from '../jsonPath.js';

/** First three offenders, comma-joined — the shared failure-detail tail. */
function firstThree(values: string[]): string {
  return values.slice(0, 3).join(', ');
}

/**
 * array_length: when the path itself ends in `[]` we get the elements;
 * otherwise it resolves to one array. Normalize both, then bounds-check.
 */
function checkArrayLength(
  assertion: T3InvariantAssertion,
  values: unknown[],
): AssertionCheck {
  let count: number;
  if (values.length === 1 && Array.isArray(values[0])) {
    count = (values[0] as unknown[]).length;
  } else {
    count = values.length;
  }
  const min = assertion.min ?? 0;
  const max = assertion.max ?? Number.POSITIVE_INFINITY;
  const passed = count >= min && count <= max;
  return {
    tier: 'T3',
    name: assertion.name,
    passed,
    detail: passed ? undefined : `length ${count} outside [${min}, ${assertion.max ?? '∞'}]`,
  };
}

/** forbidden_value_pattern: no string value at path may match the regex. */
function checkForbiddenValuePattern(
  assertion: T3InvariantAssertion,
  values: unknown[],
): AssertionCheck {
  if (!assertion.pattern) {
    return { tier: 'T3', name: assertion.name, passed: false, detail: 'pattern not provided' };
  }
  const re = new RegExp(assertion.pattern);
  const bad: string[] = [];
  for (const v of values) {
    if (typeof v === 'string' && re.test(v)) bad.push(v);
  }
  return {
    tier: 'T3',
    name: assertion.name,
    passed: bad.length === 0,
    detail: bad.length === 0 ? undefined : `${bad.length} forbidden value(s); first: ${firstThree(bad)}`,
  };
}

/** required_value_pattern: every string value at path must match the regex. */
function checkRequiredValuePattern(
  assertion: T3InvariantAssertion,
  values: unknown[],
): AssertionCheck {
  if (!assertion.pattern) {
    return { tier: 'T3', name: assertion.name, passed: false, detail: 'pattern not provided' };
  }
  const re = new RegExp(assertion.pattern);
  const bad: string[] = [];
  for (const v of values) {
    if (typeof v !== 'string' || !re.test(v)) bad.push(String(v));
  }
  return {
    tier: 'T3',
    name: assertion.name,
    passed: bad.length === 0 && values.length > 0,
    detail: requiredValuePatternDetail(assertion, values, bad),
  };
}

/** Detail string for required_value_pattern (empty-path / clean / mismatch). */
function requiredValuePatternDetail(
  assertion: T3InvariantAssertion,
  values: unknown[],
  bad: string[],
): string | undefined {
  if (values.length === 0) return 'path resolved to no values';
  if (bad.length === 0) return undefined;
  return `${bad.length}/${values.length} value(s) do not match ${assertion.pattern}; first: ${firstThree(bad)}`;
}

/** enum_subset: every value at path must be in the allowed set. */
function checkEnumSubset(
  assertion: T3InvariantAssertion,
  values: unknown[],
): AssertionCheck {
  const allowed = new Set(assertion.allowed ?? []);
  const bad: string[] = [];
  for (const v of values) {
    const s = typeof v === 'string' ? v : String(v);
    if (!allowed.has(s)) bad.push(s);
  }
  return {
    tier: 'T3',
    name: assertion.name,
    passed: bad.length === 0,
    detail: bad.length === 0 ? undefined : `${bad.length} out-of-enum value(s); first: ${firstThree(bad)}`,
  };
}

/** unique_values: values at path must be unique. */
function checkUniqueValues(
  assertion: T3InvariantAssertion,
  values: unknown[],
): AssertionCheck {
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const v of values) {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    if (seen.has(s)) dups.push(s);
    else seen.add(s);
  }
  return {
    tier: 'T3',
    name: assertion.name,
    passed: dups.length === 0,
    detail: dups.length === 0 ? undefined : `${dups.length} duplicate(s); first: ${firstThree(dups)}`,
  };
}

export function checkT3Invariant(
  assertion: T3InvariantAssertion,
  parsed: unknown,
): AssertionCheck {
  if (parsed === null || parsed === undefined) {
    return {
      tier: 'T3',
      name: assertion.name,
      passed: false,
      detail: 'no parsed JSON available',
    };
  }
  const values = evalJsonPath(parsed, assertion.path);

  switch (assertion.kind) {
    case 'array_length':
      return checkArrayLength(assertion, values);
    case 'forbidden_value_pattern':
      return checkForbiddenValuePattern(assertion, values);
    case 'required_value_pattern':
      return checkRequiredValuePattern(assertion, values);
    case 'enum_subset':
      return checkEnumSubset(assertion, values);
    case 'unique_values':
      return checkUniqueValues(assertion, values);
  }
}
