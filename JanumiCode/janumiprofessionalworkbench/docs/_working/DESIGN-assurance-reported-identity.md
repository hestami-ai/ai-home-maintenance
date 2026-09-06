# DESIGN — the reviewer's ACTUAL identity reaches the record (`JAN-ASRIDENT`)

**Status:** design. **Date:** 2026-09-06. Discharges the item left OPEN at the end of `REG-005`:
*"the reviewer still records `HOST_CONFIGURED` while the suite declares Devin `PROVIDER_REPORTED`:
`readReportedModel` reads the model out of Devin's ATIF export and **is never called**, because the assurance
seam still returns a bare string exactly as the execution seam did before `TS-04`."*

---

## 1. The obligation, quoted rather than paraphrased

⭑ **`ASR-4` (`JPWB-DOC-003:253`)** — the invariant that governs Reasoning Review — requires

> *"at minimum a distinct evaluator invocation, role, and review context whose **actual identities and lineage
> are recorded**."*

⭑ **`PER-9` (`JPWB-DOC-003:369`)** says the same thing of every try:

> *"Every bounded model or agent try … is its own durable exchange record capturing … the resolved provider,
> model, and version **actually invoked**."*

⚠ **The code cites `§8.4` for this** (`reasoning-review-validator.ts:242`). That is the **Guide**, not `DOC-003`,
and this design does not rest on it: `ASR-4` and `PER-9` are ratified canon and say the operative thing
directly. The Guide reference is left where it is — it is not wrong, it is merely not what I verified.

## 2. The measured state, with the register's own account CORRECTED

| Claim | Evidence | Verdict |
|---|---|---|
| `readReportedModel` is never called | `grep -rn readReportedModel` over `packages/` + `apps/` → its definition, its **own test** (×2), and one comment. No production call site. | ✔ CONFIRMED |
| The assurance seam returns a bare string | `AgyPrint = (prompt: string) => Promise<string>` (`reasoning-review-validator.ts:178`) | ✔ CONFIRMED |
| The reviewer records `HOST_CONFIGURED` | `identityFacts` defaults `evidence: id.evidence ?? 'HOST_CONFIGURED'` and the validator never supplies one | ✔ CONFIRMED |
| The suite declares Devin `PROVIDER_REPORTED` | `backing-tool.ts:97` `identity: 'PROVIDER_REPORTED'` | ✔ CONFIRMED |

⭑⭑ **AND ONE FACT THE REGISTER MISSED, WHICH CHANGES THE REMEDY.** *"Never called"* understates it.
`devinPrint` creates the export in a `mkdtemp` directory and **deletes that directory in its own `finally`**
(`devin-reviewer.ts:84`) before returning. So `readReportedModel` is not merely uncalled — **no caller of
`devinPrint` could ever call it**, because the file it reads is gone by the time `devinPrint` returns. Wiring it
is therefore not "add a call site"; the read has to happen **inside** `devinPrint`, before cleanup.

⚠ **`readReportedModel` is not dead code by oversight — it is a function whose only possible caller is its own
enclosing function.** That is a different defect from an unused export, and it is why the export path is
`const`-scoped inside `devinPrint` rather than returned.

## 3. What is actually wrong, in one sentence

The reviewing model's identity in the record is **what the host asked for**, and `REG-D-052` already settled
that *the model is configured, never pinned* — while `REG-F-331` recorded a pinned label rotting. A configured
label and the model that answered **can differ**, and Devin reports the difference in every export
(`agent.model_name: "GLM-5.2 High"` vs `steps[].extra.generation_model: "glm-5-2"` — ⭑ **already two different
strings in the fixture derived from a real export**).

⛔ **And the identity is not only a record field.** `evaluator` flows to
`reasoningReviewResultFromJudgement` (`:383`), which is what `checkIndependence` compares against the producer.
So the independence ladder is currently comparing the producer's **reported** model against the reviewer's
**configured** one — two different kinds of fact on the two sides of one equality test.

## 4. The shape — mirror `TS-04`, because the defect is the same one

`TS-04` widened the execution seam from `print: (prompt) => Promise<string>` to a result that can carry the
tool's own account. The assurance seam is the same seam, one slice behind.

```
AgyPrint = (prompt: string) => Promise<string | ToolInvocationResult>
```

⭑ **`ToolInvocationResult` ALREADY EXISTS** (`backing-tool.ts`) with `answerText`, `producer`,
`identityEvidence` and `materializedInput`, and `isToolInvocationResult` already narrows it. Nothing new is
minted — this is the second consumer of a type authored for exactly this.

**Three changes, and no more:**

1. `devinPrint` reads the export **before** its `finally` and returns a `ToolInvocationResult` when it can.
2. The validator resolves the evaluator identity **after** the call rather than before it, using the reported
   values when present and the configured ones otherwise.
3. `capture` passes the tool's `evidence` grade through to `identityFacts`, exactly as `run-model-step` does.

⚠ **`materializedInput` is NOT taken.** The ATIF export in hand carries the model, not the composed input, so
claiming an E-1 composite from it would be a fabricated measurement. The assurance E-1 stays the prompt, which
is what it has always been and is very nearly the whole input for a one-shot `--print` call.

## 5. ⛔ The two failure modes this must not introduce

**5.1 A grade stronger than the evidence.** `readReportedModel` returns `undefined` on an unreadable export,
and its own test pins the reason: *"absence of evidence, not evidence of another model."* An absent report must
fall back to the configured value **graded `HOST_CONFIGURED`** — never the configured value graded
`PROVIDER_REPORTED`, which would assert the tool confirmed something it never said.

**5.2 A weakened independence check.** `checkIndependence` requires **both sides defined and different**. If a
reported id arrived empty and overwrote a configured one, the check would fail closed — safe, but for the wrong
reason, and a reader could not tell that from genuine sameness. The reported value is used **only when
non-empty**.

## 6. ⚠ What this does NOT fix, stated so it is not read as fixed

- **`agy` still grades `HOST_CONFIGURED`, correctly** — it confirms nothing about itself. The gap is Devin's.
- **The version arm stays `UNREPORTED`.** `identityFacts` records that as a measurement with a rationale; the
  ATIF export carries a model label, not a version.
- **No verif census counts producers of `PROVIDER_REPORTED`.** The execution side produces it, so any census
  that merely asked *"does the member have a producer"* would have been GREEN throughout this defect. That
  absence is disclosed here rather than closed — a census keyed on the enum member would not have caught this,
  and inventing one now would pin the symptom rather than the rule.

## 7. Decisions

| # | Decision | Recommendation |
|---|---|---|
| A-1 | Widen `AgyPrint` to the union, or add a second optional seam? | ⭑ **Widen.** A second seam would let a deployment configure a tool that reports identity and a validator that ignores it — the two-ways-to-say-one-thing shape (`REG-F-353`). |
| A-2 | Resolve evaluator identity after the call — does that break the repair path? | The repair try reuses the same tool; the reported identity from the FIRST try stands unless the second reports its own. Both tries record what they were told. |
| A-3 | Should an export that reports a DIFFERENT model than configured refuse? | ⛔ **No.** That is the exact fact `PER-9` wants recorded; refusing it would delete the evidence the field exists to carry. Record it, grade it `PROVIDER_REPORTED`, and let independence read the truth. |
