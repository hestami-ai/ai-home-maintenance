# DESIGN — JAN-CSAADEC: decoupling CSAA from the gate

**Programme:** `JAN-CSAADEC` · **Status:** DESIGN · **Opened:** 2026-09-09

⚠ **THIS DOCUMENT IS PARTLY RETROACTIVE AND SAYS SO.** `CD-01` and `CD-02` landed in `4e0df056` with **no design
document, no roadmap document, and no register entry**. That is a breach of the standing sequence — design, then
roadmap, then implementation — committed by delegated sub-agents working from a conversational brief. The two
increments are sound and are not being unwound; what follows records the design they should have been written
against, and the roadmap now carries them as LANDED-BEFORE-DOCUMENTED rather than pretending they arrived in
order.

---

## 1. The sponsor's instruction, and what it does NOT mean

> *"by decoupling CSAA, I didn't mean deleting it, in part or in whole. Rather just removing the coupling to the
> test suite running and related issues"*

⛔ **NOTHING IS DELETED.** Not a package, not a test, not a provider. The whole of `packages/csaa` stays in the
tree, buildable and runnable. The only thing that changes is **when its tests are obliged to run**.

## 2. The question this design answers

> *"does the CSAA test suite 'only' need to run when there are changes to the CSAA library or other CSAA?"*

**Measured answer: 185 of 188 test files — yes. Three — no.**

Those three assert over the **live workbench tree** rather than over CSAA. They are the ones that break when we
work, and they are the entire mechanism behind the recurrent build churn.

| file | what it pins |
| --- | --- |
| `src/inventory/inventory.test.ts` | workspace-manifest and top-level `verif/` populations |
| `src/subject/subject.test.ts` | public TypeScript root populations, path/hash/identity projection |
| `src/providers/runtime/project-hybrid-static-prerequisites.test.ts` | exact current JPWB source bytes |

## 3. How that number was reached — and why the first two answers were wrong

⭑⭑ **THREE INSTRUMENTS, TWO OF THEM WRONG, AND THEY WERE WRONG IN OPPOSITE DIRECTIONS.** This section is the
substance of the design, because the wrong answers were the plausible ones.

**Instrument 1 — source text names a repo path.** Regex over each test file for `apps/rph-demo`,
`packages/rph-*`, `verif/*.ts`, `docs/canon`, `docs/tracking`. Result: **46 coupled / 142 pure**. A control said
the probe discriminated: `rph-domain` scored 3 of 33, so it was not matching something ubiquitous.

⛔ **It over-counted by fifteen times.** Naming a path in a string fixture is not the same as asserting over the
live tree. 41 of the 46 never read the workbench at all.

**Instrument 2 — transitive imports of the census module.** Reverse-reachability from
`inventory/collect-inventory.ts` over the CSAA import graph. Result: **9 reach it / 179 do not**.

⛔ **It was wrong in BOTH directions at once.** Cross-tabbed against instrument 1: four files instrument 1 called
"pure" DO reach the census module (importing it is not executing its assertions), while 41 that instrument 1
called "coupled" do not. And the seed was a single module — a census of live-tree readers found **eight** modules
using `process.cwd()` / `readdirSync`, so reachability from one of them under-approximates as well.

⭑ **Instrument 3 — perturb the workbench and see who changes verdict.** No proxy. Add files of exactly the shape
that broke CSAA before, run all 188, restore, diff:

- round 1 — a sixth `playwright.*.config.ts` at the `apps/rph-demo` root (the literal shape of `f35cb69d`), a
  source file under `apps/rph-demo/src/lib/`, a `verif/` asset;
- round 2 — the same plus source files under `packages/rph-domain`, `rph-contracts`, `rph-engine`.

**Both rounds: the same three files, and only those three.** The perturbations demonstrably registered — the
population assertion moved `72 → 73` in round 1 and a second pin moved `30 → 29` in round 2, and round 2 raised
*"Required JPWB configured test-population profile set is incompatible"*, which is the original `f35cb69d`
break **reproduced on demand**.

**Independent confirmation, different instrument entirely.** Across all history, `inventory/inventory.test.ts`
(37 commits) and `subject/subject.test.ts` (33) are the #2 and #3 most-frequently-modified CSAA test files. The
churn record and the perturbation agree without being told about each other.

⚠ **AND THE NOISE FLOOR IS NAMED.** The full-suite baseline reported **six** failures; three were timeouts (a
10 s hook limit, a 15 s test limit) that vanished under lighter load in both perturbed runs. The same tree yields
six or three depending on contention. Every count in this document is from a run whose timeout total was zero, or
is stated with its noise.

## 4. What the three files are worth

The value assessment already measured the reliance: **0 of 6 investigative findings**, **0 citations in
`JPWB-REG-005`** (control: 34 for a comparable instrument), **36/36 `_GATE_EFFECT='NONE'`**, no product
consumers, no CI invocation. Their staleness has only ever been discovered by accident — six consecutive
programmes moved a pinned population and none of them noticed.

⛔ **THAT IS AN ARGUMENT ABOUT OBLIGATION, NOT ABOUT VALUE.** A pin nobody consults is not thereby worthless; it
is worthless *as a gate*. The distinction is what `CD-03` acts on.

## 5. The mechanism, and the tension inside it

`vitest.projects.ts` derives the project list from the filesystem, and its header says why:

> *"a list that must be edited when a package is added is a list that will silently rot, and this whole programme
> is about that failure mode"*

⭑ **SO THE FILE I MUST CHANGE EXISTS SPECIFICALLY TO FORBID THE CHANGE I WANT.** That objection has to be met,
not stepped around. It is met by an **asymmetry**:

- An enumerated **inclusion** list fails DANGEROUSLY: a new package omitted from it is silently unmeasured. That
  is `N-16`, and it is what the derivation prevents.
- An enumerated **exclusion** list fails SAFELY: a new package absent from it is measured by default. The worst
  outcome is that something runs which need not.

An exclusion is therefore admissible where an inclusion is not. ⛔ **But it is still a hand-maintained list, so
it gets a gate** — see `CD-04`.

## 6. Options considered

| option | verdict |
| --- | --- |
| Drop the whole `csaa` project from the gate | ⛔ REJECTED — 185 files are honest unit tests of CSAA's own logic; removing them removes real cover for a problem they do not cause. |
| Drop the 46 from instrument 1 | ⛔ REJECTED — the number is wrong; 41 of them are indifferent to the workbench. |
| Per-package opt-out declared in `package.json` | ⛔ REJECTED — `vitest.projects.ts` already refuses opt-out-by-omission for `setupFiles`, for the same reason. Any package could then leave the gate with one line. |
| Split by directory | ⛔ NOT AVAILABLE — measured: `application/` holds 10 coupled and 49 pure, `graph/` 7 and 30. The populations interleave. |
| Make the pins derive their expected values | ⛔ REJECTED — a pin that derives its own expectation is a control that cannot fail. The hard-coded number IS the guarantee. |
| ✅ **A second project holding exactly the three, excluded from the default gate** | **TAKEN** — smallest change that removes the obligation without removing cover. |

## 7. What `CD-03` does

A `csaa-census` vitest project containing exactly the three files, excluded from the default gate; the `csaa`
project keeps the other 185 and stays in the gate unchanged. The census lane runs on demand, and on CSAA changes.

⚠ **AND IT IS NOT A CONTROL THAT CANNOT FAIL.** The census lane must stay *runnable and red-able*: when it runs
it asserts exactly what it asserts today. What changes is that an unrelated product commit is no longer obliged
to re-pin it.

## 8. What is NOT taken

- ⛔ No test is weakened, skipped, or deleted. The three keep every assertion they have.
- ⛔ No CSAA source is removed.
- ⛔ The salvaged guarantees from `CD-01`/`CD-02` stay in `verif/` and stay in the gate — that was the point of
  doing them first.
- ⛔ No claim that the three pins are worthless. The claim is narrower: they are not *gate* material.

## 9. Carry-forwards

- `REG-F-372` was factually wrong and `REG-F-374` corrects it; neither is re-opened here.
- The 15 s / 10 s in-file timeouts that produce the noise floor are a separate defect, not owned by this
  programme. Filed rather than fixed.
