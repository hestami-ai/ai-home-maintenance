# Prisma Migration Drift Resolution Procedures

This document outlines procedures for handling schema drift between Prisma migrations and the production database.

## Understanding Schema Drift

**Schema drift** occurs when the database schema differs from what the migration history expects. Common causes:

1. **`prisma db push` used instead of `prisma migrate dev`** - Applies schema changes directly without creating migration files
2. **Manual SQL changes** - Direct database modifications outside of Prisma
3. **Failed/partial migrations** - Migrations that partially applied before failing
4. **Multiple environments diverging** - Dev/staging/prod databases getting out of sync

## Diagnosing Drift

### Step 1: Check Migration Status

```bash
npx prisma migrate status
```

This shows:
- Which migrations have been applied
- If there's drift between migrations and database
- Any failed migrations

### Step 2: Generate Drift Report

```bash
# Compare migrations to actual database
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datasource ./prisma/schema.prisma \
  --script
```

This outputs SQL that would bring the database in sync with migrations.

### Step 3: Compare Schema to Database

```bash
# See what schema.prisma expects vs what DB has
npx prisma migrate diff \
  --from-schema-datasource ./prisma/schema.prisma \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script
```

---

## Resolution Procedures

### Scenario A: Database Has Extra Objects (Tables/Columns/Enums)

The database has objects that aren't in the migration history but ARE in schema.prisma.

**Cause:** `prisma db push` was used, or manual SQL was run.

**Resolution - Create Catch-Up Migration:**

```bash
# 1. Generate migration SQL from current migrations to current schema
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script > catch_up.sql

# 2. Review the SQL carefully
cat catch_up.sql

# 3. Create a new migration directory
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_catch_up_schema

# 4. Move the SQL file
mv catch_up.sql prisma/migrations/$(date +%Y%m%d%H%M%S)_catch_up_schema/migration.sql

# 5. Mark it as already applied (since DB already has these changes)
npx prisma migrate resolve --applied "YYYYMMDDHHMMSS_catch_up_schema"
```

### Scenario B: Database Missing Objects

The database is missing objects that migrations expect.

**Cause:** Migrations weren't run, or were rolled back.

**Resolution - Apply Missing Migrations:**

```bash
# For production, use deploy (doesn't prompt, doesn't reset)
npx prisma migrate deploy
```

If a specific migration fails:

```bash
# 1. Check which migration failed
npx prisma migrate status

# 2. Manually fix the database issue

# 3. Mark the migration as applied if you fixed it manually
npx prisma migrate resolve --applied "MIGRATION_NAME"

# Or mark it as rolled back if you want to skip it
npx prisma migrate resolve --rolled-back "MIGRATION_NAME"
```

### Scenario C: Enum Value Missing (Like PHOTO/VIDEO)

A specific enum value exists in schema.prisma but not in the database.

**Resolution - Add Enum Value Directly:**

```sql
-- Connect to database and run:
ALTER TYPE "EnumName" ADD VALUE IF NOT EXISTS 'NEW_VALUE';
```

Then create a migration to track this:

```bash
# Create empty migration
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_enum_value

# Create migration.sql with the ALTER statement
echo 'ALTER TYPE "EnumName" ADD VALUE IF NOT EXISTS '"'"'NEW_VALUE'"'"';' > \
  prisma/migrations/$(date +%Y%m%d%H%M%S)_add_enum_value/migration.sql

# Mark as applied
npx prisma migrate resolve --applied "YYYYMMDDHHMMSS_add_enum_value"
```

### Scenario D: Complete Reset (Development Only)

**WARNING: This deletes all data. Never use in production.**

```bash
npx prisma migrate reset
```

### Scenario E: Baseline from Current Database (Fresh Start)

When drift is too complex to reconcile, create a new baseline:

```bash
# 1. Backup the database first!
pg_dump -U username -d database > backup_$(date +%Y%m%d).sql

# 2. Introspect current database to update schema.prisma
npx prisma db pull

# 3. Delete old migrations (keep backups!)
mv prisma/migrations prisma/migrations_backup_$(date +%Y%m%d)
mkdir prisma/migrations

# 4. Create baseline migration from current schema
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script > prisma/migrations/0_baseline/migration.sql

mkdir -p prisma/migrations/0_baseline
mv prisma/migrations/0_baseline/migration.sql prisma/migrations/0_baseline/

# 5. Mark baseline as applied
npx prisma migrate resolve --applied "0_baseline"
```

---

## Production Deployment Checklist

### Before Deploying Schema Changes

1. **Always create migrations in development first:**
   ```bash
   npx prisma migrate dev --name descriptive_name
   ```

2. **Test migrations on staging** with production-like data

3. **Backup production database** before applying migrations

4. **Use `migrate deploy` in production** (not `migrate dev`):
   ```bash
   npx prisma migrate deploy
   ```

### If Migration Fails in Production

1. **Don't panic** - Check the error message

2. **Check migration status:**
   ```bash
   npx prisma migrate status
   ```

3. **If partially applied**, you may need to:
   - Manually complete the migration
   - Or manually roll back the partial changes
   - Then use `migrate resolve`

4. **Document what happened** for post-mortem

---

## Prevention Best Practices

1. **Never use `prisma db push` in production** - It doesn't create migrations

2. **Always use `prisma migrate dev`** in development to create migration files

3. **Review migration SQL** before applying to production

4. **Keep environments in sync** - Same migrations should apply to dev/staging/prod

5. **Use CI/CD** to automatically run `prisma migrate deploy` on deployment

6. **Regular drift checks** - Run `prisma migrate status` periodically

---

## Quick Reference Commands

| Command | Purpose | Safe for Production? |
|---------|---------|---------------------|
| `prisma migrate status` | Check migration state | ✅ Yes (read-only) |
| `prisma migrate deploy` | Apply pending migrations | ✅ Yes |
| `prisma migrate dev` | Create + apply migrations | ❌ No (dev only) |
| `prisma migrate reset` | Drop DB + reapply all | ❌ No (destroys data) |
| `prisma migrate resolve` | Mark migration status | ⚠️ Careful |
| `prisma migrate diff` | Compare schemas | ✅ Yes (read-only) |
| `prisma db push` | Sync DB to schema | ❌ No (no migrations) |
| `prisma db pull` | Sync schema to DB | ⚠️ Careful (overwrites schema) |

---

## Example: Resolving Current Drift

Based on the drift detected (staff, case_milestones, vendor_candidates tables, etc.):

```bash
# 1. Generate the catch-up migration
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script > prisma/migrations/20251221000000_sync_schema_drift/migration.sql

# 2. Create the migration directory
mkdir -p prisma/migrations/20251221000000_sync_schema_drift

# 3. Mark as applied (since DB already has these objects)
npx prisma migrate resolve --applied "20251221000000_sync_schema_drift"

# 4. Verify
npx prisma migrate status
```
