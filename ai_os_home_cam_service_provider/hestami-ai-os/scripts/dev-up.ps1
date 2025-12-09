# Start development infrastructure (Postgres, Redis, Jaeger)
# Usage: .\scripts\dev-up.ps1

Write-Host "Starting development infrastructure..." -ForegroundColor Cyan

docker compose up -d postgres redis jaeger

Write-Host ""
Write-Host "Waiting for services to be healthy..." -ForegroundColor Yellow

# Wait for Postgres
$maxAttempts = 30
$attempt = 0
do {
    $attempt++
    $result = docker compose exec -T postgres pg_isready -U hestami 2>$null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 1
} while ($attempt -lt $maxAttempts)

if ($attempt -ge $maxAttempts) {
    Write-Host "Postgres failed to start!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Development infrastructure ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  PostgreSQL: localhost:5432"
Write-Host "  Redis:      localhost:6379"
Write-Host "  Jaeger UI:  http://localhost:16686"
Write-Host ""
Write-Host "Run 'npm run dev' to start the application" -ForegroundColor Yellow
