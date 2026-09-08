# ROADMAP — `JAN-EXECGOV`: the execution governance layer

**Design:** `DESIGN-execution-governance-layer.md` · **Date:** 2026-09-08

⛔ **`EG-02` and `EG-03` are GATED ON SPONSOR DECISION `G-1`** (grant to name capability vocabulary). Minting a
`RUNTIME_BINDING` requires naming a capability; a capability is a free string the corpus never defines, so
naming one is a ratification act that the schema will not stop. Nothing there starts until that is answered.

---

### `EG-01` — the breach is FILED, before anything is built  *(needs no grant)*

A register entry recording: `STA-8` is unmet on every production execution; `RequestRuntimeBinding` has zero
production dispatch sites with its positive control; both activation sites pass `authorizedRuntimeBindingIds:
[]`; the `OUT_OF_SCOPE` fall-through makes the four binding checks unreachable on real work; and ⭑ **the far
larger half — the carriers canon has deliberately left open, which must NOT be wired.**

⚠ This is filed FIRST and separately because the finding stands whether or not `G-1` is granted, and because a
standing breach of a ratified invariant should not wait on a build.

---

### `EG-02` — a step that runs has an authorized binding  *(gated on `G-1`)*

| Mutant | Must redden |
|---|---|
| mint the binding but never authorize it | `STA-8` — *"authorized* Runtime Bindings", not merely requested |
| leave `authorizedRuntimeBindingIds: []` while naming a binding on the step | ⚠ the withdrawn-limb trap: `REG-005` records that refusing on this list produced *"an UNRECOVERABLE WEDGE"* — the plan cannot be re-activated. Any use of the list must be reachable-from-here, and the test must prove a step can still start |
| name a capability the step does not need | the capability test — `N-20` refuses an empty request; an inflated one is the opposite failure and nothing catches it |
| **CONTROL** | a step with NO binding still starts — `OUT_OF_SCOPE` stays reachable, or every existing plan becomes unstartable (the disclosed reason the fall-through exists) |

---

### `EG-03` — the binding's four checks become REACHABLE, proved  *(gated on `G-1`)*

The point of `EG-02` is not the object; it is that `bindingAuthorityVerdict`'s live limbs stop being dead code.

| Mutant | Must redden |
|---|---|
| bind a step to a binding authorized for a DIFFERENT step | `WRONG_STEP` — currently unreachable in production |
| execute against a `REVOKED` binding | the revocation limb — §22.1: *"Revoked bindings cannot be used for new attempts"* |
| **CONTROL** | the happy path completes, so this is not "refuse every execution" |

---

### `EG-04` — a form key nobody can set stops widening governance  *(needs no grant)*

⚠ **RE-AIMED 2026-09-08 AFTER MEASURING — see `DESIGN` §5b.** This item was written to disclose *"eleven
settable-but-unread fields"*. Re-derived from code, the surface's live defect is the **inverse**: a form key with
a reader and **no control**, whose empty default is truthy and therefore passes every guard on the way to the
engine. `ASSURANCE_POLICY.applicableObjectTypes` — read at `policy-fields.ts:62`, emitted by no `.svelte` file
in this repository's history — makes every UI-authored policy universally applicable, driven and confirmed
against the engine (`NOT_APPLICABLE` → **`REQUIRED`** on a rename).

⛔ **AND THE ORIGINAL ITEM IS NOT SUPERSEDED BY IT.** Four adversarial readers refuted the tidy conclusion that
one census overturned the other: the two measure different populations, overlapping on **0 of 11 names**. The
disclosure work is real and moves to `EG-05`.

| Mutant | Must redden |
|---|---|
| restore `applicableObjectTypes: []` on the edit payload | the round-trip test — a rename must not change what a policy applies to. ⭑ The assertion is the **applicability outcome**, not the field: asserting the field alone passes on the day someone "fixes" it by writing `[]` into both places |
| swap the fixed guard back to bare truthiness (`f.x ? … : {}`) | the same test — this is the exact live shape, and `[]` is truthy |
| drop `applicability` from `successorPolicyPayload` | the successor test — versioning a kind-scoped policy must not unscope it. ⚠ This is a SECOND live path onto the same harm, and the one that destroys the `pwuKindConditions` arm that is currently the only reason the twelve catalog policies are safe |
| add a `form.get('newThing')` with no control | the surface gate below |
| **CONTROL** | a policy whose scope the author never touches keeps it — the kernel's *"scope untouched by this edit"* limb (`assurance.ts:340`) must become REACHABLE, not merely present |
| **CONTROL** | `version` — a reader with no control whose default is FALSY — is left alone, so the gate is not "every unmatched key is a bug" |

⚠ **THE GATE'S REACH IS STATED, NOT CLAIMED AWAY.** The derivation that found these two is blind to five reader
idioms in this app (template-literal keys, a callback reader, a line-split `.getAll`, `getAll` itself, dynamic
`name={…}` emitters) and was right here **only by cancellation** — each blind spot paired a missed reader with a
missed emitter. The gate must either analyse the idiom or **DECLARE** it, in the recorded-fail-open shape
`SPEC-001-NF-32` requires; a silent skip is the defect one level up. Controls must prove it SEES the dynamic
pairs it declares.

---

### `EG-05` — the authoring surface stops presenting unread settings as control  *(needs no grant)*

⭑ The sponsor's own case, and `EG-04`'s original subject, now stated against measurement rather than against a
recorded list. Two shapes, and they need different remedies:

- **A control whose value nothing consults.** `ASSURANCE_POLICY.evaluatorRole` and policy `rationale` are
  stored, patchable, and compared by nothing; they clear "is it read?" only by being echoed back into the form
  that posted them. ⚠ **An echo is not a reader.**
- **A governed field with no control at all.** `applicableObjectTypes` after `EG-04` (the author still cannot
  set it), `version`, and the five `EG-04`-era names that are minted constants inside `policy-fields.ts`.

⛔ **The remedy is DISCLOSURE, not wiring** — several are legitimately descriptive, and `evaluationMethod`'s
absent reader is **already filed** (`REG-F-243`), so re-wiring it here would re-file a finding this register has
answered.

| Mutant | Must redden |
|---|---|
| add a settable field with no reader and no disclosure | the surface census — derived from the markup and the payloads, never hand-listed |
| **CONTROL** | a field that IS consulted needs no disclosure, so this is not "label everything" |

---

## ⛔ NOT TAKEN — and this is the larger half of the design

`modelSelectionPolicy` (configuration by `REG-D-052`), `ModelSelectionPolicy`'s shape (explicitly deferred),
`memoryPolicyId`, binding declared-vs-resolved model identity (**canon requires recording the resolved one and
never binds the two**), context selection beyond `DEC-4`'s constraint limb (doctrine, no invariant), and the
four activation-condition carriers (disclosed deferral, element types undefined in the corpus).

⭑ **Each would be an implementer inventing a rule the corpus declined to make.** The register already records
the deferral for most of them.

---

## Gates

**All five: check-types · lint · vitest · playwright · verif.**
