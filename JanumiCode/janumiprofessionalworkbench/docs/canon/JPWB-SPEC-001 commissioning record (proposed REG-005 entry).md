# Proposed JPWB-REG-005 entry — the JPWB-SPEC-001 commission

> **Why this is a separate file and not an edit to the register.** `JPWB-REG-005 Decision and Divergence Register.md`
> currently carries **uncommitted** work from the JAN-CSAA workstream, which has claimed `REG-D-020`, `REG-D-021`
> and `REG-D-022` in the working tree. Appending here would either collide with those identifiers or commit
> another workstream's in-flight edits along with this one. The entry below is therefore drafted **without a
> number**: the next free identifier is `REG-D-023` *if* the three JAN-CSAA entries land first, and `REG-D-020`
> if they do not. The sponsor assigns it at merge.
>
> **This file confers nothing** (CON-000 B2). It is the instrument for a conferral the sponsor makes by merging it.

---

### REG-D-0nn — Commission of JPWB-SPEC-001, the Professional Projection and Workbench Surface reference specification

- **Date:** 2026-07-28 · **Type:** DECISION (sponsor act: commissioning direction — *"Proceed with your
  commissioning spec recommendation. It should be normative, prescriptive, deontic in language consistent with the
  (metadata) format of other related documentation."*)

- **Antecedent.** On the same date the sponsor ruled that the `docs/Constitution Discussion/` set — naming
  *JanumiCode UI Information Architecture and Screen Contract* as the exemplar — was "created as orthogonal
  documentation to address some of the gaps that the RPH documentation did not cover", and that its standing
  outside the RPH authority ladder is "an unfortunate side effect of how they were generated". The
  Constitution-Discussion Conferral Sheet was prepared against that ruling; its recommended vehicle — **commission
  a successor SPEC rather than admit a v0.1.0 draft as authority over working code it disagrees with** — is the
  option this entry executes.

- **Statement.** `JPWB-SPEC-001 — Professional Projection and Workbench Surface` is **COMMISSIONED** as the first
  member of the `JPWB-SPEC-nnn` series recognised by CON-000 B1. Its concern is **how governed professional state
  becomes inspectable and actionable without the surface acquiring authority**. It is layer Semantic Model,
  settledness HYPOTHESIS, subordinate to `JPWB-DOC-003` by concern and to `JPWB-DOC-002` for all vocabulary; exact
  shapes remain the repository's.
  - **Sources, with declared standing.** `JAN-RIWS-001` (principal), `JAN-JCUX-001` (screen-level),
    `JAN-CPM-001` (projection model), and RPH-DOC-010 *PWA Designer and Undertaking Workbench — Reference
    Demonstration* (incumbent behaviour). **The commission carries their CONTENT into the registry; it does not
    confer status on the source documents themselves**, which remain as the Conferral Sheet dispositions leave
    them. This resolves `REG-Q-047` in the manner its own safe default requires — *"any adoption as conformance
    criteria requires a Decision"* — by adopting the content through a commissioned successor rather than by
    ratifying the transcript-era drafts.
  - **Two source defects are declined explicitly**, so the decision is on the record rather than in a diff: JCUX §4
    roots every route at `/{organizationId}/`, an identifier with **zero occurrences** in the repository, and its
    screen is titled *"Endeavor Detail Screen"* using a term `JPWB-DOC-002:248` retired in favour of
    **Undertaking**, where `:249` forbids minting a second competing root without a Decision. SPEC-001 SHALL use
    canonical vocabulary and SHALL NOT adopt the organization-rooted route form.
  - **Pairing obligation (REG-D-009).** SPEC-001 SHALL be paired with **enforced** repository reference artifacts
    that cite the spec sections they implement. The commission does not discharge this; it binds it. The candidate
    carrier already exists and is exercised — the Playwright suites under `apps/rph-demo/e2e` and the projection
    tests under `packages/rph-projections` — and has simply never been pointed at a specification.
  - **Phase-bound, per REG-D-009's SPEC-lifecycle clause.** SPEC-001 holds authority over its ground during
    convergence only. When its content is fully performed by enforced reference artifacts and conformance tests,
    its authority **transfers to the codebase** and the SPEC retires to historical status by sponsor act.

- **What the commission is expected to make countable.** The specification's value is measured by whether it
  converts known surface defects from invisible into reportable. Six were **measured** on the built surface on
  2026-07-28 and are cited in the spec as the motivating failures for its invariants: content clipped beyond an
  unscrollable container (68 of 77 rows on one tab); four projection queries unscoped to their subject where a
  fifth was fixed; nine of sixteen route actions unreachable; a four-command sequence that commits two writes then
  reports refusal; the ratified uncertainty objects (`ASSUMPTION`, `QUESTION`, `CONTRADICTION`, `UNCERTAINTY`)
  carrying **no user interface anywhere**, leaving CON-000 **AX-3** unperformed; and no surface anywhere
  explaining why an affordance is absent. Per CON-000 **B7**, an obligation surface that leaves these unreported
  asserts a status nothing performs.

- **Standing of the drafted artifact.** The commissioned document is authored under this grant and is **DRAFT**.
  Authoring is not ratification (B2): SPEC-001 acquires authority only through its own individual ratification
  entry, which SHALL follow review of the drafted text and its fork list. Every fork the drafting surfaces is a
  sponsor decision, not an agent resolution.

- **Disposition:** Proposed. Decided only on merge.

- **Merge target:** `JPWB-REG-005` (this entry); `JPWB-SPEC-001` (the drafted specification, separately ratified);
  `REG-Q-047` (disposed by the adoption-through-successor mechanism stated above).

- **Status:** PROPOSED — awaiting sponsor merge. Confers nothing until merged (B5).

---

## What the sponsor is being asked to do

| # | Act | Effect if merged | Effect if withheld |
|---|---|---|---|
| 1 | Merge this entry into `JPWB-REG-005` under the next free identifier | SPEC-001 becomes a commissioned draft with declared scope and standing; `REG-Q-047` is disposed | SPEC-001 remains an authored document with no registry standing — historical material under B1, exactly as its sources are today |
| 2 | Rule the forks listed in SPEC-001 §11 | The spec closes; ratification becomes possible | The spec stays open at those points; the safe defaults recorded beside each fork govern in the interim |
| 3 | Ratify SPEC-001 in a separate entry, after review | The specification governs its ground during convergence, and its pairing obligation becomes live | The draft stands as a proposal and binds nothing |

**Acts 1 and 3 are deliberately separate.** Commissioning a specification and ratifying its text are different
sponsor judgements, and collapsing them would be the wholesale-ratification pattern `REG-D-013` bars.
