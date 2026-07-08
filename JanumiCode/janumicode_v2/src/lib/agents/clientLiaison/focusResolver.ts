/**
 * focusResolver — resolve a card/item anchor to governed-stream record ids
 * that seed DMR retrieval (RetrievalBrief.knownRelevantRecordIds) for a
 * Card ASK sub-chat. Pre-seeding the anchor's record biases DMR's
 * neighborhood expansion (Stage-4 relationship walk) toward the item the
 * user is asking about, so a scoped question gets a scoped, grounded answer.
 *
 * Resolution order:
 *   1. If the anchor carries a record id (the card knows its own record),
 *      that id IS the seed.
 *   2. Otherwise, if only a semantic item id is known (e.g. "US-003"),
 *      best-effort locate its record(s) via FTS so a Card ASK still anchors.
 *
 * Never throws — an unresolvable anchor simply yields no seed and the query
 * degrades to an ordinary (un-anchored) retrieval.
 */

import type { ClientLiaisonDB } from './db';
import type { LiaisonAnchor } from './types';

export function resolveAnchorSeed(
  anchor: LiaisonAnchor | undefined,
  db: ClientLiaisonDB,
  workflowRunId?: string | null,
): string[] {
  if (!anchor) return [];
  const ids = new Set<string>();
  if (anchor.recordId) ids.add(anchor.recordId);
  if (!anchor.recordId && anchor.itemId) {
    try {
      const hits = db.ftsSearch(anchor.itemId, {
        workflowRunId: workflowRunId ?? undefined,
        limit: 3,
      });
      for (const h of hits) ids.add(h.id);
    } catch {
      // Best-effort — an unresolvable item id just yields no seed.
    }
  }
  return [...ids];
}
