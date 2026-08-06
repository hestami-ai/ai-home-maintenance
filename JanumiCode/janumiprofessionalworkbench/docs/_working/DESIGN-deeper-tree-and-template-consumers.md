# DESIGN — a deeper PWA composition tree, and consumers for the template fields

**Date:** 2026-08-06 · **Status:** measured, ready to implement · **Closes:** REG-F-033's substance
**Authority:** sponsor direction 2026-08-06 — *"take the PWA composition tree and make it deeper"*, *"the five
undelivered template fields should have consumers"*, *"keep the reference undertaking and keep auto-seeding it"*.

---

## 1. The finding that reframes the work: the consumers ALREADY EXIST

I described these as fields "needing consumers". Measured, **four of the five have ratified homes on `PWU_TYPE`
already**, and `DefinePwuType` already accepts them — every one optional, every one unpopulated:

| Ontology `pwuTemplates` field | Ratified `PWU_TYPE` home | On `DefinePwuType`? |
|---|---|---|
| `candidateChildren` | `permittedChildren` / `permittedChildTypeIds` | yes (optional) |
| `inputs` | `requiredInputs: string[]` | yes (optional) |
| `outputArtifactTypes` | `requiredOutputs: string[]` | yes (optional) |
| `completionClaims` | `completionRule: string` | yes (optional) |
| `defaultPolicyIds` | `requiredAssurancePolicyIds` | **already delivered** |

**So this is REG-F-022's shape a third time:** the content is authored, the consumer is ratified, and the wire is
missing. Not a design problem — a delivery one. The census called them "reaching nothing" and was right; what it
could not say is that they had somewhere to reach all along.

**`requiredEvidenceTypes` is the exception and is SUPERSEDED, not homeless.** `PWU_TYPE` has no evidence field, and
it should not gain one: DOC-004 §6.1 makes evidence requirements a property of **policies**, and a type already
names its policies. The template's 2–4 value summary duplicates, at lower resolution, what those policies' §6.1
requirements now state in 89 items (REG-E-026). Its accounting route is therefore real and checkable — the
template's types must be a subset of the union its policies require — rather than "not yet".

## 2. The deepening, and its honest ceiling

The ontology authors **63 candidate child kinds**; **50 have no `pwuTemplate`**. A kind with no template has no
`defaultPolicyIds`, and `requireGoverningPolicies` throws on an undescribed kind (REG-F-029) — so publishing those
50 would mint child types that cannot be assessed or driven.

**The deepening is therefore `candidateChildren ∩ templates`, which is real and takes the tree from 9 types to
15:**

```
PRODUCT_REALIZATION
├── INTENT_AND_PRODUCT_DEFINITION
│     ├── INTENT_DISCOVERY            ← new
│     └── PRODUCT_BOUNDARY            ← new
├── PRODUCT_BEHAVIOR_DEFINITION
│     ├── USER_JOURNEY_DEFINITION     ← new
│     └── REQUIREMENT_DEFINITION      ← new
├── ARCHITECTURE_DEFINITION
│     └── ARCHITECTURE_CONCERN
├── IMPLEMENTATION_PLANNING
│     └── WORK_DECOMPOSITION          ← new
├── PRODUCT_IMPLEMENTATION
├── INTEGRATED_PRODUCT_VALIDATION
└── PRODUCT_BASELINE_PROMOTION
```

Three levels instead of two, and **`ARCHITECTURE_DECISION`** (the 15th template) becomes publishable but is named
as nobody's candidate child — recorded rather than parented by guess.

**The 50 stay out, and the census keeps pinning them.** Deepening is not the same as completing, and conflating
the two would let "the tree got deeper" stand in for "the ontology is now coherent".

## 3. A twin the deepening exposes

Three of the six new kinds declare a policy whose `appliesToPwuKinds` does not name them:

| Kind | Declares | Policy's scope says |
|---|---|---|
| `INTENT_DISCOVERY` | `pol_assumption_disclosure` | parent `INTENT_AND_PRODUCT_DEFINITION` yes, this no |
| `USER_JOURNEY_DEFINITION` | `pol_intent_preservation` | parent `PRODUCT_BEHAVIOR_DEFINITION` yes, this no |
| `REQUIREMENT_DEFINITION` | `pol_intent_preservation` | parent `PRODUCT_BEHAVIOR_DEFINITION` yes, this no |

**In all three the PARENT is listed and the CHILD is not** — `appliesToPwuKinds` was authored against the NINE
PUBLISHED kinds, so the six unpublished templates were outside its author's field of view. Both lists are
`AUTHORED`; they state one fact ("policy P governs kind K") in two places, and they have drifted.

**Resolution: widen the policy scope, never narrow the type's declaration.** Narrowing would silently exempt work
from assurance — the direction REG-F-024 names as forbidden. And the two lists get a **bidirectional gate**, so
they cannot part again. Deliberately not derived one from the other: they are hand-authored governance data, and
deriving would make the agreement a tautology rather than a check.

## 4. `completionClaims` → `completionRule` is lossy, and says so

`completionClaims` is `string[]` (8 sentences for architecture); `completionRule` is a required `string`. The
transformation is a **conjunction** — a completion rule over claims is exactly "all of these hold" — rendered as
an explicit list so no claim is dropped. Recorded as TRANSFORMED with its rule, not as a verbatim delivery.

## 5. What this deliberately does not do

- **No templates for the 50 orphan kinds.** Each would need an authored purpose and policy set with no corpus
  basis — 50 invented governance objects to make one census number look better.
- **No parent for `ARCHITECTURE_DECISION`.** It has a template and no candidate-child citation; guessing one is
  authoring composition structure the ontology declined to state.
- **No new PWU_TYPE field for `requiredEvidenceTypes`.** §6.1 puts evidence on policies; adding a type-level twin
  would recreate the drift this design is removing.
