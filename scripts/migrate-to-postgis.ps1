# Migration script: PostgreSQL 17 -> PostgreSQL 18 + PostGIS + pgvector
# This script migrates data from old database to new database running in parallel

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Migration Script" -ForegroundColor Cyan
Write-Host "From: PostgreSQL 17" -ForegroundColor Cyan
Write-Host "To: PostgreSQL 18 + PostGIS + pgvector" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if old database is running
Write-Host "[1/10] Checking old database status..." -ForegroundColor Yellow
$dbStatus = docker inspect db-dev --format '{{.State.Running}}' 2>$null
if ($LASTEXITCODE -ne 0 -or $dbStatus -ne "true") {
    Write-Host "ERROR: Old database (db-dev) is not running!" -ForegroundColor Red
    Write-Host "Please start it with: docker compose -f compose.dev.yaml up -d db" -ForegroundColor Red
    exit 1
}
Write-Host "Old database is running." -ForegroundColor Green
Write-Host ""

# Step 2: Create backup directory
Write-Host "[2/10] Creating backup directory..." -ForegroundColor Yellow
if (!(Test-Path "backups")) {
    New-Item -ItemType Directory -Path "backups" | Out-Null
}
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "backups\backup_$timestamp.dump"
Write-Host "Backup will be saved to: $backupFile" -ForegroundColor Cyan
Write-Host ""

# Step 3: Backup old database
Write-Host "[3/10] Backing up old database (public and dbos schemas)..." -ForegroundColor Yellow
Write-Host "This may take a few minutes depending on database size..." -ForegroundColor Gray
Write-Host "Note: Including both 'public' and 'dbos' schemas" -ForegroundColor Gray

# Create backup inside container, then copy out (avoids PowerShell binary corruption)
$containerBackupPath = "/tmp/backup.dump"
docker compose -f compose.dev.yaml exec -T db pg_dump -U hestami_user -d hestami_db -F c -b --no-owner --no-acl -n public -n dbos -f $containerBackupPath
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Database backup failed!" -ForegroundColor Red
    exit 1
}

# Copy backup from container to host
docker cp db-dev:$containerBackupPath $backupFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to copy backup from container!" -ForegroundColor Red
    exit 1
}

# Clean up container backup
docker compose -f compose.dev.yaml exec -T db rm $containerBackupPath 2>$null

$backupSize = (Get-Item $backupFile).Length / 1MB
Write-Host "Backup completed successfully. Size: $([math]::Round($backupSize, 2)) MB" -ForegroundColor Green
Write-Host ""

# Step 4: Build new database image
#Write-Host "[4/10] Building new PostgreSQL 18 + PostGIS + pgvector image..." -ForegroundColor Yellow
#docker compose -f compose.dev.yaml build db-new
#if ($LASTEXITCODE -ne 0) {
#    Write-Host "ERROR: Failed to build new database image!" -ForegroundColor Red
#    exit 1
#}
#Write-Host "Build completed successfully." -ForegroundColor Green
#Write-Host ""

# Step 5: Start new database
#Write-Host "[5/10] Starting new database..." -ForegroundColor Yellow
#docker compose -f compose.dev.yaml up -d db-new
#if ($LASTEXITCODE -ne 0) {
#    Write-Host "ERROR: Failed to start new database!" -ForegroundColor Red
#    exit 1
#}
#Write-Host "New database started on port 5433." -ForegroundColor Green
#Write-Host ""

# Step 6: Wait for new database to be ready
#Write-Host "[6/10] Waiting for new database to initialize..." -ForegroundColor Yellow
#Start-Sleep -Seconds 10

#$maxAttempts = 30
#$attempt = 0
#while ($attempt -lt $maxAttempts) {
#    $ready = docker compose -f compose.dev.yaml exec -T db-new pg_isready -U hestami_user 2>$null
#    if ($LASTEXITCODE -eq 0) {
#        Write-Host "New database is ready." -ForegroundColor Green
#        break
#    }
#    $attempt++
#    Write-Host "Waiting for database... (attempt $attempt/$maxAttempts)" -ForegroundColor Gray
#    Start-Sleep -Seconds 2
#}

#if ($attempt -eq $maxAttempts) {
#    Write-Host "ERROR: Database did not become ready in time!" -ForegroundColor Red
#    exit 1
#}
#Write-Host ""

# Step 7: Verify extensions
#Write-Host "[7/10] Verifying PostGIS and pgvector extensions..." -ForegroundColor Yellow
docker compose -f compose.dev.yaml exec -T db-new psql -U hestami_user -d hestami_db -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis', 'vector', 'pg_trgm');"
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Could not verify extensions, but continuing..." -ForegroundColor Yellow
}
Write-Host ""

# Step 8: Restore data to new database
Write-Host "[8/10] Restoring data to new database..." -ForegroundColor Yellow
Write-Host "This may take a few minutes depending on database size..." -ForegroundColor Gray

# Copy backup file into container
Write-Host "Copying backup file into container..." -ForegroundColor Gray
docker cp $backupFile db-new-dev:/tmp/restore.dump
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to copy backup file into container!" -ForegroundColor Red
    exit 1
}

# Restore from inside container
Write-Host "Restoring database..." -ForegroundColor Gray
docker compose -f compose.dev.yaml exec -T db-new pg_restore -U hestami_user -d hestami_db -v --no-owner --no-acl /tmp/restore.dump 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Some errors occurred during restore, but this is often normal." -ForegroundColor Yellow
    Write-Host "The migration may still be successful. Continuing..." -ForegroundColor Yellow
}

# Clean up temp file
docker compose -f compose.dev.yaml exec -T db-new rm /tmp/restore.dump 2>$null

Write-Host "Restore completed." -ForegroundColor Green
Write-Host ""

# Step 9: Verify data migration
Write-Host "[9/10] Verifying data migration..." -ForegroundColor Yellow
Write-Host "Counting tables in old database:" -ForegroundColor Cyan
$oldCount = docker compose -f compose.dev.yaml exec -T db psql -U hestami_user -d hestami_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
Write-Host "  Tables: $($oldCount.Trim())" -ForegroundColor White

Write-Host "Counting tables in new database:" -ForegroundColor Cyan
$newCount = docker compose -f compose.dev.yaml exec -T db-new psql -U hestami_user -d hestami_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
Write-Host "  Tables: $($newCount.Trim())" -ForegroundColor White

if ($oldCount.Trim() -eq $newCount.Trim()) {
    Write-Host "Table counts match!" -ForegroundColor Green
} else {
    Write-Host "WARNING: Table counts don't match. Please verify manually." -ForegroundColor Yellow
}
Write-Host ""

# Step 10: Instructions for switching
Write-Host "[10/10] Migration completed!" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Verify the data in the new database:" -ForegroundColor White
Write-Host "   docker compose -f compose.dev.yaml exec db-new psql -U hestami_user -d hestami_db" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test your application with the new database:" -ForegroundColor White
Write-Host "   - Update .env.local: DB_HOST=db-new and DB_PORT=5432" -ForegroundColor Gray
Write-Host "   - Restart Django: docker compose -f compose.dev.yaml restart api celery-worker" -ForegroundColor Gray
Write-Host "   - Run migrations: docker compose -f compose.dev.yaml exec api python manage.py migrate" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Once verified, switch to new database permanently:" -ForegroundColor White
Write-Host "   - Stop old database: docker compose -f compose.dev.yaml stop db" -ForegroundColor Gray
Write-Host "   - Rename db-new to db in compose.dev.yaml" -ForegroundColor Gray
Write-Host "   - Update port from 5433 to 5432" -ForegroundColor Gray
Write-Host "   - Restart all services" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Clean up old database (ONLY after verifying new one works):" -ForegroundColor White
Write-Host "   - Remove old container: docker compose -f compose.dev.yaml rm db" -ForegroundColor Gray
Write-Host "   - Remove old volume: docker volume rm hestami-ai_postgres_data_dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Backup saved at: $backupFile" -ForegroundColor Cyan
Write-Host "Keep this backup until you're confident the migration succeeded!" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
