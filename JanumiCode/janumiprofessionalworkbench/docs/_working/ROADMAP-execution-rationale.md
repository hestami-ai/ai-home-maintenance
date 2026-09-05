# ROADMAP — `JAN-EXECRAT`: an execution step declares its rationale

**Design:** `DESIGN-execution-rationale.md` · **Date:** 2026-09-05 · **Sponsor ruling:** *"An execution step
should declare a rationale."*

⭑ **Exit:** the live lane runs again and the rejection GLM-5.2 issued is either gone, or replaced by a finding
about the *content* of the rationale rather than its absence.

---

### `ER-01` — the execution contract, in the executor's system prompt

Replace *"Do not narrate, do not explain your reasoning"* with a contract that **forbids chain-of-thought
narration and REQUIRES a contracted account** — two different things, said as two different things.

⛔ **Nothing is added to the type's prompt template** (`REG-D-058`: the template is owned by the type).

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| keep the old "do not explain your reasoning" line | the prompt test — it must ask for a rationale |
| ask for chain-of-thought / "your thinking" | the PER-12 test: the prompt must NOT solicit interior reasoning |
| put the requirement in the type's template | the ownership test — the rendered template must be unchanged |

---

### `ER-02` — the envelope, split

`{workProduct, rationale}` → `workProduct` is re-serialized as the ARTIFACT; `rationale` becomes
`ProfessionalRationaleSummary`.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| store the whole envelope as the work product | the artifact test — a professional's `outputContract` still means what it says |
| classify the rationale `PURGEABLE_AT_EXPIRY` | the retention test: it is CONTRACTED output and participates (`PER-8`), not volunteered reasoning (`PER-12`) |
| **CONTROL** | a non-envelope answer is still a usable work product — see `ER-03` |

---

### `ER-03` — ⛔ non-compliance is a RECORDED SHORTFALL, not a fabrication and not a failure

No envelope, or no rationale inside it → the whole answer is the work product and the rationale is recorded as
**not declared**.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| synthesize a rationale when none was declared | the fabrication test — *"a contract shortfall to record, never an absence to infer from"* |
| refuse the step when no rationale arrives | the usability test — the work product is still a work product |
| change the reviewer's input shape when it is absent | the §9.7 test: presence or absence is never a signal; the section renders `(none recorded)` |

---

### `ER-04` — the rationale reaches the reviewer

`runWorkProductFloor` passes it into `ReasoningReviewInput.rationale`, the slot the reviewer already reads.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| drop it on the floor | the wiring test — a field authored with no consumer is the defect this programme keeps recording |
| pass the work product as the rationale | the distinctness test |

---

### `ER-05` — run the live lane again

⭑ **This is the deliverable.** Report what GLM-5.2 says now. Success is **not** "SATISFIED" — it is that the
reviewer's finding, if any, is about the rationale's *content* rather than its *absence*.

⚠ A run that goes SATISFIED is not proof the change was right; a run whose objection MOVED is.

---

## Gates

check-types · lint · vitest · playwright (deterministic). The live lane stays opt-in and out of the gate.
