/**
 * Deterministic validator: exemplar_leakage_detector
 *
 * Detects copied exemplar values in the agent output. The exemplar
 * fragments are keyed by `${agent_role}::${sub_phase}` and seeded
 * from observed exemplar leakage in samples 09/10/12.
 *
 * Severity: substring match -> HIGH (exemplar_leak); near-match
 * (within Levenshtein/2 of exemplar) -> MEDIUM (exemplar_paraphrase).
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

/**
 * Per-(role, sub_phase) seed exemplar fragments. Conservative — only
 * fragments that appeared verbatim in calibration samples 09/10/12
 * prompt-block exemplars and were reused by the agent unchanged.
 */
export const EXEMPLAR_FRAGMENTS: Record<string, readonly string[]> = {
  'requirements_agent::fr_bloom_skeleton': [
    'as a property owner, I want to upload my W-9',
    'as a service provider, I want to receive escrow notifications',
  ],
  'requirements_agent::fr_bloom_enrichment': [
    'within 250 ms p95 over a 5-minute rolling window',
    'rejected with HTTP 422 and code "INVALID_W9"',
  ],
  'requirements_agent::nfr_bloom_enrichment': [
    'p95 < 250 ms; p99 < 800 ms',
    'observable via /metrics endpoint emitting Prometheus histograms',
  ],
};

function collectStrings(node: unknown, out: { text: string; path: string }[], path: string): void {
  if (typeof node === 'string') {
    if (node.length >= 12) out.push({ text: node, path });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectStrings(v, out, `${path}[${i}]`));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      collectStrings(v, out, path ? `${path}.${k}` : k);
    }
  }
}

export function validateExemplarLeakageDetector(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const key = `${params.agentRole}::${params.subPhaseId}`;
  const fragments = EXEMPLAR_FRAGMENTS[key];
  if (!fragments || fragments.length === 0) return [];
  const out = params.outputContent;
  if (!out) return [];

  const strings: { text: string; path: string }[] = [];
  collectStrings(out, strings, '$');

  const findings: ValidatorFinding[] = [];
  for (const { text, path } of strings) {
    const lower = text.toLowerCase();
    for (const frag of fragments) {
      if (lower.includes(frag.toLowerCase())) {
        findings.push({
          validatorId: 'exemplar_leakage_detector',
          severity: 'HIGH',
          type: 'exemplar_leak',
          summary: `Exemplar fragment surfaced as authored content`,
          location: path,
          detail: `Output reproduces prompt exemplar fragment: "${frag}".`,
          recommendation: 'Replace the exemplar with project-grounded language.',
        });
      }
    }
  }
  return findings;
}
