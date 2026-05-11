/**
 * CLV v1 — Sections 10–13: Multi-matter tenancy, verification status,
 * release status, privilege classification.
 *
 * Authored from docs/clv/canonical_vocabulary_v1.md sections 10–13.
 */

import type { CanonicalVocabularyEntry } from '../types.js';

const V = 'v1';

export const SECTION_10_TENANCY: readonly CanonicalVocabularyEntry[] = [
  {
    termId: 'clv.core.matter.v1',
    canonicalName: 'matter',
    oneLineDefinition: 'A discrete legal engagement undertaken on behalf of a client (or jointly represented clients) within a firm.',
    longDefinition:
      'A matter is the workflow unit and the isolation unit. Each matter has a client (or joint set), a primary practice area, an active lens or lens stack, a procedural posture, a privilege frame, and a Governed Stream segment. A matter is the unit of attorney-client relationship for retention, billing, and conflicts purposes.',
    scope: 'core',
    allowedSynonyms: ['engagement', 'case'],
    prohibitedSynonyms: ['project', 'file'],
    exampleUsage: ['Matter ID is the third tier of the scope tuple.'],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.joint_representation.v1',
    canonicalName: 'joint representation',
    oneLineDefinition: 'A representation of two or more clients in the same matter, governed by informed-consent and conflict rules.',
    longDefinition:
      'Joint representation is a single engagement with multiple represented clients. It is permitted only with informed written consent (subject to ethics rules) and creates a shared privilege within the joint set; communications with one joint client are generally not privileged against the others. Conflict-emergence procedures are pre-defined.',
    scope: 'core',
    allowedSynonyms: ['joint engagement', 'multiple representation'],
    prohibitedSynonyms: ['common-interest representation'],
    jurisdictionVariants: {
      MD: 'MD Rule 19-301.7 governs.',
      VA: 'VA Rule 1.7 governs.',
      PA: 'PA Rule 1.7 governs.',
      DC: 'DC Rule 1.7 governs.',
    },
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.common_interest.v1',
    canonicalName: 'common-interest',
    oneLineDefinition: 'A privileged information-sharing relationship between separately represented parties with aligned legal interests.',
    longDefinition:
      'A common-interest privilege (also called joint-defense in criminal contexts) preserves privilege for communications among separately represented parties pursuing a common legal interest. Documented in a common-interest agreement; modeled in JanumiLegal as a CommonInterestLink with explicit shared artifacts.',
    scope: 'core',
    allowedSynonyms: ['common-interest privilege', 'joint-defense'],
    prohibitedSynonyms: ['joint representation'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.screen.v1',
    canonicalName: 'screen',
    oneLineDefinition: 'An ethical wall isolating a user from a matter.',
    longDefinition:
      'A screen is the structural and policy isolation that separates a user from all access to a matter. Screens arise from former-client conflicts, lateral-attorney conflicts, and other Rule-1.10/1.11/1.18-implicating circumstances. A screen is enforced at the data-access layer, not the UI layer.',
    scope: 'core',
    allowedSynonyms: ['ethical wall', 'ethical screen', 'conflict screen'],
    prohibitedSynonyms: ['block', 'filter'],
    jurisdictionVariants: {
      MD: 'MD has analogous screening rules; some require notice to former client and certifications.',
      VA: 'VA analogous.',
      PA: 'PA analogous.',
      DC: 'DC analogous.',
    },
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.active_matter_context.v1',
    canonicalName: 'active matter context',
    oneLineDefinition: "The matter currently in force in a user's session, against which all session actions are stamped.",
    longDefinition:
      "Exactly one active matter context is in force at any moment for any user session. All actions, writes, and reads inherit the active matter context. Switching is a deliberate, recorded event. Mismatch between active matter context and an action's target matter is an alarm condition.",
    scope: 'core',
    allowedSynonyms: ['active matter', 'session matter context'],
    prohibitedSynonyms: ['current matter'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.mistaken_matter_action.v1',
    canonicalName: 'mistaken-matter action',
    oneLineDefinition: 'An action discovered to have been performed under the wrong active matter context.',
    longDefinition:
      "A mistaken-matter action is the recovery flow for context errors. The recovery records the misattribution in both matters' streams, surfaces a remediation checklist, and triggers re-evaluation of any release gates affected.",
    scope: 'core',
    allowedSynonyms: ['misattributed action', 'wrong-matter action'],
    prohibitedSynonyms: ['error', 'mistake'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
];

const verifEntry = (suffix: string, name: string, oneLine: string, longDef: string): CanonicalVocabularyEntry => ({
  termId: `clv.core.${suffix}.v1`,
  canonicalName: name,
  oneLineDefinition: oneLine,
  longDefinition: longDef,
  scope: 'core',
  allowedSynonyms: [],
  prohibitedSynonyms: [],
  exampleUsage: [],
  exampleMisuse: [],
  version: V,
});

export const SECTION_11_VERIFICATION_STATUS: readonly CanonicalVocabularyEntry[] = [
  verifEntry('source_located', 'source located', 'Mechanical: the cited source is retrievable in the corpus.', 'Deterministic check that the cited source can be retrieved from the configured corpus. The lowest-tier verification status; does not imply the source supports the proposition.'),
  verifEntry('quote_matched', 'quote matched', 'Mechanical: a quoted span exists verbatim in the source.', 'Deterministic check that a quoted span appears verbatim in the cited source at the cited pinpoint. Does not assess whether the quoted text supports the proposition.'),
  verifEntry('machine_assessed_support', 'machine-assessed support', 'Probabilistic: an LLM/agent has evaluated whether the authority supports the proposition.', 'Probabilistic LLM/agent evaluation of whether a cited authority supports the asserted proposition. Never collapses with citator status. Never marked as attorney-confirmed.'),
  verifEntry('machine_assessed_treatment', 'machine-assessed treatment', "Probabilistic: an LLM/agent has classified an authority's treatment status.", "Probabilistic classification of treatment status — still good law, distinguished, criticized, overruled — produced by an LLM/agent or non-citator-grade tool. Distinct from citator-grade treatment until a commercial citator is wired."),
  verifEntry('citator_status', 'citator status', 'Status from a commercial or open-data citator, when available.', 'Citator-derived treatment status from a commercial product (Shepard\'s, KeyCite) or open-data source. Never collapsed with machine-assessed support or treatment. May be empty when no citator is wired for the jurisdiction.'),
  verifEntry('attorney_confirmation_required', 'attorney confirmation required', 'The artifact has been machine-assessed but requires attorney confirmation before any release target.', 'Indicates a verification result that has machine-tier confidence but needs human attorney review before reliance.'),
  verifEntry('attorney_confirmed', 'attorney confirmed', 'An attorney has confirmed the verification result via an AttorneyAction.', 'The strongest available verification label. Recorded as an AttorneyAction with role and bar number; bound to the artifact version hash.'),
];

const releaseStatusEntry = (suffix: string): CanonicalVocabularyEntry => ({
  termId: `clv.core.release_status_${suffix}.v1`,
  canonicalName: suffix.replace(/_/g, ' '),
  oneLineDefinition: `Release status: ${suffix.replace(/_/g, ' ')}.`,
  longDefinition: `Release status entry for "${suffix}". See Release Gate Evaluator for transitions.`,
  scope: 'core',
  allowedSynonyms: [],
  prohibitedSynonyms: [],
  exampleUsage: [],
  exampleMisuse: [],
  version: V,
});

export const SECTION_12_RELEASE_STATUS: readonly CanonicalVocabularyEntry[] = [
  releaseStatusEntry('internal_draft'),
  releaseStatusEntry('attorney_review_required'),
  releaseStatusEntry('business_review_required'),
  releaseStatusEntry('client_release_blocked'),
  releaseStatusEntry('approved_for_internal_use'),
  releaseStatusEntry('approved_for_client_use'),
  releaseStatusEntry('approved_for_external_use'),
  releaseStatusEntry('approved_for_filing'),
  releaseStatusEntry('external_release_blocked'),
  releaseStatusEntry('insufficient_information'),
  releaseStatusEntry('held_pending_conflict_resolution'),
  releaseStatusEntry('held_pending_lnfr_resolution'),
];

const privEntry = (
  suffix: string,
  name: string,
  oneLine: string,
  longDef: string,
): CanonicalVocabularyEntry => ({
  termId: `clv.core.privilege_${suffix}.v1`,
  canonicalName: name,
  oneLineDefinition: oneLine,
  longDefinition: longDef,
  scope: 'core',
  allowedSynonyms: [],
  prohibitedSynonyms: [],
  exampleUsage: [],
  exampleMisuse: [],
  version: V,
});

export const SECTION_13_PRIVILEGE_CLASSIFICATION: readonly CanonicalVocabularyEntry[] = [
  privEntry('op_metadata', 'op_metadata', 'Non-substantive operational telemetry.', 'Telemetry that should live on the operational track only. Containing client identifiers or substantive matter content in op_metadata is a defect.'),
  privEntry('work_product_factual', 'work_product_factual', 'Work product, factual basis.', 'Factual work product — typically discoverable on substantial-need / undue-hardship showing per the work-product doctrine.'),
  privEntry('work_product_mental', 'work_product_mental', 'Work product, mental impressions / opinion.', 'Opinion work product — mental impressions, conclusions, opinions, legal theories. Accorded near-absolute protection. Stored under a separate per-matter encryption key from factual work product.'),
  privEntry('attorney_client', 'attorney_client', 'Attorney-client privileged communication.', 'Communications subject to attorney-client privilege. Evaluated against the matter\'s Privilege Frame including joint representation, common-interest, and entity-client doctrines.'),
  privEntry('client_confidential', 'client_confidential', 'Non-privileged but confidential client information.', 'Client material subject to confidentiality obligations but not attorney-client privilege.'),
  privEntry('public_record', 'public_record', 'Inherently non-privileged.', 'Public-record content such as filed pleadings as filed, public statutes, public rules, public court opinions.'),
];
