# **Hestami AI Developer Agent — Onboarding Package**

### **1\. Mission**

You will build and modify backend and frontend features for the Hestami platform using strongly typed APIs, strict multitenancy rules, and durable workflows. All logic must remain consistent with the Hestami CDM and SRD. Prefer server side rendering (SSR) to the maximum extent possible. Constrain the use of "onMount" and "effect" on the client side to the strictly necessary circumstances.

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

#### **e. Error Handling (Critical for Observability)**

**oRPC Type-Safe Errors**: All oRPC procedure handlers **must** use the type-safe `.errors()` approach. Do NOT use `ApiException` or throw `ORPCError` directly in handlers.

**Why this matters**: When custom errors like `ApiException` are thrown, oRPC converts them to generic `INTERNAL_SERVER_ERROR` (500) responses. This breaks observability:
- All errors appear as 500s in traces and logs
- Cannot distinguish between actual server errors and expected business errors (404, 403, etc.)
- Alerts and monitoring become unreliable

**Correct Pattern**:
```typescript
const myProcedure = orgProcedure
  .input(z.object({ id: z.string() }))
  .errors({
    NOT_FOUND: { message: 'Resource not found' },
    FORBIDDEN: { message: 'Access denied' },
    BAD_REQUEST: { message: 'Invalid request' }
  })
  .output(/* ... */)
  .handler(async ({ input, context, errors }) => {
    const resource = await prisma.resource.findFirst({ where: { id: input.id } });
    if (!resource) {
      throw errors.NOT_FOUND({ message: 'Resource not found' });
    }
    // ...
  });
```

**Error Response Format** (after proper implementation):
```json
{
  "defined": true,
  "code": "NOT_FOUND",
  "status": 404,
  "message": "Resource not found"
}
```

**Reference**: See `docs/oRPC Error Handling Migration Guide.md` for full details.

**Standard oRPC Error Codes**:
| Code | HTTP Status |
|------|-------------|
| `BAD_REQUEST` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `INTERNAL_SERVER_ERROR` | 500 |

**Span Error Recording (Critical for Trace Visibility)**:

All errors must be recorded on the active OpenTelemetry span so traces show detailed error information in SigNoz. This is handled automatically by the oRPC handler in `src/routes/api/v1/rpc/[...rest]/+server.ts`, but if you're creating custom spans or handling errors in other contexts, use `recordSpanError()`:

```typescript
import { recordSpanError } from '$server/api/middleware/tracing';

// When an error occurs, record it on the active span
await recordSpanError(error, {
  errorCode: 'FORBIDDEN',      // The error code (e.g., oRPC error code)
  httpStatus: 403,             // HTTP status code
  errorType: 'AUTHORIZATION'   // Category for filtering
});
```

This ensures traces display:
- `status`: `ERROR` (instead of `Unset`)
- `status.message`: The actual error message
- `exception.type`, `exception.message`, `exception.stacktrace`: Full exception details
- `error.code`, `http.status_code`, `error.type`: Custom attributes for filtering

#### **f. DBOS Workflows (Critical for Observability)**

All mutating operations **must** use DBOS workflows for durability, idempotency, and observability. Workflows provide automatic trace correlation across all database operations.

**Why this matters**: DBOS workflows:
- Provide **idempotency** via `workflowID` (same key = same result)
- Enable **durability** (workflow survives crashes and can be recovered)
- Ensure **trace correlation** (all DB operations in same OpenTelemetry trace)
- Support **structured logging** with workflow context

**Correct Pattern**:
```typescript
// In oRPC handler - start workflow with idempotencyKey as workflowID
const handle = await DBOS.startWorkflow(myWorkflow_v1, {
  workflowID: input.idempotencyKey
})({
  action: 'CREATE_RESOURCE',
  organizationId: context.organization.id,
  userId: context.user.id,
  // ... other input fields
});

const result = await handle.getResult();

if (!result.success) {
  throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Workflow failed' });
}
```

**Workflow Structure Best Practices**:
```typescript
import { DBOS } from '@dbos-inc/dbos-sdk';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';

async function myWorkflow(input: MyWorkflowInput): Promise<MyWorkflowResult> {
  const log = createWorkflowLogger('myWorkflow', DBOS.workflowID, input.action);
  const startTime = logWorkflowStart(log, input.action, input);

  try {
    // 1. Use DBOS.runStep() for each database operation
    const result = await DBOS.runStep(
      () => prisma.$transaction(async (tx) => {
        // Wrap related Prisma operations in transaction
        const entity = await tx.myEntity.create({ data: { ... } });
        await tx.auditLog.create({ data: { ... } });
        return entity;
      }),
      { name: 'createEntity' }
    );

    // 2. Record activity event after successful step
    await recordWorkflowEvent({
      organizationId: input.organizationId,
      entityType: 'MY_ENTITY',
      entityId: result.id,
      action: 'CREATE',
      workflowId: 'myWorkflow_v1',
      workflowStep: input.action,
      // ... other event fields
    });

    // 3. Set workflow status event for monitoring
    await DBOS.setEvent('workflow_status', { step: 'completed', entityId: result.id });

    // 4. Return structured result
    const successResult = { success: true, entityId: result.id, ... };
    logWorkflowEnd(log, input.action, true, startTime, successResult);
    return successResult;

  } catch (error) {
    // 5. Log errors with full context
    const errorObj = error instanceof Error ? error : new Error(String(error));
    log.error('Workflow failed', { action: input.action, error: errorObj.message });
    await DBOS.setEvent('workflow_error', { error: errorObj.message });
    
    // 6. Record error on span for trace visibility
    await recordSpanError(errorObj, {
      errorCode: 'WORKFLOW_FAILED',
      errorType: 'WORKFLOW_ERROR'
    });
    
    const errorResult = { success: false, error: errorObj.message };
    logWorkflowEnd(log, input.action, false, startTime, errorResult);
    return errorResult;
  }
}

export const myWorkflow_v1 = DBOS.registerWorkflow(myWorkflow);
```

**Key Requirements**:
1. **Use `workflowLogger.ts` helpers** for consistent structured logging
2. **Wrap DB operations in `DBOS.runStep()`** for durability
3. **Use `prisma.$transaction()`** within steps for atomicity
4. **Record activity events** via `recordWorkflowEvent()` for audit trail
5. **Set workflow events** via `DBOS.setEvent()` for status monitoring
6. **Return structured results** with `success: boolean` and `error?: string`
7. **Version suffix** on exported workflow (e.g., `myWorkflow_v1`)
8. **Record errors on spans** via `recordSpanError()` for trace visibility

**Reference**: See `src/lib/server/workflows/caseLifecycleWorkflow.ts` for a complete example.

#### **g. Workflow Versioning**

Each API method triggers a DBOS workflow version aligned with the API's version.

#### **h. Type Generation Pipeline (Critical)**

The type system uses a hybrid approach: some files are auto-generated, others require manual maintenance. You must understand which files to update and when.

**AUTO-GENERATED FILES (Do not edit directly):**

| File/Directory | Generated By | Contains |
|----------------|--------------|----------|
| `generated/prisma/` | `npx prisma generate` | Prisma client, TypeScript enums |
| `generated/zod/` | `npx prisma generate` (via zod-prisma-types) | Zod schemas for all Prisma models and enums |
| `src/lib/api/types.generated.ts` | `npm run types:generate` | TypeScript types derived from OpenAPI spec |

**MANUALLY MAINTAINED FILES (You must update these):**

| File | Purpose | Update When |
|------|---------|-------------|
| `src/lib/server/api/schemas.ts` | Zod schemas for API responses; re-exports generated enum schemas; defines response shape schemas (e.g., `ARCRequestSchema`, `ViolationDetailSchema`); provides `successResponseSchema()` helper | Adding new enums to API routes, adding new API response shapes, adding new domain models |
| `src/lib/server/workflows/schemas.ts` | Types for DBOS workflows; re-exports Prisma enums (e.g., `ViolationStatus`); defines `BaseWorkflowResult`, `EntityWorkflowResult`, `LifecycleWorkflowResult` interfaces | Adding new enums used by workflows, adding new workflow result types |

**ENUM SCHEMA PATTERN FOR oRPC ROUTES (Critical - Never Hardcode Enums):**

When defining Zod schemas in oRPC route files, **never hardcode enum values** with `z.enum([...])`. Instead:

1. Import generated enum schemas from `schemas.ts`:
```typescript
import {
  ActivityEntityTypeSchema,
  ActivityActionTypeSchema,
  // ... other enum schemas
} from '../schemas.js';
```

2. Use them directly in route definitions:
```typescript
// ✅ CORRECT - Uses generated schema (auto-updates with Prisma)
const activityEntityTypeEnum = ActivityEntityTypeSchema;

// ❌ WRONG - Hardcoded values (will drift from Prisma schema)
const activityEntityTypeEnum = z.enum(['ASSOCIATION', 'UNIT', ...]);
```

3. If the enum doesn't exist in `schemas.ts`, add it:
   - Import from `generated/zod/inputTypeSchemas/[EnumName]Schema.js`
   - Re-export with type inference

This ensures enum changes in `prisma/schema.prisma` automatically propagate through the entire type pipeline.

**TYPE EXTRACTION PATTERN (CRITICAL - Applies to BOTH Frontend AND Backend):**

For **any code that deals with API request/response shapes** - whether frontend components, stores, server load functions, or oRPC context types - extract types from `types.generated.ts`. Never define API-related types manually. This ensures type consistency across the entire stack.

**Frontend examples** (`src/lib/api/*.ts`, `src/lib/stores/*.ts`, `src/routes/**/*.svelte`):
```typescript
import type { operations } from './types.generated.js';

export type Violation = operations['violation.list']['responses']['200']['content']['application/json']['data']['violations'][number];
export type ViolationDetail = operations['violation.get']['responses']['200']['content']['application/json']['data']['violation'];
```

**Backend examples** (`src/lib/server/api/context.ts`, `src/routes/**/*.server.ts`):
```typescript
// OrganizationContext in context.ts uses Prisma enums but matches the API shape
// This ensures RequestContext.organization is compatible with API responses
export interface OrganizationContext {
	id: string;
	name: string;
	slug: string;
	type: OrganizationType;  // From Prisma, matches API enum
	status: OrganizationStatus;  // From Prisma, matches API enum
}
```

**When to use Prisma types vs API types:**
- **Prisma types** (`generated/prisma/client`): Only for direct database operations (Prisma queries, `App.Locals`)
- **API types** (`types.generated.ts` or derived): For all API contracts, stores, page data, and context types that flow through the system

**Key principle**: Data shapes should not change as they flow through the system. If an oRPC endpoint returns `{ id, name, slug, type, status }`, then stores, page data, and context types should all use that same shape.

**WORKFLOW RESULT TYPES:**

All DBOS workflow result interfaces must extend `EntityWorkflowResult` from `workflows/schemas.ts` to include `success: boolean`, `error?: string`, and `entityId?: string` properties.

**COMMANDS TO RUN:**

After modifying `prisma/schema.prisma`: run `npx prisma generate`

After modifying oRPC routes: run `npm run openapi:generate && npm run types:generate`

After any changes: run `npm run check` (must pass with 0 errors)

**CRITICAL RULE:** If you add a new Prisma enum and use it in an API route or workflow, you must manually add a re-export statement to `api/schemas.ts` and/or `workflows/schemas.ts`. Failure to do so will cause import errors at compile time.

#### **h. Schema Validation (Backend)**

* All API route response schemas must use typed Zod schemas
* Use `ResponseMetaSchema` for response metadata — never use `z.any()`
* Import from `../../schemas.ts` (relative path varies by file location)

#### **i. Cerbos Authorization**

* Policies are in `cerbos/policies/` with resource policies in `cerbos/policies/resource/`
* Derived roles are defined in `cerbos/policies/derived_roles/common.yaml`
* **Critical**: Each `resource` + `version` combination must be unique across all policy files
* When referencing a derived role, ensure it exists in `common.yaml` before use
* Available derived roles: `org_admin`, `org_manager`, `org_board_member`, `org_owner`, `org_tenant`, `org_vendor`, `org_technician`, `org_concierge`, `org_auditor`, `org_management`, `org_stakeholder`, `resource_owner`, `resource_member`, `assigned_vendor`

---

### **4\. Implementation Steps for New Feature Development**

1. **Extend Prisma schema** (`prisma/schema.prisma`).

2. **Run `npx prisma generate`** to update:
   - `generated/prisma/` (Prisma client, enums)
   - `generated/zod/` (Zod schemas)

3. **Update manual schema files** (if adding new enums or models):
   - `src/lib/server/api/schemas.ts` - add enum re-exports and response Zod schemas
   - `src/lib/server/workflows/schemas.ts` - add enum re-exports if used by workflows

4. **Implement oRPC procedures** using `.input(schema).output(schema)`:
   - For entity CRUD: use generated schemas from `generated/zod/`
   - For aggregated/derived views: define custom Zod schemas in `api/schemas.ts`

5. **Implement/modify DBOS workflows**:
   - Workflow result types should extend `EntityWorkflowResult` from `workflows/schemas.ts`
   - Import enums from `workflows/schemas.ts`

6. **Regenerate OpenAPI spec**: `npm run openapi:generate`

7. **Regenerate frontend types**: `npm run types:generate` → updates `src/lib/api/types.generated.ts`

8. **Update API client** (`src/lib/api/schemas.ts` and `src/lib/server/workflows/schemas.ts`):
   - Extract types from `types.generated.ts` using TypeScript type extraction pattern
   - Add API client methods that wrap oRPC calls
   - Re-export types for component consumption

9. Regenerate iOS/Android SDKs (if applicable).

10. Write test scaffolding (unit + workflow checks).

11. Ensure RLS & telemetry remain intact.

12. If adding new resources, create Cerbos policy in `cerbos/policies/resource/`.

13. **Run `npm run check`** to verify TypeScript/Svelte types are correct (must pass with 0 errors).

---

### **5\. Principles for Safe Development**

* Never bypass Zod validation.

* Never bypass RLS or manually inject organization IDs.

* Always include idempotency logic for mutating ops.

* Maintain backward compatibility unless versioning up.

* Always return the standard error format.

* Use OpenTelemetry context for correlating operations.

* Use OpenTelementry logs for all debug and production logging as well; Log errors with full context.

* Always prefer server side rendering (SSR) and server side loading.

* **Always use type-safe oRPC errors** — never throw `ApiException` or raw `ORPCError` in handlers.

* When adding Cerbos policies, verify no duplicate resource+version definitions exist.

---

### **6\. Common Pitfalls**

* **Duplicate type definitions**: Svelte components defining their own interfaces instead of importing from `schemas.ts`. Always derive types from `types.generated.ts`.
* **Manual types in cam.ts**: Defining types manually in `cam.ts` (or other API client files) instead of extracting from generated types. Use TypeScript type extraction: `type MyType = operations['endpoint']['responses']['200']['content']['application/json']['data']`
* **Forgetting to regenerate types**: After adding/modifying oRPC endpoints, always run `npm run openapi:generate && npm run types:generate`
* **Forgetting to update schema barrel files**: After adding new Prisma enums, you must manually add re-exports to:
  - `src/lib/server/api/schemas.ts` (for API routes)
  - `src/lib/server/workflows/schemas.ts` (for DBOS workflows)
* **Using `z.any()`**: Backend routes using `z.any()` instead of typed schemas like `ResponseMetaSchema`
* **Missing workflow result types**: Workflow results not extending `EntityWorkflowResult` from `workflows/schemas.ts`, causing missing `success`/`error`/`entityId` properties
* **Cerbos duplicate policies**: Multiple files defining the same `resource: "X"` with `version: "default"`
* **Missing derived roles**: Referencing a derived role in a policy before defining it in `common.yaml`
* **PowerShell path issues**: SvelteKit route folders like `[id]` require `-LiteralPath` in PowerShell commands
* **Wrong error handling in oRPC**: Using `ApiException` or `throw new ORPCError()` directly instead of type-safe `.errors()` approach. This causes all errors to appear as generic 500s in traces/logs, breaking observability. Always define errors with `.errors({})` and throw via `errors.CODE()`
* **DBOS workflow without structured logging**: Not using `workflowLogger.ts` helpers (`createWorkflowLogger`, `logWorkflowStart`, `logWorkflowEnd`). This breaks trace correlation and makes debugging difficult. Always use the workflow logger helpers.
* **DB operations outside DBOS.runStep()**: Performing Prisma operations directly in workflows instead of wrapping in `DBOS.runStep()`. This breaks durability - if the workflow crashes, the operation won't be recoverable.
* **Missing activity events in workflows**: Not calling `recordWorkflowEvent()` after successful operations. This breaks the audit trail and activity timeline features.
* **Using client side onMount**: onMount and client side loading for important values such as organization ID cause race conditions on pages.
* **Using default `orpc` client in SSR**: The default `orpc` client and API wrappers (e.g., `workQueueApi`) use relative URLs that fail in server-side contexts. Always use `createDirectClient` with `buildServerContext` in `+page.server.ts` files.

---

### **6b. oRPC Client Usage Patterns (Critical for SSR)**

The oRPC client has different variants for browser vs server contexts:

| Client | Use In | Import From |
|--------|--------|-------------|
| `orpc` | Browser/client components, `+page.svelte` | `$lib/api` |
| `createOrgClient(orgId, fetch?)` | Browser with explicit org ID | `$lib/api` |
| `createDirectClient(context)` | `+page.server.ts`, `+layout.server.ts` | `$lib/server/api/serverClient` |
| `buildServerContext(locals, options?)` | Build context for `createDirectClient` | `$lib/server/api/serverClient` |

**Server-Side Load Functions (Critical)**:

In `+page.server.ts` files, you **must** use `createDirectClient` with `buildServerContext` for direct server-side oRPC calls (no HTTP round-trip):

```typescript
// ✅ CORRECT - SSR load function with direct server-side calling
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
    const { organization } = await parent();
    
    // Build context for direct server-side calling
    let orgRoles: Record<string, any> = {};
    if (locals.user) {
        const memberships = await prisma.userOrganization.findMany({ 
            where: { userId: locals.user.id } 
        });
        for (const m of memberships) {
            orgRoles[m.organizationId] = m.role;
        }
    }
    
    // Set organization context from parent (if org-scoped page)
    if (organization) {
        locals.organization = organization;
        locals.role = orgRoles[organization.id] || null;
    }
    
    const context = buildServerContext(locals, { orgRoles });
    const client = createDirectClient(context);
    
    const response = await client.myResource.list({ ... });
    return { items: response.data.items };
};
```

**For staff/admin pages** that need staff roles for authorization:

```typescript
// ✅ CORRECT - Admin page with staff authorization
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
    let staffRoles: any[] = [];
    let pillarAccess: any[] = [];
    let orgRoles: Record<string, any> = {};
    
    if (locals.user) {
        const [staffProfile, memberships] = await Promise.all([
            prisma.staff.findUnique({ where: { userId: locals.user.id, status: 'ACTIVE' } }),
            prisma.userOrganization.findMany({ where: { userId: locals.user.id } })
        ]);
        if (staffProfile) {
            staffRoles = staffProfile.roles;
            pillarAccess = staffProfile.pillarAccess;
        }
        for (const m of memberships) {
            orgRoles[m.organizationId] = m.role;
        }
    }
    
    const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess });
    const client = createDirectClient(context);
    
    const response = await client.staff.list({ ... });
    return { staffList: response.data.staff };
};
```

```typescript
// ❌ WRONG - Will throw "Authentication required" or "Invalid URL" error
import { myResourceApi } from '$lib/api/myResource';

export const load: PageServerLoad = async () => {
    const response = await myResourceApi.list({ ... }); // FAILS in SSR!
    return { items: response.data.items };
};
```

**Why Direct Server-Side Calling**:

1. **No HTTP round-trip**: Calls oRPC handlers directly in-process, faster than HTTP
2. **Proper authentication**: Uses `locals` from SvelteKit hooks which already has the authenticated user
3. **No cookie forwarding issues**: HTTP-based SSR calls to localhost don't forward cookies properly

**Type Safety**: `createDirectClient` returns `RouterClient<AppRouter>` which provides complete type inference from the server's router definition.

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

