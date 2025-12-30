# Phase 21: RLS Enforcement Implementation Roadmap

**Status**: In Progress - Schema Migration Complete  
**Target Completion**: TBD  
**Last Updated**: 2024-12-28

---

## Phase 1: Database Setup

### 1.1 Create Application Database User
- [x] Create `hestami_app` user without BYPASSRLS privilege
- [x] Grant CONNECT on database
- [x] Grant USAGE on public schema
- [x] Grant SELECT, INSERT, UPDATE, DELETE on all tables
- [x] Grant USAGE, SELECT on all sequences
- [x] Grant EXECUTE on RLS helper functions

```sql
-- Reference commands
CREATE USER hestami_app WITH PASSWORD 'tFYptC3rAY2Ab2jpo52GuLxMqZGyJCXJIt4+DMuolb';
GRANT CONNECT ON DATABASE hestami TO hestami_app;
GRANT USAGE ON SCHEMA public TO hestami_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hestami_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hestami_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hestami_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO hestami_app;
GRANT EXECUTE ON FUNCTION set_current_org_id(text) TO hestami_app;
GRANT EXECUTE ON FUNCTION current_org_id() TO hestami_app;
GRANT EXECUTE ON FUNCTION set_org_context_audited(text, text, text, text, text) TO hestami_app;
```

### 1.2 Verify RLS Policies Exist
- [x] Run RLS status query on all public tables
- [x] Verify `concierge_cases` has RLS enabled and policies
- [x] Verify `properties` has RLS enabled and policies ✅ Added via migration
- [x] Verify `work_orders` has RLS enabled and policies ✅ Added via migration
- [x] Verify `owner_intents` has RLS enabled and policies
- [ ] Verify `case_notes` has RLS enabled and policies (linked via case_id, no direct org_id)
- [x] Verify `documents` has RLS enabled and policies
- [x] Create missing RLS policies as needed ✅ 15 tables migrated

### 1.3 Create Staff Views
- [x] Create `staff_work_queue_org_lookup` view (already existed)
- [x] Create `staff_concierge_cases_list` view
- [x] Grant SELECT on staff views to `hestami_app`
- [x] Test views return expected data

---

## Phase 2: Prisma Configuration

### 2.1 Update Schema
- [x] Update `prisma.config.ts` for Prisma 7 (directUrl removed in v7, using conditional URL)
- [x] Verify schema compiles with `npx prisma validate`

### 2.2 Update Environment Variables
- [x] Add `DIRECT_DATABASE_URL` to `.env` (admin user for migrations)
- [x] Update `DATABASE_URL` to use `hestami_app` user
- [ ] Update `.env.example` with new variable structure
- [ ] Update Docker compose files if needed
- [ ] Update CI/CD environment configurations

### 2.3 Test Migration Path
- [x] Run `npx prisma migrate dev` with new configuration ✅ Migration created
- [x] Apply migration with `npx prisma migrate deploy` ✅ Applied successfully
- [x] Regenerate Prisma client with `npx prisma generate` ✅ Client regenerated
- [ ] Verify migrations use admin user (DIRECT_DATABASE_URL)
- [ ] Verify runtime queries use app user (DATABASE_URL)

---

## Phase 3: Middleware Implementation

### 3.1 Update orgProcedure
- [x] Import `setOrgContext` and `clearOrgContext` in `router.ts`
- [x] Add RLS context setting at start of orgProcedure middleware
- [x] Add RLS context clearing in finally block
- [ ] Test basic CRUD operations still work

### 3.2 Staff Cross-Org Access (Pattern B)
- [x] Update `conciergeCase.ts` get handler with `setOrgContextForWorkItem`
- [x] Update `conciergeCase.ts` getDetail handler with `setOrgContextForWorkItem`
- [x] Add proper context clearing in finally blocks
- [ ] Test staff can view cases from other orgs

### 3.3 Staff Listing (Pattern C)
- [x] Update `conciergeCase.ts` list handler to use staff view
- [x] Add conditional logic for `hasCrossOrgAccess`
- [ ] Test staff can list cases across all orgs
- [ ] Test regular users only see their org's cases

---

## Phase 4: DBOS Workflow Updates

### 4.1 caseLifecycleWorkflow.ts
- [x] Update `createCase` to use `orgTransaction` + `clearOrgContext`
- [x] Update `convertIntentToCase` to use `orgTransaction` + `clearOrgContext`
- [x] Update `transitionStatus` to use `orgTransaction` + `clearOrgContext`
- [x] Update `assignConcierge` to use `orgTransaction` + `clearOrgContext`
- [x] Update `resolveCase` to use `orgTransaction` + `clearOrgContext`
- [x] Update `closeCase` to use `orgTransaction` + `clearOrgContext`
- [x] Update `cancelCase` to use `orgTransaction` + `clearOrgContext`

### 4.2 arcRequestWorkflow.ts
- [ ] Update `createRequest` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `updateRequest` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `submitRequest` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `withdrawRequest` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `addDocument` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `recordDecision` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `requestInfo` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `submitInfo` to use `orgTransaction` + `clearOrgContext`

### 4.3 arcReviewWorkflow.ts
- [ ] Update `addMember` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `removeMember` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `assignCommittee` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `submitReview` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `recordDecision` to use `orgTransaction` + `clearOrgContext`

### 4.4 arcReviewLifecycle.ts
- [ ] Update `validateTransition` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `updateARCRequestStatus` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `checkApprovalExpiration` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `queueNotifications` to use `orgTransaction` + `clearOrgContext`

### 4.5 appealWorkflow.ts
- [ ] Update `fileAppeal` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `scheduleHearing` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `recordDecision` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `withdrawAppeal` to use `orgTransaction` + `clearOrgContext`

### 4.6 assessmentPosting.ts
- [ ] Update `getAssessmentType` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `getUnitsForCharging` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `createAssessmentCharges` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `applyLateFees` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `queueDelinquencyNotifications` to use `orgTransaction` + `clearOrgContext`

### 4.7 billingWorkflow.ts
- [ ] Update `createProposal` to use `orgTransaction` + `clearOrgContext`
- [ ] Update `updateProposalStatus` to use `orgTransaction` + `clearOrgContext`
- [ ] Update remaining step functions

### 4.8 violationWorkflow.ts
- [ ] Identify all step functions
- [ ] Update each to use `orgTransaction` + `clearOrgContext`

### 4.9 workOrderWorkflow.ts
- [ ] Identify all step functions
- [ ] Update each to use `orgTransaction` + `clearOrgContext`

---

## Phase 5: Verification & Testing

### 5.1 Manual Verification
- [ ] Connect as `hestami_app` user
- [ ] Verify queries without context return empty
- [ ] Verify queries with context return correct org data
- [ ] Verify staff cross-org access works
- [ ] Verify context clearing works

### 5.2 Integration Testing
- [ ] Test case creation in Org A
- [ ] Verify Org B user cannot see Org A's case
- [ ] Verify staff user CAN see Org A's case
- [ ] Test workflow operations with RLS
- [ ] Verify audit trail for staff cross-org access

### 5.3 Regression Testing
- [ ] Run existing test suite
- [ ] Verify no broken functionality
- [ ] Test all CRUD operations for major entities

---

## Phase 6: Deployment

### 6.1 Staging Deployment
- [ ] Deploy database changes to staging
- [ ] Deploy application changes to staging
- [ ] Run verification tests on staging
- [ ] Monitor for errors

### 6.2 Production Deployment
- [ ] Schedule maintenance window
- [ ] Create database backup
- [ ] Deploy database changes
- [ ] Deploy application changes
- [ ] Run smoke tests
- [ ] Monitor for errors

### 6.3 Post-Deployment
- [ ] Verify RLS is enforced in production
- [ ] Monitor application logs for RLS-related errors
- [ ] Document any issues encountered

---

## Rollback Plan

If issues are encountered:

1. [ ] Switch `DATABASE_URL` back to `hestami` user (BYPASSRLS)
2. [ ] Restart application
3. [ ] Investigate and fix issues
4. [ ] Re-attempt deployment

---

## Notes & Issues

_Use this section to track any issues, blockers, or notes during implementation._

| Date | Issue | Resolution |
|------|-------|------------|
| 2024-12-28 | Prisma 7 removed `directUrl` from schema | Updated `prisma.config.ts` to use conditional URL based on `DIRECT_DATABASE_URL` |
| 2024-12-28 | `properties` table has no direct `organization_id` | ✅ RESOLVED: Added `organizationId` via migration `20251228064220_add_organization_id_for_rls` |
| 2024-12-28 | `case_notes` table has no direct `organization_id` | Linked via `case_id` to `concierge_cases` - protected by parent RLS |
| 2024-12-28 | 15 tables needed direct `organizationId` for RLS | ✅ RESOLVED: Full migration created with backfill and RLS policies |

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Database Setup | 2-3 hours |
| Phase 2: Prisma Configuration | 1-2 hours |
| Phase 3: Middleware Implementation | 3-4 hours |
| Phase 4: DBOS Workflow Updates | 6-8 hours |
| Phase 5: Verification & Testing | 4-6 hours |
| Phase 6: Deployment | 2-3 hours |
| **Total** | **~2-3 days** |
