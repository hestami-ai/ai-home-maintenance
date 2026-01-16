# **Hestami AI Developer Agent \- Onboarding**

## **Product Overview**

**Platform**: Unified HOA/community management, homeowner concierge, and field service operations  
 **Architecture**: Modular monolith, SvelteKit 5 \+ Runes \+ Node, oRPC (typed APIs), Zod (from Prisma), DBOS (durable workflows)  
 **Multitenancy**: Organizations (HOA, management, service provider, individual, commercial). Postgres RLS enforces isolation. Users select active organization scope for all operations.

**Three Pillars**:

1. **Property Concierge**: Service calls, vendors, bidding, workflow, communication  
2. **CAM Software**: Governance, property, stakeholders, compliance, accounting, violations, ARC  
3. **Field Service**: Vendor management, work execution, commercial terms

---

## **Mission**

Build/modify backend and frontend features using strongly typed APIs, strict multitenancy, durable workflows. Follow Hestami CDM/SRD. **Prefer SSR**—minimize client-side `onMount`/`effect`.

---

## **Stack**

**Backend**: SvelteKit 5/Runes (Bun), oRPC, Postgres \+ RLS, Prisma, Zod (generated), DBOS, OpenTelemetry, Cerbos  
 **Frontend**: Flowbite, Skeleton, Svelte, Lucide (no SuperForms)

---

## **Core Rules**

### **1\. Single Source of Truth**

Prisma schema → generates Zod schemas. All APIs use Zod for I/O.

### **2\. API Versioning**

Breaking change → new version (`v2`) in route and function name. Non-breaking → additive.

### **3\. Idempotency**

All mutations require: `"idempotencyKey": "<UUID>"`

### **4\. Multitenancy**

* Users explicitly select active organization after login  
* All queries filter on `organization_id`  
* New data stamped with correct `organization_id`  
* Zero cross-tenant leakage

### **5\. Error Handling (Critical)**

**Use oRPC type-safe `.errors()` pattern**—never throw `ApiException` or `ORPCError` directly. Direct throws break observability (all errors become 500s in traces).

typescript  
const myProcedure \= orgProcedure  
  .input(z.object({ id: z.string() }))  
  .errors({  
    NOT\_FOUND: { message: 'Resource not found' },  
    FORBIDDEN: { message: 'Access denied' }  
  })  
  .handler(async ({ input, context, errors }) \=\> {  
    if (\!resource) throw errors.NOT\_FOUND({ message: 'Resource not found' });

  });

**Standard codes**: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `INTERNAL_SERVER_ERROR` (500)

**Span recording**: Use `recordSpanError(error, { errorCode, httpStatus, errorType })` for trace visibility.

### **6\. DBOS Workflows (Critical)**

All mutations use DBOS workflows for durability, idempotency, observability.

typescript  
*// In handler*  
const handle \= await DBOS.startWorkflow(myWorkflow\_v1, {  
  workflowID: input.idempotencyKey  
})({ action: 'CREATE', organizationId, userId, ...input });

const result \= await handle.getResult();

if (\!result.success) throw errors.INTERNAL\_SERVER\_ERROR({ message: result.error });

**Workflow structure**:

typescript  
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd } from './workflowLogger.js';  
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';  
import { recordSpanError } from '../api/middleware/tracing.js';

async function myWorkflow(input: Input): Promise\<Result\> {  
  const log \= createWorkflowLogger('myWorkflow', DBOS.workflowID, input.action);  
  const startTime \= logWorkflowStart(log, input.action, input);  
    
  try {  
    const result \= await DBOS.runStep(  
      () \=\> prisma.$transaction(async (tx) \=\> {  
        const entity \= await tx.myEntity.create({ data: {...} });  
        await tx.auditLog.create({ data: {...} });  
        return entity;  
      }),  
      { name: 'createEntity' }  
    );  
      
    await recordWorkflowEvent({ organizationId, entityType, entityId: result.id, action: 'CREATE', ... });  
    await DBOS.setEvent('workflow\_status', { step: 'completed', entityId: result.id });  
      
    const success \= { success: true, entityId: result.id };  
    logWorkflowEnd(log, input.action, true, startTime, success);  
    return success;  
  } catch (error) {  
    const err \= error instanceof Error ? error : new Error(String(error));  
    log.error('Workflow failed', { action: input.action, error: err.message });  
    await DBOS.setEvent('workflow\_error', { error: err.message });  
    await recordSpanError(err, { errorCode: 'WORKFLOW\_FAILED', errorType: 'WORKFLOW\_ERROR' });  
      
    const failure \= { success: false, error: err.message };  
    logWorkflowEnd(log, input.action, false, startTime, failure);  
    return failure;  
  }  
}

export const myWorkflow\_v1 \= DBOS.registerWorkflow(myWorkflow);

**Requirements**: Use `workflowLogger.ts` helpers, wrap DB ops in `DBOS.runStep()`, use `prisma.$transaction()` for atomicity, record activity events, set workflow events, return `{success: boolean, error?: string}`, version suffix exports, record errors on spans.

### **7\. Type Generation Pipeline (Critical)**

**AUTO-GENERATED (never edit)**:

* `generated/prisma/` \- Prisma client, enums (via `bunx prisma generate`)  
* `generated/zod/` \- Zod schemas (via `bunx prisma generate`)  
* `src/lib/api/types.generated.ts` \- API types (via `bun run types:generate`)

**MANUALLY MAINTAINED (must update)**:

* `src/lib/server/api/schemas.ts` \- API response schemas, enum re-exports, `successResponseSchema()` helper  
* `src/lib/server/workflows/schemas.ts` \- Workflow types, enum re-exports, `BaseWorkflowResult`, `EntityWorkflowResult`

**Enum pattern** (never hardcode):

typescript  
*// … Import generated schema*  
import { ActivityEntityTypeSchema } from '../schemas.js';  
const typeEnum \= ActivityEntityTypeSchema;

*// Never hardcode*

const typeEnum \= z.enum(\['ASSOCIATION', 'UNIT', ...\]);

**Type extraction** (applies to frontend AND backend):

typescript  
*// Frontend*  
import type { operations } from './types.generated.js';  
export type Violation \= operations\['violation.list'\]\['responses'\]\['200'\]\['content'\]\['application/json'\]\['data'\]\['violations'\]\[number\];

*// Backend context*  
export interface OrganizationContext {  
  id: string;  
  name: string;  
  type: OrganizationType;  *// From Prisma, matches API*  
  status: OrganizationStatus;

}

**When to use**: Prisma types for direct DB ops only. API types (`types.generated.ts`) for all API contracts, stores, page data, context.

**Commands**:

* After Prisma changes: `bunx prisma generate`  
* After oRPC changes: `bun run openapi:generate && bun run types:generate`  
* Always verify: `bun run check` (must pass)

**Critical**: New Prisma enums require manual re-exports in `api/schemas.ts` and/or `workflows/schemas.ts`.

### **8\. Schema Validation**

All API responses use typed Zod schemas. Use `ResponseMetaSchema` for metadata—never `z.any()`.

### **9\. RLS & Prisma Connection Pooling (Critical)**

**The Problem**: Prisma uses connection pooling. Setting PostgreSQL session variables (like `app.current_org_id` for RLS) on one connection doesn't guarantee subsequent queries use that same connection. This causes intermittent data visibility issues where queries return 0 results despite data existing.

**The Solution**: `withRLSContext()` + `withRLSInjection()` in `src/lib/server/db.ts`

typescript
// In API handlers (router.ts orgProcedure middleware)
return withRLSContext(
  { organizationId, userId, associationId, isStaff },
  () => next({ context })
);

// All Prisma queries within the callback automatically:
// 1. Run in an interactive transaction (same connection)
// 2. Set RLS context before the query
// 3. Clear RLS context after the query (prevents pool contamination)

**How it works**:
- `withRLSContext()` uses `AsyncLocalStorage` to propagate RLS context across async boundaries
- `withRLSInjection()` is a Prisma extension that intercepts all model operations
- Each query is wrapped in `prisma.$transaction()` ensuring context SET and query run on same connection
- Uses `tx[modelName][operation](args)` instead of `query(args)` to ensure query runs on transaction client

**Defense in depth**:
1. **With RLS context**: Set context → run query → clear context (prevents stale context on pooled connections)
2. **Without RLS context**: Clear any stale context before query (prevents cross-org data leakage)

**Critical**: Never call `query(args)` inside the transaction—it runs on the original client's connection pool, NOT the transaction client. Always use `tx[modelName][operation](args)`.

**Debugging**: Debug logging in `withRLSInjection` shows context setting/verification. Look for `expectedOrgId` vs `actualOrgId` mismatch if data visibility issues occur.

### **10\. RLS & SECURITY DEFINER**

RLS enforces multitenancy, but some ops need bypass:

**When to use SECURITY DEFINER**:

* Context bootstrapping (user memberships before org context set)
* Cross-org staff access (work queues)
* System-level operations (background jobs)

**Pattern**:

sql
*\-- In Prisma migration*
CREATE OR REPLACE FUNCTION get\_user\_memberships(p\_user\_id TEXT)
RETURNS TABLE (..., created\_at TIMESTAMPTZ(3), ...)  *\-- Match Prisma @db.Timestamptz(3)*
SECURITY DEFINER SET search\_path \= public
AS $$ ... $$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get\_user\_memberships(TEXT) TO hestami\_app;

**Critical**: Use `TIMESTAMPTZ(3)` to match Prisma schema with `@db.Timestamptz(3)` annotation. Mismatched types cause "structure does not match function result type" errors.

**Never use `prismaAdmin` for RLS bypass**—use SECURITY DEFINER functions.

### **11\. Cerbos Authorization**

Policies in `cerbos/policies/resource/`. Derived roles in `cerbos/policies/derived_roles/common.yaml`. Each `resource` \+ `version` must be unique.

**Available derived roles**: `org_admin`, `org_manager`, `org_board_member`, `org_owner`, `org_tenant`, `org_vendor`, `org_technician`, `org_concierge`, `org_auditor`, `org_management`, `org_stakeholder`, `resource_owner`, `resource_member`, `assigned_vendor`

---

## **Feature Development Steps**

1. Extend `prisma/schema.prisma`  
2. Run `bunx prisma generate`  
3. Update manual schema files (if adding enums/models)  
4. Implement oRPC procedures with `.input().output()`  
5. Implement/modify DBOS workflows (extend `EntityWorkflowResult`)  
6. Run `bun run openapi:generate && bun run types:generate`  
7. Update API client (`$lib/api/schemas.ts`), extract types from `types.generated.ts`  
8. Regenerate mobile SDKs (if applicable)  
9. Write tests  
10. Verify RLS & telemetry  
11. Create Cerbos policies (if new resources)  
12. Run `bun run check` (must pass)

---

## **Common Pitfalls**

**Type issues**:

* Duplicate types in components instead of importing from `schemas.ts`  
* Manual types in `cam.ts` instead of extracting from `types.generated.ts`  
* Forgetting `bun run openapi:generate && bun run types:generate` after oRPC changes  
* Missing enum re-exports in `api/schemas.ts` or `workflows/schemas.ts`  
* Using `z.any()` instead of `ResponseMetaSchema`  
* Workflow results not extending `EntityWorkflowResult`

**Client-side imports causing memory crash**:

typescript  
*// CRASHES svelte-check (44MB Prisma types)*  
import type { Association } from '../../generated/prisma/client.js';

*// CRASHES in .svelte files (116K-line types.generated)*  
import type { operations } from '$lib/api/types.generated';

*// … Use pre-extracted types*

import type { Organization, Staff } from '$lib/api/cam';

**Error handling**:

* Using `ApiException` or `throw new ORPCError()` instead of `.errors()` (breaks observability—all become 500s)  
* Missing structured logging with `workflowLogger.ts` helpers  
* DB ops outside `DBOS.runStep()` (breaks durability)  
* Missing `recordWorkflowEvent()` calls (breaks audit trail)

**SSR issues**:

* Using client-side `onMount` for critical values (race conditions)
* Using default `orpc` client in SSR (relative URLs fail server-side)
* Direct Prisma queries for user context in page server loads (RLS blocks before context established)
* Direct Prisma queries in oRPC handler bootstrap (`get_user_memberships`, `get_staff_profile` bypass RLS)

**RLS connection pooling**:

* Using `setOrgContext()` outside a transaction (context may be set on different connection than query)
* Calling `query(args)` in Prisma extensions instead of `tx[modelName][operation](args)` (runs on wrong connection)
* Intermittent 0 results despite data existing = connection pooling race condition
* Fix: Always use `withRLSContext()` which wraps queries in transactions with proper context management

**oRPC Client Usage (SSR Critical)**:

| Client | Use In | Import From |
| ----- | ----- | ----- |
| `orpc` | Browser, `+page.svelte` | `$lib/api` |
| `createOrgClient(orgId, fetch?)` | Browser with explicit org | `$lib/api` |
| `createDirectClient(context)` | `+page.server.ts` | `$lib/server/api/serverClient` |
| `buildServerContext(locals, opts?)` | Build context for direct client | `$lib/server/api/serverClient` |

**Server load pattern**:

typescript  
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';

export const load: PageServerLoad \= async ({ locals, parent }) \=\> {  
  const { staff, memberships } \= await parent();  *// From root layout via SECURITY DEFINER*  
    
  const orgRoles: Record\<string, any\> \= {};  
  for (const m of memberships ?? \[\]) orgRoles\[m.organization.id\] \= m.role;  
    
  const context \= buildServerContext(locals, {   
    orgRoles,   
    staffRoles: staff?.roles ?? \[\],   
    pillarAccess: staff?.pillarAccess ?? \[\]   
  });  
  const client \= createDirectClient(context);  
    
  const response \= await client.myResource.list({ ... });  
  return { items: response.data.items };

};

**Other**:

* Cerbos duplicate resource+version  
* Missing derived roles in `common.yaml`  
* PowerShell `[id]` folders need `-LiteralPath`  
* TIMESTAMP vs TIMESTAMPTZ in SECURITY DEFINER functions  
* Enum arrays in functions need `::TEXT[]` cast

---

## **Document Upload/Download Workflow**

**Architecture**: Browser → TUS (tusd) → SeaweedFS S3 → TUS Hook → App Server → Worker → S3

**Upload flow**:

1. `document.initiateUpload` creates record (status: `PENDING_UPLOAD`)  
2. Client uploads via TUS to tusd → SeaweedFS  
3. TUS `post-finish` hook → `/api/internal/tus-hook` → DBOS workflow  
4. Workflow: fetch via `get_document_organization()` SECURITY DEFINER, update to `PROCESSING`, dispatch to `worker-document`, finalize to `ACTIVE`/`INFECTED`

**RLS bypass for TUS hook**:

typescript  
*// … Use SECURITY DEFINER function*  
const rows \= await prisma.$queryRaw\<DocOrgRow\[\]\>\`  
  SELECT \* FROM get\_document\_organization(${documentId})  
\`;

*// âŒ RLS blocks (no org context)*

const doc \= await prisma.document.findUnique({ where: { id: documentId } });

**Worker results to finalization**:

typescript  
*// … Pass derivatives at top level*  
await finalizeProcessing(docId, {  
  status: workerResult.status,  
  derivatives: workerResult.derivatives,  *// Must be top-level*  
  metadata: workerResult.metadata

}, storagePath);

**Download**: Presigned URLs via `getDownloadUrl`/`getThumbnailUrl`. Extract S3 key from `thumbnailUrl` for presigning.

**Worker**: Python service with ClamAV (virus definitions in `clamav_data` volume), ExifTool (metadata), pyvips/ffmpeg (thumbnails).

---

## **Expected Outputs**

* Updated `schema.prisma`  
* Updated oRPC routers  
* Zod schema modifications  
* DBOS workflows with version suffixes  
* Generated OpenAPI spec  
* SRD notes  
* Updated Cerbos policies (if new resources/roles)  
* Passing `bun run check`

