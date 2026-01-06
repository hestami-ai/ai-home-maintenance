# PowerShell script to add 'association: null' to all page server load functions
# that are missing it

$filesToFix = @(
    'src\routes\app\admin\activity\+page.server.ts',
    'src\routes\app\admin\cases\+page.server.ts',
    'src\routes\app\admin\cases\[id]\+page.server.ts',
    'src\routes\app\admin\cases\[id]\vendors\+page.server.ts',
    'src\routes\app\admin\cases\[id]\vendors\[vendorId]\+page.server.ts',
    'src\routes\app\admin\document-processing\+page.server.ts',
    'src\routes\app\admin\documents\+page.server.ts',
    'src\routes\app\admin\permissions\+page.server.ts',
    'src\routes\app\admin\staff\+page.server.ts',
    'src\routes\app\admin\staff\[id]\+page.server.ts',
    'src\routes\app\admin\work-queue\+page.server.ts',
    'src\routes\app\cam\+layout.server.ts',
    'src\routes\app\cam\+page.server.ts',
    'src\routes\app\cam\associations\[id]\+page.server.ts',
    'src\routes\app\cam\associations\new\+page.server.ts',
    'src\routes\app\cam\management\staff\+page.server.ts',
    'src\routes\app\cam\violations\[id]\+page.server.ts',
    'src\routes\app\cam\work-orders\+page.server.ts',
    'src\routes\app\concierge\+page.server.ts',
    'src\routes\app\concierge\documents\+page.server.ts',
    'src\routes\app\concierge\documents\[id]\+page.server.ts',
    'src\routes\app\concierge\documents\upload\+page.server.ts',
    'src\routes\app\concierge\notifications\+page.server.ts',
    'src\routes\app\concierge\properties\+page.server.ts',
    'src\routes\app\concierge\properties\[id]\+page.server.ts',
    'src\routes\app\concierge\properties\[id]\edit\+page.server.ts',
    'src\routes\app\concierge\service-calls\[id]\+page.server.ts',
    'src\routes\app\concierge\service-calls\new\+page.server.ts',
    'src\routes\app\contractor\dispatch\+page.server.ts',
    'src\routes\app\contractor\jobs\+page.server.ts',
    'src\routes\app\contractor\technicians\+page.server.ts',
    'src\routes\app\contractor\technicians\[id]\+page.server.ts',
    'src\routes\onboarding\+page.server.ts',
    'src\routes\onboarding\community\+layout.server.ts',
    'src\routes\onboarding\property-owner\+layout.server.ts',
    'src\routes\onboarding\service-provider\+layout.server.ts'
)

$fixedCount = 0
$skippedCount = 0

foreach ($file in $filesToFix) {
    $fullPath = Join-Path $PSScriptRoot $file
    
    if (-not (Test-Path $fullPath)) {
        Write-Host "SKIP: File not found: $file" -ForegroundColor Yellow
        $skippedCount++
        continue
    }
    
    $content = Get-Content $fullPath -Raw
    
    # Check if file already has 'association:' in a return statement
    if ($content -match 'return\s*\{[^}]*association:') {
        Write-Host "SKIP: Already has association: $file" -ForegroundColor Cyan
        $skippedCount++
        continue
    }
    
    # Pattern 1: return { ... }; at end of function (single line)
    $pattern1 = '(return\s*\{)([^}]+)(\};)'
    if ($content -match $pattern1) {
        $newContent = $content -replace $pattern1, '$1$2, association: null$3'
        Set-Content -Path $fullPath -Value $newContent -NoNewline
        Write-Host "FIXED (pattern 1): $file" -ForegroundColor Green
        $fixedCount++
        continue
    }
    
    # Pattern 2: return { ... } (multi-line, closing brace on new line)
    $pattern2 = '(return\s*\{[^}]+)(\s*\};)'
    if ($content -match $pattern2) {
        $newContent = $content -replace $pattern2, '$1,`r`n        association: null$2'
        Set-Content -Path $fullPath -Value $newContent -NoNewline
        Write-Host "FIXED (pattern 2): $file" -ForegroundColor Green
        $fixedCount++
        continue
    }
    
    Write-Host "MANUAL: Could not auto-fix: $file" -ForegroundColor Magenta
    $skippedCount++
}

Write-Host "`nSummary:" -ForegroundColor White
Write-Host "  Fixed: $fixedCount" -ForegroundColor Green
Write-Host "  Skipped: $skippedCount" -ForegroundColor Yellow
