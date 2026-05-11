/**
 * Privilege / Work-Product Classifier.
 *
 * Per docs/janumilegal_product_description.md §Tier 10 #46 and
 * docs/design/governed_stream_privilege.md §4.1.
 *
 * Classification rules at write time:
 *
 *   - The caller may declare a classification explicitly (preferred when the
 *     event semantics are unambiguous, e.g., MMP submissions).
 *   - Otherwise the classifier inspects eventType + payload heuristics.
 *   - When uncertain between work_product_factual and work_product_mental,
 *     defaults to work_product_mental (most restrictive of substantive classes).
 *   - op_metadata classification on a matter-track write is rejected — the
 *     caller is told to write to the operational track instead.
 *
 * Wave 3 ships deterministic classification. Wave 6+ may add an LLM-backed
 * reviewer that audits the classifier's output, but the LLM never overrides
 * a deterministic non-default classification.
 */

import type { MatterTrackClassification, StreamClassification } from './classifications.js';

export interface ClassificationInput {
  readonly eventType: string;
  readonly declaredClassification?: StreamClassification;
  /** Indicates the event payload is a client communication (intake message, advice, etc.). */
  readonly isClientCommunication?: boolean;
  /** Indicates the payload contains attorney mental impressions / strategy. */
  readonly carriesMentalImpressions?: boolean;
  /** Indicates the payload is a publicly-filed pleading or other public-record content. */
  readonly isPublicRecord?: boolean;
}

export interface ClassificationResult {
  readonly classification: MatterTrackClassification;
  readonly basis: 'declared' | 'rule' | 'default';
  readonly note?: string;
}

const MENTAL_EVENT_TYPES = new Set<string>([
  'mmp_card_submitted',
  'mmp_card_drafted',
  'pruning_decision_recorded',
  'attorney_commentary',
  'strategy_note',
  'adverse_argument_generated',
  'shortcut_finding',
  'too_clever_finding',
  'review_critique',
  'intent_drift_finding',
]);

const FACTUAL_EVENT_TYPES = new Set<string>([
  'fact_extracted',
  'timeline_entry_added',
  'source_ingested',
  'source_inventoried',
  'authority_retrieved',
  'citation_extracted',
  'rule_element_mapped',
  'fact_to_rule_mapped',
]);

const ATTORNEY_CLIENT_EVENT_TYPES = new Set<string>([
  'client_message_received',
  'client_advice_drafted',
  'client_communication_recorded',
]);

const PUBLIC_RECORD_EVENT_TYPES = new Set<string>([
  'filed_pleading_recorded',
  'public_authority_referenced',
  'public_rule_referenced',
]);

const CLIENT_CONFIDENTIAL_EVENT_TYPES = new Set<string>([
  'client_document_inventoried',
  'protective_order_subject',
]);

export class PrivilegeClassifier {
  classify(input: ClassificationInput): ClassificationResult {
    if (input.declaredClassification) {
      if (input.declaredClassification === 'op_metadata') {
        throw new Error('op_metadata is not a matter-track classification — write to operational track');
      }
      return { classification: input.declaredClassification as MatterTrackClassification, basis: 'declared' };
    }

    if (input.carriesMentalImpressions) {
      return { classification: 'work_product_mental', basis: 'rule', note: 'caller flagged mental impressions' };
    }
    if (input.isPublicRecord) {
      return { classification: 'public_record', basis: 'rule', note: 'caller flagged public record' };
    }
    if (input.isClientCommunication) {
      return { classification: 'attorney_client', basis: 'rule', note: 'caller flagged client communication' };
    }

    if (MENTAL_EVENT_TYPES.has(input.eventType)) {
      return { classification: 'work_product_mental', basis: 'rule' };
    }
    if (FACTUAL_EVENT_TYPES.has(input.eventType)) {
      return { classification: 'work_product_factual', basis: 'rule' };
    }
    if (ATTORNEY_CLIENT_EVENT_TYPES.has(input.eventType)) {
      return { classification: 'attorney_client', basis: 'rule' };
    }
    if (PUBLIC_RECORD_EVENT_TYPES.has(input.eventType)) {
      return { classification: 'public_record', basis: 'rule' };
    }
    if (CLIENT_CONFIDENTIAL_EVENT_TYPES.has(input.eventType)) {
      return { classification: 'client_confidential', basis: 'rule' };
    }

    // Default — most restrictive of substantive classes
    return {
      classification: 'work_product_mental',
      basis: 'default',
      note: 'classifier could not match eventType; defaulted to work_product_mental (most restrictive)',
    };
  }
}
