# JAN-VERIF-DR-002 — Named Victims and Canon Carriage: Detailed Implementation Roadmap

*v0.1.0 · 2026-07-26 · Design authority `JAN-VERIF-DS-002` v0.1.0. Authored under the sponsor's standing grant to
author solutions to the residual items with rigor; authorization is conferred by committing the changes.*

## 1. Land order

| WP | Title | Delivers | Depends on |
|---|---|---|---|
| **V-3a** | The harvest affordance | `MUTANTS_HARVEST=1` — measured victim candidates, written nowhere | — |
| **V-3b** | Name the 46 victims | `expectRed` populated; every choice proved by a normal run | V-3a |
| **V-3c** | Arm the ratchet | `KILLED_UNNAMED` blocks; the 47th unnamed mutant fails on day one | V-3b |
| **V-3d** | *(unplanned — a finding V-3c produced)* | exactly ONE victim per mutant; three inert victims removed | V-3c |
| **V-4a** | The carriage axis | `canonCarriage` on all 11 register rows + the resolution gate | — |
| **V-4b** | Record the corpus-level residual | §22.1's two uncarried sentences filed for the retirement decision | V-4a |

**V-3a before V-3b, and it is not merely tidy.** Naming victims from recall is precisely the move DS-002 §1.2
rules out; the harvest exists so the candidate set is *measured* before any judgment is applied to it. **V-3c
after V-3b** because a blocking gate landed while 46 rows are still empty is a build that cannot go green, which
is how gates get disabled.

**V-4 is independent of V-3** and may land in either order. It is sequenced second only because V-3's harvest is
the long-running step and the canon audit can be authored while it runs.

---

## 2. V-3a — the harvest affordance

`scripts/mutants/run.ts` gains `MUTANTS_HARVEST=1`:

- **Selection.** Exactly the unnamed-measurable population: `expectRed.length === 0` and no `supersededBy`,
  `duplicateOf`, `expectSurvive`, or `expectNoCompile`. The last two exclusions are the important ones — an empty
  `expectRed` is *correct* for a control and for a type-prevented mutant, and harvesting a "victim" for either
  would invent a defect to fix.
- **Measurement.** `vitest run --reporter=default --reporter=json --outputFile=…`, so the human summary keeps
  working unchanged and the two views cannot disagree about the same run. Failing files are read from the JSON,
  de-duplicated, made repo-relative (case-insensitively rooted, because vitest reports `E:/…` on this host and the
  computed root may be `e:/…`).
- **Output.** `scripts/mutants/.harvest.json` + a console table, both gitignored. **Exit 0 unconditionally.**
- **Script.** `bun run mutants:harvest`.

**Verification:** run it against a single mutant first (`… run.ts WP12A-M1`) and confirm the candidate list is
non-empty and plausible before committing ~35 minutes to the full sweep.

---

## 3. V-3b — naming, and the predicted RED that makes it safe

For each of the 46, apply DS-002 §1.3(b). Then the proof, which is not optional and not a formality:

**The full mutation run IS the check.** With `expectRed` populated the runner executes *only* the named suites. A
victim that does not actually assert the guard no longer reddens → `SURVIVED` → exit 1. So the predicted red is
stated up front, in the terms `feedback_green_needs_a_predicted_red` demands:

> **If any name in this work package is wrong, `bun run mutants` reports SURVIVED for that mutant and fails.**
> A green run after V-3b is therefore evidence about all 46 choices at once, not about the harness.

Two shapes get recorded rather than silently absorbed:

1. **A mutant whose only candidate is a census/shape test.** Named honestly, and the fact noted — the guard's sole
   witness asserts on a table, not on behaviour.
2. **A mutant whose candidates are all in a different package from the mutated file.** Expected and correct here
   (domain predicates are enforced at the command layer), but worth seeing where it happens.

---

## 3b. V-3d — the finding V-3c produced, fixed where it was found

Writing the V-3c rule a *second* time as a fast ledger-data check — seconds, inside `bun run test`, rather than
thirty minutes inside the mutation run — surfaced a defect nobody had looked for.

**The mechanism.** `run.ts` invokes vitest ONCE with every named suite and calls the mutant KILLED if the run
fails. So a second name does not strengthen the claim; it means *"at least one of these reddens"*, which is a
**lower** bar than naming either alone. **The instinct to add a name for safety makes the claim smaller, and
nothing in the green output says so.**

17 entries named two victims each. Probing all 34 (entry, victim) pairs individually with the runner's own
`MUTANTS_TARGET` override found **three recorded victims that do not redden at all**:

| Entry | Inert victim |
|---|---|
| `S2-scope-always-refuses` | `exebind-wp1-binding-authority.test.ts` |
| `R4-the-shared-default-cap-changes` | `retrycap-readmodel-cap.test.ts` |
| `PA2-the-outcome-is-always-partial` | `exebind-wp1-binding-authority.test.ts` |

Each was recorded as evidence and supplied none; each entry was green only because its co-named suite did the
work. **Structurally invisible** — no possible outcome of the mutation run could distinguish "both suites catch
it" from "one does and the other is decoration".

All 17 narrowed to the single suite that measurably earns the claim. Three choices forced by the measurement; for
the other fourteen both kill, and the tiebreak is recorded in the ledger: subject-named beats general or probe
suite; where both name the subject, the one in the **mutated file's own package**; where the rule's statement is a
command refusal, the command-layer suite.

**Two gates now carry the rule and neither subsumes the other.** `run.ts` observes the kill (authoritative, slow);
`verif/mutant-ledger.test.ts` decides it from the data (fast, and the right place to learn that a field was left
blank). The exclusion set is written to match the harvest's selection exactly, so the two cannot disagree about
which population the rule governs.

---

## 4. V-3c — the ratchet

In `run.ts`, `KILLED_UNNAMED` joins the failing set. Preconditions: the count is 0, and `MUTANTS_ADVISORY=1`
still bypasses (a triage tool, never a configuration a gate can be left in). The summary paragraph that reports
the records defect stays — it now describes a condition that fails rather than one that is merely disclosed.

---

## 5. V-4a — the carriage axis

`packages/rph-domain/src/enforcement-register.ts`:

- `CanonCarriage` = `CARRIED | CARRIED_BY_GENERAL_RULE | NO_CANON_CARRIER`, with `canonAnchor` + `note` on the
  first two and an argued `why` on the third.
- Every one of the 11 `EnforcementDisposition` rows carries one. The audit result (DS-002 §2.1, extended to the
  register's own id set):

| Rule | Carriage | Canon site |
|---|---|---|
| RPH-EXE-001 | CARRIED | STA-8 — at most one active Execution Plan |
| RPH-EXE-002 | CARRIED | STA-8 — a superseded plan spawns no new steps |
| RPH-EXE-003 | CARRIED | STA-8 — execution requires authorized Runtime Bindings |
| RPH-EXE-004 | CARRIED | DOC-001 §3 — request vs grant |
| RPH-EXE-005 | **NO_CANON_CARRIER** | STA-5's readiness profile is about the PWU, not step input artifacts |
| RPH-EXE-006 | CARRIED_BY_GENERAL_RULE | OBJ-1 — no semantic state inferred from absent output |
| RPH-EXE-007 | CARRIED | PER-5 — retries never duplicate commits |
| RPH-EXE-008 | **NO_CANON_CARRIER** | the retry budget itself; only its *consequence* is carried (AX-8, V1) |
| RPH-EXE-009 | CARRIED | PER-10 — malformed output creates no authoritative object |
| RPH-PWU-009 | CARRIED | STA-4 — superseded work cannot execute |
| RPH-PWU-010 | CARRIED | STA-4 — baselined work cannot re-enter execution |

`packages/rph-domain/src/enforcement-register.test.ts`:

- **Totality**: extend the existing "every disposition carries its reason" gate so no row may omit carriage.
- **Resolution**: every `canonAnchor` occurs in some `docs/canon/*.md` **excluding `*.provenance.md`**.
- **Argument**: `NO_CANON_CARRIER.why` > 80 characters, matching the register's existing discipline.
- **Selftest**: the resolver reports failure on synthetic absent text, per the file's standing rule that a gate
  mechanism must itself be proved.

**Ledger entries** (`scripts/mutants/ledger.ts`), so the gate is not merely written but measured:

- replace a resolving anchor with text absent from canon → must be KILLED by the resolution gate;
- downgrade a `NO_CANON_CARRIER` reason to a stub → must be KILLED by the argument gate.

---

## 6. V-4b — the corpus-level residual

Two §22.1 sentences correspond to **no** registered rule and therefore to no register row:

- *"Capability scope must be explicit"* — resolved as policy-by-reference (sponsor ruling, 2026-07-26); the
  runtime bound is inexpressible in JPWB by that ruling, so there is nothing here to enforce.
- *"Secret access must never be inferred from tool availability"* and *"Privilege expansion requires a new
  authorization event"* — Platform-plane rules whose enforcer is deferred to M5.

These are filed in `JAN-EXECREM-RESIDUALS.md` against the retirement decision (Ratify Sheet Part 4, precondition
2) rather than minted as register rows: **a row claiming enforcement of a rule this engine does not enforce is
the hollow-governed-layer failure the register was built to stop.**

---

## 7. Exit gate

`bun run gate` in full — check-types, lint, boundary, build, test (turbo + dist), coverage with the V-2d ratchet,
svelte-check, e2e, and `mutants` **with `KILLED_UNNAMED` blocking and 0 unnamed**.
