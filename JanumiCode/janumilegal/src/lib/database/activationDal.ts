/**
 * Activation DAL — manages matter_lens_activations and state_outputs.
 *
 * Scoped per matter; consumers must supply scope on every call.
 */

import type Database from 'better-sqlite3';
import type { Scope } from './types.js';

export interface ActivationRow {
  activationId: string;
  lensId: string;
  lensVersion: string;
  activatedAt: string;
  deactivatedAt: string | null;
}

export interface StateOutputRow {
  activationId: string;
  stateId: string;
  outputJson: string;
  outputHash: string;
  completedAt: string;
}

export class ActivationDal {
  constructor(private readonly db: Database.Database) {}

  insertActivation(args: {
    scope: Scope;
    activationId: string;
    lensId: string;
    lensVersion: string;
    activatedBy: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO matter_lens_activations
         (firm_id, client_id, matter_id, activation_id, lens_id, lens_version, activated_by, activated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        args.scope.firmId,
        args.scope.clientId,
        args.scope.matterId,
        args.activationId,
        args.lensId,
        args.lensVersion,
        args.activatedBy,
        new Date().toISOString(),
      );
  }

  getActivation(scope: Scope, activationId: string): ActivationRow | undefined {
    const row = this.db
      .prepare(
        `SELECT activation_id, lens_id, lens_version, activated_at, deactivated_at
         FROM matter_lens_activations
         WHERE firm_id = ? AND client_id = ? AND matter_id = ? AND activation_id = ?`,
      )
      .get(scope.firmId, scope.clientId, scope.matterId, activationId) as
      | { activation_id: string; lens_id: string; lens_version: string; activated_at: string; deactivated_at: string | null }
      | undefined;
    if (!row) return undefined;
    return {
      activationId: row.activation_id,
      lensId: row.lens_id,
      lensVersion: row.lens_version,
      activatedAt: row.activated_at,
      deactivatedAt: row.deactivated_at,
    };
  }

  insertStateOutput(args: { scope: Scope; activationId: string; stateId: string; outputJson: string; outputHash: string }): void {
    this.db
      .prepare(
        `INSERT INTO state_outputs
         (firm_id, client_id, matter_id, activation_id, state_id, output_json, output_hash, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        args.scope.firmId,
        args.scope.clientId,
        args.scope.matterId,
        args.activationId,
        args.stateId,
        args.outputJson,
        args.outputHash,
        new Date().toISOString(),
      );
  }

  listCompletedStates(scope: Scope, activationId: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT state_id FROM state_outputs
         WHERE firm_id = ? AND client_id = ? AND matter_id = ? AND activation_id = ?
         ORDER BY completed_at`,
      )
      .all(scope.firmId, scope.clientId, scope.matterId, activationId) as Array<{ state_id: string }>;
    return rows.map((r) => r.state_id);
  }

  getStateOutput(scope: Scope, activationId: string, stateId: string): StateOutputRow | undefined {
    const row = this.db
      .prepare(
        `SELECT activation_id, state_id, output_json, output_hash, completed_at
         FROM state_outputs
         WHERE firm_id = ? AND client_id = ? AND matter_id = ? AND activation_id = ? AND state_id = ?`,
      )
      .get(scope.firmId, scope.clientId, scope.matterId, activationId, stateId) as
      | { activation_id: string; state_id: string; output_json: string; output_hash: string; completed_at: string }
      | undefined;
    if (!row) return undefined;
    return {
      activationId: row.activation_id,
      stateId: row.state_id,
      outputJson: row.output_json,
      outputHash: row.output_hash,
      completedAt: row.completed_at,
    };
  }
}
