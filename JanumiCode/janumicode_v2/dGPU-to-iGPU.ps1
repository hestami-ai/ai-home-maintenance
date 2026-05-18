# Run as the Windows user whose Graphics settings you want to modify.

$RegPath = "HKCU:\Software\Microsoft\DirectX\UserGpuPreferences"
$Exclude = @("ollama.exe", "ollama app.exe") # adjust if needed

New-Item -Path $RegPath -Force | Out-Null

# Backup current preferences
$backup = "$env:USERPROFILE\Desktop\UserGpuPreferences-backup.reg"
reg export "HKCU\Software\Microsoft\DirectX\UserGpuPreferences" $backup /y | Out-Null

# Get active NVIDIA compute process PIDs
$pids = & nvidia-smi --query-compute-apps=pid --format=csv,noheader 2>$null |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -match '^\d+$' } |
    Sort-Object -Unique

foreach ($pid1 in $pids) {
    try {
        $proc = Get-Process -Id $pid1 -ErrorAction Stop
        $exe = $proc.Path

        if (-not $exe) {
            Write-Warning "Could not resolve path for PID $pid1 ($($proc.ProcessName))"
            continue
        }

        $name = Split-Path $exe -Leaf

        if ($Exclude -contains $name.ToLower()) {
            Write-Host "Skipping excluded dGPU app: $exe"
            continue
        }

        # Windows Graphics setting:
        # GpuPreference=1 = Power saving / iGPU
        # GpuPreference=2 = High performance / dGPU
        New-ItemProperty `
            -Path $RegPath `
            -Name $exe `
            -Value "GpuPreference=1;" `
            -PropertyType String `
            -Force | Out-Null

        Write-Host "Set to iGPU / Power saving: $exe"
    }
    catch {
        Write-Warning "Failed PID $pid1 : $_"
    }
}