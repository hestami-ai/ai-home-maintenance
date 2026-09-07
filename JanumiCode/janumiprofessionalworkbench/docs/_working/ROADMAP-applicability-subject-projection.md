# ROADMAP — `JAN-APPLSUBJ`: the applicability subject carries what the rule can ask about

**Design:** `DESIGN-applicability-subject-projection.md` · **Date:** 2026-09-07

⭑ No sponsor decision gates this. It mints nothing, changes no ratified meaning, and repairs a supply path to a
reader that already works.

---

### `AS-01` — one projector, in the kernel that owns the type

`applicabilitySubjectFrom(state)` in `rph-domain`, beside `ApplicabilitySubject`. Both call sites use it.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| drop `riskProfile` from the projector | the risk test — `RISK_AT_LEAST` reads `false` for a subject that HAS a profile |
| pass `riskProfile` through when it is absent (as `undefined`) | the absence test — a key present-and-undefined is not the same as absent, and `EXISTS` would then answer wrongly |
| project a PWA's missing profile as an empty object | the PWA control — a risk-gated policy must be `NOT_APPLICABLE` to a subject with no risk, and `{}` would make it undecidable-looking |
| **CONTROL** | `objectType`, `pwuKind` and `tags` still project exactly as before — this is an ADDITION, and every existing applicability verdict is unchanged |

---

### `AS-02` — both call sites use it, and a third cannot forget

`handlers/assurance.ts` and `governing-policies.ts` call the projector rather than building the object inline.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| revert one site to an inline literal | ⭑ the duplication test — asserted by SOURCE, because the defect was that two sites diverged from one type and a behavioural test cannot see a third site that does not exist yet |
| **CONTROL** | the two sites produce the same subject for the same state |

⚠ **The source-level assertion is deliberate and its limit is stated:** it pins that no call site builds the
subject inline. It cannot pin a site nobody has written. That is the honest reach of a static check, and it is
recorded rather than claimed away.

---

### `AS-03` — filings

Register entry recording: the measurement, ⚠ **the correction to the triage's overstatement** (latent, not
live — no executable risk gate exists; the HIGH_ASSURANCE "gate" is prose in a description string), and the
`riskConditions` dissolution with the kernel's own disclosure quoted.

⛔ **NOT taken:** wiring `riskConditions` (activation ≠ scope; element type undefined in the corpus); authoring
a risk-gated policy to make the path fire; changing `RISK_AT_LEAST`'s `false`-on-absence.

---

## Gates

**All five: check-types · lint · vitest · playwright · verif.**
