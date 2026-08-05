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

1. **`selectAssuranceEvaluator` REFUSES a `DISABLED` validator.** §35 makes availability a selection input and
   §34.1 requires an *alternate* implementation be choosable; selecting a withdrawn validator defeats both.
2. **`DEGRADED` does NOT refuse.** §35 says selection *considers* availability — a degraded validator is impaired,
   not withdrawn, and refusing it would be stronger than the corpus states. It is surfaced, not barred. **Stating
   the non-refusal explicitly matters:** it is the difference between implementing §35 and over-implementing it.
3. **The read-model must know.** A new engine refusal that the projection is not told about is F-29, and this
   session created the sixth instance exactly that way. The evaluator affordance withholds `DISABLED` validators
   with the same kernel/decision split used for the retry cap and §36.

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
