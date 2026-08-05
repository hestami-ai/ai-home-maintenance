# DESIGN — validator health: the last unreachable states, and the mechanism §34.1 already depends on

**Date:** 2026-08-05 · **Status:** measured, ready to implement · **Closes:** REG-E-024(c), REG-F-023's remainder
**Authority:** sponsor decision 2026-08-05 — *"yes validator health matters enough to design"* — plus the standing
authoring grant and the 2026-08-05 corpus-amendment grant.

---

## 1. What is actually missing

`ValidatorRegistryEntry.status` — `ACTIVE | DEGRADED | DISABLED` — is the **last unreachable state group in the
entire system**. Everything else the reachability census once listed is now closed. The vocab records why, in one
line: *"assurance-service doc §35 enum (VERBATIM). **NO transition table specified in the doc.**"* Three declared
states, `transitions: []`, no object type, no commands, no events.

REG-E-024(c) states the cost precisely: **"the assurance system cannot record that one of its own validators is
failing."**

## 2. The corpus grounds far more than §35's interface

I opened this expecting §35 alone — *"The runtime **should** maintain a registry"* plus a shape — and said so when
declining to design it unasked. Measured, four ratified sources converge:

| Source | What it gives |
|---|---|
| **§35** | The entry, the three statuses, and *"Selection should consider: policy; independence; … **availability**; risk profile."* — status is meant to **feed selection**. |
| **§34.1** | *"A validator implementation failure is not an assurance rejection. It produces: `VALIDATOR_FAILED`; execution error; incomplete assessment; retry, **alternate validator implementation**, or escalation action."* |
| **§30 / m2** | `ASSESSING → VALIDATOR_FAILED`, trigger *"validator execution failure (§34.1)"*, note *"INV-9: a validator failure is NOT an assurance rejection"*. |
| **RPH-ASR-006** (ratified conformance test) | *"a validator times out → assessment state becomes `VALIDATOR_FAILED` or returns to ready for retry. The assessed work is not automatically rejected."* |

**§34.1 is the hinge.** Choosing an *alternate validator implementation* is impossible unless the system knows
which validators are available — so `status` is not bookkeeping the corpus merely permits, it is **the mechanism a
ratified error-handling rule already depends on**. That is the difference between designing a subsystem and
completing one the corpus has already committed to.

## 3. What is ratified, and what is mine

**RATIFIED:** the entry shape; the three statuses; that selection considers availability; §34.1's response set;
`ASSESSING → VALIDATOR_FAILED`; that a validator failure is not a rejection of the work.

**AUTHORED (and the corpus says so itself — *"NO transition table specified"*):** which arrows connect the three
states, what triggers each, and the commands and events that carry them.

Every authored element is marked as such, and the corpus is amended in the §0.3 blockquote convention to declare
the transition table — so the machine stops being a shape with no arrows.

## 4. The machine

```
                 register
                    │
                    ▼
   ┌───────────► ACTIVE ◄──────────┐
   │ restore      │   │   enable   │
   │              │   └───────────►│
DEGRADED ◄────────┘         DISABLED
   │        degrade              ▲
   └─────────────────────────────┘
                 disable
```

| Arrow | Trigger | Basis |
|---|---|---|
| *(initial)* → `ACTIVE` | `RegisterValidator` | A registered validator is available until something says otherwise. |
| `ACTIVE → DEGRADED` | `MarkValidatorDegraded` | **§34.1's missing half.** The assessment records `VALIDATOR_FAILED`; this records that *the validator* is the thing that failed. |
| `DEGRADED → ACTIVE` | `RestoreValidator` | Degradation must be recoverable or it is disablement under another name. |
| `ACTIVE\|DEGRADED → DISABLED` | `DisableValidator` | A governance act — deliberate withdrawal, not an observation. |
| `DISABLED → ACTIVE` | `EnableValidator` | The inverse governance act. |

**Degradation is a SEPARATE governed act, not a side effect of the failed assessment.** Every command in this
engine targets one aggregate, and a handler that silently mutated a second one would put a governance fact
somewhere no command names. The cost is that a caller must do both — which is why the *enforcement* below is what
gives the status teeth, rather than trusting callers to remember.

## 5. What makes it non-vacuous

A status nothing reads is REG-F-022 again. Two consumers, both grounded:

1. **A `DISABLED` validator's RESULT is refused, at `completeAssuranceAssessment`.** §35 makes availability a
   selection input and §34.1 requires an *alternate* implementation be choosable; both are empty words unless a
   withdrawn implementation is actually barred.
   - **⚠ CORRECTED DURING IMPLEMENTATION — §35's prose points at a seam that does not carry the identity.**
     `selectAssuranceEvaluator` carries `evaluator: ActorReference` — a PERSON — while the registry keys on
     `validatorId`, an IMPLEMENTATION. The reference undertaking's evaluator is `evaluator-1` and its validator is
     `reference-undertaking.reviewer`: **different namespaces**, and joining them would be inferring a binding
     from proximity — the exact error REG-F-022 records for `evidenceId` vs requirement id. `validatorId` enters
     the assurance flow in exactly ONE place, `validatorResult` at completion, so that is the only sound seam.
     It is also stronger: it refuses the RESULT, not merely the intention to use the validator.
2. **`DEGRADED` does NOT refuse.** §35 says selection *considers* availability — a degraded validator is impaired,
   not withdrawn, and refusing it would be stronger than the corpus states. It is surfaced, not barred. **Stating
   the non-refusal explicitly matters:** it is the difference between implementing §35 and over-implementing it.
3. **The read-model — MEASURED, AND F-29 DOES NOT APPLY HERE.** A new engine refusal the projection is not told
   about is F-29, and I created the sixth instance that way earlier the same day, so this was checked before
   anything was built rather than after.
   - **There is no affordance to withhold.** F-29's invariant is *"no affordance the engine would reject"*.
     Gate D refuses at `CompleteAssuranceAssessment`, and **no UI surface offers that click keyed to a validator**:
     the one production caller is a fixed demo action that runs a whole assessment sequence with a hardcoded
     `validatorId: 'workbench.demo-signoff'`, which is never registered — so the fail-open covers it and the
     engine refuses nothing a user can click.
   - **Building the limb anyway would be the disease, not the cure.** An affordance filter for a click nobody
     offers is a control that cannot fire, which is what this register spends its time deleting.
   - **THE CONDITION UNDER WHICH IT BECOMES REQUIRED, stated so a future author does not read this as an
     oversight:** the moment any production path (a) registers a validator that (b) a user-triggered action then
     names in a `validatorResult`, the affordance must consult status — same kernel/decision split as the retry
     cap and §36. Recorded here rather than discovered as F-29's seventh instance.

## 6. What this deliberately does not do

- **No validator SELECTION algorithm.** §35's eight considerations (cost, latency, domain competence…) are a
  ratified list of inputs, not a ranking. Building a scorer would invent the weighting the corpus withholds.
- **No auto-degradation.** See §4 — and a rule that degrades a validator on one timeout is a policy nobody
  ratified.
- **No §34.4 tie-breaking.** *"Conflicting validator implementations"* is a real ratified section and a different
  subsystem; it needs conflicting assessments to exist first.

## 7. What would make this design wrong

1. **If `DEGRADED` is meant to bar selection**, consumer 2 is too weak — though the failure mode is visible
   (a degraded validator gets selected) rather than silent.
2. **If the sponsor wants degradation derived rather than declared**, §4's separate-act choice is wrong; the
   arrows survive, only the trigger changes.
