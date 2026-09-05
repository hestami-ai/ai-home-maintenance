# ROADMAP — `JAN-EXECLOOP`: findings go back to the producer, bounded

**Design:** `DESIGN-execution-feedback-loop.md` · **Date:** 2026-09-05 · Implements the increment
`REG-D-059` licensed and left OPEN.

⭑ **Exit:** the live lane shows a rejected work product **repaired on a second try**, or stopped and escalated —
and the record says which, and why.

---

### `EL-01` — the trend classifier

`CONVERGING` / `STALLED` / `DIVERGING` from the high-severity finding count across tries. Pure function.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| treat a flat count as CONVERGING | the STALLED test — no progress is not progress |
| treat a rising count as STALLED | the DIVERGING test |
| classify on try 1 | the first-try test: there is no trend from one point (the sibling runs "from attempt 2 onward") |
| add a `SCOPE_BLIND` arm | ⛔ the **cannot-fail** test: an execution step invokes no tools, so a tool-derived signal reads "no loop" forever |
| **CONTROL** | a falling count IS `CONVERGING`, else the classifier never permits a retry |

---

### `EL-02` — ⛔ INCONCLUSIVE never feeds back

Close the gap in §4: `REFINE_SUBJECT` requires a disposition that actually rejects.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| keep `disposition !== 'SATISFIED'` | the INCONCLUSIVE test — a reviewer that *could not tell* must not manufacture work from silence (`ASR-11` limb 1) |
| exclude REJECTED too | the CONTROL — a real rejection with findings MUST feed back, or the loop never runs |

⚠ Both arms are needed: alone, either passes a classifier that always refuses or always accepts.

---

### `EL-03` — the bounded loop on the execution plane

Feed the structured findings into the producer's next prompt; re-run; stop at `SATISFIED`, at a non-`CONVERGING`
trend, or at the bound (3 tries).

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| unbounded while-loop | the bound test — `REG-Q-078` recorded that a repair try is *"not wrong, it is unbounded"* |
| stop after one try | the retry test (the authoring plane's bound of one is what this increment exists to raise) |
| pass the reviewer's prose wholesale | the findings test: structured `{code, statement}`, because `classifyFloorRemediation` reads codes *"never prose"* |
| tell the producer HOW to fix it | the guidance test — that would be the harness doing the professional work |
| **CONTROL** | a first-try SATISFIED performs exactly ONE model call |

---

### `EL-04` — each try is its own record

`role: 'repair'`, a predecessor, and the superseded try's raw output untouched.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| overwrite the first try's record | CSAA-007: *"repair never rewrites predecessor raw output"* |
| record one exchange for the whole loop | `PER-9`: *"each retry, reformat, and repair request included"* |

---

### `EL-05` — escalation is reached and recorded

At the bound or on a non-`CONVERGING` trend: `ESCALATE_REVIEW`, recorded. ⛔ Where it routes stays intent
(`REG-D-059`: the sponsor's own *"far afield"*).

---

### `EL-06` — run it live

⭑ **The deliverable.** GLM-5.2 rejected a work product for a real reason once already. Does the producer
address it on try 2? Report what happened — a repair, a stall, or an escalation — and do **not** require any
particular one.

⚠ A live run that goes SATISFIED on try 2 is the interesting case; a stall is equally informative and must not
be treated as a failure of the increment.

---

## Gates

⚠ **All five: check-types · lint · vitest · playwright · verif.** The last slice gated on four and landed the
roadmap ratchet red — running four of five is how a ratchet dies quietly.
