# Phase 21: PostgreSQL Row-Level Security (RLS) Enforcement

## Overview

This document provides implementation requirements for enabling PostgreSQL Row-Level Security (RLS) enforcement in the Hestami AI platform. Currently, RLS policies exist but are bypassed because the database user has `BYPASSRLS` privilege. This phase enables true database-level multi-tenant isolation.

## Current State

### What Exists

1. **RLS is enabled** on tenant-scoped tables (e.g., `concierge_cases`)
2. **RLS policies exist** that filter by `organization_id = current_org_id()`
3. **`current_org_id()` function** returns `current_setting('app.current_org_id', true)`
4. **RLS helper functions** in `src/lib/server/db/rls.ts`:
   - `setOrgContext(orgId, context?)` - Sets the session variable
   - `clearOrgContext(userId?)` - Clears the session variable
   - `withOrgContext(orgId, callback, context?)` - Wrapper for scoped execution
   - `lookupWorkItemOrgId(itemType, itemId)` - Looks up org for a work item (uses RLS-exempt view)
   - `setOrgContextForWorkItem(userId, itemType, itemId)` - Sets context with audit trail

### Why RLS Is Not Enforced

The `hestami` database user has `rolbypassrls = true`:

```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'hestami';
-- Result: hestami | t
```

All queries bypass RLS regardless of whether `app.current_org_id` is set.

## Implementation Requirements

### 1. Database User Setup

Create a new database user for application runtime that does NOT have BYPASSRLS:

```sql
-- Create application user (no BYPASSRLS)
CREATE USER hestami_app WITH PASSWORD 'tFYptC3rAY2Ab2jpo52GuLxMqZGyJCXJIt4+DMuolb0' NOINHERIT;

-- Grant schema access
GRANT USAGE ON SCHEMA public TO hestami_app;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hestami_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hestami_app;

-- Ensure future tables get same grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hestami_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO hestami_app;
```

Keep the existing `hestami` user (with BYPASSRLS) for migrations and admin operations.

### 2. Prisma Configuration

Update `prisma/schema.prisma` to use `directUrl` for migrations:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")        // Runtime: hestami_app (RLS enforced)
  directUrl = env("DIRECT_DATABASE_URL") // Migrations: hestami (BYPASSRLS)
}
```

Update environment variables:

```bash
# .env
DATABASE_URL="postgresql://hestami_app:tFYptC3rAY2Ab2jpo52GuLxMqZGyJCXJIt4+DMuolb0@localhost:5432/hestami"
DIRECT_DATABASE_URL="postgresql://hestami:oIDz7%2B5Fal7bVHwJTOF7yQ%219ZYQqg29IiD68jkORmGpSg@localhost:5432/hestami"
```

### 3. Middleware Implementation

Add RLS context setting to `orgProcedure` in `src/lib/server/api/router.ts`.

**Current code** (around line 110-134):

```typescript
export const orgProcedure = authedProcedure
  .errors({
    FORBIDDEN: { message: 'Organization context required or Permission denied' }
  })
  .use(async ({ context, next, errors }) => {
    if (!context.organization) {
      throw errors.FORBIDDEN({
        message: 'Organization context required. Set X-Org-Id header.'
      });
    }

    const user = context.user!;
    const organization = context.organization;
    const role = context.role!;

    // Build Cerbos principal...
    const principal = buildPrincipal(...);

    // Create Cerbos helper functions...
    const cerbosHelpers = { ... };

    return next({
      context: {
        ...context,
        user,
        organization,
        role,
        cerbos: cerbosHelpers
      }
    });
  });
```

**Required changes:**

1. Import RLS functions:
   ```typescript
   import { setOrgContext, clearOrgContext } from '../db/rls.js';
   ```

2. Wrap the `next()` call with RLS context:
   ```typescript
   // Set RLS context before executing the procedure
   await setOrgContext(organization.id, { userId: user.id });
   
   try {
     return await next({
       context: {
         ...context,
         user,
         organization,
         role,
         cerbos: cerbosHelpers
       }
     });
   } finally {
     // Always clear context, even on error
     await clearOrgContext(user.id);
   }
   ```

### 4. Staff Cross-Org Access Patterns

The middleware handles Pattern A (regular org-scoped queries). Two additional patterns need manual handling:

#### Pattern B: Staff Viewing Specific Item from Another Org

When staff views a specific case/item that belongs to a different organization, the route must:

1. Detect that the user has cross-org access (already implemented via `hasCrossOrgAccess()`)
2. Look up the item's organization
3. Set RLS context to that organization with audit trail

**Example for `conciergeCase.ts` get/getDetail handlers:**

```typescript
import { setOrgContextForWorkItem, clearOrgContext } from '../../../db/rls.js';

.handler(async ({ input, context, errors }) => {
  let orgContextSet = false;
  
  try {
    if (hasCrossOrgAccess(context.staffRoles, context.pillarAccess)) {
      // Staff cross-org: look up item's org and set context with audit
      const orgId = await setOrgContextForWorkItem(
        context.user.id,
        'CONCIERGE_CASE',
        input.id
      );
      if (!orgId) {
        throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
      }
      orgContextSet = true;
    }
    // If not cross-org, middleware already set context to user's org
    
    const conciergeCase = await prisma.conciergeCase.findFirst({
      where: {
        id: input.id,
        deletedAt: null
        // No org filter needed - RLS handles it
      },
      include: { ... }
    });

    if (!conciergeCase) {
      throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
    }

    // Cerbos authorization
    await context.cerbos.authorize('view', 'concierge_case', conciergeCase.id, {
      organizationId: conciergeCase.organizationId
    });

    return successResponse({ case: { ... } });
  } finally {
    if (orgContextSet) {
      await clearOrgContext(context.user.id);
    }
  }
});
```

#### Pattern C: Staff Listing Items Across All Orgs

For staff work queue / case listing across all organizations, RLS cannot filter to "all orgs".

**Staff-specific views** allow listing across all organizations without RLS filtering.

Create a PostgreSQL view without RLS for staff listing:

```sql
-- View for staff to list cases across all orgs (no RLS)
CREATE VIEW staff_concierge_cases_list AS
SELECT 
  cc.id,
  cc.case_number,
  cc.title,
  cc.status,
  cc.priority,
  cc.organization_id,
  o.name as organization_name,
  cc.created_at
FROM concierge_cases cc
JOIN organizations o ON cc.organization_id = o.id
WHERE cc.deleted_at IS NULL;

-- Grant access to app user
GRANT SELECT ON staff_concierge_cases_list TO hestami_app;
```

Then in the route, check if user has cross-org access and query the view:

```typescript
.handler(async ({ input, context }) => {
  if (hasCrossOrgAccess(context.staffRoles, context.pillarAccess)) {
    // Staff: use the staff view (no RLS)
    const cases = await prisma.$queryRaw`
      SELECT * FROM staff_concierge_cases_list
      ORDER BY created_at DESC
      LIMIT ${input.limit} OFFSET ${input.offset}
    `;
    return successResponse({ cases, ... });
  }
  
  // Regular user: RLS filters to their org automatically
  const cases = await prisma.conciergeCase.findMany({ ... });
  return successResponse({ cases, ... });
});
```

### 5. DBOS Workflow Considerations

DBOS workflows execute asynchronously and may use different database connections/sessions than the originating HTTP request. The RLS context (`app.current_org_id`) is a **session-local variable** that does NOT automatically propagate to workflow executions.

#### The Problem

```
HTTP Request → Sets RLS context → Starts DBOS workflow → Workflow runs in different session → NO RLS context!
```

Each `DBOS.runStep()` may use a different connection from the pool, so RLS context must be set **within each step**.

#### Current Workflow Pattern

Workflows currently receive `organizationId` as input and pass it explicitly:

```typescript
// Current pattern - explicit org filtering (works without RLS enforcement)
const newCase = await prisma.conciergeCase.create({
  data: {
    organizationId,  // Explicitly set in data
    propertyId,
    // ...
  }
});
```

#### Connection Pooling Test Results

Testing confirmed that with `PrismaPg` adapter:
- Consecutive queries may use the same connection (context persists)
- **Critical**: Context set inside a transaction **leaks** after the transaction ends
- Context must be **explicitly cleared** after every operation for security

#### Recommended Approach: `orgTransaction`

Use `orgTransaction()` from `rls.ts` for all workflow database operations. This is preferred because:
1. Most workflow steps already use `prisma.$transaction()` - minimal refactoring
2. Guarantees atomicity of the operation
3. Provides audit trail via context parameter

```typescript
import { orgTransaction, clearOrgContext } from '../db/rls.js';

async function createCase(
  organizationId: string,
  userId: string,
  // ... other params
): Promise<{ id: string; caseNumber: string; status: string }> {
  try {
    return await orgTransaction(organizationId, async (tx) => {
      const createdCase = await tx.conciergeCase.create({
        data: {
          // organizationId still needed for INSERT (RLS doesn't auto-populate)
          organizationId,
          propertyId,
          // ...
        }
      });
      // ... rest of transaction
      return { id: createdCase.id, caseNumber: createdCase.caseNumber, status: createdCase.status };
    }, { userId, reason: 'Creating case via workflow' });
  } finally {
    // CRITICAL: Always clear context to prevent leakage to next request
    await clearOrgContext(userId);
  }
}
```

#### Why Context Clearing is Mandatory

PostgreSQL session variables persist on the connection. Without explicit clearing:
1. Request A sets context for Org A, completes
2. Connection returns to pool with Org A context still set
3. Request B gets same connection
4. Request B briefly sees Org A data before setting its own context

**Security risk**: Brief window where wrong org data is visible.

#### Workflow Files Requiring Updates

| Workflow File | Step Functions to Update |
|---------------|-------------------------|
| `caseLifecycleWorkflow.ts` | `createCase`, `transitionStatus`, `assignConcierge`, `resolveCase`, `closeCase`, `cancelCase` |
| `arcRequestWorkflow.ts` | `createRequest`, `updateRequest`, `submitRequest`, etc. |
| `arcReviewWorkflow.ts` | `addMember`, `removeMember`, `assignCommittee`, `submitReview`, `recordDecision` |
| `arcReviewLifecycle.ts` | `validateTransition`, `updateARCRequestStatus`, `checkApprovalExpiration`, `queueNotifications` |
| `appealWorkflow.ts` | `fileAppeal`, `scheduleHearing`, `recordDecision`, `withdrawAppeal` |
| `assessmentPosting.ts` | `getAssessmentType`, `getUnitsForCharging`, `createAssessmentCharges`, `applyLateFees` |
| `billingWorkflow.ts` | `createProposal`, `updateProposalStatus`, etc. |
| `violationWorkflow.ts` | All step functions |
| `workOrderWorkflow.ts` | All step functions |

#### Important Notes

1. **Always clear context** - Use try/finally or the wrapper functions to ensure context is cleared even on errors
2. **Audit trail** - The `context` parameter to `withOrgContext`/`orgTransaction` enables audit logging
3. **Staff workflows** - If staff can trigger workflows for other orgs, use `setOrgContextForWorkItem()` pattern
4. **Testing** - Each workflow needs testing with RLS enforcement enabled

#### Estimated Additional Effort

| Task | Effort |
|------|--------|
| Update workflow step functions | 4-6 hours |
| Add RLS context to each step | 2-3 hours |
| Testing workflows with RLS | 3-4 hours |
| **Total additional** | **~1-2 days** |

### 6. Tables Requiring RLS Review

Verify RLS is enabled and policies exist for all tenant-scoped tables:

| Table | RLS Enabled | Policy Exists | Notes |
|-------|-------------|---------------|-------|
| `concierge_cases` | ✅ | ✅ | Verified |
| `properties` | ? | ? | Check |
| `work_orders` | ? | ? | Check |
| `owner_intents` | ? | ? | Check |
| `case_notes` | ? | ? | Check |
| `case_participants` | ? | ? | Check |
| `documents` | ? | ? | Check |
| `activity_events` | ? | ? | Check |

Run this query to check all tables:

```sql
SELECT 
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;
```

### 7. Staff Work Queue Org Lookup View

Verify the `staff_work_queue_org_lookup` view exists and includes all work item types:

```sql
-- Check if view exists
SELECT * FROM information_schema.views WHERE table_name = 'staff_work_queue_org_lookup';

-- If not, create it:
CREATE OR REPLACE VIEW staff_work_queue_org_lookup AS
SELECT 'CONCIERGE_CASE' as item_type, id as item_id, organization_id FROM concierge_cases WHERE deleted_at IS NULL
UNION ALL
SELECT 'WORK_ORDER' as item_type, id as item_id, organization_id FROM work_orders WHERE deleted_at IS NULL
UNION ALL
SELECT 'OWNER_INTENT' as item_type, id as item_id, organization_id FROM owner_intents WHERE deleted_at IS NULL;

-- Grant to app user (no RLS on views by default)
GRANT SELECT ON staff_work_queue_org_lookup TO hestami_app;
```

## Testing Requirements - Deferred

### Unit Tests

1. **RLS context is set correctly** - Verify `app.current_org_id` is set after middleware runs
2. **RLS context is cleared** - Verify context is cleared even on errors
3. **Cross-org access works for staff** - Staff can view items from other orgs
4. **Regular users are isolated** - Users cannot see other orgs' data

### Integration Tests

1. **Create case in Org A, verify Org B user cannot see it**
2. **Create case in Org A, verify staff user CAN see it**
3. **Verify audit trail is created for staff cross-org access**
4. **Verify migrations still work with admin user**

### Manual Verification

```sql
-- Connect as hestami_app user and verify RLS is enforced
SET ROLE hestami_app;

-- Without context, should return empty
SELECT * FROM concierge_cases LIMIT 5;

-- With context, should return org's cases
SELECT set_current_org_id('<org-id>');
SELECT * FROM concierge_cases LIMIT 5;

-- Reset
RESET ROLE;
```

## Migration Checklist

- [ ] Create `hestami_app` database user without BYPASSRLS
- [ ] Grant appropriate permissions to `hestami_app`
- [ ] Update Prisma schema with `directUrl`
- [ ] Update `.env` files with both DATABASE_URL values
- [ ] Update Docker compose / deployment configs with new credentials
- [ ] Add RLS context middleware to `orgProcedure`
- [ ] Create `staff_concierge_cases_list` view for staff listing
- [ ] Verify `staff_work_queue_org_lookup` view exists
- [ ] Update `conciergeCase.ts` get/getDetail for Pattern B
- [ ] Update `conciergeCase.ts` list for Pattern C
- [ ] Review and update other routes that need cross-org access
- [ ] Verify RLS policies exist on all tenant-scoped tables
- [ ] Add integration tests for RLS enforcement
- [ ] Test migrations with admin user
- [ ] Test runtime queries with app user
- [ ] Verify staff cross-org access with audit trail

## Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `directUrl` to datasource |
| `.env` / `.env.example` | Add `DIRECT_DATABASE_URL` |
| `src/lib/server/api/router.ts` | Add RLS context middleware |
| `src/lib/server/api/routes/concierge/conciergeCase.ts` | Update for Patterns B & C |
| `compose.dev.yaml` / `compose.prod.yaml` | Add new DB user credentials |
| New SQL migration | Create `hestami_app` user, staff views |

## Security Considerations

1. **Never log the org context value** - Could leak tenant information
2. **Always clear context in finally block** - Prevent context leakage between requests
3. **Audit all staff cross-org access** - Use `setOrgContextForWorkItem()` with full context
4. **Review staff views carefully** - They bypass RLS, ensure they only expose necessary columns
5. **Rotate credentials** - Generate new password for `hestami_app` user

## Rollback Plan

If issues arise after deployment:

1. **Quick rollback**: Change `DATABASE_URL` back to `hestami` user (has BYPASSRLS)
2. **Verify**: Application works as before
3. **Investigate**: Check logs for RLS-related errors
4. **Fix and retry**: Address issues and redeploy

The existing application-layer filtering (`buildOrgFilter()` in `conciergeCase.ts`) provides a safety net during transition.

## Other RLS Enforcement Requirements

### Staff Work Queue (Exemplar implementation)

1. **Security DEFINER Functions**
- Created `migration.sql` with PostgreSQL functions that bypass RLS:

Function	Purpose
get_staff_work_queue()	Returns all work items with complete details
get_staff_work_queue_summary()	Returns counts by status for dashboard
get_work_item_org()	Lookup org ID for RLS context setting
These use SECURITY DEFINER to run as the owner (hestami = BYPASSRLS).

2. **Work Queue API Refactored**
- Updated `workQueue.ts`:

Replaced 4 separate Prisma queries → 1 function call
Added direct Cerbos authorization
Code reduced from ~250 lines to ~100 lines
3. **Admin Route Protection**
- Created `+layout.server.ts`:

Verifies user is active Hestami staff
Redirects non-staff to /app
4. **Cerbos Policy**
- Created `work_queue.yaml`:

Allows hestami_staff and hestami_platform_admin to view work queue
