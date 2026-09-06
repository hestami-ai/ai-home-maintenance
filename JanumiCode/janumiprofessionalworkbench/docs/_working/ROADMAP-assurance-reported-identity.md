# ROADMAP — `JAN-ASRIDENT`: the reviewer's ACTUAL identity reaches the record

**Design:** `DESIGN-assurance-reported-identity.md` · **Date:** 2026-09-06

Discharges the item standing OPEN at the end of `REG-005`. ⭑ No sponsor decision is gated on this: it records
an identity canon already requires (`ASR-4`, `PER-9`) from a source the host already reads, and mints no
vocabulary.

---

### `AI-01` — `devinPrint` returns what Devin reported, before the directory is deleted

The export read moves **inside** `devinPrint`, ahead of its `finally`. Returns a `ToolInvocationResult` when the
model was reported and a bare string when it was not.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| read the export after the `finally` | ⛔ **the only defect that matters here** — the directory is gone; the read returns `undefined` and the grade silently drops to `HOST_CONFIGURED` forever |
| return the CONFIGURED model when the export is unreadable | the absence test — *"absence of evidence, not evidence of another model"*, already pinned by `readReportedModel`'s own test |
| grade `PROVIDER_REPORTED` with no reported value | the grade test — a claim the tool confirmed something it never said |

---

### `AI-02` — the seam can carry it

`AgyPrint` widens to `(prompt) => Promise<string | ToolInvocationResult>`; `isToolInvocationResult` narrows.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| keep the seam at `Promise<string>` | the type-checker at `devinPrint`'s registration |
| narrow with a truthiness check instead of `isToolInvocationResult` | the string-answer test — a non-empty string is truthy and would be read as a result |
| **CONTROL** | an injected `print` returning a bare string still works — every existing gate test injects one |

---

### `AI-03` — the evaluator identity is resolved AFTER the call, and graded

`evaluator` is built from the reported values when present, the configured ones otherwise; `capture` passes the
grade through to `identityFacts`.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| build `evaluator` before the call (today's order) | the reported-identity test — the value is not known yet, so the configured one is recorded |
| use the reported id when it is an empty string | `checkIndependence` requires **both sides defined and different**; an empty id fails closed for the wrong reason |
| drop the grade and keep the id | the evidence test — the record would state a stronger fact with no grade to justify it |
| **CONTROL** | with `agy` (which reports nothing) the identity and grade are UNCHANGED — `HOST_CONFIGURED`, configured model |

---

### `AI-04` — filings

Register entry recording: the four confirmed limbs, ⭑ **the correction to the register's own account** (*"never
called"* understates it — the export is deleted by the same function's `finally`, so no caller could have called
it), and §6's disclosed non-fixes.

⛔ **NOT taken:** `materializedInput` for the assurance plane — the ATIF export carries the model, not the
composed input, and claiming an E-1 composite from it would be a fabricated measurement. A census keyed on
`PROVIDER_REPORTED` having *a* producer — it would have been green throughout this defect.

---

## Gates

**All five: check-types · lint · vitest · playwright · verif.**
