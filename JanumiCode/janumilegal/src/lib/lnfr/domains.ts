/**
 * LNFR (Legal Non-Functional Requirements) domains.
 *
 * Per docs/janumilegal_product_description_evolution.md §5.2 and
 * docs/janumilegal_implementation_roadmap.md Wave 8 §8.1.
 *
 * LNFRs are cross-cutting legal concerns owned by the matter (not by any
 * single lens). Each domain produces gate inputs the Release Gate Evaluator
 * consumes; an LNFR gate failure blocks release even when lens-internal
 * validators pass.
 */

export const LNFR_DOMAINS = [
  'privilege',                  // attorney-client, work product, joint defense, common interest
  'candor_to_tribunal',
  'conflicts_of_interest',
  'unauthorized_practice_of_law',
  'jurisdictional_admission',
  'confidentiality',
  'deadlines_and_limitations',
  'retention_and_records',
  'malpractice_exposure',
  'billing_and_engagement_scope',
  'sanctions_risk',
  'competence',
  'supervisory_responsibility',
] as const;
export type LNFRDomain = (typeof LNFR_DOMAINS)[number];

/** True iff a string is a recognized LNFR domain. */
export function isLnfrDomain(s: string): s is LNFRDomain {
  return (LNFR_DOMAINS as readonly string[]).includes(s);
}
