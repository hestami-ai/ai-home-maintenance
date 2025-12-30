# Phase 20: TIMESTAMPTZ Migration Roadmap

**Status**: 🔴 Not Started  
**Priority**: High  
**Target**: Before Production Launch  
**Estimated Duration**: 1 week  

---

## Overview

Migrate all `TIMESTAMP(3)` columns to `TIMESTAMPTZ(3)` for proper multi-timezone support across HOAs, property owners, vendors, and staff.

**Reference**: See `TIMESTAMPTZ Migration Plan.md` for detailed technical guidance.

---

## Progress Tracker

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Preparation | 🔴 Not Started | 0/6 |
| Phase 2: Schema Migration | 🔴 Not Started | 0/5 |
| Phase 3: Function Updates | 🔴 Not Started | 0/4 |
| Phase 4: Application Updates | 🔴 Not Started | 0/3 |
| Phase 5: Testing & Validation | 🔴 Not Started | 0/6 |
| Phase 6: Deployment | 🔴 Not Started | 0/5 |

**Overall Progress**: 0/29 tasks completed

---

## Phase 1: Preparation

**Status**: 🔴 Not Started

### Checklist

- [ ] **1.1** Audit DateTime fields in Prisma schema
  - Run: `grep -c "DateTime" prisma/schema.prisma`
  - Document count: _____ fields

- [ ] **1.2** Document current server timezone
  - Run: `docker exec hestami-postgres psql -U hestami -d hestami -c "SHOW timezone;"`
  - Current timezone: _____

- [ ] **1.3** Create full database backup
  - Run: `pg_dump -U hestami -d hestami -F c -f backup_pre_timestamptz_$(date +%Y%m%d).dump`
  - Backup location: _____
  - Backup verified: [ ] Yes

- [ ] **1.4** Schedule maintenance window
  - Date/Time: _____
  - Duration: _____ hours
  - Stakeholders notified: [ ] Yes

- [ ] **1.5** Test migration on staging environment
  - Staging backup restored: [ ] Yes
  - Migration tested: [ ] Yes
  - Issues found: _____

- [ ] **1.6** Prepare rollback scripts
  - Rollback script created: [ ] Yes
  - Rollback tested on staging: [ ] Yes

---

## Phase 2: Schema Migration

**Status**: 🔴 Not Started

### Checklist

- [ ] **2.1** Update Prisma schema with `@db.Timestamptz(3)`
  - Files modified:
    - [ ] `prisma/schema.prisma` - All DateTime fields updated
  - Total fields updated: _____

- [ ] **2.2** Generate migration SQL script
  - Script location: `prisma/migrations/YYYYMMDD_timestamptz_migration/migration.sql`
  - Tables affected: _____

- [ ] **2.3** Review generated migration
  - [ ] All timestamp columns included
  - [ ] AT TIME ZONE clause correct
  - [ ] No data loss expected

- [ ] **2.4** Run Prisma generate
  - Command: `npx prisma generate`
  - [ ] Completed without errors

- [ ] **2.5** Verify TypeScript types
  - Command: `npm run check`
  - [ ] 0 errors, 0 warnings

---

## Phase 3: Function Updates

**Status**: 🔴 Not Started

### SECURITY DEFINER Functions to Update

- [ ] **3.1** `get_user_memberships(TEXT)`
  - Location: `prisma/migrations/20251230022800_user_memberships_function/migration.sql`
  - Fields to update:
    - [ ] `created_at` → `TIMESTAMPTZ(3)`
    - [ ] `updated_at` → `TIMESTAMPTZ(3)`

- [ ] **3.2** `get_staff_profile(TEXT)`
  - Location: `prisma/migrations/20251230022800_user_memberships_function/migration.sql`
  - Fields to update:
    - [ ] `activated_at` → `TIMESTAMPTZ(3)`
    - [ ] `suspended_at` → `TIMESTAMPTZ(3)`
    - [ ] `deactivated_at` → `TIMESTAMPTZ(3)`
    - [ ] `created_at` → `TIMESTAMPTZ(3)`
    - [ ] `updated_at` → `TIMESTAMPTZ(3)`

- [ ] **3.3** `get_staff_work_queue()`
  - Location: `prisma/migrations/20251228182900_staff_work_queue_functions/migration.sql`
  - Fields to update:
    - [ ] `created_at` → `TIMESTAMPTZ(3)`
    - [ ] `updated_at` → `TIMESTAMPTZ(3)`

- [ ] **3.4** Other SECURITY DEFINER functions
  - [ ] Audit for additional functions: `SELECT proname FROM pg_proc WHERE prosecdef = true;`
  - Functions found: _____

---

## Phase 4: Application Updates

**Status**: 🔴 Not Started

### Checklist

- [ ] **4.1** Update TypeScript interfaces (if needed)
  - [ ] Review `MembershipRow` interface in `+layout.server.ts`
  - [ ] Review `StaffRow` interface in `+layout.server.ts`
  - [ ] Review other raw query interfaces

- [ ] **4.2** Add timezone-aware formatting to frontend
  - [ ] Create `formatDateTime` utility function
  - [ ] Update date display components
  - [ ] Test with different user timezones

- [ ] **4.3** Update API response formatting (if needed)
  - [ ] Verify `toISOString()` usage (already UTC-aware)
  - [ ] Check for any manual date formatting

---

## Phase 5: Testing & Validation

**Status**: 🔴 Not Started

### Checklist

- [ ] **5.1** Unit tests
  - [ ] Timestamp storage tests
  - [ ] Timestamp retrieval tests
  - [ ] Timezone conversion tests

- [ ] **5.2** Integration tests
  - [ ] Create record in EST, view in PST
  - [ ] Activity timeline ordering
  - [ ] SLA deadline calculations

- [ ] **5.3** Manual testing - Staff scenarios
  - [ ] Staff in EST views work queue
  - [ ] Staff in PST views same work queue
  - [ ] Timestamps match expected local times

- [ ] **5.4** Manual testing - User scenarios
  - [ ] Property owner creates case (EST)
  - [ ] Vendor views case (PST)
  - [ ] Timestamps display correctly for each

- [ ] **5.5** Audit log verification
  - [ ] Activity events show correct times
  - [ ] Historical data displays correctly
  - [ ] No timezone drift in comparisons

- [ ] **5.6** Performance verification
  - [ ] Query performance unchanged
  - [ ] Index usage verified
  - [ ] No regression in page load times

---

## Phase 6: Deployment

**Status**: 🔴 Not Started

### Pre-Deployment Checklist

- [ ] **6.1** Final backup before deployment
  - Backup created: [ ] Yes
  - Backup verified: [ ] Yes

- [ ] **6.2** Stop application servers
  - Command: `docker compose down app`
  - Servers stopped: [ ] Yes

### Deployment Checklist

- [ ] **6.3** Execute database migration
  - Migration started: _____
  - Migration completed: _____
  - Duration: _____ minutes
  - Errors: _____

- [ ] **6.4** Deploy updated application
  - Command: `docker compose up -d --build app`
  - Application started: [ ] Yes
  - Health check passed: [ ] Yes

### Post-Deployment Checklist

- [ ] **6.5** Verify deployment
  - [ ] Login works
  - [ ] Work queue loads
  - [ ] Activity logs display
  - [ ] Timestamps show correctly
  - [ ] No console errors

---

## Rollback Procedure

If issues occur during or after deployment:

1. [ ] Stop application: `docker compose down app`
2. [ ] Restore database backup:
   ```bash
   pg_restore -U hestami -d hestami -c backup_pre_timestamptz_YYYYMMDD.dump
   ```
3. [ ] Revert code: `git checkout <previous-commit>`
4. [ ] Regenerate Prisma: `npx prisma generate`
5. [ ] Redeploy: `docker compose up -d --build app`
6. [ ] Verify rollback successful

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA | | | |
| DevOps | | | |
| Product Owner | | | |

---

## Notes & Issues Log

| Date | Issue | Resolution | Status |
|------|-------|------------|--------|
| | | | |

---

## Completion

- [ ] All phases completed
- [ ] All tests passed
- [ ] Documentation updated
- [ ] Team notified
- [ ] Migration marked complete

**Completed Date**: _____  
**Completed By**: _____
