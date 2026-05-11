/**
 * Telemetry / regression auditor.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 8 §8.5.
 *
 * Aggregates op-track + gold-matter + activation data into the metrics
 * the roadmap tracks at scale:
 *
 *   - required-state completion rate
 *   - unsafe release rate
 *   - unsupported claim rate (silent-pruning rate proxy)
 *   - silent pruning rate
 *   - authority verification false-confidence rate
 *   - attorney packet usefulness score (manual; placeholder)
 *   - cross-matter operation audit count
 *   - screened-matter surfacing audit count
 *
 * The auditor produces a `TelemetryReport` consumable by CI and
 * dashboard surfaces.
 */

import { randomUUID } from 'node:crypto';
import type { OpStreamDal } from '../database/opStreamDal.js';

export interface TelemetryReport {
  readonly reportId: string;
  readonly producedAt: string;
  readonly firmId: string;
  readonly metrics: TelemetryMetrics;
  readonly auditCounts: TelemetryAuditCounts;
}

export interface TelemetryMetrics {
  readonly requiredStateCompletionRate: number;
  readonly unsafeReleaseCount: number;
  readonly silentPruningCount: number;
  readonly falseConfidenceCount: number;
  readonly stateStartedCount: number;
  readonly stateCompletedCount: number;
  readonly stateBlockedCount: number;
  readonly stateEscalatedCount: number;
}

export interface TelemetryAuditCounts {
  readonly crossMatterOperations: number;
  readonly matterContextSwitches: number;
  readonly mistakenMatterSurfacings: number;
}

export class TelemetryAuditor {
  constructor(private readonly opStream: OpStreamDal) {}

  audit(firmId: string): TelemetryReport {
    const stateStartedCount = this.opStream.countByType(firmId, 'state_started');
    const stateCompletedCount = this.opStream.countByType(firmId, 'state_completed');
    const stateBlockedCount = this.opStream.countByType(firmId, 'state_blocked');
    const stateEscalatedCount = this.opStream.countByType(firmId, 'state_escalated');

    const requiredStateCompletionRate = stateStartedCount === 0
      ? 1
      : stateCompletedCount / stateStartedCount;

    return {
      reportId: randomUUID(),
      producedAt: new Date().toISOString(),
      firmId,
      metrics: {
        requiredStateCompletionRate,
        unsafeReleaseCount: 0, // Wave 9: derive from export_records + release_status mismatches
        silentPruningCount: 0, // Wave 9: derive from pruning_decision_recorded events with empty reason (which IssuePruneService refuses)
        falseConfidenceCount: 0, // Wave 9: derive from artifact metadata claiming attorney_confirmed without an action
        stateStartedCount,
        stateCompletedCount,
        stateBlockedCount,
        stateEscalatedCount,
      },
      auditCounts: {
        crossMatterOperations: this.opStream.countByType(firmId, 'export_recorded'),
        matterContextSwitches: this.opStream.countByType(firmId, 'matter_context_switched'),
        mistakenMatterSurfacings: 0, // Wave 9: alarm-typed events from matter-track writer
      },
    };
  }
}
