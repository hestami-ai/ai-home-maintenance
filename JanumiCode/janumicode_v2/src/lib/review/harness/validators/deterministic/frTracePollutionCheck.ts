/**
 * Deterministic validator: fr_trace_pollution_check
 *
 * Per validator_catalog.md §5.1 + sample 11. NFR-only: no `traces_to[]`
 * entry should match the FR-id pattern (US-NNN or AC-NNN). Severity HIGH —
 * direct boundary contract violation between FR and NFR spines.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const FR_ID_REGEX = /^(US|AC)-\w+/;

function* iterTraces(nfrs: unknown): Generator<{ idx: number; nfrId: string; trace: string }> {
  if (!Array.isArray(nfrs)) return;
  for (let i = 0; i < nfrs.length; i++) {
    const nfr = nfrs[i];
    if (!nfr || typeof nfr !== 'object') continue;
    const traces = (nfr as Record<string, unknown>).traces_to;
    if (!Array.isArray(traces)) continue;
    const nfrId =
      typeof (nfr as Record<string, unknown>).id === 'string'
        ? ((nfr as Record<string, unknown>).id as string)
        : `index ${i}`;
    for (const t of traces) {
      if (typeof t === 'string') {
        yield { idx: i, nfrId, trace: t };
      }
    }
  }
}

export function validateFrTracePollutionCheck(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const out = params.outputContent;
  if (!out) return [];
  const findings: ValidatorFinding[] = [];
  for (const { idx, nfrId, trace } of iterTraces(out.requirements)) {
    if (FR_ID_REGEX.test(trace)) {
      const hasRealId = !nfrId.startsWith('index ');
      findings.push({
        validatorId: 'fr_trace_pollution_check',
        severity: hasRealId ? 'HIGH' : 'MEDIUM',
        type: 'fr_id_in_nfr_traces',
        summary: `NFR ${nfrId} traces_to includes FR-shaped id '${trace}'`,
        location: `$.requirements[${idx}].traces_to`,
        detail: `traces_to entry '${trace}' has FR-id shape (US-* or AC-*); NFRs trace to V&V or material-COMP items, not FR ids.`,
        recommendation: `Remove '${trace}' from requirements[${idx}].traces_to or relocate the relationship to FR-side.`,
        ...(hasRealId
          ? { targetField: 'requirements', targetIdentifier: nfrId }
          : {}),
      });
    }
  }
  return findings;
}
