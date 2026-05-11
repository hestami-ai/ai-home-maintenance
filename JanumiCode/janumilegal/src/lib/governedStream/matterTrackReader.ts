/**
 * Matter-track reader.
 *
 * Per docs/design/governed_stream_privilege.md §7.
 *
 * Reads are classification-aware: the reader decrypts each event with the
 * appropriate per-matter key (content key for most classifications; mental
 * key for work_product_mental). The caller declares which classifications
 * they're authorized to read; events outside that set are returned with
 * encrypted payloads and a `redacted: true` flag.
 *
 * The reader does not enforce user authorization itself — it provides a
 * mechanism. Caller-side enforcement applies UserMatterAccess policy
 * (multi-matter §4) before invoking the reader.
 */

import { decrypt } from '../encryption/cipher.js';
import type { MatterTrackEventRow, MatterTrackStore } from './matterTrackStore.js';
import { usesMentalKey, type MatterTrackClassification } from './classifications.js';

export interface DecryptedMatterEvent {
  readonly eventId: string;
  readonly classification: MatterTrackClassification;
  readonly eventType: string;
  readonly writtenAt: string;
  readonly userId: string | null;
  readonly stateId: string | null;
  readonly correlationId: string | null;
  readonly clvScope: readonly string[];
  readonly privilegeFrameRef: string;
  readonly payload: Record<string, unknown> | null;
  readonly redacted: boolean;
  readonly redactionReason?: string;
}

export class MatterTrackReader {
  constructor(
    private readonly store: MatterTrackStore,
    private readonly contentKey: Buffer,
    private readonly mentalKey: Buffer,
  ) {}

  read(filter: {
    authorizedClassifications: readonly MatterTrackClassification[];
    classification?: MatterTrackClassification;
  }): DecryptedMatterEvent[] {
    const authorized = new Set(filter.authorizedClassifications);
    const rows = this.store.listEvents({ classification: filter.classification });
    return rows.map((r) => this.decode(r, authorized));
  }

  private decode(row: MatterTrackEventRow, authorized: Set<MatterTrackClassification>): DecryptedMatterEvent {
    const base = {
      eventId: row.eventId,
      classification: row.classification,
      eventType: row.eventType,
      writtenAt: row.writtenAt,
      userId: row.userId,
      stateId: row.stateId,
      correlationId: row.correlationId,
      clvScope: JSON.parse(row.clvScopeJson) as string[],
      privilegeFrameRef: row.privilegeFrameRef,
    };

    if (!authorized.has(row.classification)) {
      return {
        ...base,
        payload: null,
        redacted: true,
        redactionReason: `caller not authorized for classification '${row.classification}'`,
      };
    }

    try {
      const key = usesMentalKey(row.classification) ? this.mentalKey : this.contentKey;
      const plaintext = decrypt(key, { bytes: row.payloadEnvelope });
      return {
        ...base,
        payload: JSON.parse(plaintext.toString('utf8')) as Record<string, unknown>,
        redacted: false,
      };
    } catch (err) {
      return {
        ...base,
        payload: null,
        redacted: true,
        redactionReason: `decryption failed: ${(err as Error).message}`,
      };
    }
  }
}
