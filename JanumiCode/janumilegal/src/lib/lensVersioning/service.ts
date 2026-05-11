/**
 * Lens versioning + migration service.
 *
 * Per docs/janumilegal_product_description_evolution.md §10.
 *
 *   SAFE          : new version is a superset; advance without re-run.
 *   PARTIAL       : marks stale states; attorney must approve re-run.
 *   INCOMPATIBLE  : refuses without explicit force-migrate (recorded basis).
 */

import type { LensMigrationsDal } from '../database/lensMigrationsDal.js';
import type { OpStreamDal } from '../database/opStreamDal.js';
import type { Scope } from '../database/types.js';
import type { ActivationDal } from '../database/activationDal.js';
import type { MigrationResult } from './types.js';

export class MigrationError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export interface MigrateArgs {
  readonly scope: Scope;
  readonly activationId: string;
  readonly toVersion: string;
  readonly authorizedBy: string;
  readonly force?: boolean;
  readonly forceBasis?: string;
}

export class MigrationService {
  constructor(
    private readonly migrationsDal: LensMigrationsDal,
    private readonly activationDal: ActivationDal,
    private readonly opStream: OpStreamDal,
  ) {}

  migrate(args: MigrateArgs): MigrationResult {
    const activation = this.activationDal.getActivation(args.scope, args.activationId);
    if (!activation) {
      throw new MigrationError(`activation ${args.activationId} not found`, 'ACTIVATION_NOT_FOUND');
    }
    if (activation.lensVersion === args.toVersion) {
      throw new MigrationError(
        `activation already at version ${args.toVersion}`,
        'NO_CHANGE',
      );
    }
    const transition = this.migrationsDal.get(activation.lensId, activation.lensVersion, args.toVersion);
    if (!transition) {
      throw new MigrationError(
        `no declared migration from ${activation.lensVersion} to ${args.toVersion}`,
        'UNDECLARED_TRANSITION',
      );
    }

    if (transition.kind === 'INCOMPATIBLE' && !args.force) {
      this.recordOp(args, 'refused', transition.kind, []);
      return {
        status: 'refused',
        fromVersion: activation.lensVersion,
        toVersion: args.toVersion,
        staleStates: [],
        notes: [`incompatible: ${transition.incompatibilityReason ?? 'no reason given'}`, 'use force=true with documented basis'],
      };
    }

    if (transition.kind === 'INCOMPATIBLE' && args.force) {
      if (!args.forceBasis) {
        throw new MigrationError(`force migration requires forceBasis`, 'FORCE_BASIS_REQUIRED');
      }
      this.recordOp(args, 'force_migrated', transition.kind, transition.staleStates ?? []);
      return {
        status: 'force_migrated',
        fromVersion: activation.lensVersion,
        toVersion: args.toVersion,
        staleStates: transition.staleStates ?? [],
        notes: [`force-migrated despite INCOMPATIBLE; basis: ${args.forceBasis}`],
      };
    }

    if (transition.kind === 'PARTIAL') {
      this.recordOp(args, 'stale_marked', transition.kind, transition.staleStates ?? []);
      return {
        status: 'stale_marked',
        fromVersion: activation.lensVersion,
        toVersion: args.toVersion,
        staleStates: transition.staleStates ?? [],
        notes: ['states marked stale; attorney must approve re-run'],
      };
    }

    // SAFE
    this.recordOp(args, 'advanced', transition.kind, []);
    return {
      status: 'advanced',
      fromVersion: activation.lensVersion,
      toVersion: args.toVersion,
      staleStates: [],
      notes: ['safe upgrade; no states marked stale'],
    };
  }

  private recordOp(args: MigrateArgs, status: MigrationResult['status'], kind: string, staleStates: readonly string[]): void {
    this.opStream.write({
      eventType: 'lens_activation_started',
      firmId: args.scope.firmId,
      payload: {
        kind: 'lens_migration',
        activationId: args.activationId,
        toVersion: args.toVersion,
        migrationKind: kind,
        result: status,
        staleStateCount: staleStates.length,
        authorizedBy: args.authorizedBy,
      },
    });
  }
}
