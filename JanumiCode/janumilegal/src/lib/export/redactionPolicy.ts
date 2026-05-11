/**
 * Default redaction policy by export purpose.
 *
 * Per docs/design/governed_stream_privilege.md §8.4.
 *
 * Returns the set of matter-track classifications EXCLUDED by default for the
 * given purpose. Attorneys may override with documented basis.
 */

import type { MatterTrackClassification } from '../governedStream/classifications.js';
import type { ExportPurpose } from './types.js';

const ALL_MATTER_TRACK: readonly MatterTrackClassification[] = [
  'work_product_factual',
  'work_product_mental',
  'attorney_client',
  'client_confidential',
  'public_record',
];

const DEFAULT_EXCLUSIONS: Record<ExportPurpose, readonly MatterTrackClassification[]> = {
  discovery_production_party: ['work_product_mental', 'attorney_client'],
  subpoena_third_party: ['work_product_mental', 'work_product_factual', 'attorney_client'],
  client_file_transfer: [], // entire-file rule (MD default)
  malpractice_defense: [], // in-house privilege; no exclusions to firm's own counsel
  disciplinary_response: [], // per disciplinary authority's order; default no exclusion
  court_in_camera: [],
  internal_audit: [],
  client_request: [], // per file-transfer rule
};

export function defaultExclusions(purpose: ExportPurpose): readonly MatterTrackClassification[] {
  return DEFAULT_EXCLUSIONS[purpose];
}

export function defaultInclusions(purpose: ExportPurpose): readonly MatterTrackClassification[] {
  const excl = new Set(defaultExclusions(purpose));
  return ALL_MATTER_TRACK.filter((c) => !excl.has(c));
}
