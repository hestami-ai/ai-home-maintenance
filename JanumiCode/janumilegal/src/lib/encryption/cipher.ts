/**
 * AES-256-GCM helpers.
 *
 * Per docs/design/governed_stream_privilege.md §5:
 *   - Symmetric envelope encryption.
 *   - Authenticated (GCM tag).
 *   - Unique nonce per encryption.
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export function generateKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

export interface EncryptedEnvelope {
  /** nonce (12) || ciphertext || tag (16) */
  readonly bytes: Buffer;
}

export function encrypt(key: Buffer, plaintext: Buffer | string): EncryptedEnvelope {
  if (key.length !== KEY_BYTES) throw new Error(`key must be ${KEY_BYTES} bytes`);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGO, key, nonce);
  const pt = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf8');
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { bytes: Buffer.concat([nonce, ct, tag]) };
}

export function decrypt(key: Buffer, envelope: EncryptedEnvelope): Buffer {
  if (key.length !== KEY_BYTES) throw new Error(`key must be ${KEY_BYTES} bytes`);
  const buf = envelope.bytes;
  if (buf.length < NONCE_BYTES + TAG_BYTES) throw new Error('envelope too short');
  const nonce = buf.subarray(0, NONCE_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);
  const ct = buf.subarray(NONCE_BYTES, buf.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}
