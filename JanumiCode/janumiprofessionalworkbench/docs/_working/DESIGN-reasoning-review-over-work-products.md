# DESIGN — the reasoning review over a work product, so the floor can be SATISFIED

**Status:** DESIGN (pre-roadmap) · **Date:** 2026-09-05 · **Programme:** `JAN-EXECREVIEW`
**Follows:** `REG-F-354` (validators are subject-agnostic), `REG-D-059` (findings feed back, bounded)
**Sponsor:** *"Proceed."* (2026-09-05)

---

## 1. What this closes

`REG-F-352` left a model-executed work unit able to run, produce a work product, and **never complete** — the
floor refuses it, correctly, and nothing can satisfy it. This is the increment that lets it finish.

## 2. ⭑ Three measurements, and each made the work smaller

Every one of these was expected to be a subsystem and turned out to be a parameter:

1. **The floor validators do not inspect their subject** (`REG-F-354`). `schemaInvariantValidator(subject,
   facts)` and `identityProvenanceValidator(subject, facts)` judge **facts the caller supplies**.
2. **The remediation classifier does not either.** `classifyFloorRemediation(floor: FloorView)`
   (`apps/rph-demo/src/lib/server/floor.ts:147`) reads only dispositions and observation **codes** — its own
   docblock says *"never prose"*. ⚠ **Measured:** all seven mentions of a PWA inside it are in **guidance
   strings**. The logic is subject-agnostic; only the wording is not.
3. **`runPwaFloor` is a subject plus a context.** It builds an `AssuranceSubject` and a `ValidatorContext`
   whose `reasoningReview.content` is the PWA graph export (`floor.ts:318-341`). **An artifact run is the same
   call with a different subject and different content.**

⭑ **Three times in one session the system turned out to have been designed for this and never used that way.**
That is worth recording as a property of the corpus, not just as convenience.

## 3. Design

### 3.1 The subject

`AssuranceSubject` = the **ARTIFACT**, not the PWU and not the PWA. `isAiProduced: true`, and the producer is
the **model** named in the producing `MODEL_EXCHANGE` — not the operator, per `REG-F-352`.

### 3.2 The deterministic two, derived from the artifact

| Fact | Derivation |
|---|---|
| `schemaValid` | ⭑ `splitAnswerSpan(...).located` — the SAME measurement the retention path makes. ⚠ It means **parseable**, not *conforms to `outputContract`*: the contract is free text and not machine-checkable, so claiming conformance from a parse would be a fabricated measurement. **The observation says "parseable" in those words.** |
| `invariantViolations` | `['WORK_PRODUCT_NOT_PARSEABLE']` when not located |
| `hasStableId` / `hasSemanticVersion` / `hasProvenance` | the recorded `ARTIFACT` envelope |
| `hasProducer` | `producingPwuId` **and** the exchange's resolved model identity |
| `traceComplete` | ⭑ `verifyExchangeContent(...).intact` — the read path built for diagnostics turns out to be the trace check |

### 3.3 The reasoning review's content is the WORK PRODUCT

`reasoningReview.content` becomes the retained answer, and `prompt` becomes **the prompt the producing model
was given** — which the exchange records. ⭑ **The reviewer is therefore judging the same pair the producer
saw**, which is what makes the judgement about the work rather than about a summary of it.

### 3.4 ⛔ Independence is checked, not assumed

`ASR-13` graduates independence from *separate invocation* upward. The producing exchange records the resolved
model identity, so *"the reviewer was the same invocation"* is **decidable on evidence**. A review that fails
it records `INDEPENDENCE_VIOLATION`, which the existing classifier already routes to `CHANGE_REVIEWER`.

⚠ **In the demo today the producer and the reviewer are the same configured judge model.** That satisfies
*separate invocation* — the weakest rung — and nothing more. **The design records that plainly rather than
implying a stronger independence than the deployment has.**

### 3.5 What happens to the step

- **Floor SATISFIED** → the step completes with the work product as its output. ⭑ **This is the end-to-end.**
- **Not satisfied, valid subject findings present** → the step does **not** complete; the findings are
  surfaced. Feeding them back to the producing agent is `REG-D-059`'s ruling and needs the loop bound, which
  is the **next** increment — so this one stops at surfacing, and says so.
- **Not satisfied, nothing actionable** → an assurance-control problem, per §3.6.

### 3.6 ⭑ The classifier's axis is kept, and it is better than the one I proposed

I recommended keying the feed-back decision on the **disposition** (inconclusive vs rejected). **The existing
classifier keys on whether the review produced anything ACTIONABLE**, and that is the right axis, because the
two come apart in both directions:

- a **REJECTED** review with no valid subject finding is equally unactionable — feeding it back manufactures
  work from silence;
- an **INCONCLUSIVE** review that recorded valid observations **is** actionable, and suppressing them would
  discard real findings.

**So the execution plane reuses `classifyFloorRemediation` unchanged**, with guidance parameterised for a work
product. **No second classifier.**

## 4. Boundaries

No new validators · no new classifier · no loop (that is the next increment, and `REG-D-059` bounds it) · no
machine-checkable `outputContract` (owed) · no weakened gate · no CSAA.
