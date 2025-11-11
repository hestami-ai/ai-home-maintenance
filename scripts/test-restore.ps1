# Quick diagnostic script to see what's wrong with restore

Write-Host "Testing restore with full error output..." -ForegroundColor Yellow
Write-Host ""

# Use the latest backup
$backupFile = Get-ChildItem "backups\*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (!$backupFile) {
    Write-Host "ERROR: No backup file found!" -ForegroundColor Red
    exit 1
}

Write-Host "Using backup: $($backupFile.Name)" -ForegroundColor Cyan
Write-Host ""

# Copy to container
Write-Host "Copying backup to container..." -ForegroundColor Yellow
docker cp $backupFile.FullName db-new-dev:/tmp/restore.dump

# Try restore with FULL error output
Write-Host ""
Write-Host "Attempting restore (showing all output)..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Gray
docker compose -f compose.dev.yaml exec -T db-new pg_restore -U hestami_user -d hestami_db -v --no-owner --no-acl /tmp/restore.dump
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""

# Check what was restored
Write-Host "Checking restored tables..." -ForegroundColor Yellow
docker compose -f compose.dev.yaml exec -T db-new psql -U hestami_user -d hestami_db -c "\dt"
Write-Host ""

# Check table count
Write-Host "Table count:" -ForegroundColor Yellow
docker compose -f compose.dev.yaml exec -T db-new psql -U hestami_user -d hestami_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
