# DESIGN — a disposition rule's independence demand is read (`JAN-DISPIND`)

**Date:** 2026-09-07. Discharges an item the W-3b census explicitly recorded as **owed**.

---

## 1. It is already measured, driven, and filed as owed

`docs/tracking/w3b/invariant-verdicts.ndjson` `limb:ASR-2:6` (verdict `PARTIAL`) records the census and the
drive. Its `owed` field, verbatim:

> *"The `DispositionRule.requiredIndependence` hole is **NOT filed and is owed a REG-F finding**: a policy may
> demand independence for a specific disposition and no code reads the field, so the demand is inert (census: 2
> hits, zero readers; driven-admitted at **L4e**)."*

And `REG-F` (register `:9028`) routes it here rather than double-counting: *"`DispositionRule.requiredIndependence`
(2 hits, both non-readers …) — scored on **ASR-2 limb 6** rather than double-counted here."*

**The observation is pre-driven** (`L4e`): `dispositionRules[SATISFIED].requiredIndependence = DIFFERENT_AGENT`,
no producer supplied → `ACCEPTED`, `assessmentState SATISFIED`, `event.disposition = "SATISFIED"`.

## 2. Where it is lost

`completeAssuranceAssessment` loads the governing policy through a **structural narrowing**
(`handlers/assurance.ts:2076-2079`):

```ts
dispositionRules?: ReadonlyArray<{
  disposition?: string;
  forbiddenOpenSeverities?: readonly string[];   // ← the only field kept
}>;
```

`requiredIndependence` is discarded at the load, so no downstream line could read it even in principle. ⭑ The
sibling `forbiddenOpenSeverities` on the *same* rule object reaches a live read at `:1901`, which is the
positive control: the machinery works, this field is simply not carried into it.

## 3. ⛔ THE RECORDED REMEDY IS WRONG, AND CORRECTING IT IS THE DESIGN

The triage that surfaced this said: *"take the **strongest** of the policy-level requirement and any matched
rule's demand."* ⚠ **There is no "strongest."** `checkIndependence` (`assurance-rules.ts:185-216`) is a **flat
switch of single-dimension equality tests**:

| Requirement | Compares |
|---|---|
| `DIFFERENT_AGENT` | `agentId` only |
| `DIFFERENT_MODEL` | `modelId` only |
| `DIFFERENT_PROVIDER` | `providerId` only |
| `ORGANIZATIONALLY_INDEPENDENT` | `orgId` only |
| `HUMAN` | `evaluator.actorType` |

This is the same fact `REG-F-357` recorded when it refuted *"`DIFFERENT_PROVIDER` is a stronger rung than
`DIFFERENT_MODEL`"* — they are **orthogonal**, and swapping one for the other stops checking the first.

⭑ **So the composition is CONJUNCTION: both must hold.** A policy demanding `DIFFERENT_AGENT` and a disposition
rule demanding `DIFFERENT_MODEL` are two independent demands, and satisfying either says nothing about the
other. Picking "the stronger" would silently DROP one of two declared requirements — a weakening dressed as a
composition, which is exactly the trade `REG-D-013` says to refuse.

## 4. ⛔ What is NOT taken, and why it is the sponsor's

The same census row names a second half:

> *"the dodge exists because `producer` is optional on the payload while the check conjoins on its presence, so
> the fix is either to make `producer` required … or to refuse the completion when the requirement resolves and
> an operand is missing — the fail-closed reading of §13.3 the same file already quotes."*

⚠ **That fall-through is DELIBERATE, REASONED AND PINNED** — `assurance-independence.test.ts:298`, *"the check
is SKIPPED (proceeds, not violated) when the caller supplies no producer — **the chosen gate** … pinned here so
it cannot silently become either outcome"*, and the handler's own comment: *"else falls through unverified
(recorded, never a fabricated pass)."*

**Both readings are defensible and the corpus supports each:**

| Keep the fall-through | Fail closed |
|---|---|
| `independenceResult` is left `undefined` = **unknown**, and the §38 view reads it as unknown. Nothing false is asserted. Fabricating `VERIFIED` would be far worse. | §13.3, quoted **in this same function** twenty lines earlier: *"Fail closed on missing identity, tenant, policy, schema, or authority context."* A producer **is** an identity — and the handler already applies that rule to refuse on missing subject versions. |
| | §8.4: *"If required independence is not satisfied: the assessment cannot receive `SATISFIED`."* An assessment reaching `SATISFIED` with a declared requirement unverified is `INV-8`'s subject. |

⛔ **I will not overturn a pinned, reasoned choice on my own judgement.** It changes behaviour (completions that
succeed today would refuse), it turns on whether *unverified* counts as *not satisfied*, and the internal
inconsistency — §13.3 applied to one missing operand and not another, in one function — is the kind of thing a
sponsor should settle rather than inherit.

⚠ **AND THE CONSEQUENCE FOR THIS SLICE IS DISCLOSED, NOT GLOSSED:** a rule-level demand is **exactly as
dodgeable** as the policy-level one, because it runs through the same gate. This slice makes the two
*consistent*; it does not make either fail-closed. A reader must not take "requiredIndependence is now read" as
"requiredIndependence is now enforced against an omitting caller."

## 5. The shape

1. Carry `requiredIndependence` through the narrowing.
2. Match the disposition rule for the **recommended** disposition — the same match Gate C already makes at
   `:1881`, so the two cannot select different rules.
3. Evaluate every distinct declared requirement; the assessment is independent only if **all** hold.
4. The violation reason names **which** requirement failed and that it came from the disposition rule, because a
   reason a reader cannot act on is the silent omission `PER-9` forbids one layer up.
