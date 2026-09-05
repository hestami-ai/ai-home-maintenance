# DESIGN — assurance over an execution artifact, so the floor can be SATISFIED and not only refuse

**Status:** DESIGN (pre-roadmap) · **Date:** 2026-09-05 · **Programme:** `JAN-EXECASSURE`
**Follows:** `REG-F-352` (a model-executed step meets the floor and is refused), `REG-F-353`
**Sponsor:** *"Proceed with both follow ons."* (2026-09-05)

---

## 1. The gap, stated exactly

`REG-F-352` landed a work unit that genuinely runs, and the floor refused its completion — correctly, and for
the first time in this system's history. **What it cannot yet do is SATISFY that floor**, so a model-executed
step can start, produce a work product, and never complete. The demo can now do real work and cannot finish it.

`floorGateBlock` (`packages/rph-application/src/handlers/floor-gate.ts:305`) requires the three floor policies
**SATISFIED against the subject** — here, the produced `ARTIFACT`. Nothing assesses an artifact.

## 2. ⭑ The measurement that makes this far smaller than it looks

I expected to need artifact-shaped validators. **The floor validators are subject-agnostic.**

`packages/rph-assurance/src/floor.ts:161` and `:213` — `schemaInvariantValidator(subject, facts)` and
`identityProvenanceValidator(subject, facts)`. They do **not** inspect a PWA graph; they judge **facts the
caller supplies**, and the fact shapes are small:

```
SchemaInvariantFacts     { schemaValid, invariantViolations[] }
IdentityProvenanceFacts  { hasStableId, hasSemanticVersion, hasProvenance, hasProducer, traceComplete }
```

⭑ **So this programme derives FACTS about an artifact; it does not build validators.** The demo already does
exactly this for a PWA — `identityProvenanceFactsOf(pwa, producer)` at `apps/rph-demo/src/lib/server/floor.ts:242`,
supplied at `:329-333`. The artifact path is the same shape with a different subject.

## 3. Design

### 3.1 The deterministic two

| Fact | For an execution artifact | Where it comes from |
|---|---|---|
| `schemaValid` | the work product is well-formed | ⭑ **`splitAnswerSpan(...).located`** — the SAME deterministic measurement the retention path already makes (`REG-F-351`). A locatable answer is a parseable one. |
| `invariantViolations` | empty when located | — |
| `hasStableId` | the `ARTIFACT` id | the recorded object |
| `hasSemanticVersion` | the envelope's `semanticVersion` | the recorded object |
| `hasProvenance` | the envelope's `provenance` | the recorded object |
| `hasProducer` | `producingPwuId` **and** the exchange's resolved model identity | `ARTIFACT` + `MODEL_EXCHANGE` |
| `traceComplete` | prompt → answer → artifact all resolve, and the artifact's `storageKey` matches the exchange's `answerSpanRef` | ⭑ **`verifyExchangeContent` already answers this** (`JAN-MXREAD`) — the read path built for diagnostics turns out to be the trace check |

> ### ⚠ AND `schemaValid` IS WEAKER THAN IT LOOKS — SAID HERE RATHER THAN DISCOVERED
> `PromptTemplate.outputContract` is **free text** describing what a conforming answer looks like. It is **not
> machine-checkable**, so "the work product conforms to its contract" cannot be deterministically decided
> today. What CAN be decided is that the answer is **locatable and parseable**, which is strictly weaker.
>
> ⛔ **The design does not paper over that.** `schemaValid` means *parseable*, the observation says so in those
> words, and **a machine-checkable output contract is recorded as owed**. Claiming contract conformance from a
> parse would be the fabricated-measurement defect this register records repeatedly.

### 3.2 The reasoning review over a work product

The third policy is a real model call judging the work product — and it is **the substantive half**, not a
formality. Two things it must not inherit by accident:

1. ⭑ **Independence.** `ASR-13`: independence is *"policy-declared and graduated (separate invocation →
   different agent → different model/provider → human)"*. The reviewer of a model's work product must not be
   the same invocation that produced it. **The producing exchange records the resolved model identity, so this
   is checkable rather than assumed** — and checking it is what stops a model marking its own homework.
2. **The subject is the ARTIFACT, not the PWA.** The existing reasoning-review prompt is built for a work
   architecture. A work product needs its own, and reusing the graph prompt would ask the reviewer a question
   about something that is not in front of it.

## 4. ⚠ Why this design stops here rather than shipping

The deterministic two are a few hours' derivation. **The reasoning review over a work product is the piece
that decides whether "assured" means anything**, and it needs its own prompt, an independence check with a
driven mutant, and a decision about what a REJECTED work product does to the step.

⭑ **Landing the deterministic two alone would change nothing visible** — the floor needs all three, so the
step would still not complete — and would leave the substantive third looking like remaining plumbing when it
is the part that carries the meaning. **This is recorded as a scope judgement, not a discovery: an assurance
mechanism is the worst possible thing to rush.**

## 5. Open question for the sponsor

**What happens to a step whose work product the reasoning review REJECTS?** The candidates are: the step
FAILS (the work is not done); the step completes and the PWU stays unassured (the work exists, unblessed); or
a repair try runs, as the assurance path already does for its own judgements.

**Recommendation: the step FAILS, with the observation cited.** A completed step whose output was rejected
reads as done, and `INV-5`'s whole content is that execution success and assurance are separate axes — a
rejected work product is an execution that did not achieve its purpose, and `FailExecutionStep` already exists
to say so.

## 6. Boundaries

No new validators · no weakened gate · no machine-checkable output contract in this programme (recorded as
owed) · no new command or event · no CSAA.
