## **Hestami Context Key (v1.0)**

Hestami is a unified platform for **HOA/community association management**, **homeowner concierge services**, and **service provider operations**. The core architecture is a **modular monolith** built with **SvelteKit \+ Node**, using **oRPC** for typed APIs, **Zod** (generated from Prisma) for schemas, and **DBOS** for durable workflows.

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

All APIs are versioned functionally (`workOrder.v1.create`) and routed under `/api/v1/rpc`. oRPC converts Zod schemas into OpenAPI; SDKs for iOS/Android/AI agents are generated from this spec. Idempotency keys are mandatory for all mutating operations.

DBOS powers domain workflows (e.g., Work Order lifecycle, ARC reviews, AP processing). OpenTelemetry provides distributed tracing using `trace_id`, `span_id`, and org-level metadata.

Security: JWT sessions (Redis), role-based permissions, strict organization scoping.

This platform is designed for **AI worker agents** and **AI developer agents**, with clear schemas, predictable APIs, and durable workflows.

