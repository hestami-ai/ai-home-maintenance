# TIMESTAMPTZ Migration Plan

## Overview

This document outlines the plan to migrate from `TIMESTAMP(3)` (timestamp without time zone) to `TIMESTAMPTZ(3)` (timestamp with time zone) across the Hestami AI platform.

## Why TIMESTAMPTZ?

The Hestami platform serves HOAs, property owners, vendors, and staff across multiple timezones. Using `TIMESTAMPTZ` ensures:

1. **Correct time comparisons** - All timestamps stored in UTC, compared correctly
2. **Automatic timezone conversion** - PostgreSQL handles conversion based on session timezone
3. **DST handling** - Daylight Saving Time transitions handled automatically
4. **Audit accuracy** - "When did this happen?" is unambiguous

### Current State: `TIMESTAMP(3)`
- Stores exactly what is provided (no timezone awareness)
- If server is in UTC and user submits "10:00 AM EST", it stores "10:00" (wrong!)
- Cross-timezone queries can return incorrect results

### Target State: `TIMESTAMPTZ(3)`
- Converts input to UTC for storage
- Converts output to session/client timezone
- All comparisons work correctly regardless of user timezone

---

## Migration Phases

### Phase 1: Preparation (Pre-Migration)

#### 1.1 Audit Current Schema
Count all `DateTime` fields in `prisma/schema.prisma`:
```bash
grep -c "DateTime" prisma/schema.prisma
```

Expected: 200+ DateTime fields across all models.

#### 1.2 Identify Critical Timestamp Fields
Priority fields that MUST be timezone-aware:
- **Scheduling**: `scheduledAt`, `dueDate`, `appointmentTime`
- **SLA/Deadlines**: `slaDeadline`, `responseDeadline`
- **User-facing events**: `meetingTime`, `inspectionDate`
- **Audit trail**: `createdAt`, `updatedAt`, `performedAt`

#### 1.3 Document Server Timezone
```sql
SHOW timezone;
```
Record current PostgreSQL server timezone. Existing `TIMESTAMP` values will be interpreted as this timezone during migration.

#### 1.4 Backup Database
```bash
pg_dump -U hestami -d hestami -F c -f backup_pre_timestamptz.dump
```

---

### Phase 2: Schema Migration

#### 2.1 Update Prisma Schema
Add `@db.Timestamptz(3)` to all `DateTime` fields:

**Before:**
```prisma
model Organization {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
}
```

**After:**
```prisma
model Organization {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)
}
```

#### 2.2 Create Migration Script
Since this affects all tables, create a comprehensive migration:

```sql
-- Migration: Convert all TIMESTAMP(3) columns to TIMESTAMPTZ(3)
-- IMPORTANT: Run this during a maintenance window

-- Set the timezone for interpretation of existing values
SET timezone = 'UTC';  -- Or your server's current timezone

-- Example for one table (repeat for all tables):
ALTER TABLE organizations 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
```

#### 2.3 Generate Full Migration
Create a script to generate ALTER statements for all tables:

```sql
-- Generate ALTER statements for all timestamp columns
SELECT 
  'ALTER TABLE ' || table_name || 
  ' ALTER COLUMN ' || column_name || 
  ' TYPE TIMESTAMPTZ(3) USING ' || column_name || ' AT TIME ZONE ''UTC'';'
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type = 'timestamp without time zone'
ORDER BY table_name, column_name;
```

---

### Phase 3: Update SECURITY DEFINER Functions

All SECURITY DEFINER functions must be updated to return `TIMESTAMPTZ(3)`:

#### 3.1 `get_user_memberships`
```sql
CREATE OR REPLACE FUNCTION get_user_memberships(p_user_id TEXT)
RETURNS TABLE (
  id TEXT,
  user_id TEXT,
  organization_id TEXT,
  role TEXT,
  is_default BOOLEAN,
  created_at TIMESTAMPTZ(3),  -- Changed from TIMESTAMP(3)
  updated_at TIMESTAMPTZ(3),  -- Changed from TIMESTAMP(3)
  org_id TEXT,
  org_name TEXT,
  org_slug TEXT,
  org_type TEXT,
  org_status TEXT
)
-- ... rest of function
```

#### 3.2 `get_staff_profile`
```sql
CREATE OR REPLACE FUNCTION get_staff_profile(p_user_id TEXT)
RETURNS TABLE (
  -- ... other fields
  activated_at TIMESTAMPTZ(3),   -- Changed
  suspended_at TIMESTAMPTZ(3),   -- Changed
  deactivated_at TIMESTAMPTZ(3), -- Changed
  created_at TIMESTAMPTZ(3),     -- Changed
  updated_at TIMESTAMPTZ(3)      -- Changed
)
-- ... rest of function
```

#### 3.3 `get_staff_work_queue`
```sql
-- Update return types for created_at, updated_at
```

---

### Phase 4: Application Code Updates

#### 4.1 TypeScript Interface Updates
No changes needed - TypeScript `Date` objects handle both.

#### 4.2 API Response Formatting
Ensure all API responses use ISO 8601 format with timezone:
```typescript
// Already correct - toISOString() returns UTC with 'Z' suffix
createdAt: entity.createdAt.toISOString()  // "2025-01-15T15:00:00.000Z"
```

#### 4.3 Frontend Display
Add timezone-aware formatting in UI components:
```typescript
// Use Intl.DateTimeFormat for user's local timezone
const formatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: userTimezone  // e.g., 'America/New_York'
});
formatter.format(new Date(isoString));
```

---

### Phase 5: Testing

#### 5.1 Unit Tests
- Test timestamp storage and retrieval across timezones
- Test SLA calculations with timezone-aware deadlines
- Test scheduling features

#### 5.2 Integration Tests
- Create records in one timezone, verify in another
- Test activity timeline ordering
- Test notification scheduling

#### 5.3 Manual Testing
- Staff in different timezones view same records
- Verify audit logs show correct times
- Test appointment scheduling across timezones

---

## Migration Execution Checklist

### Pre-Migration
- [ ] Full database backup completed
- [ ] Server timezone documented
- [ ] Maintenance window scheduled
- [ ] Rollback plan prepared
- [ ] All stakeholders notified

### Migration
- [ ] Stop application servers
- [ ] Run Prisma schema update
- [ ] Run database migration
- [ ] Update SECURITY DEFINER functions
- [ ] Regenerate Prisma client
- [ ] Run `npm run check`
- [ ] Deploy updated application
- [ ] Verify basic functionality

### Post-Migration
- [ ] Verify timestamps display correctly
- [ ] Check activity logs
- [ ] Test cross-timezone scenarios
- [ ] Monitor for errors
- [ ] Update documentation

---

## Rollback Plan

If issues occur:

1. **Stop application servers**
2. **Restore database from backup**
   ```bash
   pg_restore -U hestami -d hestami -c backup_pre_timestamptz.dump
   ```
3. **Revert Prisma schema** (git checkout)
4. **Regenerate Prisma client**
5. **Redeploy previous version**

---

## Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Phase 1: Preparation | 1-2 days | Audit, backup, planning |
| Phase 2: Schema Migration | 2-4 hours | During maintenance window |
| Phase 3: Function Updates | 1-2 hours | Part of migration window |
| Phase 4: Code Updates | 1 day | Frontend formatting |
| Phase 5: Testing | 2-3 days | Comprehensive testing |

**Total: ~1 week** (including buffer)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data corruption during migration | High | Full backup, test on staging first |
| Existing timestamps misinterpreted | Medium | Document server timezone, use explicit `AT TIME ZONE` |
| Application errors post-migration | Medium | Comprehensive testing, staged rollout |
| Performance impact | Low | TIMESTAMPTZ has minimal overhead |

---

## References

- [PostgreSQL TIMESTAMPTZ Documentation](https://www.postgresql.org/docs/current/datatype-datetime.html)
- [Prisma DateTime with PostgreSQL](https://www.prisma.io/docs/orm/reference/prisma-schema-reference#datetime)
- [Don't Use TIMESTAMP Without Time Zone](https://wiki.postgresql.org/wiki/Don't_Do_This#Don.27t_use_timestamp_.28without_time_zone.29)

---

## Status

**Current Status**: Planning  
**Target Execution**: Before production launch  
**Priority**: High (affects multi-timezone correctness)
