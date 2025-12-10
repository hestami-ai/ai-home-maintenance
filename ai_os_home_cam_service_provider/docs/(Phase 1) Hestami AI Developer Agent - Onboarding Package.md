# **Hestami AI Developer Agent — Onboarding Package**

### **1\. Mission**

You will build and modify backend features for the Hestami platform using strongly typed APIs, strict multitenancy rules, and durable workflows. All logic must remain consistent with the Hestami CDM and SRD.

---

### **2\. Architectural Context**

* Backend: **SvelteKit (Node)** with **oRPC**.

* Database: **Postgres** with Row-Level Security.

* ORM: **Prisma**.

* Schema validation: **Zod**, generated from Prisma.

* Workflow engine: **DBOS**, versioned per API version.

* Observability: **OpenTelemetry**.

Your tasks will require modifying:

* **Prisma schema**

* **Zod-generated DTOs**

* **oRPC routers**

* **DBOS workflows**

* **OpenAPI spec regeneration**

---

### **3\. Development Rules**

#### **a. Single Source of Truth**

The **Prisma schema** defines persistent shapes. Zod models are generated from it. APIs must use Zod schemas for all input/output.

#### **b. API Versioning**

* Breaking change → new version (`v2`) in both route and function name.

* Non-breaking change → additive to existing version.

#### **c. Idempotency**

All mutating operations require:

`"idempotencyKey": "<UUID>"`

#### **d. Multitenancy**

Every operation runs in an explicit **organization context**. Users belonging to multiple organizations **must explicitly select an active organization context immediately after login** and may switch scopes during the session. You must ensure:

* Queries filter on `organization_id`.

* New data is stamped with the correct `organization_id`.

* No cross-tenant leakage occurs.

#### **e. Error Format**

All errors use the standard envelope with:

* `error.code`

* `error.type`

* `field_errors[]`

* `trace_id`

#### **f. Workflow Versioning**

Each API method triggers a DBOS workflow version aligned with the API’s version.

---

### **4\. Implementation Steps for New Feature Development**

1. Extend **Prisma schema**.

2. Run `prisma generate` to update Zod types.

3. Define/update Zod schemas for API DTOs.

4. Implement new oRPC procedures using `.input(schema).output(schema)`.

5. Implement/modify DBOS workflows.

6. Regenerate OpenAPI spec.

7. Regenerate iOS/Android SDKs.

8. Write test scaffolding (unit \+ workflow checks).

9. Ensure RLS & telemetry remain intact.

---

### **5\. Principles for Safe Development**

* Never bypass Zod validation.

* Never bypass RLS or manually inject organization IDs.

* Always include idempotency logic for mutating ops.

* Maintain backward compatibility unless versioning up.

* Always return the standard error format.

* Use OpenTelemetry context for correlating operations.

---

### **6\. Expected Outputs from the AI Developer Agent**

* Updated schema files (`schema.prisma`)

* Updated oRPC router definitions

* Zod schema modifications or new schemas

* DBOS workflow definitions with version suffixes

* Generated OpenAPI spec

* Appropriate notes in the SRD

