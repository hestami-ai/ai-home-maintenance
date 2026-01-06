# PowerShell script to add 'association: null' to ALL return statements in page server files

$filesToFix = @(
    'src\routes\app\admin\cases\+page.server.ts',
    'src\routes\app\admin\documents\+page.server.ts',
    'src\routes\app\admin\permissions\+page.server.ts',
    'src\routes\app\admin\staff\+page.server.ts',
    'src\routes\app\admin\work-queue\+page.server.ts',
    'src\routes\app\cam\management\staff\+page.server.ts',
    'src\routes\app\cam\work-orders\+page.server.ts',
    'src\routes\app\contractor\jobs\+page.server.ts',
    'src\routes\app\contractor\technicians\+page.server.ts',
    'src\routes\onboarding\community\+layout.server.ts',
    'src\routes\onboarding\property-owner\+layout.server.ts',
    'src\routes\onboarding\service-provider\+layout.server.ts'
)

$fixedCount = 0

foreach ($file in $filesToFix) {
    $fullPath = Join-Path $PSScriptRoot $file
    
    if (-not (Test-Path $fullPath)) {
        Write-Host "SKIP: File not found: $file" -ForegroundColor Yellow
        continue
    }
    
    $content = Get-Content $fullPath -Raw
    
    # Check if file already has 'association:' in any return statement
    if ($content -match 'association:\s*(null|Association)') {
        Write-Host "SKIP: Already has association: $file" -ForegroundColor Cyan
        continue
    }
    
    # Replace all return statements that end with }; or };
    # Pattern: return { ... }; where ... doesn't contain 'association'
    $newContent = $content -replace '(return\s*\{[^}]*?)(\s*\};)', '$1,`r`n            association: null$2'
    
    if ($newContent -ne $content) {
        Set-Content -Path $fullPath -Value $newContent -NoNewline
        Write-Host "FIXED: $file" -ForegroundColor Green
        $fixedCount++
    } else {
        Write-Host "NO CHANGE: $file" -ForegroundColor Magenta
    }
}

Write-Host "`nFixed $fixedCount files" -ForegroundColor Green
