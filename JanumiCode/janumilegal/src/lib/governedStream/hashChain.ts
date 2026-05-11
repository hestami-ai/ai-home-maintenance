/**
 * Hash chain helpers.
 *
 * Per docs/design/governed_stream_privilege.md §6.3:
 *   "A hash chain runs per (matterId, classification) — five chains per matter.
 *    Tampering with any past event breaks the chain."
 *
 * The chain hash for an event is sha256(prev_event_hash || payload_envelope).
 * The chain head is the latest event's payload_hash.
 */

import { createHash } from 'node:crypto';

export function computePayloadHash(prevEventHash: string, payloadEnvelope: Buffer): string {
  const h = createHash('sha256');
  h.update(prevEventHash);
  h.update('|');
  h.update(payloadEnvelope);
  return h.digest('hex');
}
