/**
 * Too-Clever-By-Half Review Agent (Tier 12).
 *
 * Per docs/janumilegal_product_description.md §Tier 12 #55:
 *   "Flag over-engineered, impractical, risky, or overly aggressive legal outputs."
 *
 * Wave 4 ships keyword-pattern detection over artifact metadata. Wave 6+ adds
 * LLM-backed reasoning about legal-strategy aggressiveness.
 */

import { randomUUID } from 'node:crypto';
import { summarize, type GovernanceFinding, type GovernanceReport } from './types.js';

export const TOO_CLEVER_DETECTOR_ID = 'too_clever_detector.v1';

export interface ArtifactKeywordSnapshot {
  readonly artifactId: string;
  readonly artifactType: string;
  readonly keywords: readonly string[];
}

interface PatternRule {
  readonly id: string;
  readonly severity: 'info' | 'warn' | 'block';
  readonly category: string;
  readonly message: string;
  readonly anyOf: readonly string[];
}

const RULES: readonly PatternRule[] = [
  {
    id: 'novel_theory',
    severity: 'warn',
    category: 'overaggressive',
    message: 'artifact references a "novel theory" / "unprecedented" approach when standard procedural relief may suffice.',
    anyOf: ['novel theory', 'unprecedented', 'first impression', 'never tried'],
  },
  {
    id: 'guarantee_language',
    severity: 'block',
    category: 'overconfident',
    message: 'artifact contains guarantee/certainty language inappropriate for legal output.',
    anyOf: ['guaranteed', 'certain to win', '100% likely', 'will absolutely'],
  },
  {
    id: 'excessive_caveats',
    severity: 'warn',
    category: 'communication_quality',
    message: 'artifact contains excessive caveat language that may confuse a client recipient.',
    anyOf: ['however please note', 'additionally caveat', 'further qualification', 'subject to many uncertainties'],
  },
  {
    id: 'extreme_relief',
    severity: 'warn',
    category: 'overaggressive',
    message: 'artifact seeks extreme relief language unsupported by typical fact patterns.',
    anyOf: ['punitive damages of millions', 'permanent injunction without basis', 'sanctions without evidence'],
  },
];

export class TooCleverDetector {
  detect(artifacts: readonly ArtifactKeywordSnapshot[]): GovernanceReport {
    const findings: GovernanceFinding[] = [];
    for (const a of artifacts) {
      const lowerKeywords = a.keywords.map((k) => k.toLowerCase());
      for (const rule of RULES) {
        for (const pat of rule.anyOf) {
          if (lowerKeywords.some((k) => k.includes(pat))) {
            findings.push({
              findingId: randomUUID(),
              agentId: TOO_CLEVER_DETECTOR_ID,
              severity: rule.severity,
              category: rule.category,
              message: `${a.artifactType}/${a.artifactId}: ${rule.message} (matched: '${pat}')`,
              subject: { kind: 'artifact', id: a.artifactId },
            });
            break; // one finding per rule per artifact
          }
        }
      }
    }
    return {
      reportId: randomUUID(),
      producedBy: TOO_CLEVER_DETECTOR_ID,
      producedAt: new Date().toISOString(),
      findings,
      summary: summarize(findings),
    };
  }
}
