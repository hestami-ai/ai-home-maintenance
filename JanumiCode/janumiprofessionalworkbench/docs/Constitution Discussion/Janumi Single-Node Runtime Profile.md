# Janumi Single-Node Runtime Profile

## JSRP Specification v0.1.0

**Document ID:** `JAN-JSRP-001`
**Version:** `0.1.0`
**Status:** Draft
**Implements:** Janumi Execution Model v0.1
**Deployment target:** Initial Janumi SaaS and selected enterprise demonstrations
**Primary audiences:** Platform architects, backend engineers, DevOps engineers, security engineers, coding agents, SREs, agent-runtime developers
**Reference topology:** One physical or virtual server operating a single-node containerized deployment
**Reference database:** PostgreSQL
**Reference deployment modes:** Docker Compose initially; single-node RKE2 as an optional infrastructure profile

---

# 1. Purpose

The Janumi Single-Node Runtime Profile, or JSRP, defines the first concrete runtime implementation of the Janumi Execution Model.

It establishes a production-oriented but operationally bounded architecture suitable for:

* early SaaS customers;
* controlled beta deployments;
* development and demonstration environments;
* small professional teams;
* selected on-premises installations;
* future migration into a distributed Janumi runtime.

The profile is intentionally designed around one server.

Single-node does not mean:

* single process;
* single container;
* single tenant;
* no isolation;
* no durable workflows;
* no operational controls;
* no future scale path.

It means that authoritative storage, runtime services, agent scheduling, observability, and supporting infrastructure initially reside within one failure domain.

---

# 2. Profile Objectives

The single-node runtime SHALL provide:

1. JEM-conformant Command handling;
2. transactional authoritative persistence;
3. immutable Event history;
4. durable Process and RPH execution;
5. explicit human waiting and resumption;
6. agent invocation and provenance;
7. sandboxed execution for generated code and tools;
8. asynchronous projection updates;
9. tenant and organization isolation;
10. operational observability;
11. backup and recovery;
12. bounded resource scheduling;
13. predictable failure behavior;
14. a clear migration path toward distributed deployment.

---

# 3. Non-Goals

JSRP v0.1 does not provide:

* multi-region availability;
* zero-downtime survival of host failure;
* globally distributed event processing;
* unlimited horizontal agent execution;
* cross-region active-active writes;
* autonomous disaster recovery to a second site;
* large-enterprise data-warehouse scale;
* a general Kubernetes control plane dependency;
* arbitrary customer-supplied privileged containers;
* unrestricted workflow or compiler plugin execution.

These capabilities may appear in later runtime profiles.

---

# 4. Reference Logical Architecture

```text
Clients
  │
  ├── Web Workbench
  ├── VS Code Extension
  ├── Mobile Clients
  ├── Administrative UI
  └── External Integrations
          │
          ▼
     Edge / Ingress
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                 Janumi Application Runtime                  │
│                                                             │
│  ┌──────────────────────┐  ┌─────────────────────────────┐ │
│  │ API / Command Layer  │  │ Projection Query Layer      │ │
│  └──────────┬───────────┘  └──────────────┬──────────────┘ │
│             │                              │                │
│  ┌──────────▼───────────┐  ┌──────────────▼──────────────┐ │
│  │ Semantic Runtime     │  │ Projection Workers          │ │
│  │ - Authority          │  │ - PWU views                 │ │
│  │ - Aggregate loading  │  │ - Decision views            │ │
│  │ - Validation         │  │ - Coordination views        │ │
│  │ - Command execution  │  │ - Attention views           │ │
│  └──────────┬───────────┘  └──────────────┬──────────────┘ │
│             │                              │                │
│  ┌──────────▼───────────┐  ┌──────────────▼──────────────┐ │
│  │ Process Runtime      │  │ Agent Runtime               │ │
│  │ - Durable processes  │  │ - Agent executions          │ │
│  │ - RPHs               │  │ - Tool calls                │ │
│  │ - Timers             │  │ - Context projections       │ │
│  │ - Human waits        │  │ - Validation boundary       │ │
│  └──────────┬───────────┘  └──────────────┬──────────────┘ │
│             │                              │                │
│  ┌──────────▼──────────────────────────────▼──────────────┐ │
│  │                 Integration Layer                     │ │
│  │ - OpenSandbox                                        │ │
│  │ - Object storage                                     │ │
│  │ - External APIs                                      │ │
│  │ - Email / messaging                                  │ │
│  │ - Repository integrations                            │ │
│  └──────────────────────────┬────────────────────────────┘ │
└─────────────────────────────┼──────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     PostgreSQL                              │
│                                                             │
│  Authoritative state │ Events │ Outbox │ Processes          │
│  Projections         │ Audit  │ Idempotency │ Scheduling    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     Object / Artifact Storage
```

---

# 5. Deployment Topology

The reference deployment SHALL use multiple containers or processes on one host.

## 5.1 Required Logical Components

```text
reverse_proxy
web_frontend
api_runtime
command_worker
process_worker
projection_worker
agent_scheduler
agent_worker
sandbox_control
postgresql
object_storage
otel_collector
metrics_backend
log_backend
trace_backend
```

Several logical roles MAY share one executable during the first implementation.

They SHALL remain separately identifiable in configuration and observability.

## 5.2 Initial Consolidation

A practical first release MAY combine:

```text
api_runtime
command_worker
process_worker
projection_worker
```

into one application binary with independent worker loops.

The architecture SHALL preserve the ability to separate them later.

## 5.3 Host Failure Domain

All components reside within one host failure domain.

This SHALL be documented in:

* availability claims;
* customer agreements;
* recovery objectives;
* operational runbooks.

---

# 6. Reference Technology Profile

The profile recommends:

```text
Host OS: Ubuntu Server or another supported hardened Linux distribution
Container runtime: Docker Engine or containerd
Initial orchestration: Docker Compose
Optional orchestration: Single-node RKE2
Database: PostgreSQL
Object storage: S3-compatible local or external service
Reverse proxy: Traefik or equivalent
Observability: OpenTelemetry
Sandbox execution: OpenSandbox using Docker-compatible isolation
```

These are profile choices, not universal Janumi requirements.

Equivalent technologies MAY be substituted if JEM semantics remain intact.

---

# 7. PostgreSQL as Authoritative Store

PostgreSQL SHALL serve as the initial authoritative transactional store.

It SHALL persist:

* Aggregate state;
* entity versions;
* semantic relationships;
* immutable Events;
* Command results;
* idempotency records;
* durable Process state;
* RPH state;
* timers;
* Attention Items;
* reconciliation cases;
* audit records;
* projection checkpoints;
* selected projection tables;
* agent execution metadata.

Large Artifacts SHOULD be stored outside PostgreSQL.

---

# 8. Database Schema Domains

The database SHOULD use explicit schemas.

```text
janumi_semantic
janumi_runtime
janumi_event
janumi_projection
janumi_audit
janumi_integration
janumi_admin
```

## 8.1 `janumi_semantic`

Contains authoritative professional state.

Examples:

```text
entities
entity_versions
relationships
relationship_versions
pwus
pwu_versions
decisions
claims
evidence
validations
reconciliations
```

## 8.2 `janumi_runtime`

Contains runtime execution state.

Examples:

```text
commands
command_results
idempotency_records
process_instances
process_steps
rph_instances
agent_executions
agent_tool_calls
timers
attention_items
external_operations
```

## 8.3 `janumi_event`

Contains:

```text
events
outbox
consumer_checkpoints
dead_letter_records
```

## 8.4 `janumi_projection`

Contains:

```text
pwu_overview
endeavor_overview
decision_projection
evidence_projection
coordination_projection
attention_projection
projection_checkpoints
```

## 8.5 `janumi_audit`

Contains append-only audit records.

## 8.6 `janumi_integration`

Contains:

* external system mappings;
* webhook registrations;
* synchronization state;
* credential references;
* integration execution history.

---

# 9. Tenant Isolation Model

The initial SaaS profile SHALL support multiple tenants.

## 9.1 Tenant Key

Every tenant-scoped table SHALL include:

```text
tenant_id
```

Organization-scoped objects SHALL also include:

```text
organization_id
```

## 9.2 Database Enforcement

Tenant isolation SHALL be enforced through at least two layers:

1. application-level scoped repositories;
2. PostgreSQL Row-Level Security where technically practical.

## 9.3 Connection Context

Each transaction SHOULD set trusted session-local context:

```sql
SET LOCAL janumi.tenant_id = '...';
SET LOCAL janumi.organization_id = '...';
SET LOCAL janumi.participant_id = '...';
```

RLS policies MAY reference this context.

## 9.4 Administrative Access

Administrative cross-tenant access SHALL use:

* separate roles;
* explicit elevation;
* audit logging;
* limited duration;
* declared purpose.

## 9.5 No Shared Unscoped Cache

No runtime cache SHALL mix tenant-scoped objects without including tenant identity in the cache key.

---

# 10. Authoritative Entity Storage

The runtime MAY use a hybrid model:

* strongly typed tables for high-value aggregates;
* generic entity and relationship tables for extensible CPCO state;
* JSONB for subtype-specific payloads;
* explicit version tables;
* generated views.

## 10.1 Core Entity Table

```text
entity_id
tenant_id
organization_id
entity_type
entity_subtype
endeavor_id
current_version
lifecycle_state
validity_state
created_by
created_at
updated_at
semantic_model_version
```

## 10.2 Entity Version Table

```text
entity_id
version
payload
valid_from
valid_until
recorded_at
created_by
change_reason
source_command_id
source_event_id
semantic_model_version
```

## 10.3 Relationship Table

```text
relationship_id
tenant_id
relationship_type
source_entity_id
target_entity_id
current_version
validity_state
```

## 10.4 Relationship Version Table

Stores temporal relationship properties and provenance.

---

# 11. Aggregate Repository

The Aggregate Repository SHALL:

* load authoritative Aggregate state;
* apply tenant and organization scope;
* enforce model compatibility;
* expose current Aggregate version;
* participate in database transactions;
* persist accepted state transitions;
* prevent direct generic mutation from callers.

## 11.1 Repository Interface

```text
load(aggregateType, aggregateId, tenantContext)
save(aggregate, expectedVersion, emittedEvents, commandResult)
exists(aggregateType, aggregateId)
```

## 11.2 No External Save

Only the semantic Command execution layer SHALL invoke authoritative save operations.

---

# 12. Command Service

The Command Service is the authoritative mutation entry point.

## 12.1 Responsibilities

```text
authenticate
resolve Participant
resolve semantic Command definition
check idempotency
load Aggregate
check concurrency
evaluate authority
normalize payload
execute Validators
apply transition
persist state and Events
persist result
enqueue outbox records
return professional result
```

## 12.2 Command API

The public API SHOULD expose semantic operations.

Examples:

```text
POST /commands/complete-pwu
POST /commands/propose-decision
POST /commands/approve-decision
POST /commands/start-reconciliation
POST /commands/decompose-pwu
```

An alternative generic envelope endpoint MAY be provided:

```text
POST /commands
```

provided semantic Command types remain explicit and generated from JSDL.

## 12.3 Transaction Isolation

The Command transaction SHOULD use:

```text
READ COMMITTED
```

with explicit optimistic version checks.

Selected high-contention operations MAY use:

```text
SELECT ... FOR UPDATE
```

where necessary.

Serializable isolation SHALL not be required globally.

---

# 13. Command Persistence

The runtime SHALL persist:

```text
command_id
command_type
target_id
tenant_id
requested_by
requested_at
received_at
status
expected_version
payload_hash
idempotency_key
correlation_id
causation_id
result
failure
completed_at
```

## 13.1 Command Status

```text
received
validating
accepted
rejected
duplicate
conflicted
pending_async_validation
requires_approval
failed_technical
```

## 13.2 Payload Protection

Sensitive Command payloads SHOULD be:

* minimized;
* encrypted where required;
* excluded from logs;
* retained according to policy.

---

# 14. Idempotency Store

The idempotency table SHALL include:

```text
tenant_id
command_type
target_id
idempotency_key
payload_hash
command_id
result_status
result_reference
created_at
expires_at
```

## 14.1 Retention

Idempotency retention SHALL exceed the longest expected client retry period.

High-impact Commands MAY retain idempotency records indefinitely or according to audit policy.

---

# 15. Event Store

The Event Store SHALL use an append-only table.

## 15.1 Event Table

```text
global_position
event_id
tenant_id
organization_id
aggregate_type
aggregate_id
aggregate_version
event_type
event_version
occurred_at
recorded_at
actor_id
participant_id
command_id
correlation_id
causation_id
payload
provenance
semantic_model_version
```

## 15.2 Aggregate Uniqueness

A unique constraint SHALL enforce:

```text
aggregate_id + aggregate_version
```

within the relevant tenant scope.

## 15.3 Global Position

`global_position` MAY use a database-generated monotonic sequence.

It provides a durable processing position.

It SHALL not be interpreted as universal semantic time.

---

# 16. Transactional Outbox

The outbox SHALL be written within the same transaction as authoritative state and Events.

## 16.1 Outbox Table

```text
outbox_id
event_id
tenant_id
topic
partition_key
payload
created_at
published_at
attempt_count
next_attempt_at
last_error
status
```

## 16.2 Outbox Status

```text
pending
publishing
published
retrying
dead_letter
```

## 16.3 Initial Publication

The single-node runtime MAY publish internally without an external broker.

Consumers may poll the outbox or Event table.

The outbox SHALL still exist to preserve migration and delivery semantics.

---

# 17. Internal Event Dispatch

JSRP v0.1 MAY use PostgreSQL-based event dispatch.

Options include:

* polling with `FOR UPDATE SKIP LOCKED`;
* `LISTEN/NOTIFY` as a wake-up signal;
* periodic checkpoint scans.

`LISTEN/NOTIFY` SHALL not be the authoritative delivery mechanism.

It is only a latency optimization.

## 17.1 Worker Claim Pattern

Workers SHOULD claim work using:

```sql
SELECT ...
FOR UPDATE SKIP LOCKED
LIMIT ...
```

This permits future multiple workers on the same node.

---

# 18. Projection Workers

Projection workers SHALL:

1. read committed Events in order;
2. process each Event idempotently;
3. update one or more projection tables;
4. persist a checkpoint;
5. record failure state;
6. retry transient failures;
7. expose lag.

## 18.1 Projection Checkpoint

```text
projection_name
partition_key
last_global_position
last_event_id
updated_at
status
last_error
```

## 18.2 Projection Idempotency

Projection updates SHALL be safe if the same Event is delivered more than once.

## 18.3 Projection Rebuild

A projection MAY be rebuilt by:

* truncating its derived tables;
* resetting checkpoint;
* replaying authoritative Events.

---

# 19. Initial Projection Set

JSRP v0.1 SHALL implement:

```text
PwuOverviewProjection
PwuHistoryProjection
EndeavorOverviewProjection
DecisionProjection
EvidenceProjection
DecompositionProjection
ReconciliationProjection
RphCoordinationProjection
AttentionProjection
```

## 19.1 Projection API

Projection queries SHOULD use read-only endpoints or query services.

They SHALL not mutate authoritative state.

---

# 20. Durable Process Runtime

The initial runtime SHALL implement durable Process Instances using PostgreSQL.

A dedicated workflow platform MAY be introduced later.

## 20.1 Process Table

```text
process_id
tenant_id
process_type
process_version
status
current_step
state_payload
correlation_id
causation_id
started_at
updated_at
deadline
next_wakeup_at
retry_count
last_error
semantic_model_version
```

## 20.2 Process Step Table

```text
process_id
step_number
step_type
status
started_at
completed_at
input_references
output_references
failure
```

## 20.3 Worker Scheduling

Process workers SHALL claim runnable instances through database leasing.

---

# 21. Process Lease Model

```text
lease_owner
lease_acquired_at
lease_expires_at
heartbeat_at
```

## 21.1 Lease Recovery

If a worker fails, another worker may reclaim the Process after lease expiration.

## 21.2 Step Idempotency

Every Process step SHALL be idempotent or possess a durable external-operation record.

---

# 22. Timer Scheduler

Timers SHALL be stored in PostgreSQL.

## 22.1 Timer Table

```text
timer_id
tenant_id
process_id
timer_type
due_at
status
payload
claimed_by
claimed_at
completed_at
```

## 22.2 Scheduler Loop

The scheduler SHALL:

* claim due timers;
* emit wake-up Commands or Process signals;
* mark timers complete;
* retry transient failures;
* avoid duplicate semantic transitions through idempotency.

---

# 23. RPH Runtime

RPH Instances SHALL be implemented as specialized durable Processes.

## 23.1 RPH Persistence

```text
rph_id
tenant_id
professional_objective
scope
authority
status
current_plan_id
coordinated_pwu_ids
child_rph_ids
active_tactics
synthesis_state
escalation_policy
resource_budget
semantic_model_version
```

## 23.2 RPH Worker Responsibilities

The RPH worker SHALL:

* inspect coordinated PWU projections;
* evaluate dependencies;
* identify required work;
* issue semantic Command proposals;
* allocate Participants and Agents;
* monitor professional progress;
* detect no-progress conditions;
* trigger tactic change;
* create Attention Items;
* initiate synthesis;
* escalate when necessary.

## 23.3 No Direct Domain Mutation

RPH workers SHALL issue Commands.

They SHALL not write PWU or Decision tables directly.

---

# 24. RPH Evaluation Cycle

A reference evaluation cycle:

```text
Load RPH State
  ↓
Load Coordination Projection
  ↓
Evaluate Objective and Current Plan
  ↓
Detect Material Changes
  ↓
Evaluate Progress and Blockages
  ↓
Evaluate Validation and Reconciliation Needs
  ↓
Evaluate Tactic Health
  ↓
Select Governed Next Actions
  ↓
Issue Commands or Create Attention
  ↓
Persist RPH Step
  ↓
Schedule Next Evaluation
```

## 24.1 Trigger Sources

RPH evaluation may be triggered by:

* relevant Event;
* timer;
* human Command;
* child RPH Event;
* Agent Execution result;
* projection catch-up;
* external callback.

---

# 25. Agent Scheduler

The Agent Scheduler allocates AI work according to:

```text
priority
tenant quota
professional urgency
agent capability
model availability
tool requirements
GPU requirement
cost budget
concurrency limit
sandbox need
```

## 25.1 Agent Queue

The initial implementation MAY use a PostgreSQL queue.

```text
agent_execution_id
tenant_id
priority
required_capabilities
resource_class
status
available_at
claimed_by
lease_expires_at
```

## 25.2 Fairness

The scheduler SHALL prevent one tenant or endeavor from consuming all agent capacity.

A reference policy MAY use:

* weighted fair scheduling;
* per-tenant concurrency limits;
* priority classes;
* reserved critical capacity.

---

# 26. Agent Worker

The Agent Worker SHALL:

1. claim an Agent Execution;
2. load the generated agent contract;
3. construct a bounded context projection;
4. enforce tool permissions;
5. invoke the selected model;
6. record tool calls;
7. persist outputs as proposals;
8. invoke required Validators;
9. emit completion or failure Events;
10. release resources.

## 26.1 Context Assembly

Context SHALL be derived from authoritative projections.

It SHALL not be assembled from arbitrary ungoverned database queries.

## 26.2 Context Limits

When context exceeds model or policy limits, the runtime SHALL:

* narrow by professional purpose;
* summarize with provenance;
* retrieve selectively;
* decompose work;
* or escalate.

It SHALL not silently omit material Constraints.

---

# 27. Model Gateway

A logical Model Gateway SHOULD abstract local and external model providers.

## 27.1 Responsibilities

```text
provider selection
authentication
request shaping
rate limiting
cost tracking
timeout
retry
response normalization
model provenance
policy enforcement
```

## 27.2 Model Identity

Every invocation SHALL persist:

```text
provider
model_name
model_version_or_snapshot
parameters
started_at
completed_at
usage
cost
```

## 27.3 Provider Failure

Provider failure SHALL be classified separately from professional failure.

---

# 28. OpenSandbox Integration

OpenSandbox SHALL provide isolated execution for:

* generated code;
* build commands;
* tests;
* repository operations;
* analysis tools;
* controlled browser or CLI automation;
* temporary development environments.

## 28.1 Sandbox Control Boundary

The Janumi runtime SHALL communicate with OpenSandbox through an explicit sandbox-control integration.

The main API process SHALL not directly launch arbitrary customer processes.

## 28.2 Sandbox Request

```text
sandbox_request_id
tenant_id
agent_execution_id
pwu_id
image_or_template
resource_limits
network_policy
filesystem_policy
environment_references
command
timeout
artifact_policy
```

## 28.3 Sandbox Result

```text
sandbox_id
status
exit_code
stdout_reference
stderr_reference
artifact_references
resource_usage
started_at
completed_at
failure_class
```

## 28.4 Isolation

Each sandbox execution SHALL define:

* CPU limit;
* memory limit;
* storage limit;
* execution deadline;
* process limit;
* network policy;
* mounted workspace;
* secret access;
* cleanup policy.

## 28.5 Network Default

Sandbox network access SHOULD default to denied or restricted.

Permitted destinations SHALL be allowlisted by policy.

## 28.6 Privilege

Privileged containers SHALL be prohibited by default.

Host socket mounting SHALL be prohibited.

## 28.7 Artifact Extraction

Only declared output paths SHALL be extracted.

Extracted files SHALL be treated as untrusted Artifacts until scanned and validated.

---

# 29. Sandbox Storage

Sandbox filesystems SHALL be ephemeral.

Persistent outputs SHALL be copied to:

* object storage;
* repository integration;
* governed Artifact storage.

## 29.1 Workspace Isolation

Tenant and PWU workspaces SHALL use distinct paths and authorization.

## 29.2 Cleanup

Expired sandboxes SHALL be terminated and deleted.

Cleanup failure SHALL be observable.

---

# 30. Repository Integration

Source repositories MAY be external authoritative systems.

The runtime SHALL store:

```text
repository_id
provider
tenant_id
external_reference
default_branch
credential_reference
sync_policy
last_observed_commit
```

## 30.1 Repository Operations

Repository changes SHALL be tied to:

* PWU;
* Decision;
* Agent Execution;
* Command;
* provenance.

## 30.2 Git Commit

A commit is an Artifact and Observation of implementation state.

It SHALL not automatically prove:

* requirement satisfaction;
* validation success;
* PWU completion.

---

# 31. Object Storage

Large binary and document Artifacts SHOULD use S3-compatible storage.

## 31.1 Artifact Metadata

PostgreSQL SHALL retain authoritative metadata:

```text
artifact_id
tenant_id
object_key
content_hash
content_type
size
created_by
created_at
source_context
malware_scan_status
retention_policy
encryption_status
```

## 31.2 Object Key Isolation

Object keys SHALL include opaque tenant-scoped prefixes.

Tenant names and sensitive metadata SHOULD not be directly exposed in object paths.

## 31.3 Integrity

Artifacts SHALL use cryptographic content hashes.

---

# 32. Artifact Security

Uploaded or generated Artifacts SHALL be scanned where appropriate.

Potential controls:

* malware scanning;
* content-type verification;
* archive expansion limits;
* document sanitization;
* executable-file policy;
* PII and sensitive-data classification.

An Artifact SHALL not be trusted solely because an AI Agent generated it.

---

# 33. Attention Service

The Attention Service SHALL maintain durable professional intervention state.

## 33.1 Attention Table

```text
attention_id
tenant_id
attention_type
professional_context
required_role
required_authority
priority
status
created_at
due_at
assigned_to
disposition
resolved_at
```

## 33.2 Notifications

Email, push, or chat notifications MAY be emitted from Attention Items.

Notification delivery SHALL not replace durable Attention state.

---

# 34. Reconciliation Service

The Reconciliation Service SHALL:

* open cases;
* load affected semantic state;
* calculate impact;
* assemble before-and-after projections;
* coordinate review;
* issue accepted Commands;
* track partial application;
* preserve prior state;
* escalate unresolved conflicts.

## 34.1 Initial Detection

JSRP v0.1 MAY detect reconciliation needs from:

* explicit contradiction Events;
* invalidated assumptions;
* failed validations;
* changed Intent;
* stale dependency state;
* cross-PWU mismatch;
* manual request.

Advanced inference may follow later.

---

# 35. Authority Service

The Authority Service SHALL evaluate generated JSDL permission definitions plus runtime policy.

## 35.1 Inputs

```text
principal
participant
roles
delegations
tenant
organization
target
command
currentState
policy
time
```

## 35.2 Caching

Authority results MAY be cached only for short-lived read operations.

State-changing Commands SHALL re-evaluate authority.

## 35.3 Policy Store

Organization and PWA policies SHALL be versioned and auditable.

---

# 36. Validation Service

The Validation Service SHALL execute:

* generated structural Validators;
* invariant expressions;
* policy Validators;
* domain Validators;
* external Validators;
* AI-assisted Validators;
* human-validation Processes.

## 36.1 Validator Registry

Validators SHALL be registered by:

```text
validator_id
validator_version
validator_type
implementation
input_contract
output_contract
timeout
failure_policy
```

## 36.2 Safe Failure

Validator unavailability SHALL result in:

* fail;
* inconclusive;
* retry;
* or escalation,

according to declared policy.

It SHALL not default silently to pass.

---

# 37. API Layer

The API Layer SHALL expose:

* semantic Command submission;
* projection queries;
* entity inspection;
* history;
* Attention disposition;
* Process state;
* integration callbacks;
* administrative operations.

## 37.1 API Separation

State-changing and read-only operations SHOULD be logically separated.

## 37.2 Generated Contracts

Command and Event payloads SHALL be generated from JSDL.

## 37.3 Error Responses

API failures SHALL contain:

```text
errorCode
category
professionalMessage
technicalReference
retryable
currentVersion
recommendedDisposition
correlationId
```

---

# 38. Authentication

The runtime MAY integrate with:

* OIDC;
* SAML through an identity broker;
* enterprise identity providers;
* service accounts;
* API keys for limited integrations;
* workload identity.

## 38.1 Session Management

Interactive clients SHOULD use short-lived tokens and secure server-managed sessions where appropriate.

## 38.2 Service Identity

Every worker and service SHALL possess a distinct workload identity or logical service identity.

---

# 39. Secrets Management

Secrets SHALL not be stored in:

* JSDL source;
* Event payloads;
* logs;
* projection tables;
* Agent prompts;
* source repositories.

## 39.1 Initial Profile

The initial deployment MAY use:

* container secrets;
* encrypted environment files;
* a local secrets manager.

Production use SHOULD prefer a dedicated secrets service or encrypted secret store.

## 39.2 Secret References

Domain and runtime records SHALL store secret references, not secret values.

---

# 40. OpenTelemetry

All runtime components SHALL emit OpenTelemetry-compatible:

* traces;
* metrics;
* logs.

## 40.1 Required Trace Attributes

```text
tenant.id
organization.id
endeavor.id
pwu.id
rph.id
command.id
command.type
aggregate.id
aggregate.version
event.id
process.id
agent_execution.id
participant.id
correlation.id
causation.id
semantic_model.version
```

Sensitive values SHALL not be included.

## 40.2 Trace Boundaries

Required spans include:

```text
http.request
command.execute
authority.evaluate
aggregate.load
validator.execute
transaction.commit
outbox.publish
projection.apply
process.step
rph.evaluate
agent.execute
tool.call
sandbox.execute
reconciliation.apply
```

---

# 41. Metrics

## 41.1 Runtime Metrics

```text
command_requests_total
command_rejections_total
command_latency_seconds
concurrency_conflicts_total
validator_failures_total
event_outbox_lag_seconds
projection_lag_events
process_wait_seconds
agent_queue_depth
agent_execution_seconds
sandbox_active_count
sandbox_failure_total
database_connection_usage
```

## 41.2 Cognitive Metrics

```text
open_uncertainty_count
unsupported_claim_count
critical_assumption_count
decision_wait_seconds
validation_backlog
reconciliation_backlog
blocked_pwu_count
tactic_change_count
escalation_count
synthesis_pending_count
human_attention_backlog
```

## 41.3 Metric Scope

Metrics SHALL be tenant-safe.

Cross-tenant administrative metrics SHALL avoid exposing sensitive semantic content.

---

# 42. Logging

Logs SHALL be structured.

## 42.1 Required Fields

```text
timestamp
severity
service
instance
message
correlation_id
tenant_id_hash
command_id
process_id
agent_execution_id
error_code
```

## 42.2 Log Prohibitions

Logs SHALL not contain:

* secrets;
* raw access tokens;
* full prompts by default;
* protected Evidence content;
* unrestricted user documents;
* database passwords;
* sandbox secret values.

---

# 43. Health Model

Each component SHALL expose:

```text
liveness
readiness
startup
dependency_status
```

## 43.1 Liveness

Indicates the process can continue operating.

## 43.2 Readiness

Indicates the component can safely accept work.

A process worker SHOULD become unready when it cannot access PostgreSQL.

## 43.3 Degraded State

The overall runtime MAY operate in degraded mode when:

* projection workers lag;
* external model provider is unavailable;
* sandbox service is unavailable;
* object storage is degraded.

Degradation SHALL be visible and capability-specific.

---

# 44. Resource Scheduling

The single host SHALL enforce resource boundaries.

## 44.1 Resource Classes

```text
api
database
projection
process
agent_cpu
agent_gpu
sandbox_small
sandbox_medium
sandbox_large
observability
```

## 44.2 Reservations

PostgreSQL and core runtime services SHALL retain reserved capacity.

Sandbox and Agent workloads SHALL not exhaust resources needed for authoritative Command processing.

## 44.3 Admission Control

The scheduler SHALL reject or queue work when capacity is insufficient.

It SHALL not overcommit without policy.

---

# 45. GPU Scheduling

Where the host includes one GPU, GPU access SHALL be centrally scheduled.

## 45.1 Default Policy

Only one high-memory model workload SHOULD control the GPU at a time unless validated sharing is configured.

## 45.2 GPU Job Record

```text
job_id
agent_execution_id
model
estimated_memory
priority
status
started_at
completed_at
```

## 45.3 CPU Fallback

A CPU fallback SHALL be explicit.

It SHALL not silently change performance or quality assumptions.

---

# 46. Backpressure

Backpressure thresholds SHALL exist for:

* Command queue;
* outbox;
* projection lag;
* Process queue;
* Agent queue;
* sandbox capacity;
* database connections;
* object storage;
* observability pipeline.

## 46.1 Response

Backpressure may trigger:

* admission rejection;
* delayed availability;
* lower-priority deferral;
* tenant throttling;
* Attention Item;
* operational alert.

## 46.2 Professional Priority

Safety-, security-, legal-, or incident-related work MAY receive reserved priority.

---

# 47. Failure Isolation

Even on one node, logical failure isolation SHALL be maintained.

Examples:

* projection failure does not prevent authoritative Command execution unless the Command depends on current projection state;
* Agent worker failure does not corrupt Process state;
* sandbox failure does not crash the API process;
* observability backend failure does not block core transactions;
* external provider failure does not erase queued work.

---

# 48. Restart and Recovery

After process restart, the runtime SHALL recover:

* accepted Commands;
* Event history;
* pending outbox messages;
* Process Instances;
* leases;
* timers;
* Agent Executions;
* external operations;
* projection checkpoints;
* Attention Items;
* reconciliation cases.

## 48.1 Lease Expiration

Abandoned leases SHALL become reclaimable.

## 48.2 Unknown External Outcome

If a worker crashes after invoking an external operation but before recording the result, recovery SHALL inspect the external-operation record and use idempotency or status inquiry.

It SHALL not blindly repeat a potentially non-idempotent Action.

---

# 49. Backup Architecture

The single-node profile SHALL implement:

* PostgreSQL backups;
* write-ahead-log archiving or equivalent;
* object-storage backup;
* configuration backup;
* JSDL source and generated artifact backup;
* secrets backup under separate protection;
* restore testing.

## 49.1 Recovery Objectives

Initial targets SHOULD be declared explicitly.

Example profile:

```text
RPO: 15 minutes
RTO: 4 hours
```

Production commitments SHALL reflect actual tested capability.

## 49.2 Backup Isolation

Backups SHALL not exist only on the same physical disk or host.

## 49.3 Restore Testing

Restores SHALL be tested regularly.

A backup that has not been restored is not considered verified.

---

# 50. PostgreSQL Recovery

Recommended controls:

* periodic full backup;
* WAL archiving;
* checksums;
* automated backup verification;
* documented point-in-time recovery;
* role and privilege backup;
* migration history retention.

## 50.1 Event Integrity

Restore verification SHALL confirm:

* Aggregate versions align with Events;
* outbox state is valid;
* projection checkpoints do not exceed restored Event position;
* idempotency records remain consistent.

---

# 51. Projection Recovery

After database recovery:

* derived projections MAY be rebuilt;
* checkpoints SHALL be reset if inconsistent;
* authoritative state and Events take precedence.

Projection tables SHOULD not determine recovery correctness.

---

# 52. Disaster Recovery Limitation

Single-node JSRP cannot remain available during total host failure.

The profile SHALL therefore rely on:

* infrastructure replacement;
* data restoration;
* configuration reapplication;
* service restart;
* projection rebuild.

This limitation SHALL be explicit.

---

# 53. Security Hardening

The host SHALL follow a hardened baseline.

Controls SHOULD include:

* minimal installed packages;
* disabled password SSH authentication;
* key-based administrative access;
* host firewall;
* automatic security updates under controlled policy;
* restricted administrative users;
* audit logging;
* encrypted storage where required;
* time synchronization;
* secure boot where supported;
* container isolation;
* image scanning;
* dependency scanning.

---

# 54. Network Zones

A reference host SHOULD separate logical networks:

```text
edge
application
data
sandbox
observability
management
```

Docker or container network policies SHALL restrict unnecessary communication.

## 54.1 PostgreSQL

PostgreSQL SHALL not be exposed publicly.

## 54.2 Sandbox

Sandbox workloads SHALL not freely access the data network.

## 54.3 Management

Administrative interfaces SHALL be restricted.

---

# 55. Ingress

The reverse proxy SHALL provide:

* TLS termination or passthrough;
* routing;
* request limits;
* security headers;
* access logging;
* optional rate limiting;
* WebSocket support where required.

Direct public access to internal runtime ports SHALL be prohibited.

---

# 56. Egress

Application and Agent egress SHOULD be policy-controlled.

## 56.1 External Model Providers

Only approved providers and endpoints SHALL be permitted.

## 56.2 Sandbox Egress

Sandbox egress SHALL use a stricter policy than application egress.

## 56.3 Audit

Sensitive external data transfers SHOULD be auditable.

---

# 57. Container Image Policy

Production images SHALL:

* use pinned versions or digests;
* run as non-root where practical;
* contain minimal tools;
* avoid embedded secrets;
* be scanned;
* expose declared ports only;
* use read-only root filesystems where possible;
* define resource limits;
* define health checks.

---

# 58. Database Roles

Separate PostgreSQL roles SHOULD exist for:

```text
migration
runtime_command
runtime_projection
runtime_process
runtime_audit
read_only_admin
backup
```

## 58.1 Least Privilege

Projection workers SHALL not possess authority to mutate authoritative semantic tables.

## 58.2 Migration Role

Schema migration authority SHALL not be granted to normal runtime workers.

---

# 59. Schema Migration

Migrations SHALL be generated or informed by JSDL model changes.

## 59.1 Migration Phases

```text
expand
migrate
dual-read or dual-write if required
validate
contract
```

## 59.2 Destructive Changes

Destructive migrations SHALL require:

* explicit review;
* backup;
* compatibility analysis;
* rollback or recovery plan;
* semantic migration assessment.

---

# 60. Semantic Model Deployment

Each runtime release SHALL bundle:

* JSDL source version;
* canonical IR fingerprint;
* generated contract version;
* migration version;
* runtime compatibility declaration.

## 60.1 Startup Validation

At startup, the runtime SHALL verify that:

* database semantic model version is supported;
* generated contracts match expected fingerprint;
* required migrations are applied;
* projection schemas are compatible;
* runtime profile version is declared.

---

# 61. Development Environment

The development profile SHOULD use the same semantic architecture with reduced operational complexity.

It MAY use:

* Docker Compose;
* local PostgreSQL;
* local object storage;
* simplified observability;
* local model provider;
* local OpenSandbox.

It SHALL not replace semantic Commands with direct database mutation merely for convenience.

---

# 62. Test Environment

The test runtime SHALL support:

* deterministic clocks;
* fake external providers;
* in-memory or isolated PostgreSQL schemas;
* Process fast-forwarding;
* timer control;
* Event inspection;
* projection rebuild;
* sandbox stubs;
* model-provider stubs;
* failure injection.

## 62.1 Transactional Test Isolation

Tests SHOULD use isolated tenants, schemas, or databases.

---

# 63. Operational Administration

Administrative capabilities SHOULD include:

```text
inspect Command
inspect Event
inspect Aggregate
inspect Process
retry outbox
rebuild projection
resume Process
cancel Process
inspect lease
inspect Agent Execution
inspect sandbox
open reconciliation
restore dead-letter item
```

Administrative actions SHALL be audited.

## 63.1 No Direct Semantic Editing

Administrators SHALL not directly edit authoritative professional rows through generic database tools as a normal operational procedure.

Corrections SHOULD use Commands or governed migration utilities.

---

# 64. Dead-Letter Handling

Failures that exceed retry policy SHALL enter a dead-letter state.

## 64.1 Dead-Letter Categories

```text
event_publication
projection_processing
external_callback
external_operation
agent_tool
process_step
notification
```

## 64.2 Dead-Letter Record

```text
item_id
item_type
original_reference
failure
attempts
first_failed_at
last_failed_at
recommended_action
status
```

## 64.3 Resolution

Resolution MAY:

* retry;
* skip with authorization;
* repair data;
* open reconciliation;
* escalate;
* mark irrecoverable.

---

# 65. Audit Model

Audit SHALL capture:

* authentication events;
* authority changes;
* Command acceptance and rejection;
* administrative actions;
* protected Evidence access;
* secret-reference use;
* model-provider invocation;
* sandbox execution;
* semantic model deployment;
* backup and restore;
* exception grants.

Audit records SHALL be append-only or tamper-evident.

---

# 66. Retention

Retention policies SHALL distinguish:

```text
Events
Commands
Audit
Projection Data
Agent Prompts
Agent Outputs
Artifacts
Sandbox Logs
Operational Logs
Traces
Metrics
Backups
```

## 66.1 Semantic History

Material professional Events and Decisions SHOULD retain long-term according to organizational and regulatory requirements.

## 66.2 Projection Data

Derived projection data MAY be deleted and rebuilt.

## 66.3 Agent Context

Full Agent context MAY require shorter retention than resulting professional entities.

---

# 67. Privacy and Sensitive Data

The runtime SHALL support classification of:

* personal data;
* sensitive professional Evidence;
* regulated information;
* proprietary source code;
* legal material;
* health information;
* export-controlled information.

## 67.1 Context Minimization

Agent context SHALL include only the information required for the assigned objective.

## 67.2 Provider Policy

External model providers SHALL receive data only where policy permits.

---

# 68. Scaling Within the Single Node

The profile MAY scale vertically through:

* more CPU;
* more memory;
* faster storage;
* more database connections within safe limits;
* separate worker processes;
* worker concurrency;
* one or more GPUs.

## 68.1 Scale Boundaries

The runtime SHALL monitor when:

* PostgreSQL saturation;
* disk I/O;
* projection lag;
* Agent queue depth;
* sandbox contention;
* memory pressure;
* GPU queue;
* backup duration

approach unacceptable thresholds.

---

# 69. Migration Triggers to Distributed Runtime

A distributed runtime SHOULD be considered when one or more conditions become persistent:

```text
host availability no longer meets business requirements
database workload exceeds safe vertical scaling
agent and sandbox workloads interfere with core services
projection lag becomes operationally unacceptable
tenant isolation requires dedicated compute
GPU demand exceeds single-host scheduling
backup and restore windows become excessive
enterprise customers require separate execution domains
regulatory constraints require workload separation
```

---

# 70. Distribution Preparation

JSRP SHALL prepare for future distribution by preserving:

* explicit service boundaries;
* generated contracts;
* outbox Events;
* idempotency;
* Process durability;
* worker leases;
* partitionable queues;
* projection checkpoints;
* tenant-scoped data;
* external object storage abstraction.

The first implementation SHALL avoid:

* in-process-only correctness;
* unversioned internal message payloads;
* hidden shared memory state;
* cross-component direct table mutation;
* non-idempotent worker assumptions.

---

# 71. Initial Distributed Extraction Order

When scaling beyond one node, the recommended extraction order is:

1. sandbox execution;
2. Agent workers;
3. projection workers;
4. Process and RPH workers;
5. object storage;
6. observability stack;
7. read-only projection service;
8. Command service;
9. PostgreSQL high availability or managed database.

Authoritative semantics SHALL remain unchanged.

---

# 72. Docker Compose Profile

The first deployment MAY use Docker Compose.

## 72.1 Required Volumes

```text
postgres_data
object_storage_data
otel_data
metrics_data
logs_data
traces_data
sandbox_workspace
```

## 72.2 Restart Policies

Core services SHOULD use appropriate restart policies.

Process durability SHALL not depend on container persistence.

## 72.3 Resource Limits

Compose configuration SHALL define limits or reservations for high-risk workloads.

---

# 73. Single-Node RKE2 Profile

RKE2 MAY be used when Kubernetes-compatible operations are desired.

## 73.1 Appropriate Reasons

* future migration to multi-node Kubernetes;
* standardized deployment manifests;
* workload resource controls;
* secret and configuration management;
* service isolation;
* customer operational requirements.

## 73.2 Inappropriate Assumption

Single-node RKE2 does not provide host-level high availability.

It SHALL not be presented as an HA deployment merely because Kubernetes is present.

## 73.3 Persistent Storage

Persistent volumes SHALL map to reliable host or external storage.

## 73.4 Control Plane Protection

The RKE2 control plane and PostgreSQL SHALL have reserved resources.

Sandbox workloads SHALL not starve them.

---

# 74. Reference Service Deployment

A minimal deployment MAY use:

```text
janumi-web
janumi-runtime
janumi-worker
janumi-agent-worker
janumi-sandbox-controller
postgres
object-store
otel-collector
prometheus-compatible-metrics
loki-compatible-logs
tempo-compatible-traces
traefik
```

The specific products behind metrics, logs, and traces MAY vary.

---

# 75. Availability Model

JSRP SHALL declare availability by capability.

Example:

```text
Authoritative Commands: available when API and PostgreSQL are healthy
Projection Queries: may be degraded during projection failure
Agent Execution: may be unavailable while core Commands continue
Sandbox Execution: may be unavailable while review and Decisions continue
External Integrations: capability-specific
```

This is preferable to one binary “system up” indicator.

---

# 76. Graceful Degradation

Examples:

## 76.1 Model Provider Unavailable

The runtime SHALL:

* queue or fail Agent work;
* preserve PWU state;
* permit human work;
* expose degraded AI capability.

## 76.2 Sandbox Unavailable

The runtime SHALL:

* stop new sandbox Actions;
* preserve existing professional state;
* permit planning, review, and Decision activity.

## 76.3 Projection Worker Failed

The runtime SHALL:

* mark projections stale;
* continue authoritative Commands where safe;
* prevent unsafe Commands from stale views;
* alert operations.

## 76.4 Observability Backend Failed

The runtime SHALL continue core semantic transactions where safe and buffer or degrade telemetry.

---

# 77. Operational Runbooks

At minimum, runbooks SHALL exist for:

```text
PostgreSQL unavailable
projection lag
outbox backlog
Process stuck
lease recovery
Agent queue saturation
sandbox cleanup failure
object storage failure
backup failure
restore
semantic model migration failure
RLS policy failure
disk capacity exhaustion
certificate renewal
external model outage
```

---

# 78. JSRP Invariants

## JSRP-INV-001 — PostgreSQL Authority

PostgreSQL authoritative tables and committed Events constitute runtime truth.

## JSRP-INV-002 — Outbox Atomicity

Outbox records SHALL commit atomically with authoritative state and Events.

## JSRP-INV-003 — Projection Derivation

Projection tables SHALL remain rebuildable.

## JSRP-INV-004 — Durable Processes

Process and RPH correctness SHALL survive process restart.

## JSRP-INV-005 — Worker Idempotency

Workers SHALL tolerate duplicate delivery or lease recovery.

## JSRP-INV-006 — Tenant Scope

Every authoritative and runtime record SHALL be tenant-scoped.

## JSRP-INV-007 — Sandbox Isolation

Sandbox workloads SHALL not possess direct database or host control access.

## JSRP-INV-008 — Core Resource Protection

Agent and sandbox workloads SHALL not exhaust resources required for Command processing and PostgreSQL.

## JSRP-INV-009 — Observable Degradation

Capability degradation SHALL be visible.

## JSRP-INV-010 — Off-Host Backup

Recoverable backups SHALL exist outside the runtime host.

## JSRP-INV-011 — Generated Contract Consistency

Runtime contracts SHALL match the deployed JSDL model fingerprint.

## JSRP-INV-012 — No Direct Projection Mutation

Projection workers SHALL not mutate authoritative semantic state.

## JSRP-INV-013 — No Hidden External Completion

External operation success SHALL not imply professional completion.

## JSRP-INV-014 — Administrative Audit

Administrative recovery and override actions SHALL be audited.

## JSRP-INV-015 — Explicit Single-Node Limitation

The deployment SHALL not claim host-failure high availability.

---

# 79. Acceptance Scenarios

## Scenario A — Command and Event Commit

Given:

* an authorized Command;
* valid expected version;
* passing Validators;

When:

* the Command executes;

Then:

* authoritative state updates;
* version increments;
* Event persists;
* Command result persists;
* idempotency persists;
* outbox record persists;
* all commit in one PostgreSQL transaction.

---

## Scenario B — Projection Worker Failure

Given:

* authoritative Events continue to commit;
* the PWU projection worker fails;

When:

* users query PWU overview;

Then:

* the projection is marked stale;
* last update position is shown;
* unsafe Commands require fresh version validation;
* the worker may resume from its checkpoint.

---

## Scenario C — Runtime Restart During Human Wait

Given:

* an RPH is waiting for an architecture approval;

When:

* runtime containers restart;

Then:

* Process state is restored from PostgreSQL;
* Attention Item remains assigned;
* the approval response can resume the RPH;
* no duplicate approval request is created.

---

## Scenario D — Sandbox Escape Prevention

Given:

* an Agent requests code execution;

When:

* the sandbox starts;

Then:

* no Docker socket is mounted;
* the database network is inaccessible;
* CPU, memory, storage, and time limits apply;
* only declared Artifacts are extracted;
* execution provenance is recorded.

---

## Scenario E — Tenant Isolation

Given:

* Participant A belongs to Tenant A;
* PWU B belongs to Tenant B;

When:

* Participant A requests PWU B;

Then:

* application scoping rejects access;
* RLS rejects unscoped database access;
* the attempt is audited;
* no PWU metadata leaks.

---

## Scenario F — Agent Capacity Exhaustion

Given:

* all Agent worker capacity is in use;

When:

* a new low-priority Agent Execution is requested;

Then:

* the execution is queued;
* core Command service remains responsive;
* higher-priority reserved work may proceed;
* queue depth and wait time are observable.

---

## Scenario G — Backup Recovery

Given:

* the host is lost;

When:

* a replacement host is provisioned;

Then:

* PostgreSQL is restored;
* object storage is restored or reconnected;
* semantic model compatibility is verified;
* projection checkpoints are validated or reset;
* pending Processes resume;
* runtime conformance checks pass before accepting traffic.

---

# 80. Initial Implementation Backlog

## Epic 1 — PostgreSQL Foundation

```text
JSRP-001 Create schema domains
JSRP-002 Implement tenant-scoped connection context
JSRP-003 Implement RLS baseline
JSRP-004 Implement migration framework
JSRP-005 Implement semantic model version table
```

## Epic 2 — Command Core

```text
JSRP-010 Implement Command persistence
JSRP-011 Implement idempotency store
JSRP-012 Implement Aggregate repository
JSRP-013 Implement authority interface
JSRP-014 Implement Command transaction
JSRP-015 Implement professional errors
```

## Epic 3 — Event and Outbox

```text
JSRP-020 Implement append-only Event table
JSRP-021 Enforce Aggregate version uniqueness
JSRP-022 Implement transactional outbox
JSRP-023 Implement outbox worker
JSRP-024 Implement dead-letter handling
```

## Epic 4 — Projections

```text
JSRP-030 Implement projection checkpoint model
JSRP-031 Implement PWU overview projection
JSRP-032 Implement history projection
JSRP-033 Implement Decision projection
JSRP-034 Implement Attention projection
JSRP-035 Implement rebuild command
```

## Epic 5 — Durable Processes

```text
JSRP-040 Implement Process Instance store
JSRP-041 Implement leases
JSRP-042 Implement timer scheduler
JSRP-043 Implement waiting and resumption
JSRP-044 Implement retry policies
JSRP-045 Implement Process recovery
```

## Epic 6 — RPH Runtime

```text
JSRP-050 Implement RPH state store
JSRP-051 Implement evaluation cycle
JSRP-052 Implement PWU event triggers
JSRP-053 Implement no-progress detection
JSRP-054 Implement tactic change
JSRP-055 Implement escalation
JSRP-056 Implement synthesis queue
```

## Epic 7 — Agent Runtime

```text
JSRP-060 Implement Agent Execution store
JSRP-061 Implement Agent queue
JSRP-062 Implement fair scheduling
JSRP-063 Implement Model Gateway
JSRP-064 Implement tool-call provenance
JSRP-065 Implement context projection
JSRP-066 Implement proposal conversion
```

## Epic 8 — OpenSandbox

```text
JSRP-070 Implement sandbox controller client
JSRP-071 Define sandbox templates
JSRP-072 Implement resource and network policy
JSRP-073 Implement Artifact extraction
JSRP-074 Implement cleanup
JSRP-075 Implement sandbox audit and telemetry
```

## Epic 9 — Observability

```text
JSRP-080 Integrate OpenTelemetry SDK
JSRP-081 Deploy collector
JSRP-082 Implement required traces
JSRP-083 Implement runtime metrics
JSRP-084 Implement cognitive metrics
JSRP-085 Implement structured logging
```

## Epic 10 — Recovery and Operations

```text
JSRP-090 Implement backup jobs
JSRP-091 Implement WAL archive
JSRP-092 Implement restore verification
JSRP-093 Create health endpoints
JSRP-094 Create operational administration UI
JSRP-095 Create runbooks
JSRP-096 Create runtime conformance test suite
```

---

# 81. Implementation Milestones

## Milestone 1 — Authoritative Semantic Core

Delivers:

* PostgreSQL schema;
* Command service;
* Aggregate persistence;
* optimistic concurrency;
* Events;
* idempotency;
* outbox.

## Milestone 2 — Read Model and Workbench Support

Delivers:

* projection workers;
* PWU overview;
* Decision and Attention projections;
* history;
* stale-state disclosure.

## Milestone 3 — Durable Coordination

Delivers:

* Process runtime;
* timers;
* human waiting;
* RPH baseline;
* escalation.

## Milestone 4 — Agentic Execution

Delivers:

* Agent scheduling;
* Model Gateway;
* tool provenance;
* OpenSandbox;
* governed proposal flow.

## Milestone 5 — Production Operations

Delivers:

* observability;
* backup;
* restore;
* security hardening;
* administrative controls;
* conformance tests.

---

# 82. Coding Agent Implementation Contract

The coding agent implementing JSRP SHALL:

1. Preserve JEM semantics over deployment convenience.
2. Use PostgreSQL transactions for authoritative mutation.
3. Never write projections and treat them as authoritative.
4. Implement tenant scope in every repository and query.
5. use generated JSDL contracts.
6. enforce optimistic concurrency.
7. persist Events and outbox atomically.
8. make workers idempotent.
9. persist Process state before waiting.
10. use leases for recoverable work claiming.
11. protect PostgreSQL and API resources from Agent and sandbox exhaustion.
12. isolate sandbox networking and filesystems.
13. record Agent, model, tool, and sandbox provenance.
14. expose stale projection state.
15. implement off-host backups.
16. test restart recovery.
17. test tenant isolation.
18. test duplicate delivery.
19. test host-resource saturation.
20. document every deviation from this profile as an Architecture Decision.

---

# 83. Resulting Initial Platform

The resulting single-node Janumi deployment is not a prototype that must later be discarded.

It is a bounded implementation of the same semantic and execution architecture intended for future distributed operation.

It provides:

* one authoritative semantic model;
* one transactional Command boundary;
* immutable professional history;
* durable recursive coordination;
* governed AI participation;
* isolated execution;
* continuously updated projections;
* explicit reconciliation;
* professional and computational observability.

Its limitation is primarily infrastructure redundancy, not conceptual architecture.

That distinction allows Janumi to begin economically on one server while avoiding the semantic and operational shortcuts that commonly prevent early systems from scaling into enterprise platforms.

---

# 84. Next Required Artifact

The next artifact is the **JanumiCode Professional Work Architecture Profile v0.1**.

It shall specialize the canonical discipline and runtime for product realization and define:

* software-product Outcomes and Intents;
* JanumiCode PWU types;
* product-realization lifecycle;
* requirements, user journeys, architecture, data, implementation, verification, release, and operations Representations;
* product-specific Validators;
* coding-agent roles;
* decomposition and recomposition rules;
* invariant generation and enforcement;
* UI workspace specialization;
* repository and CI/CD integration;
* production Observation and reconciliation;
* the concrete end-to-end experience the current coding agent must implement.
