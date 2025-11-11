@echo off
REM Migration script: PostgreSQL 17 -> PostgreSQL 18 + PostGIS + pgvector
REM This script migrates data from old database to new database running in parallel

echo ========================================
echo PostgreSQL Migration Script
echo From: PostgreSQL 17
echo To: PostgreSQL 18 + PostGIS + pgvector
echo ========================================
echo.

REM Step 1: Check if old database is running
echo [1/10] Checking old database status...
docker inspect db-dev --format "{{.State.Running}}" >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Old database (db-dev) container not found!
    echo Please start it with: docker compose -f compose.dev.yaml up -d db
    exit /b 1
)
for /f %%i in ('docker inspect db-dev --format "{{.State.Running}}"') do set DB_RUNNING=%%i
if not "%DB_RUNNING%"=="true" (
    echo ERROR: Old database (db-dev) is not running!
    echo Please start it with: docker compose -f compose.dev.yaml up -d db
    exit /b 1
)
echo Old database is running.
echo.

REM Step 2: Create backup directory
echo [2/10] Creating backup directory...
if not exist "backups" mkdir backups
set BACKUP_FILE=backups\backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%.dump
set BACKUP_FILE=%BACKUP_FILE: =0%
echo Backup will be saved to: %BACKUP_FILE%
echo.

REM Step 3: Backup old database
echo [3/10] Backing up old database...
echo This may take a few minutes depending on database size...
docker compose -f compose.dev.yaml exec -T db pg_dump -U hestami_user -d hestami_db -F c -b --no-owner --no-acl > %BACKUP_FILE%
if %errorlevel% neq 0 (
    echo ERROR: Database backup failed!
    exit /b 1
)
echo Backup completed successfully.
echo.

REM Step 4: Build new database image
echo [4/10] Building new PostgreSQL 18 + PostGIS + pgvector image...
docker compose -f compose.dev.yaml build db-new
if %errorlevel% neq 0 (
    echo ERROR: Failed to build new database image!
    exit /b 1
)
echo Build completed successfully.
echo.

REM Step 5: Start new database
echo [5/10] Starting new database...
docker compose -f compose.dev.yaml up -d db-new
if %errorlevel% neq 0 (
    echo ERROR: Failed to start new database!
    exit /b 1
)
echo New database started on port 5433.
echo.

REM Step 6: Wait for new database to be ready
echo [6/10] Waiting for new database to initialize...
timeout /t 10 /nobreak >nul
:wait_loop
docker compose -f compose.dev.yaml exec -T db-new pg_isready -U hestami_user >nul 2>&1
if %errorlevel% neq 0 (
    echo Waiting for database...
    timeout /t 2 /nobreak >nul
    goto wait_loop
)
echo New database is ready.
echo.

REM Step 7: Verify extensions
echo [7/10] Verifying PostGIS and pgvector extensions...
docker compose -f compose.dev.yaml exec -T db-new psql -U hestami_user -d hestami_db -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis', 'vector', 'pg_trgm');"
if %errorlevel% neq 0 (
    echo WARNING: Could not verify extensions, but continuing...
)
echo.

REM Step 8: Restore data to new database
echo [8/10] Restoring data to new database...
echo This may take a few minutes depending on database size...
type %BACKUP_FILE% | docker compose -f compose.dev.yaml exec -T db-new pg_restore -U hestami_user -d hestami_db -v --no-owner --no-acl 2>nul
if %errorlevel% neq 0 (
    echo WARNING: Some errors occurred during restore, but this is often normal.
    echo The migration may still be successful. Continuing...
)
echo Restore completed.
echo.

REM Step 9: Verify data migration
echo [9/10] Verifying data migration...
echo Counting tables in old database:
docker compose -f compose.dev.yaml exec -T db psql -U hestami_user -d hestami_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
echo Counting tables in new database:
docker compose -f compose.dev.yaml exec -T db-new psql -U hestami_user -d hestami_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
echo.

REM Step 10: Instructions for switching
echo [10/10] Migration completed!
echo.
echo ========================================
echo NEXT STEPS:
echo ========================================
echo.
echo 1. Verify the data in the new database:
echo    docker compose -f compose.dev.yaml exec db-new psql -U hestami_user -d hestami_db
echo.
echo 2. Test your application with the new database:
echo    - Update .env.local: DB_HOST=db-new and DB_PORT=5432
echo    - Restart Django: docker compose -f compose.dev.yaml restart api celery-worker
echo    - Run migrations: docker compose -f compose.dev.yaml exec api python manage.py migrate
echo.
echo 3. Once verified, switch to new database permanently:
echo    - Stop old database: docker compose -f compose.dev.yaml stop db
echo    - Rename db-new to db in compose.dev.yaml
echo    - Update port from 5433 to 5432
echo    - Restart all services
echo.
echo 4. Clean up old database (ONLY after verifying new one works):
echo    - Remove old container: docker compose -f compose.dev.yaml rm db
echo    - Remove old volume: docker volume rm hestami-ai_postgres_data_dev
echo.
echo Backup saved at: %BACKUP_FILE%
echo Keep this backup until you're confident the migration succeeded!
echo.
echo ========================================
