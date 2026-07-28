# JAN-CSAA Sponsor Standing Direction for Autonomous Corpus Preparation and Final Review

**Record ID:** `JAN-CSAA-SPONSOR-DIRECTION-001@0.1.0`

**Record status:** Immutable sponsor-direction evidence and operating-boundary record; the authority carrier is `JPWB-REG-005 REG-D-021`

**Sponsor:** Marshall Hendricks, Architect and accountable sponsor

**Sponsor direction time:** `2026-07-28T08:58:53.646-04:00`

**Sponsor-direction source:** Sponsor-originated conversation turn `019fa8ce-80d1-7482-960d-422ec4358859`

**Governing basis:** `JPWB-CON-000 B1`, `B2`, and `B5`; `JPWB-DOC-004` §§9–10; `JPWB-REG-005 REG-D-013`, `REG-D-014`, `REG-D-017`, and `REG-D-018`; `JAN-CSAA-000@0.3.0` §9.4

**Register preimage at preparation:** 107,854 bytes; SHA-256 `d516e7068eae1a2a19fa1259420518f63833af070cf5642a9d95fb4bf2f09872`; endpoint `REG-D-020 / EFFECTIVE — MERGED`

**Purpose:** Record the sponsor's standing direction that removes the sponsor from intermediate manual authorization of individual JAN-CSAA documents and waves, preserves the full assurance process during autonomous corpus preparation, and reserves sponsor review and conferral for the completed corpus as a whole.

**Authority rule:** This record does not itself confer Normative status on any JAN-CSAA member. The registered standing commission authorizes preparation, internal lifecycle progression, and review only. A final sponsor act against an exact completed-corpus manifest remains necessary before any currently non-authoritative member becomes Normative.

---

## 1. Sponsor-originated direction

The visible sponsor-originated direction is preserved verbatim:

> We need to remove me from the manual authorization of these documents because it's taking way longer to generate than I had expected. Granted, we do want very high quality documentation so the process itself is fine. But my authorization as sponsor will have to be understood as me reviewing the full corpus of documents once all the waves, etc. have been finished.

This is a process and commission ruling. It is not an exact-byte adoption disposition for any current document candidate, implementation artifact, provider, experiment, oracle, or source-code change.

---

## 2. Operative interpretation

The direction establishes the following model:

1. the documentation corpus SHALL continue through all planned authoring waves without requiring a sponsor response, concern-owner appointment, concern-owner disposition, register decision, or manifest-carriage decision at each document or wave boundary;
2. the documentation agents MAY author, revise, reconcile, review, and validate all reserved JAN-CSAA members and allocated documentation companions within the boundary in §3;
3. a member MAY advance from Draft to Proposed only after its requirement ledger and author self-review close;
4. every Proposed member SHALL receive independent adversarial review, and affected review SHALL be repeated after material candidate-byte changes;
5. no agent, reviewer, working-status record, or interim package may confer Normative status or represent sponsor acceptance;
6. all non-authoritative members SHALL remain Draft or Proposed until the complete corpus is presented in one final sponsor-review event; and
7. the accountable sponsor's next required authorization for this documentation program is the final exact-corpus disposition described in §8, unless the sponsor separately revokes or changes this direction.

This model changes where sponsor attention occurs, not the quality standard. The full-judgment evidence required by `REG-D-013` SHALL be accumulated during authoring and presented together at final corpus review. No intermediate assent may be inferred from silence, continued work, or a generic instruction to proceed.

---

## 3. Exact delegated scope

### 3.1 Authorized documentation work

The standing commission authorizes documentation-only work for:

- completion and review of `JAN-CSAA-001`, `JAN-CSAA-002`, and `JAN-CSAA-005`;
- Wave 2 authoring and adversarial review of `JAN-CSAA-003`, `JAN-CSAA-004`, and `JAN-CSAA-006`;
- Wave 3 documentation authoring and adversarial review of `JAN-CSAA-007`, `JAN-CSAA-008`, and `JAN-CSAA-009`;
- Wave 4 documentation authoring and adversarial review of `JAN-CSAA-010`, `JAN-CSAA-011`, the repository-specific design, and the detailed implementation roadmap;
- requirement ledgers, evidence snapshots, author self-reviews, independent review records, reconciliation records, terminology and authority audits, cross-document closure records, final-corpus manifests, and final sponsor-review preparation;
- read-only repository inspection needed to ground the documents in the actual implementation and configuration;
- Draft-to-Proposed lifecycle progression after the applicable ledger and self-review gates pass;
- sequencing, iteration, and return to an earlier wave when cross-corpus review discovers a defect; and
- non-authoritative working-state tracking that keeps current authoring state separate from the adopted README manifest baseline.

The commission applies to `JAN-CSAA-001` through `JAN-CSAA-011` and their documentation companions. `JAN-CSAA-000@0.3.0` remains the active Normative program charter during preparation. Any proposed amendment to `JAN-CSAA-000` SHALL remain a separately identified Draft or Proposed successor until final corpus review.

### 3.2 Excluded work

The standing commission does not authorize:

- Normative conferral, adoption, retirement, or authority transfer for any member;
- amendment of canon meaning or sponsor voice;
- application-source, test, build-configuration, dependency, lockfile, migration, generated-contract, or executable-oracle mutation;
- installation, procurement, provider selection, provider qualification execution, external scanning, network access, live-agent execution, production-trace ingestion, or prototype execution;
- creation or activation of final machine schemas, generated types, fixtures, conformance suites, repository gate configurations, or acceptance oracles;
- implementation of an analyzer, adapter, service, CLI, IDE integration, daemon, language server, persistence engine, or deployment topology;
- waiver, weakening, or removal of a pre-existing judgment-grain oracle;
- a green implementation-readiness or analyzer-conformance claim without the required executable evidence; or
- any action outside the repository and documentation scope already governed by the applicable higher authority.

Later documents MAY specify proposed shapes, fixtures, tests, provider criteria, and implementation work. Those contents remain proposed obligations and SHALL NOT be represented as executed, selected, installed, passed, or authoritative.

---

## 4. Duration and termination

The standing commission becomes effective when recorded as `REG-D-021` and continues until the earliest of:

1. the final completed-corpus sponsor disposition is recorded;
2. the accountable sponsor explicitly revokes or supersedes the commission;
3. a material scope or authority conflict is discovered that cannot be represented safely as a Draft/Proposed assumption, alternative, unresolved finding, or conservative safe default; or
4. the program is cancelled by a later recorded sponsor act.

There is no per-wave or per-document expiry. A repository revision change does not terminate the commission, but every repository-grounded claim SHALL preserve its subject identity and freshness semantics.

---

## 5. Reviewability and sponsor visibility

The accountable sponsor MAY inspect, comment on, redirect, narrow, revoke, or supersede the work at any time. No such intermediate review is required for continued in-scope authoring.

Agents SHALL make the work reviewable by preserving:

- permanent document and requirement identifiers;
- semantic versions and independent lifecycle status;
- exact candidate digests at review and final-presentation boundaries;
- source, evidence, and repository-subject provenance;
- requirement ledgers and verification bindings;
- author self-review and independent adversarial-review records;
- unresolved findings, assumptions, alternatives, conflicts, and strongest opposing cases;
- cross-document ownership, traceability, consistency, and closure evidence;
- the distinction between documentation evidence and executable proof; and
- a concise working-status record showing current wave, candidate state, and blockers.

The sponsor's lack of intermediate review SHALL NOT be recorded as approval, concurrence, acceptance, waiver, or risk acceptance.

---

## 6. Recording mechanism

The preparation program SHALL use the following records:

1. `JPWB-REG-005 REG-D-021` is the single standing sponsor-direction and commission entry.
2. The current adopted `JAN-CSAA-000@0.3.0` README manifest remains the authority and adoption baseline. It is not required to churn for every Draft revision or wave transition.
3. A separate non-authoritative working-corpus status record SHALL track current authoring versions, lifecycle states, wave state, and open review work.
4. Each member's own metadata, requirement ledger, and review records SHALL carry its current candidate state.
5. Interim sponsor presentation, sponsor response, concern-owner authority, concern-owner determination, per-member adoption, and state-only README-carriage packages SHALL NOT be generated merely to permit continued corpus authoring.
6. The final review package SHALL contain one exact completed-corpus manifest and the assurance evidence in §8.
7. The final sponsor disposition SHALL be recorded in `JPWB-REG-005` and synchronized into every accepted member and the README manifest in one controlled final-carriage procedure, with append-only confirmation if exact synchronized carriage cannot complete atomically.

Administrative records produced under this mechanism are evidence and program state. They do not become an independent semantic authority.

---

## 7. Separation of duties and quality gates

The following constraints preserve rigor without requiring sponsor involvement:

- the authoring identity SHALL NOT be the independent reviewer of the same exact candidate;
- independent review SHALL be performed by a separately identified agent invocation or reviewer role and recorded with its method, evidence, findings, and candidate identity;
- a reviewer MAY propose corrections but SHALL NOT confer status or silently edit the reviewed candidate;
- if the reviewer edits a candidate, that reviewer becomes an author for the changed bytes and a different reviewer SHALL review the affected result;
- material cross-document semantics SHALL receive a horizontal-closure and single-owner audit;
- requirement-ledger closure SHALL require every applicable obligation to be implemented in the documentation and verified, or explicitly classified with its authorized later owner and non-performance state;
- unresolved semantic choices that do not block coherent specification MAY be carried as explicit Draft/Proposed assumptions, alternatives, or final-review items;
- an unresolved choice that would require inventing canon meaning, changing sponsor voice, weakening an existing oracle, or claiming executed evidence SHALL fail closed and be reported as a genuine blocker;
- exact-byte integrity SHALL be frozen at every Proposed review boundary and for the final corpus manifest; and
- no self-review, independent review, or automated check may be represented as sponsor ratification.

The process MAY use multiple agents and automated structural checks. Agent count does not by itself establish independence; the record SHALL identify distinct author and reviewer roles and preserve their outputs.

---

## 8. Final corpus review and conferral

The sponsor's final review SHALL occur only after the documentation program reports that all commissioned waves and cross-corpus closure are complete.

The final package SHALL include:

- every controlled member ID, title, semantic version, lifecycle status, exact byte count, line-ending form, and SHA-256 digest;
- the exact completed README successor candidate and its manifest;
- closed requirement ledgers and author self-review records for every candidate proposed for adoption;
- independent adversarial-review records and the disposition of every blocker and major finding;
- a corpus-wide authority, terminology, ownership, traceability, consistency, security, and V&V closure report;
- every unresolved fork, assumption, limitation, residual risk, and strongest opposing case;
- a precise statement of what is documentation-only and what executable evidence remains unperformed;
- the repository-specific design and detailed implementation roadmap;
- a proposed acceptance set and any explicitly excluded or deferred member;
- deterministic final-carriage instructions; and
- proof that the final presentation changed no candidate byte after its applicable review.

The final presentation SHALL be one corpus-level sponsor-review event. It MAY organize material issues and exceptions individually so the sponsor can make an informed judgment, but it SHALL NOT require a sequence of intermediate authorizations to complete the documentation. One exact manifest-bound sponsor act MAY confer the accepted members together, provided the act identifies every accepted artifact and preserves any exceptions or deferrals explicitly.

If the sponsor returns the corpus for revision, agents MAY revise and re-review the affected scope under this standing commission and then re-present the complete corpus. No new preparation commission is required unless the sponsor changes scope.

---

## 9. Transition from the pending MANIFEST-002 chain

The unexecuted `JAN-CSAA-W1-MANIFEST-002@0.2.0` successor package and its associated `VALIDATION-004`, `INSTRUMENT-002`, `FREEZE-002`, and `INTAKE-002` records remain immutable historical preparation evidence.

They SHALL NOT be solicited or executed after `REG-D-021` because:

- their event-specific concern-owner and sponsor gates are unnecessary under this standing model;
- the adopted README manifest is now intentionally treated as an adoption baseline during autonomous preparation rather than a continuously ratified working-status dashboard;
- no Part A authority assignment, Part B `W1M2-CO-01` response, sponsor presentation, sponsor response, README carriage, archive, completion, or confirmation is required or authorized for that package; and
- `REG-D-021` consumes the next register identifier that the proposal expected but did not reserve, making its exact pre-recording predicate incompatible.

No defect is erased. The predecessor and successor MANIFEST-002 materials remain evidence of the process that led to the standing-direction correction.

---

## 10. No-expansion conclusion

This direction removes repeated manual authorization from documentation production. It does not lower the documentation quality standard, confer member authority early, or authorize implementation.

The resulting boundary is:

```text
All documentation waves
    → autonomous Draft authoring
    → ledger closure and author self-review
    → Proposed promotion
    → independent adversarial review
    → cross-corpus reconciliation and final exact manifest
    → one accountable-sponsor review of the completed corpus
    → exact accepted-set conferral and synchronized carriage
```

Until the final sponsor act, every new JAN-CSAA member remains non-authoritative and every implementation, provider, executable oracle, and source-mutation boundary remains unchanged.
