# Janumi Semantic Definition Language (JSDL)

## JSDL Specification v0.1.0

**Document ID:** `JAN-JSDL-002`
**Version:** `0.1.0`
**Status:** Superseded
**Superseded by:** [`JAN-JSDL-001`](<Janumi Semantic Definition Language.md>)

This conceptual overview is retained for historical context. Use `JAN-JSDL-001` as the current JSDL core specification.

---

# 1. Purpose

The Janumi Semantic Definition Language (JSDL) is the canonical machine-readable definition of professional cognition.

It is the authoritative source from which platform artifacts are generated.

JSDL SHALL define:

* ontology;
* aggregate structure;
* commands;
* events;
* lifecycle models;
* state transitions;
* invariants;
* authority;
* projections;
* validators;
* observability metadata;
* UI semantics.

Implementations SHALL derive code from JSDL rather than duplicating semantic definitions across multiple technologies.

---

# 2. Design Principles

JSDL is:

* semantic before technical;
* declarative rather than imperative;
* strongly typed;
* versioned;
* extensible;
* domain independent;
* projection aware;
* event aware;
* validation aware.

JSDL is not:

* a persistence schema;
* an API definition;
* a UI description language;
* a workflow language.

Those are generated from JSDL.

---

# 3. Compilation Targets

A conforming JSDL compiler SHOULD be capable of generating:

## Domain Model

* strongly typed entities;
* value objects;
* enumerations;
* aggregate definitions.

## Persistence

* relational schema;
* migration scripts;
* graph schema;
* indexes.

## APIs

* REST/OpenAPI;
* GraphQL;
* gRPC;
* event contracts.

## Frontend

* TypeScript models;
* validation rules;
* form metadata;
* inspector metadata;
* projection metadata;
* command contracts.

## Agents

* tool contracts;
* command schemas;
* validator contracts;
* context schemas;
* completion contracts.

## Documentation

* human-readable reference;
* entity catalog;
* relationship catalog;
* lifecycle documentation;
* command reference.

---

# 4. Canonical Modules

Every JSDL model is organized into modules.

```text
Foundation
Ontology
Relationships
Aggregates
Commands
Events
Lifecycle
Validators
Projections
Observability
Security
PWA Extensions
```

Each module is independently versioned while remaining semantically compatible with the ontology.

---

# 5. Canonical Entity Structure

Every entity definition SHALL declare:

```text
identity
type
properties
relationships
invariants
lifecycle
commands
events
validators
projectionMetadata
```

The entity definition SHALL be sufficient to generate platform implementations without reintroducing semantic ambiguity.

---

# 6. Aggregate Definition

An aggregate definition SHALL specify:

* aggregate root;
* owned entities;
* referenced entities;
* command boundary;
* consistency boundary;
* optimistic concurrency policy;
* event emission rules;
* recomposition rules (where applicable).

This allows the generated implementation to preserve the transactional boundaries while remaining faithful to the semantic PWU defined in earlier specifications.

---

# 7. Command Definition

Each command SHALL define:

* semantic intent;
* required authority;
* preconditions;
* payload schema;
* affected aggregates;
* emitted events;
* failure conditions;
* postconditions.

Commands SHALL become generated backend contracts and frontend action metadata.

---

# 8. Event Definition

Every event SHALL declare:

* event identity;
* semantic meaning;
* originating command;
* payload;
* affected entities;
* versioning policy;
* observability category.

Events become the canonical integration surface for projections, analytics, synchronization, and downstream automation.

---

# 9. Projection Metadata

Entities SHALL include metadata describing their participation in projections.

Examples:

* visible in Understanding projection;
* editable in Reasoning workspace;
* summarized in Executive view;
* hidden from mobile by default;
* searchable by semantic query;
* shown in decomposition trees.

Projection metadata SHALL describe semantics, not presentation details such as pixel positions.

---

# 10. Validator Definitions

Validators SHALL be declared rather than handwritten wherever possible.

Validator categories include:

* structural;
* semantic;
* professional;
* coherence;
* governance;
* temporal.

Generated validators SHOULD cover structural rules automatically, while domain-specific professional validators MAY require handwritten implementation.

---

# 11. Observability Metadata

Entities, commands, and events SHALL identify:

* emitted metrics;
* trace boundaries;
* correlation identifiers;
* cognitive state transitions;
* reconciliation triggers.

This allows observability to be generated consistently across the platform.

---

# 12. PWA Extension Model

Professional Work Architectures SHALL extend—not replace—the canonical ontology.

For example:

```text
JanumiCode
  extends Representation
      with SourceCodeRepresentation

JanumiScience
  extends Evidence
      with ExperimentalResult

JanumiLegal
  extends Constraint
      with StatutoryConstraint
```

Extensions SHALL preserve CPCO invariants.

---

# 13. Versioning

Every JSDL definition SHALL be versioned.

Changes SHALL be classified as:

* additive;
* compatible refinement;
* deprecation;
* breaking semantic change.

Generated artifacts SHALL retain compatibility information.

---

# 14. Reference Toolchain

The long-term reference toolchain is envisioned as:

```text
JSDL Source
        │
        ▼
Semantic Compiler
        │
        ├────────► Platform Models
        ├────────► APIs
        ├────────► Events
        ├────────► UI Metadata
        ├────────► Validators
        ├────────► Documentation
        ├────────► Test Fixtures
        └────────► Agent Contracts
```

The semantic compiler becomes one of the foundational components of the Janumi Platform.

---

# 15. Engineering Consequences

Once JSDL exists, the platform no longer has multiple competing definitions of professional work.

Instead:

* the ontology defines meaning;
* aggregates define transactional boundaries;
* commands define professional actions;
* events define history;
* projections define user experience;
* validators define correctness.

All are generated from a single semantic source.

This dramatically reduces drift between documentation, implementation, APIs, user interfaces, and AI agents.

---

# 16. Immediate Next Work

The next implementation effort should no longer be another conceptual document.

Instead, it should begin the reference implementation of the semantic compiler itself, starting with:

1. The JSDL grammar.
2. The abstract syntax tree (AST).
3. Semantic validation rules.
4. A TypeScript code generator.
5. A JSON Schema generator.
6. An OpenAPI generator.
7. A PostgreSQL schema generator.
8. A frontend metadata generator.

At that point, Janumi transitions from being a documented architecture to a self-describing, generative platform whose semantics are executable.
