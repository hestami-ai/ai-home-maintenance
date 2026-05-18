/**
 * T2 — ID-preservation. Extract IDs from a template variable via regex,
 * then verify they appear in the output at the declared path.
 *
 * Modes:
 *   all_in_field — every input id must appear in the output set.
 *   subset_match — every output id at the path must be in the input set.
 */
import type {
  AssertionCheck,
  Fixture,
  T2IdPreservationAssertion,
} from '../fixtureSchema.js';
import { evalJsonPath } from '../jsonPath.js';

function extractIds(text: string, pattern: string): string[] {
  const re = new RegExp(pattern, 'g');
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // Use first capture group if defined; otherwise the whole match.
    out.add(m[1] ?? m[0]);
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-length matches
  }
  return Array.from(out);
}

export function checkT2IdPreservation(
  assertion: T2IdPreservationAssertion,
  fixture: Fixture,
  parsed: unknown | null,
): AssertionCheck {
  const varName = assertion.input_source.variable;
  const variableText = fixture.template_variables[varName];
  if (variableText === undefined) {
    return {
      tier: 'T2',
      name: assertion.name,
      passed: false,
      detail: `input variable "${varName}" not found on fixture`,
    };
  }
  const inputIds = extractIds(variableText, assertion.input_source.id_pattern);
  if (inputIds.length === 0) {
    return {
      tier: 'T2',
      name: assertion.name,
      passed: false,
      detail: `no IDs extracted from variable "${varName}" with pattern ${assertion.input_source.id_pattern}`,
    };
  }

  if (parsed === null || parsed === undefined) {
    return {
      tier: 'T2',
      name: assertion.name,
      passed: false,
      detail: 'no parsed JSON available',
    };
  }

  const outputValues = evalJsonPath(parsed, assertion.output_assertion.path)
    .map((v) => (typeof v === 'string' ? v : String(v)));
  const outputSet = new Set(outputValues);
  const inputSet = new Set(inputIds);

  if (assertion.output_assertion.mode === 'all_in_field') {
    const missing = inputIds.filter((id) => !outputSet.has(id));
    const matchRatio = (inputIds.length - missing.length) / inputIds.length;
    const minRatio = assertion.output_assertion.min_match_ratio ?? 1.0;
    const passed = matchRatio >= minRatio;
    return {
      tier: 'T2',
      name: assertion.name,
      passed,
      detail: passed
        ? undefined
        : `missing ${missing.length}/${inputIds.length} input IDs (ratio ${matchRatio.toFixed(2)} < ${minRatio}); first missing: ${missing.slice(0, 5).join(', ')}`,
    };
  }

  // subset_match — every output id must come from the input set.
  const fabricated = outputValues.filter((v) => !inputSet.has(v));
  const matchRatio = outputValues.length === 0
    ? 1.0
    : (outputValues.length - fabricated.length) / outputValues.length;
  const minRatio = assertion.output_assertion.min_match_ratio ?? 1.0;
  const passed = matchRatio >= minRatio;
  return {
    tier: 'T2',
    name: assertion.name,
    passed,
    detail: passed
      ? undefined
      : `${fabricated.length}/${outputValues.length} fabricated output IDs (ratio ${matchRatio.toFixed(2)} < ${minRatio}); first fabricated: ${fabricated.slice(0, 5).join(', ')}`,
  };
}
