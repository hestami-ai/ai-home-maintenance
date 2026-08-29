# DESIGN — JAN-SLICE: journey-traced vertical slices as the verification and progress substrate

**Authority:** sponsor direction, 2026-08-29 — *"verify and validate implementation and addressing implementation
gaps through thin vertical slices … we would need something like the capabilities and user journeys and whatever
else to develop some set of end-to-end test cases that can perhaps drive more clearly the development in a holistic
way in conjunction with the document corpus and perhaps even the registry."* Two forks were ruled the same day:
**engine plane first, surface plane second**, and **the W7 product-behavior plane IS promoted** (§6).

**Method:** two adversarial measurement passes (5 lenses + critic; 4 lenses + critic) over the repository at
`462e2fc1`, each figure derived by a quoted command, each absence carrying a positive control. Every figure this
design rests on was re-driven by the author before being written here; the ones that were not are marked.

**Status:** DESIGN ONLY. **This document authorizes no implementation.** A `JAN-SLICE-DR-001 Detailed
Implementation Roadmap` MUST follow and MUST be approved before any file outside `docs/_working/` changes.

---

## 0. Normative keywords, and the authority this document does *not* have

**MUST / MUST NOT / SHALL** state an obligation on the JAN-SLICE programme. **SHOULD** states a strong default that
MAY be departed from only with the departure recorded in the register. **MAY** states a genuine option.

⚠ **THIS DOCUMENT IS NOT CANON AND MUST NOT BE CITED AS THOUGH IT WERE.** `docs/_working/` is working material.
`JPWB-CON-000 B1` fixes canon as exactly CON-000, DOC-001..004, REG-005, the `JPWB-SPEC-nnn` series, program working
references under a registered grant, and the repository's generated contracts and conformance tests as *shape*
authority. **Nothing else governs.** Every obligation below binds because the sponsor directed this programme, not
because this file says so. Where an obligation derives from a ratified rule, that rule is cited inline; where it
derives from a measurement, the measurement is given. **An obligation with neither is a proposal and is marked so.**

This distinction is not pedantry. `REG-F-014` — an open, ship-blocking entry — is precisely the defect of an actor
manufacturing authority it was never granted. A design document that helped itself to canonical voice would be
committing the defect it exists to help close.

---

## 1. The problem, measured

### 1.1 The wave programme cannot report progress, and never could

**MEASURED.** The entire W0–W10 programme is **11 code increments and ~9 gate documents, all committed on
2026-07-19** — one day, 2,770 insertions, laid over an engine that already carried ~261k. It was a retrospective
gating pass over work already done, not a build plan. Since that day: **735 commits, of which zero name the
programme in their subject** (four name it in a body). The work continued under ~13 successor programme names.

**Five waves contributed zero lines.** W5, W6 and W7 were written for a brownfield legacy migration **that never
existed** — shadow objects for legacy runs, a pilot cohort over a dual-write plane, retiring legacy phase authority.
W9 and W10 are honestly deferred and out of first-increment scope by their own gates.

**The consequence for design, and it is the whole reason this programme exists:** a *wave* is a horizontal layer.
A layer can be complete or absent; it cannot be thin. That is why the wave ledger offered no cut line, and why
"treading water" is what six weeks of real completion work felt like from inside it. **A journey cuts the other
way.** A journey slice touches contracts, domain, application, persistence, projection and surface in one thin
strand, so it can be *complete and small* — the property a layer cannot have. **JAN-SLICE MUST decompose by
journey act, and MUST NOT decompose by architectural layer.**

### 1.2 The only end-to-end rule family is the only family exempt from the gate

**MEASURED, re-driven by the author.** Of 125 ratified conformance rules: 42 COVERED, 76 PARTIAL, **7 DEFERRED**.
All seven deferred rules are `RPH-E2E-001..007`. And:

```ts
export const DEFERRABLE_PREFIXES: ReadonlySet<string> = new Set(['RPH-E2E']);
```

A set of one. Its own docblock, written after an earlier finding removed `RPH-CMP` from it, says in terms:

> *"A `DEFERRABLE_PREFIXES` entry removes the family from the question, so there is no claim left to over-[claim].
> It is the one manifest defect the overclaim gate is structurally blind to."*

**The one family whose remit is end-to-end journeys is the sole member of the set that exempts it from checking.**
The system left itself exactly this hole, wrote down that the hole is structurally invisible, and left the E2E
family sitting in it.

⚠ **AND THE EXPOSURE IS WIDER THAN THE SEVEN.** The conformance gate's only structural check on a rule's citation
is that the cited file *exists*. **Nothing checks that the cited test asserts the rule — 125 of 125.** Nineteen
rules cite something that is not a path at all, including the bare prose string `'rph-persistence + rph-domain'`
standing for eleven rules. Seventy-six PARTIAL rules share eleven distinct citations.

### 1.3 Divergence survives wherever the reader's predicate is narrower than the claim

**MEASURED.** The master `JPWB Implementation Roadmap and Tracker.md` has a progress log whose last entry is dated
**2026-07-12**, recording *"340 → 338 tests"*. The `verif` gate alone now runs 346, and the full suite runs 2,962.
Around that silence grew ~19 `docs/_working/ROADMAP-*.md` files (2026-08-04 → 2026-08-29, fifteen of them
write-once), 13 per-programme roadmaps, 34 `DESIGN-*` files, two `RESIDUALS` files, and a tracking index.

⚠ **READERSHIP IS NOT THE FIX, AND THAT IS THE FINDING.** The master tracker **is** read by four consumers and is
still stale, because staleness was reintroduced in prose its parser does not match. A sibling substrate
(`docs/tracking/w3b/`, 4.9 MB) was born **one day after** the anti-divergence index and sits outside it: the
index's `censusDir` is a single directory and `readdir` never sees the sibling. Query `origin LIKE '%w3b%'` returns
**0**; control `origin LIKE '%f200%'` returns 21.

**Therefore: divergence survives wherever the reader's predicate is narrower than the claim the artifact makes.**
Any progress record that is *authored* and then *read* will diverge, because authoring is unconstrained and reading
is a predicate. **JAN-SLICE's ledger MUST therefore be DERIVED from the test corpus and MUST NOT be hand-authored**
(§4). A record generated from the thing it describes cannot drift from it.

⚠ **THE AUTHOR OF THIS DOCUMENT IS AN INSTANCE OF THE DEFECT.** `docs/_working/ROADMAP-register-append-only.md`
was created by this author on 2026-08-29, commit `460d134b` — a twentieth tracking file, written on the same day as
an audit of this very class. **A design that only prescribes discipline will fail exactly as that did.** The
mechanism in §4 is load-bearing precisely because good intentions are measured here to be insufficient.

---

## 2. What a Slice is

### 2.1 Definition

> A **Slice** is a named, ordered sequence of professional acts, expressed in the corpus's own vocabulary, driven
> end to end against a real engine, asserting at every act that the ratified rules governing that act hold — and
> failing if any of them does not.

A Slice is **not** a test file, **not** a milestone, and **not** a work package. It is a *journey with assertions*.
A Slice MAY be implemented across several test files; a test file MUST NOT implement more than one Slice.

### 2.2 The vertical constraint

Every Slice **MUST** begin at an act that creates professional intent or shape and **MUST** end at an act that
produces a governed, durable outcome — a promoted Baseline, a recorded refusal, or an explicitly recorded
non-terminal state. A Slice that ends mid-journey is a scenario fragment and **MUST NOT** be admitted to the ledger.

A Slice **MUST NOT** be defined by the subsystem it exercises. "The persistence slice" is a layer wearing the word.

### 2.3 The two planes, and their order

Every Slice **MUST** declare exactly one plane.

| Plane | Drives | Runs today | Order |
|---|---|---|---|
| `ENGINE` | commands through the real bus and store | **Yes.** 2,962 tests green across 290 files; the reference undertaking drives 393 dispatches | **First** |
| `SURFACE` | a browser, through the demo's routes | **Yes, in part.** 6 page routes, 37 specs, **77 Playwright tests green** | Second |

⚠ **A CORRECTION THE AUTHOR OWES.** An earlier framing said browser cases "need the evidence surface built first."
**That was too broad and is withdrawn.** Browser cases run today and are green. What has **no browser path** is the
**evidence stage specifically**: `ProposeEvidence`, `AdmitEvidence` and `SubmitEvidenceForAssessment` appear **zero
times** in `apps/rph-demo/src` and `apps/rph-demo/e2e` (positive control: `CreatePwa` 3 files, `PromoteBaseline` 1,
`AbandonPwu` 1). More broadly, **44 of 105 registered commands are unreachable from the browser**, including all
four BIND commands.

**Ordering, per sponsor ruling:** the `ENGINE` plane **MUST** be completed for a given journey before the `SURFACE`
plane for that same journey is begun. The reason is not preference but evidence: an `ENGINE` Slice that fails
localises the defect to the kernel; a `SURFACE` Slice that fails when the engine plane is unproven cannot tell a
wiring defect from a domain defect. **A `SURFACE` Slice MUST cite the `ENGINE` Slice it presupposes**, and MUST NOT
be admitted while that Slice is failing or absent.

---

## 3. Obligations on every Slice

These are the normative core. A candidate Slice satisfying fewer than all of `SL-1` … `SL-9` **MUST** be refused
admission to the ledger, and the refusal **MUST** name the obligation it failed.

**SL-1 — CORPUS TRACE.** Every Slice **MUST** cite at least one ratified rule identifier (`RPH-*`, `AX-*`, `STA-*`,
`DEC-*`, `ASR-*`, `OBJ-*`, `PER-*`) that the Slice exists to hold. A Slice citing none is a demonstration, not a
verification, and **MUST NOT** be admitted.

**SL-2 — THE ASSERTION OBLIGATION.** For every rule a Slice cites, the Slice **MUST** contain an assertion that
fails when that rule is violated. **Executing a journey is not asserting it.** This obligation exists because the
conformance gate does not carry it: it checks that a cited file exists and never that the file asserts anything
(§1.2, 125 of 125). **A Slice MUST NOT satisfy SL-1 by citation alone.**

**SL-3 — THE PREDICTED RED.** Every Slice **MUST** ship with at least one named mutant — a specific, minimal change
to production code — together with the message the Slice is predicted to fail with. The mutant **MUST** be driven
and the predicted message **MUST** be matched **before** the Slice is admitted. A green Slice whose red was never
observed proves nothing, and this repository has recorded that failure repeatedly.

⚠ **SL-3a — THE MUTANT MUST DISCRIMINATE.** Where a Slice asserts several rules, a mutant that reddens more than
one assertion proves none of them individually. Each cited rule **MUST** have a mutant that reddens **its own**
assertion and leaves the others green, or the rules **MUST** be split across Slices until it does.

**SL-4 — REGISTER BINDING.** Every Slice **MUST** name the `JPWB-REG-005` entries it discharges, in whole or in
part, and **MUST NOT** claim to discharge an entry it does not assert. On admission, a superseding register entry
**SHALL** be filed recording what the Slice discharged. Where a Slice discharges nothing, it **MUST** say so —
`Discharges: none` is a valid and useful declaration.

**SL-5 — SCENARIO CLASS.** Every Slice **MUST** declare its class from the eight ratified minimum scenario classes:
*normal path; alternate valid path; user-error path; system-failure path; permission-denied path; interrupted or
resumed path; data-unavailable path; cancellation path.* The ratified rule is quoted verbatim and already carries
its own deontic force:

> *"Not every journey requires every class, but **inapplicability must be explicit**."*

Accordingly: for each declared journey, every class **MUST** be either covered by a Slice or **explicitly recorded
as inapplicable with a reason**. Silence **MUST** be treated as a gap, never as inapplicability.

**SL-6 — PLANE AND PRESUPPOSITION.** Every Slice **MUST** declare `ENGINE` or `SURFACE` (§2.3). A `SURFACE` Slice
**MUST** cite its presupposed `ENGINE` Slice.

**SL-7 — NO FABRICATION.** A Slice **MUST** drive real command handlers through the real bus against a real store.
It **MUST NOT** stub, mock, or fake any act it claims to verify. Where an external dependency genuinely cannot be
driven, the Slice **MUST** record the substitution explicitly and **MUST NOT** claim the substituted act as
verified. The precedent is on the record: the reference undertaking once claimed to uphold execution ≠ assurance
while performing no assurance at all, and five tests over it stayed green throughout.

**SL-8 — HONEST FAILURE.** A Slice that cannot yet pass **MUST** be admitted as failing rather than withheld,
skipped, or weakened to green. `ASR-9` requires honest failure of the product; this programme **SHALL** hold itself
to it. **Weakening an assertion to admit a Slice is prohibited.** A Slice MAY be admitted `PENDING` only when the
capability it asserts is genuinely unbuilt, and a `PENDING` Slice **MUST** name the capability and the register
entry tracking it.

**SL-9 — DERIVED LEDGER ENTRY.** Every Slice's ledger row **MUST** be derivable from the Slice's own source by a
program, with no hand-authored duplicate anywhere (§4).

---

## 4. The Slice Ledger — derived, never authored

**This is the mechanism that answers §1.3, and it is the part of this design most likely to be quietly skipped.**

**SL-L1.** The Slice Ledger **MUST** be *generated* from the test corpus by a program that reads the Slice
declarations out of the Slice sources themselves. It **MUST NOT** be a document anyone edits. A hand-maintained
progress file **MUST NOT** be created by this programme under any name.

**SL-L2.** The generator **MUST** run inside `gate:fast`, and the gate **MUST** fail when the committed ledger
differs from the generated one. A ledger that can be stale is the artifact this programme exists to stop producing.

**SL-L3 — THE READER'S PREDICATE MUST BE STATED AND TESTED.** The measured mechanism of divergence is that a
reader's predicate is narrower than the claim its artifact makes. Therefore the generator's predicate — exactly
which files it reads, and exactly what shape it recognises — **MUST** be stated in the ledger's own header, and
**MUST** carry a control test proving it *fails* when a Slice is placed where the predicate cannot see it. Without
that control, `docs/tracking/w3b/` recurs: a sibling substrate born one day after the machinery meant to prevent it.

**SL-L4 — SUBSUMPTION, NOT ACCUMULATION.** JAN-SLICE **MUST** retire what it replaces. On each Slice's admission,
every superseded roadmap or residual claim it covers **MUST** be struck in place — `~~old~~ **new**`, per the
register's retire-by-striking idiom — and **MUST NOT** be deleted. **A JAN-SLICE that leaves the nineteen working
roadmaps standing has become the twentieth**, and the programme **SHALL** be judged failed on that ground alone
regardless of its test count.

**SL-L5.** The ledger **MUST NOT** claim authority over `JPWB-REG-005`. The register is canonical
(`JPWB-CON-000:19`, `:101`); the ledger is a derived view. Where they disagree, **the register governs** and the
generator **MUST** be treated as defective.

---

## 5. The seed set, and the first act

**SL-S1.** `RPH-E2E-001..007` **SHALL** be the initial Slice set. They are already ratified, already expressed in
Given/When/Then prose, and already machine-readable in `packages/rph-domain/vocab/m12-conformance.json`. **Nothing
new is authored to start.** The programme begins by honouring a commitment the corpus already made.

**SL-S2 — THE FIRST ACT IS THE REMOVAL.** `'RPH-E2E'` **MUST** be removed from `DEFERRABLE_PREFIXES`, making it an
empty set.

⚠ **THIS IS A PREDICTED RED AND MUST BE OBSERVED BEFORE IT IS MADE GREEN.** Removing the prefix moves seven rules
out of `DEFERRED`. The conformance gate is expected to redden, and the author of the change **MUST** record the
exact failure message *before* changing anything else. Making the gate green by any means other than admitting
Slices that genuinely assert those seven rules — re-adding the prefix, restating the rules as `PARTIAL`, citing a
file that does not assert them — is **prohibited**, and is the precise defect `REG-F-013` recorded when `RPH-CMP`
sat in that set under a reason both halves of which were false.

**SL-S3.** The conformance gate **SHOULD** additionally acquire an assertion-resolution predicate, so that a rule's
citation is checked to assert the rule rather than merely to exist (§1.2). This is marked SHOULD rather than MUST
because it touches 125 rules at once and its blast radius has not been measured; the roadmap **MUST** measure it
before it is scheduled.

**SL-S4 — MATERIAL ALREADY WRITTEN MUST NOT BE RE-DERIVED.** The following exist and **MUST** be used rather than
reinvented; each was located by measurement, and any Slice that duplicates one **MUST** be refused:

- a **72-step expected event trace**, phase-segmented into 11 named phases, at `packages/rph-engine/fixtures/expected-events.jsonl`;
- an **8-step professional walkthrough**, surface by surface, at `JPWB-SPEC-001 §9.0–9.9`;
- **27 ratified minimum-conformance-scenario bullets** in the Coding Agent Guide §14.3 — one of which states this
  programme's own target in terms: *"the FSM reference Undertaking and first Product Realization architecture slice
  end to end"*;
- **15 capabilities, 8 actors, an 11-step critical journey and 9 exceptional paths** in the Field Service
  Management reference undertaking;
- the **`User Journey Definition` PWU Type** with its 15 required fields and the 8 scenario classes of `SL-5`.

---

## 6. The product-behavior plane (W7 promotion)

**Ruled by the sponsor, 2026-08-29: the promotion is agreed.**

`Actor`, `Capability`, `User Journey`, `Scenario` and `Requirement` **SHALL** be promoted to first-class object
types. **MEASURED:** none exists as an object-type literal today (0 hits across `rph-contracts/src` and
`rph-domain/src`; positive control: existing object-type literals return 78). `USER_JOURNEY_DEFINITION` exists
today only as a `pwuKind` in the ontology.

⚠ **THIS PROMOTION IS THE DISCHARGE OF A RATIFIED DEFERRAL, NOT THE CLOSING OF A DEFECT, AND THE ROADMAP MUST SAY
SO.** FSM §30.2 defers the plane in terms:

> *"Initially represent these through typed fields or extensions… Promote them to universal first-class tables only
> after the Product Realization PWA implementation proves the need."*

The condition is **proof of need**, and this programme is that proof: a verification substrate keyed to capabilities
and journeys cannot trace to objects that do not exist. Accordingly the roadmap **MUST** record the promotion as
*the deferral's condition having been met*, citing §30.2, and **MUST NOT** record it as remediation of a gap. The
distinction is the difference between a design maturing as designed and a design having been wrong.

**SL-W7-1.** The promotion **MUST** follow the corpus's own object-plane pattern — contracts, schemas, transitions,
handlers, registry — and **MUST NOT** introduce a parallel representation.

**SL-W7-2.** No Slice **MAY** depend on the promoted plane until it lands. Slices admitted before it **MUST** trace
to rule identifiers, which exist today. **The promotion is an enabler, not a prerequisite**, and the programme
**MUST NOT** stall behind it.

---

## 7. Sequence

The roadmap **MUST** order the work as follows. Each stage's exit condition is stated; a stage **MUST NOT** begin
before its predecessor's exit condition is observed, not asserted.

| # | Stage | Exit condition |
|---|---|---|
| 1 | Remove `'RPH-E2E'` from `DEFERRABLE_PREFIXES`; record the red | The gate's failure message is recorded verbatim in the register |
| 2 | Build the ledger generator and its `SL-L3` predicate control | The control is driven and observed **red** when a Slice is hidden from the predicate |
| 3 | Admit `RPH-E2E-001` as an `ENGINE` Slice, satisfying `SL-1`…`SL-9` in full | One Slice green, its mutant driven red, its ledger row generated |
| 4 | Admit `RPH-E2E-002..007` as `ENGINE` Slices | Seven Slices; `DEFERRABLE_PREFIXES` empty and the gate green **on assertions, not citations** |
| 5 | Strike every superseded roadmap and residual claim (`SL-L4`) | No working roadmap claims an item the ledger now derives |
| 6 | Promote the W7 product-behavior plane (§6) | The five object types exist and are registered |
| 7 | Build the evidence surface; admit the first `SURFACE` Slices | A human can cross the evidence stage in a browser |

⚠ **STAGE 5 IS NOT OPTIONAL AND MUST NOT BE DEFERRED PAST STAGE 4.** It is the stage that distinguishes this
programme from its nineteen predecessors, it is the one with no test to force it, and it is therefore the one that
will be skipped if it is not gated. The roadmap **MUST** give it a gate.

---

## 8. What this design does not decide

Recorded so that silence is not read as a ruling. Each **MUST** be answered by the roadmap or escalated.

1. **Whether v1 is production-facing.** Two deferred gate families become mandatory *"at the first production-facing
   slice"*, and authentication sits with them. Unruled — `REG-Q-038` carries no status line at all.
2. **Whether `reconcile` is in scope.** It is one of nine ratified primary verbs and **the only WRITE verb with no
   command anywhere** (0 of 105 registry keys match `/reconcil/i`).
3. **What `PARTIAL` should mean** for 76 conformance rules resolving on 11 citations.
4. **Referential integrity across the PWA version boundary.** `DeletePwa` has an in-use guard; `deprecatePwa` and
   `retirePwa` have none, and `CreateUndertaking` pins `pwaVersion` as a fixed literal.
5. **Whether the seeded PWA stops being TypeScript.** A successor PWA is authorable and publishable at runtime
   through the real bus — this was driven — so the live question is whether the seed *should* be code.
6. **Minimality of the journey in §7 of the ground-truth brief.** Confidence was recorded MEDIUM: the 31-command
   leaf segment is what the engine *accepts*, not the result of minimising against each guard.

---

## 9. Falsifiers

**This design SHALL be treated as refuted if any of the following is observed.** Stated in advance so the programme
can be shown wrong rather than argued with.

1. **A Slice passes while a rule it cites is violated.** Refutes `SL-2`; the assertion obligation is not doing work.
2. **The ledger and the test corpus disagree at any commit.** Refutes `SL-L1`/`SL-L2`; the generator is not the
   only writer.
3. **A twentieth hand-authored progress file appears** under any name, including one written by this programme.
   Refutes `SL-L4` and reproduces the measured defect.
4. **A mutant reddens more than one cited rule's assertion and is accepted anyway.** Refutes `SL-3a`.
5. **`DEFERRABLE_PREFIXES` regains a member.** Refutes `SL-S2` and repeats `REG-F-013` exactly.
6. **A Slice is weakened to admit it.** Refutes `SL-8`, and is the one failure mode that would make every figure
   this programme reports worthless.
