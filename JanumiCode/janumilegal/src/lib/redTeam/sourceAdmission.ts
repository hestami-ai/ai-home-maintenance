/**
 * Source-admission pipeline (Wave 13).
 *
 * Per docs/design/wave13_red_team_harness.md §3.
 *
 * Runs each registered red-team source-admission validator against an
 * incoming source and returns a single decision:
 *   - clean    → source is admitted as-is
 *   - suspect  → source is admitted with `cleanedContent` (markers stripped)
 *                and `preamble` (defensive instruction the agent prepends
 *                to its prompt when the source is in scope)
 *   - blocked  → source is rejected; attorney must intervene
 *
 * Decision rule:
 *   - any HIGH from injection, marker, or encoding family → blocked
 *   - any MEDIUM → suspect
 *   - no findings → clean
 *
 * Failure mode: a validator that throws is treated as MEDIUM contribution
 * (default-deny on uncertainty). The validator failure is itself recorded
 * as a finding with type 'validator_unavailable' so audit can see it.
 */

import { DEFENSIVE_PREAMBLE } from './types.js';
import type {
  AdmissionDecision,
  SourceAdmissionFinding,
  SourceAdmissionInput,
  SourceAdmissionResult,
  SourceAdmissionValidator,
} from './types.js';
import type { LLMProvider } from '../llm/provider.js';

export interface SourceAdmissionPipelineOptions {
  readonly validators: readonly SourceAdmissionValidator[];
  /** Reviewer LLM provider — used for LLM-kind validators. Optional. */
  readonly reviewerProvider?: LLMProvider;
  /**
   * Whether to consult an LLM-kind validator's `invoke` AFTER its
   * deterministic `validate` (when both exist). Default true. When the
   * deterministic pass already produced HIGH findings, the LLM consult
   * is skipped (fail-fast).
   */
  readonly enrichWithLlm?: boolean;
}

/** Strip known privilege markers from cleaned content (keeps semantics for the agent but defangs the attack). */
const STRIP_PATTERNS: RegExp[] = [
  /\[ATTORNEY[_\s-]?CLIENT\]/gi,
  /\[WORK[_\s-]?PRODUCT\]/gi,
  /<\/?work_product>/gi,
  /<\/?system[^>]*>/gi,
  /<\/?prompt>/gi,
  /<\/?instructions?>/gi,
  /\[(APPROVED|VERIFIED|CONFIRMED)[_\s-]?(BY[_\s-]ATTORNEY|FOR[_\s-]FILING)\]/gi,
];

function stripMarkers(content: string): string {
  let result = content;
  for (const rx of STRIP_PATTERNS) result = result.replace(rx, '[MARKER_STRIPPED]');
  return result;
}

export class SourceAdmissionPipeline {
  constructor(private readonly opts: SourceAdmissionPipelineOptions) {}

  async admit(input: SourceAdmissionInput): Promise<SourceAdmissionResult> {
    const findings: SourceAdmissionFinding[] = [];

    for (const v of this.opts.validators) {
      try {
        if (v.validate) {
          const raw = v.validate(input);
          for (const f of raw) {
            findings.push({ ...f, validatorId: v.id, attackFamily: v.attackFamily });
          }
        }
        if (v.kind === 'llm' && v.invoke && this.opts.reviewerProvider && this.opts.enrichWithLlm !== false) {
          // skip LLM consult if deterministic pass already produced HIGH catch from this validator
          const alreadyHigh = findings.some((f) => f.validatorId === v.id && f.severity === 'HIGH');
          if (!alreadyHigh) {
            const raw = await v.invoke(input, { provider: this.opts.reviewerProvider });
            for (const f of raw) {
              findings.push({ ...f, validatorId: v.id, attackFamily: v.attackFamily });
            }
          }
        }
      } catch (err) {
        findings.push({
          validatorId: v.id,
          attackFamily: v.attackFamily,
          severity: 'MEDIUM',
          type: 'validator_unavailable',
          message: `validator threw: ${(err as Error).message}`,
        });
      }
    }

    const decision: AdmissionDecision = decisionFromFindings(findings);
    const result: SourceAdmissionResult = {
      sourceId: input.sourceId,
      decision,
      findings,
      cleanedContent: decision === 'suspect' ? stripMarkers(input.content) : undefined,
      preamble: decision === 'suspect' ? DEFENSIVE_PREAMBLE : undefined,
    };
    return result;
  }
}

function decisionFromFindings(findings: readonly SourceAdmissionFinding[]): AdmissionDecision {
  if (findings.some((f) => f.severity === 'HIGH' && !isUnavailable(f))) return 'blocked';
  if (findings.length > 0) return 'suspect';
  return 'clean';
}

function isUnavailable(f: SourceAdmissionFinding): boolean {
  return f.type === 'validator_unavailable';
}

/** Default validator set — Wave 13 ships the 3 source-admission validators. */
export async function defaultSourceAdmissionValidators(): Promise<readonly SourceAdmissionValidator[]> {
  const { sourceInjectionDetector } = await import('./validators/sourceInjectionDetector.js');
  const { encodingObfuscationDetector } = await import('./validators/encodingObfuscationDetector.js');
  const { privilegeMarkerAttackDetector } = await import('./validators/privilegeMarkerAttackDetector.js');
  return [encodingObfuscationDetector, privilegeMarkerAttackDetector, sourceInjectionDetector];
}
