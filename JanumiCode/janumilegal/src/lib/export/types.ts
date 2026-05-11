/**
 * Export types.
 *
 * Per docs/design/governed_stream_privilege.md §8.
 */

import type { Scope } from '../database/types.js';
import type { MatterTrackClassification } from '../governedStream/classifications.js';

export type ExportPurpose =
  | 'discovery_production_party'
  | 'subpoena_third_party'
  | 'client_file_transfer'
  | 'malpractice_defense'
  | 'disciplinary_response'
  | 'court_in_camera'
  | 'internal_audit'
  | 'client_request';

export interface ExportRequest {
  readonly scope: Scope;
  readonly purpose: ExportPurpose;
  readonly requestedBy: string;
  /** Override the default redaction policy for this purpose (requires documented basis). */
  readonly classificationOverride?: readonly MatterTrackClassification[];
  readonly overrideBasis?: string;
}

export interface PrivilegeLogEntry {
  readonly eventId: string;
  readonly date: string;
  readonly classification: MatterTrackClassification;
  readonly subjectLine: string;
  readonly basis: string;
}

export interface ExportPackage {
  readonly exportId: string;
  readonly scope: Scope;
  readonly purpose: ExportPurpose;
  readonly producedAt: string;
  readonly includedClassifications: readonly MatterTrackClassification[];
  readonly excludedClassifications: readonly MatterTrackClassification[];
  readonly events: readonly ExportedEvent[];
  readonly privilegeLog: readonly PrivilegeLogEntry[];
  readonly packageHash: string;
}

export interface ExportedEvent {
  readonly eventId: string;
  readonly classification: MatterTrackClassification;
  readonly eventType: string;
  readonly writtenAt: string;
  readonly clvScope: readonly string[];
  readonly payload: Record<string, unknown>;
}
