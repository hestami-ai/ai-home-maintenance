/**
 * Family Law Production Lens — authored prompt templates (Wave 10).
 *
 * One template per state. Bodies use the platform's placeholder syntax:
 *   {{clv:<termId>[:<field>]}} — expands to the canonical name (or a chosen field)
 *   {{source:<sourceId>}}      — expands to the source content (must be authorized)
 *   {{artifact:<artifactId>}}  — expands to a prior artifact (must be authorized)
 *
 * Each template's `clvBindings` declares the CLV terms it references. The
 * PromptTemplateRegistry rejects templates whose placeholders are not also
 * declared in clvBindings.
 *
 * Wave 10 ships these as single-shot prompts. Wave 11+ may split IssueBloom
 * into pass1/pass2/pass3 templates for tighter Proposal-C control.
 */

export interface AuthoredPromptTemplate {
  readonly templateId: string;
  readonly templateVersion: string;
  readonly lensId: string;
  readonly stateId: string;
  readonly body: string;
  readonly clvBindings: readonly string[];
}

const LENS = 'family_law_production_lens';

export const FAMILY_LAW_PROMPT_TEMPLATES: readonly AuthoredPromptTemplate[] = [
  {
    templateId: 'family_law.matter_context_normalize',
    templateVersion: 'v1',
    lensId: LENS,
    stateId: 'MatterContextNormalize',
    clvBindings: ['clv.core.matter.v1', 'clv.core.client.v1'],
    body: `You are normalizing the {{clv:clv.core.matter.v1}} context for a family-law engagement.

Read the supplied state input (a structured intake record). Output a JSON object with:
  - matter_type: short snake_case identifier (e.g., custody_visitation_enforcement)
  - client_role: 'father' | 'mother' | 'guardian' | 'other'
  - opposing_party_role: 'father' | 'mother' | 'guardian' | 'other' | 'none'
  - child_involved: boolean
  - requested_action: short verb-phrase (e.g., 'evaluate possible enforcement filing')
  - known_urgency: 'low' | 'moderate' | 'high'
  - external_release_requested: boolean
  - external_release_allowed_without_attorney: false  // ALWAYS false; AI cannot release without attorney action

Do not infer privileged facts not present in the input. Distinguish a {{clv:clv.core.client.v1}} from any other party.`,
  },
  {
    templateId: 'family_law.jurisdiction_capture',
    templateVersion: 'v1',
    lensId: LENS,
    stateId: 'JurisdictionCapture',
    clvBindings: ['clv.core.matter.v1', 'clv.core.source.v1'],
    body: `You are capturing the jurisdiction of a family-law {{clv:clv.core.matter.v1}}.

From the supplied {{clv:clv.core.source.v1}} documents and intake notes, extract:
  - jurisdiction: state name (e.g., 'Maryland')
  - court: full court name when present (e.g., 'Circuit Court for Anne Arundel County')
  - jurisdiction_source: filename or sourceId of the document the jurisdiction was confirmed from
  - jurisdiction_status: 'confirmed_from_document' | 'inferred' | 'missing' | 'conflicting'

Refuse to fabricate a jurisdiction. If no source confirms it, return jurisdiction_status='missing'.`,
  },
  {
    templateId: 'family_law.fact_extraction',
    templateVersion: 'v1',
    lensId: LENS,
    stateId: 'FactExtraction',
    clvBindings: ['clv.core.fact.v1', 'clv.core.source.v1', 'clv.core.allegation.v1'],
    body: `You are extracting {{clv:clv.core.fact.v1:long}} for a family-law matter.

Separate findings into THREE buckets:
  - document_supported_facts: facts confirmed by an authorized {{clv:clv.core.source.v1}}.
  - client_reported_facts: statements the client has made that are not yet confirmed by a document.
  - unknown_facts: facts that would matter but are not in the record.

Each fact entry has shape: { fact: string, source: string }.

Do NOT convert {{clv:clv.core.allegation.v1}} into established facts. Quoted-text from documents IS document-supported; a client narrative is client-reported.`,
  },
  {
    templateId: 'family_law.existing_order_extract',
    templateVersion: 'v1',
    lensId: LENS,
    stateId: 'ExistingOrderExtract',
    clvBindings: ['clv.core.authority.v1', 'clv.core.source.v1'],
    body: `Extract the operative obligations from the existing custody/visitation order.

From the supplied {{clv:clv.core.source.v1}} order excerpts, output:
  - order_obligations: array of { obligation: string, bound_party: string, source: string }
  - potential_order_violation: boolean
  - violation_basis: array of short strings citing the specific obligation(s) at issue

Do not characterize the violation as adjudicated. Use 'potential' framing only.`,
  },
  {
    templateId: 'family_law.issue_bloom',
    templateVersion: 'v1',
    lensId: LENS,
    stateId: 'IssueBloom',
    clvBindings: ['clv.core.issue.v1', 'clv.core.claim.v1'],
    body: `You are blooming candidate {{clv:clv.core.issue.v1:long}} for a family-law matter.

Output a JSON object with:
  - issue_candidates: array of { issue: string, why_it_might_matter: string }

Rules:
  - Bloom MORE than the obvious surface issue. Family-law matters typically have 5-10 issue candidates even when the surface concern is narrow.
  - DO NOT prune at this stage. Pruning is a separate state (IssuePrune).
  - Do NOT confuse an {{clv:clv.core.issue.v1}} (legal question) with a {{clv:clv.core.claim.v1}} (cause of action).
  - For custody/visitation enforcement matters, consider: enforcement, contempt, make-up visitation, support-arrears defense, best interests / child refusal, modification of custody, emergency relief, evidence sufficiency, separate-proceeding coordination.`,
  },
  {
    templateId: 'family_law.issue_prune',
    templateVersion: 'v1',
    lensId: LENS,
    stateId: 'IssuePrune',
    clvBindings: ['clv.core.issue.v1', 'clv.core.work_product.v1'],
    body: `You are pruning issue candidates for a family-law matter.

Output:
  - pruning_decisions: array of { issue: string, decision: 'retain'|'remove'|'defer'|'escalate', reason: string }

HARD RULES:
  - Every candidate gets exactly one decision.
  - Every decision MUST have a non-empty reason. Empty reasons are silent pruning and are forbidden.
  - 'remove' requires affirmative basis (e.g., "no safety concern reported"). NEVER remove just because a topic seems peripheral.
  - 'defer' is for issues that may matter later but are not needed for the current artifact set.
  - 'escalate' is for issues an attorney must judge before the lens can proceed.

Pruning rationales are {{clv:clv.core.work_product.v1}} (mental impressions). Be concrete.`,
  },
  {
    templateId: 'family_law.authority_verification',
    templateVersion: 'v1',
    lensId: LENS,
    stateId: 'AuthorityVerification',
    clvBindings: ['clv.core.authority.v1', 'clv.core.machine_assessed_support.v1', 'clv.core.attorney_confirmation_required.v1'],
    body: `You are verifying authorities cited in this matter.

For each retrieved {{clv:clv.core.authority.v1}}, return:
  - authority_id, citation, status

Use ONLY these status values:
  - 'source_located'              — the source is retrievable
  - 'quote_matched'               — a quoted span exists verbatim in the source
  - 'machine_assessed_support'    — your assessment that the authority supports the proposition
  - 'attorney_confirmation_required'

NEVER use 'attorney_confirmed' — that label is reserved for an AttorneyAction record. NEVER label something 'verified' without a specific tier.

Output also:
  - overall_authority_status: the highest applicable per-authority status across the set, but NEVER higher than 'machine_assessed_support'.
  - attorney_confirmation_required: true (always — the lens cannot self-confirm authority).`,
  },
  {
    templateId: 'family_law.direct_legal_conclusion',
    templateVersion: 'v1',
    lensId: LENS,
    stateId: 'DirectLegalConclusionDraft',
    clvBindings: ['clv.core.conclusion.v1', 'clv.core.fact.v1', 'clv.core.authority.v1'],
    body: `You are drafting a direct {{clv:clv.core.conclusion.v1:long}}.

Output:
  - conclusion_text: 2-4 sentences, plain professional language.
  - facts_relied_upon: array of fact ids or short fact descriptors.
  - authorities_relied_upon: array of authority ids.
  - assumptions: array of strings.
  - missing_facts: array of strings — facts you would need to make this conclusion stronger.
  - adverse_considerations: array of strings — counter-arguments or factors that may change the answer.
  - could_change_if: array of strings — conditions under which the conclusion would shift.
  - verification_status: 'machine_assessed' (NEVER higher).
  - attorney_review_required: true (ALWAYS).

The conclusion is a draft for attorney review. Do NOT phrase it as final advice. Do NOT use language of certainty ("guaranteed", "certain to win", "will absolutely").`,
  },
  {
    templateId: 'family_law.client_advice_draft',
    templateVersion: 'v1',
    lensId: LENS,
    stateId: 'ClientAdviceDraft',
    clvBindings: ['clv.core.client.v1', 'clv.core.privilege_attorney_client.v1', 'clv.core.send.v1'],
    body: `You are drafting client-facing advice in a tone the {{clv:clv.core.client.v1}} would understand.

Output:
  - draft_text: the message body (300-600 words; clear, professional, no legalese).
  - tone: 'reassuring' | 'cautious' | 'directive' | 'neutral'
  - includes_caveats: boolean (always true; legal advice carries caveats)
  - send_status: 'external_release_blocked' (ALWAYS — only an AttorneyAction permits {{clv:clv.core.send.v1}})

Do NOT include guarantee language. Do NOT promise a specific outcome. Surface the next attorney action the client should expect.`,
  },
  {
    templateId: 'family_law.court_filing_draft',
    templateVersion: 'v1',
    lensId: LENS,
    stateId: 'CourtFilingDraftGenerate',
    clvBindings: ['clv.core.filing.v1', 'clv.core.filing_package.v1', 'clv.core.authority.v1'],
    body: `You are drafting a court-ready {{clv:clv.core.filing_package.v1}}.

Output:
  - caption: { court: string, parties: array, filing_type: string }
  - relief_requested: array of strings
  - argument_outline: array of { heading: string, summary: string, authorities: string[] }
  - exhibits: array of { exhibit_id: string, description: string }
  - certificate_of_service_required: boolean
  - signature_required: boolean (ALWAYS true for filings)
  - filing_release_status: 'external_release_blocked' (ALWAYS — only signed_for_filing AttorneyAction unblocks)

Reference {{clv:clv.core.authority.v1}} only when retrieved authority is in the envelope. NEVER fabricate citations.`,
  },
  {
    templateId: 'family_law.release_status_determine',
    templateVersion: 'v1',
    lensId: LENS,
    stateId: 'ReleaseStatusDetermine',
    clvBindings: ['clv.core.release.v1', 'clv.core.gate.v1'],
    body: `You are computing the {{clv:clv.core.release.v1}} status for each artifact produced this activation.

Output a JSON map artifact_type → release_status. Allowed status values:
  internal_draft | attorney_review_required | external_release_blocked |
  approved_for_internal_use | approved_for_client_use | approved_for_filing.

Family-law lens defaults (no AttorneyAction yet supplied):
  - draft_client_advice_message: 'external_release_blocked'
  - draft_court_filing: 'external_release_blocked'
  - internal_attorney_packet: 'approved_for_internal_use'

Do NOT mark anything 'approved_for_*' unless the supplied state input contains an AttorneyAction record for that artifact version.`,
  },
];
