/**
 * T1 — JSON shape check. For each declared path in the shape map, walk
 * the parsed JSON, and verify the resolved value(s) match the expected
 * type. Array `[]` segments fan out: every element must match.
 */
import type { AssertionCheck, T1SchemaAssertion } from '../fixtureSchema.js';
import { evalJsonPath, evalJsonPathDetailed, typeCheck, describeType } from '../jsonPath.js';

export function checkT1Schema(
  assertion: T1SchemaAssertion,
  parsed: unknown,
  responseText: string,
  requireJsonParse: boolean,
): AssertionCheck[] {
  if (parsed === null || parsed === undefined) {
    return buildMissingParsedChecks(assertion, responseText, requireJsonParse);
  }

  const checks: AssertionCheck[] = [];

  for (const [path, expectedType] of Object.entries(assertion.shape)) {
    checks.push(checkShapePath(parsed, path, expectedType));
  }

  // Optional explicit required_paths gate.
  if (assertion.required_paths) {
    for (const path of assertion.required_paths) {
      checks.push(checkRequiredPath(parsed, path));
    }
  }

  return checks;
}

/**
 * Checks emitted when there is no parsed JSON to inspect. If parsing was
 * required, that's a single hard json_parse failure; otherwise every
 * declared shape path is reported as failing for lack of input.
 */
function buildMissingParsedChecks(
  assertion: T1SchemaAssertion,
  responseText: string,
  requireJsonParse: boolean,
): AssertionCheck[] {
  if (requireJsonParse) {
    return [{
      tier: 'T1',
      name: 'json_parse',
      passed: false,
      detail: `response did not parse as JSON (length ${responseText.length})`,
    }];
  }
  // No parsed JSON — every shape check is vacuously failing.
  return Object.keys(assertion.shape).map((path): AssertionCheck => ({
    tier: 'T1',
    name: `shape:${path}`,
    passed: false,
    detail: 'no parsed JSON available',
  }));
}

/**
 * Resolves one shape path and type-checks every fanned-out value. An
 * empty resolution is vacuously satisfied only when traversal passed
 * through an empty array; otherwise it's a failure.
 */
function checkShapePath(
  parsed: unknown,
  path: string,
  expectedType: string,
): AssertionCheck {
  const { values, traversedEmptyArray } = evalJsonPathDetailed(parsed, path);
  if (values.length === 0) {
    return {
      tier: 'T1',
      name: `shape:${path}`,
      passed: traversedEmptyArray,
      detail: traversedEmptyArray
        ? 'vacuously satisfied: parent array was empty'
        : `path resolved to no values (expected ${expectedType})`,
    };
  }
  let failureDetail: string | null = null;
  for (const v of values) {
    const err = typeCheck(v, expectedType);
    if (err) {
      failureDetail = `${err} at one of ${values.length} value(s); first bad sample = ${describeType(v)}`;
      break;
    }
  }
  return {
    tier: 'T1',
    name: `shape:${path}`,
    passed: failureDetail === null,
    detail: failureDetail ?? undefined,
  };
}

/** Checks that a required path resolves to at least one value. */
function checkRequiredPath(parsed: unknown, path: string): AssertionCheck {
  const values = evalJsonPath(parsed, path);
  const present = values.length > 0;
  return {
    tier: 'T1',
    name: `required:${path}`,
    passed: present,
    detail: present ? undefined : 'required path resolved to no values',
  };
}
