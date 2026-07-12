# Janumi Professional Workbench Recursive Professional Harness

## Persistence, Migration, Dual-Run, and Cutover Design

**Document ID:** `RPH-DOC-009`
**Status:** Initial implementation baseline
**Applies to:** Migration of the legacy hardcoded Product Lens orchestrator
**Initial scope:** Intent-to-Architecture-Baseline vertical slice
**Target datastore:** PostgreSQL-compatible relational database
**Architectural pattern:** Transactional domain model, append-only domain events, transactional outbox, rebuildable read projections
**Primary migration objective:** Establish the RPH as the sole authoritative semantic model for Product Realization Undertakings without disrupting existing legacy Product Lens dialogues

---

# 1. Purpose

This specification defines how Janumi Professional Workbench will persist, migrate, operate, and cut over from the legacy phase-based Product Lens execution architecture to the Product Realization PWA and its Undertakings on the Recursive Professional Harness.

It covers:

* relational persistence;
* aggregate storage;
* domain-event storage;
* transactional outbox;
* command idempotency;
* optimistic concurrency;
* object versioning;
* artifact and evidence storage;
* read projections;
* compatibility projections;
* legacy-data migration;
* shadow execution;
* dual-run comparison;
* cutover;
* rollback;
* archival;
* auditability;
* retention;
* operational recovery.

The central migration rule is:

> At every migration stage, exactly one representation may be authoritative for professional semantic state.

The legacy `workflow_state` and legacy phase enum may remain available for compatibility, display, and fallback. They must not remain an independently writable semantic state machine after the RPH becomes authoritative.

---

# 2. Migration Problem

The legacy Product Lens stores and executes professional progress primarily through:

* a hardcoded legacy phase enum;
* legacy phase-specific executor functions;
* a central orchestrator;
* legacy dialogue state;
* legacy workflow-state records;
* legacy validator outputs;
* assumptions and claims;
* human gates;
* generated artifacts;
* repository operations.

The new RPH separates:

* professional work;
* execution state;
* assurance state;
* shape-integrity state;
* governance;
* baselines;
* presentation milestones.

Without a controlled migration, the system could produce contradictory states such as:

```text
Legacy Execution Workflow:
ARCHITECTURE = COMPLETE

RPH:
Architecture execution = SUCCEEDED
Architecture assurance = REJECTED
Architecture PWU = UNDER_ASSURANCE
```

That contradiction cannot be solved by selecting whichever value is more convenient.

The architecture must define:

* which state is authoritative;
* which state is derived;
* when legacy writes stop;
* how existing legacy dialogues are handled;
* how fallback works without reintroducing dual authority.

---

# 3. Persistence Principles

## 3.1 Relational state is canonical

Canonical RPH objects are stored in normalized relational tables.

JSON is permitted for:

* versioned PWA or domain extensions;
* policy expressions;
* structured model output;
* event payloads;
* immutable snapshot payloads.

Core semantic relationships must not exist only inside opaque JSON.

## 3.2 Domain events are append-only

Accepted semantic changes produce immutable domain events.

Events support:

* audit;
* reconstruction;
* projection rebuilding;
* causality;
* debugging;
* migration comparison;
* future analytics.

Events are not the only storage of current state in the initial implementation. Current aggregate tables are maintained transactionally for efficient command processing.

## 3.3 Current state and history are distinct

Current aggregate tables answer:

> What is authoritative now?

Domain events and version tables answer:

> How did it become authoritative?

## 3.4 Read projections are disposable

Work, Execution, Assurance, Traceability, and Compatibility views are derived read models.

They may be:

* rebuilt;
* delayed;
* optimized;
* denormalized;
* independently versioned.

They must not become authoritative write targets.

## 3.5 Semantic and presentation persistence are separate

Canvas layout, collapse state, zoom, filters, and user preferences are stored separately from professional semantics.

## 3.6 Artifacts are content-addressable where practical

Large or file-based artifacts are stored outside core semantic rows.

The database stores:

* artifact identity;
* URI or storage key;
* media type;
* size;
* content hash;
* semantic version;
* producing execution;
* security classification;
* retention class.

## 3.7 All write paths are command-driven

Canonical state must not be mutated through unrestricted CRUD from the UI or orchestration code.

Writes occur through:

* authenticated commands;
* invariant enforcement;
* aggregate mutation;
* domain events.

---

# 4. Recommended Database Topology

The initial implementation may use one PostgreSQL database and one logical schema:

```text
janumi_rph
```

Recommended namespaces:

```text
rph_core
rph_execution
rph_assurance
rph_governance
rph_events
rph_projection
rph_legacy
```

Physical PostgreSQL schemas are optional initially, but the logical separation should be preserved in table naming and service ownership.

A single database simplifies:

* transactional consistency;
* event and outbox atomicity;
* migration;
* local VS Code deployment;
* backup and recovery.

The architecture should not depend on cross-service distributed transactions.

---

# 5. Common Database Conventions

## 5.1 Primary keys

Use:

```sql
id text primary key
```

The application generates prefixed UUIDv7 or ULID identifiers.

Database-generated integer IDs should not be the canonical external identity.

## 5.2 Time

Use:

```sql
timestamptz
```

All application timestamps are UTC.

## 5.3 Version fields

Canonical semantic tables include:

```sql
semantic_version integer not null
revision bigint not null
```

`revision` is used for optimistic concurrency.

`semantic_version` identifies meaning-bearing changes.

## 5.4 Soft deletion

Canonical professional objects are not hard deleted after they have participated in:

* execution;
* assurance;
* governance;
* baselines;
* traceability.

Use lifecycle statuses such as:

* `SUPERSEDED`;
* `WITHDRAWN`;
* `ABANDONED`;
* `REVOKED`.

## 5.5 JSON columns

Use `jsonb` only when:

* the field is schema-versioned;
* validation occurs before persistence;
* relational querying is not central;
* the JSON does not hide authoritative cross-object relationships.

## 5.6 Naming

Use snake_case for SQL.

Use explicit foreign-key names and check constraints.

---

# 6. Canonical Object Registry

All Professional Work Objects should have one registry row.

```sql
create table professional_work_objects (
    id text primary key,
    object_type text not null,
    schema_version integer not null,
    semantic_version integer not null,
    revision bigint not null,

    lifecycle_status text not null,

    extension_schema_id text,
    extension_schema_version text,

    created_at timestamptz not null,
    created_by_actor_id text not null,
    updated_at timestamptz not null,
    updated_by_actor_id text not null,

    provenance jsonb not null,
    tags jsonb not null default '[]'::jsonb,
    extensions jsonb not null default '[]'::jsonb,

    constraint uq_pwo_revision unique (id, revision),
    constraint chk_pwo_semantic_version
        check (semantic_version >= 1),
    constraint chk_pwo_revision
        check (revision >= 1)
);
```

Purpose:

* global identity;
* common metadata;
* generic traceability;
* generic version checks;
* cross-type queries.

Type-specific tables use the same ID as a foreign key and primary key.

---

# 7. Object Version History

Material revisions are retained.

```sql
create table professional_work_object_versions (
    object_id text not null
        references professional_work_objects(id),
    revision bigint not null,
    semantic_version integer not null,

    object_type text not null,
    lifecycle_status text not null,

    serialized_state jsonb not null,
    state_hash text not null,

    changed_at timestamptz not null,
    changed_by_actor_id text not null,
    change_event_id text not null,
    change_reason text,

    primary key (object_id, revision)
);
```

The version table supports:

* forensic review;
* semantic diff;
* decision version binding;
* baseline reconstruction;
* migration comparison.

It is not a substitute for domain events.

---

# 8. PWA, Undertaking, and Core Work Tables

## 8.1 Professional Work Architectures

Each published PWA version has stable identity and an immutable version binding.

```sql
create table professional_work_architectures (
    id text primary key
        references professional_work_objects(id),

    pwa_key text not null,
    pwa_version text not null,
    name text not null,
    status text not null,

    definition jsonb not null,

    constraint uq_pwa_version
        unique (pwa_key, pwa_version)
);
```

## 8.2 PWU Types

A PWU Type belongs to one PWA version. It is a reusable definition, not concrete work.

```sql
create table pwu_types (
    id text primary key
        references professional_work_objects(id),

    pwa_id text not null
        references professional_work_architectures(id),
    pwu_type_key text not null,
    parent_pwu_type_id text
        references pwu_types(id),

    name text not null,
    definition jsonb not null,
    status text not null,

    constraint uq_pwu_type_per_pwa
        unique (pwa_id, pwu_type_key)
);
```

## 8.3 Undertakings

An Undertaking is concrete professional work bound to an explicit PWA version.

```sql
create table undertakings (
    id text primary key
        references professional_work_objects(id),

    title text not null,
    objective text not null,

    pwa_id text not null
        references professional_work_architectures(id),
    pwa_version text not null,

    undertaking_status text not null
);
```

The service must verify that `undertakings.pwa_version` equals the immutable version identified by `pwa_id`. A later PWA publication does not silently alter an existing Undertaking.

The Undertaking's PWU Instances and their typed relationships form its Professional Work Graph. That graph is not stored or governed as an Execution Workflow document; it is reconstructed from the Undertaking-owned semantic objects and relationships.

## 8.4 Intents

```sql
create table intents (
    id text primary key
        references professional_work_objects(id),

    undertaking_id text not null
        references undertakings(id),

    originating_expression text not null,
    formalized_objective text,

    intent_status text not null,
    parent_intent_id text
        references intents(id),
    supersedes_intent_id text
        references intents(id),

    desired_outcomes jsonb not null default '[]'::jsonb,
    success_conditions jsonb not null default '[]'::jsonb,
    non_goals jsonb not null default '[]'::jsonb,

    constraint_ids jsonb not null default '[]'::jsonb,
    ambiguity_ids jsonb not null default '[]'::jsonb,
    stakeholder_ids jsonb not null default '[]'::jsonb
);
```

```sql
create index idx_intents_undertaking
    on intents(undertaking_id);
```

The initial implementation may retain lists inside validated JSON, but relationships used for impact analysis should eventually have normalized link tables.

## 8.5 Professional Work Unit Instances

Rows in `professional_work_units` are PWU Instances belonging to an Undertaking. A reusable PWU Type is stored separately in `pwu_types`.

```sql
create table professional_work_units (
    id text primary key
        references professional_work_objects(id),

    pwu_kind text not null,
    title text not null,
    description text not null,

    undertaking_id text not null
        references undertakings(id),
    pwu_type_id text
        references pwu_types(id),
    is_local_extension boolean not null default false,

    intent_id text not null
        references intents(id),
    parent_work_unit_id text
        references professional_work_units(id),

    boundaries jsonb not null,
    risk_profile jsonb not null,

    work_lifecycle_state text not null,
    execution_state text not null,
    assurance_state text not null,
    shape_integrity_state text not null,

    active_execution_plan_id text,
    current_baseline_id text,

    constraint chk_pwu_type_or_local_extension
        check (
            (pwu_type_id is not null and is_local_extension = false)
            or
            (pwu_type_id is null and is_local_extension = true)
        )
);
```

Recommended indexes:

```sql
create index idx_pwu_parent
    on professional_work_units(parent_work_unit_id);

create index idx_pwu_undertaking
    on professional_work_units(undertaking_id);

create index idx_pwu_type
    on professional_work_units(pwu_type_id);

create index idx_pwu_intent
    on professional_work_units(intent_id);

create index idx_pwu_lifecycle
    on professional_work_units(work_lifecycle_state);

create index idx_pwu_assurance
    on professional_work_units(assurance_state);

create index idx_pwu_shape_integrity
    on professional_work_units(shape_integrity_state);
```

An Undertaking-local PWU uses `is_local_extension = true` and no `pwu_type_id`; it does not mutate the selected PWA.

For a non-local PWU Instance, the service must verify that the referenced PWU Type belongs to the same immutable PWA version selected by the owning Undertaking.

## 8.6 Obligations

```sql
create table obligations (
    id text primary key
        references professional_work_objects(id),

    statement text not null,
    obligation_type text not null,
    source_object_id text not null
        references professional_work_objects(id),

    authority jsonb not null,
    strength text not null,
    status text not null
);
```

## 8.7 PWU obligation allocations

```sql
create table pwu_obligation_allocations (
    parent_pwu_id text not null
        references professional_work_units(id),
    child_pwu_id text
        references professional_work_units(id),
    obligation_id text not null
        references obligations(id),

    allocation_type text not null,
    rationale text,

    created_at timestamptz not null,
    created_by_actor_id text not null,

    primary key (
        parent_pwu_id,
        obligation_id,
        child_pwu_id,
        allocation_type
    )
);
```

`allocation_type` includes:

* `ALLOCATED`;
* `RETAINED`;
* `SATISFIED`;
* `WAIVED`.

## 8.8 Constraints

```sql
create table constraints (
    id text primary key
        references professional_work_objects(id),

    statement text not null,
    constraint_type text not null,
    authority jsonb not null,
    applicability jsonb not null,
    strength text not null,
    status text not null
);
```

## 8.9 Constraint propagation

```sql
create table constraint_propagations (
    constraint_id text not null
        references constraints(id),
    source_object_id text not null
        references professional_work_objects(id),
    target_object_id text not null
        references professional_work_objects(id),

    disposition text not null,
    rationale text,
    authority_decision_id text,

    created_at timestamptz not null,

    primary key (
        constraint_id,
        source_object_id,
        target_object_id
    )
);
```

## 8.10 Assumptions

```sql
create table assumptions (
    id text primary key
        references professional_work_objects(id),

    statement text not null,
    basis text,

    introduced_by jsonb not null,
    materiality text not null,
    status text not null,

    verification_method text,
    expiration_condition text,
    expires_at timestamptz
);
```

## 8.11 Assumption impact links

```sql
create table assumption_impacts (
    assumption_id text not null
        references assumptions(id),
    affected_object_id text not null
        references professional_work_objects(id),

    impact_type text not null,
    rationale text,

    primary key (
        assumption_id,
        affected_object_id
    )
);
```

---

# 9. Decomposition and Recomposition Tables

## 9.1 Decomposition contracts

```sql
create table decomposition_contracts (
    id text primary key
        references professional_work_objects(id),

    parent_work_unit_id text not null
        references professional_work_units(id),

    rationale text not null,
    recomposition_contract_id text,

    status text not null
);
```

## 9.2 Decomposition children

```sql
create table decomposition_children (
    decomposition_contract_id text not null
        references decomposition_contracts(id),
    child_work_unit_id text not null
        references professional_work_units(id),

    ordinal integer,
    primary key (
        decomposition_contract_id,
        child_work_unit_id
    )
);
```

## 9.3 Coverage claims

```sql
create table decomposition_coverage_claims (
    decomposition_contract_id text not null
        references decomposition_contracts(id),
    claim_id text not null,

    coverage_type text not null,
    rationale text not null,

    primary key (
        decomposition_contract_id,
        claim_id
    )
);
```

## 9.4 Recomposition contracts

```sql
create table recomposition_contracts (
    id text primary key
        references professional_work_objects(id),

    parent_work_unit_id text not null
        references professional_work_units(id),

    parent_completion_claim_id text not null,
    aggregation_rules jsonb not null,
    conflict_resolution_rules jsonb not null,

    status text not null
);
```

---

# 10. Execution Tables

## 10.1 Execution plans

```sql
create table execution_plans (
    id text primary key
        references professional_work_objects(id),

    work_unit_id text not null
        references professional_work_units(id),

    plan_version integer not null,
    status text not null,

    retry_policy jsonb not null,
    tactical_change_policy jsonb not null,
    escalation_policy jsonb not null,
    termination_policy jsonb not null,

    constraint uq_execution_plan_version
        unique (work_unit_id, plan_version)
);
```

Enforce one active plan per PWU:

```sql
create unique index uq_active_execution_plan_per_pwu
    on execution_plans(work_unit_id)
    where status = 'ACTIVE';
```

## 10.2 Execution steps

```sql
create table execution_steps (
    id text primary key,

    execution_plan_id text not null
        references execution_plans(id),

    step_type text not null,
    purpose text not null,

    ordinal integer,
    step_state text not null,

    input_bindings jsonb not null,
    output_bindings jsonb not null,
    preconditions jsonb not null,
    postconditions jsonb not null,

    runtime_binding_id text
);
```

## 10.3 Execution transitions

```sql
create table execution_transitions (
    id text primary key,

    execution_plan_id text not null
        references execution_plans(id),

    source_step_id text
        references execution_steps(id),
    target_step_id text
        references execution_steps(id),

    condition_expression jsonb,
    transition_type text not null
);
```

## 10.4 Execution attempts

```sql
create table execution_attempts (
    id text primary key,

    execution_step_id text not null
        references execution_steps(id),

    attempt_number integer not null,
    state text not null,

    started_at timestamptz,
    completed_at timestamptz,

    runtime_binding_id text not null,
    idempotency_key text not null,

    external_operation_id text,
    reconciliation_state text,

    result jsonb,
    error jsonb,
    provenance jsonb not null,

    constraint uq_execution_attempt
        unique (execution_step_id, attempt_number),

    constraint uq_execution_idempotency
        unique (idempotency_key)
);
```

## 10.5 Runtime bindings

```sql
create table runtime_bindings (
    id text primary key
        references professional_work_objects(id),

    execution_step_id text not null
        references execution_steps(id),

    role_id text not null,
    model_selection_policy jsonb not null,

    requested_capabilities jsonb not null,
    granted_capabilities jsonb not null,

    sandbox_policy jsonb not null,
    context_assembly_policy_id text not null,
    observability_policy_id text not null,
    memory_policy_id text,

    authorization_status text not null
);
```

---

# 11. Assurance Tables

## 11.1 Claims

```sql
create table claims (
    id text primary key
        references professional_work_objects(id),

    statement text not null,
    claim_type text not null,

    asserted_by jsonb not null,
    status text not null
);
```

## 11.2 Claim subjects

```sql
create table claim_subjects (
    claim_id text not null
        references claims(id),
    subject_object_id text not null
        references professional_work_objects(id),

    subject_semantic_version integer not null,

    primary key (
        claim_id,
        subject_object_id
    )
);
```

## 11.3 Evidence

```sql
create table evidence (
    id text primary key
        references professional_work_objects(id),

    evidence_type text not null,
    content_reference jsonb not null,
    produced_by jsonb not null,

    scope text not null,
    limitations jsonb not null,

    captured_at timestamptz not null,
    valid_from timestamptz,
    valid_until timestamptz,

    status text not null
);
```

## 11.4 Claim-evidence links

```sql
create table claim_evidence_links (
    claim_id text not null
        references claims(id),
    evidence_id text not null
        references evidence(id),

    relation text not null,
    admitted_scope text,
    assessment_id text,

    primary key (
        claim_id,
        evidence_id,
        relation
    )
);
```

`relation` includes:

* `SUPPORTS`;
* `CONTRADICTS`.

## 11.5 Assurance policies

```sql
create table assurance_policies (
    id text primary key
        references professional_work_objects(id),

    policy_key text not null,
    policy_version text not null,

    name text not null,
    purpose text not null,
    rationale text not null,

    definition jsonb not null,
    status text not null,

    constraint uq_policy_version
        unique (policy_key, policy_version)
);
```

## 11.6 Assurance assessments

```sql
create table assurance_assessments (
    id text primary key
        references professional_work_objects(id),

    assurance_policy_id text not null
        references assurance_policies(id),
    policy_version text not null,
    policy_semantic_version integer not null,

    assessment_state text not null,

    evaluator jsonb,
    independence_result text,

    residual_uncertainty jsonb not null,
    recommended_control_actions jsonb not null,

    started_at timestamptz,
    completed_at timestamptz
);
```

## 11.7 Assessment subjects

```sql
create table assurance_assessment_subjects (
    assessment_id text not null
        references assurance_assessments(id),
    subject_object_id text not null
        references professional_work_objects(id),

    subject_semantic_version integer not null,

    primary key (
        assessment_id,
        subject_object_id
    )
);
```

## 11.8 Assessment claims and evidence

```sql
create table assurance_assessment_claims (
    assessment_id text not null
        references assurance_assessments(id),
    claim_id text not null
        references claims(id),

    primary key (
        assessment_id,
        claim_id
    )
);

create table assurance_assessment_evidence (
    assessment_id text not null
        references assurance_assessments(id),
    evidence_id text not null
        references evidence(id),

    disposition text not null,
    rejection_reason text,

    primary key (
        assessment_id,
        evidence_id
    )
);
```

## 11.9 Assurance observations

```sql
create table assurance_observations (
    id text primary key
        references professional_work_objects(id),

    assessment_id text not null
        references assurance_assessments(id),

    policy_id text not null,
    criterion_id text,

    finding_code text not null,
    observation_type text not null,
    severity text not null,

    statement text not null,
    implication text not null,

    disposition text not null
);
```

## 11.10 Observation evidence and subjects

```sql
create table assurance_observation_subjects (
    observation_id text not null
        references assurance_observations(id),
    subject_object_id text not null
        references professional_work_objects(id),

    primary key (
        observation_id,
        subject_object_id
    )
);

create table assurance_observation_evidence (
    observation_id text not null
        references assurance_observations(id),
    evidence_id text not null
        references evidence(id),

    primary key (
        observation_id,
        evidence_id
    )
);
```

---

# 12. Governance and Baseline Tables

## 12.1 Decisions

```sql
create table decisions (
    id text primary key
        references professional_work_objects(id),

    decision_type text not null,
    selected_option text not null,
    rationale text not null,

    authority jsonb not null,
    status text not null,

    effective_at timestamptz
);
```

## 12.2 Decision subjects

```sql
create table decision_subjects (
    decision_id text not null
        references decisions(id),
    subject_object_id text not null
        references professional_work_objects(id),

    subject_semantic_version integer not null,

    primary key (
        decision_id,
        subject_object_id
    )
);
```

## 12.3 Decision evidence and observations

```sql
create table decision_evidence (
    decision_id text not null
        references decisions(id),
    evidence_id text not null
        references evidence(id),

    primary key (
        decision_id,
        evidence_id
    )
);

create table decision_observations (
    decision_id text not null
        references decisions(id),
    observation_id text not null
        references assurance_observations(id),

    primary key (
        decision_id,
        observation_id
    )
);
```

## 12.4 Baselines

```sql
create table baselines (
    id text primary key
        references professional_work_objects(id),

    baseline_type text not null,
    purpose text not null,
    scope text not null,

    promotion_decision_id text
        references decisions(id),

    status text not null
);
```

## 12.5 Baseline items

```sql
create table baseline_items (
    baseline_id text not null
        references baselines(id),
    object_id text not null
        references professional_work_objects(id),

    semantic_version integer not null,
    content_hash text,

    primary key (
        baseline_id,
        object_id
    )
);
```

## 12.6 Baseline assessments

```sql
create table baseline_assessments (
    baseline_id text not null
        references baselines(id),
    assessment_id text not null
        references assurance_assessments(id),

    primary key (
        baseline_id,
        assessment_id
    )
);
```

An authoritative baseline is immutable through application policy and database permissions.

---

# 13. Typed Traceability

```sql
create table trace_links (
    id text primary key,

    source_object_id text not null
        references professional_work_objects(id),
    source_semantic_version integer,

    target_object_id text not null
        references professional_work_objects(id),
    target_semantic_version integer,

    relation text not null,
    rationale text,

    created_at timestamptz not null,
    created_by_actor_id text not null,

    supersedes_trace_link_id text
        references trace_links(id),

    constraint uq_trace_link
        unique (
            source_object_id,
            source_semantic_version,
            target_object_id,
            target_semantic_version,
            relation
        )
);
```

Indexes:

```sql
create index idx_trace_source
    on trace_links(source_object_id, relation);

create index idx_trace_target
    on trace_links(target_object_id, relation);
```

---

# 14. Domain Event Store

## 14.1 Event table

```sql
create table domain_events (
    global_sequence bigserial primary key,

    event_id text not null unique,
    event_type text not null,
    event_schema_version integer not null,

    aggregate_type text not null,
    aggregate_id text not null,
    aggregate_revision bigint not null,

    occurred_at timestamptz not null,
    recorded_at timestamptz not null default now(),

    actor jsonb not null,

    correlation_id text not null,
    causation_id text,
    command_id text,

    payload jsonb not null,

    constraint uq_aggregate_revision
        unique (
            aggregate_type,
            aggregate_id,
            aggregate_revision
        )
);
```

Indexes:

```sql
create index idx_events_aggregate
    on domain_events(
        aggregate_type,
        aggregate_id,
        aggregate_revision
    );

create index idx_events_correlation
    on domain_events(correlation_id);

create index idx_events_type
    on domain_events(event_type);

create index idx_events_recorded
    on domain_events(recorded_at);
```

## 14.2 Event-writing transaction

A canonical command transaction must atomically:

1. lock or revision-check the aggregate;
2. validate invariants;
3. update current aggregate tables;
4. append domain events;
5. append object-version rows;
6. append outbox rows;
7. append command receipt result.

If any step fails, the full transaction rolls back.

---

# 15. Transactional Outbox

```sql
create table outbox_messages (
    id text primary key,

    event_id text not null
        references domain_events(event_id),

    topic text not null,
    partition_key text not null,

    payload jsonb not null,

    status text not null,
    attempt_count integer not null default 0,

    available_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    published_at timestamptz,

    last_error text
);
```

Indexes:

```sql
create index idx_outbox_pending
    on outbox_messages(status, available_at)
    where status in ('PENDING', 'FAILED');
```

The publisher:

* claims rows with `FOR UPDATE SKIP LOCKED`;
* publishes idempotently;
* marks successful publication;
* applies retry and dead-letter policy.

---

# 16. Command Receipts and Idempotency

```sql
create table command_receipts (
    command_id text primary key,
    idempotency_key text not null unique,

    command_type text not null,
    target_aggregate_type text not null,
    target_aggregate_id text not null,

    status text not null,

    expected_revision bigint,
    resulting_revision bigint,

    produced_event_ids jsonb not null default '[]'::jsonb,

    result_hash text,
    error jsonb,

    created_at timestamptz not null,
    completed_at timestamptz
);
```

Behavior:

* first command creates `PROCESSING`;
* transaction completes as `ACCEPTED` or `REJECTED`;
* duplicate key returns prior result;
* stale `PROCESSING` receipts are reconciled;
* side-effecting tool calls use related external idempotency keys.

---

# 17. State History Tables

Although events are authoritative history, state-history tables support efficient operational queries.

```sql
create table pwu_state_history (
    id bigserial primary key,
    pwu_id text not null
        references professional_work_units(id),

    work_lifecycle_state text not null,
    execution_state text not null,
    assurance_state text not null,
    shape_integrity_state text not null,

    effective_at timestamptz not null,
    event_id text not null
        references domain_events(event_id),

    reason_code text,
    supporting_object_ids jsonb not null
);
```

Equivalent history tables may exist for:

* assurance assessments;
* execution plans;
* baselines;
* decisions.

These tables are derived and rebuildable.

---

# 18. Artifact and Evidence Storage

## 18.1 Artifact metadata

```sql
create table artifacts (
    id text primary key
        references professional_work_objects(id),

    artifact_type text not null,
    media_type text not null,

    storage_provider text not null,
    storage_key text not null,

    content_hash text not null,
    byte_size bigint,

    producing_pwu_id text
        references professional_work_units(id),
    producing_execution_attempt_id text
        references execution_attempts(id),

    security_classification text not null,
    retention_class text not null,

    status text not null,

    constraint uq_artifact_content
        unique (
            storage_provider,
            storage_key,
            content_hash
        )
);
```

## 18.2 Storage strategy

Initial local extension deployment may use:

* workspace-local managed storage;
* a Janumi project-data directory;
* object storage abstraction;
* content-addressed filenames.

Future SaaS deployments may bind to:

* S3-compatible storage;
* Azure Blob;
* GCS;
* enterprise document repositories.

## 18.3 Immutability

Evidence and baseline artifact content should be immutable.

Corrections create:

* new artifact;
* new semantic version;
* supersession link.

## 18.4 Security

Artifact access must enforce:

* project scope;
* tenant or workspace scope;
* user authority;
* evidence classification;
* secret filtering;
* retention requirements.

---

# 19. Read Projection Tables

## 19.1 Work projection

```sql
create table work_view_nodes (
    projection_root_id text not null,
    object_id text not null,

    object_type text not null,
    title text not null,
    pwu_kind text,

    parent_object_id text,

    work_lifecycle_state text,
    execution_state text,
    assurance_state text,
    shape_integrity_state text,

    semantic_version integer not null,

    informational_count integer not null default 0,
    advisory_count integer not null default 0,
    material_count integer not null default 0,
    blocking_count integer not null default 0,
    critical_count integer not null default 0,

    projection_revision bigint not null,
    updated_at timestamptz not null,

    primary key (
        projection_root_id,
        object_id
    )
);
```

`projection_root_id` normally identifies the Undertaking whose Professional Work Graph is being projected.

## 19.2 Assurance projection

```sql
create table assurance_view_subjects (
    subject_object_id text primary key,

    aggregate_disposition text not null,

    required_policy_count integer not null,
    completed_policy_count integer not null,

    open_material_count integer not null,
    open_blocking_count integer not null,
    open_critical_count integer not null,

    residual_uncertainty jsonb not null,

    projection_revision bigint not null,
    updated_at timestamptz not null
);
```

## 19.3 Execution projection

```sql
create table execution_view_steps (
    execution_plan_id text not null,
    execution_step_id text not null,

    work_unit_id text not null,

    purpose text not null,
    step_type text not null,
    step_state text not null,

    role_id text,
    model_id text,
    tool_summary jsonb,

    attempt_count integer not null,
    last_error jsonb,

    projection_revision bigint not null,
    updated_at timestamptz not null,

    primary key (
        execution_plan_id,
        execution_step_id
    )
);
```

## 19.4 Compatibility projection

```sql
create table legacy_phase_projection (
    dialogue_id text primary key,

    current_phase text not null,
    phase_status text not null,

    derived_from_object_ids jsonb not null,
    derivation_rule_version text not null,

    projection_revision bigint not null,
    derived_at timestamptz not null
);
```

This table becomes the only supported legacy compatibility phase-state source after RPH authority cutover.

---

# 20. Projection Update Strategy

Projection handlers consume domain events from the outbox/event stream.

Each projection stores:

* last processed global sequence;
* handler version;
* rebuild status.

```sql
create table projection_checkpoints (
    projection_name text primary key,
    last_global_sequence bigint not null,
    handler_version text not null,
    updated_at timestamptz not null
);
```

Requirements:

* handlers are idempotent;
* ordering is preserved per aggregate;
* reprocessing is safe;
* full rebuild is supported;
* projection lag is observable;
* canonical commands never validate against projections alone.

---

# 21. Legacy Data Inventory

Before migration, the implementation team must identify the exact current tables and columns corresponding to:

* legacy dialogue identity;
* user expression;
* current legacy phase;
* INTAKE substate;
* legacy phase result;
* generated plan;
* assumptions;
* claims;
* legacy verifier output;
* historian output;
* human decisions;
* execution tasks;
* validation results;
* legacy repository commit;
* final status.

The following labels are conceptual placeholders until code inspection confirms the actual schema:

```text
dialogues
workflow_state
phase_results
assumptions
claims
validator_results
human_gates
execution_tasks
commit_records
```

No migration SQL should be finalized from names in this document alone.

---

# 22. Migration Classification

Each legacy record must be classified as one of:

## 22.1 Canonical migration source

Contains information suitable for conversion into authoritative RPH objects.

Examples:

* user’s originating request;
* explicit assumption;
* human approval;
* architecture artifact;
* legacy validator finding.

## 22.2 Provenance-only source

Useful for explaining history but insufficient as canonical semantics.

Examples:

* raw legacy dialogue;
* unstructured model prose;
* legacy phase logs.

## 22.3 Compatibility source

Retained temporarily for old UI or restart behavior.

Examples:

* current legacy phase;
* INTAKE substate.

## 22.4 Accidental implementation state

Not migrated as professional semantics.

Examples:

* transient UI flags;
* internal retry counters without business meaning;
* legacy phase-local caches.

## 22.5 Untrusted or ambiguous source

Requires migration review.

Examples:

* pass/fail result without criteria;
* assumption text without source or impact;
* approval flag without authority identity;
* artifact without version identity.

---

# 23. Migration Stages

# Stage 0: Discovery and Instrumentation

## Objective

Establish the factual current-state model.

## Actions

* inventory existing tables;
* instrument legacy phase entry and exit;
* instrument role calls;
* instrument legacy validator implementations;
* capture human decisions;
* capture artifacts and repository effects;
* record correlation IDs;
* capture representative traces.

## Authority

Legacy phase model remains authoritative.

## RPH behavior

None or read-only analysis.

## Exit criteria

* current behavior inventory complete;
* representative traces available;
* legacy source-of-truth tables identified;
* migration mapping approved.

---

# Stage 1: RPH Schema Introduction

## Objective

Deploy canonical RPH tables without changing execution authority.

## Actions

* create RPH schemas and tables;
* deploy event store;
* deploy outbox;
* deploy command receipts;
* load the Product Realization PWA definition, compatibility profile, and policies;
* load a Product Realization PWA Reference Undertaking fixture in nonproduction;
* build projection infrastructure.

## Authority

Legacy phase model remains authoritative.

## RPH behavior

Receives no production semantic writes except test fixtures and migration dry runs.

## Exit criteria

* migrations deploy safely;
* schema tests pass;
* fixture replay succeeds;
* no legacy behavior changes.

---

# Stage 2: Shadow Projection

## Objective

Convert legacy execution activity into shadow RPH objects and compare representations.

## Actions

For selected legacy dialogues:

* observe legacy events;
* bind the Product Realization PWA version and create a shadow Undertaking;
* create shadow Intent, PWU Instance, Execution, and Assurance records;
* create shadow events;
* derive the compatibility phase from shadow RPH;
* compare the derived compatibility phase with the legacy phase.

## Authority

Legacy phase remains authoritative.

Shadow RPH records are marked:

```text
authority_mode = SHADOW
```

They cannot drive execution or governance.

## Required comparison

```text
Legacy phase
Legacy outputs
Legacy validator status
Legacy human gate
Legacy repository commit state

versus

Derived RPH lifecycle
Execution state
Assurance state
Decision state
Baseline state
```

## Exit criteria

* mapping coverage exceeds agreed threshold;
* unexplained differences are classified;
* no production decisions depend on shadow state.

---

# Stage 3: Dual Execution for New Pilot Undertakings

## Objective

Run the RPH controller for a limited vertical slice while retaining legacy fallback.

## Scope

Only:

```text
Intent
→ Architecture
→ Assumption assurance
→ Architecture assurance
→ Human approval
→ Architecture Baseline
```

## Authority rule

For pilot legacy dialogues mapped to Product Realization Undertakings:

```text
RPH = authoritative
Legacy phase = derived compatibility projection
```

The legacy orchestrator may be used internally as an execution adapter, but it cannot independently mutate semantic legacy phase state.

## Required write pattern

```text
RPH command
→ RPH state transition
→ execution adapter call
→ RPH result ingestion
→ compatibility phase projection
```

Not:

```text
Legacy phase mutation
→ later copy to RPH
```

## Exit criteria

* pilot scenarios complete;
* compatibility UI remains functional;
* no dual-authority conflicts;
* rollback tested;
* evidence and decisions remain traceable.

---

# Stage 4: Shadow Comparison at Scale

## Objective

Increase the percentage of new Product Realization Undertakings using authoritative RPH.

## Cohorts

* internal tests;
* selected beta users;
* low-risk Product Realization Undertakings formerly handled by the legacy Product Lens;
* progressively larger Undertakings.

## Measures

* semantic parity;
* Assurance Policy result parity with legacy validators;
* human-decision parity;
* artifact differences;
* recovery behavior;
* latency;
* cost;
* false blocks;
* escaped defects.

## Exit criteria

* migration metrics meet threshold;
* no severity-one data issues;
* rollback and recovery proven;
* unresolved divergence accepted explicitly.

---

# Stage 5: RPH Default for New Product Realization Undertakings

## Objective

Make RPH authoritative for all new Product Realization Undertakings initiated through the legacy Product Lens compatibility surface.

## Legacy behavior

* legacy orchestrator available only as an execution adapter or emergency fallback;
* legacy phase enum generated from the compatibility projection;
* no direct writes to legacy semantic state.

## Database controls

* revoke ordinary application write permission to legacy phase-state columns;
* permit only migration/fallback service role where necessary;
* add database trigger or audit to detect unauthorized writes.

## Exit criteria

* all new Product Realization Undertakings are created in RPH;
* associated legacy dialogue identifiers remain compatibility interaction records only;
* compatibility view stable;
* support and operational procedures updated.

---

# Stage 6: Existing Legacy Dialogue Treatment

Existing legacy dialogues are classified.

## 6.1 Completed legacy dialogues

Do not fully reconstruct unless needed.

Create:

* legacy provenance record;
* optional summary Intent;
* optional final baseline reference;
* migration status `ARCHIVED_LEGACY`.

## 6.2 Active early-stage legacy dialogues

Eligible for full migration when current state is:

* INTAKE;
* ARCHITECTURE;
* PROPOSE.

Create canonical objects and continue under RPH after human or automated reconciliation.

## 6.3 Active late-stage legacy dialogues

For legacy dialogues in:

* EXECUTE;
* VALIDATE;
* COMMIT;

prefer one of:

* complete under legacy;
* migrate at a controlled milestone;
* create a limited bridge representation.

Do not force mid-operation migration without tested state mapping.

## 6.4 Failed or inconsistent legacy dialogues

Mark:

```text
MIGRATION_REVIEW_REQUIRED
```

Require manual or specialized reconciliation.

---

# Stage 7: Legacy Orchestrator Retirement

## Objective

Remove legacy semantic authority.

## Actions

* disable direct legacy phase transitions;
* retain the read-only legacy phase projection;
* archive legacy code paths;
* preserve migration adapters for historical reads;
* retain raw legacy records under retention policy.

## Exit criteria

* no production command depends on hardcoded legacy phase authority;
* all active legacy dialogues are mapped to RPH Undertakings or intentionally legacy-completing;
* rollback no longer requires restoring legacy phase authority.

---

# 24. Legacy-to-RPH Mapping

## 24.1 Legacy dialogue

A legacy dialogue becomes:

* interaction record;
* provenance source;
* Intent origin;
* human-communication channel.

The legacy dialogue itself is not the root professional object; the concrete professional work is the Undertaking and its Professional Work Graph.

## 24.2 Legacy Execution Workflow phase

Legacy phase becomes:

* compatibility milestone;
* execution-plan grouping;
* migration hint.

It does not become PWU lifecycle directly.

## 24.3 INTAKE result

May create:

* Intent;
* Product Definition PWU;
* artifacts;
* constraints;
* assumptions;
* approval decision;
* Intent Baseline.

## 24.4 Architecture result

May create:

* Architecture PWU;
* Architecture Artifact;
* claims;
* assumptions;
* evidence;
* assurance assessment;
* human decision;
* Architecture Baseline.

## 24.5 Legacy validator result

Legacy validator output, produced by an implementation of an Assurance Policy, becomes one of:

* Assurance Assessment;
* Assurance Observation;
* Evidence;
* provenance-only record.

A generic pass/fail cannot automatically become satisfied assurance unless the policy criteria can be reconstructed.

## 24.6 Human gate

A legacy approved flag becomes an effective Decision only if migration can identify:

* actor;
* subject;
* subject version or stable artifact;
* decision type;
* timestamp.

Otherwise it is provenance-only and migration may require reapproval.

## 24.7 Legacy repository commit

A legacy commit becomes:

* Artifact;
* repository event;
* provenance.

It does not become an authoritative Baseline. It may be included as a Baseline item only when a separate acceptance decision and its authority can be reconstructed.

---

# 25. Migration Tables

## 25.1 Migration batches

```sql
create table migration_batches (
    id text primary key,

    migration_version text not null,
    migration_type text not null,

    started_at timestamptz not null,
    completed_at timestamptz,

    status text not null,

    source_snapshot_id text,
    initiated_by_actor_id text not null,

    statistics jsonb not null,
    error_summary jsonb
);
```

## 25.2 Object migration map

```sql
create table legacy_object_mappings (
    legacy_source_type text not null,
    legacy_source_id text not null,

    rph_object_id text,
    rph_object_type text,

    migration_batch_id text not null
        references migration_batches(id),

    migration_status text not null,
    confidence text not null,

    mapping_rationale text,
    review_required boolean not null default false,

    primary key (
        legacy_source_type,
        legacy_source_id
    )
);
```

## 25.3 Legacy dialogue migration status

```sql
create table dialogue_migration_status (
    dialogue_id text primary key,

    authority_mode text not null,
    migration_status text not null,

    legacy_phase text,
    derived_phase text,

    root_intent_id text,
    undertaking_id text,
    root_pwu_id text,

    last_compared_at timestamptz,
    divergence_classification text,
    divergence_details jsonb,

    rollback_eligible boolean not null
);
```

`authority_mode` values:

* `LEGACY`;
* `SHADOW_RPH`;
* `RPH`;
* `LEGACY_COMPLETING`;
* `ARCHIVED_LEGACY`.

---

# 26. Authority Modes

## 26.1 LEGACY

* legacy orchestrator authoritative;
* RPH may observe only;
* no RPH execution decisions.

## 26.2 SHADOW_RPH

* legacy authoritative;
* RPH builds shadow semantic state;
* differences measured;
* no RPH side effects.

## 26.3 RPH

* RPH authoritative;
* the legacy compatibility phase is derived;
* all semantic writes occur through RPH commands.

## 26.4 LEGACY_COMPLETING

* existing legacy dialogue finishes under legacy;
* RPH records provenance;
* no attempt at full midstream authority transfer.

## 26.5 ARCHIVED_LEGACY

* historical read only;
* no active execution;
* optional summary mapping.

One legacy dialogue may have only one authority mode at a time.

---

# 27. Prevention of Dual Authority

## 27.1 Application controls

When authority mode is `RPH`:

* legacy phase-transition APIs reject writes;
* legacy orchestrator cannot set authoritative state;
* compatibility phase is updated only by projection handlers;
* human decisions are written only through Governance Service;
* Assurance Policy implementation outcomes are written only through Assurance Service.

## 27.2 Database controls

Recommended:

* separate database role for compatibility projection;
* revoke update permission on legacy phase columns from normal runtime role;
* permit compatibility updater only;
* add write-audit trigger;
* alert on unauthorized legacy compatibility phase mutation.

## 27.3 Code ownership

Only one component may calculate compatibility phase:

```text
Compatibility Projection Handler
```

No other service may independently derive and persist it.

---

# 28. Legacy Compatibility Phase Derivation

The legacy compatibility phase should derive from canonical state using versioned rules.

Example:

```text
INTAKE
    complete when:
    Intent Baseline is AUTHORITATIVE

ARCHITECTURE
    complete when:
    Architecture Definition PWU Instance is BASELINED
    and Architecture Baseline is AUTHORITATIVE

PROPOSE
    in progress when:
    Implementation Planning PWU Instance is active

EXECUTE
    in progress when:
    one or more Product Implementation PWU Instances are EXECUTING

VALIDATE
    in progress when:
    Integrated Validation PWU is UNDER_ASSURANCE

COMMIT
    repository operation complete when:
    required Repository Commit Artifact is recorded, if applicable
    compatibility milestone complete when:
    a separately governed Product or Release Baseline is AUTHORITATIVE
```

The `COMMIT` label remains a legacy compatibility milestone. Its derivation may summarize independently modeled repository-operation and baseline-governance state; neither implies the other.

The derivation rule version is stored with the projection.

A rule change rebuilds the legacy compatibility phase projection but does not change semantic state.

---

# 29. Shadow Comparison Model

For each shadow legacy dialogue, compare:

```sql
create table migration_comparisons (
    id text primary key,

    dialogue_id text not null,

    comparison_type text not null,

    legacy_value jsonb,
    rph_value jsonb,

    result text not null,
    classification text,

    materiality text not null,

    compared_at timestamptz not null,
    reviewed_by_actor_id text,
    review_notes text
);
```

Classification values:

* `EQUIVALENT`;
* `RPH_STRONGER`;
* `LEGACY_BEHAVIOR_MISSING`;
* `ACCIDENTAL_LEGACY_BEHAVIOR`;
* `SEMANTIC_CONFLICT`;
* `IMPLEMENTATION_DEFECT`;
* `UNRESOLVED`.

---

# 30. Transaction Boundaries

## 30.1 Aggregate command transaction

Within one aggregate:

* lock or compare revision;
* validate;
* update state;
* write version snapshot;
* append event;
* write outbox;
* write command receipt.

One database transaction.

## 30.2 Cross-aggregate Execution Workflow

Do not update several aggregates in one broad transaction merely to simulate Execution Workflow atomicity.

Use:

* domain event;
* saga/controller;
* compensating actions;
* explicit intermediate states.

Example:

```text
Architecture Assessment satisfied
→ event
→ Governance Decision requested
→ human approval
→ event
→ Baseline promotion requested
```

Each step is independently durable.

## 30.3 Exception: tightly coupled child records

Within one aggregate transaction, it is acceptable to write:

* PWU plus allocation rows;
* assessment plus criterion results;
* decision plus subject links;
* baseline plus item links.

---

# 31. Optimistic Concurrency

Commands include expected revision.

SQL update pattern:

```sql
update professional_work_objects
set
    revision = revision + 1,
    semantic_version = :semantic_version,
    updated_at = :updated_at,
    updated_by_actor_id = :actor_id
where id = :id
  and revision = :expected_revision;
```

If affected rows equal zero:

```text
RPH_REVISION_CONFLICT
```

The command must not silently retry using stale business assumptions.

The caller may:

* reload;
* re-evaluate;
* resubmit.

---

# 32. Semantic Version Changes

The service determines whether a command is semantic.

Examples that increment semantic version:

* intent objective change;
* boundary change;
* mandatory constraint change;
* obligation change;
* PWU decomposition change;
* evidence requirement change;
* architecture artifact meaning change;
* baseline item change.

Examples that do not:

* execution retry;
* Assurance Policy implementation reassignment;
* canvas move;
* projection update;
* formatting correction;
* observability metadata.

The semantic-change decision should be explicit in command handlers and covered by tests.

---

# 33. Data Retention

## 33.1 Domain events

Retain for the life of the project or applicable organizational policy.

Events supporting baselines, decisions, waivers, and audit should not be pruned casually.

## 33.2 Raw model output

Retain according to:

* privacy;
* security;
* debugging need;
* enterprise policy;
* cost.

Prefer retaining:

* content hash;
* parsed result;
* provenance;
* bounded diagnostic excerpt;

rather than all raw context indefinitely.

## 33.3 Evidence

Retain while any active or historical claim, assessment, decision, or baseline depends on it.

## 33.4 Legacy data

After cutover:

* retain read-only under historical retention;
* classify sensitive content;
* avoid duplicating large artifacts unnecessarily;
* maintain mapping to RPH objects.

---

# 34. Backup and Recovery

Minimum recovery objectives for local/initial deployment:

* regular database backup;
* artifact-store backup;
* event-store consistency;
* projection rebuild capability;
* migration snapshot before each cutover stage;
* restoration test.

Recovery ordering:

```text
Restore canonical database
→ restore artifact storage
→ verify event sequence
→ replay outbox
→ rebuild projections
→ reconcile active execution attempts
→ resume controllers
```

Projection tables do not need independent authoritative backups if rebuild is proven.

---

# 35. Active Execution Recovery

Execution attempts may have external side effects.

On restart, classify each nonterminal attempt:

* definitely not started;
* running with observable external ID;
* succeeded but result not recorded;
* failed;
* completion uncertain.

Store:

* external operation ID;
* invocation timestamp;
* idempotency key;
* provider;
* reconciliation method.

Never blindly retry an uncertain side effect.

The controller first performs reconciliation.

---

# 36. Migration Rollback

Rollback differs by stage.

## 36.1 Before RPH authority

Rollback is simple:

* disable shadow writes;
* leave legacy authority intact;
* preserve shadow data for analysis.

## 36.2 During pilot RPH authority

Rollback eligibility requires:

* no irreversible RPH-only semantic action that legacy cannot represent;
* compatibility phase current;
* legacy execution adapter available;
* migration checkpoint.

Rollback procedure:

1. suspend new commands;
2. reconcile active execution attempts;
3. create rollback snapshot;
4. convert current RPH state to legacy-compatible milestone;
5. mark the legacy dialogue `LEGACY_COMPLETING`;
6. resume under legacy;
7. preserve RPH audit state.

## 36.3 After default RPH cutover

Do not restore legacy semantic authority globally.

Use:

* incident recovery;
* feature disablement;
* controller fallback;
* manual governance.

Once the platform depends on RPH-only semantics such as independent assurance and baselines, global rollback to legacy phases would lose meaning.

---

# 37. Cutover Criteria

RPH may become authoritative for a cohort only when:

* schema migrations are stable;
* command and event tests pass;
* fixture replay passes;
* projection rebuild passes;
* shadow comparisons meet threshold;
* legacy compatibility phase derivation is reliable;
* restart recovery is proven;
* human decisions are version-bound;
* legacy validator outputs are canonicalized as Assurance Policy implementation and Assessment results;
* dual-authority write prevention is active;
* rollback procedure is tested;
* operational dashboards exist.

Suggested thresholds:

* no unexplained critical semantic divergence;
* at least 99% successful projection updates;
* zero duplicate governance decisions;
* zero duplicate baseline promotions;
* zero silent constraint-loss incidents;
* all pilot Product Realization Undertakings and their legacy dialogue compatibility records recover after restart test.

---

# 38. Operational Metrics

Track:

## Persistence

* command latency;
* revision-conflict rate;
* event-write failures;
* outbox lag;
* projection lag;
* projection rebuild duration.

## Migration

* legacy dialogues and mapped Undertakings by authority mode;
* shadow comparison divergence;
* migration failure rate;
* review-required mappings;
* rollback events.

## Semantic integrity

* missing trace links;
* stale assessments;
* unallocated obligations;
* dropped constraints;
* unsupported baseline attempts.

## Recovery

* uncertain external attempts;
* reconciliation success;
* duplicate side effects prevented;
* projection-rebuild success.

---

# 39. Migration Alerts

Alert on:

* unauthorized legacy phase write;
* RPH/legacy phase divergence in the legacy dialogue compatibility record for an RPH-authoritative Undertaking;
* event revision gap;
* outbox backlog above threshold;
* projection lag above threshold;
* duplicate idempotency conflict;
* baseline promotion with missing item hash;
* active execution using superseded plan;
* stale assessment used for current semantic version;
* failed migration batch;
* orphaned legacy mapping.

---

# 40. Security and Access Control

Recommended database roles:

## `rph_runtime`

May:

* issue canonical commands through services;
* read canonical objects;
* append events through controlled functions.

May not:

* rewrite event history;
* directly alter authoritative baselines;
* directly update legacy phase fields.

## `rph_projection`

May:

* read events;
* write projection tables;
* update compatibility projection.

May not:

* mutate canonical semantic tables.

## `rph_migration`

Temporary elevated role for controlled migration batches.

All use is audited.

## `rph_audit`

Read-only access to:

* events;
* decisions;
* baselines;
* mappings;
* migration comparisons.

---

# 41. Migration Implementation Backlog

## Epic A: Physical schema

* create common registry;
* create type tables;
* create event store;
* create outbox;
* create command receipts;
* create projections;
* create migration tables;
* create indexes and constraints.

## Epic B: Persistence services

* aggregate repositories;
* revision enforcement;
* version snapshots;
* event append;
* outbox publication;
* artifact repository;
* trace repository.

## Epic C: Projection services

* Work projection;
* Execution projection;
* Assurance projection;
* Compatibility projection;
* checkpointing;
* rebuild tools.

## Epic D: Legacy instrumentation

* legacy phase-write audit;
* role invocation correlation;
* legacy validator result capture and Assurance Policy implementation mapping;
* human-decision capture;
* artifact mapping.

## Epic E: Shadow migration

* shadow object creation;
* mapping records;
* comparison records;
* divergence dashboard.

## Epic F: Pilot cutover

* authority-mode switch;
* legacy-write prevention;
* compatibility phase derivation;
* rollback procedure;
* cohort controls.

## Epic G: Existing legacy-dialogue migration

* classify legacy dialogues;
* migrate eligible early-stage legacy dialogues into Undertakings;
* mark legacy-completing dialogues;
* archive completed legacy dialogues;
* manual reconciliation tooling.

---

# 42. Initial Vertical-Slice Persistence Sequence

A normal architecture flow persists approximately:

```text
1. CommandReceipt: CaptureIntent
2. professional_work_objects: Intent
3. intents: raw intent
4. domain_events: IntentCaptured
5. outbox_messages: IntentCaptured

6. selected Product Realization PWA version
7. Undertaking bound to that PWA version
8. PWU Instances for root and intent work, each bound to a PWU Type or marked as an Undertaking-local extension
9. execution plan and steps
10. execution attempts and artifacts
11. claims and evidence
12. assurance assessment and observations
13. decision and subject-version links
14. Intent Baseline and items

15. Architecture PWU Instance and decomposition
16. Architecture execution plan
17. runtime binding and execution attempt
18. Architecture Artifact
19. assumptions and impacts
20. architecture claims
21. evidence admission
22. assurance assessments
23. human architecture decision
24. Architecture Baseline and items
25. legacy compatibility phase projection
```

Each numbered domain change is command-driven and event-backed.

---

# 43. Migration Conformance Tests

The persistence and migration layer must pass at least:

1. RPH and legacy cannot both write authoritative semantic state.
2. Compatibility phase can be rebuilt entirely from RPH events and state.
3. Legacy shadow conversion does not trigger external side effects.
4. Duplicate migration batches do not duplicate RPH objects.
5. Every migrated object retains a legacy-source mapping.
6. Uncertain mappings are marked review-required.
7. Approved legacy results without authority identity are not promoted automatically.
8. Legacy pass/fail validator results do not become satisfied assessments without reconstructed Assurance Policy criteria.
9. Baselines bind exact object versions and hashes.
10. Event and outbox writes are atomic.
11. Projection tables can be deleted and rebuilt.
12. Active execution survives restart without duplicate side effects.
13. RPH pilot rollback preserves audit history.
14. Unauthorized legacy phase writes generate alerts.
15. Completed legacy dialogues remain readable as historical interaction and provenance records after retirement.

---

# 44. Definition of Done

The persistence and migration design is implemented for the initial vertical slice when:

* all canonical tables exist;
* foreign keys and indexes are active;
* optimistic concurrency is enforced;
* command idempotency is enforced;
* domain events are append-only;
* outbox publication is reliable;
* object version history is retained;
* Work, Assurance, Execution, and Compatibility projections rebuild successfully;
* artifacts and evidence are content-hashed;
* legacy state is inventoried and mapped;
* shadow mode operates without side effects;
* authority mode is explicit per legacy dialogue and mapped Undertaking;
* RPH-authoritative Undertakings reject legacy semantic writes;
* legacy compatibility phase state is derived from RPH;
* pilot rollback is tested;
* Architecture Baseline promotion is transactionally and semantically safe;
* the intent-to-architecture reference fixture persists, replays, and reconstructs correctly.

---

# 45. Final Persistence Rule

The migration succeeds only when Janumi Professional Workbench can answer, from durable authoritative data:

* What did the user ask for?
* Which PWA and version governed the work?
* Which Undertaking instantiated that PWA?
* What interpretation was approved?
* What professional work was created?
* Which obligations and constraints applied?
* What execution occurred?
* What assumptions were introduced?
* What claims were made?
* What evidence supported them?
* What assurance was performed?
* What findings remained?
* Who exercised authority?
* Which exact artifact versions became authoritative?
* Why did the system proceed, stop, reshape, or reject?

A legacy phase label cannot answer those questions.

The RPH persistence model exists to make those answers durable, queryable, auditable, and operationally enforceable.
