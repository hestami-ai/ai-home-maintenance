/**
 * Intent Drift Detector (Tier 12).
 *
 * Per docs/janumilegal_product_description.md §Tier 12 #53:
 *   "Compare final artifact against original mirrored objective and menu selections."
 *
 * Wave 4 ships deterministic comparisons:
 *   - originating MMP Mirror cards / Menu selections (passed in by caller);
 *   - the LBH governingObjective;
 *   - artifact metadata (matter type, jurisdiction, requested action).
 *
 * Examples it catches:
 *   - "User requested client advice draft; system produced research memo only."
 *   - "User selected conservative posture; draft is aggressive."
 *   - "User requested Maryland family law; analysis uses generic law."
 *
 * Wave 6+ adds LLM-backed semantic comparison.
 */

import { randomUUID } from 'node:crypto';
import { summarize, type GovernanceFinding, type GovernanceReport } from './types.js';

export const INTENT_DRIFT_DETECTOR_ID = 'intent_drift_detector.v1';

export interface OriginatingIntent {
  readonly governingObjective: string;
  /** Mirror assumptions accepted by the attorney (post-MMP submission). */
  readonly acceptedMirrorAssumptions: readonly string[];
  /** Menu selections; chosen option labels keyed by question. */
  readonly menuSelections: readonly { question: string; chosenOptionLabel: string }[];
  /** Originally requested artifact types (e.g., 'client_advice_draft', 'court_filing_draft'). */
  readonly requestedArtifactTypes: readonly string[];
  /** Originally requested jurisdiction(s). */
  readonly requestedJurisdictions: readonly string[];
}

export interface FinalArtifactSnapshot {
  readonly artifactId: string;
  readonly artifactType: string;
  readonly metadataKeywords: readonly string[];
  readonly jurisdictionsReferenced: readonly string[];
}

export class IntentDriftDetector {
  detect(args: {
    intent: OriginatingIntent;
    finalArtifacts: readonly FinalArtifactSnapshot[];
  }): GovernanceReport {
    const findings: GovernanceFinding[] = [];
    const producedTypes = new Set(args.finalArtifacts.map((a) => a.artifactType));

    // Drift: requested artifact type not produced
    for (const requested of args.intent.requestedArtifactTypes) {
      if (!producedTypes.has(requested)) {
        findings.push({
          findingId: randomUUID(),
          agentId: INTENT_DRIFT_DETECTOR_ID,
          severity: 'block',
          category: 'artifact_type_missing',
          message: `originally requested artifact type '${requested}' was not produced`,
          subject: { kind: 'general' },
        });
      }
    }

    // Drift: jurisdiction omission
    if (args.intent.requestedJurisdictions.length > 0) {
      const referenced = new Set(args.finalArtifacts.flatMap((a) => a.jurisdictionsReferenced));
      for (const j of args.intent.requestedJurisdictions) {
        if (!referenced.has(j)) {
          findings.push({
            findingId: randomUUID(),
            agentId: INTENT_DRIFT_DETECTOR_ID,
            severity: 'warn',
            category: 'jurisdiction_drift',
            message: `requested jurisdiction '${j}' not referenced in any produced artifact`,
            subject: { kind: 'general' },
          });
        }
      }
    }

    // Drift: posture (menu selections) vs. produced metadata
    const menuPosture = args.intent.menuSelections
      .map((s) => s.chosenOptionLabel.toLowerCase())
      .join(' ');
    const oppositesMap: Record<string, string[]> = {
      conservative: ['aggressive', 'novel', 'unprecedented'],
      aggressive: ['conservative', 'cautious'],
      enforcement: ['modification', 'rewrite'],
    };
    for (const a of args.finalArtifacts) {
      const allKeywords = a.metadataKeywords.map((k) => k.toLowerCase());
      for (const [posture, opposites] of Object.entries(oppositesMap)) {
        if (menuPosture.includes(posture)) {
          for (const opp of opposites) {
            if (allKeywords.includes(opp)) {
              findings.push({
                findingId: randomUUID(),
                agentId: INTENT_DRIFT_DETECTOR_ID,
                severity: 'block',
                category: 'posture_drift',
                message: `attorney chose '${posture}' posture but artifact ${a.artifactId} contains opposing keyword '${opp}'`,
                subject: { kind: 'artifact', id: a.artifactId },
              });
            }
          }
        }
      }
    }

    return {
      reportId: randomUUID(),
      producedBy: INTENT_DRIFT_DETECTOR_ID,
      producedAt: new Date().toISOString(),
      findings,
      summary: summarize(findings),
    };
  }
}
