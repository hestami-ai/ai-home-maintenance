# Governed Stream — Privilege and Discovery Architecture

**Status:** Detailed design document.
**Parents:** `janumilegal_product_description.md` §Governed Stream; `janumilegal_product_description_evolution.md` §3; `janumilegal_multi_matter_isolation_addendum.md` §6.
**Audience:** Engineering (binding), counsel (review-deferred until demonstrable implementation).
**Counsel review status:** **Deferred** until a runnable demonstration exists. This document is engineering's draft for that future review. No design decision below is final until counsel has reviewed it.

---

## 1. Premise

The Governed Stream is the matter's reasoning record. In JanumiCode v2 it is a developer aid. In JanumiLegal it is **potentially discoverable evidence** in:

- the underlying matter (party requests, subpoenas to the firm, third-party subpoenas),
- malpractice litigation against the firm,
- bar disciplinary proceedings,
- sanctions proceedings (Rule 11, 28 U.S.C. § 1927, court-specific analogues),
- regulatory proceedings,
- ethics audits.

If the stream is built like a developer log, the firm has created a discoverable substrate that exposes attorney mental impressions, draft work product, attorney-client communications, and operational metadata — all in one place. The architectural goal is to make the stream **rich enough to be useful** and **structured enough to be defensible** without making it **a single gravity well of producible evidence**.

---

## 2. Design Principles

1. **Classification at write time, not query time.** Every event carries its privilege/work-product classification when it lands. Reclassification is a documented event, not a casual query filter.
2. **Physical separation by sensitivity.** Operational telemetry and matter content do not share storage. Within matter content, mental impressions are separately keyed from factual work product.
3. **Separation by matter.** No event references two matters; no storage layer aggregates across matters except for explicitly-permitted operational telemetry on metadata only.
4. **Read paths are scoped, narrow, and recorded.** There is no general-purpose "show me everything" surface. Every read carries a recorded purpose and authorization.
5. **Export is never bulk and never silent.** Every export is matter-scoped, classification-filtered, attorney-authorized, and recorded with redaction summary.
6. **Retention is bound to matter lifecycle, not platform lifecycle.** Deletion requires a documented basis. There is no admin "purge" path.
7. **Compromise of one matter does not compromise others.** Per-matter content keys are wrapped per-client and per-firm; mental impressions use a separate key from factual work product within the same matter.
8. **The system tells the truth about what it stored.** Producing a Governed Stream segment in discovery should be defensible because the structure, classification, and scope are documented, not because they were obscured.

---

## 3. Two-Track Storage

### 3.1 Operational Track

**Contents:** non-substantive telemetry only. Examples:

- state entered, state exited, agent invoked, agent latency, model id, token counts.
- lens id, lens version, lens-pack version load events.
- error counts, retry counts, validator pass/fail counts (without payload).
- matter context switch events (the *fact* of switching, not the substance of either side).
- export events (who exported, when, classification filter applied — not the exported content).
- LNFR gate fire/clear events at the metadata level.
- Cross-matter operation audit events (authorized cross-matter reads, joint-rep activations).

**Contents excluded:** any client name, any party name, any matter title, any source content, any LLM prompt or response, any draft text, any attorney commentary, any pruning rationale, any MMP card text.

**Retention:** platform retention policy (typical: 90–365 days rolling).
**Access:** platform operations, telemetry, eval/regression. Not discovery-relevant by design (contains no client content).
**Storage:** single SQLite table within the platform DB, indexed for telemetry queries.

### 3.2 Matter Track

**Contents:** everything else. Specifically:

- agent inputs and outputs (prompts and completions where they reveal substance).
- state outputs that contain matter content.
- artifacts (drafts, redlines, memos, filings).
- pruning rationales.
- MMP card text.
- attorney commentary, review notes, escalation notes.
- source ingestion records, fact extractions, timeline entries.
- authority retrieval results, citator results, treatment classifications.
- LNFR gate findings (the substance, not just the metadata).
- privilege classifier outputs.

**Retention:** per firm and per matter type; default = matter lifecycle + jurisdictional retention floor (typically 5–10 years post-closure for civil matters in MD; longer for criminal, family, and child-welfare).
**Access:** scoped to authorized users via `UserMatterAccess`; classification-aware visibility.
**Storage:** per-matter SQLite file under `firm_id/client_id/matter_id/governed_stream.sqlite`, encrypted at rest.

---

## 4. Classification Taxonomy

Every matter-track event carries exactly one classification, assigned at write time:

| Classification | Meaning | Examples |
|---|---|---|
| `op_metadata` | Non-substantive telemetry that landed in matter track by accident (should be moved to op track) | rare; treated as a defect |
| `work_product_factual` | Work product, factual basis | source ingestions, fact extractions, timeline entries, retrieved authorities |
| `work_product_mental` | Work product, mental impressions / opinion | pruning rationales, MMP card text, attorney commentary, strategy notes, draft attorney critiques, adverse-argument generations |
| `attorney_client` | Attorney-client privileged communication | client-message intake, client-facing draft text before it is sent, attorney communications to/from client recorded in the matter |
| `client_confidential` | Non-privileged but confidential client information | client-supplied factual material that does not embed legal advice; documents bearing a confidentiality designation but not subject to AC privilege |
| `public_record` | Inherently non-privileged | filed pleadings as filed, public statute/rule references, citation records to public authority |

### 4.1 Classification rules

- **Default is restrictive.** When uncertain between `work_product_factual` and `work_product_mental`, the Privilege Classifier picks `work_product_mental`. False positives degrade discoverability of factual work product; false negatives expose mental impressions. The asymmetry is intentional.
- **Joint classification at write time.** A single event has one classification. A composite payload (e.g., a fact extraction that quotes a client communication) is split into two events: the fact extraction (`work_product_factual`) and the client communication reference (`attorney_client`).
- **Classification is immutable.** Reclassification requires an explicit reclassification event with a documented basis, written as a new event. The original event is not mutated.
- **Mental-impressions firewall.** `work_product_mental` events live in a separate sub-segment with a separate per-matter key (see §5.3). Compromise of the matter content key does not by itself disclose mental impressions.

---

## 5. Encryption and Key Hierarchy

### 5.1 Key tiers

```
firm_key            (KMS-held; rotated on firm-policy schedule)
  └── client_wrap_key   (per client; wrapped by firm_key)
        └── matter_content_key      (per matter; wraps factual + AC + confidential + public_record events)
        └── matter_mental_key       (per matter; wraps work_product_mental events ONLY)
```

### 5.2 Why two per-matter keys

- Compromise of a single matter's content key exposes facts, sources, and AC communications for that matter — bad, but contained.
- Compromise of the same matter's mental-impressions key requires a separate breach. The most legally consequential category — attorney mental impressions, strategy, work-product opinion — has its own encryption boundary even within the matter.
- Discovery export filters can decrypt the content key without touching the mental key, ensuring a discovery export that filters out mental impressions cannot accidentally include them via an envelope decryption error.

### 5.3 Key handling

- Keys at rest are stored in the platform's secrets layer (KMS-equivalent on hosted deployments; OS keychain on local desktop deployments).
- Keys in memory are zeroed after use.
- No key is ever written to the operational track or to logs.
- Key rotation is matter-aware: rotating a firm key re-wraps client wrap keys; rotating a client wrap key re-wraps matter keys; matter content/mental keys themselves are not rotated routinely (a rotation would require re-encrypting matter history, which is a high-cost operation reserved for compromise response).

---

## 6. Write Path

### 6.1 Event shape

```ts
type GovernedStreamEvent = {
  eventId: string;                    // UUID
  correlationId?: string;             // for paired cross-matter events (rare)
  firmId: string;
  clientId: string;
  matterId: string;
  userId: string | "system" | `agent:${string}`;
  activeMatterContext: string;        // the matter the user's session was on; should equal matterId
  lensId?: string;
  lensVersion?: string;
  stateId?: string;
  agentId?: string;
  agentRunId?: string;
  classification: StreamClassification;
  privilegeFrameRef: string;          // snapshot of frame in force at write time
  clvScope: string[];                 // CLV term ids in scope
  eventType: string;                  // controlled vocabulary
  payload: object;                    // schema per eventType
  payloadHash: string;                // sha256 of payload for tamper-evidence
  prevEventHash: string;              // hash chain within (matterId, classification)
  writtenAt: string;                  // ISO 8601, UTC
  writerNode: string;                 // for distributed deployments
};
```

### 6.2 Write contract

1. The caller supplies firm/client/matter scope, eventType, and payload. The caller does **not** supply classification.
2. The Privilege Classifier (Tier 10 agent #46) runs deterministically where it can, LLM-backed where it must, against the eventType + payload + active Privilege Frame.
3. Classifier emits a classification. If classifier confidence is below threshold, classification defaults to `work_product_mental` (most restrictive of the substantive classes).
4. The orchestrator selects the appropriate key (`matter_content_key` or `matter_mental_key`).
5. Payload is encrypted; envelope written; hash chain advanced.
6. Operational-track event records the *fact* of the write (no payload, no classification mismatch is exposed in op track).

### 6.3 Hash chain

A hash chain runs **per (matterId, classification)** — five chains per matter. Tampering with any past event breaks the chain. Chain heads are periodically anchored to a firm-level hash (and optionally to an external timestamping service for stronger integrity claims).

### 6.4 Active-matter-context mismatch

If `activeMatterContext !== matterId` at write time, the write proceeds (the action was authorized for this matter) but emits an alarm event. This catches:

- programmatic writes with stale context.
- bugs in matter-switch flows.
- potential mistaken-matter actions (escalates to the user with the recovery flow per multi-matter §8.6).

---

## 7. Read Paths

### 7.1 Authorized reads

A read is authorized if and only if:

- the caller has an active `UserMatterAccess` row for the matter, and
- the caller's role and `scopeRestrictions.classificationCeiling` allow the requested classification, and
- the matter is not in the caller's `screened_out` list.

Reads against `work_product_mental` require an explicit role allowance — most non-attorney roles cannot read mental impressions even if they can read factual work product on the same matter.

### 7.2 Unified matter view

The matter dashboard's "Governed Stream view" assembles authorized events across classifications **at the UI layer**, not the storage layer. Each event is decrypted with the appropriate key only if the caller has clearance for that classification. The view is rendered with classification badges so users always see which classification each event sits in.

### 7.3 Search

- Per-matter search is the default surface.
- Search across matters is prohibited as a substantive read path. Cross-matter aggregation operates on op-track metadata only.
- Full-text search within a matter is classification-aware: a user without mental-impressions clearance never sees mental events in results.

### 7.4 Read recording

Every read of the matter track records to the operational track:
`(userId, matterId, classification, eventCount, timestamp, purpose-tag)`.

The `purpose-tag` is supplied by the calling surface (e.g., `dashboard_render`, `export_prep`, `attorney_review_packet_assembly`). Read recording does not include event content.

---

## 8. Export and Discovery

### 8.1 No bulk export

There is no platform-wide export. There is no firm-wide export. Only matter-scoped export.

### 8.2 Export request shape

```ts
type ExportRequest = {
  matterId: string;
  requestedBy: string;                  // userId
  attorneyAuthorization: AttorneyAction; // role: attorney_of_record or supervising
  purpose: ExportPurpose;
  classificationFilter: StreamClassification[];
  dateRange?: { from: string; to: string };
  includeArtifacts: boolean;
  includeSources: boolean;
  redactionPolicy: RedactionPolicy;
};
```

### 8.3 Export purposes (controlled vocabulary)

```
discovery_production_party        - producing to opposing party in matter discovery
subpoena_third_party              - responding to a third-party subpoena
client_file_transfer              - transferring file to substitute counsel or client
malpractice_defense               - producing to defense counsel in malpractice
disciplinary_response             - bar grievance response
court_in_camera                   - in camera submission to court
internal_audit                    - firm internal audit / quality review
client_request                    - client-requested copy of file
```

### 8.4 Default redaction by purpose

| Purpose | Default exclusions (attorney can override with documented basis) |
|---|---|
| `discovery_production_party` | `work_product_mental`, `attorney_client` (privilege log generated for excluded events) |
| `subpoena_third_party` | `work_product_mental`, `work_product_factual`, `attorney_client` (per privilege/work-product objections) |
| `client_file_transfer` | none — client is entitled to their file (jurisdiction-specific; MD generally follows the entire-file rule) |
| `malpractice_defense` | none from firm to its own counsel (in-house privilege) |
| `disciplinary_response` | per disciplinary authority's order |
| `court_in_camera` | none |
| `internal_audit` | as configured by firm policy |
| `client_request` | per file-transfer rule |

### 8.5 Privilege log generation

When `discovery_production_party` excludes any events, a privilege log is generated automatically containing for each excluded event:

- date,
- author/source,
- recipient (where applicable),
- subject-line equivalent (a derived non-privileged description, not the content),
- privilege/work-product basis.

The privilege log itself is reviewed by the attorney before production. The log's accuracy is the attorney's responsibility; the system provides the structured input.

### 8.6 Export record

Every export emits an event to the **operational track** (not the matter track) recording: who exported, when, purpose, filter, redaction policy applied, count of events excluded by category, and a hash of the produced package. The exported package itself is not stored in the platform — it is delivered and the platform retains only the export record.

### 8.7 Re-export

Re-exporting an existing package is its own export event. There is no "share previously-exported package" affordance.

---

## 9. Retention and Deletion

### 9.1 Retention defaults (Maryland-aware; jurisdiction-overridable)

| Matter type | Default retention post-closure |
|---|---|
| Civil litigation | 7 years |
| Criminal defense | 10 years (longer if appeal pending or post-conviction relief) |
| Family law (custody/support involving minors) | until child reaches majority + 7 years |
| Family law (no minors) | 7 years |
| Business / transactional | 10 years |
| Estate planning | until trust/estate fully administered + 7 years |
| Bankruptcy | 7 years post-discharge or dismissal |

These are **defaults**. Firm config (Layer 3) overrides per matter type and per matter. MD Rule 19-301.15 (record-keeping for client property) and MD Rule 19-308.4 (recordkeeping for trust accounts) inform some floors; firm should set its own policy with counsel input.

### 9.2 Deletion

- **No "delete everything" admin path.** No platform operator can purge matter data.
- **Routine retention expiry**: a scheduled job identifies matters whose retention has expired, surfaces them to a designated firm role for review, and deletes only after explicit authorization.
- **Court-ordered deletion**: requires the court order document to be attached to the deletion event.
- **Client-requested deletion**: subject to firm policy, ethical-rules constraints (firm may have to retain notwithstanding client request), and conflict-of-interest considerations.
- **Deletion records remain.** The fact of deletion (matterId, retention basis, authorizer, timestamp, hash of pre-deletion final state) is preserved indefinitely in the operational track. The substance is gone; the record of having had it is not.

### 9.3 Litigation hold

A litigation hold can be placed on a matter (or a client's full matter portfolio). While a hold is in force, retention expiry is suspended for held matters. Hold placement and lift are recorded; the recorded basis is required.

---

## 10. Privilege Frame Integration

Each matter has a current Privilege Frame (per evolution §12). Every matter-track event records a reference to the frame snapshot in force at write time. This matters because:

- privilege frames change over time (a third party joins; a common-interest agreement is signed; a protective order issues),
- a discovery-time interpretation of an event must use the frame in force when the event was written, not the current frame,
- joint representation and common-interest links can render an otherwise-privileged event shareable across matters via the named flows in multi-matter §7.1–§7.2.

The frame snapshot stored is small (the frame itself is structured; the snapshot captures the version+content hash), with the full frame held in the matter's privilege-frame history table.

---

## 11. Threat Model

The privilege architecture assumes the following adversaries and failure modes. Each is addressed somewhere in the design.

| Threat | Mitigation |
|---|---|
| Subpoena to firm seeking matter content | Matter-scoped storage; classification-aware export filter; privilege log generation |
| Insider firm user reading screened matter | `UserMatterAccess` enforcement at data-access layer; UI side-channel audit (multi-matter §11) |
| Compromise of platform DB | Per-matter content keys; per-matter mental keys; firm/client wrap key tier |
| Compromise of single matter file | Mental sub-segment under separate key; no cross-matter exposure |
| Attorney accidentally produces mental impressions | Default redaction excludes mental; explicit override required; export record preserves the override |
| Discovery from another matter reaches into this matter | No cross-matter event references; cross-matter operations limited to named flows with audit |
| Evidence-tampering claim | Per-classification hash chain; firm-level anchoring; tamper detection on read |
| Mistaken-matter action | Active-matter-context mismatch alarms; mistaken-matter recovery flow; affected artifact release-gate re-evaluation |
| Stale privilege frame interpretation | Frame snapshot ref on every event; frame history retained |
| Exfiltration of LLM prompts/completions | Provider-side: per-matter cache namespacing; no matter-identifying request headers; provider-relationship under firm BAA equivalent |
| Mental impressions inferred from operational telemetry | Op-track contents constrained to non-substantive metadata; periodic audit of op-track schema |

---

## 12. Open Items for Counsel Review

These are the questions counsel should rule on before the design is locked.

1. **Default retention floors.** Are the §9.1 defaults appropriate for Maryland and for the practice mix at JC Law?
2. **Mental-impressions classification threshold.** The conservative default classifies as `work_product_mental` when uncertain. Counsel should confirm that the resulting privilege log richness (more entries logged, fewer events produced) is the correct posture.
3. **Privilege log auto-generation.** Counsel must validate the auto-generated log fields and the description-derivation approach against MD discovery practice.
4. **Hash-chain anchoring.** Whether external timestamping is desirable. Some firms prefer it for evidentiary integrity; others view it as a litigation hostage.
5. **Recordkeeping rules.** Confirm alignment with MD Rule 19-301.15, MD Rule 19-308.4, and any other firm-applicable rules.
6. **Discovery posture.** Confirm the export-purpose taxonomy and default redactions match firm discovery practice.
7. **Litigation hold mechanics.** Who at the firm has authority to place and lift holds; whether holds should propagate from one matter to related matters automatically.
8. **Client file-transfer rule.** Maryland's "entire file" approach vs. work-product-restricted approaches in other jurisdictions; whether the platform default (entire file on `client_file_transfer`) matches firm posture.
9. **Cross-border concerns.** JC Law practices in MD, VA, PA, DC. Confirm the retention defaults handle the most-restrictive applicable rule when matters span jurisdictions.
10. **AC privilege boundaries with paralegals and staff.** Confirm that the role model in §7.1 correctly handles support-staff access without breaking AC privilege.

---

## 13. Implementation Sequence (binding to roadmap)

- **Wave 0:** schema for op track, matter track tables, key envelope tables. No content writes yet.
- **Wave 2:** `AgentInvocationScope` envelope wired; agent runs emit op-track events only.
- **Wave 3 (this document is the prerequisite):** Privilege Classifier agent; matter-track per-matter file storage; per-matter content key + per-matter mental key; classification-aware writes; hash chains; alarms.
- **Wave 3:** Export pipeline; redaction policies; privilege log generator; retention scheduler scaffolding.
- **Wave 6:** Export integration with attorney action model; full discovery production flow exercised against the gold-capture matter.
- **Wave 7:** UI Governed Stream view with classification badges; matter dashboard read paths.
- **Wave 8:** Retention scheduler in production; litigation hold flow.
- **Wave 9:** Red-team against threat model §11.

---

## 14. Standing Disciplines Specific to This Layer

- No matter-track write without classification.
- No operational-track write that contains substantive content.
- No cross-matter aggregation outside the named flows.
- No bulk export. Ever.
- No silent reclassification.
- No deletion without documented basis.
- No firm-key escrow that bypasses the matter-key tier.
- No prompt-cache key reused across matters.
- No "show recent matters" affordance that surfaces a screened matter.
- The op track contains the *fact* of substantive activity; never the substance.

---

## 15. Pending Counsel Review

This document is the engineering draft. The architecture it describes will be implemented (Wave 3). Counsel review will occur once a runnable demonstration exists. Counsel review may produce changes requiring re-implementation; the architecture is designed so that the most likely changes (retention floors, redaction defaults, classification threshold) are configuration, not code.
