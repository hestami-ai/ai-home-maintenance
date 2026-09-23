# DESIGN — `JAN-ORPHANED`: a ruling changed what a fixture MEANT, and eleven tests went red for the wrong reason

**Findings:** `REG-F-409` (its reading corrected), `REG-F-414` · **Date:** 2026-09-20
**Sponsor ruling:** `R31` — correct the orphaned fixtures · **Status:** design only, nothing implemented

---

## 1. What `REG-F-409` recorded, and why it was wrong

`REG-F-409` filed eleven failing tests as evidence of the defect `R26` exposed, and stated:

> *"The eleven above assert FLOOR SATISFACTION, which the product genuinely no longer achieves, and they stay
> red."*

⛔ **That reading is refuted by measurement.** Reverting `R26` at `validators.ts:321`
(`'UNABLE_TO_DETERMINE'` → `'MET'`) — deliberately reintroducing the defect — produces:

| under the `R26` revert | result |
|---|---|
| the six demo tests under review | **all green** (`55 passed`) |
| the five `R26` guards | **five failed** — `reviewer-silence-is-not-a-pass.test.ts:81,:91`, `validators.test.ts:71`, `mock-reasoning-review-validator.test.ts:232,:244` |

⭐ **A test that guards a defect goes RED when the defect is PRESENT. These go GREEN.** They are
**anti-correlated** with `REG-F-409`: red when the product is correct, green when it is broken. Whatever they
are, they are not the finding's guards — the finding has five guards of its own, in three files, and all five
redden on the revert.

---

## 2. The structural fact: none of the eleven touches the deterministic checker

⛔ **`mock-reasoning-review-validator.ts` — the structural checker that is `REG-F-409`'s actual subject, and the
thing the sponsor forbade making claim nine — is not on any of the eleven paths.** Every one of them obtains
its reasoning review from a **hand-built `ReasoningReviewJudgement` literal declared in the test file itself**,
and every one of those literals is `findings: []`.

⭑ **AND NONE OF THOSE FIXTURES INSPECTS ITS SUBJECT.** Each `evaluate: (subject) => …` uses `subject` only to
key the result; the findings are constants. A fixture that examines nothing cannot be *"a structural checker
pretending to judge sound inference"* — it is **a reviewer's report**, and `validators.test.ts:48` says so in
terms: *"stands in for the agy backend in unit tests."*

⭐ **`REG-F-412` measured what that backend actually returns: nine of nine rows, in ~~five of five~~ four of four reviews.** ⭑ *Corrected 2026-09-23 (`REG-F-439`): seven reviews are stored, every one with nine rows.* So
a fixture standing in for it should return nine rows. It returns zero.

---

## 3. The archaeology — `findings: []` used to mean the opposite of what it now means

`git log -S "findings: []"` dates the engine literals to **2026-07-14** (`0e895d94` record-assurance,
`ae9a88ec` floor-gate, `9e1b2270` floor-execution-plane) — authored under the contract where absence read as
`MET`, so `findings: []` **meant** *"evaluated everything, found nothing."*

⭐ **The author wrote the intent down, and it is still in the file.** `record-assurance.test.ts:64`:

> `/** An independent Reasoning-Review Validator that recommends SATISFIED with no findings (all 9 criteria MET). */`

`R26` silently re-meant every one of these literals. ⛔ **The arrangement no longer produces what its own
docstring declares** — and `git show --stat 333fae67` confirms the `R26` commit touched seven files, none of
them an engine fixture. The fixtures were not considered; they were orphaned.

⚠ **AND ONE OF THEM NOW CONTRADICTS A RATIFIED GUARD.** `reviewer-silence-is-not-a-pass.test.ts:105` arranges
the same `findings: []` + `SATISFIED` over mandatory criteria and asserts every criterion **IS**
`UNABLE_TO_DETERMINE`; the ablation test's `:199` asserts **none** is. Both cannot hold. One of them is `R26`'s
own guard.

---

## 4. The design

### 4.1 `R31` — each orphaned literal says what a reviewer says, DERIVED

```ts
const allClean = (): ReasoningReviewJudgement['findings'] =>
	SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({
		criterionId: c.id, failed: false, statement: 'evaluated; the failure class is absent'
	}));
```

⛔ **DERIVED FROM THE POLICY'S CRITERIA, NEVER HAND-LISTED** — hand-listing nine ids is the defect one level
up, and it would silently stop covering a tenth. ⚠ A masking risk was checked and does not arise: the criterion
list is pinned by **id and count**, written out in full, at `pwa-export.test.ts:154-164`, so a derived helper
cannot hide a new criterion.

⭑ **NO ASSERTION CHANGES. NO PRODUCTION CODE CHANGES.** Only the arrangement each test sets up.

### 4.2 The four conditions the adversarial pass attached

**`C-1` — ADD the composition guard that would otherwise be lost.** After the correction, **no test anywhere
proves that a silent reviewer closes the gate**: `reviewer-silence-is-not-a-pass.test.ts` asserts
`dispositionFromFindings` directly and never touches `runDeMinimisFloor`. Derived from the filesystem, the only
test call sites of the floor runners are the five under correction plus one failure-path test. So one positive
arm is added:

```ts
it('a reviewer that judged NOTHING blocks the floor: aggregate INCONCLUSIVE, gate CLOSED', …)
```

⭐ **That converts the deleted arrangement into an assertion instead of losing it** — the difference between
*"wrong instrument"* and *"instrument quietly removed."*

**`C-2` — file the silent refusal separately.** An `INCONCLUSIVE` reasoning-review floor emits **zero**
observations, because observations come only from `failed: true` findings. So `describeRefusedEvidence` prints
`evd_… (npm test): ` with nothing after the colon. **A refusal that names no reason is its own defect**,
independent of everything here.

**`C-3` — one shared env helper.** `JPWB_ASSURANCE_TOOL` / `JPWB_JUDGE_MODEL` are process-wide and the repo
already warns about it in a `try/finally`. ⚠ Five more copies is how one unreproduced flake becomes routine.

**`C-4` — a framing-sensitive print for the process-result test.** Its comment names `R14` framing routing as
its red, and a fixed reply is framing-blind. Coverage provably **moves** rather than vanishing (measured: the
`R14` mutant reddens eight assertions that stay on the mock, including a sibling that is green at baseline) —
but a print keyed on the framing text keeps this test proving what its comment claims.

---

## 5. What the correction is measured to preserve

Every declared mutant whose victim is one of these files was derived (`DECLARED_MUTANTS.filter(...)` over all
**727** entries): **exactly six.** With the correction applied, **all six redden at their predicted assertion.**

⭐ **AND ONE BECOMES OBSERVABLE FOR THE FIRST TIME.** `schema-floor-certifies-without-facts` declares its
predicted red at `gatePermitsTransition → true` — and **at HEAD that assertion does not fire at all**, because
the reviewer's silence keeps the gate closed regardless. The mutant's stated guarantee is not merely ungraded
today; it is **unobservable**. The correction is what makes the declared red the only red.

⚠ **The general form was checked too:** the nine `expectRed: []` mutants that run the whole workspace are
declared controls graded as a *difference* against a baseline, so a pre-existing red is differenced out. Blast
radius is exactly six.

---

## 6. What this design refuses to do

1. ⛔ **The deterministic structural checker is NOT touched.** `mock-reasoning-review-validator.ts` keeps its
   honest two-of-nine declaration and the guard that pins it. That object is `REG-F-409`'s subject and the
   sponsor rejected changing it by name; nothing here goes near it.
2. ⛔ **No assertion is weakened, and this was tested rather than asserted.** Every declared mutant still
   reddens; six of them at a sharper line than before.
3. ⛔ **REFUTED AND NOT DONE:** giving the cross-plane REJECTED arm nine rows was proposed as *"more faithful"*.
   Measured: removing both the BLOCKING and NOT_MET rungs from `dispositionFromFindings` reddens the **same
   assertion** with one row or nine. **No discrimination gain.** Take it for faithfulness if at all — never as
   a strengthening.

---

## 7. Two defects this pass found in passing, neither of which it fixes

- ⚠ **`R26` has already turned an existing boolean into a control that cannot fail.** In
  `work-product-floor-run.test.ts`, the *"pass any parseable content"* mutant leaves `:118`
  (`satisfied === false`) **green**, because `R26` makes the empty product `INCONCLUSIVE` regardless. The kill
  now happens only at `:119` (the `RR-04` observation code). The pair still discriminates — but one half of it
  stopped being the thing that discriminates, and nothing recorded that.
- ⚠ **`evidence-join`'s discrimination test is unkillable by construction while everything refuses.**
  `:268` — *"the run that PASSED must not appear in a refusal"* — can only be killed when one run is satisfied
  and one is not. Today neither is. **Leaving it red preserves a broken discriminator, not a true statement.**

---

## 8. What `REG-F-409` still owes, unchanged

⛔ **This programme does NOT put a real reviewer on the gate's default path**, and after it lands **no test
drives any floor composition to SATISFIED on the mock lane.** The mock's own arms stay covered by their own
suites. ⭑ That is arguably the honest reflection of `REG-F-409` rather than a defect — but it is **disclosed
here**, not left to be discovered.

---

## 9. Exit

The eleven tests assert what they were written to assert, on fixtures that say what a real reviewer says; every
declared mutant still reddens; a silent reviewer is proven to close the gate by a test that did not exist
before; and the deterministic checker's two-of-nine declaration is untouched.
