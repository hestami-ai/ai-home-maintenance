# DESIGN — REG-E-024(b) asks the wrong question: the aggregate roll-up is ratified, and it was never a state machine

**Date:** 2026-08-05 · **Status:** measured, ready to implement · **Closes:** REG-E-024(b)

---

## 0. The correction, first

REG-E-024(b) reads:

> ***(b)*** `AggregateAssuranceDisposition` — **six states, no arrows**: is the aggregate roll-up axis intended and
> unbuilt, or superseded?

Both branches of that question presuppose a **state machine**. It is not one, and the repository already knew:

- `gen-transitions.ts` describes such rows as *"not an arrow at all (a computed reduction, e.g.
  `AggregateAssuranceDisposition`'s …)"*.
- `state-reachability.test.ts` **excludes** it from the reachability census for exactly that reason.

**It has no arrows because it is a FOLD.** Asking which arrows it lacks is like asking which arrows `sum()` lacks.

**And the rule is RATIFIED, in full, in DOC-004 §28.2** — which I did not read before deciding, earlier today, not
to touch PWU-level roll-up *"because `AggregateAssuranceDisposition` is six ratified states with no arrows"*. I
took the elicitation item's framing as the measurement. **Fourth instance this session of trusting a recorded
claim instead of re-deriving it**, and the most consequential, because it caused me to withhold work that was
never blocked.

## 1. What the corpus actually states

**§28.2 — an ORDERED decision table** (verbatim):

```text
Any critical rejection              → REJECTED
Any blocking rejection              → REJECTED
Any required assessment missing     → EVIDENCE_REQUIRED or UNASSESSED
Any inconclusive required assessment→ INCONCLUSIVE
Any conditional required assessment → CONDITIONALLY_SATISFIED
All required assessments satisfied  → SATISFIED
```

> This must not be reduced to a numerical average.

**§28.1 — the invariant it must satisfy:** *"An aggregate assurance state must preserve the **strictest unresolved
disposition** relevant to the work."* Plus *"A satisfied advisory policy does not override a rejected blocking
policy"* and *"Policy results remain independently inspectable."*

**The document order IS the strictness order.** That is the design's key property and it makes §28.1 executable:
the fold returns the first matching rung, and the rungs descend in strictness.

## 2. Two places the corpus does not reach, both DERIVED and disclosed

| Gap | Reading | Why |
|---|---|---|
| `EVIDENCE_REQUIRED` **or** `UNASSESSED` — §28.2 gives a disjunction, not a rule | An applicable policy with **no assessment at all** → `UNASSESSED`; one whose assessment exists but has not concluded → `EVIDENCE_REQUIRED` | The two words mean exactly this distinction, and it is the only reading under which both values are reachable. |
| `ESCALATED` has **no rung** | → `INCONCLUSIVE` | `ESCALATED` is a ratified *assessment* disposition but not an *aggregate* value. §28.1 requires the strictest **unresolved** disposition; among the six, `INCONCLUSIVE` is "assessed, not concluded". Mapping it to `SATISFIED` is unthinkable and to `REJECTED` overstates a verdict nobody gave. **Recorded as a genuine §28.2 gap**, not papered over. |

**`critical` vs `blocking` rejection is deliberately NOT modelled.** Both rungs produce `REJECTED`, so the
distinction cannot change the output — modelling it would be false precision. Said out loud rather than left to
look like an oversight.

## 3. Why this is not another instrument waiting

The §38 view (`buildApplicablePolicies`) already returns, per PWU, every applicable policy with `assessed`,
`disposition` and `applicable`. **That is exactly §28.2's domain, and the view never says what it adds up to** —
a reader sees N policies with N verdicts and must do the composition in their head, which §28.1 says must not be
done by averaging and which nothing stops them doing by averaging.

So the fold ships **with its consumer**: `buildApplicablePolicies` gains the aggregate. One function, in
`rph-domain`, called by the projection — never a second copy.

**Inapplicable policies are excluded from the fold** and remain in the view. §28.2 says *"required assessment"*;
a policy determined `NOT_APPLICABLE` under §5.1 requires nothing. Guide §8.4's *"inapplicable … coverage are
explainable; gaps are never silent"* is satisfied by the row staying visible, which is the existing behaviour.

## 4. What it delivers

1. `aggregateAssuranceDisposition()` in `rph-domain` — §28.2 transcribed as an ordered fold, first match wins.
2. The §38 view carries the result per PWU.
3. Gates: each rung; **precedence between rungs** (a set containing both a rejection and an inconclusive must
   yield `REJECTED`, or the ordering is decorative); the §28.1 strictness property as a **monotonicity** check —
   replacing any assessment with a stricter one may never weaken the aggregate; and **all six values reachable**,
   which is the answer REG-F-023 wanted for this enum.
4. The "not a numerical average" prohibition is structural — a first-match fold cannot average — and is asserted
   by a case where the majority is `SATISFIED` and the aggregate is `REJECTED`.

## 5. What this deliberately does not do

- **No arrows, no machine, no `transitions.data.ts` row.** The reachability census's exclusion is correct and stays.
- **No `escalated` rung invented into §28.2.** The mapping is in the fold, disclosed, and filed.
- **No change to the PWU's own `assuranceState` axis.** That is a different, arrow-bearing machine with its own
  ratified transitions; conflating the two is precisely the error REG-E-024(b)'s framing invites.
