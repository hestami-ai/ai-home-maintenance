/**
 * Brief bank / clause library promotion.
 *
 * Per docs/janumilegal_multi_matter_isolation_addendum.md §5.3 §7.4:
 *   "Explicit clause-library or brief-bank artifacts that have been
 *    promoted, by attorney action, into a firm-wide knowledge layer with
 *    client-identifying content scrubbed at promotion time."
 *
 * Promotion is the ONLY sanctioned path by which matter content can become
 * firm-wide knowledge. The flow:
 *   1. Attorney supplies an AttorneyAction (Wave 7 will source from the
 *      attorney action model; Wave 6 takes a structured stand-in).
 *   2. Content is scrubbed for client-identifying tokens.
 *   3. Resulting scrubbed artifact lands in firm_knowledge_artifacts.
 *   4. Source matter records the export; receiving knowledge layer records
 *      the promotion. (Op-track event written.)
 */

import { randomUUID } from 'node:crypto';
import type { Scope } from '../database/types.js';
import type { BriefBankDal } from '../database/briefBankDal.js';
import type { OpStreamDal } from '../database/opStreamDal.js';

export interface AttorneyActionStub {
  readonly attorneyId: string;
  readonly attorneyActionId: string;
  readonly action: 'approved_for_firm_knowledge_promotion';
  readonly artifactVersionHash: string;
}

export interface PromotionRequest {
  readonly fromScope: Scope;
  readonly fromArtifactId: string;
  readonly fromArtifactType: string;
  readonly fromContent: string;
  readonly title: string;
  readonly attorneyAction: AttorneyActionStub;
  readonly clientIdentifyingTokens: readonly string[];
}

export interface PromotionResult {
  readonly knowledgeId: string;
  readonly contentScrubbed: string;
  readonly tokensRedactedCount: number;
}

export class BriefBankPromotionError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'BriefBankPromotionError';
  }
}

/**
 * Scrub client-identifying content. Wave 6 ships a token-replacement
 * scrubber; Wave 7+ adds NLP-based PII detection.
 */
export function scrubContent(content: string, tokens: readonly string[]): { scrubbed: string; redacted: number } {
  let out = content;
  let redacted = 0;
  for (const token of tokens) {
    if (!token.trim()) continue;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'gi');
    out = out.replace(re, () => {
      redacted++;
      return '[REDACTED]';
    });
  }
  return { scrubbed: out, redacted };
}

export class BriefBank {
  constructor(
    private readonly dal: BriefBankDal,
    private readonly opStream: OpStreamDal,
  ) {}

  promote(req: PromotionRequest): PromotionResult {
    if (req.attorneyAction.action !== 'approved_for_firm_knowledge_promotion') {
      throw new BriefBankPromotionError(
        `attorneyAction.action must be 'approved_for_firm_knowledge_promotion'`,
        'ATTORNEY_ACTION_INVALID',
      );
    }
    if (!req.clientIdentifyingTokens || req.clientIdentifyingTokens.length === 0) {
      throw new BriefBankPromotionError(
        `clientIdentifyingTokens must be a non-empty list (scrubbing is mandatory)`,
        'TOKENS_REQUIRED',
      );
    }
    const { scrubbed, redacted } = scrubContent(req.fromContent, req.clientIdentifyingTokens);

    const knowledgeId = randomUUID();
    this.dal.insert({
      knowledgeId,
      firmId: req.fromScope.firmId,
      title: req.title,
      artifactType: req.fromArtifactType,
      contentScrubbed: scrubbed,
      promotedFrom: { ...req.fromScope, artifactId: req.fromArtifactId },
      promotedAt: new Date().toISOString(),
      promotedByAttorneyId: req.attorneyAction.attorneyId,
      promotedByAttorneyActionId: req.attorneyAction.attorneyActionId,
    });

    // Op-track: metadata only, no content
    this.opStream.write({
      eventType: 'export_recorded',
      firmId: req.fromScope.firmId,
      payload: {
        kind: 'brief_bank_promotion',
        knowledgeId,
        fromArtifactType: req.fromArtifactType,
        tokensRedactedCount: redacted,
        attorneyActionId: req.attorneyAction.attorneyActionId,
      },
    });

    return { knowledgeId, contentScrubbed: scrubbed, tokensRedactedCount: redacted };
  }
}
