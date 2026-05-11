/**
 * Matter-scoped exporter.
 *
 * Per docs/design/governed_stream_privilege.md §8.
 *
 * Architectural floors enforced here:
 *   - matter-scoped only (no platform-wide bulk export);
 *   - classification-filtered package; events outside the inclusion set are
 *     never decrypted into the package, and a privilege log entry is produced
 *     for each excluded event;
 *   - export record written to operational track only (no matter-track event);
 *   - the produced package is returned to the caller; the platform does NOT
 *     persist the package itself, only the export record.
 */

import { createHash, randomUUID } from 'node:crypto';
import type { Scope } from '../database/types.js';
import type { OpStreamDal } from '../database/opStreamDal.js';
import type { ExportDal } from '../database/exportDal.js';
import { MatterTrackReader } from '../governedStream/matterTrackReader.js';
import type { MatterTrackStore } from '../governedStream/matterTrackStore.js';
import type { MatterTrackClassification } from '../governedStream/classifications.js';
import { defaultExclusions, defaultInclusions } from './redactionPolicy.js';
import type {
  ExportPackage,
  ExportPurpose,
  ExportRequest,
  ExportedEvent,
  PrivilegeLogEntry,
} from './types.js';

const PRIVILEGE_BASIS: Record<MatterTrackClassification, string> = {
  work_product_factual: 'attorney work product (factual)',
  work_product_mental: 'attorney work product (opinion/mental impressions)',
  attorney_client: 'attorney-client privilege',
  client_confidential: 'client confidentiality',
  public_record: 'no privilege basis (public record); excluded by other policy',
};

export class MatterExporter {
  constructor(
    private readonly exportDal: ExportDal,
    private readonly opStream: OpStreamDal,
    private readonly contentKey: Buffer,
    private readonly mentalKey: Buffer,
    private readonly store: MatterTrackStore,
  ) {}

  exportMatter(req: ExportRequest): ExportPackage {
    const inclusions = req.classificationOverride ?? defaultInclusions(req.purpose);
    const exclusions = computeExclusions(req.purpose, inclusions);

    if (req.classificationOverride && !req.overrideBasis) {
      throw new Error('classificationOverride requires overrideBasis (documented basis)');
    }

    // Reader: authorize ALL classifications so we can decode everything
    // for inclusion/exclusion bookkeeping. Excluded classifications still
    // produce privilege-log entries with metadata only.
    const reader = new MatterTrackReader(this.store, this.contentKey, this.mentalKey);
    const allEvents = reader.read({
      authorizedClassifications: ['work_product_factual', 'work_product_mental', 'attorney_client', 'client_confidential', 'public_record'],
    });

    const included: ExportedEvent[] = [];
    const log: PrivilegeLogEntry[] = [];
    for (const e of allEvents) {
      if (inclusions.includes(e.classification)) {
        included.push({
          eventId: e.eventId,
          classification: e.classification,
          eventType: e.eventType,
          writtenAt: e.writtenAt,
          clvScope: e.clvScope,
          payload: e.payload ?? {},
        });
      } else {
        log.push({
          eventId: e.eventId,
          date: e.writtenAt,
          classification: e.classification,
          subjectLine: deriveSubjectLine(e.eventType, e.clvScope),
          basis: PRIVILEGE_BASIS[e.classification],
        });
      }
    }

    const exportId = randomUUID();
    const producedAt = new Date().toISOString();
    const packageHash = hashPackage(req.scope, included, log, producedAt);

    const pkg: ExportPackage = {
      exportId,
      scope: req.scope,
      purpose: req.purpose,
      producedAt,
      includedClassifications: inclusions,
      excludedClassifications: exclusions,
      events: included,
      privilegeLog: log,
      packageHash,
    };

    // Persist export record via DAL (matter-scoped domain table)
    this.exportDal.insert({
      exportId,
      scope: req.scope,
      purpose: req.purpose,
      requestedBy: req.requestedBy,
      classificationFilter: inclusions,
      redactionSummary: { excludedCount: log.length, perClassification: countByClassification(log) },
      packageHash,
      exportedAt: producedAt,
    });

    // Op-track (no client identifying content; no payload)
    this.opStream.write({
      eventType: 'export_recorded',
      firmId: req.scope.firmId,
      payload: {
        exportId,
        purpose: req.purpose,
        includedClassificationCount: inclusions.length,
        privilegeLogEntryCount: log.length,
        packageHash,
      },
    });

    return pkg;
  }
}

function computeExclusions(
  purpose: ExportPurpose,
  inclusions: readonly MatterTrackClassification[],
): readonly MatterTrackClassification[] {
  const all: readonly MatterTrackClassification[] = ['work_product_factual', 'work_product_mental', 'attorney_client', 'client_confidential', 'public_record'];
  const incl = new Set(inclusions);
  const computed = all.filter((c) => !incl.has(c));
  // Sanity: when no override, exclusions should equal default
  if (inclusions === defaultInclusions(purpose)) {
    return defaultExclusions(purpose);
  }
  return computed;
}

function deriveSubjectLine(eventType: string, clvScope: readonly string[]): string {
  const scopeHint = clvScope.length > 0 ? clvScope.map((t) => t.split('.').slice(-2).join('.')).join(',') : 'unscoped';
  return `${eventType} [${scopeHint}]`;
}

function countByClassification(log: readonly PrivilegeLogEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of log) out[e.classification] = (out[e.classification] ?? 0) + 1;
  return out;
}

function hashPackage(scope: Scope, events: readonly ExportedEvent[], log: readonly PrivilegeLogEntry[], producedAt: string): string {
  const h = createHash('sha256');
  h.update(`${scope.firmId}|${scope.clientId}|${scope.matterId}|${producedAt}`);
  for (const e of events) {
    h.update('|e:');
    h.update(e.eventId);
  }
  for (const e of log) {
    h.update('|p:');
    h.update(e.eventId);
  }
  return h.digest('hex');
}
