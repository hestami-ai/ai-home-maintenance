# Reset development database (destroys all data)
# Usage: .\scripts\dev-reset.ps1

Write-Host "WARNING: This will destroy all data in the development database!" -ForegroundColor Red
$confirm = Read-Host "Type 'yes' to confirm"

if ($confirm -ne "yes") {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
}

Write-Host "Resetting database..." -ForegroundColor Cyan

# Stop containers and remove volumes
docker compose down -v

# Start fresh
docker compose up -d postgres redis jaeger

Write-Host "Waiting for Postgres..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Run migrations
npm run db:migrate

Write-Host ""
Write-Host "Database reset complete!" -ForegroundColor Green
