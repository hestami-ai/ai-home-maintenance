/**
 * Mechanical checks for authorities.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 6 §6.2:
 *   "Mechanical checks: citation format (Eyecite), source presence,
 *    quote matching, pinpoint existence, statute section existence,
 *    document section existence."
 *
 * Mechanical checks are deterministic. They never assert that the authority
 * supports a proposition; that's a separate machine-assessed check.
 */

import { parseCitation } from './eyecite.js';
import type { AuthorityRef, MechanicalCheckResult } from './types.js';

export interface SourceProvider {
  /** Returns the full text of a source authority, or undefined if not in corpus. */
  getSourceText(authorityId: string): string | undefined;
}

export interface MechanicalCheckRequest {
  readonly authority: AuthorityRef;
  readonly quotedSpan?: string;
  readonly pinpoint?: string;
  readonly statuteSection?: string;
}

export class MechanicalCheckRunner {
  constructor(private readonly source: SourceProvider) {}

  check(req: MechanicalCheckRequest): MechanicalCheckResult {
    const notes: string[] = [];
    const parsed = parseCitation(req.authority.citation);
    if (!parsed.parseOk) {
      notes.push(`citation did not parse: ${parsed.parseErrors?.join('; ')}`);
    }
    const text = this.source.getSourceText(req.authority.authorityId);
    const sourceLocated = text !== undefined;
    if (!sourceLocated) notes.push('source not in corpus');

    let quoteMatched: boolean | undefined;
    if (req.quotedSpan) {
      quoteMatched = sourceLocated ? text!.includes(req.quotedSpan) : false;
      if (!quoteMatched) notes.push('quoted span not found in source');
    }

    let pinpointExists: boolean | undefined;
    if (req.pinpoint) {
      pinpointExists = sourceLocated ? text!.includes(req.pinpoint) : false;
      if (!pinpointExists) notes.push(`pinpoint '${req.pinpoint}' not found`);
    }

    let statuteSectionExists: boolean | undefined;
    if (req.statuteSection) {
      statuteSectionExists = sourceLocated ? text!.includes(req.statuteSection) : false;
      if (!statuteSectionExists) notes.push(`statute section '${req.statuteSection}' not found`);
    }

    return {
      authorityId: req.authority.authorityId,
      citationParsed: parsed.parseOk,
      sourceLocated,
      quoteMatched,
      pinpointExists,
      statuteSectionExists,
      notes,
    };
  }
}

/** In-memory source provider — used in tests and as a fallback. */
export class InMemorySourceProvider implements SourceProvider {
  private readonly map = new Map<string, string>();
  set(authorityId: string, text: string): void {
    this.map.set(authorityId, text);
  }
  getSourceText(authorityId: string): string | undefined {
    return this.map.get(authorityId);
  }
}
