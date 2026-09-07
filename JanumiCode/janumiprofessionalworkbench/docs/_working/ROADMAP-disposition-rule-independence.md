# ROADMAP — `JAN-DISPIND`: a disposition rule's independence demand is read

**Design:** `DESIGN-disposition-rule-independence.md` · **Date:** 2026-09-07

⭑ Discharges the item `limb:ASR-2:6` records as **owed**. Mints nothing; the field, the evaluator and the
authoring path all exist.

---

### `DI-01` — the demand is carried and CONJOINED

`requiredIndependence` survives the policy narrowing; the rule for the recommended disposition is matched with
the same predicate Gate C uses; every distinct declared requirement must hold.

**Predicted reds:**

| Mutant | Must redden |
|---|---|
| drop `requiredIndependence` from the narrowing | the inert-field test — `L4e`'s driven observation, reproduced: a rule demanding `DIFFERENT_AGENT` lets a same-agent SATISFIED through |
| ⛔ take "the strongest" of the two rather than both | the conjunction test — the requirements are ORTHOGONAL single-dimension checks, so picking one DROPS the other's dimension entirely |
| match the rule on a different predicate than Gate C | the same-rule test — two gates selecting different rules from one array is how a policy comes to mean two things |
| report a violation without naming which requirement failed | the reason test — a reason a reader cannot act on is `PER-9`'s silent omission one layer up |
| **CONTROL** | a policy with `independenceRequirement: 'NONE'` and NO disposition rule behaves exactly as today |
| **CONTROL** | the rule-level demand SATISFIED (distinct agents) still completes normally — this is not "refuse everything" |

---

### `DI-02` — filings

The REG-F `limb:ASR-2:6` names as owed, recording: the census with its positive control, the pre-driven `L4e`
observation, ⚠ **the correction to the recorded remedy** ("strongest" is undefined — the dimensions are
orthogonal, so the composition is conjunction), and ⛔ **the disclosure that this slice does not close the
`producer`-omission dodge.**

---

### ⛔ NOT TAKEN — put to the sponsor instead

The `producer`-omission fall-through. It is deliberate, reasoned and **pinned**
(`assurance-independence.test.ts:298`, *"the chosen gate"*). Overturning it changes behaviour, and it turns on
whether *unverified* counts as *not satisfied* under §8.4 — against §13.3's *"fail closed on missing identity"*,
which this same function already applies to a different operand. A sponsor question, with both readings stated
in `DESIGN` §4.

---

## Gates

**All five: check-types · lint · vitest · playwright · verif.**
