---
artifactId: JAN-CMDPRE-SPEC-001
title: Command Precondition and Transition Legality
classification: JAN-CMDPRE program deep reference — NOT a canon artifact. It is not a member of the JPWB-SPEC-nnn canon series: CON-000 B1 reserves that series for per-subsystem specs, each individually ratified per REG-005, whereas this document is scoped to a cross-cutting CONCERN (transition legality across every command family) surfaced by the JAN-CMDPRE remediation program. It is INFORMED BY the canon (esp. JPWB-DOC-003's Semantic Model concern) but governs only the JAN-CMDPRE program's own ground.
settledness: HYPOTHESIS (a program working reference, under test against the codebase — a divergence is evidence, not scandal, per JPWB-CON-000 B6)
status: DRAFT — authored under the sponsor grant of 2026-07-24; the operative deep reference for the JAN-CMDPRE program (design JAN-CMDPRE-DS-001; roadmap JAN-CMDPRE-DR-001). Not submitted for canon ratification.
version: 0.2.0
date: 2026-07-24
changelog: "v0.2.0 (2026-07-24) — DWP-05 DELIVERED: §5.3 authors the 7 execution plan-level + 4 pwa-authoring publication target sets (established empirically, mutation-red-proofed, gated, adversarially verified); §7 narrowed to the DWP-08 commitState remainder; fork F-1 resolved. v0.1.0 — initial DRAFT (DWP-04 ground)."
governs:
  - The enumerated command-precondition and transition-legality surface of the engine: for every state-advancing command, the source-state precondition under which it may legally be issued.
  - The aggregate state-machine catalog those preconditions draw on — states, transitions, guards, and the illegal set — cited to the repository shape that carries them.
  - Re-issue and idempotency semantics: what a same-state (NOOP) re-issue does today and what it MUST do; the refusal-code matrix (which failure arm returns which error code and result status).
  - The conformance-fixture obligation for each command: the named re-issue test and its mutation red-proof.
doesNotGovern:
  - The MEANING of the state axes, transitions, guards, and the assurance/governance model — JPWB-DOC-003 (§6 state axes and transition guards; §7 decomposition/recomposition; §8 assurance model; §9 persistence). This SPEC enumerates the legality surface DOC-003 §6 explicitly defers to repository shapes; it never restates DOC-003's meaning.
  - The naming and meaning of terms — JPWB-DOC-002.
  - Exact serialized shapes: enum spellings, envelope structure, ID prefixes, and the fifteen error codes — the repository's generated contracts and schemas. This SPEC cites those shapes; it does not restate them.
precedence: This is a program reference, not a canon artifact, so it holds no canon precedence rank. It DEFERS: on any conflict about what a transition MEANS, JPWB-DOC-003 controls (it owns that concern); on any conflict about the exact transition rows or error codes, the repository controls (transitions.data.ts, the generated contracts). It owns only the enumerated legality obligation that binds a command to its machine's in-arrows, for the JAN-CMDPRE program.
changeProcedure: A divergence between this reference and the code is classified under JPWB-DOC-004 §8 (the canon's divergence method, which this program follows); a refinement is a JAN-CMDPRE program decision, recorded in this document's findings log and JAN-CMDPRE-DR-001 — not a canon (REG-005) act. Never changed by silent edit.
ratification: NOT SOUGHT — this is a program reference, not canon. Authored under the sponsor's 2026-07-24 deep-specification grant. Every row authored beyond a ratified repository transition is marked UNRATIFIED-AUTHORED; the forks in §6 are sponsor decisions FOR THE PROGRAM (F-2/F-3/F-4/F-5 adopted 2026-07-24 — see §6). Should the sponsor later choose to elevate this concern into the canon SPEC-nnn series, that would be a separate REG-005 act.
---

# JAN-CMDPRE-SPEC-001 — Command Precondition and Transition Legality

> **What this document is.** A JAN-CMDPRE program deep reference — the exhaustive, normative backbone the JAN-CMDPRE remediation increments (DWP-nn) implement against. It is **informed by** the canon but is **not** a canon artifact and not a member of the JPWB-SPEC-nnn series (see the `classification` field above). Section references to DOC-002/003/004 and CON-000 are DEFERENCE — the canon owns those concerns; this reference cites them.

## 1. Scope and relation to the canon (informed by, not part of)

### 1.1 What this specification is

This is the deep reference specification for **command precondition legality** — the obligation, on every state-advancing command, to declare and enforce the set of source states from which it may legally be issued, so that a command re-issued against an aggregate already in (or past) its target state is **refused**, not silently re-applied. It is the enumerated obligation surface a JAN-CMDPRE implementer loads before touching this ground (following JPWB-DOC-004 §2.1's load-order discipline), and that the JAN-CMDPRE program (design authority `JAN-CMDPRE-DS-001`; roadmap `JAN-CMDPRE-DR-001`) implements increment by increment. Per the commission's genre grant, exhaustive enumeration is the deliverable; brevity here is a defect, because a command whose contract row this document omits is a command the implementation cannot be held to.

### 1.2 Why it exists — the harm, stated once

Accepted semantic changes produce immutable events; history is append-only and corrected only forward (JPWB-CON-000 AX-7; JPWB-DOC-003 §9 / PER-2). The engine's transition classifier reports a same-state move (`from === to`) as a **NOOP**, and the shared write primitive admits a NOOP as legal. The consequence: a command re-issued against an aggregate **already** in its target state runs its whole write path — re-runs the mutate, bumps the revision (and, where the caller bumps it, the semantic version), and appends a fresh, immutable event whose payload may **contradict** the first — for a change **that did not happen**. An event recording a change that did not happen is a false entry in a record that has no retraction mechanism. This SPEC exists to make the precondition that forbids this **explicit and performed at every write site**, so that the safety of the sites that are safe today stops being an accident of one helper's undocumented behavior (see INV-2, INV-6).

### 1.3 Relation to JPWB-DOC-003

DOC-003 §6 owns the **meaning** of the state axes and their transition guards (STA-1 … STA-8) and states plainly that "the exact state enumerations and the closed transition/guard tables are repository shapes; the meanings and guards below are semantic requirements those tables must implement." This program reference carries that enumerated table — deferring to DOC-003 on meaning (DOC-003 owns the concern; CON-000 B1), and citing the repository shape (`packages/rph-domain/src/transitions.data.ts`) as authority for every row. Where an invariant here restates a DOC-003 requirement, it cites DOC-003 and does not duplicate it (DOC-004 §10.5). The precondition obligation itself is **additive** to DOC-003 §6: DOC-003 §6 names which transitions are legal; this SPEC names, per command, which of a machine's legal in-arrows that specific command may drive — a narrower question DOC-003 §6 leaves to the command layer, because several distinct commands can drive the same arrow from different sources.

### 1.4 Scope boundary for this DRAFT (v0.1.0)

The **state-machine catalog (§2) is complete**: all 26 aggregate transition machines in `transitions.data.ts`. The **per-command contract catalog (§3) is complete at classification grain for all 84 registered handlers** — every command carries its honestly-classified current precondition mechanism. **Full remediation contracts (the authored target set + fixture obligation) are specified exhaustively for the governance and assurance families — DWP-04's ground — and for the families the JAN-CMDPRE series has already hardened (intent, evidence/assumption, decomposition/recomposition, runtime-binding, execution step-level).** The **execution PLAN-level re-issue *target* semantics and the pwa-authoring publication-lifecycle remainder** are classified here (their current mechanism is enumerated in §3.1) but their authored target sets are deferred to the continuation forks (F-1, F-6) and the Deliberately Unspecified table (§7), because `JAN-CMDPRE-DR-001` DWP-05 records those exposures as `knowledge_status: PARTIAL` — specifying their target now would be inventing a settled fact the program has not yet established (JPWB-CON-000 AX-8: fail closed; file, do not invent). This is minimum-scope-plus-hardened-families exhaustive, with the genuinely-unestablished remainder tabled — not the whole thinned to touch more.

## 2. State-machine catalog

Every aggregate transition machine in `packages/rph-domain/src/transitions.data.ts`, cited by line. For each: the ordered state list, the terminal states, every transition row (`from → to`, trigger, guard, and its exact line), the explicit `illegal[]` rows, and the in-arrow set per target state (the raw material of every command precondition in §3). A guard string here is the machine's **declared** guard intent; whether and where it is **performed** in code is §3's per-command concern. Two non-transition entries in the same table are noted and excluded: `AggregateAssuranceDisposition` (`transitions.data.ts:1591`) and any `initialState: undefined` rollup carry no transitions and are computed dispositions, not state machines.

### ValidatorRegistryEntry.status  (transitions.data.ts:1607-1615)
States: ACTIVE, DEGRADED, DISABLED
Terminal: (none)

| from | to | trigger | guard | line |
|---|---|---|---|---|
illegal[]: (empty)

### PWA.publicationStatus  (transitions.data.ts:1616-1630)
States: DRAFT, UNDER_REVIEW, VALIDATED, PUBLISHED, DEPRECATED, RETIRED
Terminal: RETIRED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| DRAFT | UNDER_REVIEW | submit for review |  | 1622 |
| UNDER_REVIEW | VALIDATED | validate |  | 1623 |
| VALIDATED | PUBLISHED | publish |  | 1624 |
| PUBLISHED | DEPRECATED | deprecate |  | 1625 |
| DEPRECATED | RETIRED | retire |  | 1626 |
illegal[]: (empty)
in-arrows: UNDER_REVIEW<-[DRAFT]; VALIDATED<-[UNDER_REVIEW]; PUBLISHED<-[VALIDATED]; DEPRECATED<-[PUBLISHED]; RETIRED<-[DEPRECATED]

### PwuType.status  (transitions.data.ts:1631-1642)
States: DRAFT, PUBLISHED, DEPRECATED
Terminal: DEPRECATED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| DRAFT | PUBLISHED | publish via PWA |  | 1637 |
| PUBLISHED | DEPRECATED | deprecate via PWA |  | 1638 |
illegal[]: (empty)
in-arrows: PUBLISHED<-[DRAFT]; DEPRECATED<-[PUBLISHED]

### Undertaking.status  (transitions.data.ts:1643-1655)
States: ACTIVE, MIGRATING, ARCHIVED
Terminal: ARCHIVED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| ACTIVE | MIGRATING | begin migration |  | 1649 |
| MIGRATING | ACTIVE | complete migration |  | 1650 |
| ACTIVE | ARCHIVED | archive |  | 1651 |
illegal[]: (empty)
in-arrows: MIGRATING<-[ACTIVE]; ACTIVE<-[MIGRATING]; ARCHIVED<-[ACTIVE]

### Harness.status  (transitions.data.ts:1656-1690)
States: FRAMING, PLANNING, COORDINATING, WAITING, SYNTHESIZING, COMPLETED, ESCALATED, SUSPENDED, SUPERSEDED
Terminal: COMPLETED, SUPERSEDED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| FRAMING | PLANNING | objective + scope + authority framed |  | 1672 |
| PLANNING | COORDINATING | plan approved; allocation begins |  | 1673 |
| COORDINATING | WAITING | durable wait on a dependency/callback |  | 1674 |
| WAITING | COORDINATING | wait resolved / restart recovery resumes |  | 1675 |
| COORDINATING | SYNTHESIZING | child results ready for synthesis |  | 1676 |
| SYNTHESIZING | COORDINATING | synthesis reveals more work |  | 1677 |
| SYNTHESIZING | COMPLETED | parent coherence synthesized + accepted |  | 1678 |
| COORDINATING | ESCALATED | insufficient authority / no-progress |  | 1679 |
| WAITING | ESCALATED | timeout / stuck |  | 1680 |
| ESCALATED | COORDINATING | escalation resolved by authority |  | 1681 |
| COORDINATING | SUSPENDED | suspend |  | 1682 |
| SUSPENDED | COORDINATING | resume |  | 1683 |
| FRAMING | SUPERSEDED | harness superseded |  | 1684 |
| PLANNING | SUPERSEDED | harness superseded |  | 1685 |
| COORDINATING | SUPERSEDED | harness superseded |  | 1686 |
illegal[]: (empty)
in-arrows: PLANNING<-[FRAMING]; COORDINATING<-[PLANNING,WAITING,SYNTHESIZING,ESCALATED,SUSPENDED]; WAITING<-[COORDINATING]; SYNTHESIZING<-[COORDINATING]; COMPLETED<-[SYNTHESIZING]; ESCALATED<-[COORDINATING,WAITING]; SUSPENDED<-[COORDINATING]; SUPERSEDED<-[FRAMING,PLANNING,COORDINATING]

### ExecutionPlan.status  (transitions.data.ts:1355-1420)
States: PROPOSED, UNDER_REVIEW, APPROVED, ACTIVE, COMPLETED, FAILED, SUPERSEDED, CANCELLED
Terminal: COMPLETED, FAILED, SUPERSEDED, CANCELLED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| PROPOSED | UNDER_REVIEW | proposeExecutionPlan / ExecutionPlanProposed then submitted for review |  | 1371 |
| UNDER_REVIEW | APPROVED | approveExecutionPlan / ExecutionPlanApproved | plan approval required before irreversible execution for high-risk work; approval grants NO runtime privileges (§20.2) | 1376 |
| APPROVED | ACTIVE | activateExecutionPlan / ExecutionPlanActivated | a PWU may have only ONE active plan at a time; an active plan references exactly one PWU (§20.2) | 1383 |
| ACTIVE | COMPLETED | all steps succeeded |  | 1389 |
| ACTIVE | FAILED | ExecutionTerminated / unrecoverable failure |  | 1390 |
| APPROVED | CANCELLED | cancelExecutionPlan |  | 1391 |
| ACTIVE | CANCELLED | cancelExecutionPlan |  | 1392 |
| PROPOSED | SUPERSEDED | ExecutionPlanSuperseded (plan revision) | plan revision preserves prior attempt history (§20.2) | 1394 |
| UNDER_REVIEW | SUPERSEDED | ExecutionPlanSuperseded (plan revision) | plan revision preserves prior attempt history (§20.2) | 1400 |
| APPROVED | SUPERSEDED | ExecutionPlanSuperseded (plan revision) | plan revision preserves prior attempt history (§20.2) | 1406 |
| ACTIVE | SUPERSEDED | ExecutionPlanSuperseded (plan revision) | plan revision preserves prior attempt history (§20.2) | 1412 |
illegal[]: (empty)
in-arrows: UNDER_REVIEW<-[PROPOSED]; APPROVED<-[UNDER_REVIEW]; ACTIVE<-[APPROVED]; COMPLETED<-[ACTIVE]; FAILED<-[ACTIVE]; CANCELLED<-[APPROVED,ACTIVE]; SUPERSEDED<-[PROPOSED,UNDER_REVIEW,APPROVED,ACTIVE]

### ExecutionStep.stepState  (transitions.data.ts:1421-1488)
States: NOT_READY, READY, QUEUED, RUNNING, WAITING, SUCCEEDED, FAILED, SKIPPED, CANCELLED, SUPERSEDED
Terminal: SUCCEEDED, FAILED, SKIPPED, CANCELLED, SUPERSEDED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| NOT_READY | READY | ExecutionStepReady | a step cannot run until preconditions are satisfied (§21.1) | 1439 |
| READY | QUEUED | step scheduled |  | 1444 |
| QUEUED | RUNNING | startExecutionStep / ExecutionStepStarted |  | 1445 |
| RUNNING | WAITING | ExecutionStepWaiting |  | 1446 |
| WAITING | RUNNING | wait resolved |  | 1447 |
| RUNNING | SUCCEEDED | completeExecutionStep / ExecutionStepSucceeded | must record outputs or an explicit no-output result; step success does NOT imply PWU success (§21.1) | 1449 |
| RUNNING | FAILED | failExecutionStep / ExecutionStepFailed |  | 1455 |
| FAILED | QUEUED | retryExecutionStep / ExecutionStepRetried |  | 1456 |
| READY | SKIPPED | ExecutionStepSkipped | a skipped MANDATORY step requires an authorized plan revision or waiver (§21.1) | 1458 |
| QUEUED | SKIPPED | ExecutionStepSkipped | a skipped MANDATORY step requires an authorized plan revision or waiver (§21.1) | 1464 |
| READY | CANCELLED | ExecutionStepCancelled |  | 1469 |
| QUEUED | CANCELLED | ExecutionStepCancelled |  | 1470 |
| RUNNING | CANCELLED | ExecutionStepCancelled |  | 1471 |
| WAITING | CANCELLED | ExecutionStepCancelled |  | 1472 |
| NOT_READY | SUPERSEDED | plan revised/superseded |  | 1473 |
| READY | SUPERSEDED | plan revised/superseded |  | 1474 |
| QUEUED | SUPERSEDED | plan revised/superseded |  | 1475 |
| RUNNING | SUPERSEDED | plan revised/superseded |  | 1476 |
| WAITING | SUPERSEDED | plan revised/superseded |  | 1477 |
illegal[]: NOT_READY->RUNNING@1481
in-arrows: READY<-[NOT_READY]; QUEUED<-[READY,FAILED]; RUNNING<-[QUEUED,WAITING]; WAITING<-[RUNNING]; SUCCEEDED<-[RUNNING]; FAILED<-[RUNNING]; SKIPPED<-[READY,QUEUED]; CANCELLED<-[READY,QUEUED,RUNNING,WAITING]; SUPERSEDED<-[NOT_READY,READY,QUEUED,RUNNING,WAITING]

### RuntimeBinding.authorizationStatus  (transitions.data.ts:1489-1515)
States: REQUESTED, AUTHORIZED, PARTIALLY_AUTHORIZED, DENIED, REVOKED
Terminal: DENIED, REVOKED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| REQUESTED | AUTHORIZED | RuntimeBindingAuthorized | requested capability is NOT granted capability; capability scope must be explicit (§22.1) | 1496 |
| REQUESTED | PARTIALLY_AUTHORIZED | partial grant |  | 1502 |
| REQUESTED | DENIED | RuntimeBindingDenied |  | 1503 |
| PARTIALLY_AUTHORIZED | AUTHORIZED | new authorization event (privilege expansion) | privilege expansion requires a NEW authorization event (§22.1) | 1505 |
| AUTHORIZED | REVOKED | RuntimeCapabilityRevoked |  | 1510 |
| PARTIALLY_AUTHORIZED | REVOKED | RuntimeCapabilityRevoked |  | 1511 |
illegal[]: (empty)
in-arrows: AUTHORIZED<-[REQUESTED,PARTIALLY_AUTHORIZED]; PARTIALLY_AUTHORIZED<-[REQUESTED]; DENIED<-[REQUESTED]; REVOKED<-[AUTHORIZED,PARTIALLY_AUTHORIZED]

### Decision.status  (transitions.data.ts:1516-1541)
States: PROPOSED, EFFECTIVE, REVOKED, SUPERSEDED
Terminal: REVOKED, SUPERSEDED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| PROPOSED | EFFECTIVE | approveDecision / DecisionApproved → DecisionEffective | approval requires authority; an agent may recommend but cannot exercise authority unless delegated (§23.2) | 1523 |
| EFFECTIVE | REVOKED | revokeDecision / DecisionRevoked | revocation triggers impact analysis; a decision cannot retroactively change evidence (§23.2) | 1530 |
| PROPOSED | SUPERSEDED | DecisionRejected / decision superseded |  | 1536 |
| EFFECTIVE | SUPERSEDED | decision superseded |  | 1537 |
illegal[]: (empty)
in-arrows: EFFECTIVE<-[PROPOSED]; REVOKED<-[EFFECTIVE]; SUPERSEDED<-[PROPOSED,EFFECTIVE]

### Baseline.status  (transitions.data.ts:1542-1590)
States: DRAFT, CANDIDATE, UNDER_REVIEW, APPROVED, AUTHORITATIVE, SUPERSEDED, REVOKED
Terminal: SUPERSEDED, REVOKED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| DRAFT | CANDIDATE | BaselineCreated / nominated as candidate |  | 1556 |
| CANDIDATE | UNDER_REVIEW | BaselineSubmittedForReview |  | 1557 |
| UNDER_REVIEW | APPROVED | BaselineApproved | open BLOCKING observations prevent promotion unless waived (§24.2) | 1559 |
| APPROVED | AUTHORITATIVE | promoteBaseline / BaselinePromoted | requires an explicit EFFECTIVE promotion decision (§23.2, §24.2); promotion evidence must be retained; promotion is a governance event, not an execution step (§24.2) | 1565 |
| AUTHORITATIVE | SUPERSEDED | supersedeBaseline / BaselineSuperseded | an authoritative baseline is immutable — changes create a SUCCESSOR baseline; supersession preserves traceability (§24.2) | 1572 |
| APPROVED | REVOKED | BaselineRevoked |  | 1578 |
| AUTHORITATIVE | REVOKED | BaselineRevoked |  | 1579 |
illegal[]: UNDER_REVIEW->AUTHORITATIVE@1583
in-arrows: CANDIDATE<-[DRAFT]; UNDER_REVIEW<-[CANDIDATE]; APPROVED<-[UNDER_REVIEW]; AUTHORITATIVE<-[APPROVED]; SUPERSEDED<-[AUTHORITATIVE]; REVOKED<-[APPROVED,AUTHORITATIVE]

### Obligation.status  (transitions.data.ts:653-715)
States: PROPOSED, ACTIVE, ALLOCATED, SATISFIED, WAIVED, VIOLATED, SUPERSEDED
Terminal: SATISFIED, WAIVED, VIOLATED, SUPERSEDED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| PROPOSED | ACTIVE | obligation activated/accepted |  | 659 |
| ACTIVE | ALLOCATED | ObligationAllocated | explicit allocation to a child PWU — a child may satisfy a parent obligation only through explicit allocation (§10.2) | 661 |
| ACTIVE | SATISFIED | ObligationSatisfied | requires a supported claim — NOT merely because a related PWU is completed (§10.2) | 668 |
| ALLOCATED | SATISFIED | ObligationSatisfied | requires a supported claim — NOT merely because a related PWU is completed (§10.2) | 674 |
| ACTIVE | WAIVED | ObligationWaived | a waived mandatory obligation requires an authorized waiver (§10.2) | 681 |
| ALLOCATED | WAIVED | ObligationWaived | a waived mandatory obligation requires an authorized waiver (§10.2) | 687 |
| ACTIVE | VIOLATED | ObligationViolated | a violated obligation must affect assurance disposition (§10.2) | 693 |
| ALLOCATED | VIOLATED | ObligationViolated | a violated obligation must affect assurance disposition (§10.2) | 699 |
| ACTIVE | SUPERSEDED | obligation superseded |  | 703 |
| ALLOCATED | SUPERSEDED | obligation superseded |  | 704 |
illegal[]: (empty)
in-arrows: ACTIVE<-[PROPOSED]; ALLOCATED<-[ACTIVE]; SATISFIED<-[ACTIVE,ALLOCATED]; WAIVED<-[ACTIVE,ALLOCATED]; VIOLATED<-[ACTIVE,ALLOCATED]; SUPERSEDED<-[ACTIVE,ALLOCATED]

### Constraint.status  (transitions.data.ts:716-758)
States: PROPOSED, ACTIVE, WAIVED, INAPPLICABLE, VIOLATED, SUPERSEDED, INVALIDATED
Terminal: WAIVED, INAPPLICABLE, VIOLATED, SUPERSEDED, INVALIDATED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| PROPOSED | ACTIVE | ConstraintAdded / activated |  | 730 |
| ACTIVE | WAIVED | ConstraintWaived | waived through authority (§11.2) | 732 |
| ACTIVE | INAPPLICABLE | ConstraintDeclaredInapplicable | marked inapplicable with rationale (§11.2) | 738 |
| ACTIVE | VIOLATED | ConstraintViolated |  | 743 |
| ACTIVE | SUPERSEDED | ConstraintSuperseded | superseded by a stronger constraint (§11.2) | 745 |
| ACTIVE | INVALIDATED | mandatory constraint change / invalidation (§29.1) |  | 751 |
illegal[]: (empty)
in-arrows: ACTIVE<-[PROPOSED]; WAIVED<-[ACTIVE]; INAPPLICABLE<-[ACTIVE]; VIOLATED<-[ACTIVE]; SUPERSEDED<-[ACTIVE]; INVALIDATED<-[ACTIVE]

### Assumption.status  (transitions.data.ts:759-859)
States: PROPOSED, DISCLOSED, UNDER_VERIFICATION, ACCEPTED, VERIFIED, FALSIFIED, EXPIRED, SUPERSEDED
Terminal: VERIFIED, FALSIFIED, EXPIRED, SUPERSEDED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| PROPOSED | DISCLOSED | AssumptionDisclosed (from AssumptionDetected) | no material assumption may remain embedded only in model prose (§12.2) | 775 |
| DISCLOSED | UNDER_VERIFICATION | AssumptionVerificationStarted |  | 780 |
| DISCLOSED | ACCEPTED | AssumptionAccepted | a critical assumption must be explicitly accepted by authority before dependent irreversible work; ACCEPTED is NOT equivalent to VERIFIED (§12.2) | 782 |
| UNDER_VERIFICATION | ACCEPTED | AssumptionAccepted | a critical assumption must be explicitly accepted by authority before dependent irreversible work; ACCEPTED is NOT equivalent to VERIFIED (§12.2) | 789 |
| UNDER_VERIFICATION | VERIFIED | AssumptionVerified |  | 795 |
| DISCLOSED | FALSIFIED | AssumptionFalsified | falsification triggers impact analysis (§12.2); drives PWU.shapeIntegrityState to AT_RISK/VIOLATED (§39 Scenario 2) | 797 |
| UNDER_VERIFICATION | FALSIFIED | AssumptionFalsified | falsification triggers impact analysis (§12.2); drives PWU.shapeIntegrityState to AT_RISK/VIOLATED (§39 Scenario 2) | 804 |
| ACCEPTED | FALSIFIED | AssumptionFalsified | falsification triggers impact analysis (§12.2); drives PWU.shapeIntegrityState to AT_RISK/VIOLATED (§39 Scenario 2) | 811 |
| VERIFIED | FALSIFIED | AssumptionFalsified | falsification triggers impact analysis (§12.2); drives PWU.shapeIntegrityState to AT_RISK/VIOLATED (§39 Scenario 2) | 818 |
| PROPOSED | EXPIRED | AssumptionExpired | expirationCondition met; expired assumptions cannot continue authorizing work (§12.2) | 825 |
| DISCLOSED | EXPIRED | AssumptionExpired | expirationCondition met; expired assumptions cannot continue authorizing work (§12.2) | 832 |
| UNDER_VERIFICATION | EXPIRED | AssumptionExpired | expirationCondition met; expired assumptions cannot continue authorizing work (§12.2) | 839 |
| ACCEPTED | EXPIRED | AssumptionExpired | expirationCondition met; expired assumptions cannot continue authorizing work (§12.2) | 846 |
| PROPOSED | SUPERSEDED | assumption superseded |  | 852 |
| DISCLOSED | SUPERSEDED | assumption superseded |  | 853 |
| UNDER_VERIFICATION | SUPERSEDED | assumption superseded |  | 854 |
| ACCEPTED | SUPERSEDED | assumption superseded |  | 855 |
illegal[]: (empty)
in-arrows: DISCLOSED<-[PROPOSED]; UNDER_VERIFICATION<-[DISCLOSED]; ACCEPTED<-[DISCLOSED,UNDER_VERIFICATION]; VERIFIED<-[UNDER_VERIFICATION]; FALSIFIED<-[DISCLOSED,UNDER_VERIFICATION,ACCEPTED,VERIFIED]; EXPIRED<-[PROPOSED,DISCLOSED,UNDER_VERIFICATION,ACCEPTED]; SUPERSEDED<-[PROPOSED,DISCLOSED,UNDER_VERIFICATION,ACCEPTED]

### Claim.status  (transitions.data.ts:963-1026)
States: OPEN, UNDER_ASSESSMENT, SUPPORTED, CONDITIONALLY_SUPPORTED, CONTESTED, REJECTED, WAIVED, SUPERSEDED
Terminal: REJECTED, WAIVED, SUPERSEDED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| OPEN | UNDER_ASSESSMENT | assertClaim then requestAssuranceAssessment / assessment begins | a claim must have a subject (§15.2) | 979 |
| UNDER_ASSESSMENT | SUPPORTED | ClaimSupported | must reference admissible evidence; confidence values must not replace evidence (§15.2) | 985 |
| UNDER_ASSESSMENT | CONDITIONALLY_SUPPORTED | conditional assessment disposition |  | 992 |
| UNDER_ASSESSMENT | CONTESTED | ClaimContested / EvidenceInvalidated (dependent supported claim) | contradicting evidence must remain visible (§15.2) | 997 |
| SUPPORTED | CONTESTED | ClaimContested / EvidenceInvalidated (dependent supported claim) | contradicting evidence must remain visible (§15.2) | 1003 |
| CONDITIONALLY_SUPPORTED | CONTESTED | ClaimContested / EvidenceInvalidated (dependent supported claim) | contradicting evidence must remain visible (§15.2) | 1009 |
| UNDER_ASSESSMENT | REJECTED | ClaimRejected |  | 1014 |
| CONTESTED | REJECTED | ClaimRejected |  | 1015 |
| CONTESTED | WAIVED | WaiverGranted |  | 1016 |
| UNDER_ASSESSMENT | WAIVED | WaiverGranted |  | 1017 |
| OPEN | SUPERSEDED | claim superseded |  | 1018 |
| UNDER_ASSESSMENT | SUPERSEDED | claim superseded |  | 1019 |
| SUPPORTED | SUPERSEDED | claim superseded |  | 1020 |
| CONDITIONALLY_SUPPORTED | SUPERSEDED | claim superseded |  | 1021 |
| CONTESTED | SUPERSEDED | claim superseded |  | 1022 |
illegal[]: (empty)
in-arrows: UNDER_ASSESSMENT<-[OPEN]; SUPPORTED<-[UNDER_ASSESSMENT]; CONDITIONALLY_SUPPORTED<-[UNDER_ASSESSMENT]; CONTESTED<-[UNDER_ASSESSMENT,SUPPORTED,CONDITIONALLY_SUPPORTED]; REJECTED<-[UNDER_ASSESSMENT,CONTESTED]; WAIVED<-[CONTESTED,UNDER_ASSESSMENT]; SUPERSEDED<-[OPEN,UNDER_ASSESSMENT,SUPPORTED,CONDITIONALLY_SUPPORTED,CONTESTED]

### Evidence.status  (transitions.data.ts:1027-1055)
States: PROPOSED, ADMISSIBLE, REJECTED, SUPERSEDED, INVALIDATED
Terminal: REJECTED, SUPERSEDED, INVALIDATED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| PROPOSED | ADMISSIBLE | admitEvidence / EvidenceAdmitted | evidence must have provenance and state scope + limitations (§16.2) | 1034 |
| PROPOSED | REJECTED | EvidenceRejected |  | 1039 |
| ADMISSIBLE | INVALIDATED | invalidateEvidence / EvidenceInvalidated / EvidenceExpired | invalidated evidence cannot support an active claim; expiration triggers reassessment of dependent claims (§16.2) | 1041 |
| ADMISSIBLE | SUPERSEDED | correction creates a new version (evidence immutability preferred, §16.2) |  | 1048 |
illegal[]: (empty)
in-arrows: ADMISSIBLE<-[PROPOSED]; REJECTED<-[PROPOSED]; INVALIDATED<-[ADMISSIBLE]; SUPERSEDED<-[ADMISSIBLE]

### Intent.intentStatus  (transitions.data.ts:35-128)
States: RAW, UNDER_DISCOVERY, PROVISIONAL, FORMALIZED, APPROVED, REVISED, SUPERSEDED, WITHDRAWN
Terminal: SUPERSEDED, WITHDRAWN

| from | to | trigger | guard | line |
|---|---|---|---|---|
| RAW | UNDER_DISCOVERY | Begin discovery | Originating expression exists | 51 |
| UNDER_DISCOVERY | PROVISIONAL | Create provisional intent | Objective and known ambiguities recorded | 57 |
| PROVISIONAL | FORMALIZED | Formalize | Outcomes, non-goals, and constraints defined | 63 |
| FORMALIZED | APPROVED | Approve | Authorized decision exists | 69 |
| APPROVED | REVISED | Revise | Change rationale and impact analysis initiated | 75 |
| REVISED | APPROVED | Approve revision | Revised intent receives authorization | 81 |
| RAW | SUPERSEDED | Supersede | Replacement intent identified | 87 |
| UNDER_DISCOVERY | SUPERSEDED | Supersede | Replacement intent identified | 93 |
| PROVISIONAL | SUPERSEDED | Supersede | Replacement intent identified | 99 |
| FORMALIZED | SUPERSEDED | Supersede | Replacement intent identified | 105 |
| APPROVED | SUPERSEDED | Supersede | Replacement intent identified | 111 |
| REVISED | SUPERSEDED | Supersede | Replacement intent identified | 117 |
| RAW | WITHDRAWN | Withdraw | Authorized actor | 122 |
| UNDER_DISCOVERY | WITHDRAWN | Withdraw | Authorized actor | 123 |
| PROVISIONAL | WITHDRAWN | Withdraw | Authorized actor | 124 |
illegal[]: (empty)
in-arrows: UNDER_DISCOVERY<-[RAW]; PROVISIONAL<-[UNDER_DISCOVERY]; FORMALIZED<-[PROVISIONAL]; APPROVED<-[FORMALIZED,REVISED]; REVISED<-[APPROVED]; SUPERSEDED<-[RAW,UNDER_DISCOVERY,PROVISIONAL,FORMALIZED,APPROVED,REVISED]; WITHDRAWN<-[RAW,UNDER_DISCOVERY,PROVISIONAL]

### PWU.workLifecycleState  (transitions.data.ts:129-479)
States: PROPOSED, SHAPING, READY, PLANNED, EXECUTING, EVIDENCE_PENDING, UNDER_ASSURANCE, CONDITIONALLY_SATISFIED, SATISFIED, RECOMPOSING, RECOMPOSED, BASELINED, BLOCKED, CHALLENGED, RESHAPING, ESCALATED, INVALIDATED, REJECTED, ABANDONED, SUPERSEDED
Terminal: BASELINED, ABANDONED, SUPERSEDED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| PROPOSED | SHAPING | Begin shaping (PwuShapingStarted) | Intent exists | 157 |
| SHAPING | READY | Mark ready (markPwuReady; PwuMarkedReady) | Shape readiness policy satisfied (§9 Shape Readiness Profile) | 163 |
| READY | PLANNED | Approve plan | Active execution plan approved | 169 |
| PLANNED | EXECUTING | Start execution | Runtime bindings authorized | 175 |
| EXECUTING | EVIDENCE_PENDING | Record execution success | CROSS-AXIS guard: executionState=SUCCEEDED. Success does NOT auto-satisfy assurance (P1/INV-5). | 181 |
| EVIDENCE_PENDING | UNDER_ASSURANCE | Begin assurance | Required evidence available or deficit explicitly recorded | 188 |
| UNDER_ASSURANCE | CONDITIONALLY_SATISFIED | Conditionally satisfy | Conditional disposition exists | 194 |
| UNDER_ASSURANCE | SATISFIED | Satisfy | CROSS-AXIS guard: assuranceState=SATISFIED. This is the ONLY legal path into workLifecycle SATISFIED (P1/INV-5). | 200 |
| SATISFIED | RECOMPOSING | Begin recomposition (beginRecomposition; RecompositionStarted) | Parent exists and recomposition is required | 207 |
| RECOMPOSING | RECOMPOSED | Complete recomposition (completeRecomposition; RecompositionCompleted) | Recomposition contract satisfied | 213 |
| SATISFIED | BASELINED | Promote baseline (promoteBaseline; BaselinePromoted) | Authorized promotion decision | 219 |
| RECOMPOSED | BASELINED | Promote baseline (promoteBaseline; BaselinePromoted) | Authorized promotion decision | 225 |
| SHAPING | BLOCKED | Missing information |  | 230 |
| READY | CHALLENGED | Shape challenge (challengePwu; PwuChallenged) |  | 231 |
| PLANNED | BLOCKED | Runtime dependency unavailable |  | 232 |
| EXECUTING | BLOCKED | Runtime dependency unavailable |  | 233 |
| EXECUTING | RESHAPING | Material assumption falsified (reshapePwu; PwuReshapingStarted) |  | 235 |
| EVIDENCE_PENDING | ESCALATED | Evidence impossible to obtain |  | 239 |
| UNDER_ASSURANCE | REJECTED | Blocking finding |  | 240 |
| UNDER_ASSURANCE | RESHAPING | Blocking finding |  | 241 |
| CONDITIONALLY_SATISFIED | INVALIDATED | Condition violated |  | 242 |
| SATISFIED | INVALIDATED | Upstream change (invalidatePwu; PwuInvalidated — §29 triggers) |  | 244 |
| RECOMPOSED | INVALIDATED | Sibling conflict discovered |  | 248 |
| PROPOSED | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 250 |
| SHAPING | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 256 |
| READY | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 262 |
| PLANNED | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 268 |
| EXECUTING | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 274 |
| EVIDENCE_PENDING | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 280 |
| UNDER_ASSURANCE | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 286 |
| CONDITIONALLY_SATISFIED | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 292 |
| SATISFIED | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 298 |
| RECOMPOSING | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 304 |
| RECOMPOSED | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 310 |
| BLOCKED | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 316 |
| CHALLENGED | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 322 |
| RESHAPING | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 328 |
| ESCALATED | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 334 |
| INVALIDATED | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 340 |
| REJECTED | ABANDONED | Authorized abandonment (PwuAbandoned) | Authorized decision (Decision.decisionType=ABANDON) | 346 |
| PROPOSED | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 352 |
| SHAPING | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 358 |
| READY | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 364 |
| PLANNED | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 370 |
| EXECUTING | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 376 |
| EVIDENCE_PENDING | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 382 |
| UNDER_ASSURANCE | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 388 |
| CONDITIONALLY_SATISFIED | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 394 |
| SATISFIED | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 400 |
| RECOMPOSING | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 406 |
| RECOMPOSED | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 412 |
| BLOCKED | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 418 |
| CHALLENGED | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 424 |
| RESHAPING | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 430 |
| ESCALATED | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 436 |
| INVALIDATED | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 442 |
| REJECTED | SUPERSEDED | Replacement PWU created (supersedePwu; PwuSuperseded) | Not already BASELINED | 448 |
illegal[]: PROPOSED->EXECUTING@456, SHAPING->SATISFIED@460, READY->BASELINED@461, EXECUTING->SATISFIED@463, INVALIDATED->BASELINED@468, SUPERSEDED->EXECUTING@469, ABANDONED->READY@470, BASELINED->EXECUTING@472
in-arrows: SHAPING<-[PROPOSED]; READY<-[SHAPING]; PLANNED<-[READY]; EXECUTING<-[PLANNED]; EVIDENCE_PENDING<-[EXECUTING]; UNDER_ASSURANCE<-[EVIDENCE_PENDING]; CONDITIONALLY_SATISFIED<-[UNDER_ASSURANCE]; SATISFIED<-[UNDER_ASSURANCE]; RECOMPOSING<-[SATISFIED]; RECOMPOSED<-[RECOMPOSING]; BASELINED<-[SATISFIED,RECOMPOSED]; BLOCKED<-[SHAPING,PLANNED,EXECUTING]; CHALLENGED<-[READY]; RESHAPING<-[EXECUTING,UNDER_ASSURANCE]; ESCALATED<-[EVIDENCE_PENDING]; REJECTED<-[UNDER_ASSURANCE]; INVALIDATED<-[CONDITIONALLY_SATISFIED,SATISFIED,RECOMPOSED]; ABANDONED<-[PROPOSED,SHAPING,READY,PLANNED,EXECUTING,EVIDENCE_PENDING,UNDER_ASSURANCE,CONDITIONALLY_SATISFIED,SATISFIED,RECOMPOSING,RECOMPOSED,BLOCKED,CHALLENGED,RESHAPING,ESCALATED,INVALIDATED,REJECTED]; SUPERSEDED<-[PROPOSED,SHAPING,READY,PLANNED,EXECUTING,EVIDENCE_PENDING,UNDER_ASSURANCE,CONDITIONALLY_SATISFIED,SATISFIED,RECOMPOSING,RECOMPOSED,BLOCKED,CHALLENGED,RESHAPING,ESCALATED,INVALIDATED,REJECTED]

### PWU.executionState  (transitions.data.ts:480-533)
States: NOT_PLANNED, PLANNED, QUEUED, RUNNING, WAITING, RETRYING, SUCCEEDED, FAILED, CANCELLED, SUPERSEDED
Terminal: SUCCEEDED, FAILED, CANCELLED, SUPERSEDED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| NOT_PLANNED | PLANNED | ExecutionPlanApproved / plan approved |  | 497 |
| PLANNED | QUEUED | ExecutionPlanActivated / step scheduled |  | 498 |
| QUEUED | RUNNING | ExecutionStepStarted |  | 499 |
| RUNNING | WAITING | ExecutionStepWaiting |  | 500 |
| WAITING | RUNNING | wait resolved |  | 501 |
| RUNNING | RETRYING | ExecutionStepRetried / recoverable failure |  | 502 |
| RETRYING | RUNNING | retry attempt started |  | 503 |
| RUNNING | SUCCEEDED | ExecutionStepSucceeded (all steps) | step outputs recorded or explicit no-output | 505 |
| RUNNING | FAILED | ExecutionStepFailed / retry exhaustion / ExecutionTerminated |  | 511 |
| RETRYING | FAILED | ExecutionStepFailed / retry exhaustion / ExecutionTerminated |  | 516 |
| PLANNED | CANCELLED | cancelExecutionPlan / ExecutionStepCancelled |  | 520 |
| QUEUED | CANCELLED | cancelExecutionPlan / ExecutionStepCancelled |  | 521 |
| RUNNING | CANCELLED | cancelExecutionPlan / ExecutionStepCancelled |  | 522 |
| WAITING | CANCELLED | cancelExecutionPlan / ExecutionStepCancelled |  | 523 |
| NOT_PLANNED | SUPERSEDED | ExecutionPlanSuperseded |  | 524 |
| PLANNED | SUPERSEDED | ExecutionPlanSuperseded |  | 525 |
| QUEUED | SUPERSEDED | ExecutionPlanSuperseded |  | 526 |
| RUNNING | SUPERSEDED | ExecutionPlanSuperseded |  | 527 |
| WAITING | SUPERSEDED | ExecutionPlanSuperseded |  | 528 |
| RETRYING | SUPERSEDED | ExecutionPlanSuperseded |  | 529 |
illegal[]: (empty)
in-arrows: PLANNED<-[NOT_PLANNED]; QUEUED<-[PLANNED]; RUNNING<-[QUEUED,WAITING,RETRYING]; WAITING<-[RUNNING]; RETRYING<-[RUNNING]; SUCCEEDED<-[RUNNING]; FAILED<-[RUNNING,RETRYING]; CANCELLED<-[PLANNED,QUEUED,RUNNING,WAITING]; SUPERSEDED<-[NOT_PLANNED,PLANNED,QUEUED,RUNNING,WAITING,RETRYING]

### PWU.assuranceState  (transitions.data.ts:534-613)
States: NOT_REQUIRED, UNASSESSED, EVIDENCE_REQUIRED, READY_FOR_ASSESSMENT, ASSESSING, CONDITIONALLY_SATISFIED, SATISFIED, REJECTED, WAIVED, INVALIDATED, ESCALATED
Terminal: NOT_REQUIRED, SATISFIED, REJECTED, WAIVED, INVALIDATED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| UNASSESSED | EVIDENCE_REQUIRED | policy requires evidence |  | 552 |
| EVIDENCE_REQUIRED | READY_FOR_ASSESSMENT | EvidenceAdmitted / required evidence available |  | 554 |
| READY_FOR_ASSESSMENT | ASSESSING | AssuranceAssessmentStarted | independence requirements checked before evaluation (§18.1) | 559 |
| ASSESSING | SATISFIED | AssuranceAssessmentSatisfied | criteria met identified; evidence considered identified (§18.1) — NOT forced by executionState=SUCCEEDED (P1/INV-5) | 565 |
| ASSESSING | CONDITIONALLY_SATISFIED | AssuranceAssessmentConditionallySatisfied |  | 572 |
| ASSESSING | REJECTED | AssuranceAssessmentRejected / blocking finding |  | 577 |
| ASSESSING | ESCALATED | AssuranceAssessmentEscalated |  | 581 |
| ASSESSING | WAIVED | WaiverGranted | waiver authority separately defined (§18.1) | 583 |
| EVIDENCE_REQUIRED | WAIVED | WaiverGranted | waiver authority separately defined (§18.1) | 589 |
| CONDITIONALLY_SATISFIED | WAIVED | WaiverGranted | waiver authority separately defined (§18.1) | 595 |
| SATISFIED | INVALIDATED | EvidenceInvalidated / upstream change (§29.1) |  | 601 |
| CONDITIONALLY_SATISFIED | INVALIDATED | EvidenceInvalidated / upstream change (§29.1) |  | 606 |
illegal[]: (empty)
in-arrows: EVIDENCE_REQUIRED<-[UNASSESSED]; READY_FOR_ASSESSMENT<-[EVIDENCE_REQUIRED]; ASSESSING<-[READY_FOR_ASSESSMENT]; SATISFIED<-[ASSESSING]; CONDITIONALLY_SATISFIED<-[ASSESSING]; REJECTED<-[ASSESSING]; ESCALATED<-[ASSESSING]; WAIVED<-[ASSESSING,EVIDENCE_REQUIRED,CONDITIONALLY_SATISFIED]; INVALIDATED<-[SATISFIED,CONDITIONALLY_SATISFIED]

### PWU.shapeIntegrityState  (transitions.data.ts:614-652)
States: UNKNOWN, PRESERVED, AT_RISK, VIOLATED, RESHAPING_REQUIRED, RESHAPING_IN_PROGRESS, RESTORED
Terminal: (none)

| from | to | trigger | guard | line |
|---|---|---|---|---|
| UNKNOWN | PRESERVED | shape validated / shape readiness satisfied |  | 628 |
| PRESERVED | AT_RISK | material assumption falsified / drift detected (SHAPE_RISK observation) |  | 630 |
| PRESERVED | VIOLATED | shape-integrity violation / obligation loss / constraint erosion |  | 635 |
| AT_RISK | VIOLATED | shape-integrity violation / obligation loss / constraint erosion |  | 640 |
| AT_RISK | PRESERVED | risk cleared |  | 644 |
| VIOLATED | RESHAPING_REQUIRED | controller selects RESHAPE (§37) |  | 645 |
| RESHAPING_REQUIRED | RESHAPING_IN_PROGRESS | PwuReshapingStarted |  | 646 |
| RESHAPING_IN_PROGRESS | RESTORED | reshape complete |  | 647 |
| RESTORED | PRESERVED | re-validated |  | 648 |
illegal[]: (empty)
in-arrows: PRESERVED<-[UNKNOWN,AT_RISK,RESTORED]; AT_RISK<-[PRESERVED]; VIOLATED<-[PRESERVED,AT_RISK]; RESHAPING_REQUIRED<-[VIOLATED]; RESHAPING_IN_PROGRESS<-[RESHAPING_REQUIRED]; RESTORED<-[RESHAPING_IN_PROGRESS]

### DecompositionContract.status  (transitions.data.ts:860-905)
States: DRAFT, UNDER_REVIEW, VALID, CONDITIONALLY_VALID, INVALID, SUPERSEDED
Terminal: SUPERSEDED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| DRAFT | UNDER_REVIEW | proposeDecomposition / DecompositionProposed |  | 867 |
| UNDER_REVIEW | VALID | validateDecomposition / DecompositionValidated | obligations allocated/retained, mandatory constraints propagated, siblings explicit; independent validation for high-risk work (§13.2) | 872 |
| UNDER_REVIEW | CONDITIONALLY_VALID | validateDecomposition (conditional) |  | 879 |
| UNDER_REVIEW | INVALID | DecompositionRejected |  | 883 |
| VALID | SUPERSEDED | reviseDecomposition / DecompositionRevised | revision preserves parent identity but increments semantic version (§13.2) | 885 |
| CONDITIONALLY_VALID | SUPERSEDED | reviseDecomposition / DecompositionRevised | revision preserves parent identity but increments semantic version (§13.2) | 891 |
| INVALID | SUPERSEDED | reviseDecomposition / DecompositionRevised | revision preserves parent identity but increments semantic version (§13.2) | 897 |
illegal[]: (empty)
in-arrows: UNDER_REVIEW<-[DRAFT]; VALID<-[UNDER_REVIEW]; CONDITIONALLY_VALID<-[UNDER_REVIEW]; INVALID<-[UNDER_REVIEW]; SUPERSEDED<-[VALID,CONDITIONALLY_VALID,INVALID]

### RecompositionContract.status  (transitions.data.ts:906-962)
States: DRAFT, READY, EVALUATING, COMPOSABLE, CONFLICTED, INSUFFICIENT, SATISFIED, SUPERSEDED
Terminal: SATISFIED, SUPERSEDED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| DRAFT | READY | required children reach acceptable states | all required children satisfied/conditionally-satisfied/waived/superseded via authorized decision (§14.1) | 922 |
| READY | EVALUATING | beginRecomposition / RecompositionStarted |  | 928 |
| EVALUATING | COMPOSABLE | no contradiction found; parent constraints hold against recomposed result |  | 930 |
| EVALUATING | CONFLICTED | RecompositionConflictDetected | recomposition may fail even when all children individually satisfied (§14.1) | 935 |
| EVALUATING | INSUFFICIENT | RecompositionFailed (child evidence does not support the parent claim) |  | 941 |
| COMPOSABLE | SATISFIED | completeRecomposition / RecompositionCompleted | a recomposed result requires an explicit assessment (§14.1) | 946 |
| CONFLICTED | EVALUATING | re-evaluation after remediation |  | 951 |
| INSUFFICIENT | EVALUATING | re-evaluation after remediation |  | 952 |
| DRAFT | SUPERSEDED | contract superseded |  | 953 |
| READY | SUPERSEDED | contract superseded |  | 954 |
| EVALUATING | SUPERSEDED | contract superseded |  | 955 |
| COMPOSABLE | SUPERSEDED | contract superseded |  | 956 |
| CONFLICTED | SUPERSEDED | contract superseded |  | 957 |
| INSUFFICIENT | SUPERSEDED | contract superseded |  | 958 |
illegal[]: (empty)
in-arrows: READY<-[DRAFT]; EVALUATING<-[READY,CONFLICTED,INSUFFICIENT]; COMPOSABLE<-[EVALUATING]; CONFLICTED<-[EVALUATING]; INSUFFICIENT<-[EVALUATING]; SATISFIED<-[COMPOSABLE]; SUPERSEDED<-[DRAFT,READY,EVALUATING,COMPOSABLE,CONFLICTED,INSUFFICIENT]

### AssurancePolicy.status  (transitions.data.ts:1056-1078)
States: DRAFT, ACTIVE, SUSPENDED, SUPERSEDED
Terminal: SUPERSEDED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| DRAFT | ACTIVE | policy activated |  | 1062 |
| ACTIVE | SUSPENDED | policy suspended |  | 1063 |
| SUSPENDED | ACTIVE | policy resumed |  | 1064 |
| ACTIVE | SUPERSEDED | new policy version supersedes (assessments pin policySemanticVersion, §18) |  | 1066 |
| SUSPENDED | SUPERSEDED | new policy version supersedes (assessments pin policySemanticVersion, §18) |  | 1071 |
illegal[]: (empty)
in-arrows: ACTIVE<-[DRAFT,SUSPENDED]; SUSPENDED<-[ACTIVE]; SUPERSEDED<-[ACTIVE,SUSPENDED]

### AssuranceAssessment.disposition  (transitions.data.ts:1079-1150)
States: PENDING, ASSESSING, SATISFIED, CONDITIONALLY_SATISFIED, REJECTED, INCONCLUSIVE, WAIVED, ESCALATED
Terminal: SATISFIED, REJECTED, WAIVED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| PENDING | ASSESSING | requestAssuranceAssessment then AssuranceAssessmentStarted | independence requirements must be checked BEFORE evaluation begins (§18.1) | 1095 |
| ASSESSING | SATISFIED | completeAssuranceAssessment / AssuranceAssessmentSatisfied | must identify policy version used, evidence considered, and criteria met (§18.1) — must NOT be forced by executionState=SUCCEEDED (P1/INV-5) | 1101 |
| ASSESSING | CONDITIONALLY_SATISFIED | AssuranceAssessmentConditionallySatisfied |  | 1108 |
| ASSESSING | REJECTED | AssuranceAssessmentRejected |  | 1112 |
| ASSESSING | INCONCLUSIVE | AssuranceAssessmentInconclusive | an inconclusive disposition cannot be treated as satisfied (§18.1) | 1114 |
| ASSESSING | ESCALATED | AssuranceAssessmentEscalated |  | 1119 |
| ASSESSING | WAIVED | WaiverGranted | a policy cannot waive its own blocking finding unless waiver authority is separately defined (§18.1) | 1121 |
| INCONCLUSIVE | WAIVED | WaiverGranted | a policy cannot waive its own blocking finding unless waiver authority is separately defined (§18.1) | 1128 |
| ESCALATED | WAIVED | WaiverGranted | a policy cannot waive its own blocking finding unless waiver authority is separately defined (§18.1) | 1135 |
illegal[]: INCONCLUSIVE->SATISFIED@1144
in-arrows: ASSESSING<-[PENDING]; SATISFIED<-[ASSESSING]; CONDITIONALLY_SATISFIED<-[ASSESSING]; REJECTED<-[ASSESSING]; INCONCLUSIVE<-[ASSESSING]; ESCALATED<-[ASSESSING]; WAIVED<-[ASSESSING,INCONCLUSIVE,ESCALATED]

### AssuranceAssessment.state  (transitions.data.ts:1151-1323)
States: REQUESTED, EVIDENCE_PENDING, READY, ASSESSING, SATISFIED, CONDITIONALLY_SATISFIED, REJECTED, INCONCLUSIVE, ESCALATED, WAIVED, VALIDATOR_FAILED, INDEPENDENCE_VIOLATION, INVALIDATED, WAIVER_EXPIRED, CANCELLED
Terminal: REJECTED, INCONCLUSIVE, ESCALATED, VALIDATOR_FAILED, INDEPENDENCE_VIOLATION, INVALIDATED, WAIVER_EXPIRED, CANCELLED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| REQUESTED | EVIDENCE_PENDING | AssuranceAssessmentRequested; claims instantiated, evidence requirements evaluated, missing evidence requested (AssuranceEvidenceRequired) | one or more required EvidenceRequirements not yet satisfied | 1183 |
| EVIDENCE_PENDING | READY | submitEvidenceForAssessment (AssuranceEvidenceReceived) | all required evidence present and admissible per §6.2 (identity stable, provenance present, in-scope, not invalidated, sufficiently current, relevant) | 1190 |
| READY | ASSESSING | selectAssuranceEvaluator (AssuranceEvaluatorSelected) then beginAssuranceAssessment (AssuranceAssessmentStarted) | validator selected AND required independence verified (AssuranceIndependenceVerified) AND context assembled | 1197 |
| ASSESSING | SATISFIED | completeAssuranceAssessment (AssuranceAssessmentSatisfied) | all mandatory criteria MET; no open BLOCKING/CRITICAL finding; required independence verified (§8.4, INV-8); every satisfied claim references admissible evidence (INV-3); required evidence admissible (§10.3, §15.9) | 1205 |
| ASSESSING | CONDITIONALLY_SATISFIED | completeAssuranceAssessment (AssuranceAssessmentConditionallySatisfied) | claims supportable only if explicit conditions remain true or required follow-up occurs; typically an open MATERIAL finding (§10.1, §10.3) | 1212 |
| ASSESSING | REJECTED | completeAssuranceAssessment (AssuranceAssessmentRejected) | open CRITICAL finding (→REJECTED or ESCALATED) OR open BLOCKING finding OR a material claim unsupported/contradicted/violates a blocking criterion (§10.1, §10.3, INV-11) | 1219 |
| ASSESSING | INCONCLUSIVE | completeAssuranceAssessment (AssuranceAssessmentInconclusive) | available admissible evidence insufficient to support or reject the claim; evidence deficit (§10.1, §10.3); also on evidence access failure (§34.3) | 1226 |
| ASSESSING | ESCALATED | completeAssuranceAssessment (AssuranceAssessmentEscalated); EscalationRule.trigger fires (§13) | validator or policy cannot resolve the issue within its authority/competence (§10.1); may also be the disposition for an open CRITICAL finding (§10.3) | 1233 |
| ASSESSING | WAIVED | requestAssuranceWaiver (WaiverRequested) → grantAssuranceWaiver (WaiverGranted) | WaiverRule.waiverAllowed; criterion ∈ eligibleCriteriaIds; finding severity ∉ prohibitedFindingSeverities; required authority present; rationale/compensating controls recorded (§12). NOT waivable: unauthorized intent alteration (§15.11), critical baseline-integrity failures by ordinary authority (§26.7) | 1241 |
| ASSESSING | VALIDATOR_FAILED | validator execution failure (§34.1) | validator crashed / timed out / errored during execution | 1248 |
| ASSESSING | INDEPENDENCE_VIOLATION | AssuranceIndependenceViolated — required IndependenceRequirement not satisfied (§8.4) | producer and evaluator share invocation/agent/model/provider/hidden-context/prompt-lineage/authority in violation of policy's IndependenceRequirement (§8.2) | 1254 |
| ASSESSING | EVIDENCE_PENDING | evidence access failure — required evidence cannot be retrieved (§34.3) | required evidence becomes unavailable during assessment | 1262 |
| SATISFIED | INVALIDATED | invalidateAssuranceAssessment (AssuranceAssessmentInvalidated) | subject semantic version changed (INV-16) OR supporting evidence invalidated (INV-15) | 1268 |
| CONDITIONALLY_SATISFIED | INVALIDATED | invalidateAssuranceAssessment (AssuranceAssessmentInvalidated) | subject semantic version changed (INV-16) OR supporting evidence invalidated (INV-15) OR a required condition ceased to hold | 1275 |
| WAIVED | WAIVER_EXPIRED | expireAssuranceWaiver (WaiverExpired) | WaiverRule.maximumDuration / recorded expiration reached, OR revalidationTrigger fired, OR a new subject semantic version (waiver does not apply to future semantic versions unless explicitly renewed — §12.2, INV-14) | 1282 |
illegal[]: VALIDATOR_FAILED->REJECTED@1291, INDEPENDENCE_VIOLATION->SATISFIED@1297
in-arrows: EVIDENCE_PENDING<-[REQUESTED,ASSESSING]; READY<-[EVIDENCE_PENDING]; ASSESSING<-[READY]; SATISFIED<-[ASSESSING]; CONDITIONALLY_SATISFIED<-[ASSESSING]; REJECTED<-[ASSESSING]; INCONCLUSIVE<-[ASSESSING]; ESCALATED<-[ASSESSING]; WAIVED<-[ASSESSING]; VALIDATOR_FAILED<-[ASSESSING]; INDEPENDENCE_VIOLATION<-[ASSESSING]; INVALIDATED<-[SATISFIED,CONDITIONALLY_SATISFIED]; WAIVER_EXPIRED<-[WAIVED]

### AssuranceObservation.disposition  (transitions.data.ts:1324-1354)
States: OPEN, ACCEPTED, REMEDIATED, WAIVED, REJECTED, SUPERSEDED
Terminal: ACCEPTED, REMEDIATED, WAIVED, REJECTED, SUPERSEDED

| from | to | trigger | guard | line |
|---|---|---|---|---|
| OPEN | ACCEPTED | observation accepted (residual risk acknowledged) |  | 1331 |
| OPEN | REMEDIATED | remediation applied | assurance observations must REMAIN VISIBLE after remediation — the observation is not deleted (§18.1) | 1336 |
| OPEN | WAIVED | WaiverGranted | waiver includes scope, rationale, authority, duration; human override must not erase prior findings (§23.2, Scenario 4) | 1343 |
| OPEN | REJECTED | observation dismissed/rejected |  | 1349 |
| OPEN | SUPERSEDED | observation superseded |  | 1350 |
illegal[]: (empty)
in-arrows: ACCEPTED<-[OPEN]; REMEDIATED<-[OPEN]; WAIVED<-[OPEN]; REJECTED<-[OPEN]; SUPERSEDED<-[OPEN]

## 3. Per-command contract catalog

Every registered command handler (`packages/rph-application/src/handlers/registry.ts`), classified honestly by its **current** precondition mechanism. The classes:

- **EXPLICIT_FROMSTATES** — the handler declares `precondition: fromStates(...)`; the authored set is recorded. Safe by design.
- **PREDICATE** — the handler declares a `precondition: predicate(...)`/`allOf(...)` over (state, payload); used where a source-state set cannot express the rule (a non-state discriminator, or a payload/evaluation-derived target — DS-001 §5, D10).
- **GUARD_ONLY_ACCIDENTAL** — no `precondition`, but an `args.guard` that routes through `canTransition` (which excludes NOOP) or a hand-rolled status check incidentally refuses a same-state re-issue. Protection by accident: the refusal is not by design and frequently returns the wrong code (INV-3, INV-7).
- **NONE** — neither. A same-state re-issue passes `checkTransition` as a NOOP and appends a second event. The primary remediation surface.
- **CREATE_NA** — a `createObject` handler; no source state. Its precondition is existence/uniqueness, out of this SPEC's transition-legality concern (noted, not contracted).

The `Target` column reads `payload-derived: A|B|C` where the to-state comes from the payload or an evaluation; per DS-001 D10 (and confirmed for `validateDecomposition`/`completeRecomposition`), a payload-derived target with a **single** source state is still a clean `fromStates` set — the source, not the target, determines the precondition shape. `Accum` lists the fields a re-issue would compound (INV-6). Column citations are to the handler file named in §3.1; machine rows are §2.

| # | Command | Kind | Machine | Target | Class | Authored set | Event | Re-issue today | Accum |
|---|---|---|---|---|---|---|---|---|---|
| 1 | RequestRuntimeBinding | CREATE | — | — | CREATE_NA | — | RuntimeBindingRequested | refused-by-store-create-conflict (RPH_RE… | — |
| 2 | AuthorizeRuntimeBinding | ADVANCE_STATUS | RuntimeBinding.authorizationStatus | AUTHORIZED | EXPLICIT_FROMSTATES | REQUESTED,PARTIALLY_AUTHORIZED | RuntimeBindingAuthorized | refused-by-precondition (an already-AUTH… | revision |
| 3 | DenyRuntimeBinding | ADVANCE_STATUS | RuntimeBinding.authorizationStatus | DENIED | EXPLICIT_FROMSTATES | REQUESTED | RuntimeBindingDenied | refused-by-precondition (an already-DENI… | revision |
| 4 | RevokeRuntimeCapability | ADVANCE_STATUS | RuntimeBinding.authorizationStatus | REVOKED | EXPLICIT_FROMSTATES | AUTHORIZED,PARTIALLY_AUTHORIZED | RuntimeCapabilityRevoked | refused-by-precondition (an already-REVO… | revision |
| 5 | CaptureIntent | CREATE | — | — | CREATE_NA | — | IntentCaptured | idempotency-absorbed | — |
| 6 | BeginIntentDiscovery | ADVANCE_INTENT | Intent.intentStatus | UNDER_DISCOVERY | EXPLICIT_FROMSTATES | RAW | IntentDiscoveryStarted | refused-by-precondition | revision |
| 7 | ProvisionIntent | ADVANCE_INTENT | Intent.intentStatus | PROVISIONAL | EXPLICIT_FROMSTATES | UNDER_DISCOVERY | IntentProvisioned | refused-by-precondition | revision |
| 8 | FormalizeIntent | ADVANCE_INTENT | Intent.intentStatus | FORMALIZED | EXPLICIT_FROMSTATES | PROVISIONAL | IntentFormalized | refused-by-precondition | revision |
| 9 | ApproveIntent | ADVANCE_INTENT | Intent.intentStatus | APPROVED | EXPLICIT_FROMSTATES | FORMALIZED,REVISED | IntentApproved | refused-by-precondition | revision |
| 10 | ReviseIntent | ADVANCE_INTENT | Intent.intentStatus | REVISED | EXPLICIT_FROMSTATES | APPROVED | IntentRevised | refused-by-precondition | semanticVersion,revision |
| 11 | ProposeDecomposition | CREATE | — | — | CREATE_NA | — | DecompositionProposed | idempotency-absorbed (same commandId/ide… | — |
| 12 | ValidateDecomposition | ADVANCE_STATUS | DecompositionContract.status | payload-derived: VALID/CONDITIONALLY_VAL… | EXPLICIT_FROMSTATES | UNDER_REVIEW | payload-derived: DecompositionValidated (VALID/CONDITIONALLY_VALID) / DecompositionRejected (INVALID) | refused-by-precondition (fromStates('UND… | revision |
| 13 | ReviseDecomposition | ADVANCE_STATUS | DecompositionContract.status | SUPERSEDED | EXPLICIT_FROMSTATES | VALID,CONDITIONALLY_VALID,INVALID | DecompositionRevised | refused-by-precondition (from SUPERSEDED… | semanticVersion,revision |
| 14 | ProposeRecomposition | CREATE | — | — | CREATE_NA | — | RecompositionProposed | idempotency-absorbed (same commandId/ide… | — |
| 15 | BeginRecomposition | ADVANCE_STATUS | RecompositionContract.status | EVALUATING | EXPLICIT_FROMSTATES | READY,CONFLICTED,INSUFFICIENT | RecompositionStarted | refused-by-precondition (a re-issue from… | revision |
| 16 | CompleteRecomposition | ADVANCE_STATUS | RecompositionContract.status | payload-derived: COMPOSABLE/CONFLICTED/I… | EXPLICIT_FROMSTATES | EVALUATING | evaluation-derived: RecompositionCompleted (SATISFIED) / RecompositionConflictDetected (CONFLICTED) / RecompositionFailed (INSUFFICIENT) | refused-by-precondition (a re-issue from… | revision |
| 17 | AssertObligation | CREATE | Obligation.status (initial state only; not driven — createObject) | PROPOSED (hardcoded initial; obligation-… | CREATE_NA | — | ObligationAsserted (obligation-constraint.ts:40) | idempotency-absorbed (same idempotencyKe… | — |
| 18 | AssertConstraint | CREATE | Constraint.status (initial state only; not driven — createObject) | PROPOSED (hardcoded initial; obligation-… | CREATE_NA | — | ConstraintAsserted (obligation-constraint.ts:75) | idempotency-absorbed (same idempotencyKe… | — |
| 19 | ProposeHarness | CREATE | RecursiveProfessionalHarness (Harness.status) — initial state only; not driven (createObject) | FRAMING (hardcoded initial; harness.ts:3… | CREATE_NA | — | HarnessProposed (harness.ts:38) | idempotency-absorbed (same idempotencyKe… | — |
| 20 | RecordArtifact | CREATE | none — NO state machine is declared, deliberately (artifact.ts comment :29-31) | payload-derived: p.status (open text, no… | CREATE_NA | — | ArtifactRecorded (artifact.ts:74) | idempotency-absorbed (same idempotencyKe… | — |
| 21 | ProposePwu | CREATE | — | — | CREATE_NA | — | PwuProposed | refused-by-store on duplicate pwuId (com… | — |
| 22 | BeginPwuShaping | ADVANCE_PWU_LIFECYCLE | PWU.workLifecycleState | SHAPING | GUARD_ONLY_ACCIDENTAL | — | PwuShapingStarted | refused-by-guard: SHAPING->SHAPING class… | revision |
| 23 | MarkPwuReady | ADVANCE_PWU_LIFECYCLE | PWU.workLifecycleState | READY | GUARD_ONLY_ACCIDENTAL | — | PwuMarkedReady | refused-by-guard: READY->READY is NOOP -… | revision |
| 24 | ChangePwuState | INLINE_ADVANCE | PWU.workLifecycleState (+ executionState + assuranceState + shapeIntegrityState) | payload-derived: newState/executionState… | PREDICATE | — | PwuStateChanged | refused-by-precondition: an all-four-axe… | revision |
| 25 | ChallengePwu | ADVANCE_PWU_LIFECYCLE | PWU.workLifecycleState | CHALLENGED | GUARD_ONLY_ACCIDENTAL | — | PwuChallenged | refused-by-guard: CHALLENGED->CHALLENGED… | revision |
| 26 | ReshapePwu | ADVANCE_PWU_LIFECYCLE | PWU.workLifecycleState | RESHAPING | GUARD_ONLY_ACCIDENTAL | — | PwuReshapingStarted | refused-by-guard: RESHAPING->RESHAPING N… | revision |
| 27 | InvalidatePwu | ADVANCE_PWU_LIFECYCLE | PWU.workLifecycleState | INVALIDATED | GUARD_ONLY_ACCIDENTAL | — | PwuInvalidated | refused-by-guard: INVALIDATED->INVALIDAT… | revision |
| 28 | SupersedePwu | ADVANCE_PWU_LIFECYCLE | PWU.workLifecycleState | SUPERSEDED | GUARD_ONLY_ACCIDENTAL | — | PwuSuperseded | refused-by-guard: SUPERSEDED->SUPERSEDED… | revision |
| 29 | CreatePwa | CREATE | — | — | CREATE_NA | — | PwaCreated | idempotency-absorbed | — |
| 30 | CreateUndertaking | CREATE | — | — | CREATE_NA | — | UndertakingCreated | idempotency-absorbed | — |
| 31 | DefinePwuType | CREATE | — | — | CREATE_NA | — | PwuTypeDefined | idempotency-absorbed | — |
| 32 | SubmitPwaForReview | ADVANCE_STATUS | PWA.publicationStatus | UNDER_REVIEW | NONE | — | PwaSubmittedForReview | would-append-second-event | revision |
| 33 | ValidatePwa | ADVANCE_STATUS | PWA.publicationStatus | VALIDATED | NONE | — | PwaValidated | would-append-second-event | revision |
| 34 | PublishPwa | ADVANCE_STATUS | PWA.publicationStatus | PUBLISHED | EXPLICIT_FROMSTATES | VALIDATED | PwaPublished | refused-by-precondition | — |
| 35 | DeprecatePwa | ADVANCE_STATUS | PWA.publicationStatus | DEPRECATED | NONE | — | PwaDeprecated | would-append-second-event | revision |
| 36 | RetirePwa | ADVANCE_STATUS | PWA.publicationStatus | RETIRED | NONE | — | PwaRetired | would-append-second-event | revision |
| 37 | DeletePwa | COMMIT_STATE | — | DISCARDED | GUARD_ONLY_ACCIDENTAL | — | PwaDeleted | refused-by-guard | — |
| 38 | EditPwa | COMMIT_STATE | — | — | NONE | — | PwaEdited | would-append-second-event | revision |
| 39 | EditPwuType | COMMIT_STATE | — | — | NONE | — | PwuTypeRedefined | would-append-second-event | revision,PWA.semanticVersion (via withPwaVersionBump) |
| 40 | RemovePwuType | COMMIT_STATE | — | REMOVED | NONE | — | PwuTypeRemoved | would-append-second-event | revision,PWA.semanticVersion (via withPwaVersionBump) |
| 41 | AppendConversationEntries | COMMIT_STATE | — | — | NONE | — | ConversationEntriesAppended | would-append-second-event | entries,revision |
| 42 | ProposeEvidence | CREATE | — | — | CREATE_NA | — | EvidenceProposed | refused-by-guard | — |
| 43 | AdmitEvidence | ADVANCE_STATUS | Evidence.status | ADMISSIBLE | EXPLICIT_FROMSTATES | PROPOSED | EvidenceAdmitted | refused-by-precondition | — |
| 44 | InvalidateEvidence | ADVANCE_STATUS | Evidence.status | INVALIDATED | EXPLICIT_FROMSTATES | ADMISSIBLE | EvidenceInvalidated | refused-by-precondition | — |
| 45 | AssertClaim | CREATE | — | — | CREATE_NA | — | ClaimAsserted | refused-by-guard | — |
| 46 | DetectAssumption | CREATE | — | — | CREATE_NA | — | AssumptionDetected | refused-by-guard | — |
| 47 | ExpireAssumption | ADVANCE_STATUS | Assumption.status | EXPIRED | EXPLICIT_FROMSTATES | PROPOSED,DISCLOSED,UNDER_VERIFICATION,ACCEPTED | AssumptionExpired | refused-by-precondition | — |
| 48 | CreateAssurancePolicy | CREATE | — | — | CREATE_NA | — | AssurancePolicyCreated | refused-by-guard | — |
| 49 | EditAssurancePolicy | COMMIT_STATE | — | — | NONE | — | AssurancePolicyEdited | would-append-second-event | revision |
| 50 | SupersedeAssurancePolicy | ADVANCE_STATUS | AssurancePolicy.status | SUPERSEDED | NONE | — | AssurancePolicySuperseded | would-append-second-event | tags,revision |
| 51 | SuspendAssurancePolicy | ADVANCE_STATUS | AssurancePolicy.status | SUSPENDED | NONE | — | AssurancePolicySuspended | would-append-second-event | revision |
| 52 | ActivateAssurancePolicy | ADVANCE_STATUS | AssurancePolicy.status | ACTIVE | NONE | — | AssurancePolicyActivated | would-append-second-event | revision |
| 53 | RequestAssuranceAssessment | CREATE | — | — | CREATE_NA | — | AssuranceAssessmentStarted | refused-by-guard | — |
| 54 | SubmitEvidenceForAssessment | COMMIT_STATE | — | — | NONE | — | AssuranceEvidenceReceived | would-append-second-event | revision |
| 55 | CompleteAssuranceAssessment | ADVANCE_STATUS | AssuranceAssessment.state | payload-derived: SATISFIED/CONDITIONALLY… | EXPLICIT_FROMSTATES | ASSESSING | AssuranceAssessmentCompleted | refused-by-precondition | revision |
| 56 | RecordAssuranceObservation | CREATE | — | — | CREATE_NA | — | AssuranceObservationRecorded | refused-by-guard | — |
| 57 | ProposeDecision | CREATE | — | — | CREATE_NA | — | DecisionProposed | idempotency-absorbed at dispatch (same i… | — |
| 58 | ApproveDecision | ADVANCE_STATUS | Decision.status | EFFECTIVE | PREDICATE | — | DecisionEffective | refused-by-precondition — re-approving a… | — |
| 59 | RevokeDecision | ADVANCE_STATUS | Decision.status | REVOKED | NONE | — | DecisionRevoked | would-append-second-event — a REVOKED->R… | revision |
| 60 | RequestWaiver | CREATE | — | — | CREATE_NA | — | WaiverRequested | idempotency-absorbed at dispatch (same k… | — |
| 61 | GrantWaiver | ADVANCE_STATUS | Decision.status | EFFECTIVE | PREDICATE | — | WaiverGranted | refused-by-precondition — granting an al… | — |
| 62 | DenyWaiver | ADVANCE_STATUS | Decision.status | SUPERSEDED | PREDICATE | — | WaiverDenied | refused-by-precondition — the request is… | — |
| 63 | CreateBaseline | CREATE | — | — | CREATE_NA | — | BaselineCreated | idempotency-absorbed at dispatch (same k… | — |
| 64 | SubmitBaselineForReview | ADVANCE_STATUS | Baseline.status | UNDER_REVIEW | NONE | — | BaselineSubmittedForReview | would-append-second-event — an UNDER_REV… | revision |
| 65 | ApproveBaseline | ADVANCE_STATUS | Baseline.status | APPROVED | EXPLICIT_FROMSTATES | UNDER_REVIEW | BaselineApproved | refused-by-precondition — re-approving a… | — |
| 66 | PromoteBaseline | ADVANCE_STATUS | Baseline.status | AUTHORITATIVE | GUARD_ONLY_ACCIDENTAL | — | BaselinePromoted | refused-by-guard (ACCIDENTAL) — an AUTHO… | — |
| 67 | SupersedeBaseline | ADVANCE_STATUS | Baseline.status | SUPERSEDED | NONE | — | BaselineSuperseded | would-append-second-event — a SUPERSEDED… | revision |
| 68 | ProposeExecutionPlan | CREATE | ExecutionPlan.status | UNDER_REVIEW | CREATE_NA | — | ExecutionPlanProposed | idempotency-absorbed | — |
| 69 | ApproveExecutionPlan | ADVANCE_STATUS | ExecutionPlan.status | APPROVED | NONE | — | ExecutionPlanApproved | would-append-second-event | revision |
| 70 | ActivateExecutionPlan | ADVANCE_STATUS | ExecutionPlan.status | ACTIVE | GUARD_ONLY_ACCIDENTAL | — | ExecutionPlanActivated | refused-by-guard | — |
| 71 | CancelExecutionPlan | ADVANCE_STATUS | ExecutionPlan.status | CANCELLED | NONE | — | ExecutionTerminated | would-append-second-event | revision |
| 72 | CompleteExecutionPlan | ADVANCE_STATUS | ExecutionPlan.status | COMPLETED | NONE | — | ExecutionPlanCompleted | would-append-second-event | revision |
| 73 | FailExecutionPlan | ADVANCE_STATUS | ExecutionPlan.status | FAILED | NONE | — | ExecutionPlanFailed | would-append-second-event | revision |
| 74 | SupersedeExecutionPlan | ADVANCE_STATUS | ExecutionPlan.status | SUPERSEDED | NONE | — | ExecutionPlanSuperseded | would-append-second-event | revision |
| 75 | ApplyTacticalChange | ADVANCE_STATUS | ExecutionPlan.status | ACTIVE | NONE | — | TacticalChangeApplied | would-append-second-event | revision |
| 76 | StartExecutionStep | INLINE_ADVANCE | ExecutionStep.stepState | RUNNING | EXPLICIT_FROMSTATES | QUEUED | ExecutionStepStarted | refused-by-precondition | — |
| 77 | CompleteExecutionStep | INLINE_ADVANCE | ExecutionStep.stepState | SUCCEEDED | EXPLICIT_FROMSTATES | RUNNING | ExecutionStepSucceeded | refused-by-precondition | — |
| 78 | FailExecutionStep | INLINE_ADVANCE | ExecutionStep.stepState | FAILED | EXPLICIT_FROMSTATES | RUNNING | ExecutionStepFailed | refused-by-precondition | — |
| 79 | RetryExecutionStep | INLINE_ADVANCE | ExecutionStep.stepState | QUEUED | EXPLICIT_FROMSTATES | FAILED | ExecutionStepRetried | refused-by-precondition | — |
| 80 | SkipExecutionStep | INLINE_ADVANCE | ExecutionStep.stepState | SKIPPED | EXPLICIT_FROMSTATES | READY,QUEUED | ExecutionStepSkipped | refused-by-precondition | — |
| 81 | CancelExecutionStep | INLINE_ADVANCE | ExecutionStep.stepState | CANCELLED | EXPLICIT_FROMSTATES | READY,QUEUED,RUNNING,WAITING | ExecutionStepCancelled | refused-by-precondition | — |
| 82 | PruneExecutionStep | INLINE_ADVANCE | ExecutionStep.stepState | SKIPPED | EXPLICIT_FROMSTATES | NOT_READY,READY,QUEUED | ExecutionStepPruned | refused-by-precondition | — |
| 83 | EnterExecutionStepWait | INLINE_ADVANCE | ExecutionStep.stepState | WAITING | EXPLICIT_FROMSTATES | RUNNING | ExecutionStepWaiting | refused-by-precondition | — |
| 84 | ResolveExecutionStepWait | INLINE_ADVANCE | ExecutionStep.stepState | RUNNING | EXPLICIT_FROMSTATES | WAITING | ExecutionStepWaitResolved | refused-by-precondition | — |

### 3.1 Remediation surface — the un-hardened and accidentally-protected sites

These are the sites where a same-state re-issue is not refused by a declared precondition. Each carries its current guard, the code a wrong-state re-issue returns today, and whether a same-state NOOP re-issue is admitted (appends a second event). This is the surface DWP-04 (its six) and the continuation forks (the rest) act on.

**NONE — a same-state re-issue is admitted and appends a second event:**

- **SubmitPwaForReview** (submitPwaForReview:695) — PWA.publicationStatus → UNDER_REVIEW. Guard: none. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION (kit.ts checkTransition line 138). Only arm. Single in-arrow DRAFT->UNDER_REVIEW (transitions.data.ts line 1622); a wrong source (e.g. VALIDATED) is ILLEGAL_UNDEFINED.. Re-issue: would-append-second-event. Accumulative: revision.
- **ValidatePwa** (validatePwa:786) — PWA.publicationStatus → VALIDATED. Guard: pwaCompositionGate (line 793) — recursive-composition structural check via analyzePwaGraph (single-root/acyclic-permits/connected); refuses RPH_INVARIANT_VIOLATION (line 777) if the graph is not a valid decomposition. NOT a state/canTransition guard.. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION (checkTransition, single in-arrow UNDER_REVIEW->VALIDATED, transitions.data.ts line 1623) — BUT the guard runs BEFORE checkTransition (advanceStatus order line 480 then 483), so a wrong-state ValidatePwa whose graph is ALSO invalid surfaces the guard's RPH_INVARIANT_VIOLATION instead; only a valid graph lets checkTransition's code through. This is the precondition-before-guard ordering DWP-01b fixed for PublishPwa but NOT here.. Re-issue: would-append-second-event. Accumulative: revision.
- **DeprecatePwa** (deprecatePwa:853) — PWA.publicationStatus → DEPRECATED. Guard: none. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION (checkTransition line 138). Single in-arrow PUBLISHED->DEPRECATED (transitions.data.ts line 1625).. Re-issue: would-append-second-event. Accumulative: revision.
- **RetirePwa** (retirePwa:863) — PWA.publicationStatus → RETIRED. Guard: none. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION (checkTransition line 138). Single in-arrow DEPRECATED->RETIRED (transitions.data.ts line 1626).. Re-issue: would-append-second-event. Accumulative: revision.
- **EditPwa** (editPwa:439) —  → . Guard: hand-rolled status check `publicationStatus !== 'DRAFT'` -> RPH_INVARIANT_VIOLATION (line 444/447). This restricts WHICH state may be edited but does NOT refuse a DRAFT->DRAFT re-issue.. Wrong-state code today: RPH_INVARIANT_VIOLATION (line 447) when the PWA is not DRAFT; RPH_VALIDATION_SEMANTIC_FAILED (loadOrReject) if it does not exist.. Re-issue: would-append-second-event. Accumulative: revision.
- **EditPwuType** (editPwuType:555) —  → . Guard: requireDraftOwner (line 560) — owning PWA must be DRAFT (line 541->RPH_INVARIANT_VIOLATION 544); checkBoundaryCoherence INV-1/STD-3 (line 600); checkPolicyRefsOnState F-7 (line 602). None refuse a same-state re-issue of the edit itself.. Wrong-state code today: RPH_INVARIANT_VIOLATION (line 544, requireDraftOwner: owning PWA not DRAFT); RPH_VALIDATION_SEMANTIC_FAILED (loadOrReject) if the PWU Type does not exist.. Re-issue: would-append-second-event. Accumulative: revision,PWA.semanticVersion (via withPwaVersionBump).
- **RemovePwuType** (removePwuType:652) —  → REMOVED. Guard: requireDraftOwner (line 656) — owning PWA must be DRAFT (line 541->RPH_INVARIANT_VIOLATION 544); referencingSiblings integrity — refuse if other live types cite this id as permitted parent/child (line 659->RPH_INVARIANT_VIOLATION 661). NO already-REMOVED check.. Wrong-state code today: RPH_INVARIANT_VIOLATION (line 544 requireDraftOwner: owning PWA not DRAFT; OR line 663 dangling references exist); RPH_VALIDATION_SEMANTIC_FAILED (loadOrReject) if the PWU Type does not exist.. Re-issue: would-append-second-event. Accumulative: revision,PWA.semanticVersion (via withPwaVersionBump).
- **AppendConversationEntries** (appendConversationEntries:54) —  → . Guard: none (no state gate at all; the aggregate is created ACTIVE and never changes lifecycleStatus). Wrong-state code today: none — there is no source-state gate. The only refusals are RPH_VALIDATION_SEMANTIC_FAILED / RPH_REVISION_CONFLICT from loadOrReject's optimistic-concurrency check (only if the client sends expectedRevision), plus bus-level idempotency-key absorption for a genuine replay.. Re-issue: would-append-second-event. Accumulative: entries,revision.
- **EditAssurancePolicy** (editAssurancePolicy:258) —  → . Guard: hand-rolled prechecks, none of which dedupe a re-edit: rejectIfFloorLocked (floor gate, L261 -> RPH_INVARIANT_VIOLATION); SUPERSEDED gate (L265-271 -> RPH_INVARIANT_VIOLATION); loadOrReject existence (L263); content validators escBlock (L276) + remBlock (L281 -> RPH_VALIDATION_SEMANTIC_FAILED). No status transition (commitState, not advanceStatus) so no precondition mechanism.. Wrong-state code today: Not a state transition. Editing a SUPERSEDED policy -> RPH_INVARIANT_VIOLATION (hand-rolled SUPERSEDED gate, L265-271); a floor policy -> RPH_INVARIANT_VIOLATION (rejectIfFloorLocked, L54-63). No wrong-source arrow / no checkTransition.. Re-issue: would-append-second-event. Accumulative: revision.
- **SupersedeAssurancePolicy** (supersedeAssurancePolicy:311) — AssurancePolicy.status → SUPERSEDED. Guard: rejectIfFloorLocked (floor-id lock, L319 -> RPH_INVARIANT_VIOLATION). This is a target-id check, NOT a canTransition/state guard — it does NOT refuse a same-state re-issue of a non-floor policy.. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION — checkTransition (kit.ts:127-140) for an illegal source (e.g. DRAFT->SUPERSEDED). Legal sources ACTIVE/SUSPENDED only (transitions.data.ts:1065-1074). A same-state SUPERSEDED->SUPERSEDED re-issue is NOOP -> NOT refused (passes, appends).. Re-issue: would-append-second-event. Accumulative: tags,revision.
- **SuspendAssurancePolicy** (suspendAssurancePolicy:333) — AssurancePolicy.status → SUSPENDED. Guard: rejectIfFloorLocked (floor-id lock, L340 -> RPH_INVARIANT_VIOLATION). Target-id check, NOT a state guard; does not refuse a same-state re-issue.. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION — checkTransition (kit.ts:127-140) for an illegal source (e.g. DRAFT->SUSPENDED, SUPERSEDED->SUSPENDED). Only ACTIVE->SUSPENDED legal (transitions.data.ts:1063). Same-state SUSPENDED->SUSPENDED NOOP -> NOT refused.. Re-issue: would-append-second-event. Accumulative: revision.
- **ActivateAssurancePolicy** (activateAssurancePolicy:344) — AssurancePolicy.status → ACTIVE. Guard: rejectIfFloorLocked (floor-id lock, L351 -> RPH_INVARIANT_VIOLATION). Target-id check, NOT a state guard; does not refuse a same-state re-issue.. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION — checkTransition (kit.ts:127-140) for an illegal source (e.g. SUPERSEDED->ACTIVE). Legal sources DRAFT/SUSPENDED (transitions.data.ts:1062,1064). Same-state ACTIVE->ACTIVE NOOP -> NOT refused.. Re-issue: would-append-second-event. Accumulative: revision.
- **SubmitEvidenceForAssessment** (submitEvidenceForAssessment:662) —  → . Guard: hand-rolled ASSESSING gate `assessmentState !== 'ASSESSING'` (L671 -> RPH_VALIDATION_SEMANTIC_FAILED) + declared-requirement gate `satisfiesRequirementId ∈ policy.requiredEvidence` (L694 -> RPH_VALIDATION_SEMANTIC_FAILED) + loadOrReject existence (L665). NOTE: the ASSESSING gate does NOT dedupe — the command does not transition state, so a re-submit while still ASSESSING passes.. Wrong-state code today: Not a state transition (envelope bump only, snapshot unchanged L703-704). Submitting against a non-ASSESSING (completed) assessment -> RPH_VALIDATION_SEMANTIC_FAILED (hand-rolled ASSESSING gate, L672-677); nonexistent assessment -> RPH_VALIDATION_SEMANTIC_FAILED (loadOrReject, kit.ts:95).. Re-issue: would-append-second-event. Accumulative: revision.
- **RevokeDecision** (revokeDecision:279) — Decision.status → REVOKED. Guard: none (governance.ts:279-286) — bare advanceStatus, no precondition, no guard. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION via checkTransition (kit.ts:138) for a genuinely wrong source (e.g. PROPOSED->REVOKED is ILLEGAL_UNDEFINED — the only legal in-arrow is EFFECTIVE->REVOKED, transitions.data.ts:1529-1535). BUT the same-state REVOKED->REVOKED re-issue is NOT refused (NOOP admitted).. Re-issue: would-append-second-event — a REVOKED->REVOKED re-issue is a NOOP admitted by checkTransition (kit.ts:134) and appends a second DecisionRevoked (confirmed by doc comment governance.ts:276-278). Accumulative: revision.
- **SubmitBaselineForReview** (submitBaselineForReview:470) — Baseline.status → UNDER_REVIEW. Guard: none (governance.ts:470-480) — bare advanceStatus, no precondition, no guard; eventPayload just sets status UNDER_REVIEW. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION via checkTransition (kit.ts:138) for a genuinely wrong source (only legal in-arrow is CANDIDATE->UNDER_REVIEW, transitions.data.ts:1557). BUT the same-state UNDER_REVIEW->UNDER_REVIEW re-issue is NOT refused (NOOP admitted).. Re-issue: would-append-second-event — an UNDER_REVIEW->UNDER_REVIEW re-issue is a NOOP admitted by checkTransition (kit.ts:134) and appends a second BaselineSubmittedForReview. Accumulative: revision.
- **SupersedeBaseline** (supersedeBaseline:676) — Baseline.status → SUPERSEDED. Guard: none (governance.ts:676-683) — bare advanceStatus, no precondition, no guard. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION via checkTransition (kit.ts:138) for a genuinely wrong source (only legal in-arrow is AUTHORITATIVE->SUPERSEDED, transitions.data.ts:1571-1577). BUT the same-state SUPERSEDED->SUPERSEDED re-issue is NOT refused (NOOP admitted).. Re-issue: would-append-second-event — a SUPERSEDED->SUPERSEDED re-issue is a NOOP admitted by checkTransition (kit.ts:134) and appends a second BaselineSuperseded (SUPERSEDED is terminal, but from===to still classifies NOOP -> admitted). Accumulative: revision.
- **ApproveExecutionPlan** (approveExecutionPlan:262) — ExecutionPlan.status → APPROVED. Guard: assumptionsAuthorizeNewWork (execution.ts:273-284; helper :241-260): rejects RPH_INVARIANT_VIOLATION if any assumption the PWU depends on is EXPIRED/FALSIFIED/SUPERSEDED (canAuthorizeNewWork, RPH-ASM-006). This gates on PWU ASSUMPTIONS, NOT on the plan's own status — so it does NOT refuse a same-state re-issue.. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION from the checkTransition arm (kit.ts advanceStatus:483). Only UNDER_REVIEW->APPROVED is legal (transitions.data.ts:1376); any other non-same source is ILLEGAL_UNDEFINED. The guard can also return RPH_INVARIANT_VIOLATION but that is an assumption-liveness concern, not wrong-state.. Re-issue: would-append-second-event. Accumulative: revision.
- **CancelExecutionPlan** (cancelExecutionPlan:367) — ExecutionPlan.status → CANCELLED. Guard: none — no precondition, no args.guard, no precheck (execution.ts:367-374).. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION from the checkTransition arm (kit.ts advanceStatus:483). Legal sources are APPROVED and ACTIVE (transitions.data.ts:1391-1392); a terminal/other non-same source is ILLEGAL. But same-state CANCELLED->CANCELLED is NOOP and is NOT refused.. Re-issue: would-append-second-event. Accumulative: revision.
- **CompleteExecutionPlan** (completeExecutionPlan:392) — ExecutionPlan.status → COMPLETED. Guard: step success allow-list (execution.ts:400-426): rejects RPH_INVARIANT_VIOLATION unless steps.length>0, every step SUCCEEDED/SKIPPED, and >=1 SUCCEEDED (JAN-EXECPLAN-DR-002/003, aligns with PWU rejectUnbackedExecutionSuccess). Gates on STEPS, NOT on plan status — does NOT refuse a same-state re-issue.. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION from the checkTransition arm (kit.ts:483) for a valid-steps plan in the wrong status (only ACTIVE->COMPLETED is legal, transitions.data.ts:1389). But the guard's RPH_INVARIANT_VIOLATION (:405,:414,:420) fires FIRST if steps are not all terminal-success — order in advanceStatus is guard (kit.ts:480) then checkTransition (:483).. Re-issue: would-append-second-event. Accumulative: revision.
- **FailExecutionPlan** (failExecutionPlan:431) — ExecutionPlan.status → FAILED. Guard: none — no precondition, no args.guard, no precheck (execution.ts:431-445). Header comment claims 'the machine only permits FAILED from ACTIVE, so checkTransition guards the source' — true for a wrong SOURCE, but checkTransition NOOP-admits a same-state re-issue.. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION from the checkTransition arm (kit.ts:483). Only ACTIVE->FAILED is legal (transitions.data.ts:1390); a non-same source is ILLEGAL. Same-state FAILED->FAILED is NOOP and is NOT refused.. Re-issue: would-append-second-event. Accumulative: revision.
- **SupersedeExecutionPlan** (supersedeExecutionPlan:455) — ExecutionPlan.status → SUPERSEDED. Guard: successor-validity (execution.ts:467-484): rejects RPH_VALIDATION_SEMANTIC_FAILED if payload.supersedingExecutionPlanId does not resolve to an object (:471) or resolves to a plan on a DIFFERENT PWU (:477). Gates the SUCCESSOR, NOT this plan's status — does NOT refuse a same-state re-issue.. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION from the checkTransition arm (kit.ts:483) for a terminal-source plan (COMPLETED/FAILED/CANCELLED->SUPERSEDED is illegal). But the guard's RPH_VALIDATION_SEMANTIC_FAILED (:472,:478) fires FIRST on a dangling/foreign successor.. Re-issue: would-append-second-event. Accumulative: revision.
- **ApplyTacticalChange** (applyTacticalChange:490) — ExecutionPlan.status → ACTIVE. Guard: hand-rolled status check (execution.ts:497-504): state.status==='ACTIVE' ? null : reject(RPH_ILLEGAL_STATE_TRANSITION). This is a FLOOR for non-ACTIVE plans; it does NOT refuse a same-state re-issue because ACTIVE->ACTIVE is exactly what it permits.. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION from the hand-rolled guard arm (execution.ts:501-503) when the plan is not ACTIVE. checkTransition would independently NOOP-admit ACTIVE->ACTIVE.. Re-issue: would-append-second-event. Accumulative: revision.

**GUARD_ONLY_ACCIDENTAL — a canTransition-based domain guard incidentally refuses the re-issue, but not by design and often with the wrong code:**

- **BeginPwuShaping** (beginPwuShaping:359) — PWU.workLifecycleState → SHAPING. Guard: canAdvanceWorkLifecycle (pwu.ts:316) = canTransition(LEGAL-only, NOOP EXCLUDED — stateMachine.ts:53/46) + cross-axis guard map (pwuGuards.ts:19). No cross-axis entry for PROPOSED->SHAPING. This canTransition-based guard incidentally refuses a same-state re-issue with the wrong code (RPH_ILLEGAL_STATE_TRANSITION) — the exact 'protection by accident' the kit.ts:447-449 note describes. No precondition field on advancePwuLifecycle.. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION, produced by the advancePwuLifecycle `if (!advance.ok)` arm (pwu.ts:317-322). (Missing aggregate -> RPH_VALIDATION_SEMANTIC_FAILED via loadOrReject kit.ts:95; sent expectedRevision mismatch -> RPH_REVISION_CONFLICT kit.ts:113.). Re-issue: refused-by-guard: SHAPING->SHAPING classifies NOOP, canTransition returns false, canAdvanceWorkLifecycle.ok=false -> reject RPH_ILLEGAL_STATE_TRANSITION at pwu.ts:320.. Accumulative: revision.
- **MarkPwuReady** (markPwuReady:419) — PWU.workLifecycleState → READY. Guard: THREE layered checks, none a `precondition` field: (1) expectedSemanticVersion staleness guard (pwu.ts:429, RPH_REVISION_CONFLICT) — optimistic concurrency on the SEMANTIC version, distinct from envelope revision; (2) checkPwuShapeReadiness domain guard (pwu.ts:436, pwuGuards.ts:125, RPH_VALIDATION_SEMANTIC_FAILED) enforcing the §9.1 shape-readiness limbs + §6.3 root-intent-at-least-PROVISIONAL; (3) canAdvanceWorkLifecycle via advancePwuLifecycle (pwu.ts:316) — canTransition legality only, NO cross-axis entry for SHAPING->READY.. Wrong-state code today: Primary wrong-state (source != SHAPING): RPH_ILLEGAL_STATE_TRANSITION via advancePwuLifecycle arm (pwu.ts:320). Stale shape version -> RPH_REVISION_CONFLICT (pwu.ts:431). Unmet shape readiness -> RPH_VALIDATION_SEMANTIC_FAILED (pwu.ts:438).. Re-issue: refused-by-guard: READY->READY is NOOP -> canTransition false -> RPH_ILLEGAL_STATE_TRANSITION at pwu.ts:320. (Would also typically fail the staleness guard first if semanticVersion moved.). Accumulative: revision.
- **ChallengePwu** (challengePwu:463) — PWU.workLifecycleState → CHALLENGED. Guard: canAdvanceWorkLifecycle only (pwu.ts:316) = canTransition(LEGAL-only, NOOP excluded) + cross-axis map; no cross-axis entry for READY->CHALLENGED. No precondition field.. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION via advancePwuLifecycle arm (pwu.ts:320).. Re-issue: refused-by-guard: CHALLENGED->CHALLENGED NOOP -> canTransition false -> RPH_ILLEGAL_STATE_TRANSITION at pwu.ts:320.. Accumulative: revision.
- **ReshapePwu** (reshapePwu:478) — PWU.workLifecycleState → RESHAPING. Guard: canAdvanceWorkLifecycle only (pwu.ts:316); no cross-axis entry for EXECUTING->RESHAPING or UNDER_ASSURANCE->RESHAPING. No precondition field.. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION via advancePwuLifecycle arm (pwu.ts:320).. Re-issue: refused-by-guard: RESHAPING->RESHAPING NOOP -> canTransition false -> RPH_ILLEGAL_STATE_TRANSITION at pwu.ts:320.. Accumulative: revision.
- **InvalidatePwu** (invalidatePwu:496) — PWU.workLifecycleState → INVALIDATED. Guard: canAdvanceWorkLifecycle only (pwu.ts:316); no cross-axis entries for the INVALIDATED in-arrows. No precondition field.. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION via advancePwuLifecycle arm (pwu.ts:320).. Re-issue: refused-by-guard: INVALIDATED->INVALIDATED NOOP -> canTransition false -> RPH_ILLEGAL_STATE_TRANSITION at pwu.ts:320.. Accumulative: revision.
- **SupersedePwu** (supersedePwu:515) — PWU.workLifecycleState → SUPERSEDED. Guard: canAdvanceWorkLifecycle only (pwu.ts:316); no cross-axis entries for the SUPERSEDED in-arrows. The transition-table 'Not already BASELINED' guard string (transitions.data.ts:355 etc.) is NOT a code check — it is enforced STRUCTURALLY by the absence of any BASELINED->SUPERSEDED arrow (BASELINED is terminal, transitions.data.ts:154). No precondition field.. Wrong-state code today: RPH_ILLEGAL_STATE_TRANSITION via advancePwuLifecycle arm (pwu.ts:320) — including any attempt from BASELINED/ABANDONED/SUPERSEDED (terminal, no in-arrow to SUPERSEDED).. Re-issue: refused-by-guard: SUPERSEDED->SUPERSEDED NOOP -> canTransition false -> RPH_ILLEGAL_STATE_TRANSITION at pwu.ts:320. (SUPERSEDED is terminal, so it also has no out-arrows at all.). Accumulative: revision.
- **DeletePwa** (deletePwa:495) —  → DISCARDED. Guard: hand-rolled status check `publicationStatus === 'DISCARDED'` -> RPH_INVARIANT_VIOLATION 'already deleted' (line 499/500); PLUS referential-integrity undertakingsOf(pwa)>0 -> RPH_INVARIANT_VIOLATION 'in use' (line 502/504). Not routed through canTransition.. Wrong-state code today: RPH_INVARIANT_VIOLATION (line 500) on a re-issue of an already-DISCARDED PWA (the idempotency guard); RPH_INVARIANT_VIOLATION (line 506) if any Undertaking was instantiated from it; RPH_VALIDATION_SEMANTIC_FAILED (loadOrReject, kit.ts line 95) if the PWA does not exist.. Re-issue: refused-by-guard.
- **PromoteBaseline** (promoteBaseline:549) — Baseline.status → AUTHORITATIVE. Guard: canPromoteBaseline gate (governance.ts:557-606) + decisionAuthorizesVersions stale-version check (:613-630) + invalidatedEvidenceUnderminingPromotion pull-guard (:635-648). All reject with RPH_INVARIANT_VIOLATION (:603 codes-join, :626 STALE_DECISION_VERSION, :645 INVALIDATED_EVIDENCE). The gate routes through canTransition('Baseline.status', status,'AUTHORITATIVE') at rph-domain governance.ts:376.. Wrong-state code today: RPH_INVARIANT_VIOLATION, produced by the guard's canPromoteBaseline ILLEGAL_PROMOTION_TRANSITION finding (rph-domain governance.ts:376 canTransition -> reject at handler governance.ts:601-605). checkTransition's RPH_ILLEGAL_STATE_TRANSITION is NEVER reached for any wrong source (guard fires first, kit.ts:480 before :483) — the 'wrong refusal code' symptom of GUARD_ONLY_ACCIDENTAL.. Re-issue: refused-by-guard (ACCIDENTAL) — an AUTHORITATIVE->AUTHORITATIVE re-issue is caught by canPromoteBaseline: its canTransition check counts only 'LEGAL' (excludes NOOP), so it pushes ILLEGAL_PROMOTION_TRANSITION -> handler rejects RPH_INVARIANT_VIOLATION before checkTransition (which would have admitted the NOOP) is ever reached.
- **ActivateExecutionPlan** (activateExecutionPlan:323) — ExecutionPlan.status → ACTIVE. Guard: canActivatePlan (execution.ts:348-363; kernel rph-domain/execution.ts:46-56): enforces one-ACTIVE-plan-per-PWU (otherActivePlanExistsForPwu, RPH-EXE-001) AND checks APPROVED->ACTIVE legality via canTransition. Rejects RPH_INVARIANT_VIOLATION (:356-360).. Wrong-state code today: RPH_INVARIANT_VIOLATION from the guard arm (execution.ts:356-360). Note: even when the failing limb is the one-active-plan check (kernel errorCode RPH_ACTIVE_PLAN_CONFLICT), the guard hard-codes 'RPH_INVARIANT_VIOLATION' and embeds check.reason in the message — the kernel errorCode is NOT propagated as the wire code. checkTransition (kit.ts:483) is never reached because the guard runs first.. Re-issue: refused-by-guard.

## 4. Invariant catalog

Each invariant is stated in canonical voice, with the failure it prevents (WHY), its scope, and a non-example where over-application is plausible (DOC-004 §10). Invariants that restate a DOC-003 requirement cite it rather than duplicating.

**SPEC-001-INV-1 · Every state-advancing command declares its source-state precondition.** A command that advances an aggregate's status field carries an explicit precondition over `(loadedState, payload)` — a `fromStates(...)` set in the common case, a predicate where a non-state discriminator or a payload-derived target requires one — enforced at the write primitive.
**WHY:** the state machine alone is not a sufficient precondition: it admits a `from === to` NOOP as legal, and a command is usually narrower than its machine (several commands drive the same arrow from different sources).
**SCOPE:** state-advancing commands. **NON-EXAMPLE:** a create (`CREATE_NA`) has no source state; its precondition is existence/uniqueness, not a from-state set, and this invariant does not demand one.

**SPEC-001-INV-2 · A same-state re-issue is refused and appends nothing.** Issuing an advance command when the aggregate is already in the target state — or in any state outside the command's declared source set — returns a rejection and produces **zero** new events, **zero** revision bump, **zero** semantic-version bump, and **zero** mutation of state.
**WHY:** accepted semantic changes are immutable events; a second event for a change that did not happen is a permanent false entry in an append-only record with no retraction (JPWB-CON-000 AX-7; JPWB-DOC-003 §9 / PER-2).
**SCOPE:** the NOOP (same-state) re-issue and every wrong-source issue. **NON-EXAMPLE:** a genuine hold that advances an *orthogonal* axis while its own axis stays put (`ChangePwuState` holding workLifecycle while moving assurance) is not a NOOP and is not refused — the rule fires only when the command would change nothing (SPEC-001-INV-6 states the all-axes case).

**SPEC-001-INV-3 · The precondition is enforced before any domain guard.** In the shared write primitive, precondition evaluation is sited ahead of `args.guard` (and of `advanceIntent`'s `precheck`), so the precondition is reachable on every input and its refusal is never masked by a guard that happens to reject the same input first.
**WHY:** a precondition sited *behind* a `canTransition`-based guard is dead code — the guard refuses the same re-issue first, so removing the precondition changes nothing and its mutation red-proof (§5) cannot fail. An unfailable conformance test is an anti-vacuity violation (JPWB-CON-000 B7; JPWB-DOC-004 §7.4).
**SCOPE:** sites carrying both a precondition and a guard. **NON-EXAMPLE:** the guard is **not** removed — a guard that carries an independent domain rule (authority for `makeDecisionEffective`; the assurance floor for `publishPwa`; conservation for `validateDecomposition`) runs after the precondition and still fires on the inputs the precondition admits.

**SPEC-001-INV-4 · Source sets are authored from the machine's own in-arrows, never generated from `drivesFrom`.** Each authored set is derived from the aggregate machine's in-arrow set to the command's target state (§2) and cites the rows it came from.
**WHY:** the vocab's `drivesFrom` has no ratified authority (DS-001 D4 / §2–§3): it is absent for twelve commands, names the wrong machine for `CompleteAssuranceAssessment`, declares non-state sentinels for twenty-three, and generating from it would silently revert two shipped hardenings.
**SCOPE:** authoring the set. **NON-EXAMPLE:** `drivesFrom` may be read as *evidence* while authoring; it is barred only as a *generator*.

**SPEC-001-INV-5 · No currently-refused command becomes accepted; no legitimate flow starts failing.** Adding a precondition only ever narrows the accepted set. Every state the machine legitimately reaches the target from — the widest legal in-arrow — remains accepted.
**WHY:** a precondition *narrower* than the machine's in-arrows silently breaks a real flow; this is the single most likely regression a hand-authored set causes.
**SCOPE:** every authored set. **NON-EXAMPLE:** a *deliberate* narrowing below the machine (e.g. `denyWaiver` restricted to `PROPOSED` though the machine also legalises `EFFECTIVE → SUPERSEDED`) is permitted **only** when it is stated in-comment and covered by a positive test proving the intended narrowing.

**SPEC-001-INV-6 · A re-issue must not compound any accumulative field.** (Generalizes DS-001 finding F-4, the `SupersedeAssurancePolicy` tags case.) An **accumulative field** is one a re-issue would *grow* or *append to* rather than overwrite. The precondition that refuses the NOOP re-issue (INV-2) is what protects every accumulative field at once. The accumulative fields, enumerated from §3:

| Field | Commands (instances) | The compounding harm |
|---|---|---|
| `tags` (array push) | `SupersedeAssurancePolicy` (`superseded-by:<id>`) | a re-issue appends a **second** `superseded-by` tag naming a different or same successor |
| `entries` (array push) | `AppendConversationEntries` | a re-issue appends the same conversation entries twice |
| `semanticVersion` (increment) | `ReviseIntent`, `ReviseDecomposition` | a re-issue inflates the version; an inflated version **voids an outstanding approval** whose `approvedSemanticVersion` no longer matches |
| a second immutable event (append) | every `NONE`/`GUARD_ONLY` advance | a contradicting duplicate `DecisionRevoked` / `BaselineSuperseded` / `AssurancePolicy*` |

**WHY:** a compounding field turns a NOOP into a growing lie — a governed record accreting entries for events that never happened.
**SCOPE:** the enumerated fields. **NON-EXAMPLE:** an **overwrite** field (`promotionDecisionId`, `approvalDecisionId`) is not *compounded* — a re-issue would rewrite it in place; that harm is already forbidden by INV-2 refusing the re-issue, and this invariant does not additionally regulate overwrite fields. `revision` is bumped by every legitimate advance and is protected only transitively (by refusing the re-issue); it is not itself the accumulative harm this invariant names (see fork F-5).

**SPEC-001-INV-7 · The refusal code is fixed by which arm refuses, and a code change at a guarded site is enumerated.** A wrong-**source** (state) refusal returns `RPH_ILLEGAL_STATE_TRANSITION` (result status `REJECTED`). A wrong-**kind** refusal (a non-state discriminator, e.g. `decisionType`) returns `RPH_VALIDATION_SEMANTIC_FAILED`. Because the precondition now runs before the guard (INV-3), a site previously protected only by a `canTransition`-based guard changes its wrong-state code from the guard's code to `RPH_ILLEGAL_STATE_TRANSITION`.
**WHY:** an unenumerated code change silently breaks a consumer or test asserting the old code — the change is deliberate, so it must be listed and tested per site, never discovered in the field.
**SCOPE:** the guarded coexistence sites (enumerated in §3.1). The known instances: `makeDecisionEffective` factory `RPH_AUTHORITY_INSUFFICIENT → RPH_ILLEGAL_STATE_TRANSITION` (shipped, DWP-01b); `publishPwa` `RPH_INVARIANT_VIOLATION → RPH_ILLEGAL_STATE_TRANSITION` (shipped, DWP-01b); `PromoteBaseline` `RPH_INVARIANT_VIOLATION → RPH_ILLEGAL_STATE_TRANSITION` (pending, DWP-04). **NON-EXAMPLE:** a `NONE` site with no guard has no code change — its wrong-state code is already `RPH_ILLEGAL_STATE_TRANSITION` from `checkTransition`.

**SPEC-001-INV-8 · A fresh-key re-issue is a distinct request the precondition — not the idempotency layer — refuses.** The bus keys idempotency strictly on `idempotencyKey`; every key producer in the repository is a monotonic counter, so the idempotency layer absorbs an exact transport replay and nothing else. A command re-issued with a *fresh* key and a possibly-different payload is a distinct request, and the precondition must refuse it (DS-001 D3, sponsor-ruled REJECT-not-absorb).
**WHY:** absorbing a fresh-key re-issue as a duplicate hides a real caller error; DOC-007 §30's accept-without-effect is specified for the same-**key** duplicate only.
**SCOPE:** fresh-key re-issues. **NON-EXAMPLE:** an exact same-key transport retry is correctly absorbed by the bus and is not this SPEC's concern.

## 5. Conformance-fixture specification

This section is what Phase 2 (DWP-04) and every future DWP implement against. For each state-advancing command `C` with authored source set `S` and target state `t`:

**5.1 The obligation per command.**
1. **Negative (re-issue) fixture — the kill test.** Drive the aggregate to `t` through the legitimate path, then re-issue `C`. Assert: result `REJECTED`; `error.code` = the enumerated code (INV-7 — `RPH_ILLEGAL_STATE_TRANSITION` unless the row says otherwise); **no** new event of `C`'s event type (count unchanged); **no** revision bump; **no** accumulative-field growth (INV-6). Assert the same for at least one wrong-source that is not `t`.
2. **Positive (widest-in-arrow) fixture — the regression guard.** For **each** state in `S`, issue `C` from that state and assert `ACCEPTED`. This is the regression INV-5 exists to catch; a set with more than one source (e.g. `ActivateAssurancePolicy` from `DRAFT` *and* `SUSPENDED`) tests **each** source.
3. **Mutation red-proof — the anti-vacuity obligation (CON-000 B7).** Weakening `S` (adding `t` to it) or deleting the precondition MUST make the negative fixture (1) go **RED**. A negative fixture that stays green under that mutation is itself a finding, not a pass: it means the precondition is dead code (INV-3 unsatisfied) or the assertion is vacuous. The implementer performs this mutation live and records that the named test failed.

**5.2 Per-site fixture obligations — DWP-04's six.** (Machine rows: §2 `AssurancePolicy.status` `transitions.data.ts:1056-1078`; `Baseline.status` `:1542-1580`; `Decision.status` `:1516-1541`.)

| Command | Authored set `S` | Negative fixture (re-issue from) | Positive fixture (accept from) | Enumerated code | Special obligation |
|---|---|---|---|---|---|
| `RevokeDecision` | `EFFECTIVE` | `REVOKED` → REJECTED, one `DecisionRevoked` | `EFFECTIVE` (an EFFECTIVE decision, either `decisionType`) | `RPH_ILLEGAL_STATE_TRANSITION` (was already this via checkTransition; no code change — NONE site) | no `decisionType` predicate (revocation addresses both APPROVAL and WAIVER) |
| `PromoteBaseline` | `APPROVED` | `AUTHORITATIVE` → REJECTED, one `BaselinePromoted` | `APPROVED` (a baseline with an EFFECTIVE promotion decision) | `RPH_ILLEGAL_STATE_TRANSITION` — **CODE CHANGE** from `RPH_INVARIANT_VIOLATION` (F-2/F-3): enumerate + test | keep `canPromoteBaseline` (independent promotion rules) after the precondition |
| `SupersedeBaseline` | `AUTHORITATIVE` | `SUPERSEDED` → REJECTED, one `BaselineSuperseded` | `AUTHORITATIVE` | `RPH_ILLEGAL_STATE_TRANSITION` (NONE site, no change) | — |
| `ActivateAssurancePolicy` | `DRAFT`, `SUSPENDED` | `ACTIVE` → REJECTED, one `AssurancePolicyActivated` | `DRAFT` **and** `SUSPENDED` (both sources) | `RPH_ILLEGAL_STATE_TRANSITION` (NONE site, no change) | the two-source positive fixture is mandatory |
| `SuspendAssurancePolicy` | `ACTIVE` | `SUSPENDED` → REJECTED, one `AssurancePolicySuspended` | `ACTIVE` | `RPH_ILLEGAL_STATE_TRANSITION` (NONE site, no change) | — |
| `SupersedeAssurancePolicy` | `ACTIVE`, `SUSPENDED` | `SUPERSEDED` → REJECTED, one `AssurancePolicySuperseded`, **`tags` unchanged** | `ACTIVE` **and** `SUSPENDED` | `RPH_ILLEGAL_STATE_TRANSITION` (NONE site, no change) | **F-4 obligation:** the negative fixture supplies a `supersededByPolicyId` and asserts the `tags` array did **not** grow (INV-6) |

`rejectIfFloorLocked` is an independent domain rule on all three AssurancePolicy commands and is retained after the precondition (INV-3 non-example). Because the precondition runs first, a floor policy in the wrong state now refuses on state (`RPH_ILLEGAL_STATE_TRANSITION`) before the floor-lock arm — a benign ordering effect within the same REJECTED result; the floor-lock refusal for a floor policy in a *legal* source state is unchanged.

**5.3 Per-site fixture obligations — DWP-05's eleven** (DELIVERED). (Machine rows: §2 `ExecutionPlan.status` `transitions.data.ts:1355-1420`; `PWA.publicationStatus` `:1616-1630`. Both `illegal:[]`, so each authored set is the machine's full in-arrow source set.)

| Command | Authored set `S` | Negative fixture (re-issue / wrong source) | Positive fixture | Enumerated code | Special obligation |
|---|---|---|---|---|---|
| `ApproveExecutionPlan` | `UNDER_REVIEW` | `APPROVED` → REJECTED, one `ExecutionPlanApproved` | `UNDER_REVIEW` | `RPH_ILLEGAL_STATE_TRANSITION` (NONE site) | — (the RPH-ASM-006 assumption guard is retained; a wrong-state + dead-assumption case now refuses on state ahead of the guard) |
| `ActivateExecutionPlan` | `APPROVED` | `ACTIVE` → REJECTED **at `RPH_ILLEGAL_STATE_TRANSITION`** | `APPROVED` | **CODE CHANGE** `RPH_INVARIANT_VIOLATION → RPH_ILLEGAL_STATE_TRANSITION` (INV-7) | keep `canActivatePlan`; the one-active-plan rule (RPH-EXE-001) stays in the guard as `RPH_INVARIANT_VIOLATION` |
| `CancelExecutionPlan` | `APPROVED`, `ACTIVE` | `CANCELLED` → REJECTED, one `ExecutionTerminated` | `APPROVED` **and** `ACTIVE` (both) | `RPH_ILLEGAL_STATE_TRANSITION` (NONE site) | **two-source positive fixture mandatory** |
| `CompleteExecutionPlan` | `ACTIVE` | `COMPLETED` → REJECTED, one `ExecutionPlanCompleted`; + wrong-state APPROVED with a non-terminal step | `ACTIVE` | `RPH_ILLEGAL_STATE_TRANSITION` (NONE site) | **guard-mask fix:** wrong-state now refuses on state ahead of the step-success guard |
| `FailExecutionPlan` | `ACTIVE` | `FAILED` → REJECTED, one `ExecutionPlanFailed` | `ACTIVE` | `RPH_ILLEGAL_STATE_TRANSITION` (NONE site) | — |
| `SupersedeExecutionPlan` | `PROPOSED`, `UNDER_REVIEW`, `APPROVED`, `ACTIVE` | `SUPERSEDED` (naming a nonexistent successor) → REJECTED, one `ExecutionPlanSuperseded` | `UNDER_REVIEW`, `APPROVED`, `ACTIVE` (the 3 **reachable** sources) | `RPH_ILLEGAL_STATE_TRANSITION` (NONE site) | **guard-mask fix** (successor guard); `PROPOSED` is machine-legal but runtime-unreachable (`ProposeExecutionPlan` creates plans in `UNDER_REVIEW`) — in the set for machine fidelity (INV-4), not positively testable |
| `ApplyTacticalChange` | `ACTIVE` **(declared hold)** | non-ACTIVE (e.g. `APPROVED`) → REJECTED | `ACTIVE` (admitted **and repeatable** — a hold, not a NOOP to refuse) | `RPH_ILLEGAL_STATE_TRANSITION` | **replaces** the removed hand-rolled guard; load-bearing beyond NOOP closure — without it `APPROVED→ACTIVE` is legal, so a tactical change is a backdoor activation |
| `SubmitPwaForReview` | `DRAFT` | `UNDER_REVIEW` → REJECTED, one `PwaSubmittedForReview` | `DRAFT` | `RPH_ILLEGAL_STATE_TRANSITION` (NONE site) | — |
| `ValidatePwa` | `UNDER_REVIEW` | `VALIDATED` → REJECTED, one `PwaValidated`; + wrong-state DRAFT with an invalid graph | `UNDER_REVIEW` | `RPH_ILLEGAL_STATE_TRANSITION` (NONE site) | **guard-mask fix** (the PILOT-002 ordering issue: `pwaCompositionGate` before `checkTransition`); mirrors landed `publishPwa` (DWP-01b) |
| `DeprecatePwa` | `PUBLISHED` | `DEPRECATED` → REJECTED, one `PwaDeprecated` | `PUBLISHED` | `RPH_ILLEGAL_STATE_TRANSITION` (NONE site) | — |
| `RetirePwa` | `DEPRECATED` | `RETIRED` → REJECTED, one `PwaRetired` | `DEPRECATED` | `RPH_ILLEGAL_STATE_TRANSITION` (NONE site) | — (establish recorded `codeChange=none` via a wrong-state-parity fallacy; verify CORRECTED — the NOOP closure still requires the source edit) |

All eleven were established empirically (DWP-05 step 1 establish→verify→synthesize), authored, mutation-red-proofed live (weakening all 11 sets made exactly the 11 kill/wrong-state tests RED, all 7 positives green), gated green, and adversarially verified. Fixtures: `dwp05-precondition-coverage.test.ts`. The five `commitState`/edit-append sites (`DeletePwa`, `EditPwa`, `EditPwuType`, `RemovePwuType`, `AppendConversationEntries`) are **not** status advances — deferred to DWP-08's reader-precondition variant (§7).

**5.4 INV-1 is now compiler-mandatory (DWP-06 / D5).** `precondition` is a *required* property on both write primitives (`advanceStatus`, `advanceIntent`) — omitting it is a compile error, so no status advance can silently skip its declaration and the count cannot regress. The flip surfaced exactly one residual `advanceStatus` site the earlier DWPs had missed — `submitBaselineForReview` (`Baseline.status`, in-arrow `CANDIDATE`, a NONE site outside DWP-04's six) — now authored `fromStates('CANDIDATE')` with a kill test + mutation red-proof (`dwp06-precondition-coverage.test.ts`). The third primitive `advancePwuLifecycle` (PWU-lifecycle) is independent of `advanceStatus` and remains the F-6 backlog.

## 6. Forks — numbered sponsor decisions

Authored under the 2026-07-24 grant; each is a decision a reasonable sponsor might rule differently. The recommendation is adopted to keep writing (DOC-004 §10.7) and is marked; ruling otherwise changes what is cited.

> **ADOPTION (2026-07-24).** On the sponsor's *"Proceed"*, DWP-04 Phase 2 adopted the recommended defaults of **F-2** (accept the guarded-site refusal-code change), **F-3** (`PromoteBaseline` = `fromStates('APPROVED')` + retain `canPromoteBaseline`), **F-4** (the three `AssurancePolicy` sets are UNRATIFIED-AUTHORED from the machine), and **F-5** (`revision` is out of INV-6 scope) as **delegated authority**. F-1 and F-6 are the scheduled continuation (DWP-05…N). Recorded in `JAN-CMDPRE-SPEC-001 findings 2026-07-24.md` (PILOT-005) and `JAN-CMDPRE-DR-001` DWP-04. A later sponsor ruling otherwise re-opens exactly the citations these forks name.

- **F-1 · Scope continuation.** This DRAFT authors target sets exhaustively for governance + assurance + the JAN-CMDPRE-hardened families; the execution PLAN-level and pwa-authoring publication remainder are *classified* (§3.1) but not *target-authored*, because `JAN-CMDPRE-DR-001` DWP-05 marks those exposures `knowledge_status: PARTIAL`. **Options:** (a) continue in SPEC-001 v0.2 once DWP-05 establishes the exposures empirically; (b) author speculative sets now, marked UNRATIFIED. **Recommendation: (a)** — authoring an unestablished target is inventing a settled fact (AX-8). *Downstream if (b):* the §7 deferrals move into §3/§5 as UNRATIFIED rows. **RESOLVED (DWP-05, 2026-07-24):** option (a) executed — the exposures were established empirically (establish→verify→synthesize, run `wf_aa098578-c84`) and the 11 sites authored in §5.3; the sole remainder is the `commitState` set (DWP-08).
- **F-2 · Accept the refusal-code change at guarded sites.** Moving enforcement ahead of the guard (INV-3) changes the wrong-state code at `PromoteBaseline` (and shipped: the decision factory, `publishPwa`). **Options:** (a) accept, enumerate + test per site (DS-001 §14); (b) preserve the old code via a compatibility shim. **Recommendation: (a)** — the state fact is the truer refusal; a shim reintroduces the accidental coupling. *Downstream if (b):* INV-7 is rewritten and every guarded site carries shim logic.
- **F-3 · `PromoteBaseline` is GUARD_ONLY_ACCIDENTAL, not NONE (roadmap correction).** The catalog shows `canPromoteBaseline` already refuses the re-issue via `canTransition` (NOOP-excluding), returning `RPH_INVARIANT_VIOLATION`. **Decision:** author `fromStates('APPROVED')` **and** keep `canPromoteBaseline` (it carries the promotion-decision, stale-version, and invalidated-evidence rules); the re-issue then refuses on state first (F-2 code change). **Confirm** this is the intended shape rather than leaving the accidental protection.
- **F-4 · The `AssurancePolicy.status` sets are UNRATIFIED-AUTHORED.** The three policy-lifecycle commands have no `drivesFrom` anywhere; their sets (`Activate` ← DRAFT|SUSPENDED; `Suspend` ← ACTIVE; `Supersede` ← ACTIVE|SUSPENDED) are authored from the machine's in-arrows (`transitions.data.ts:1056-1078`) and marked UNRATIFIED-AUTHORED (DS-001 §10 residual 2). **Confirm** the machine rows are the authority for these sets.
- **F-5 · Does `revision` count for INV-6?** Every advance bumps `revision`; treating it as an accumulative field would make INV-6 name a field that is *supposed* to move on a legitimate advance. **Recommendation:** INV-6's target is fields a re-issue makes semantically *wrong* (`tags`, `semanticVersion`, `entries`, event-append); `revision` is protected transitively by INV-2 and is out of INV-6's scope. **Confirm** or fold `revision` in.
- **F-6 · The un-hardened backlog beyond DWP-04's six.** The catalog surfaces **22 NONE + 9 GUARD_ONLY_ACCIDENTAL** sites; DWP-04 remediates 6. The remainder is a real backlog: execution plan-level (×6, DWP-05), pwa-authoring publication (×~7), the PWU-lifecycle `advancePwuLifecycle` sites (×6, GUARD_ONLY but returning the *correct* `RPH_ILLEGAL_STATE_TRANSITION`), and `EditAssurancePolicy` / `SubmitEvidenceForAssessment` / `SubmitPwaForReview` / `SubmitBaselineForReview` / `DeletePwa`. **Options:** (a) schedule all as DWP-05..N under this SPEC; (b) rule the PWU-lifecycle GUARD_ONLY sites *accepted-as-is* (their accidental protection at least returns the right code, so only the "by design + mutation-provable" property is missing). **Recommendation: (a)**, with the PWU-lifecycle sites lowest priority. *This fork is the SPEC's honest disclosure that DWP-04 is one increment of a larger surface.*

## 7. Deliberately Unspecified

Names and contracts referenced but not fully specified in this DRAFT, each with its reason and owning fork/question. An unlisted undefined name would be a defect (DOC-004 §10 / commission anti-elision).

| Item | Reason deferred | Owner |
|---|---|---|
| ~~Execution PLAN-level + pwa-authoring publication target sets~~ — **DELIVERED in DWP-05 (§5.3)**: the 7 execution plan-level + 4 pwa-authoring publication sites are authored; `ValidatePwa`'s PILOT-002 ordering issue is fixed | — | done |
| ~~The `commitState`/edit-append sites (`DeletePwa`, `EditPwa`, `EditPwuType`, `RemovePwuType`, `AppendConversationEntries`)~~ — **DELIVERED in DWP-08**: per-KIND predicates via `kit.checkPrecondition` — EDIT no-op (`EditPwa`, `EditPwuType` via `noOpEditPrecondition`), DELETION (`RemovePwuType`; `DeletePwa` was already covered by its explicit already-DISCARDED guard, documented not double-authored), empty-batch (`AppendConversationEntries`). The `AppendConversationEntries` duplicate-BATCH rule is **deferred** (residual R2, RESIDUALS.md); the owning-PWA `semanticVersion` bump is **residual R1** (a derived write, no command site). | R1/R2 → RESIDUALS.md | done (DWP-08) |
| PWU-lifecycle explicit sets (`BeginPwuShaping`, `MarkPwuReady`, `ChallengePwu`, `ReshapePwu`, `InvalidatePwu`, `SupersedePwu`) | Currently GUARD_ONLY_ACCIDENTAL via `advancePwuLifecycle`, but returning the correct `RPH_ILLEGAL_STATE_TRANSITION`; lowest-priority remediation | F-6 |
| ~~`EditAssurancePolicy`, `SubmitEvidenceForAssessment`~~ — **DELIVERED in DWP-08**: `EditAssurancePolicy` carries the EDIT no-op predicate (`noOpEditPrecondition`); `SubmitEvidenceForAssessment` carries the EVENT-LOG-DEPENDENT **reader** predicate (`evidenceNotAlreadyReceived`, dedup by `(evidenceId, satisfiesRequirementId)` via `read.aggregateEvents`) — the site commits **no** state delta by design, so a generic no-change rule would refuse every legitimate submission and take down the seed chain; the reader variant is exactly critique B4's ground. | done (DWP-08) | done |
| `AggregateAssuranceDisposition` (`transitions.data.ts:1591`) | A computed disposition rollup with no transitions — not a state machine; out of transition-legality scope | — |
| The pure-create commands (`CREATE_NA`, 22 of them) | No source state; precondition is existence/uniqueness, outside this SPEC's transition-legality concern; listed in §3 for completeness | — |
| Exact error-code strings, enum spellings, event payload shapes | Repository shape authority (generated contracts); cited, never restated (CON-000 B3, DOC-004 §2.3) | repository |
| The MEANING of every transition guard string in §2 | JPWB-DOC-003 §6-§8 owns it; §2 records the declared guard, not its semantics | DOC-003 |

---

*End of JAN-CMDPRE-SPEC-001 v0.1.0 DRAFT. A JAN-CMDPRE program deep reference (not canon), authored under the sponsor's 2026-07-24 deep-specification grant. The state-machine catalog (§2, 26 machines) and the per-command classification (§3, 84 commands) are complete; the target-set authoring and fixture obligations are exhaustive for DWP-04's ground and the JAN-CMDPRE-hardened families, with the DWP-05 plan-level and pwa-authoring remainder tabled in §7 under forks F-1/F-6. See the paired `.provenance.md` sidecar and `JAN-CMDPRE-SPEC-001 findings 2026-07-24.md`.*
