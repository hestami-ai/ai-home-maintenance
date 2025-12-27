# **Hestami AI Developer Agent — Onboarding Package**

### **1\. Mission**

You will build and modify backend and frontend features for the Hestami platform using strongly typed APIs, strict multitenancy rules, and durable workflows. All logic must remain consistent with the Hestami CDM and SRD.

---

### **2\. Architectural Context**

* Backend: **SvelteKit 5 with Runes (Node)** with **oRPC**.

* Database: **Postgres** with Row-Level Security.

* ORM: **Prisma**.

* Schema validation: **Zod**, generated from Prisma.

* Workflow engine: **DBOS**, versioned per API version.

* Observability: **OpenTelemetry**.

* Authorization: **Cerbos** for fine-grained, policy-based access control.

Your tasks will require modifying:

* **Prisma schema**

* **Zod-generated DTOs**

* **oRPC routers**

* **DBOS workflows**

* **OpenAPI spec regeneration**

* **Cerbos policies** (when adding new resources or roles)

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

#### **g. Type Generation Pipeline (Critical)**

Types flow through an automated pipeline to prevent duplication:

```
Prisma Schema → Zod Schemas → oRPC → OpenAPI → Generated Types → API Clients
```

1. **Prisma schema** (`prisma/schema.prisma`) is the single source of truth for persistent data models
2. **Zod schemas** are auto-generated in `generated/zod/` via `zod-prisma-types` generator
3. **oRPC procedures** define API input/output using Zod schemas:
   - Use generated Zod schemas for entity validation
   - Define custom Zod schemas for aggregated/derived DTOs (e.g., dashboard data)
4. **OpenAPI spec** is auto-generated: `npm run openapi:generate`
5. **Frontend types** are auto-generated: `npm run types:generate` → `src/lib/api/types.generated.ts`

**Rules:**
* Manual type definitions in `cam.ts` are only for convenience wrappers around generated types
* When adding new API endpoints, regenerate types: `npm run openapi:generate && npm run types:generate`

#### **h. Schema Validation (Backend)**

* All API route response schemas must use typed Zod schemas
* Use `ResponseMetaSchema` for response metadata—never use `z.any()`
* Import from `../../schemas.js` (relative path varies by file location)

#### **i. Cerbos Authorization**

* Policies are in `cerbos/policies/` with resource policies in `cerbos/policies/resource/`
* Derived roles are defined in `cerbos/policies/derived_roles/common.yaml`
* **Critical**: Each `resource` + `version` combination must be unique across all policy files
* When referencing a derived role, ensure it exists in `common.yaml` before use
* Available derived roles: `org_admin`, `org_manager`, `org_board_member`, `org_owner`, `org_tenant`, `org_vendor`, `org_technician`, `org_concierge`, `org_auditor`, `org_management`, `org_stakeholder`, `resource_owner`, `resource_member`, `assigned_vendor`

---

### **4\. Implementation Steps for New Feature Development**

1. Extend **Prisma schema** (`prisma/schema.prisma`).

2. Run `npx prisma generate` to update generated Zod schemas in `generated/zod/`.

3. Define/update Zod schemas for API DTOs in the relevant oRPC route file:
   - For entity CRUD: use generated schemas from `generated/zod/`
   - For aggregated/derived views: define custom Zod schemas in the route file

4. Implement new oRPC procedures using `.input(schema).output(schema)`.

5. Implement/modify DBOS workflows.

6. **Regenerate OpenAPI spec**: `npm run openapi:generate`

7. **Regenerate frontend types**: `npm run types:generate` → updates `src/lib/api/types.generated.ts`

8. **Update API client** (`src/lib/api/cam.ts`):
   - Import types from `types.generated.ts`
   - Add API client methods that use the generated types
   - Re-export types for component consumption

9. Regenerate iOS/Android SDKs (if applicable).

10. Write test scaffolding (unit + workflow checks).

11. Ensure RLS & telemetry remain intact.

12. If adding new resources, create Cerbos policy in `cerbos/policies/resource/`.

13. Run `npm run check` to verify TypeScript/Svelte types are correct.

---

### **5\. Principles for Safe Development**

* Never bypass Zod validation.

* Never bypass RLS or manually inject organization IDs.

* Always include idempotency logic for mutating ops.

* Maintain backward compatibility unless versioning up.

* Always return the standard error format.

* Use OpenTelemetry context for correlating operations.

* When adding Cerbos policies, verify no duplicate resource+version definitions exist.

---

### **6\. Common Pitfalls**

* **Duplicate type definitions**: Svelte components defining their own interfaces instead of importing from `cam.ts`. Always derive types from `types.generated.ts`.
* **Manual types in cam.ts**: Defining types manually in `cam.ts` instead of extracting from generated types. Use TypeScript type extraction: `type MyType = operations['endpoint']['responses']['200']['content']['application/json']['data']`
* **Forgetting to regenerate types**: After adding/modifying oRPC endpoints, always run `npm run openapi:generate && npm run types:generate`
* **Using `z.any()`**: Backend routes using `z.any()` instead of typed schemas like `ResponseMetaSchema`
* **Cerbos duplicate policies**: Multiple files defining the same `resource: "X"` with `version: "default"`
* **Missing derived roles**: Referencing a derived role in a policy before defining it in `common.yaml`
* **PowerShell path issues**: SvelteKit route folders like `[id]` require `-LiteralPath` in PowerShell commands

---

### **7\. Expected Outputs from the AI Developer Agent**

* Updated schema files (`schema.prisma`)

* Updated oRPC router definitions

* Zod schema modifications or new schemas

* DBOS workflow definitions with version suffixes

* Generated OpenAPI spec

* Appropriate notes in the SRD

* Updated Cerbos policies (if new resources/roles added)

* Passing `npm run check` with 0 errors

