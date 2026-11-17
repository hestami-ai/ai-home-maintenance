# Run one bun script (or any program) in the Sonar worktree at below-normal priority with a TRUSTWORTHY exit code.
# `cmd /c start /wait /b` lost the exit code (gate:fast exited 1 and the wrapper printed exit=0, 2026-11-12), so this uses
# Start-Process -PassThru and ALSO scans the log for bun's own failure lines; either one marks the step failed.
# usage: run_step.ps1 -Name <label> -LogDir <dir> -Exe <program> -ArgList <args...> [-Cwd <dir>] [-E2EPort <port>]
param(
	[Parameter(Mandatory)] [string] $Name,
	[Parameter(Mandatory)] [string] $LogDir,
	[Parameter(Mandatory)] [string] $Exe,
	[Parameter(Mandatory)] [string[]] $ArgList,
	[string] $Cwd = 'E:\Projects\hestami-sonar\JanumiCode\janumiprofessionalworkbench',
	[string] $E2EPort = ''
)
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$out = Join-Path $LogDir "$Name.log"
$err = Join-Path $LogDir "$Name.err"
if ($E2EPort) { $env:RPH_E2E_PORT = $E2EPort }
try {
	$sw = [Diagnostics.Stopwatch]::StartNew()
	$p = Start-Process -FilePath $Exe -ArgumentList $ArgList -WorkingDirectory $Cwd -NoNewWindow -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
	try { $p.PriorityClass = 'BelowNormal' } catch {}
	$p.WaitForExit()
	$code = $p.ExitCode
	$failLines = @(Select-String -Path $out, $err -Pattern 'error: script ".*" exited with code [1-9]|^\s*Test Files\s+\d+ failed' -ErrorAction SilentlyContinue)
	$verdict = if ($code -eq 0 -and $failLines.Count -eq 0) { 'PASS' } else { 'FAIL' }
	# [Math]::Floor, not [int]: [int] ROUNDS, so 63 min 48 s printed as "64 min 48 s" (2026-11-12).
	"$Name $verdict  exit=$code  failure-lines=$($failLines.Count)  ($([Math]::Floor($sw.Elapsed.TotalMinutes)) min $($sw.Elapsed.Seconds) s; $([int]$sw.Elapsed.TotalSeconds) s total)"
	$failLines | Select-Object -First 5 | ForEach-Object { '    ' + $_.Line.Trim() }
} finally {
	if ($E2EPort) { Remove-Item Env:RPH_E2E_PORT -ErrorAction SilentlyContinue }
}
