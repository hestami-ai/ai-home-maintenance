/**
 * Key hierarchy.
 *
 * Per docs/design/governed_stream_privilege.md §5:
 *
 *   firm_key
 *     └── client_wrap_key       (per client; wrapped by firm_key)
 *           └── matter_content_key   (per matter)
 *           └── matter_mental_key    (per matter; separate from content key)
 *
 * Wave 3 implementation:
 *   - Firm key: supplied via constructor (production: KMS / OS keychain).
 *   - Client wrap key: derived deterministically from (firm_key, client_id).
 *   - Matter content/mental keys: random; wrapped by client wrap key; persisted.
 *   - Compromise containment is per the design: a single matter's leak does not
 *     cascade across other matters; mental sub-segment uses a separate key
 *     even within the same matter.
 *
 * Wave 9 hardening: real KMS integration, key rotation, audit of key access.
 */

import { hkdfSync } from 'node:crypto';
import { encrypt, decrypt, generateKey, type EncryptedEnvelope } from './cipher.js';
import type { Scope } from '../database/types.js';
import type { MatterKeysDal } from '../database/matterKeysDal.js';

export class KeyHierarchyError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'KeyHierarchyError';
  }
}

/**
 * Firm key holder. The firm key never leaves this object once instantiated.
 * In production, the constructor receives the key from a secrets layer
 * (KMS, OS keychain). Tests instantiate with a generated key.
 */
export class FirmKey {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) throw new KeyHierarchyError('firm key must be 32 bytes', 'FIRM_KEY_SIZE');
  }

  /** Derive a per-client wrap key from the firm key + clientId. Deterministic. */
  deriveClientWrapKey(firmId: string, clientId: string): Buffer {
    const salt = Buffer.from(`firm:${firmId}|client:${clientId}`, 'utf8');
    const ikm = this.key;
    const info = Buffer.from('janumilegal.client_wrap_key.v1', 'utf8');
    const out = hkdfSync('sha256', ikm, salt, info, 32);
    return Buffer.from(out);
  }

  /** Wrap arbitrary bytes (e.g., a matter content key) with a client wrap key. */
  wrapWithClientKey(clientWrapKey: Buffer, plaintext: Buffer): EncryptedEnvelope {
    return encrypt(clientWrapKey, plaintext);
  }

  unwrapWithClientKey(clientWrapKey: Buffer, envelope: EncryptedEnvelope): Buffer {
    return decrypt(clientWrapKey, envelope);
  }
}

export interface MatterKeys {
  /** AES-256 key for work_product_factual, attorney_client, client_confidential, public_record. */
  readonly contentKey: Buffer;
  /** AES-256 key for work_product_mental — separate per privilege design §5.2. */
  readonly mentalKey: Buffer;
}

export class MatterKeyService {
  constructor(
    private readonly dal: MatterKeysDal,
    private readonly firmKey: FirmKey,
  ) {}

  /**
   * Provision a fresh pair of matter keys, wrap with client key, persist.
   * Throws if matter_keys row already exists for this scope.
   */
  provision(scope: Scope): MatterKeys {
    const clientWrap = this.firmKey.deriveClientWrapKey(scope.firmId, scope.clientId);
    const contentKey = generateKey();
    const mentalKey = generateKey();
    const contentEnv = this.firmKey.wrapWithClientKey(clientWrap, contentKey);
    const mentalEnv = this.firmKey.wrapWithClientKey(clientWrap, mentalKey);
    this.dal.insert(scope, { contentKeyEnvelope: contentEnv.bytes, mentalKeyEnvelope: mentalEnv.bytes });
    return { contentKey, mentalKey };
  }

  /** Load + unwrap matter keys for a scope. Throws if not provisioned. */
  load(scope: Scope): MatterKeys {
    const row = this.dal.get(scope);
    if (!row) {
      throw new KeyHierarchyError(`matter keys not provisioned for ${scope.firmId}/${scope.clientId}/${scope.matterId}`, 'KEYS_NOT_PROVISIONED');
    }
    const clientWrap = this.firmKey.deriveClientWrapKey(scope.firmId, scope.clientId);
    const contentKey = this.firmKey.unwrapWithClientKey(clientWrap, { bytes: row.contentKeyEnvelope });
    const mentalKey = this.firmKey.unwrapWithClientKey(clientWrap, { bytes: row.mentalKeyEnvelope });
    return { contentKey, mentalKey };
  }

  has(scope: Scope): boolean {
    return this.dal.has(scope);
  }
}
