## **Hestami Context Key (v1.1)**

Hestami is a unified platform for **HOA/community association management**, **homeowner concierge services**, and **service provider operations**. The core architecture is a **modular monolith** built with **SvelteKit 5 with Runes \+ Node**, using **oRPC** for typed APIs, **Zod** (generated from Prisma) for schemas, and **DBOS** for durable workflows.

Tenants are modeled as **Organizations** (HOA, management company, service provider, individual, commercial client). Postgres with **RLS** enforces strict data isolation. Users may belong to multiple organizations but **must explicitly select an active organization scope** for all operations.

Core domains:

* Association/Property model

* Accounting (GL, AR/AP, assessments)

* Work Orders & Vendor Management

* Violations

* ARC architectural requests

* Governance & Meetings

* Communications

* Owner Portal

* Documents & Records

* Reserve Studies

* Compliance

All APIs are versioned functionally (`workOrder/v1/create`) and routed under `/api/v1/rpc`. oRPC converts Zod schemas into OpenAPI; SDKs for iOS/Android/AI agents are generated from this spec. Idempotency keys are mandatory for all mutating operations.

DBOS powers domain workflows (e.g., Work Order lifecycle, ARC reviews, AP processing). OpenTelemetry provides distributed tracing using `trace_id`, `span_id`, and org-level metadata.

Security: JWT sessions (Redis), **Cerbos** for fine-grained authorization with derived roles, strict organization scoping.

Key architectural patterns:

* **Type generation pipeline**: Types flow from a single source of truth:
  1. **Prisma schema** (`prisma/schema.prisma`) → defines persistent data models
  2. **Zod schemas** (`generated/zod/`) → auto-generated from Prisma via `zod-prisma-types`
  3. **oRPC procedures** → use Zod schemas for input/output validation (can use generated schemas OR custom DTOs for aggregated/derived views)
  4. **OpenAPI spec** (`openapi.json`) → auto-generated from oRPC via `npm run openapi:generate`
  5. **Frontend types** (`src/lib/api/types.generated.ts`) → auto-generated from OpenAPI via `npm run types:generate`
  6. **API clients** (e.g., `src/lib/api/cam.ts`) → import and re-export types from `types.generated.ts`

* **Never duplicate types**: Try to maximize utitilization of generated types.

* **Schema validation**: All API route responses use typed Zod schemas (e.g., `ResponseMetaSchema`)—avoid `z.any()`

* **Cerbos policies**: Located in `cerbos/policies/` with derived roles in `derived_roles/common.yaml`—each resource+version combination must be unique

This platform is designed for **AI worker agents** and **AI developer agents**, with clear schemas, predictable APIs, and durable workflows.

