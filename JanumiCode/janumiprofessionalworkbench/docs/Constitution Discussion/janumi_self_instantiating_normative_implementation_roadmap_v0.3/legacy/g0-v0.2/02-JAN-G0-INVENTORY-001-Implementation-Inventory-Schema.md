# JAN-G0-INVENTORY-001 — Implementation Inventory Schema

**Version:** 0.1  
**Status:** Normative G0 working schema

## 1. Purpose

The implementation inventory records what currently exists without presuming conformance. It is an evidence index and architecture-discovery instrument, not a feature catalog.

## 2. Inventory categories

```text
REPOSITORY
PACKAGE
FRONTEND_ROUTE
UI_COMPONENT
FRONTEND_STATE
API_ENDPOINT
COMMAND_HANDLER
GENERIC_MUTATION
ENTITY_MODEL
AGGREGATE
DATABASE_TABLE
MIGRATION
EVENT
QUEUE
WORKER
DURABLE_PROCESS
PROJECTION
CACHE
SEARCH_INDEX
AUTHENTICATION
AUTHORIZATION
TENANT_CONTROL
PWU_IMPLEMENTATION
PWA_IMPLEMENTATION
RPH_IMPLEMENTATION
AGENT_IMPLEMENTATION
VALIDATOR
RECONCILIATION
ATTENTION
TEST
CI_PIPELINE
DEPLOYMENT
CONTAINER
INTEGRATION
OBJECT_STORAGE
OBSERVABILITY
BACKUP_RECOVERY
ADMINISTRATION
DOCUMENTATION
OTHER
```

## 3. Required fields

| Field | Meaning |
|---|---|
| `inventory_id` | Stable G0 record identifier. |
| `category` | One canonical category. |
| `name` | Human-recognizable name. |
| `repository` | Repository or subrepository. |
| `path_or_locator` | File, symbol, URL, table, service, or deployment locator. |
| `technology` | Framework, language, product, or protocol. |
| `observed_purpose` | What the implementation currently appears to do. |
| `semantic_role` | CPCO/PWU/RPH/JEM/JCPWA role, if any; otherwise `UNMAPPED`. |
| `authority_class` | `AUTHORITATIVE`, `DERIVED`, `CACHE`, `EXTERNAL`, `UNKNOWN`. |
| `tenant_scope` | How tenant and organization boundaries are enforced. |
| `mutation_path` | How authoritative state changes, if applicable. |
| `read_path` | How state is queried or projected. |
| `dependencies` | Material upstream and downstream dependencies. |
| `tests` | Tests exercising this item. |
| `telemetry` | Logs, traces, metrics, and alerts. |
| `operational_state` | `ACTIVE`, `PARTIAL`, `DEPRECATED`, `DEAD_CODE`, `UNKNOWN`. |
| `evidence_refs` | Reproducible evidence references. |
| `assessor_confidence` | `HIGH`, `MEDIUM`, `LOW`. |
| `notes` | Limits, contradictions, and follow-up. |

## 4. Evidence reference format

Preferred references:

```text
repo://<repository>/<path>#L<start>-L<end>
test://<test-identifier>
cmd://<evidence-file>#<line-or-section>
db://<schema>/<object>
route://<method>/<path>
deploy://<manifest-or-resource>
obs://<dashboard-or-trace-reference>
```

A path without line, symbol, query, test, or command context is usually insufficient for a conformance claim.

## 5. Inventory quality rules

- One row may represent one semantic implementation unit even when multiple files contribute.
- Generated files shall identify their generator and canonical source.
- Dead code and unused routes shall remain distinguishable from active behavior.
- Planned work shall not appear as current implementation.
- External services shall identify whether Janumi treats them as authority, evidence, observation, execution, or notification.
- UI routes and components shall identify their data source and mutation path.
- Generic mutation endpoints shall be inventoried explicitly because they may violate later semantic-command requirements.
- In-memory-only process or agent state shall be identified because it may affect restart correctness.

## 6. Current-state architecture views derived from inventory

The G0 report shall derive at least:

1. Repository and package map.
2. Runtime and deployment topology.
3. Authoritative data and mutation map.
4. Projection and read-path map.
5. Frontend route and workspace map.
6. Identity, authority, tenant, and security boundary map.
7. Agent, sandbox, tool, and external integration map.
8. Test, CI/CD, observability, backup, and recovery map.
9. Target-semantic mapping map: CPCO, PWU, RPH, JEM, and JanumiCode concepts currently represented.
