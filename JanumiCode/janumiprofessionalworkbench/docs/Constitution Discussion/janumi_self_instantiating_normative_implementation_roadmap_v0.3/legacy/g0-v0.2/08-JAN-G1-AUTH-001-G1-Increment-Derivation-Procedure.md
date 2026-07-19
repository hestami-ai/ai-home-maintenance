# JAN-G1-AUTH-001 — G1 Increment Derivation Procedure

**Version:** 0.1  
**Status:** Controlled next-step procedure; not implementation authorization

## 1. Purpose

After G0 acceptance, this procedure derives the first bounded increment under `G1 — Executable Semantic Contract`.

G1 shall not begin as one request to implement the complete CPCO, JSDL compiler, JanumiCode domain model, and all generators. The first increment shall be the smallest dependency-correct semantic kernel required by the first PWU vertical slice.

## 2. Required G0 inputs

- Accepted current-state architecture.
- Accepted requirement-assessment baseline.
- G1/G2 implementation references already present.
- Discrepancies affecting semantic contracts.
- Current frontend/backend type systems and contract-generation mechanisms.
- Approved bootstrap deviations.

## 3. Derivation sequence

1. Identify the first intended G3 PWU vertical-slice scenario.
2. Trace backward to the minimum semantic types required by that scenario.
3. Select the minimum identities, value objects, enums, entities, relationships, and lifecycle types.
4. Select only commands/events required to exercise and validate the generated contracts; authoritative execution remains G2.
5. Determine whether current handwritten contracts can be retained temporarily or must be replaced immediately.
6. Define JSDL parser/compiler support only for syntax used by the selected subset.
7. Define TypeScript and JSON Schema generator outputs.
8. Define deterministic, compatibility, semantic-boundary, and source-map tests.
9. Record excluded semantics and later increment dependencies.
10. Submit the increment specification for authorization.

## 4. Candidate first semantic subset

The actual subset shall be derived from G0, but it will usually include:

```text
EntityId
Version
Provenance
ParticipantReference
IntentReference
ProfessionalObjective
PwuScope
PwuLifecycleState
PwuCognitiveState
CompletionCondition
ProfessionalWorkUnit
selected relationship/reference forms
module/version metadata
```

The subset shall preserve semantic boundaries even when many later entities remain deferred.

## 5. Prohibited shortcuts

- Duplicating incompatible frontend and backend types.
- Encoding lifecycle or cognitive state through nullable fields.
- Calling a YAML-to-template script a semantic compiler without symbol, type, and semantic validation.
- Adding broad language features unrelated to the selected subset.
- Using current code structure as the sole basis for the ontology.
- authorizing G2 runtime mutation behavior inside a G1 contract-only increment without explicit dependency approval.

## 6. Required output

A completed `JAN-INC-001` specification with:

- stable increment ID;
- selected G1 requirements;
- current baseline references;
- exact JSDL syntax subset;
- exact generated artifacts;
- prohibited shortcuts;
- tests and evidence;
- exit criteria;
- approved deviations;
- acceptance authority.
