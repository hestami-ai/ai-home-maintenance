/**
 * Machine-assessed authority support.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 6 §6.2:
 *   "Machine-assessed support: LLM-backed evaluation of whether authority
 *    supports proposition, controlling vs. persuasive, no adverse changes outcome."
 *
 * Wave 6 ships an interface with a deterministic stand-in. Wave 7+ swaps
 * in an LLM-backed implementation that operates within an AgentInvocationScope
 * envelope.
 */

import type { AuthorityRef, MachineAssessedSupport } from './types.js';

export interface SupportAssessmentRequest {
  readonly authority: AuthorityRef;
  readonly authorityText: string;
  readonly proposition: string;
}

export interface SupportAssessor {
  assess(req: SupportAssessmentRequest): MachineAssessedSupport;
}

/**
 * Deterministic assessor for tests and Wave 6 calibration.
 * Looks for keywords in the authority text relative to the proposition.
 *
 * Wave 7+ replaces with LLM call.
 */
export class DeterministicSupportAssessor implements SupportAssessor {
  assess(req: SupportAssessmentRequest): MachineAssessedSupport {
    const propTokens = tokenize(req.proposition);
    const textTokens = tokenize(req.authorityText);
    const propSet = new Set(propTokens);
    const overlap = Array.from(propSet).filter((t) => textTokens.includes(t)).length;
    const ratio = propSet.size === 0 ? 0 : overlap / propSet.size;

    let supports: MachineAssessedSupport['supports'];
    let confidence: MachineAssessedSupport['confidence'];
    if (ratio >= 0.6) {
      supports = 'supports';
      confidence = 'high';
    } else if (ratio >= 0.3) {
      supports = 'partially_supports';
      confidence = 'medium';
    } else if (ratio > 0) {
      supports = 'partially_supports';
      confidence = 'low';
    } else {
      supports = 'does_not_support';
      confidence = 'low';
    }
    return {
      authorityId: req.authority.authorityId,
      proposition: req.proposition,
      supports,
      confidence,
      basis: `keyword overlap ratio ${ratio.toFixed(2)}; deterministic stand-in (Wave 6)`,
    };
  }
}

const TOKEN_RE = /[a-z0-9]{3,}/gi;
function tokenize(s: string): string[] {
  return (s.toLowerCase().match(TOKEN_RE) ?? []).filter((t) => !STOPWORDS.has(t));
}
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'shall', 'that', 'this', 'from', 'are', 'has', 'have',
  'not', 'any', 'all', 'must', 'will', 'may', 'into', 'under', 'upon', 'whether',
  'such', 'between', 'about', 'because', 'said', 'who', 'whom', 'when', 'where',
]);
