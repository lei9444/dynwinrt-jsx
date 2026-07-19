#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [ValidateRange(1, 100)]
    [int]$Cycles = 3,
    [string]$WorkRoot,
    [string]$NodePath,
    [string]$TypeScriptPath,
    [string]$DotNetPath,
    [string]$WinAppPath,
    [string]$OutputDirectory,
    [int]$ReadyTimeoutMilliseconds = 30000,
    [ValidateRange(0, 100)]
    [double]$MaxPrivateMemoryGrowthPercent = 25,
    [ValidateRange(0, 100)]
    [double]$MaxHandleGrowthPercent = 15,
    [ValidateRange(3, 100)]
    [int]$MinimumTrendCycles = 5,
    [switch]$UseExistingWinAppCli,
    [switch]$SkipRestore
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$dashboardRoot = Join-Path $repoRoot "examples\dashboard"
$prepareScript = Join-Path $PSScriptRoot "run-dashboard-local.ps1"
$smokeScript = Join-Path $PSScriptRoot "smoke-dashboard-ui.ps1"
if (-not $WorkRoot) {
    $WorkRoot = Split-Path $repoRoot -Parent
}
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $dashboardRoot ".winapp\lifecycle-smoke"
}
if (-not $WinAppPath) {
    $WinAppPath = Join-Path $WorkRoot "winappCli\src\winapp-npm\bin\win-x64\winapp.exe"
}

function Resolve-Node([string]$RequestedPath) {
    $candidates = @()
    if ($RequestedPath) {
        $candidates += $RequestedPath
    }
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($command) {
        $candidates += $command.Source
    }
    $candidates += Join-Path $env:ProgramFiles "Microsoft Visual Studio\2022\Enterprise\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe"

    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (-not (Test-Path $candidate)) {
            continue
        }
        $metadata = (
            & $candidate -p "process.arch + '|' + process.versions.node.split('.')[0]"
        ).Trim().Split("|")
        if (
            $LASTEXITCODE -eq 0 -and
            $metadata.Count -eq 2 -and
            $metadata[0] -eq "x64" -and
            [int]$metadata[1] -ge 20
        ) {
            return [IO.Path]::GetFullPath($candidate)
        }
    }

    throw "An x64 Node.js 20+ executable is required. Pass -NodePath with a local node.exe."
}

function Read-SharedText([string]$Path) {
    if (-not (Test-Path $Path)) {
        return ""
    }

    $stream = [IO.FileStream]::new(
        $Path,
        [IO.FileMode]::Open,
        [IO.FileAccess]::Read,
        [IO.FileShare]::ReadWrite
    )
    try {
        $reader = [IO.StreamReader]::new($stream)
        try {
            return $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

function Wait-DashboardReady(
    [Diagnostics.Process]$Process,
    [string]$StdoutPath,
    [string]$StderrPath
) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($ReadyTimeoutMilliseconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $Process.Refresh()
        if ($Process.HasExited) {
            throw "Dashboard exited before readiness with code $($Process.ExitCode). $(Read-SharedText $StderrPath)"
        }
        if ((Read-SharedText $StdoutPath) -match "dashboard is ready") {
            return
        }
        Start-Sleep -Milliseconds 100
    }
    throw "Dashboard did not report readiness within $ReadyTimeoutMilliseconds ms."
}

function Get-Median([double[]]$Values) {
    if ($Values.Count -eq 0) {
        return 0
    }
    $sorted = @($Values | Sort-Object)
    $middle = [Math]::Floor($sorted.Count / 2)
    if ($sorted.Count % 2 -eq 1) {
        return [double]$sorted[$middle]
    }
    return (
        [double]$sorted[$middle - 1] +
        [double]$sorted[$middle]
    ) / 2
}

function Write-Summary(
    [string]$Path,
    [DateTime]$StartedAt,
    [System.Collections.Generic.List[object]]$Results
) {
    $passed = @($Results | Where-Object { $_.status -eq "passed" }).Count
    $resourceSamples = @(
        $Results |
            Where-Object {
                $_.status -eq "passed" -and
                $_.resources
            } |
            ForEach-Object { $_.resources }
    )
    $resourceTrend = $null
    $resourceStable = $true
    if ($resourceSamples.Count -ge $MinimumTrendCycles) {
        $windowSize = [Math]::Max(
            2,
            [Math]::Floor($resourceSamples.Count / 3)
        )
        $baselineSamples = @(
            $resourceSamples |
                Select-Object -Skip 1 -First $windowSize
        )
        if ($baselineSamples.Count -lt 2) {
            $baselineSamples = @($resourceSamples | Select-Object -First $windowSize)
        }
        $recentSamples = @(
            $resourceSamples |
                Select-Object -Last $windowSize
        )
        $baselinePrivate = Get-Median @(
            $baselineSamples | ForEach-Object { $_.privateMemoryBytes }
        )
        $recentPrivate = Get-Median @(
            $recentSamples | ForEach-Object { $_.privateMemoryBytes }
        )
        $baselineHandles = Get-Median @(
            $baselineSamples | ForEach-Object { $_.handleCount }
        )
        $recentHandles = Get-Median @(
            $recentSamples | ForEach-Object { $_.handleCount }
        )
        $privateGrowth = if ($baselinePrivate -eq 0) {
            0
        }
        else {
            (($recentPrivate - $baselinePrivate) / $baselinePrivate) * 100
        }
        $handleGrowth = if ($baselineHandles -eq 0) {
            0
        }
        else {
            (($recentHandles - $baselineHandles) / $baselineHandles) * 100
        }
        $resourceStable = (
            $privateGrowth -le $MaxPrivateMemoryGrowthPercent -and
            $handleGrowth -le $MaxHandleGrowthPercent
        )
        $resourceTrend = [ordered]@{
            sampleCount = $resourceSamples.Count
            windowSize = $windowSize
            baselinePrivateMemoryBytes = [long]$baselinePrivate
            recentPrivateMemoryBytes = [long]$recentPrivate
            privateMemoryGrowthPercent = [Math]::Round($privateGrowth, 2)
            baselineHandleCount = [int]$baselineHandles
            recentHandleCount = [int]$recentHandles
            handleGrowthPercent = [Math]::Round($handleGrowth, 2)
            maxPrivateMemoryGrowthPercent = $MaxPrivateMemoryGrowthPercent
            maxHandleGrowthPercent = $MaxHandleGrowthPercent
            stable = $resourceStable
        }
    }
    $summary = [ordered]@{
        startedAt = $StartedAt.ToUniversalTime().ToString("o")
        completedAt = [DateTime]::UtcNow.ToString("o")
        requestedCycles = $Cycles
        completedCycles = $Results.Count
        passedCycles = $passed
        passed = $passed -eq $Cycles -and $resourceStable
        resourceTrend = $resourceTrend
        cycles = $Results
    }
    [IO.File]::WriteAllText(
        $Path,
        "$($summary | ConvertTo-Json -Depth 8)`n"
    )
}

$mutexHash = [Convert]::ToHexString(
    [Security.Cryptography.SHA256]::HashData(
        [Text.Encoding]::UTF8.GetBytes($dashboardRoot)
    )
).Substring(0, 16)
$mutex = [Threading.Mutex]::new(
    $false,
    "Local\dynwinrt-jsx-dashboard-lifecycle-$mutexHash"
)
$ownsMutex = $false

try {
    try {
        $ownsMutex = $mutex.WaitOne(0)
    }
    catch [Threading.AbandonedMutexException] {
        $ownsMutex = $true
    }
    if (-not $ownsMutex) {
        throw "Another dashboard lifecycle smoke run is already active."
    }

$prepareArgs = @{
    WorkRoot = $WorkRoot
    NoLaunch = $true
}
if ($NodePath) {
    $prepareArgs.NodePath = $NodePath
}
if ($TypeScriptPath) {
    $prepareArgs.TypeScriptPath = $TypeScriptPath
}
if ($DotNetPath) {
    $prepareArgs.DotNetPath = $DotNetPath
}
if ($SkipRestore) {
    $prepareArgs.SkipRestore = $true
}
if ($UseExistingWinAppCli) {
    $prepareArgs.UseExistingWinAppCli = $true
}

Write-Host "Preparing dashboard once before $Cycles lifecycle cycles..." -ForegroundColor Cyan
& $prepareScript @prepareArgs
if ($LASTEXITCODE -ne 0) {
    throw "Dashboard preparation failed with code $LASTEXITCODE."
}

$NodePath = Resolve-Node $NodePath
$runDirectory = Join-Path $OutputDirectory (
    "run-{0}-{1}" -f
        [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss-fff"),
        [guid]::NewGuid().ToString("N").Substring(0, 8)
)
New-Item -ItemType Directory -Force -Path $runDirectory | Out-Null
$summaryPath = Join-Path $runDirectory "summary.json"
$results = [System.Collections.Generic.List[object]]::new()
$startedAt = [DateTime]::UtcNow

for ($cycle = 1; $cycle -le $Cycles; $cycle += 1) {
    $cycleName = "cycle-{0:D2}" -f $cycle
    $cycleDirectory = Join-Path $runDirectory $cycleName
    New-Item -ItemType Directory -Force -Path $cycleDirectory | Out-Null

    $stdoutPath = Join-Path $dashboardRoot ".winapp\dashboard.stdout.log"
    $stderrPath = Join-Path $dashboardRoot ".winapp\dashboard.stderr.log"
    $pidPath = Join-Path $dashboardRoot ".winapp\dashboard.pid"
    if (Test-Path $pidPath) {
        $existingPid = [int]([IO.File]::ReadAllText($pidPath).Trim())
        if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
            throw "Dashboard PID $existingPid is already running; refusing to overwrite its lifecycle state."
        }
    }
    Remove-Item $stdoutPath, $stderrPath, $pidPath -Force -ErrorAction SilentlyContinue

    $cycleStarted = [DateTime]::UtcNow
    $process = $null
    $failure = $null
    $cleanupFailure = $null
    try {
        Write-Host "[$cycleName] Launching dashboard..." -ForegroundColor Cyan
        $oldStatePath = $env:DYNWINRT_JSX_STATE_PATH
        try {
            $env:DYNWINRT_JSX_STATE_PATH = Join-Path $cycleDirectory "state.json"
            $process = Start-Process `
                -FilePath $NodePath `
                -ArgumentList ".\main.js" `
                -WorkingDirectory $dashboardRoot `
                -RedirectStandardOutput $stdoutPath `
                -RedirectStandardError $stderrPath `
                -PassThru
        }
        finally {
            $env:DYNWINRT_JSX_STATE_PATH = $oldStatePath
        }
        [IO.File]::WriteAllText($pidPath, "$($process.Id)`n")
        Wait-DashboardReady $process $stdoutPath $stderrPath

        & $smokeScript `
            -WorkRoot $WorkRoot `
            -WinAppPath $WinAppPath `
            -ExpectedProcessId $process.Id `
            -OutputDirectory $cycleDirectory `
            -KeepOpen
        if ($LASTEXITCODE -ne 0) {
            throw "UI smoke failed with code $LASTEXITCODE."
        }

        $process.Refresh()
        $resources = [ordered]@{
            workingSetBytes = [long]$process.WorkingSet64
            privateMemoryBytes = [long]$process.PrivateMemorySize64
            handleCount = [int]$process.HandleCount
            threadCount = [int]$process.Threads.Count
            cpuSeconds = [Math]::Round($process.TotalProcessorTime.TotalSeconds, 3)
        }
        $status = & $WinAppPath ui status -a "$($process.Id)" --json |
            ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to resolve dashboard window before close."
        }
        & $WinAppPath ui invoke "Close" -w "$($status.hwnd)"
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to close dashboard after resource sampling."
        }
        Wait-Process -Id $process.Id -Timeout 15

        $process.Refresh()
        if (-not $process.HasExited) {
            throw "Dashboard remained running after the smoke close step."
        }
        if ($process.ExitCode -ne 0) {
            throw "Dashboard exited with code $($process.ExitCode)."
        }

        $stdout = Read-SharedText $stdoutPath
        $diagnosticMatch = [regex]::Match(
            $stdout,
            "renderer disposed cleanly: (\{[^\r\n]+\})"
        )
        if (-not $diagnosticMatch.Success) {
            throw "Renderer diagnostics were not found in dashboard output."
        }

        Copy-Item $stdoutPath (Join-Path $cycleDirectory "dashboard.stdout.log") -Force
        Copy-Item $stderrPath (Join-Path $cycleDirectory "dashboard.stderr.log") -Force
        $results.Add([pscustomobject]@{
            cycle = $cycle
            status = "passed"
            processId = $process.Id
            exitCode = $process.ExitCode
            durationMs = [int](
                ([DateTime]::UtcNow - $cycleStarted).TotalMilliseconds
            )
            diagnostics = $diagnosticMatch.Groups[1].Value | ConvertFrom-Json
            resources = $resources
            artifacts = $cycleDirectory
        })
    }
    catch {
        $failure = $_
    }
    finally {
        if ($process) {
            $process.Refresh()
            if (-not $process.HasExited) {
                try {
                    Stop-Process -Id $process.Id -Force -ErrorAction Stop
                    Wait-Process -Id $process.Id -Timeout 5 -ErrorAction Stop
                }
                catch {
                    $process.Refresh()
                    if (-not $process.HasExited) {
                        $cleanupFailure = $_
                    }
                }
            }
        }
        if ($failure) {
            $finalExitCode = $null
            if ($process) {
                $process.Refresh()
                if ($process.HasExited) {
                    $finalExitCode = $process.ExitCode
                }
            }
            $results.Add([pscustomobject]@{
                cycle = $cycle
                status = "failed"
                processId = if ($process) { $process.Id } else { $null }
                exitCode = $finalExitCode
                durationMs = [int](
                    ([DateTime]::UtcNow - $cycleStarted).TotalMilliseconds
                )
                error = $failure.Exception.Message
                cleanupError = if ($cleanupFailure) {
                    $cleanupFailure.Exception.Message
                }
                else {
                    $null
                }
                artifacts = $cycleDirectory
            })
        }
        if (Test-Path $stdoutPath) {
            Copy-Item $stdoutPath (Join-Path $cycleDirectory "dashboard.stdout.log") -Force
        }
        if (Test-Path $stderrPath) {
            Copy-Item $stderrPath (Join-Path $cycleDirectory "dashboard.stderr.log") -Force
        }
        if ((-not $process -or $process.HasExited) -and (Test-Path $pidPath)) {
            $recordedPid = [int]([IO.File]::ReadAllText($pidPath).Trim())
            if (-not $process -or $recordedPid -eq $process.Id) {
                Remove-Item $pidPath -Force
            }
        }
        Write-Summary $summaryPath $startedAt $results
    }

    if ($cleanupFailure) {
        throw $cleanupFailure
    }
    if ($failure) {
        throw $failure
    }
}

Write-Host "Lifecycle smoke completed: $Cycles/$Cycles cycles passed." -ForegroundColor Green
Write-Host "Summary: $summaryPath" -ForegroundColor Green
$finalSummary = [IO.File]::ReadAllText($summaryPath) | ConvertFrom-Json
if (-not $finalSummary.passed) {
    throw "Lifecycle resource trend exceeded configured thresholds. See $summaryPath."
}
}
finally {
    if ($ownsMutex) {
        $mutex.ReleaseMutex()
    }
    $mutex.Dispose()
}
