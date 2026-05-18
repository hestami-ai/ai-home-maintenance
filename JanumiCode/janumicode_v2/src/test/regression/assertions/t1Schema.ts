/**
 * T1 — JSON shape check. For each declared path in the shape map, walk
 * the parsed JSON, and verify the resolved value(s) match the expected
 * type. Array `[]` segments fan out: every element must match.
 */
import type { AssertionCheck, T1SchemaAssertion } from '../fixtureSchema.js';
import { evalJsonPath, evalJsonPathDetailed, typeCheck, describeType } from '../jsonPath.js';

export function checkT1Schema(
  assertion: T1SchemaAssertion,
  parsed: unknown | null,
  responseText: string,
  requireJsonParse: boolean,
): AssertionCheck[] {
  const checks: AssertionCheck[] = [];

  if (parsed === null || parsed === undefined) {
    if (requireJsonParse) {
      checks.push({
        tier: 'T1',
        name: 'json_parse',
        passed: false,
        detail: `response did not parse as JSON (length ${responseText.length})`,
      });
      return checks;
    }
    // No parsed JSON — every shape check is vacuously failing.
    for (const path of Object.keys(assertion.shape)) {
      checks.push({
        tier: 'T1',
        name: `shape:${path}`,
        passed: false,
        detail: 'no parsed JSON available',
      });
    }
    return checks;
  }

  for (const [path, expectedType] of Object.entries(assertion.shape)) {
    const { values, traversedEmptyArray } = evalJsonPathDetailed(parsed, path);
    if (values.length === 0) {
      if (traversedEmptyArray) {
        checks.push({
          tier: 'T1',
          name: `shape:${path}`,
          passed: true,
          detail: 'vacuously satisfied: parent array was empty',
        });
      } else {
        checks.push({
          tier: 'T1',
          name: `shape:${path}`,
          passed: false,
          detail: `path resolved to no values (expected ${expectedType})`,
        });
      }
      continue;
    }
    let failureDetail: string | null = null;
    for (const v of values) {
      const err = typeCheck(v, expectedType);
      if (err) {
        failureDetail = `${err} at one of ${values.length} value(s); first bad sample = ${describeType(v)}`;
        break;
      }
    }
    checks.push({
      tier: 'T1',
      name: `shape:${path}`,
      passed: failureDetail === null,
      detail: failureDetail ?? undefined,
    });
  }

  // Optional explicit required_paths gate.
  if (assertion.required_paths) {
    for (const path of assertion.required_paths) {
      const values = evalJsonPath(parsed, path);
      const present = values.length > 0;
      checks.push({
        tier: 'T1',
        name: `required:${path}`,
        passed: present,
        detail: present ? undefined : 'required path resolved to no values',
      });
    }
  }

  return checks;
}
