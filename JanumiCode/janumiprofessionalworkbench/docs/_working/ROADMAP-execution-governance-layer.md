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

### `EG-04` — the authoring surface stops presenting unread settings as control  *(needs no grant)*

⭑ The sponsor's own case: a human edits a field in the UI and nothing reads it. **The remedy is disclosure, not
wiring** — several of the eleven are legitimately descriptive, and some belong to deferred concerns.

| Mutant | Must redden |
|---|---|
| add a new settable field with no reader and no disclosure | the surface census — derived from the form and the command payloads, never hand-listed |
| **CONTROL** | a field that IS read needs no disclosure, so this is not "label everything" |

⚠ **Its reach is stated, not claimed away:** a static check sees whether a field has a production reader. It
cannot see whether the reader is *meaningful*. That limit goes in the gate's own header.

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
