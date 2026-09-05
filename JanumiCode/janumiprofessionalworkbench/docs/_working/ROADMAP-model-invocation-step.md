# ROADMAP — `JAN-EXECRUN`: one work unit actually runs

**Design:** `DESIGN-model-invocation-step.md` · **Date:** 2026-09-05

---

## Stages

### `XR-01` — assemble and render, as a pure function

`packages/rph-application/src/execution-invocation.ts`:

- `assembleStepContext(pwu, template)` — build the context map from the PWU's own fields, keyed by the
  template's declared placeholders. Anything the PWU cannot supply is simply absent; **the render guard is
  what refuses**, not this.
- `prepareModelInvocation(pwu, type)` → `{ ready: true, prompt, fingerprint } | { ready: false, reason }`.
  Refuses when the type has no template, when it is `DRAFT`, or when rendering refuses.

**Exit:** pure, no engine, no store, no model.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| substitute a default prompt when the type has none | the no-template refusal |
| accept a `DRAFT` template | the draft refusal |
| swallow the render refusal and send the prompt anyway | the missing-placeholder refusal, and its reason text |

### `XR-02` — the caller

`runModelInvocationStep(...)` in the demo's server layer: prepare → call the model through the injected seam →
record the `MODEL_EXCHANGE` (`plane: 'EXECUTION'`, subject = the PWU, fingerprint resolved) → record the
answer as an `ARTIFACT` → return the artifact id.

⚠ **`executionProvenance` names the MODEL, not the operator.** Recording a human for work a model did is a
fiction, and the floor is entitled to know which it was.

**Exit:** driven against a real engine with an injected model; a `MODEL_EXCHANGE` exists on the execution
plane; its `promptTemplateFingerprint` resolves to `<pwuTypeId>@v<n>`.

### `XR-03` — the button

`beginExecute` becomes: if the PWU's type has an ACTIVE template, plan a `MODEL_INVOCATION` step and run it;
otherwise keep today's `TRANSFORMATION` + `noOutputResult` path **unchanged**.

⭑ **The fallback is not politeness — it is the honest reading.** A type with no prompt declares no agent
behaviour, and inventing one for it would be the seeded-policy-as-projection defect.

**Exit:** an e2e that authors a prompt, executes, and finds the model's answer recorded as an artifact.

⚠ **If the assurance floor then blocks the PWU, THAT IS THE RESULT.** No gate is weakened to make the demo
pass; the finding is the deliverable and the roadmap says so before the work rather than after it.

### `XR-04` — the honesty items

- File the outcome, including the audit's paraphrased boundary (design §1) — **a claim that would have cost a
  sponsor round-trip and was refuted by the corpus.**
- Re-run `REG-F-348`'s derivation. **Run it.**
- Say plainly which of "a PWA can do real work" is now true and which is not.

---

## Gates

`bun run check-types` · `bun run lint` · vitest across every project but CSAA (**263 files / 2208 baseline**)
· playwright for `XR-03`.

## Boundaries

One step, one call · no new command or event · no context-assembly editor · no read-authority mechanism · no
new vocabulary values · no weakened gate · no CSAA.
