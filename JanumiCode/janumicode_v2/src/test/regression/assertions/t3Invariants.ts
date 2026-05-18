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

export function checkT3Invariant(
  assertion: T3InvariantAssertion,
  parsed: unknown | null,
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
    case 'array_length': {
      // When the path itself ends in `[]` we get the elements; otherwise
      // it should resolve to one array. Normalize both.
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
    case 'forbidden_value_pattern': {
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
        detail: bad.length === 0 ? undefined : `${bad.length} forbidden value(s); first: ${bad.slice(0, 3).join(', ')}`,
      };
    }
    case 'required_value_pattern': {
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
        detail: values.length === 0
          ? 'path resolved to no values'
          : bad.length === 0
            ? undefined
            : `${bad.length}/${values.length} value(s) do not match ${assertion.pattern}; first: ${bad.slice(0, 3).join(', ')}`,
      };
    }
    case 'enum_subset': {
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
        detail: bad.length === 0 ? undefined : `${bad.length} out-of-enum value(s); first: ${bad.slice(0, 3).join(', ')}`,
      };
    }
    case 'unique_values': {
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
        detail: dups.length === 0 ? undefined : `${dups.length} duplicate(s); first: ${dups.slice(0, 3).join(', ')}`,
      };
    }
  }
}
