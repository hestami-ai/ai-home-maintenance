# DESIGN — the applicability subject carries what the rule can ask about (`JAN-APPLSUBJ`)

**Date:** 2026-09-07. A latent defect with a one-field cause and a two-site duplication behind it.

---

## 1. The measured state

`policyApplicability` decides whether an assurance policy governs a subject. Its `expression` escape hatch
supports `RISK_AT_LEAST`, which resolves `$.riskProfile` on the subject:

```ts
case 'RISK_AT_LEAST': {
  const profile = resolvePath(subject, '$.riskProfile');
  if (profile === null || typeof profile !== 'object') return false;
```

⛔ **Both production callers project a subject that cannot carry one.**

| Call site | Projection |
|---|---|
| `packages/rph-application/src/handlers/assurance.ts:1305-1309` | `{ objectType, pwuKind?, tags? }` |
| `packages/rph-engine/src/governing-policies.ts:61-65` | `{ objectType, pwuKind?, tags? }` |

Meanwhile `riskProfile` is **required** on `PROFESSIONAL_WORK_UNIT` (`objects.ts:532`, no `.optional()`),
authored through the UI, and stored (`handlers/pwu.ts:334`).

## 2. ⚠ It is LATENT, and the roadmap must not overstate it

A triage reported *"every risk-gated policy … is silently excluded, including the HIGH_ASSURANCE profile."*
**Not established.** Measured:

- `RISK_AT_LEAST` occurs in production nowhere — only `applicability.test.ts` and the generated enum JSON.
- Seeded policies carry `applicability: { objectTypeConditions, pwuKindConditions? }` — **no `expression`**.
- The HIGH_ASSURANCE "risk gate" (`ontology.data.ts:3630`) is **prose inside an `appliesToRisk` description
  string**, not an executable expression.

⭑ **What IS true:** `ApplicabilityRuleSchema` — including `expression` — is accepted by the policy command
payloads (`messages.ts:725,746`), so a risk-gated policy is authorable today. The first one authored would be
`NOT_APPLICABLE` for every subject forever, and nothing would say why. **A primed trap, not live suppression.**

## 3. Why the silence is the defect, not the `false`

`return false` on an absent profile is **correct** for a subject that genuinely has none — a `PWA` has no
`riskProfile`, and a risk-gated policy should not govern it. The defect is that the CALLER drops a field the
subject HAS, so the operator cannot tell "this subject has no risk profile" from "nobody passed one."

⚠ And the module is conspicuously careful everywhere else about exactly this distinction:

- unparseable `objectTypeConditions` → `REQUIRES_HUMAN_DETERMINATION`, *"undecidable here rather than
  unsatisfied"*;
- an unknown op → *"a fail-loud error, never a silent true/false"*;
- a missing evaluator → an outcome that *"states a true fact about THIS CALL … instead of a false one about the
  corpus."*

Against that discipline, a risk clause that silently reads `false` because the caller under-projected is the
odd one out.

## 4. The shape — fix the projection, and fix the reason there were two of them

Adding `riskProfile` at both sites is the fix. ⭑ But **both sites dropped it**, which is the more informative
fact: the projection is duplicated, so a third caller would drop it too, and every future field added to
`ApplicabilitySubject` starts life dropped in *n* places.

**A single projector in `rph-domain`** — `applicabilitySubjectFrom(state)` — beside the `ApplicabilitySubject`
type it produces. Both callers already depend on `rph-domain` (it is the pure kernel), so there is no new edge.

⛔ **This is not gold-plating, and the session it sits in is the argument.** Every slice this week has been a
declared thing that never reached its reader. Here the reader exists and works; the SUPPLY is what failed, in
two places independently. One projector makes the next field arrive everywhere or nowhere — a difference a test
can see.

## 5. ⛔ What is NOT taken

- **`riskConditions` is not wired.** The kernel already discloses why: *"`lifecycleTriggers`, `eventTriggers`,
  `riskConditions` and `semanticChangeConditions` are ACTIVATION conditions (§5.3 — when a policy activates),
  not SCOPE conditions (what it governs). This kernel answers scope only."* Its element type is *"NAMED by §5.1
  and DEFINED NOWHERE in the corpus"* and is typed `z.array(z.unknown())`. A reader cannot be written for a type
  canon never defined, and writing one would mint vocabulary.
- **No risk-gated policy is authored to make the path fire.** That would be inventing professional content to
  justify wiring — the same refusal recorded for `CP-04b` and `outputContract`.
- **`RISK_AT_LEAST`'s `false`-on-absence is unchanged.** Making it undecidable would flip every PWA subject to
  `REQUIRES_HUMAN_DETERMINATION`, which is a behaviour change to a correct case.
