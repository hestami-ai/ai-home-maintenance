# DESIGN — an execution step declares its rationale

**Status:** design, pre-roadmap.

**SPONSOR RULING (2026-09-05):** *"An execution step should declare a rationale."* With the reasoning:
*"if not the actual thinking tokens then some sort of explanation is probably key."*

---

## 1. What forced the question

`JAN-LIVEEXEC`'s first successful run had **GLM-5.2 reject a real work product**, saying the producer

> *"returned the required JSON output but omitted the Section 9.7 professional rationale summary entirely,
> implicitly treating output production as sufficient without accounting for how the obligation was
> discharged."*

⚠ The rejection landed on an incoherence **I** introduced in `JAN-TOOLSUITE` `TS-03`: the executor's system
prompt says *"Do not narrate, do not explain your reasoning."* We instructed the producer not to do the thing
the reviewer then faulted it for omitting.

⭑ **The sponsor's ruling settles it in the reviewer's favour: the executor prompt is wrong.**

## 2. ⭑ The distinction the ruling turns on, which canon already draws

The sponsor's *"if not the actual thinking tokens then some sort of explanation"* is exactly the line this
codebase already draws — it simply had never been drawn on the **execution** plane.

| | **Volunteered reasoning** (thinking tokens) | **Professional rationale summary** (§9.7) |
|---|---|---|
| How it arises | the model emits it unbidden | **contracted** — asked for, part of the deliverable |
| Retention | `PURGEABLE_AT_EXPIRY` (`PER-12`) | `RETAINED_BY_PARTICIPATION` — it participates |
| May an evaluator see it? | ⛔ **never** — *"its presence in an evaluator's context is a hidden-context independence violation (ASR-13)"* | ⭑ **yes** — it is what the reviewer is *for* |
| Obligation to produce | none — *"no obligation to solicit or procure a trace"* | **required** by the execution contract |

The authoring path already says this in the producer's own instruction (`declare_rationale`):

> *"not a list of what you did (the tool calls already record that), but WHY this decomposition is the right one,
> and where it is weak. **An independent reviewer reads this and nothing else about your reasoning.**"*

⭑ So `thinkingLevel: 'off'` **stays**. We still do not solicit chain-of-thought. What changes is that we now
require the *contracted account* that was always meant to stand in its place.

## 3. What the sponsor's paper adds

**"The Lifecycle of LLM-as-a-Judge for Large-Scale Recommendation Explanations"** (arXiv 2608.18300, Netflix) —
LLM judges evaluating hundreds of thousands of explanations per week, across a five-week online A/B test.

⚠ The sponsor flagged they had not read it and that it might not align. Read against this design, three things
land and one does not:

1. ⭑ **"most work treats a judge as a static artifact, evaluating it once at construction or against a fixed
   benchmark… an LLM judge operating in a deployed system is better understood as having a lifecycle."**
   That is precisely our reviewer: a rubric seeded once, never tuned, never monitored. ⚠ Out of scope here, but
   it names something real and unbuilt — see §7.
2. ⭑⭑ **Phase III puts one judge in two roles: "quality gating and reflective generation."** That is
   `REG-D-059` — findings fed back to the executing agent — arrived at independently by a production system.
   Direct corroboration that gating and feedback are one judge's two jobs.
3. ⭑ **Phase I builds benchmarks with "human labels *and rationales*"**, and Phase II tunes rubrics via a
   **meta-judge over reasoning output**. Rationales are treated as first-class evaluation data, not commentary —
   which is the sponsor's point, from a different direction.
4. ⛔ **What does NOT carry over:** RART's meta-judge learns from *reasoning output*. Ours may not be the
   **producer's** interior — `PER-12` forbids exactly that. Netflix's judges evaluate explanations that are
   *deliverables shown to members*; that is our §9.7 rationale, not our thinking tokens. ⚠ Adopting RART
   wholesale would walk straight through `ASR-13`'s hidden-context dimension.

⭑ **Net:** the paper supports the ruling, and it independently corroborates `REG-D-059`. It does not license
feeding the producer's interior to the judge, and this design does not.

## 4. Where the requirement belongs

⛔ **NOT in the work-unit type's prompt template.** `REG-D-058` ruled the template is **owned by the type** —
authored by a professional. Injecting a rationale instruction into it would compete with that ownership and
silently edit someone else's contract.

⭑ **It belongs in the EXECUTOR's system prompt**, which the harness owns. That is the clean seam:

- **the type says WHAT work** — the instruction and its output contract;
- **the harness says the EXECUTION CONTRACT** — return the work product *and* an account of it.

## 5. The shape

The execution contract wraps the professional's contract rather than replacing it:

```json
{ "workProduct": <exactly what the instruction asked for>, "rationale": { … } }
```

- **`workProduct`** is re-serialized and becomes the ARTIFACT, so the type's own output shape is preserved
  intact — a professional's `outputContract` still means what it says.
- **`rationale`** populates `ReasoningReviewInput.rationale`, the slot the reviewer already reads
  (`ProfessionalRationaleSummary`: `rationale`, `assumptions`, `limitations`, `residualUncertainty`).

⚠ **`RETAINED_BY_PARTICIPATION`, not purgeable.** The rationale is contracted output; it participates in the
assessment. Classifying it as volunteered reasoning would make the record purge the very thing the reviewer
judged.

## 6. ⛔ When the model does not comply

A model may return no envelope, or an envelope with no rationale. The authoring seam already states the rule
this must follow:

> *"Undefined when the producer never declared one; that is a **contract shortfall to record, never an absence
> to infer from** (§9.7)."*

So: **record the shortfall, never fabricate a rationale, and never treat the answer as unusable.** Concretely —
if the envelope is absent, the whole answer is the work product and the rationale is recorded as *not declared*;
the reviewer then sees a real absence and may legitimately make a finding of it. ⭑ That is the same verdict
GLM-5.2 already reached, arrived at lawfully rather than by accident.

⚠ And the reviewer's input shape **must not change** with presence or absence: §9.7 holds that presence or
absence is never a signal, so the section renders `(none recorded)` exactly as it does today.

## 7. Not in scope, but named

- **The judge's own lifecycle** (the paper's central claim). Our rubric is seeded once and never tuned; there is
  no drift detection and no HITL re-tuning gate. `REG-Q-069` already records that the profile ladder is dead
  data. This is a programme, not an increment.
- **`REG-D-059`'s feedback loop.** Now doubly motivated — by the sponsor's earlier ruling and by the paper's
  Phase III — and it finally has real findings to loop on.
- ⚠ **The reviewer still records `HOST_CONFIGURED`** while the suite declares Devin `PROVIDER_REPORTED`;
  `readReportedModel` is never called. Owed from `JAN-LIVEEXEC`, unrelated to this change.
