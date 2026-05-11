/**
 * Privilege classifications + scope binding for matter-track events.
 *
 * Per docs/design/governed_stream_privilege.md §4 §6.
 */

export const STREAM_CLASSIFICATIONS = [
  'op_metadata',
  'work_product_factual',
  'work_product_mental',
  'attorney_client',
  'client_confidential',
  'public_record',
] as const;
export type StreamClassification = (typeof STREAM_CLASSIFICATIONS)[number];

/** Matter-track classifications (op_metadata lives only on the operational track). */
export const MATTER_TRACK_CLASSIFICATIONS = [
  'work_product_factual',
  'work_product_mental',
  'attorney_client',
  'client_confidential',
  'public_record',
] as const;
export type MatterTrackClassification = (typeof MATTER_TRACK_CLASSIFICATIONS)[number];

export function isMatterTrackClassification(c: StreamClassification): c is MatterTrackClassification {
  return c !== 'op_metadata';
}

export function usesMentalKey(c: MatterTrackClassification): boolean {
  return c === 'work_product_mental';
}
