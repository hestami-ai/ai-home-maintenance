# Single-Issue Access Denial — thin-slice scenario

## Product Overview

A single, isolated incident of denied parenting-time access under an existing custody order. One alleged denial. No support dispute. No emergency. No safety concern. The narrowest possible matter that still exercises every Family Law Production Lens state from intake to release-status determination.

This is the legal-domain equivalent of TinyURL: minimal but complete.

## Matter Type

`custody_visitation_enforcement` — single incident.

## Jurisdiction

Maryland, Anne Arundel County.

## Inputs

### Client message

> My ex did not let me see my son this weekend, even though our court order says I get him every other weekend from Friday at 6 PM until Sunday at 6 PM. She just said no. Can we do something about it?

### Custody order excerpt

> Circuit Court for Anne Arundel County, Maryland. ORDERED, that Father shall have access with the minor child every other weekend from Friday at 6:00 p.m. until Sunday at 6:00 p.m., beginning March 1, 2026.

### Intake notes

> Client says one denial occurred this past weekend. No prior incidents reported. No protective order. No safety concern. No support dispute. Client is current on support. Child is 12.

## Expected lens

- Primary: `family_law_production_lens`
- Secondary: `client_advice_draft_lens`
- Confidence: `high`

## Expected outputs (structural)

The thin-slice runner asserts the structural shape, not the substantive content:

- All 11 lens states complete in order.
- IssueBloom produces ≥ 1 issue candidate (single incident still blooms).
- IssuePrune retains the enforcement issue with a recorded reason.
- AuthorityVerification status is `machine_assessed_support` (no attorney confirmation in thin slice).
- DirectLegalConclusionDraft sets `attorney_review_required: true`.
- Release statuses for client advice + court filing: `external_release_blocked`.
- All op-track events for substantive activity carry no client/matter content.
- Matter-track events use mental key for pruning rationales and conclusions; content key for facts.

## Out of scope (deliberately)

- Multi-incident pattern.
- Support arrears defense.
- Child-refusal claim.
- Emergency relief.
- Modification of custody.
- Pro-hac-vice scenarios.
- Multi-attorney review chain.
