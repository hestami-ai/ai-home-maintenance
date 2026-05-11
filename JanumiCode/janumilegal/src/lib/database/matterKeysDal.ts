/**
 * Matter keys persistence (DAL).
 *
 * Stores wrapped per-matter content + mental key envelopes.
 */

import type Database from 'better-sqlite3';
import type { Scope } from './types.js';

export interface MatterKeyEnvelopes {
  contentKeyEnvelope: Buffer;
  mentalKeyEnvelope: Buffer;
}

export class MatterKeysDal {
  constructor(private readonly db: Database.Database) {}

  insert(scope: Scope, env: MatterKeyEnvelopes): void {
    this.db
      .prepare(
        `INSERT INTO matter_keys (firm_id, client_id, matter_id, content_key_envelope, mental_key_envelope, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(scope.firmId, scope.clientId, scope.matterId, env.contentKeyEnvelope, env.mentalKeyEnvelope, new Date().toISOString());
  }

  get(scope: Scope): MatterKeyEnvelopes | undefined {
    const row = this.db
      .prepare('SELECT content_key_envelope, mental_key_envelope FROM matter_keys WHERE firm_id = ? AND client_id = ? AND matter_id = ?')
      .get(scope.firmId, scope.clientId, scope.matterId) as
      | { content_key_envelope: Buffer; mental_key_envelope: Buffer }
      | undefined;
    if (!row) return undefined;
    return { contentKeyEnvelope: row.content_key_envelope, mentalKeyEnvelope: row.mental_key_envelope };
  }

  has(scope: Scope): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM matter_keys WHERE firm_id = ? AND client_id = ? AND matter_id = ?')
      .get(scope.firmId, scope.clientId, scope.matterId);
    return !!row;
  }
}
