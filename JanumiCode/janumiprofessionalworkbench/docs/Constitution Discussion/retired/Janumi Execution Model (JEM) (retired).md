# Janumi Execution Model (JEM)

**Document ID:** `JAN-JEM-002`
**Version:** `0.1.0`
**Status:** Superseded
**Repository disposition:** Retired historical record
**Superseded by:** [`JAN-JEM-001`](<../Janumi Execution Model (JEM).md>)

This architectural overview is retained for historical context. Use `JAN-JEM-001` as the current Janumi Execution Model specification.

---

## Position in the Architecture

The Janumi Platform architecture is composed of five progressively more concrete layers:

```text
Professional Cognition Discipline
        │
        ▼
Canonical Professional Cognition Ontology (CPCO)
        │
        ▼
Janumi Semantic Definition Language (JSDL)
        │
        ▼
Janumi Execution Model (JEM)
        │
        ▼
Runtime Implementations
```

The Janumi Execution Model defines the invariant execution semantics that every runtime implementation SHALL preserve.

## Responsibilities

JEM specifies:

* command execution semantics;
* aggregate consistency semantics;
* event publication semantics;
* lifecycle execution semantics;
* validator execution order;
* projection refresh semantics;
* reconciliation scheduling;
* RPH execution lifecycle;
* agent execution contracts;
* transaction boundaries;
* concurrency guarantees;
* idempotency rules;
* authority evaluation timing;
* observability event emission;
* suspension and resumption semantics.

It intentionally does **not** specify:

* PostgreSQL versus another database;
* Temporal, DBOS, or another workflow engine;
* Kafka versus NATS;
* Kubernetes versus Docker;
* REST versus gRPC;
* cloud versus on-premises deployment.

Those belong to runtime profiles.

## Runtime Profiles

Each runtime becomes a profile implementing JEM.

Examples include:

### Single-Node Runtime

Designed for early-stage SaaS deployment.

Characteristics:

* PostgreSQL
* Event table
* Generated projections
* Single process or small service set
* Optimistic concurrency
* Local scheduler
* Docker deployment

### Enterprise Runtime

Characteristics:

* Distributed execution
* Horizontal scaling
* Partitioned projections
* High-availability event processing
* Enterprise identity integration
* Multiple agent pools

### Offline Runtime

Characteristics:

* Local authoritative cache
* Deferred synchronization
* Conflict detection
* Explicit reconciliation on reconnect

## Architectural Rule

Every runtime profile SHALL demonstrate conformance to the Janumi Execution Model.

The correctness of Janumi shall therefore depend upon preserving execution semantics, not upon any particular infrastructure technology.

This separation ensures that the Professional Cognition Discipline, the ontology, the semantic compiler, and the execution semantics remain stable even as deployment architectures evolve over time.
