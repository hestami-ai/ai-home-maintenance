# (Phase 37) Staff Portal Organizations Management - Implementation Roadmap

## Overview

This document tracks the implementation progress for the Staff Portal Organizations Management feature.

**Start Date**: _______________
**Target Completion**: _______________
**Status**: Not Started

---

## Phase 1: Database Layer

### 1.1 Create Migration File
- [ ] Create migration directory: `prisma/migrations/YYYYMMDDHHMMSS_organization_admin_functions/`
- [ ] Create `migration.sql` file

### 1.2 SECURITY DEFINER Functions
- [ ] `get_all_organizations_for_staff()` - List all orgs with stats
- [ ] `get_organization_details_for_staff()` - Full org details
- [ ] `get_organization_members_for_staff()` - Members list
- [ ] `update_organization_status_for_staff()` - Status changes
- [ ] `update_organization_info_for_staff()` - Info updates
- [ ] Grant EXECUTE permissions to `hestami_app`

### 1.3 Verification
- [ ] Run `bunx prisma migrate dev`
- [ ] Test functions with direct SQL queries
- [ ] Verify grants are applied

**Phase 1 Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

---

## Phase 2: Authorization Layer (Cerbos)

### 2.1 Create Policy
- [ ] Create `cerbos/policies/resource/organization_admin.yaml`
- [ ] Define `view`, `list`, `view_members` for `hestami_staff`
- [ ] Define `edit`, `update_status`, `suspend`, `activate` for `hestami_platform_admin`

### 2.2 Verification
- [ ] Restart Cerbos container
- [ ] Test policy with Cerbos playground (if available)
- [ ] Verify derived roles resolve correctly

**Phase 2 Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

---

## Phase 3: API Layer (oRPC Router)

### 3.1 Create Router
- [ ] Create `src/lib/server/api/routes/organizationAdmin.ts`
- [ ] Import required dependencies (Zod, Cerbos, Prisma, etc.)

### 3.2 Implement Endpoints
- [ ] `list` - List organizations with filtering/pagination
- [ ] `get` - Get single organization details
- [ ] `getMembers` - Get organization members
- [ ] `updateStatus` - Change organization status (Platform Admin)
- [ ] `update` - Update organization info (Platform Admin)

### 3.3 Register Router
- [ ] Add import in `src/lib/server/api/index.ts`
- [ ] Add `organizationAdmin: organizationAdminRouter` to appRouter

### 3.4 Verification
- [ ] Run `bun run build` to verify TypeScript compilation
- [ ] Check for import errors

**Phase 3 Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

---

## Phase 4: Type Generation

### 4.1 Generate Types
- [ ] Run `bun run openapi:generate`
- [ ] Run `bun run types:generate`

### 4.2 Verification
- [ ] Verify `organizationAdmin` appears in `types.generated.ts`
- [ ] Run `bun run check` - must pass

**Phase 4 Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

---

## Phase 5: API Client

### 5.1 Create Client Module
- [ ] Create `src/lib/api/organizationAdmin.ts`

### 5.2 Implement Types & Helpers
- [ ] Export types from `types.generated.ts`
- [ ] Define `ORGANIZATION_TYPE_LABELS`
- [ ] Define `ORGANIZATION_STATUS_LABELS`
- [ ] Define `ORGANIZATION_STATUS_COLORS`
- [ ] Define `ORGANIZATION_TYPE_TABS` (contextual tabs per type)

### 5.3 Implement API Functions
- [ ] `organizationAdminApi.list()`
- [ ] `organizationAdminApi.get()`
- [ ] `organizationAdminApi.getMembers()`
- [ ] `organizationAdminApi.update()`
- [ ] `organizationAdminApi.updateStatus()`
- [ ] `organizationAdminApi.suspend()` (convenience)
- [ ] `organizationAdminApi.activate()` (convenience)

**Phase 5 Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

---

## Phase 6: Frontend - List View

### 6.1 Create Page Server
- [ ] Create `src/routes/app/admin/organizations/+page.server.ts`
- [ ] Implement SSR data loading with `createDirectClient`
- [ ] Handle query params for filtering

### 6.2 Create Page Component
- [ ] Create `src/routes/app/admin/organizations/+page.svelte`

### 6.3 Implement UI Components
- [ ] Page header with title and description
- [ ] Stats summary cards (Total, Active, Suspended, by Type)
- [ ] Search input
- [ ] Type filter dropdown
- [ ] Status filter dropdown
- [ ] Organizations table
  - [ ] Name column (clickable)
  - [ ] Type column (badge)
  - [ ] Status column (colored badge)
  - [ ] Members column
  - [ ] Cases column
  - [ ] Created column
  - [ ] Actions column (View button)
- [ ] Empty state
- [ ] Loading state
- [ ] Error handling

**Phase 6 Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

---

## Phase 7: Frontend - Detail View

### 7.1 Create Page Server
- [ ] Create `src/routes/app/admin/organizations/[id]/+page.server.ts`
- [ ] Load organization details
- [ ] Load initial members
- [ ] Pass `isPlatformAdmin` flag

### 7.2 Create Page Component
- [ ] Create `src/routes/app/admin/organizations/[id]/+page.svelte`

### 7.3 Implement UI Components
- [ ] Back link to list
- [ ] Header with name, type badge, status badge
- [ ] Action buttons (Platform Admin only)
  - [ ] Edit button
  - [ ] Suspend/Activate button
- [ ] Tab navigation (contextual per type)
- [ ] Overview tab
  - [ ] Basic info card
  - [ ] Stats cards
  - [ ] Contact info card
- [ ] Members tab
  - [ ] Members table
  - [ ] Pagination
- [ ] Activity tab (placeholder or real)

### 7.4 Implement Modals
- [ ] Edit Organization modal
  - [ ] Name field
  - [ ] Contact name field
  - [ ] Contact email field
  - [ ] Contact phone field
  - [ ] Save/Cancel buttons
- [ ] Status Change modal
  - [ ] Status selection
  - [ ] Reason textarea
  - [ ] Confirm/Cancel buttons

**Phase 7 Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

---

## Phase 8: Navigation & Integration

### 8.1 Update Admin Navigation
- [ ] Edit `src/routes/app/admin/+layout.svelte`
- [ ] Change "Customers" label to "Organizations"
- [ ] Update href to `/app/admin/organizations`
- [ ] Change icon to `Building2` (import from lucide-svelte)

### 8.2 Create Redirect
- [ ] Create `src/routes/app/admin/customers/+page.server.ts`
- [ ] Implement 301 redirect to `/app/admin/organizations`
- [ ] Delete or keep old `+page.svelte` (optional cleanup)

### 8.3 Case Detail Integration
- [ ] Update `src/routes/app/admin/cases/[id]/+page.svelte`
- [ ] Make organization name clickable
- [ ] Link to `/app/admin/organizations/{organizationId}`
- [ ] Update server load if needed to include `organizationId`

**Phase 8 Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

---

## Phase 9: Testing & Verification

### 9.1 Type Checking
- [ ] Run `bun run check` - must pass
- [ ] Fix any TypeScript errors

### 9.2 Functional Testing
- [ ] Navigate to `/app/admin/organizations`
- [ ] Verify list loads with data
- [ ] Test search functionality
- [ ] Test type filter
- [ ] Test status filter
- [ ] Click organization to view details
- [ ] Verify detail page loads
- [ ] Test tabs navigation
- [ ] (Platform Admin) Test Edit functionality
- [ ] (Platform Admin) Test Suspend functionality
- [ ] (Platform Admin) Test Activate functionality
- [ ] Verify activity events created

### 9.3 Navigation Testing
- [ ] Verify sidebar shows "Organizations"
- [ ] Navigate to `/app/admin/customers` - verify redirect
- [ ] Click org link from case detail - verify navigation

### 9.4 Authorization Testing
- [ ] Test as regular staff (view only)
- [ ] Test as Platform Admin (view + edit)
- [ ] Verify edit buttons hidden for non-admins

**Phase 9 Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

---

## Summary Checklist

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Database Layer (SECURITY DEFINER functions) | [ ] |
| 2 | Authorization Layer (Cerbos policy) | [ ] |
| 3 | API Layer (oRPC router) | [ ] |
| 4 | Type Generation | [ ] |
| 5 | API Client | [ ] |
| 6 | Frontend - List View | [ ] |
| 7 | Frontend - Detail View | [ ] |
| 8 | Navigation & Integration | [ ] |
| 9 | Testing & Verification | [ ] |

---

## Files Checklist

### New Files
- [ ] `prisma/migrations/YYYYMMDDHHMMSS_organization_admin_functions/migration.sql`
- [ ] `cerbos/policies/resource/organization_admin.yaml`
- [ ] `src/lib/server/api/routes/organizationAdmin.ts`
- [ ] `src/lib/api/organizationAdmin.ts`
- [ ] `src/routes/app/admin/organizations/+page.server.ts`
- [ ] `src/routes/app/admin/organizations/+page.svelte`
- [ ] `src/routes/app/admin/organizations/[id]/+page.server.ts`
- [ ] `src/routes/app/admin/organizations/[id]/+page.svelte`
- [ ] `src/routes/app/admin/customers/+page.server.ts` (redirect)

### Modified Files
- [ ] `src/lib/server/api/index.ts` (register router)
- [ ] `src/routes/app/admin/+layout.svelte` (navigation)
- [ ] `src/routes/app/admin/cases/[id]/+page.svelte` (org link)

---

## Notes

_Use this section to track issues, decisions, or deviations from the plan._

---

## Completion Sign-off

- [ ] All phases complete
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Documentation updated

**Completed Date**: _______________
**Completed By**: _______________
