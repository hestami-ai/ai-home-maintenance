# ROADMAP — `JAN-EXECREVIEW`: the floor can be SATISFIED for a work product

**Design:** `DESIGN-reasoning-review-over-work-products.md` · **Date:** 2026-09-05

---

## Stages

### `XA-01` — the artifact's facts

`workProductFloorFacts(...)` in the demo's execution layer: the two deterministic fact sets, derived from the
recorded `ARTIFACT`, the producing `MODEL_EXCHANGE`, and `verifyExchangeContent`.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| `schemaValid: true` unconditionally | the unparseable-work-product test |
| `traceComplete: true` without calling `verifyExchangeContent` | the tampered-store test |
| `hasProducer` from the operator rather than the model | the producer-identity test |
| **CONTROL** | a well-formed artifact yields all-true — or "always false" would pass the three above |

### `XA-02` — run the floor over the artifact

`runWorkProductFloor(...)`: the same `AssuranceSubject` + `ValidatorContext` shape `runPwaFloor` builds, with
the artifact as subject and the retained answer as `reasoningReview.content`.

**Exit:** three `ASSURANCE_ASSESSMENT`s recorded against the artifact; `floorGateBlock` returns `null`.

### `XA-03` — the step completes

`beginExecute` runs the work-product floor after recording the artifact, then attempts completion.

**Exit:** ⭑ **an e2e in which a model-executed work unit actually COMPLETES** — the first time in this
system's history.

⚠ **And the refusal path must stay asserted.** `REG-F-352`'s spec proves the floor blocks an unassured step;
that spec must still pass, with the block now arising because the review was not satisfied rather than because
nothing ran. **If it needs editing, say why in the entry.**

### `XA-04` — guidance parameterised, classifier untouched

`classifyFloorRemediation` keeps its logic and its axis. Only the guidance wording is parameterised for a work
product. ⛔ **No second classifier** — the design's §3.6 records why the existing axis is better than the one
this programme first proposed.

### `XA-05` — the honesty items

- File the outcome; re-run `REG-F-348`'s derivation (**run it**).
- ⚠ **State the independence rung plainly:** producer and reviewer are the same configured model, which
  satisfies *separate invocation* and nothing more. **Do not let the entry imply otherwise.**
- State that `schemaValid` means *parseable*, not *conforms to its output contract*.

---

## Gates

`bun run check-types` · `bun run lint` · vitest across every project but CSAA (**268 files / 2259 baseline**)
· playwright for `XA-03`.

## Boundaries

No new validators · no new classifier · no loop · no machine-checkable output contract · no weakened gate ·
no CSAA.
