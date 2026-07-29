# JPWB-SPEC-001-DR-002 F-I — proposed REG-005 entry

*Prepared 2026-07-29. **PROPOSED, NOT CONFERRED.** Under CON-000 B2 status is conferred by the sponsor and never
authored; under B5 a ruling made in conversation "is not effective until it lands as a REG-005 entry and is
merged into its governing artifact — a ruling may never float outside the canon." This file is the entry offered
for that merge, not the merge.*

> **Why this file exists rather than a paragraph in a roadmap.** CON-000 B7 requires a discovered gap between
> asserted and performed status to be *"escalated via REG-005 — never quietly documented around and never
> quietly closed."* The sponsor's ruling on F-I is to leave the code unchanged. Recording that solely in
> `JPWB-SPEC-001-DR-002` §F-I would be the documenting-around the clause names: the roadmap is a working
> reference, not the register. The disposition below is therefore offered to REG-005 in its own format, and
> DR-002 §F-I now points here and states that the ruling is proposed until this merges.

---

### REG-F-006 — `ReviseDecomposition` performs none of DOC-003's revision obligations

- **Date:** 2026-07-28 (found while planning JPWB-SPEC-001-DR-002 W-3; restated 2026-07-29 after adversarial
  verification) · **Type:** DIVERGENCE FINDING · **Class:** DOCS_STRONGER, with a CON-000 B7 anti-vacuity
  component — the same class and shape as **REG-F-005**, and this entry is filed partly so the two are not
  disposed inconsistently.

- **Statement:** `JPWB-DOC-003` (OPERATIVE, REG-D-010) binds decomposition **revision** three times: DEC-2
  (`:215`) — *"Revising a decomposition is legal, changes the parent's semantic version, and triggers impact
  analysis"*; DEC-3 SCOPE (`:221`) — *"governs every decomposition, revision, and delegation"*, rule *"No
  mandatory obligation silently disappears"*; DEC-4 SCOPE (`:225`) — *"governs decomposition, delegation,
  semantic revision, and context assembly."*

  `reviseDecomposition` (`packages/rph-application/src/handlers/decomposition.ts:277-289`) is declared
  `(ctx, command)` with **no payload parameter** and no `mutate`. It advances `status` to `SUPERSEDED` and bumps
  `semanticVersion`. Of DEC-2's three requirements it performs one. Obligation conservation and constraint
  disposition — whose carriers `obligationAllocations` and `constraintPropagations` are declared on the command
  (`packages/rph-contracts/src/messages.ts:406-411`) — are neither applied, nor refused, nor recorded as
  unperformed. Runtime-verified against a real store: a revise carrying all four fields returns `ACCEPTED` with
  the aggregate's `childWorkUnitIds` unchanged and both allocation arrays still `[]`.

  Three aggravating facts, each verified independently:

  1. **The audit record omits what it exists to record.** `DecompositionRevisedPayloadSchema`
     (`messages.ts:1020-1025`) is a `strictObject` requiring `supersedesDecompositionContractId`, `rationale`,
     `semanticVersion`, `status`. The emitted payload — `command.payload` verbatim, per `kit.ts:569` — fails it
     four ways, lacking the supersession id, the version and the status, and carrying three keys the schema
     forbids.
  2. **The annotation that looks like a disclosure is the mechanism that disabled the check.**
     `DecompositionRevised` escapes that schema only because it is absent from `RATIFIED_EVENT_PAYLOADS`, and it
     is absent because its vocabulary entry is marked `UNRATIFIED-AUTHORED` — `gen-messages.ts:226-229` skips
     such entries, and the generated header states the consequence: *"marking an entry UNRATIFIED-AUTHORED in the
     vocab removes it from enforcement on the next gen."* Compare **REG-F-002**, "Vocabulary `sourceSection`
     provenance theater".
  3. **No consumer, and no observation.** Nothing in `rph-projections`, `rph-engine`, `rph-assurance`,
     `rph-authoring` or `apps/rph-demo` reads `DecompositionRevised`. No test populates the three fields or
     asserts on the emitted payload, and `emitted-event-conformance` cannot see it because its subject
     (`driveReferenceUndertaking`) never issues this command.

  **Caller-visible residual that no obligation catches:** a caller supplying `childWorkUnitIds` receives
  `ACCEPTED` and cannot learn that nothing was applied. SPEC-001 INV-08 (`:3085`) obliges disclosure only on a
  **refused** command and INV-14 (`:3286`) only on an **interrupted** sequence; an accepted-but-unapplied command
  falls between them. This is offered as a candidate SPEC-001 gap in its own right.

- **Disposition (PROPOSED):** **Leave the code unchanged for now — sponsor ruling, 2026-07-29.** Defensible on
  the corrected evidence: no production code issues this command (the only reachable path is the test-mode
  `/test-api/dispatch` route, which forwards an unfiltered `commandType`), nothing consumes its event, and the
  repair is a decomposition-model decision rather than a patch. **The finding remains OPEN.** Remediation, when
  taken, is mechanically available and has direct precedent — `checkTransition` constrains `status` only, and
  `advanceStatus`'s `mutate` hook is used at eleven sites including `supersedeAssurancePolicy`
  (`assurance.ts:332-351`), which writes a payload-derived field while advancing to `SUPERSEDED`.

  **A defence considered and rejected.** The vocabulary note *"DOC-002-only; new contract = DRAFT"*
  (`m3-commands-events.json:7150-7157`) appears to license the handler as "supersede, then propose a successor".
  It does not: it is disclaimed by its own paired entry (*"Do NOT treat this sourceSection as proof the shape is
  ratified. Ratification pending"*), the engine states that vocabulary's `drivesFrom` *"has no ratified
  authority"* (`kit.ts:507`), DOC-002 carries no DecompositionContract transition matrix, and the only ratified
  sentence on the subject describes an **in-place** revision. This is recorded because the reading is a natural
  one and was in fact reached once during this programme; adopting it would have justified downgrading a B7
  finding by citing an unratified source as ratified.

- **Merge target:** Repository (handler + a conformance fixture for the revision obligations); `JPWB-DOC-003`
  DEC-2/3/4 carry the semantic requirement unchanged. `JPWB-SPEC-001-DR-002` §F-I carries the working record and
  points here. **Status:** OPEN — disposition proposed, awaiting sponsor conferral.

---

## What conferral requires

1. Sponsor merges the entry above into `JPWB-REG-005 Decision and Divergence Register.md` §5 (Section D —
   divergence findings), renumbering if REG-F-006 is taken.
2. On merge, `JPWB-SPEC-001-DR-002` §F-I's line *"the ruling recorded here is **proposed, not conferred**"* is
   struck and replaced with the register citation.
3. Nothing else changes. The ruling is deliberately a decision **not** to alter code, so there is no
   implementation to gate — which is exactly why the record has to be exact.
