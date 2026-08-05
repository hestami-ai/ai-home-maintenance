# DESIGN — REG-F-022's other half: what the ontology authors on PWU TEMPLATES, and what reaches the runtime

**Date:** 2026-08-05 · **Status:** measured, ready to implement · **Follows:** REG-E-026 (`4801c889`), REG-F-032 (`20696b99`)

---

## 0. Why this exists, and a correction before anything else

REG-F-022's own notation says the finding is wider than the policies:

> *"Adversarial re-checking found the same field declared a second time, on the ontology's **`PwuTemplate`** type,
> with **14 further carriers** — equally unread. **26 authored declarations, none consumed.**"*

I closed the twelve on policies and left the templates. When I proposed picking this up I quoted "14 carriers"
— **from that notation, without re-measuring.**

**Measured: it is 7 authored keys, 5 of which reach nothing, across 64 declarations.** `requiredEvidenceTypes` is
one of five, not the whole of it. The estimate was low by about 4.5×.

That is the third time in two days that a number I repeated turned out to be a number nobody had checked
(REG-F-030 the corpus count, REG-F-032 the review's own measurements). **A count in a register entry is evidence
that someone once measured something; it is not evidence that it is still true, or that it was ever complete.**
The rule that follows: *re-measure on the way in, especially when the number is what justifies the work.*

## 1. The measurement

Authored on `pwuTemplates` (10 keys) vs delivered on the `DefinePwuType` payload (9 keys):

| Authored key | Carriers | Status |
|---|---|---|
| `pwuKind` | 15/15 | **DELIVERED** |
| `purpose` | 15/15 | **DELIVERED** |
| `isRoot` | 15/15 | **DELIVERED** |
| `defaultPolicyIds` | 15/15 | **TRANSFORMED** → `requiredAssurancePolicyIds` via `policiesForKind` |
| `sourceSection` | 15/15 | **ONTOLOGY-INTERNAL** — provenance about the transcription |
| `candidateChildren` | 8/15 | **REACHES NOTHING** |
| `completionClaims` | 14/15 | **REACHES NOTHING** |
| `inputs` | 14/15 | **REACHES NOTHING** |
| `outputArtifactTypes` | 14/15 | **REACHES NOTHING** |
| `requiredEvidenceTypes` | 14/15 | **REACHES NOTHING** |

**64 authored declarations across five fields, consumed by nothing.** The engine's port type
(`EngineOntology.pwuTemplates`) declares exactly two members — `{ pwuKind, isRoot }` — so, precisely as with
`EngineSeedPolicy` and `requiredEvidenceTypes`, **no type error was ever available to report the drop.** Same
structural blindness, one object type over.

## 2. The sharp one: `candidateChildren` contradicts the tree that ships

`DefinePwuType`'s `permittedChildren` comes from a **hand-written `PWU_TYPES` list in `seed-workbench.ts`**, not
from the ontology. The two disagree:

- **Root agrees.** `PRODUCT_REALIZATION` authors 7 candidate children; the seed defines the same 7.
- **`ARCHITECTURE_DEFINITION` diverges outright.** The ontology authors **ten** candidates (`SYSTEM_CONTEXT`,
  `ARCHITECTURE_DRIVER`, `COMPONENT_ARCHITECTURE`, `DATA_ARCHITECTURE`, `INTEGRATION_ARCHITECTURE`,
  `SECURITY_ARCHITECTURE`, `DEPLOYMENT_ARCHITECTURE`, `OBSERVABILITY_ARCHITECTURE`, `OPERATIONAL_RESILIENCE`,
  `ARCHITECTURE_DECISION_CONSOLIDATION`). The seed defines **one** child — `ARCHITECTURE_CONCERN` — **which is not
  among the ten.**
- **Six further templates author candidates and get none:** `INTENT_AND_PRODUCT_DEFINITION` (8),
  `PRODUCT_BEHAVIOR_DEFINITION` (8), `USER_JOURNEY_DEFINITION` (1), `IMPLEMENTATION_PLANNING` (9),
  `PRODUCT_IMPLEMENTATION` (10), `INTEGRATED_PRODUCT_VALIDATION` (10).

The comment above `policiesForKind` says these lists *"used to be written by hand on `PWU_TYPES` — a THIRD copy of
content the ontology already carries"*, and fixed the policy list. **The composition list is the copy that was not
fixed**, and it is the one that disagrees.

## 3. Why this must NOT be closed by wiring it

**62 distinct candidate child kinds are authored. 50 of them have no `pwuTemplate` row at all.**

A kind with no template has no `defaultPolicyIds`, and `requireGoverningPolicies` **throws** on an undescribed kind
(REG-F-029). So deriving `permittedChildren` from `candidateChildren` would publish a PWA whose tree offers 50
child types that **cannot be assessed and cannot be driven** — trading an inert field for 50 unusable affordances.
It is also REG-F-028's finding one level up: *a PWU-kind vocabulary the seeded work does not speak*, now in a third
place.

**And which composition structure the reference PWA publishes is a governance decision, not a wiring one.** The
field is even named `candidateChildren` — candidates, from which a PWA author selects. Selecting all 62 by
construction would be an authoring act performed by a `.map()`.

## 4. What this increment therefore delivers

**The measurement, as a standing gate — not the wiring.** Exactly the shape that worked for policies:

1. **Extend `ontology-delivery-census.test.ts` to `pwuTemplates`.** It walks `seedPolicies` only, which is why 64
   declarations sat outside the instrument built to find precisely this. *A field is not safe because the census is
   quiet about it; it may be below the census's floor* — the lesson REG-E-025 produced when two `failureClass`
   fields turned out to be invisible to the enumRef census the same way.
2. **Account for the two that are legitimately routed** (`defaultPolicyIds` TRANSFORMED, `sourceSection` internal),
   with the same rule the policy census enforces: an exemption must name a field the ontology actually authors and
   must not name one that IS delivered. *"Not yet" is not a route.*
3. **Pin the five that reach nothing as a KNOWN GAP with its count**, so the number can only fall, and file the
   finding rather than fixing it by construction.
4. **Assert the `candidateChildren` divergence explicitly**, because a census that only counted "unread fields"
   would report it as one inert field among five and hide that it *contradicts* the shipped tree.

## 5. What is deliberately not done

- **No `candidateChildren` wiring.** §3.
- **No template evidence requirements.** `requiredEvidenceTypes` on a template is not an `EvidenceRequirement`; it
  is the same 2–3 value summary REG-E-026 superseded on policies, and a template is not a policy — nothing in
  DOC-004 §6.1 gives a PWU *type* required evidence. Delivering it needs a consumer that does not exist and a
  ratified home that has not been named.
- **No `PWU_TYPES` de-duplication.** Deriving the seed's composition tree from the ontology is the same governance
  act as §3, approached from the other side.

## 6. What would make this design wrong

1. **If `candidateChildren` is meant as a menu rather than a specification**, then the seed selecting a subset is
   correct and only the *unread-ness* is the finding — but the `ARCHITECTURE_DEFINITION` row still diverges, since
   its one shipped child is not in the menu at all.
2. **If a consumer for `inputs` / `outputArtifactTypes` / `completionClaims` exists somewhere I did not search**,
   the count is wrong. It is derived by the census from live interception rather than asserted here, so it will say
   so — which is the whole point of measuring instead of quoting.
