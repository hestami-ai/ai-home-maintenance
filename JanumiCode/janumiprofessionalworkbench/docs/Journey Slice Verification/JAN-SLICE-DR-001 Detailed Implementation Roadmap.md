# JAN-SLICE-DR-001 — Detailed Implementation Roadmap

*`PROPOSED` / **v0.1.0**. Design authority: `docs/_working/DESIGN-journey-slice-verification.md` (filed 2026-08-29
with `REG-D-045`). Scope: journey-traced vertical slices as the verification and progress substrate. **No work
package is LANDED.** Sponsor rulings carried: engine plane before surface plane; the W7 product-behavior plane is
promoted. Deontic keywords per the design's §0 — MUST / MUST NOT / SHALL bind this programme; SHOULD MAY be departed
from only with the departure recorded in the register.*

---

## 1. Document control and repository identity

- **Repository:** `JanumiCode/janumiprofessionalworkbench` (Turborepo + Bun 1.3.14). Engine work MUST be driven with
  `node`, never `bun` — the `better-sqlite3` native addon does not load under bun in this tree.
- **Design authority:** `docs/_working/DESIGN-journey-slice-verification.md`, obligations `SL-1` … `SL-W7-2`.
- **Commissioning act:** `REG-D-045` (2026-08-29), which also records the two sponsor rulings.
- **Series identity:** `JAN-SLICE`. Work packages are `JAN-SLICE-SWP-nn`.
- **Boundary:** commits by explicit path; the human runs git; **NO PUSH**.
- **Out of scope by sponsor instruction:** `packages/csaa` and every CSAA document. No figure in this roadmap
  includes them; where excluding them would change a figure, both are given.

## 2. Activated scope

The seven ratified end-to-end conformance rules `RPH-E2E-001..007`, the conformance manifest's deferral mechanism,
a derived Slice Ledger and its generator, the subsumption of superseded progress claims, the W7 product-behavior
object plane, and the demo's missing evidence surface.

**Out of scope, disclosed:** the assertion-resolution predicate for all 125 conformance rules (`SL-S3`, a SHOULD
whose blast radius is unmeasured — §11 R-4); authentication (C2); tenancy (W9); platform and commerce (W10);
`reconcile` as a command (§11 D-2).

## 3. Normative-source digest

- **`JPWB-CON-000 B1`** — canon is exactly CON-000, DOC-001..004, REG-005, the `JPWB-SPEC-nnn` series, program
  working references under a registered grant, and the repository's generated contracts, schemas, migrations and
  conformance tests **as shape authority**. *This roadmap is none of those. It binds because `REG-D-045`
  commissioned it.*
- **`JPWB-CON-000 B7`** — asserted status MUST be performed status. *The `SL-2` assertion obligation is this rule
  applied to the verification apparatus itself.*
- **`ASR-9`** (honest failure) — *`SL-8`: a Slice that cannot pass MUST be admitted failing, never weakened to green.*
- **`ASR-3`** (the unconditional de minimis assurance floor, three floor policies) — *any Slice reaching a
  satisfaction hop MUST drive the floor, not stub it.*
- **`STA-1` / `STA-2` / `STA-3`** — four orthogonal axes; execution success moves work toward evidence and
  assurance, never directly to satisfaction. *`RPH-E2E-002` is this pair stated as a scenario.*
- **Product Realization PWA ontology, "Minimum scenario classes"** — eight classes, and verbatim: *"Not every
  journey requires every class, but **inapplicability must be explicit**."* *This is already deontic and `SL-5`
  merely carries it.*
- **FSM §30.2** — the product-behavior plane is deferred *"until the Product Realization PWA implementation proves
  the need."* *§SWP-05 discharges the condition; it does not remediate a defect.*

## 4. Current-state findings and evidence

Each figure below was derived by a quoted command and re-driven by this roadmap's author before being written here.

- **F-1. The seven E2E rules are DEFERRED, and their family is the only exempt one.** `coverageFor()` over the 125
  ratified rules → 42 COVERED, 76 PARTIAL, 7 DEFERRED, 0 UNACCOUNTED. All seven DEFERRED are `RPH-E2E-001..007`.
  `conformance-manifest.ts:468`: `export const DEFERRABLE_PREFIXES: ReadonlySet<string> = new Set(['RPH-E2E']);`
- **F-2. The exemption is documented as structurally blind.** `conformance-manifest.ts:416`, verbatim: *"A
  `DEFERRABLE_PREFIXES` entry removes the family from the question, so there is no claim left to over-[claim]. It
  is the one manifest defect the overclaim gate is structurally blind to."*
- **F-3. Nothing checks that a cited test asserts its rule — 125 of 125.** `conformance.test.ts:203-208` checks only
  `existsSync`. Nineteen rules cite a non-path, including the bare prose string `'rph-persistence + rph-domain'`
  standing for eleven rules; the 76 PARTIAL rules share eleven distinct citations.
- **F-4. The evidence stage has no browser path.** `ProposeEvidence`, `AdmitEvidence` and
  `SubmitEvidenceForAssessment` each appear in **0** files under `apps/rph-demo/src` and **0** under
  `apps/rph-demo/e2e`. **Positive control:** `CreatePwa` → 3 files, `PromoteBaseline` → 1, `AbandonPwu` → 1. More
  broadly 44 of 105 registered commands are unreachable from the browser.
- **F-5. Browser cases DO run.** 6 page routes, 37 spec files, **77 Playwright tests green**. *An earlier framing
  that browser cases "need the evidence surface built first" was too broad; the sponsor corrected it and it is
  withdrawn in `REG-D-045`. The narrow claim is F-4.*
- **F-6. The product-behavior plane does not exist.** 0 hits for `'USER_JOURNEY'|'REQUIREMENT'|'CAPABILITY'|
  'SCENARIO'|'ACTOR'` as object-type literals across `rph-contracts/src` and `rph-domain/src`. **Positive control:**
  existing object-type literals → 78 hits. `USER_JOURNEY_DEFINITION` exists today only as a `pwuKind`.
- **F-7. The progress substrate is stale and multiplying.** The master tracker's progress log last entry is
  **2026-07-12** recording *"338 tests"*; the suite now runs 2,962 across 290 files. ~19 `docs/_working/ROADMAP-*.md`
  files, fifteen write-once, grew around it. `docs/tracking/w3b/` was born one day after the anti-divergence index
  and is invisible to it (`origin LIKE '%w3b%'` → 0; **control** `'%f200%'` → 21).
- **F-8. The seed set does not cover the mandated scenario classes.** See §9 — derived, and it changes the shape of
  `SWP-03`.

## 5. Target-state gap analysis

| # | Gap | Closed by |
|---|---|---|
| G-1 | Seven ratified end-to-end rules assert nothing and are exempt from the gate | `SWP-00`, `SWP-02`, `SWP-03` |
| G-2 | No Slice declaration format exists; nothing can be traced or derived | `SWP-01` |
| G-3 | Progress is hand-authored, therefore stale, therefore multiplying | `SWP-01`, `SWP-04` |
| G-4 | Superseded roadmap claims stand unretired | `SWP-04` |
| G-5 | Capabilities and journeys cannot be traced to objects that do not exist | `SWP-05` |
| G-6 | No browser journey crosses the evidence stage | `SWP-06` |
| G-7 | At least four mandated scenario classes have no seed scenario | `SWP-03` (§9) |

## 6. Alternatives considered and selected strategy

**A-1 — Extend the wave programme.** REJECTED. Measured: the whole W0–W10 programme is 11 code increments and ~9
gate documents **all committed on 2026-07-19**, and 735 subsequent commits name it zero times. A layer can be
complete or absent but never thin; extending it reproduces the condition this programme exists to end.

**A-2 — Author fresh end-to-end scenarios.** REJECTED. Seven are already ratified, already Given/When/Then, already
machine-readable. Authoring new ones first would leave the ratified seven exempt — the exact defect — while
manufacturing unratified obligations beside them.

**A-3 — Widen the conformance gate first (assertion-resolution over all 125 rules).** DEFERRED, not rejected. It is
`SL-S3`, a SHOULD. Its blast radius across 125 rules is unmeasured, and starting there would block the programme
behind an unbounded change. `SWP-01` MUST measure it; scheduling follows the measurement.

**SELECTED — A-4.** Remove the exemption first and record the red; build the declaration format and the derived
ledger; admit the ratified seven as `ENGINE` Slices; subsume the superseded claims under gate; then promote the
object plane; then build the evidence surface and the first `SURFACE` Slices.

## 7. Repository architecture and change map

| Area | Change |
|---|---|
| `packages/rph-domain/src/conformance-manifest.ts` | `DEFERRABLE_PREFIXES` → empty set (`SWP-00`) |
| `packages/rph-domain/src/conformance.test.ts` | records the red; later asserts on assertions, not citations |
| `verif/slice-ledger.ts` + `verif/slice-ledger.test.ts` | **new** — the generator, its predicate, and its control |
| `docs/tracking/slices/` | **new** — the generated ledger. Generated only; never hand-edited |
| `packages/rph-engine/src/slices/` | **new** — `ENGINE` Slice sources |
| `apps/rph-demo/e2e/slices/` | **new** — `SURFACE` Slice sources (`SWP-06`) |
| `packages/rph-contracts`, `rph-domain`, `rph-application` | the five promoted object types (`SWP-05`) |
| `apps/rph-demo/src/routes` | the evidence surface (`SWP-06`) |
| `docs/_working/ROADMAP-*.md`, `docs/**/RESIDUALS*.md` | struck in place, never deleted (`SWP-04`) |

## 8. Detailed work-package register

⚠ **THESE BLOCKS CARRY NO `delivery_state` FIELD. THAT IS DELIBERATE — SEE §15.**

```yaml
id: JAN-SLICE-SWP-00
title: "Remove the exemption and RECORD THE RED — nothing else changes"
design_obligations: [SL-S2]
outcome: "`DEFERRABLE_PREFIXES` becomes an empty set and the conformance gate is observed FAILING, with the failure
  message recorded verbatim in JPWB-REG-005 before any other file is touched."
knowledge_status: CONFIRMED — the red was DRIVEN by this roadmap's author on 2026-08-29 and reverted clean
repository_scope:
  files_or_symbols:
    - "packages/rph-domain/src/conformance-manifest.ts:468 — DEFERRABLE_PREFIXES"
    - "packages/rph-domain/src/conformance.test.ts:100-105 — the assertion that fires"
predicted_red:
  - "conformance.test.ts:103 asserts `DEFERRABLE_PREFIXES.has(prefixOf(r.id))` toBe(true) for every DEFERRED rule."
  - "⚠ THIS PREDICTION WAS DRIVEN BEFORE THIS ROADMAP WAS FILED, and the observed message is quoted verbatim:
     `AssertionError: RPH-E2E-001 deferred but not a deferrable family: expected false to be true` — 1 failed,
     8 passed. The probe was reverted and `git diff --numstat` on the file returned empty."
  - "⚠ The message MUST be matched as recorded. A DIFFERENT failure means the mechanism has changed since
     2026-08-29, and the work package MUST stop and re-derive, not adapt."
  - "⚠ Only ONE rule is named because the assertion is inside the per-rule loop and fails on the first DEFERRED
     rule it reaches. Six more follow it. `SWP-00` MUST NOT be recorded as having exposed one rule."
required_changes:
  - "`new Set(['RPH-E2E'])` → `new Set([])`, with a struck-in-place comment recording what was removed and why."
  - "File the register entry carrying the verbatim failure. NOTHING ELSE."
invariants:
  - "The gate is RED at the end of this work package, and that is the deliverable."
prohibited_shortcuts:
  - "MUST NOT restate the seven rules as PARTIAL or COVERED to quiet the gate — that is REG-F-013 exactly, where
     RPH-CMP sat in this set under a reason both halves of which were false."
  - "MUST NOT re-add the prefix under any condition."
  - "MUST NOT cite a test file that does not assert the rule — F-3 shows the gate would accept it."
  - "MUST NOT change any other file in this work package."
tests:
  - "The recorded red IS the evidence. No test is added here."
```

```yaml
id: JAN-SLICE-SWP-01
title: "The Slice declaration format, the derived ledger generator, and the predicate control"
design_obligations: [SL-9, SL-L1, SL-L2, SL-L3]
outcome: "A machine-readable Slice declaration co-located with each Slice source; a generator that derives the
  ledger from those declarations alone; the generator wired into gate:fast so a stale ledger fails the build; and a
  CONTROL that reddens when a Slice is placed where the generator's predicate cannot see it."
knowledge_status: PARTIAL — the format is proposed here and MUST be settled in this work package before SWP-02
repository_scope:
  files_or_symbols:
    - "verif/slice-ledger.ts — the generator and its stated predicate"
    - "verif/slice-ledger.test.ts — equality gate + the SL-L3 predicate control"
    - "docs/tracking/slices/LEDGER.md — GENERATED. Its header MUST state the predicate verbatim"
    - "package.json — gate:fast gains the ledger check"
required_changes:
  - "Each Slice source MUST export a declaration carrying: id, title, plane (ENGINE|SURFACE), citedRules[],
    scenarioClass, dischargesRegisterEntries[], presupposes (SURFACE only), and mutants[] with predicted messages."
  - "The generator MUST read declarations from source and MUST NOT accept any hand-authored input."
  - "The ledger header MUST state exactly which directories are read and exactly what shape is recognised."
invariants:
  - "A committed ledger differing from the generated one FAILS gate:fast."
  - "A Slice outside the predicate's reach is INVISIBLE to the ledger — and the control proves the generator
     notices rather than silently omitting it."
prohibited_shortcuts:
  - "MUST NOT create any hand-maintained progress file under any name (SL-L1)."
  - "MUST NOT make the predicate a single hardcoded directory without the control — that is exactly how
     docs/tracking/w3b/ came to be invisible one day after the machinery meant to prevent it."
  - "MUST NOT let the generator read JPWB-REG-005 as an input. The register governs; the ledger is a derived view
     (SL-L5)."
tests:
  - "CONTROL (SL-L3): a fixture Slice placed outside the declared predicate MUST redden with a message naming the
     unreachable path. This control MUST be driven RED before the work package is admitted."
  - "CONTROL: a hand-edited ledger MUST redden the equality gate."
  - "measure SL-S3's blast radius: derive how many of the 125 rules would fail an assertion-resolution predicate,
    and record the figure. DO NOT implement it here."
```

```yaml
id: JAN-SLICE-SWP-02
title: "RPH-E2E-001 admitted as the first ENGINE Slice, satisfying SL-1..SL-9 in full"
design_obligations: [SL-1, SL-2, SL-3, SL-3a, SL-4, SL-5, SL-6, SL-7, SL-8]
outcome: "The ratified normal intent-to-architecture journey is driven end to end against the real engine and
  asserts every clause of its own statement — ending with intent approved, the Architecture PWU baselined, evidence
  and assessments traceable, and THE ROOT PRODUCT REALIZATION PWU STILL INCOMPLETE."
knowledge_status: CONFIRMED — the rule statement was read verbatim from m12-conformance.json this session
repository_scope:
  files_or_symbols:
    - "packages/rph-engine/src/slices/e2e-001-intent-to-architecture.slice.ts"
    - "packages/rph-engine/fixtures/expected-events.jsonl — the 72-step, 11-phase trace MUST be reused, not re-derived"
required_changes:
  - "Drive the journey through the real bus and store (SL-7). No stubs for any asserted act."
  - "Assert EACH clause of RPH-E2E-001 separately, so a mutant can redden one and leave the others green (SL-3a)."
  - "⚠ The final clause — the root PWU remains INCOMPLETE — MUST be asserted. It is the clause that distinguishes a
    harness from a workflow engine, and it is the one most easily lost."
invariants:
  - "RPH-E2E-001 moves out of DEFERRED honestly: by assertion, not by restatement."
prohibited_shortcuts:
  - "MUST NOT assert the journey by counting events. An event count is satisfied by the wrong events."
  - "MUST NOT reuse one mutant for several clauses (SL-3a)."
  - "MUST NOT weaken any clause to admit the Slice (SL-8). If a clause cannot pass, admit the Slice FAILING and
     name the register entry tracking the capability."
tests:
  - "The Slice itself, green."
  - "One mutant PER cited clause, each driven and each matching its predicted message."
  - "The generated ledger row for this Slice, produced by SWP-01's generator with no hand-authoring."
```

```yaml
id: JAN-SLICE-SWP-03
title: "RPH-E2E-002..007 admitted as ENGINE Slices; the scenario-class gap closed or explicitly recorded"
design_obligations: [SL-1, SL-2, SL-3, SL-3a, SL-4, SL-5, SL-6, SL-7, SL-8]
outcome: "All seven ratified end-to-end rules assert. DEFERRABLE_PREFIXES stays empty and the conformance gate is
  green ON ASSERTIONS, not on citations."
knowledge_status: CONFIRMED for the seven statements; PROPOSED for the class assignments in §9
repository_scope:
  files_or_symbols:
    - "packages/rph-engine/src/slices/e2e-002..007.slice.ts"
required_changes:
  - "RPH-E2E-002 MUST assert STA-2 directly: execution SUCCEEDED while assurance REJECTED and the PWU NOT satisfied."
  - "RPH-E2E-005 MUST preserve BOTH assessments and MUST assert the baseline is not promoted automatically."
  - "RPH-E2E-006 MUST drive a real restart, not a simulated one (SL-7); it is the interrupted-or-resumed class."
  - "RPH-E2E-007 MUST assert that promotion on the version-2 decision is REFUSED."
  - "Per SL-5, each of the eight scenario classes MUST be either covered or EXPLICITLY recorded inapplicable with a
    reason. §9 shows at least four have no seed scenario; silence MUST NOT be read as inapplicability."
invariants:
  - "Seven rules assert. Zero rules are exempt."
prohibited_shortcuts:
  - "MUST NOT mark a class inapplicable merely because no ratified scenario covers it (§9)."
  - "MUST NOT collapse 002..007 into one Slice — SL-3a would then be unsatisfiable."
tests:
  - "Six Slices; per-clause mutants; six generated ledger rows."
```

```yaml
id: JAN-SLICE-SWP-04
title: "Subsumption — every superseded progress claim struck in place, under a gate"
design_obligations: [SL-L4]
outcome: "No working roadmap or residual claims an item the ledger now derives. Superseded claims are STRUCK, never
  deleted, so the record of what was believed survives."
knowledge_status: CONFIRMED — the artifact census and three concrete divergences were derived this session
repository_scope:
  files_or_symbols:
    - "docs/_working/ROADMAP-*.md (~19 files, 15 write-once)"
    - "docs/**/RESIDUALS*.md (2 files)"
    - "docs/JPWB Implementation Roadmap and Tracker.md — progress log frozen at 2026-07-12"
    - "verif/slice-subsumption.test.ts — the gate"
required_changes:
  - "For each superseded claim: `- ~~old~~ **new**`, citing the Slice that now derives it."
  - "A gate MUST assert that no artifact in the census claims an item the ledger derives."
invariants:
  - "Nothing is deleted. The register's retire-by-striking idiom is the form (JPWB-REG-005:57)."
prohibited_shortcuts:
  - "MUST NOT delete a roadmap file. Deletion destroys the record of what was believed and when."
  - "MUST NOT defer this work package past SWP-03 (§13)."
tests:
  - "The subsumption gate, with a CONTROL: a planted duplicate claim MUST redden it."
```

```yaml
id: JAN-SLICE-SWP-05
title: "The W7 product-behavior plane promoted — Actor, Capability, User Journey, Scenario, Requirement"
design_obligations: [SL-W7-1, SL-W7-2]
outcome: "Five first-class object types exist, are registered, and are traceable from Slices."
knowledge_status: CONFIRMED absent — 0 object-type literals, positive control 78
repository_scope:
  files_or_symbols:
    - "packages/rph-contracts (schemas, enums), packages/rph-domain (transitions), packages/rph-application (handlers, registry)"
required_changes:
  - "Follow the corpus's existing object-plane pattern exactly (SL-W7-1)."
  - "The register entry for this work package MUST record it as FSM §30.2's deferral CONDITION HAVING BEEN MET,
    citing §30.2, and MUST NOT record it as remediation of a gap."
invariants:
  - "No parallel representation is introduced alongside the existing pwuKind."
prohibited_shortcuts:
  - "MUST NOT block any earlier work package on this one (SL-W7-2)."
  - "MUST NOT describe this as closing a defect. It discharges a ratified deferral."
tests:
  - "Object-plane conformance tests matching those of the existing 17 object types."
```

```yaml
id: JAN-SLICE-SWP-06
title: "The evidence surface, and the first SURFACE Slices"
design_obligations: [SL-6, SL-2, SL-3, SL-7]
outcome: "A human can propose evidence, have it admitted, and submit it for assessment through the browser; the
  first SURFACE Slices assert that journey."
knowledge_status: CONFIRMED — F-4, with its positive control
repository_scope:
  files_or_symbols:
    - "apps/rph-demo/src/routes — the evidence surface"
    - "apps/rph-demo/e2e/slices/ — SURFACE Slices"
required_changes:
  - "Surface ProposeEvidence, AdmitEvidence, SubmitEvidenceForAssessment through real server actions."
  - "Each SURFACE Slice MUST cite the ENGINE Slice it presupposes (SL-6)."
invariants:
  - "A SURFACE Slice MUST NOT be admitted while its presupposed ENGINE Slice is failing or absent."
prohibited_shortcuts:
  - "MUST NOT assert a SURFACE journey by inspecting server-rendered HTML alone. An earlier probe of this kind
     failed in BOTH directions — its positive control also returned zero, because the page hydrates client-side —
     and no conclusion could be drawn from it."
tests:
  - "Playwright Slices; per-clause mutants; generated ledger rows."
```

## 9. The scenario-class coverage gap (derived, and it changes SWP-03)

`SL-5` requires every one of the eight ratified classes to be covered **or explicitly recorded inapplicable**. The
seed set does not reach them. Proposed mapping, marked as proposal — the assignments MUST be ratified in `SWP-02`
and `SWP-03`, not inherited from this table:

| Class | Seed scenario | Status |
|---|---|---|
| normal path | `RPH-E2E-001` | covered |
| interrupted or resumed path | `RPH-E2E-006` | covered |
| alternate valid path | `RPH-E2E-002/003/004/005/007` (proposed) | covered, assignment PROPOSED |
| user-error path | — | **no seed scenario** |
| system-failure path | possibly `RPH-E2E-006` | **ambiguous; MUST be ruled** |
| permission-denied path | — | **no seed scenario** |
| data-unavailable path | — | **no seed scenario** |
| cancellation path | — | **no seed scenario** |

⚠ **AT LEAST FOUR OF EIGHT CLASSES HAVE NO SEED SCENARIO.** `SWP-03` MUST therefore either author Slices for them
or record explicit, reasoned inapplicability. **The absence of a ratified scenario is NOT a reason to call a class
inapplicable** — the ratified rule requires inapplicability to be explicit, and "no one wrote one" is not a reason.

## 10. Assurance, tests, and evidence plan

- Every work package's evidence is **a driven red followed by a driven green**, in that order. A green with no
  observed red is not evidence and MUST NOT be recorded as such.
- Mutants MUST be recorded in the existing mutation ledger with their predicted messages, per the repository's
  mutation-operator and victim-naming discipline.
- `gate:fast` MUST remain green at the end of every work package except `SWP-00`, whose deliverable is a red.

## 11. Risks, assumptions, deferrals, divergences

- **R-1. `SWP-04` is the work package that will be skipped.** It has no test forcing it and no feature to show. It
  is therefore gated (`verif/slice-subsumption.test.ts`) and ordered before `SWP-05` (§13). *The programme SHALL be
  judged failed if it lands `SWP-03` and leaves the nineteen standing, whatever its test count.*
- **R-2. The declaration format is proposed, not settled.** `SWP-01` MUST settle it before `SWP-02` begins;
  changing it afterwards rewrites every Slice.
- **R-3. `RPH-E2E-006` needs a real restart.** If the harness cannot drive one, `SL-7` requires the substitution be
  recorded and the act NOT claimed as verified.
- **R-4. `SL-S3` (assertion resolution over all 125 rules) is deferred with its blast radius unmeasured.**
  `SWP-01` MUST produce the figure. Deferring it is a decision; deferring it *silently* would be the defect.
- **D-1. Authentication (C2)** is out of scope and remains `DIV-W0-003`, OPEN.
- **D-2. `reconcile`** — one of nine ratified primary verbs and the only WRITE verb with no command anywhere (0 of
  105 registry keys match `/reconcil/i`) — is NOT scoped here and MUST be escalated, not absorbed.
- **A-1. Assumption, stated so it can be falsified:** the seven ratified statements are assertable against today's
  engine without new capability. `SWP-02` tests this on the first one. If it is false, `SL-8` governs — the Slice
  is admitted FAILING and the missing capability is named.

## 12. Traceability matrix

| Design obligation | Work package |
|---|---|
| `SL-1` corpus trace | SWP-02, SWP-03, SWP-06 |
| `SL-2` assertion obligation | SWP-02, SWP-03, SWP-06 |
| `SL-3` / `SL-3a` predicted red, discriminating mutants | SWP-02, SWP-03, SWP-06 |
| `SL-4` register binding | every work package |
| `SL-5` scenario class | SWP-03 (§9) |
| `SL-6` plane and presupposition | SWP-06 |
| `SL-7` no fabrication | SWP-02, SWP-03, SWP-06 |
| `SL-8` honest failure | every work package |
| `SL-9` / `SL-L1`…`SL-L3` derived ledger | SWP-01 |
| `SL-L4` subsumption | SWP-04 |
| `SL-L5` register governs | SWP-01 |
| `SL-S1` / `SL-S2` seed set and first act | SWP-00, SWP-02, SWP-03 |
| `SL-S3` assertion resolution | measured in SWP-01, scheduled later (R-4) |
| `SL-S4` reuse existing material | SWP-02, SWP-03 |
| `SL-W7-1` / `SL-W7-2` | SWP-05 |

## 13. Implementation ordering and concurrency

**Strictly sequential:** `SWP-00` → `SWP-01` → `SWP-02` → `SWP-03` → `SWP-04`. Each MUST observe its predecessor's
exit condition rather than assert it.

`SWP-05` MAY run concurrently with `SWP-04` **only** if `SWP-04` is already gated, because concurrency is how
`SWP-04` gets deferred in practice. `SWP-06` MUST follow `SWP-03` (sponsor ruling: engine plane first).

## 14. Exit criteria and gate package requirements

The programme's first increment is complete when **all** hold:

1. `DEFERRABLE_PREFIXES` is empty and has stayed empty.
2. All seven `RPH-E2E` rules assert, each with per-clause discriminating mutants driven red.
3. The Slice Ledger is generated, gated in `gate:fast`, and its `SL-L3` predicate control has been driven red.
4. No artifact in the tracker census claims an item the ledger derives, and the subsumption gate proves it.
5. Every one of the eight scenario classes is covered or explicitly recorded inapplicable with a reason.
6. A register entry exists for each work package recording what it discharged — or `Discharges: none`.

## 15. ⚠ Why this roadmap carries no `delivery_state`

House convention puts `delivery_state:` in each work-package block. **This roadmap deliberately departs, and the
departure is recorded here per the design's §0 SHOULD rule.**

A `delivery_state` in a roadmap is a hand-authored progress claim, which is the artifact `SL-L1` prohibits. The
failure mode is measured, not hypothetical: in one wave roadmap, line 22 of a deferral table was corrected in place
when its item was discharged and **line 21 was not**, leaving a live claim that a censused audit had already
overturned. One row got the treatment; the row above it did not.

**Progress for JAN-SLICE comes from the generated ledger and nowhere else.** This document states what MUST be
done, what MUST NOT be done, and what "done" means. It does not state what has been done, and it MUST NOT be
edited to say so.

## 16. Self-critique and readiness determination

**What this roadmap does not know.**

- The Slice declaration format is proposed, not validated against a real Slice (R-2). `SWP-01` carries that risk
  deliberately, because settling a format without one Slice to test it is how formats get rewritten.
- The scenario-class assignments in §9 are proposed. Only `RPH-E2E-001` (normal) and `RPH-E2E-006`
  (interrupted-or-resumed) are unambiguous to this author; the rest MUST be ruled, and `system-failure` is
  genuinely uncertain.
- Whether the seven statements are assertable against today's engine is an ASSUMPTION (A-1), tested at `SWP-02`.
- `SL-S3`'s blast radius is unmeasured, which is why it is a SHOULD and why `SWP-01` must measure before anyone
  schedules it.

**The failure mode this roadmap is most likely to exhibit.** `SWP-04` is skipped or deferred, `SWP-05` and `SWP-06`
proceed because they are visible work, and the ledger joins the nineteen instead of retiring them. That is why
`SWP-04` is gated rather than trusted, why it is ordered before `SWP-05`, and why R-1 states the failure verdict in
advance.

**Readiness:** `PROPOSED`. This roadmap authorizes no implementation until it is approved.
