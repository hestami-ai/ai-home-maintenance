/**
 * Minimal ULID generator for AODD event IDs.
 *
 * Per design memo §12 open question 1: ULID is the default for
 * `event_id` because lexicographic ordering preserves emission order
 * and makes payload file names useful (`payloads/<ulid>.json` sorts
 * chronologically). UUID v4 was considered and rejected as the default.
 *
 * This implementation is self-contained (no npm dependency) and
 * produces canonical ULIDs:
 *   - 26 characters total
 *   - first 10 chars: 48-bit unix-ms timestamp in Crockford Base32
 *   - last 16 chars: 80 bits of randomness in Crockford Base32
 *
 * If we later adopt the `ulid` npm package for monotonicity guarantees
 * or finer-grained randomness, swap this file's implementation; the
 * `mintUlid()` signature stays.
 */

import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(now: number, len = 10): string {
  let out = '';
  let n = now;
  for (let i = 0; i < len; i++) {
    const mod = n % 32;
    out = ALPHABET[mod] + out;
    n = (n - mod) / 32;
  }
  return out;
}

function encodeRandom(len = 16): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % 32];
  }
  return out;
}

/** Generate a new ULID. Always 26 chars. */
export function mintUlid(): string {
  return encodeTime(Date.now()) + encodeRandom();
}
