/**
 * Deterministic pre-validator: json_output_discipline_check
 *
 * Per validator_catalog.md §1: verify the agent's raw response is bare JSON.
 * Must start with `{` or `[`, end with `}` or `]`, no markdown fence wrappers
 * (```json / ```), no trailing prose, no leading commentary.
 *
 * This is the only PRE-VALIDATOR in the harness — it runs BEFORE the LLM
 * validator chain. If it fires HIGH, the harness short-circuits and skips LLM
 * validators (see reviewHarness.ts pre-validation hook).
 *
 * Cal-26 evidence: markdown-fence wrapping at sample 23 (technical_spec_agent
 * / api_definitions) triggered json_repair with 134695ms additional latency;
 * same pattern at Phase 6 task_skeleton. Cross-phase recurrence across two
 * distinct roles confirms family-level promotion.
 *
 * Severity:
 *   - HIGH:   markdown-fenced JSON (`\`\`\`json ... \`\`\``)
 *   - HIGH:   leading commentary before `{` or `[`
 *   - MEDIUM: trailing prose after closing `}` or `]`
 *
 * This validator emits ADVISORY findings only; targetField/targetIdentifier
 * are not populated because findings do not correspond to mutable array
 * elements — they describe whole-response shape violations (fences, prose
 * wrappers) at location `$`. Auto-mitigation by dropping an array element
 * is not applicable.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const FENCE_OPEN_RE = /^```(?:json)?\s*\n/;
const FENCE_ANYWHERE_RE = /```(?:json)?/;
const LEADING_PROSE_RE = /^[^{[]/;
const TRAILING_PROSE_RE = /[}\]]\s*\n[\s\S]/;

export function validateJsonOutputDiscipline(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const text = (params.outputText ?? '').trim();
  if (!text) return [];

  const findings: ValidatorFinding[] = [];

  // 1. Markdown fence wrapper (```json or ```)
  if (FENCE_OPEN_RE.test(text) || FENCE_ANYWHERE_RE.test(text)) {
    findings.push({
      validatorId: 'json_output_discipline_check',
      severity: 'HIGH',
      type: 'markdown_fence_wrapper',
      summary: 'Agent response is wrapped in markdown code fence(s)',
      location: '$',
      detail:
        'The agent wrapped its JSON output in ```json...``` fences. This breaks downstream JSON parsing and triggers expensive json_repair calls.',
      recommendation:
        'Emit bare JSON starting with { or [ — no markdown fences, no prose.',
    });
    // When there is a fence, the leading/trailing checks are redundant — early return.
    return findings;
  }

  // 2. Leading commentary (response does not start with { or [)
  if (LEADING_PROSE_RE.test(text)) {
    findings.push({
      validatorId: 'json_output_discipline_check',
      severity: 'HIGH',
      type: 'leading_prose',
      summary: 'Agent response has leading prose before the JSON object',
      location: '$',
      detail: `Response starts with '${text.slice(0, 40).replace(/\n/g, '\\n')}...' instead of { or [.`,
      recommendation:
        'Remove all commentary before the opening { or [. Output starts immediately with the JSON.',
    });
    return findings;
  }

  // 3. Trailing prose after the closing } or ]
  if (TRAILING_PROSE_RE.test(text)) {
    findings.push({
      validatorId: 'json_output_discipline_check',
      severity: 'MEDIUM',
      type: 'trailing_prose',
      summary: 'Agent response has trailing content after closing JSON delimiter',
      location: '$',
      detail: 'Text appears after the closing } or ] of the JSON.',
      recommendation:
        'Remove all prose after the closing brace/bracket. JSON ends at the last } or ].',
    });
  }

  return findings;
}
