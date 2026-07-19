# JAN-IRP-004 — Repository Investigation and Evidence Acquisition

**Version:** 0.3.0  
**Status:** Proposed Normative Draft  
**Program phase:** `P1`  
**Purpose:** Acquire, preserve, inventory, and qualify the repository and operational material required to reconstruct the current implementation without contaminating the evidence.

## 1. Investigation outcome

The exact repository revision, build environment, generated artifacts, data migrations, runtime configuration, tests, user-interface surfaces, integrations, and relevant operational context are preserved and indexed as reproducible current-state evidence.

## 2. Evidence principle

The repository is not merely implementation material to be changed. During P1 it is a primary evidence source showing what the system currently represents and does.

Evidence shall be preserved before remediation begins.

## 3. Required inputs

```text
Repository archive or accessible clone
Branch and revision information
Submodule and dependency sources
Build and test instructions
Environment configuration references
Deployment manifests
Database schema and migrations
Generated artifacts required to reproduce behavior
Available runtime or operational evidence
Normative corpus baseline from P0
```

Missing inputs shall be recorded rather than silently reconstructed.

## 4. Execution-context record

Before inspection, record:

```text
assessmentId
repositoryUriOrArchiveId
repositoryRoot
commitHash
branch
worktreeStatus
submodules
assessmentStartTime
hostOS
toolVersions
runtimeVersions
environmentProfile
networkAccessPolicy
credentialsUsedAsReferences
investigator
reviewer
```

Secrets shall never be embedded in the record.

## 5. Repository preservation

The investigation shall preserve:

- original archive or clone identity;
- Git commit and branch;
- uncommitted changes and ignored material where relevant;
- submodule revisions;
- large-file references;
- generated code or schemas required by the build;
- dependency lockfiles;
- migration state;
- deployment manifests;
- configuration templates;
- relevant documentation.

Where a dirty worktree exists, the exact diff shall be captured before any investigative operation.

## 6. Write boundary

### 6.1 Default rule

P1 is read-mostly. The investigator shall not perform product remediation, refactoring, formatting, dependency upgrades, migration execution against authoritative data, or generated-file replacement.

### 6.2 Permitted investigative derivatives

The investigator may create files outside the assessed repository or under a clearly isolated program-instance directory, including:

- inventories;
- hashes;
- build logs;
- test logs;
- static-analysis outputs;
- diagrams;
- copied schemas;
- temporary test databases;
- sandbox execution outputs.

### 6.3 Investigative instrumentation

Instrumentation inside a disposable clone may be authorized when necessary to observe behavior. It shall:

- be recorded as investigative-only;
- be applied after preserving the original revision;
- remain reversible;
- not be conflated with product implementation;
- produce a separate derivative revision or patch;
- identify the exact question it resolves.

## 7. Baseline build and test

Run the documented baseline build and tests before changing dependencies or code.

Record:

```text
command
workingDirectory
environment
startedAt
completedAt
exitCode
stdoutReference
stderrReference
producedArtifacts
resourceUse
failureClassification
```

A failing baseline is evidence. It shall not be repaired during P1 merely to obtain a clean report.

## 8. Required inventory domains

### 8.1 Repository topology

- packages, applications, services, libraries, plugins, extensions;
- monorepo/workspace boundaries;
- generated and vendored material;
- ownership or CODEOWNERS;
- build graph.

### 8.2 Semantic and domain implementation

- entities, value objects, enums, relationships;
- PWU, PWA, RPH, Intent, Outcome, Evidence, Decision, Reconciliation concepts or analogues;
- state machines and status values;
- validation and invariant logic;
- schema or contract definitions.

### 8.3 Backend and API

- routes, RPCs, GraphQL, messages, callbacks;
- generic CRUD and semantic commands;
- authorization and authentication;
- transaction boundaries;
- event publication;
- background jobs and processes.

### 8.4 Data and persistence

- databases, tables, schemas, migrations;
- tenant and organization keys;
- relationship representation;
- event, outbox, audit, and history tables;
- object storage and artifact metadata;
- backup and restore scripts.

### 8.5 Frontend and experience

- application shells;
- route hierarchy;
- navigation;
- PWU/PWA/RPH authoring and operation screens;
- state management;
- forms and mutation patterns;
- graph/canvas tooling;
- accessibility tests;
- stale, error, and historical states.

### 8.6 Agents and orchestration

- agent definitions and prompts;
- model gateways;
- tool permissions;
- sandbox execution;
- context assembly;
- validation and approval boundaries;
- workflow engines and durable processes;
- retries, tactic changes, and escalation.

### 8.7 Testing and assurance

- unit, integration, end-to-end, property, security, accessibility, and conformance tests;
- fixtures and test data;
- CI gates;
- static analysis;
- test coverage and known exclusions;
- failure-injection and recovery tests.

### 8.8 Runtime and deployment

- container and orchestration manifests;
- environment profiles;
- secrets references;
- resource limits;
- network boundaries;
- observability;
- backups;
- recovery;
- health and operational tooling.

### 8.9 Documentation and decisions

- ADRs;
- READMEs;
- specifications;
- code comments with semantic meaning;
- diagrams;
- changelogs;
- issue references;
- known deviations.

## 9. Evidence identity

Every evidence item shall receive:

```text
evidenceId
evidenceType
sourceLocation
repositoryRevision
lineOrRange
commandOrObservation
contentHash
collectedBy
collectedAt
reproducibilityInstructions
reliability
limitations
```

Example:

```text
EV-REPO-00421
SOURCE_CODE
services/pwu/domain.ts:L88-L143
commit 4f21...
sha256:...
Demonstrates one lifecycle status field and no cognitive-state field.
```

## 10. Evidence strength

```text
DIRECT       Source, schema, test, runtime trace, or deployed behavior directly demonstrates the claim.
CORROBORATED Multiple independent evidence items support the claim.
INFERRED     Architecture or behavior is inferred but not directly observed.
CLAIMED      Documentation or participant assertion is not yet corroborated.
UNKNOWN      Evidence is absent or inaccessible.
```

Current-state models shall disclose evidence strength.

## 11. Runtime observation

Where execution is possible, observe at least:

- startup and health;
- authentication and tenant context;
- representative read and mutation paths;
- state transitions;
- validation failure;
- concurrency behavior;
- background work;
- agent execution;
- error handling;
- telemetry;
- restart behavior.

Runtime observation shall use non-production or explicitly authorized environments and data.

## 12. Database investigation

The investigator shall distinguish:

- schema definition;
- migration history;
- actual deployed schema;
- current data characteristics;
- derived or cached projections;
- authoritative versus operational tables.

Production data shall not be copied or exposed without authorization. Samples shall be minimized and sanitized.

## 13. Generated artifacts

Generated artifacts shall be identified with:

```text
generator
sourceInputs
generatorVersion
outputLocation
reproducibility
manualModificationPolicy
```

The investigation shall determine whether generated files or hand-authored files currently govern behavior.

## 14. Operational evidence

When available, capture:

- deployment versions;
- service inventory;
- logs, traces, and metrics;
- incidents;
- backup status;
- restore tests;
- security findings;
- tenant-isolation evidence;
- capacity and queue behavior.

Operational evidence may reveal behavior not apparent from source.

## 15. Required P1 outputs

```text
program-instance/execution-context.json
program-instance/evidence/repository-evidence-manifest.json
program-instance/evidence/repository-inventory/
program-instance/evidence/baseline-build-report.md
program-instance/evidence/baseline-test-report.md
program-instance/evidence/toolchain-inventory.json
program-instance/evidence/runtime-and-deployment-inventory.json
program-instance/evidence/evidence-index.json
program-instance/evidence/integrity-manifest.sha256
program-instance/decisions/P1-gate-decision.json
```

## 16. P1 acceptance questions

- Is the exact assessed revision known?
- Can another investigator reproduce the build and inventory?
- Are uncommitted and generated states preserved?
- Are inaccessible evidence areas explicit?
- Were failures preserved before remediation?
- Is tenant or protected data handled safely?
- Is the evidence sufficient to begin semantic reconstruction?

## 17. P1 prohibitions

- Do not install unapproved tooling into a production environment.
- Do not modify authoritative data to make tests pass.
- Do not run destructive migrations.
- Do not present heuristic keyword hits as semantic conformance.
- Do not infer absence merely because a concept uses different terminology.
- Do not erase or normalize a dirty worktree before recording it.
- Do not commit investigative changes into product history without explicit authorization.
