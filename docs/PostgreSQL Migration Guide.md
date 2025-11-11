# PostgreSQL Migration Guide
## From PostgreSQL 17 → PostgreSQL 18 + PostGIS + pgvector

**Date**: November 5, 2025  
**Purpose**: Add geospatial (PostGIS) and vector embedding (pgvector) capabilities

---

## Overview

This migration adds two critical capabilities to the database:

1. **PostGIS 3.6** - Geospatial queries for "find providers within N miles" use cases
2. **pgvector 0.8.1** - Vector embeddings for semantic search

### Architecture

- **Old Database**: `db` (PostgreSQL 17) on port 5432
- **New Database**: `db-new` (PostgreSQL 18 + PostGIS + pgvector) on port 5433
- **Strategy**: Run both in parallel, migrate data, test, then switch

---

## Pre-Migration Checklist

- [ ] Backup current database
- [ ] Verify disk space (need ~2x current database size)
- [ ] Stop any running data ingestion workflows
- [ ] Note current record counts for verification

---

## Migration Steps

### 1. Start New Database

```bash
# Build and start new database (runs on port 5433)
docker compose -f compose.dev.yaml build db-new
docker compose -f compose.dev.yaml up -d db-new

# Wait for initialization
timeout /t 15

# Verify extensions installed
docker compose -f compose.dev.yaml exec db-new psql -U hestami_user -d hestami_db -c "SELECT extname, extversion FROM pg_extension;"
```

**Expected output:**
```
     extname      | extversion
------------------+------------
 plpgsql          | 1.0
 postgis          | 3.6.0
 postgis_topology | 3.6.0
 vector           | 0.8.1
 pg_trgm          | 1.6
 btree_gin        | 1.3
 unaccent         | 1.1
```

### 2. Run Migration Script

```bash
# Automated migration
.\scripts\migrate-to-postgis.bat
```

This script will:
1. ✅ Check old database is running
2. ✅ Create timestamped backup
3. ✅ Build new database image
4. ✅ Start new database on port 5433
5. ✅ Wait for initialization
6. ✅ Verify extensions
7. ✅ Restore data to new database
8. ✅ Verify table counts
9. ✅ Provide next steps

### 3. Verify Migration

```bash
# Run verification script
.\scripts\verify-migration.bat
```

**Check:**
- Table counts match between old and new
- All extensions present
- PostGIS functions work
- pgvector functions work

### 4. Update Django Models

Add new fields to `ServiceProvider` model:

```python
from django.contrib.gis.db import models as gis_models
from pgvector.django import VectorField

class ServiceProvider(models.Model):
    # ... existing fields ...
    
    # NEW: Geospatial fields
    business_location = gis_models.PointField(
        geography=True, 
        null=True, 
        blank=True
    )
    address = models.TextField(blank=True, null=True)
    plus_code = models.CharField(max_length=20, blank=True, null=True)
    
    # NEW: Rich merged data
    merged_data = models.JSONField(default=dict)
    
    # NEW: Vector embeddings
    description_embedding = VectorField(
        dimensions=1536,
        null=True,
        blank=True
    )
```

### 5. Update Django Settings

```python
# settings.py
INSTALLED_APPS = [
    # ... existing apps ...
    'django.contrib.gis',      # Add this
    'pgvector.django',         # Add this
]

DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',  # Changed
        'NAME': os.getenv('DB_NAME', 'hestami_db'),
        'USER': os.getenv('DB_USER', 'hestami_user'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST', 'db-new'),  # Point to new database
        'PORT': os.getenv('DB_PORT', '5432'),    # Internal port
    }
}
```

### 6. Update Environment Variables

```bash
# .env.local
DB_HOST=db-new  # Changed from 'db'
DB_PORT=5432    # Internal port (external is 5433)
```

### 7. Install Python Dependencies

Update `requirements.txt`:
```txt
# Add these
gdal>=3.7.0
pgvector>=0.2.4
openai>=1.0.0
```

Update Django Dockerfile to install GDAL:
```dockerfile
FROM python:3.11-slim

# Install GDAL for PostGIS support
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

ENV GDAL_LIBRARY_PATH=/usr/lib/libgdal.so

# ... rest of Dockerfile
```

### 8. Rebuild and Test Django

```bash
# Rebuild Django container
docker compose -f compose.dev.yaml build api

# Restart services
docker compose -f compose.dev.yaml restart api celery-worker

# Run migrations (adds new fields)
docker compose -f compose.dev.yaml exec api python manage.py migrate

# Test PostGIS in Django shell
docker compose -f compose.dev.yaml exec api python manage.py shell
>>> from django.contrib.gis.geos import Point
>>> Point(-77.4311, 38.8951)
<Point object at 0x...>
```

### 9. Verify Application Works

- [ ] Django admin loads
- [ ] Can view ServiceProvider records
- [ ] Can create new records
- [ ] Workflows run successfully
- [ ] No database connection errors

### 10. Switch to New Database Permanently

Once verified, make the switch permanent:

```yaml
# compose.dev.yaml
# Option A: Rename db-new to db
db:
  build:
    context: ./docker/backend/postgres
    dockerfile: Dockerfile
  container_name: db-dev
  ports:
    - "5432:5432"  # Back to standard port
  volumes:
    - postgres_data_new_dev:/var/lib/postgresql

# Option B: Keep both, comment out old one
# db:  # OLD - commented out
#   image: postgres:17
#   ...

db-new:  # NEW - now primary
  ...
```

Update `.env.local`:
```bash
DB_HOST=db      # Back to 'db' if you renamed
DB_PORT=5432    # Back to standard port
```

Restart all services:
```bash
docker compose -f compose.dev.yaml down
docker compose -f compose.dev.yaml up -d
```

---

## Rollback Plan

If something goes wrong:

### Quick Rollback (keep both databases)

```bash
# 1. Update .env.local
DB_HOST=db      # Back to old database
DB_PORT=5432

# 2. Restart services
docker compose -f compose.dev.yaml restart api celery-worker

# 3. Verify old database works
docker compose -f compose.dev.yaml exec api python manage.py shell
>>> from services.models import ServiceProvider
>>> ServiceProvider.objects.count()
```

### Full Rollback (remove new database)

```bash
# 1. Stop new database
docker compose -f compose.dev.yaml stop db-new

# 2. Remove new database container and volume
docker compose -f compose.dev.yaml rm db-new
docker volume rm hestami-ai_postgres_data_new_dev

# 3. Revert code changes (git)
git checkout -- backend/django/hestami_ai_project/services/models/
git checkout -- backend/django/hestami_ai_project/settings.py

# 4. Rebuild and restart
docker compose -f compose.dev.yaml build api
docker compose -f compose.dev.yaml up -d
```

---

## Cleanup (After Successful Migration)

**ONLY do this after confirming new database works for at least 1 week!**

```bash
# 1. Stop old database
docker compose -f compose.dev.yaml stop db

# 2. Remove old database container
docker compose -f compose.dev.yaml rm db

# 3. Remove old database volume
docker volume rm hestami-ai_postgres_data_dev

# 4. Remove old database from compose.dev.yaml
# (Delete the 'db:' service definition)

# 5. Keep backup file for 30 days
# Location: backups/backup_YYYYMMDD_HHMMSS.dump
```

---

## Troubleshooting

### Issue: Extensions not installed

```bash
# Manually install extensions
docker compose -f compose.dev.yaml exec db-new psql -U hestami_user -d hestami_db

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
```

### Issue: GDAL not found in Django

```bash
# Rebuild Django container with GDAL
docker compose -f compose.dev.yaml build --no-cache api
docker compose -f compose.dev.yaml up -d api
```

### Issue: Migration script fails

```bash
# Manual migration
# 1. Backup
docker compose -f compose.dev.yaml exec db pg_dump -U hestami_user -d hestami_db -F c > backup.dump

# 2. Restore
cat backup.dump | docker compose -f compose.dev.yaml exec -T db-new pg_restore -U hestami_user -d hestami_db -v
```

### Issue: Data mismatch after migration

```bash
# Compare specific tables
docker compose -f compose.dev.yaml exec db psql -U hestami_user -d hestami_db -c "SELECT COUNT(*) FROM services_serviceprovider;"
docker compose -f compose.dev.yaml exec db-new psql -U hestami_user -d hestami_db -c "SELECT COUNT(*) FROM services_serviceprovider;"
```

---

## Next Steps After Migration

1. **Implement Geocoding** - Add workflow step to geocode provider addresses
2. **Implement Embeddings** - Add workflow step to generate vector embeddings
3. **Create QueryBuilder** - Implement flexible query interface
4. **Update Admin UI** - Add geospatial and semantic search filters
5. **Create API Endpoints** - Expose new search capabilities

See: `docs/ServiceProvider QueryBuilder Implementation.md`

---

## Files Changed

### Created
- `docker/backend/postgres/Dockerfile`
- `docker/backend/postgres/init-extensions.sql`
- `scripts/migrate-to-postgis.bat`
- `scripts/verify-migration.bat`
- `docs/PostgreSQL Migration Guide.md`

### Modified
- `compose.dev.yaml` - Added `db-new` service and volume
- `backend/django/hestami_ai_project/services/models/base_models.py` - Will add new fields
- `backend/django/hestami_ai_project/settings.py` - Will update database engine
- `requirements.txt` - Will add gdal, pgvector, openai

---

## Support

If you encounter issues:
1. Check logs: `docker compose -f compose.dev.yaml logs db-new`
2. Verify extensions: `SELECT * FROM pg_extension;`
3. Test PostGIS: `SELECT PostGIS_version();`
4. Test pgvector: `SELECT '[1,2,3]'::vector;`
5. Rollback if needed (see Rollback Plan above)

---

**Remember**: Keep the backup file until you're 100% confident the migration succeeded!
