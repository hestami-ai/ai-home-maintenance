# Phase 35: RLS Connection Pooling Fix - System Requirements

## Executive Summary

This document addresses a critical race condition in the Row-Level Security (RLS) implementation when using Prisma's connection pooling with concurrent API calls. The issue causes intermittent zero counts on the Concierge Dashboard for Active Calls and Documents.

**Scope**: This phase focuses on the **Concierge pillar**. The **CAM pillar** is already addressed by Phase 30 (Association-Level Document Isolation), which implements tiered RLS (Organization + Association) with transaction-scoped context setting.

**Related Documentation**:
- Phase 30: `(Phase 30) Association-Level Document Isolation Requirements.md` - CAM pillar tiered RLS
- Phase 30: `(Phase 30) Association-Level Document Isolation Implementation Roadmap.md` - CAM implementation (P30.1-P30.4 complete)

## Background Context

### Problem Statement

The Concierge Dashboard displays summary counts for:
- **Properties** - Always works correctly
- **Active Calls** - Intermittently returns 0
- **Documents** - Intermittently returns 0

### Root Cause Analysis

The intermittent zeros are caused by a race condition between PostgreSQL session variables and Prisma's connection pooling.

#### How RLS Works in This System

1. **RLS Implementation**: The application uses PostgreSQL session variables (`app.current_org_id`) to enforce multi-tenancy via Row-Level Security policies.

2. **orgProcedure Middleware**: The `orgProcedure` middleware in `src/lib/server/api/router.ts`:
   - Sets org context by executing `setOrgContext` (raw SQL) before the handler runs
   - Clears context using `clearOrgContext` afterwards

3. **Connection Pooling Issue**: Prisma manages a pool of database connections. When a handler executes a query (e.g., `prisma.document.findMany`), Prisma may pick **any available connection** from the pool.

4. **Race Condition in `Promise.all`**: The dashboard's `+page.server.ts` makes three data-fetching calls in parallel:
   ```
   Call A sets context on Connection 1
   Call B sets context on Connection 2
   Call A's handler executes query → Prisma assigns Connection 3 (empty RLS context!)
   ```
   Because the RLS context is empty on Connection 3, the database returns zero rows.

#### Why Properties Always Works

Investigation revealed that the `individual_properties` table:
1. Does **NOT** have RLS enabled (verified in migrations)
2. The router explicitly filters by `ownerOrgId` in the `WHERE` clause

This makes it immune to the connection-pooling issue because tenant isolation is enforced at the application level, not the database level.

#### Proof from Codebase

| Router | RLS Enabled | Explicit Org Filter | Result |
|--------|-------------|---------------------|--------|
| `individualProperty.ts` | ❌ No | ✅ `ownerOrgId: context.organization.id` | Always works |
| `conciergeCase.ts` | ✅ Yes | ✅ Added recently | Should work now |
| `document.ts` | ✅ Yes | ⚠️ Needs verification | Intermittent failures |

## System Requirements

### SR-1: Defense in Depth (Application-Level Filtering)

**Requirement**: All tenant-scoped queries MUST include explicit `organizationId` (or equivalent) in the `WHERE` clause, regardless of RLS policies.

**Rationale**: 
- Provides immediate protection regardless of RLS state
- Guards against connection pool context loss
- Industry best practice (belt-and-suspenders approach)

**Affected Components**:
- All oRPC routers with tenant-scoped data
- All Prisma queries on multi-tenant tables

### SR-2: Transactional RLS Context (Systemic Fix)

**Requirement**: The `orgProcedure` middleware MUST ensure that `setOrgContext`, handler queries, and `clearOrgContext` all execute on the **same database connection**.

**Context**: Per the Hestami AI Developer Onboarding guidelines (Section 6), all mutations already use DBOS workflows with `prisma.$transaction()` inside `DBOS.runStep()`. The issue is that the RLS context (`setOrgContext`) is set **outside** the transaction, potentially on a different connection.

**Current State**:
```typescript
// CURRENT (broken): RLS context set outside transaction
await setOrgContext(prisma, orgId);  // Connection A
const result = await handler();       // DBOS workflow uses Connection B!
await clearOrgContext(prisma);        // Connection C
```

**Target State**:
```typescript
// TARGET: RLS context set within the same transaction as queries
// Option A: Set context at start of each DBOS.runStep transaction
await DBOS.runStep(
  () => prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_current_org_id(${orgId})`;
    const entity = await tx.myEntity.create({ data: {...} });
    return entity;
  }),
  { name: 'createEntity' }
);

// Option B: Wrap entire orgProcedure in interactive transaction
await prisma.$transaction(async (tx) => {
  await setOrgContext(tx, orgId);
  const result = await handler(tx); // Pass tx through context
  await clearOrgContext(tx);
  return result;
}, { timeout: 30000 }); // Extended timeout for complex operations
```

**Trade-offs**:
- Option A: More granular, works with existing DBOS pattern, but requires modifying each workflow
- Option B: Centralized fix in middleware, but requires passing `tx` through context to all handlers

### SR-3: Comprehensive RLS Coverage

**Requirement**: All tenant-scoped tables MUST have RLS policies enabled.

**Current Gaps Identified**:

| Table | Tenant Column | RLS Status | Action Required |
|-------|---------------|------------|-----------------|
| `individual_properties` | `owner_org_id` | ❌ Missing | Add RLS policy |
| `individual_assets` | via `property_id` | ❌ Missing | Add join-based RLS |
| `individual_maintenance_requests` | via `property_id` | ❌ Missing | Add join-based RLS |
| `property_ownerships` | via `property_id` | ❌ Missing | Add join-based RLS |
| `portfolio_properties` | via `portfolio_id` | ❌ Missing | Add join-based RLS |
| Various Phase 3 child tables | via parent | ⚠️ Verify | Audit and add as needed |

### SR-4: Tables Correctly Without RLS

The following tables should **NOT** have RLS as they are platform-level:

| Table | Reason |
|-------|--------|
| `organizations` | The tenant entity itself |
| `users` | Users can belong to multiple orgs |
| `staff` | Platform-level internal staff |
| `sessions`, `accounts`, `verifications` | Authentication tables |
| `system_settings` | Global configuration |

## Success Criteria

1. **Dashboard Consistency**: Properties, Active Calls, and Documents counts are always accurate on every page load
2. **No Race Conditions**: Concurrent API calls never result in RLS context loss
3. **Complete RLS Coverage**: All tenant-scoped tables have RLS policies
4. **Defense in Depth**: All queries have explicit org filters regardless of RLS

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Missed table in RLS audit | Medium | High | Comprehensive schema review |
| Breaking existing queries | Low | Medium | Incremental rollout with testing |
| Performance impact of transactions | Low | Low | Transactions are already used elsewhere |
| Migration failures | Low | Medium | Test in staging first |

## Dependencies

- PostgreSQL 14+ (RLS support)
- Prisma 5.x (transaction support)
- Existing RLS infrastructure (`current_org_id()` function, etc.)

## References

- **Onboarding Guidelines**: `docs/Hestami AI Developer Agent - Onboarding v2.md`
  - Section 4: Multitenancy - "All queries filter on `organization_id`"
  - Section 6: DBOS Workflows - Transaction patterns
  - Section 9: RLS & SECURITY DEFINER
- **Phase 30 (CAM Pillar)**: `(Phase 30) Association-Level Document Isolation Requirements.md`
  - Section 5.4: "Set `app.current_assoc_id` at the start of every transaction"
  - Already implements transaction-scoped context for CAM pillar
- Migration: `20251219000000_enable_rls_policies`
- RLS Setup: `00000000000000_rls_setup`
- Router: `src/lib/server/api/router.ts`
- Dashboard: `src/routes/app/concierge/+page.server.ts`
