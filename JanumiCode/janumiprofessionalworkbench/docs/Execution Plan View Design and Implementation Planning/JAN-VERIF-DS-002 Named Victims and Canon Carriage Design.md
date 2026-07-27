# JAN-VERIF-DS-002 — Named Victims and Canon Carriage: Design

*v0.1.0 · 2026-07-26 · Design authority for the two residuals left open at the close of JAN-EXECREM. Roadmap:
`JAN-VERIF-DR-002`. Predecessor: `JAN-VERIF-DS-001` v0.1.0 (V-0…V-2d).*

---

## 0. The two items, and why they are one design

Two claims this repository makes are **not checked by anything**, and both were raised by the instruments
themselves rather than by a reviewer:

| | The claim | Who raises it | What is wrong with it |
|---|---|---|---|
| **V-3** | "this guard is tested" | `bun run mutants`, every run since V-1 | 46 mutants are killed by *something*, package-wide. Nothing records **what**. |
| **V-4** | "this rule is ratified at §N" | nobody | The rules the engine enforces cite sections of a corpus that Ratify Sheet Part 4 **retires**. Nothing detects the loss. |

They share a shape, and it is this programme's recurring one: **a true sentence whose truth-maker is not
recorded.** "Something reddened" and "some document says so" are both satisfiable by an accident, and neither
survives the change that invalidates it — a suite refactor in the first case, a retirement act in the second.
Both repairs are therefore the same move: **convert the claim into a named referent, and gate the referent.**

They are designed together because the *second* repair borrows the first's discipline — a citation the gate
resolves against the tree, exactly like `UNENFORCED_DISCLOSED`'s `referencedOnlyBy` census.

---

## 1. V-3 — the 46 unnamed victims

### 1.1 What the harness actually reports today

```
46 mutant(s) had NO NAMED VICTIM and were run package-wide. That is a records defect in the work
packages that declared them: "something caught it" is a weaker claim than "this named test caught
it", and only the latter survives a refactor of the suite.
```

`DeclaredMutant.expectRed` is the field. Empty means the declaring work package never said which test reddens, so
`targetSuites` falls back to the whole workspace and the verdict is `KILLED_UNNAMED` — deliberately a *weaker*
label, not a pass wearing a strong one. That honesty is why the defect is still visible eighteen work packages
later; it is also why it has never been fixed, because the summary line costs nothing to keep reading.

### 1.2 Why the obvious repair is wrong

The obvious repair is to run each unnamed mutant, note the failing suites, and write them into `expectRed`.

**That would manufacture the exact defect this programme keeps finding.** What a run observes is every suite that
**FAILED**, which is not the set of suites that **TEST THE GUARD**. A broad command-layer test reddens on almost
any mutation of a predicate it transitively drives; recording it as the victim produces a ledger that reports
`KILLED` — the strong verdict — while the guard itself is asserted by nothing. That is F-28 (evidence at the
wrong layer) rebuilt inside the instrument that exists to detect F-28.

The failure is not hypothetical in this lineage: `targetSuites`' own comment records that scoping unnamed mutants
to their own package made two `rph-domain` mutants "SURVIVE" that `rph-application` killed instantly, because
**domain predicates are enforced at the command layer**. The same asymmetry runs the other way — a command-layer
suite failing tells you the command path changed, not that anyone asserted the predicate.

### 1.3 The design: harvest proposes, the gate disposes

Three stages, and the separation between them is the whole design.

**(a) HARVEST — measured candidates, written nowhere.** `MUTANTS_HARVEST=1` selects exactly the unnamed-measurable
population, applies each mutant, runs the full workspace, and records **which test FILES failed** from vitest's
JSON report. It writes `scripts/mutants/.harvest.json` (gitignored) and **exits 0 whatever it finds**.

> Exiting 0 is deliberate and load-bearing. A harvest that could fail the build would eventually be run *to make
> the build pass*, and the one thing that must not happen is a victim chosen to satisfy a gate.

The report is read from the JSON reporter, not scraped from console output: the human reporter prints one `FAIL`
line per failing **test**, truncates, colours, and interleaves worker stderr. A harvest that silently drops a
victim is worse than no harvest, because the survivor it hides looks like a clean result.

**(b) JUDGMENT — chosen against the assertions.** For each mutant, the victim is chosen by reading what the
candidate suites actually assert, under three rules:

1. **Prefer the suite whose assertions name the guard's subject.** A test called
   `execrem-wp12-execution-success.test.ts` that asserts on the success predicate beats a plan-completion test
   that merely routes through it.
2. **A single candidate is the strongest case and needs no judgment.** Where the workspace reddens exactly one
   file, that file *is* the victim.
3. **Where the only candidate is a census or shape test, say so.** A guard whose sole witness asserts on a table's
   shape rather than on behaviour is a finding in its own right, not a naming problem — it is recorded rather
   than papered over by naming the census.

**(c) PROOF — the gate re-measures the choice.** The named victim set is then run as a **normal** mutation run.
This is the part that makes (b) safe: the runner executes *only* the named suites, so

> **a wrongly-named victim no longer reddens, the mutant reports SURVIVED, and the build fails.**

There is no way to name a victim that does not test the guard and still be green. The judgment is checked by the
same instrument it feeds, which is the strongest available arrangement short of a proof.

### 1.4 The ratchet — and it is the part that outlives the 46

Naming forty-six mutants fixes forty-six records. It does not stop the forty-seventh, and every gate in this
lineage that was armed *by remembering to arm it* eventually was not.

So `KILLED_UNNAMED` becomes a **BLOCKING** verdict once the count reaches zero. The polarity is the same argument
V-2c made for the mutation gate itself: an opt-in gate is a suggestion with an exit code. After V-3, adding a
mutant without a victim fails the build on the day it is added, and the honest escape hatch (`MUTANTS_ADVISORY=1`)
remains a triage tool that a gate cannot be configured into.

> **Disclosed cost.** A genuinely hard-to-attribute mutant — one whose kill is diffuse across many suites by
> nature — now costs its author an argument rather than a blank field. That is the intended price. The
> `expectSurvive` and `expectNoCompile` arms are untouched: an empty `expectRed` is **correct** for both (one must
> redden nothing; the other never reaches a test run), and the harvest excludes them so it cannot invent a defect
> to fix.

---

## 2. V-4 — canon carriage

### 2.1 The finding, and the correction to how it was first stated

At the close of JAN-EXECREM this was recorded as: *"six of §22.1's seven invariants have no canon carrier — if
RPH-DOC-002 retires as-is, RPH-EXE-004 loses its only textual home."*

**That statement was too strong, and it is corrected here rather than quietly replaced.** It was written from
recall, not from a search of `docs/canon/`, which makes it the same error this lineage has now made seven times
in the other direction: *a claim about my search reported as a claim about the world*. The measured result is
materially better than the claim:

| §22.1 sentence | Canon carriage | Anchor |
|---|---|---|
| Requested capability is not granted capability | **CARRIED** | DOC-001 §3 — *"a PWA, plan, prompt, or agent may request a capability; only runtime policy grants it"* |
| Capability scope must be explicit | **GENERAL RULE ONLY** | OBJ-1 (no semantic state inferred from absence). Canon never names capability scope. |
| Secret access must never be inferred from tool availability | **NONE** | DOC-004 governs secret *references in records* — a different rule. |
| Runtime Binding changes increment revision but not necessarily PWU semantic version | **GENERAL RULE ONLY** | OBJ-2 (`revision` vs `semanticVersion` never conflated); the RuntimeBinding instance is not stated. |
| Privilege expansion requires a new authorization event | **NONE** | STA-8's *"cannot grant its own privilege"* is adjacent, not equivalent. |
| Revoked bindings cannot be used for new attempts | **CARRIED** | STA-8 — *"Execution requires an approved plan and authorized Runtime Bindings"* |
| Model output is treated as untrusted external input | **CARRIED (verbatim)** | PER-10 — *"Model output is untrusted external input"* |

So: **three carried, two carried only generically, two carried nowhere** — not six lost. The residual finding is
real but smaller than claimed, and it is now a *checked* fact rather than a remembered one.

### 2.2 Why this is worth an instrument rather than a paragraph

Ratify Sheet Part 4 approves retirement of the pre-canon corpus **subject to four preconditions**, of which the
second is a shape-survivorship audit motivated by REG-F-005: *"the source schemas are the independent 'expected'
that made the gap detectable; they retire only after a verified transplant."* §22.1 lives in **RPH-DOC-002**,
which is named in that precondition's audit set — and the ratified *statements* the engine enforces live in a
second pre-canon document (the Executable Invariant and Conformance Test Specification, §12 for `RPH-EXE-*`,
§8 for `RPH-PWU-*`), recorded in `m12-conformance.json` as `sourceRef`.

A prose audit filed in `docs/` would answer the question **once**, for today's canon. It would not notice a canon
amendment that removed STA-8's binding clause, and it would not notice a rule added to the register with no
carriage at all. This repository has a specific reason to distrust that arrangement: the enforcement register was
built precisely because a *manifest row* certified `RPH-PWU-010` as covered while nothing enforced it.

### 2.3 The design: a fourth axis on the enforcement register

`ENFORCEMENT_REGISTER` already answers *is this rule enforced, where, at what layer*. It gains one more axis:

```
CARRIED                  a canon sentence states this rule. `canonAnchor` is a verbatim substring of a
                         canon artifact, and the gate resolves it against docs/canon/.
CARRIED_BY_GENERAL_RULE  canon states a strictly MORE GENERAL rule of which this is an instance. Same
                         resolution requirement — the distinction is in what a reader may conclude, and it
                         must not be silently upgraded to CARRIED.
NO_CANON_CARRIER         nothing in canon states or generalises it. Retirement loses the rule's only
                         textual home. Argued, never asserted — same >80-character discipline the
                         register's other reasoned arms already carry.
```

**What the gate checks, and what it deliberately does not.** It checks that every cited anchor **occurs in a canon
artifact under `docs/canon/`, excluding the `.provenance.md` sidecars** — a sidecar records where text came from,
so satisfying a carriage claim from one would let provenance impersonate canon. It does **not** check that the
anchor *means* the rule: that is a judgment, and a gate that pretended to make it would be the vacuous-assertion
shape all over again.

What this buys is precise and worth stating plainly: **a canon edit that removes a carrier turns the build RED**,
and **a rule cannot enter the register without disposing its carriage.** The retirement decision becomes a run of
the suite instead of a memory.

> **Disclosed limit.** Anchors are substrings, so a canon edit that *rewords* a carrier without changing its
> meaning also goes red. That is the correct polarity — a re-worded carrier deserves a human confirming it still
> carries — but it is a real maintenance cost and is recorded here rather than discovered later.

### 2.4 Scope: total over the register, not over §22.1

The audit that raised this was about §22.1's seven sentences. The instrument is scoped to the **eleven registered
rules** instead, for the reason the register itself is total: a partial axis rots. Two §22.1 sentences correspond
to no registered rule at all (*capability scope*, *privilege expansion*); those are recorded in
`JAN-EXECREM-RESIDUALS.md` as corpus-level findings for the retirement decision, because minting register rows
for rules this engine does not enforce would be the hollow-governed-layer failure (CON-000 B7) in miniature.

---

## 3. Verification

| Claim | How it is checked |
|---|---|
| Every named victim really does redden | The full mutation run, with `expectRed` populated. A wrong name → SURVIVED → build fails. |
| Naming cannot be skipped again | `KILLED_UNNAMED` becomes blocking; count must be 0. |
| The harvest cannot be gamed into the ledger | It writes only a gitignored file and always exits 0. |
| Every carriage citation resolves | `enforcement-register.test.ts` greps `docs/canon/*.md` (sidecars excluded). |
| The carriage gate can actually fail | A declared mutant replaces an anchor with text absent from canon; it must report KILLED. |
| The carriage axis is total | The register's existing totality test extends to the new field — no row without a disposition. |
