/**
 * Phase 10.1 — finding adjudication.
 *
 * The whole pipeline produces ~1000 validator findings per run, none of which
 * carry an adjudication status (resolved / open / waived). Phase 10.1 is the
 * spec's final cross-artifact Consistency Checker; it is the natural — and only
 * — place to render that missing verdict against the ACTUAL implementation.
 *
 * This module is pure + injectable: it gathers the run-wide unadjudicated
 * findings (reasoning-review + per-packet coherence), renders an adjudication
 * prompt, and parses the LLM's verdicts. The phase10 handler supplies the LLM
 * closure and merges the result into the consistency_report. Adjudication is
 * advisory — it never blocks the commit by itself.
 */
import type { GovernedStreamWriter } from '../../governedStreamWriter';
import type { ImplementationPacketContent } from '../../../types/records';
import {
  selectReasoningFindings, categorizeCoherence, type SurfacedFinding,
} from '../../../review/findingSurfacing';

export type AdjudicationVerdict = 'resolved_by_implementation' | 'still_open' | 'waived';

export interface FindingForAdjudication {
  /** Stable, prompt-safe handle the LLM echoes back. */
  ref: string;
  source: 'reasoning_review' | 'coherence';
  /** validator_id (reasoning-review) or P/A/C code (coherence). */
  label: string;
  severity: string;
  summary: string;
  recommendation?: string;
}

export interface FindingAdjudication {
  finding_ref: string;
  verdict: AdjudicationVerdict;
  rationale: string;
}

export interface AdjudicationResult {
  findings: FindingForAdjudication[];
  adjudications: FindingAdjudication[];
  summary: { total: number; resolved: number; still_open: number; waived: number; unadjudicated: number };
  note?: string;
}

const VALID_VERDICTS: ReadonlySet<string> = new Set([
  'resolved_by_implementation', 'still_open', 'waived',
]);

/**
 * Gather the run-wide unadjudicated findings worth a final verdict:
 * substantive reasoning-review findings (the auditor keeps reasoning-PROCESS
 * ones too — forExecutor:false) + every packet's coherence findings.
 */
export function gatherRunFindings(writer: GovernedStreamWriter, workflowRunId: string): FindingForAdjudication[] {
  const out: FindingForAdjudication[] = [];

  const reasoning: SurfacedFinding[] = selectReasoningFindings(writer, workflowRunId, { forExecutor: false });
  for (const [i, f] of reasoning.entries()) {
    out.push({
      ref: `RR-${i + 1}`,
      source: 'reasoning_review',
      label: f.validatorId,
      severity: f.severity,
      summary: f.summary,
      recommendation: f.recommendation || undefined,
    });
  }

  let cohIdx = 0;
  const seen = new Set<string>();
  for (const r of writer.getRecordsByType(workflowRunId, 'implementation_packet')) {
    const p = r.content as unknown as ImplementationPacketContent;
    const codes = [...(p.coherence?.blocking_failures ?? []), ...(p.coherence?.advisory_findings ?? [])];
    const { actionable, fyi } = categorizeCoherence(codes);
    for (const entry of [...actionable.map(a => a.line), ...fyi]) {
      if (seen.has(entry)) continue; // identical coherence line across packets → once
      seen.add(entry);
      const code = entry.split(':')[0]?.trim() ?? 'coherence';
      out.push({
        ref: `COH-${++cohIdx}`,
        source: 'coherence',
        label: code,
        severity: code.startsWith('A') || code.startsWith('P8') ? 'advisory' : 'blocking',
        summary: entry,
      });
    }
  }

  return out;
}

/** Render the adjudication prompt. Pure. */
export function renderAdjudicationPrompt(
  findings: FindingForAdjudication[],
  implementationSummary: string,
): string {
  const lines: string[] = [];
  lines.push(
    'You are the Consistency Checker performing the final pre-commit adjudication (Sub-Phase 10.1).',
    'For each upstream validator/coherence finding below, judge — AGAINST THE ACTUAL IMPLEMENTATION — whether it is:',
    '  - "resolved_by_implementation": the implementation already satisfies/avoids the concern;',
    '  - "still_open": the concern remains a real defect in the committed artifacts;',
    '  - "waived": the concern is not applicable / acceptable (explain why).',
    '',
    'Return ONLY a JSON object: {"finding_adjudications":[{"finding_ref":"...","verdict":"resolved_by_implementation|still_open|waived","rationale":"..."}]}.',
    'Echo each finding_ref EXACTLY. Do not invent refs.',
    '',
    '## Implementation summary',
    implementationSummary || '(none provided)',
    '',
    '## Findings to adjudicate',
  );
  for (const f of findings) {
    const rec = f.recommendation ? ` | recommendation: ${f.recommendation}` : '';
    lines.push(`- ${f.ref} [${f.source}/${f.severity}] ${f.label}: ${f.summary}${rec}`);
  }
  return lines.join('\n');
}

/** Parse the LLM response into adjudications, keeping only known refs + valid verdicts. Tolerant. */
export function parseAdjudicationResponse(raw: string, knownRefs: ReadonlySet<string>): FindingAdjudication[] {
  let obj: unknown;
  try {
    // Tolerate prose around the JSON object.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    obj = start >= 0 && end > start ? JSON.parse(raw.slice(start, end + 1)) : JSON.parse(raw);
  } catch {
    return [];
  }
  const arr = (obj as { finding_adjudications?: unknown })?.finding_adjudications;
  if (!Array.isArray(arr)) return [];
  const out: FindingAdjudication[] = [];
  const usedRefs = new Set<string>();
  for (const item of arr) {
    const o = item as Record<string, unknown>;
    const ref = typeof o.finding_ref === 'string' ? o.finding_ref : '';
    const verdict = typeof o.verdict === 'string' ? o.verdict : '';
    if (!knownRefs.has(ref) || usedRefs.has(ref) || !VALID_VERDICTS.has(verdict)) continue;
    usedRefs.add(ref);
    out.push({
      finding_ref: ref,
      verdict: verdict as AdjudicationVerdict,
      rationale: typeof o.rationale === 'string' ? o.rationale : '',
    });
  }
  return out;
}

export function summarizeAdjudications(
  findings: FindingForAdjudication[],
  adjudications: FindingAdjudication[],
): AdjudicationResult['summary'] {
  const by = (v: AdjudicationVerdict): number => adjudications.filter(a => a.verdict === v).length;
  return {
    total: findings.length,
    resolved: by('resolved_by_implementation'),
    still_open: by('still_open'),
    waived: by('waived'),
    unadjudicated: Math.max(0, findings.length - adjudications.length),
  };
}

/**
 * Run the full adjudication: gather → render → invoke → parse → summarize.
 * Defensive: any failure (no findings, LLM unavailable/disabled, parse error)
 * returns an empty-but-valid result with a `note`, never throws. The caller
 * treats the output as advisory.
 */
export async function runFindingAdjudication(opts: {
  writer: GovernedStreamWriter;
  workflowRunId: string;
  implementationSummary: string;
  invokeLlm: (prompt: string) => Promise<string>;
}): Promise<AdjudicationResult> {
  const findings = gatherRunFindings(opts.writer, opts.workflowRunId);
  if (findings.length === 0) {
    return { findings, adjudications: [], summary: summarizeAdjudications(findings, []), note: 'no unadjudicated findings to assess' };
  }
  let adjudications: FindingAdjudication[] = [];
  let note: string | undefined;
  try {
    const raw = await opts.invokeLlm(renderAdjudicationPrompt(findings, opts.implementationSummary));
    adjudications = parseAdjudicationResponse(raw, new Set(findings.map(f => f.ref)));
    if (adjudications.length === 0) note = 'adjudication produced no parseable verdicts';
  } catch (err) {
    note = `adjudication skipped: ${err instanceof Error ? err.message : String(err)}`;
  }
  return { findings, adjudications, summary: summarizeAdjudications(findings, adjudications), note };
}
