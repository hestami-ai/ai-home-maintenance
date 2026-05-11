/**
 * Shortcut / Superficiality Detector (Tier 12).
 *
 * Per docs/janumilegal_product_description.md §Tier 12 #54:
 *   "Detect whether the system solved the narrow visible symptom while
 *    skipping broader required workflow."
 *
 * Wave 4 deterministic checks:
 *   - drafted client message but did not load existing order;
 *   - generated motion but did not capture procedural posture;
 *   - produced legal conclusion but did not separate client-reported facts
 *     from document-supported facts.
 *
 * Inputs are state-output snapshots. Wave 6+ adds LLM-backed semantic checks.
 */

import { randomUUID } from 'node:crypto';
import { summarize, type GovernanceFinding, type GovernanceReport } from './types.js';

export const SHORTCUT_DETECTOR_ID = 'shortcut_detector.v1';

export interface ActivationSnapshot {
  readonly completedStateIds: readonly string[];
  /** state outputs keyed by stateId (parsed JSON or summary). */
  readonly stateOutputs: Readonly<Record<string, unknown>>;
}

export interface ShortcutRule {
  readonly id: string;
  readonly category: string;
  readonly severity: 'info' | 'warn' | 'block';
  readonly message: string;
  /** Returns true when the rule fires (i.e., a shortcut is detected). */
  readonly fires: (snap: ActivationSnapshot) => boolean;
}

const completed = (snap: ActivationSnapshot, ...stateIds: string[]) =>
  stateIds.every((s) => snap.completedStateIds.includes(s));

const missing = (snap: ActivationSnapshot, ...stateIds: string[]) =>
  stateIds.some((s) => !snap.completedStateIds.includes(s));

const DEFAULT_RULES: readonly ShortcutRule[] = [
  {
    id: 'client_advice_without_existing_order_extract',
    category: 'shortcut',
    severity: 'block',
    message: 'ClientAdviceDraft completed without ExistingOrderExtract — drafted advice without checking the operative order.',
    fires: (s) => completed(s, 'ClientAdviceDraft') && missing(s, 'ExistingOrderExtract'),
  },
  {
    id: 'filing_without_procedural_posture',
    category: 'shortcut',
    severity: 'block',
    message: 'CourtFilingDraftGenerate completed without procedural-posture capture — filing produced without forum/posture verification.',
    fires: (s) =>
      completed(s, 'CourtFilingDraftGenerate') &&
      missing(s, 'ProceduralPosture') &&
      missing(s, 'ProceduralPostureCapture'),
  },
  {
    id: 'conclusion_without_fact_law_split',
    category: 'shortcut',
    severity: 'block',
    message: 'DirectLegalConclusionDraft completed without FactExtraction — conclusion not anchored to source-traced facts.',
    fires: (s) => completed(s, 'DirectLegalConclusionDraft') && missing(s, 'FactExtraction'),
  },
  {
    id: 'release_without_authority_verification',
    category: 'shortcut',
    severity: 'warn',
    message: 'ReleaseStatusDetermine completed without AuthorityVerification — release computed without authority status check.',
    fires: (s) => completed(s, 'ReleaseStatusDetermine') && missing(s, 'AuthorityVerification'),
  },
];

export class ShortcutDetector {
  constructor(private readonly rules: readonly ShortcutRule[] = DEFAULT_RULES) {}

  detect(snap: ActivationSnapshot): GovernanceReport {
    const findings: GovernanceFinding[] = [];
    for (const r of this.rules) {
      if (r.fires(snap)) {
        findings.push({
          findingId: randomUUID(),
          agentId: SHORTCUT_DETECTOR_ID,
          severity: r.severity,
          category: r.category,
          message: r.message,
        });
      }
    }
    return {
      reportId: randomUUID(),
      producedBy: SHORTCUT_DETECTOR_ID,
      producedAt: new Date().toISOString(),
      findings,
      summary: summarize(findings),
    };
  }
}
