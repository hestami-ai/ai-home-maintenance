# (Phase 30) Association-Level Document Isolation Implementation Roadmap

## Overview
This roadmap outlines the steps to implement tiered RLS isolation (Organization + Association) within the CAM pillar, unify the document model, and enforce assignment-based access for Service Providers.

## Status Checklist

### P30.1: Schema Enhancement & Model Consolidation
- [x] Add `associationId` field to `Document` model in `schema.prisma`
- [x] Add `association` relation and appropriate indexes to `Document`
- [x] Add composite index `@@index([organizationId, associationId, status])` for common query patterns
- [x] Add `VIOLATION` and `ARC_REQUEST` to `DocumentContextType` enum (if not already present)
- [x] Deprecate `ViolationEvidence` model (mark with `@@deprecated` comment)
- [x] Deprecate `ARCDocument` model (mark with `@@deprecated` comment)
- [x] Generate Prisma client (`bunx prisma generate`)
- [x] Run Prisma migration (`bunx prisma migrate dev`)
- [x] Regenerate types (`bun run openapi:generate && bun run types:generate`)
- [x] Create migration script for existing data:
    - [x] Migrate `ViolationEvidence` records → `Document` + `DocumentContextBinding` (contextType=VIOLATION)
    - [x] Migrate `ARCDocument` records → `Document` + `DocumentContextBinding` (contextType=ARC_REQUEST)

**Note**: No active `ViolationEvidence` or `ARCDocument` records exist, so migration is structural only. After migration, update Violation and ARC workflows to create `Document` records with appropriate `DocumentContextBinding`.

### P30.2: SQL RLS Infrastructure
- [x] Update `rls_setup` migration to include `app.current_assoc_id` and `app.is_org_staff`
- [x] Implement `check_document_assignment(doc_id, user_id)` SQL helper function
- [x] Implement `get_user_associations(user_id, org_id)` SECURITY DEFINER function
- [x] Update `get_document_organization` SECURITY DEFINER function to handle associations
- [x] Recreate RLS policies for:
    - [x] `documents` (Tiered: Org + Assoc + Assignment + Staff)
    - [x] `violations` (Tiered: Org + Assoc + Staff)
    - [x] `arc_requests` (Tiered: Org + Assoc + Staff)
    - [x] `activity_events` (Tiered: Org + Assoc + Staff)

### P30.3: Backend Integration
- [x] Update `App.Locals` interface in `src/app.d.ts` to include `association` (similar to `organization`)
- [x] Update `RequestContext` type to include `associationId` and `isStaff`
- [x] Update `src/hooks.server.ts`:
    - [x] Extract `X-Assoc-Id` header from incoming requests
    - [x] Validate association membership/access against user's roles
    - [x] Populate `locals.association` following the same pattern as `locals.organization`
    - [x] Set SQL session variables (`app.current_assoc_id`, `app.is_org_staff`) at start of each transaction
- [x] Update oRPC context building:
    - [x] Update `buildServerContext()` in `src/lib/server/api/serverClient.ts` to include `associationId`
    - [x] Update `orgProcedure` and `baseProcedure` in `router.ts` to initialize association context
- [x] Update API clients:
    - [x] Update `createOrgClient()` in `src/lib/api/index.ts` to support `associationId` 
    - [x] Update `createDirectClient()` to propagate association context
- [x] Update DBOS Workflows:
    - [x] `documentWorkflow`: Support association stamping on document creation
    - [x] `violationWorkflow`: Use unified `Document` model with `DocumentContextBinding` (replace `ViolationEvidence` usage)
    - [x] `arcWorkflow`: Use unified `Document` model with `DocumentContextBinding` (replace `ARCDocument` usage)
- [x] Update TUS hook handler to propagate association ID from document lookup

### P30.4: Frontend & UI
- [x] Implement `AssociationSwitcher` component for CAM staff (dropdown in header)
    - Created `src/lib/components/layout/AssociationSwitcher.svelte`
    - Exported from `src/lib/components/layout/index.ts`
- [x] Update `+layout.server.ts` files to propagate association context through `parent()` pattern
    - CAM layout already fetches associations and propagates via context + camStore sync
    - Association context flows through `parent()` calls in nested layouts
- [x] Update Document List/Detail pages to support association filtering
    - Documents page uses `$currentAssociation` from store for filtering
    - Backend routes use `context.associationId` for RLS-enforced filtering
- [x] Update Violation/ARC forms to pass `associationId` when creating/uploading documents
    - Backend routes (`violation.ts`, `document.ts`) pass `context.associationId` to workflows
    - ARC form already passes `associationId: $currentAssociation.id`
- [x] Add "Active Association" indicator to the global header (badge or text next to org name)
    - Updated `Header.svelte` to show `AssociationSwitcher` when in CAM context
    - Uses `camStore` to access current association state
- [x] Update CAM sidebar navigation to reflect active association context
    - CAM layout shows `AssociationSelector` in content header bar
    - Sidebar badge counts are association-scoped via backend filtering

### P30.5: Testing & Verification
- [ ] Verify cross-association data isolation (Manager in Assoc A cannot see Assoc B)
- [ ] Verify assignment-based access for Service Providers (Assigned Vendor can see specific docs)
- [ ] Verify Staff bypass logic
- [ ] Perform migration dry-run on staging data
- [ ] Verify DPQ (Document Processing Queue) compatibility with association stamping

## Timeline
- **Week 1**: P30.1 (Schema) and P30.2 (SQL Infrastructure)
- **Week 2**: P30.3 (Backend Integration) and P30.4 (UI Implementation)
- **Week 3**: P30.5 (Testing & Verification) and Rollout
