# ROADMAP — `JAN-ORPHANED`: the fixtures a ruling orphaned

**Design:** `DESIGN-the-fixtures-a-ruling-orphaned.md` · **Date:** 2026-09-20 · **Ruling:** `R31`
**Findings:** `REG-F-409` (reading corrected), `REG-F-414`

⭑ **Exit:** the eleven tests assert what they were written to assert; **every declared mutant still reddens**;
a silent reviewer is proven to close the gate by a test that did not exist before; and the deterministic
structural checker's two-of-nine declaration is untouched.

⛔ **`OR-01` LANDS FIRST AND ALONE, BECAUSE IT IS THE ONLY THING THAT CAN BE LOST.** Every other increment adds
or restores coverage. `OR-01` is the one that would quietly remove some.

---

### `OR-01` — ⭐ ADD the composition guard BEFORE correcting anything

After the correction, **no test anywhere proves a silent reviewer closes the gate.**
`reviewer-silence-is-not-a-pass.test.ts` asserts `dispositionFromFindings` directly and never touches
`runDeMinimisFloor`; derived from the filesystem, the only test call sites of the floor runners are the five
under correction plus one failure-path test. The arrangement being corrected IS that signal today, inverted.

```ts
it('a reviewer that judged NOTHING blocks the floor: aggregate INCONCLUSIVE, gate CLOSED', …)
```

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| revert `R26` (`'UNABLE_TO_DETERMINE'` → `'MET'`) | ⭐ this test — it is the composition-level signal the correction would otherwise remove |
| assert only the aggregate, not the gate | the gate test — an INCONCLUSIVE aggregate that still opens the gate is the harm |
| land `OR-02` before this | ⛔ nothing reddens, and that is the point: the signal is gone and nobody sees it go |

---

### `OR-02` — each orphaned literal says what a reviewer says, DERIVED

Five files. Every `findings: []` becomes `allClean()`, derived from `SEEDED_REASONING_REVIEW_CRITERIA`.

⛔ **DERIVED, NEVER HAND-LISTED** — nine hand-written ids is the defect one level up and would silently stop
covering a tenth. ⚠ Masking was checked: the criterion list is pinned by **id and count**, in full, at
`pwa-export.test.ts:154-164`.

⭑ **NO assertion changes. NO production code changes.**

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| hand-list the nine ids | ⭐ add a tenth criterion to the policy — a derived helper covers it, a hand-list does not |
| `allClean()` returns `failed: true` rows | every corrected test — a clean review is not a faulting one |
| keep `findings: []` | the six declared mutants keep failing to be observable — see `OR-04` |
| **CONTROL** | `reviewer-silence-is-not-a-pass.test.ts` and the four other `R26` guards stay GREEN and untouched |

---

### `OR-03` — the process-result test keeps proving what its comment claims

Its comment names `R14` framing routing as its red, and a fixed reply is framing-blind. The print keys on the
framing text (`'The COMMAND RESULT to review'`, from `framingText`).

⚠ **COVERAGE PROVABLY MOVES RATHER THAN VANISHING** — measured: the `R14` mutant reddens **eight** assertions
that stay on the mock, including a sibling green at baseline. This increment is about the test continuing to
carry its OWN stated red, not about rescuing coverage.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| revert the `R14` framing switch | ⭐ this test — a framing-blind reply would leave it green |
| key the print on something other than framing | the same test — it must be the framing that selects the reply |
| **CONTROL** | the graph framing still routes to the graph arm, unchanged |

---

### `OR-04` — the six declared mutants are re-measured, and one is observable for the first time

Derived over all **727** ledger entries: exactly six mutants name these files as victims.

⭐ **`schema-floor-certifies-without-facts` DECLARES A PREDICTED RED THAT DOES NOT FIRE AT HEAD.** The
reviewer's silence keeps the gate closed regardless, so the mutant's stated guarantee is not merely ungraded —
it is **unobservable**. This increment is what makes the declared red the only red, and the ledger entry is
annotated to say so.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| each of the six, run | its own predicted assertion, and ⭐ **only** its own |
| the nine workspace-wide `expectRed: []` controls | nothing new — they are graded as a DIFFERENCE against a baseline, so a pre-existing red is differenced out |

---

### `OR-05` — one shared env helper for the live-lane arrangements

`JPWB_ASSURANCE_TOOL` / `JPWB_JUDGE_MODEL` are **process-wide**, and `process-result-floor.test.ts` already
warns about it in a `try/finally`. ⚠ One unreproduced flake was observed during triage, consistent with a leak
across workers. Five more hand-copied `try/finally` blocks is how that becomes routine.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| drop the `finally` restore | a follow-on test that asserts the mock lane — the leak becomes visible rather than intermittent |
| copy the block per file instead of sharing | review, not a test — recorded here as the reason the helper exists |

---

## Filed, not fixed

- ⛔ **`C-2` — THE SILENT REFUSAL.** An `INCONCLUSIVE` reasoning-review floor emits **zero** observations, so
  `describeRefusedEvidence` prints `evd_… (npm test): ` with nothing after the colon. A refusal that names no
  reason is its own defect. Filed separately.
- ⚠ **`R26` already turned one boolean into a control that cannot fail.** `work-product-floor-run.test.ts:118`
  stays green under the *"pass any parseable content"* mutant, because `R26` makes the empty product
  `INCONCLUSIVE` regardless; the kill now happens only at `:119`. The pair still discriminates — but one half
  stopped being the half that does, and nothing recorded it.
- ⚠ **`evidence-join.test.ts:268` is unkillable by construction while everything refuses.** It needs one run
  satisfied and one not; today neither is. Leaving it red preserves a broken discriminator.
- ⛔ **REFUTED, NOT DONE:** nine rows on the cross-plane REJECTED arm was proposed as *"more faithful"*.
  Measured: removing both the BLOCKING and NOT_MET rungs reddens the **same assertion** with one row or nine.
  No discrimination gain.

## Not closed by this programme

⛔ **No real reviewer is put on the gate's default path**, and after this lands **no test drives any floor
composition to SATISFIED on the mock lane.** The mock's own arms stay covered by their own suites. ⭑ That is
arguably the honest reflection of `REG-F-409` — disclosed here rather than discovered later.

⭑ **2026-10-02 — `C-2`'s rendered text is repaired (`JAN-ESCREC` `ER-1`, `REG-D-092`).** `describeRefusedEvidence` now prints *"evd_… (npm test): no observation recorded (floor.reasoning-review=INCONCLUSIVE)."* where it printed nothing after the colon. The cause is untouched, and `REG-F-415` stays open as a symptom.
