#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$ReactorRoot = (
        Join-Path $PSScriptRoot "..\..\..\microsoft-ui-reactor"
    ),
    [ValidateSet("x64", "ARM64")]
    [string]$Platform = $(if (
        [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -eq
        [System.Runtime.InteropServices.Architecture]::Arm64
    ) { "ARM64" } else { "x64" }),
    [ValidateSet("Release")]
    [string]$Configuration = "Release",
    [ValidateSet("StockGrid", "KeyedList")]
    [string]$Scenario = "StockGrid",
    [double[]]$Percents = @(0, 50, 100),
    [int]$Duration = 10,
    [int]$Warmup = 2,
    [int]$Reps = 12,
    [switch]$SkipBuild,
    [switch]$ForceGenerate,
    [switch]$IncludeEtw,
    [string]$DotnetPath,
    [string]$OutDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$benchmarkRoot = $PSScriptRoot
$jsxRoot = Join-Path $benchmarkRoot "dynwinrt-jsx"
$ReactorRoot = (Resolve-Path $ReactorRoot).Path
if (-not $OutDir) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutDir = Join-Path $benchmarkRoot "results\$stamp"
}
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$OutDir = (Resolve-Path $OutDir).Path

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) {
    $nodeCommand.Source
}
else {
    $fallbackNodePath = "C:\Program Files\nodejs\node.exe"
    if (-not (Test-Path $fallbackNodePath)) {
        throw "Node.js was not found."
    }
    $fallbackNodePath
}
$npmPath = Join-Path (Split-Path $nodePath) "npm.cmd"
$dotnet = if ($DotnetPath) {
    (Resolve-Path $DotnetPath).Path
}
else {
    (Get-Command dotnet -ErrorAction Stop).Source
}
$dotnetRoot = Split-Path $dotnet
$env:DOTNET_ROOT = $dotnetRoot
$env:PATH = "$dotnetRoot;$env:PATH"
$env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"

function Invoke-Checked {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )
    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$FilePath $($Arguments -join ' ') exited with $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

function Find-AppExecutable {
    param(
        [string]$ProjectDirectory,
        [string]$AppName
    )
    $candidate = Get-ChildItem `
        -Path (Join-Path $ProjectDirectory "bin") `
        -Filter "$AppName.exe" `
        -File `
        -Recurse |
        Where-Object {
            $_.FullName -match [regex]::Escape("\$Platform\$Configuration\") -or
            $_.FullName -match [regex]::Escape("\$Configuration\")
        } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $candidate) {
        throw "$AppName.exe was not found under $ProjectDirectory\bin."
    }
    return $candidate.FullName
}

function Build-Benchmarks {
    if (-not (Test-Path (Join-Path $jsxRoot "node_modules"))) {
        Invoke-Checked $npmPath @(
            "install",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund"
        ) $jsxRoot
    }
    $bindingsPath = Join-Path $jsxRoot ".winapp\bindings\index.js"
    if ($ForceGenerate -or -not (Test-Path $bindingsPath)) {
        Invoke-Checked $npmPath @("run", "setup") $jsxRoot
        if ($ForceGenerate -or -not (Test-Path $bindingsPath)) {
            Invoke-Checked $npmPath @("run", "generate") $jsxRoot
        }
    }
    Invoke-Checked $npmPath @("run", "build") $jsxRoot
    Invoke-Checked $npmPath @("test") $jsxRoot

    $projects = if ($Scenario -eq "KeyedList") {
        @("StressPerf.KeyedList")
    }
    else {
        @(
            "StressPerf.Direct",
            "StressPerf.ReactorOptimized"
        )
    }
    foreach ($project in $projects) {
        $projectPath = Join-Path `
            $ReactorRoot `
            "tests\stress_perf\$project\$project.csproj"
        Invoke-Checked $dotnet @(
            "build",
            $projectPath,
            "-c", $Configuration,
            "-p:Platform=$Platform",
            "-p:PerfCiSelfContained=false",
            "--nologo"
        ) $ReactorRoot
    }

    if ($IncludeEtw) {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = [Security.Principal.WindowsPrincipal]::new($identity)
        if (-not $principal.IsInRole(
            [Security.Principal.WindowsBuiltInRole]::Administrator
        )) {
            throw "-IncludeEtw requires an elevated PowerShell session."
        }
        $tracerProject = Join-Path `
            $ReactorRoot `
            "tests\stress_perf\PresentTracer\PresentTracer.csproj"
        Invoke-Checked $dotnet @(
            "build",
            $tracerProject,
            "-c", $Configuration,
            "--nologo"
        ) $ReactorRoot
    }
}

if (-not $SkipBuild) {
    Build-Benchmarks
}

$directRoot = Join-Path $ReactorRoot "tests\stress_perf\StressPerf.Direct"
$reactorOptimizedRoot = Join-Path $ReactorRoot "tests\stress_perf\StressPerf.ReactorOptimized"
$keyedRoot = Join-Path $ReactorRoot "tests\stress_perf\StressPerf.KeyedList"
$presentTracer = $null
if ($IncludeEtw) {
    $presentTracer = Find-AppExecutable `
        (Join-Path $ReactorRoot "tests\stress_perf\PresentTracer") `
        "PresentTracer"
}

$variants = if ($Scenario -eq "KeyedList") {
    $reactorKeyedExe = Find-AppExecutable $keyedRoot "StressPerf.KeyedList"
    [ordered]@{
        DynWinRTJsx = @{
            FilePath = $nodePath
            WorkingDirectory = $jsxRoot
            AppName = "DynWinRTJsx.KeyedList"
        }
        Reactor = @{
            FilePath = $reactorKeyedExe
            WorkingDirectory = Split-Path $reactorKeyedExe
            AppName = "StressPerf.KeyedList"
        }
    }
}
else {
    $directExe = Find-AppExecutable $directRoot "StressPerf.Direct"
    $reactorExe = Find-AppExecutable $reactorOptimizedRoot "StressPerf.ReactorOptimized"
    [ordered]@{
        Direct = @{
            FilePath = $directExe
            WorkingDirectory = Split-Path $directExe
            AppName = "StressPerf.Direct"
        }
        DynWinRTJsx = @{
            FilePath = $nodePath
            WorkingDirectory = $jsxRoot
            AppName = "DynWinRTJsx.SignalGrid"
        }
        Reactor = @{
            FilePath = $reactorExe
            WorkingDirectory = Split-Path $reactorExe
            AppName = "StressPerf.ReactorOptimized"
        }
    }
}
$orders = if ($Scenario -eq "KeyedList") {
    @(
        @("DynWinRTJsx", "Reactor"),
        @("Reactor", "DynWinRTJsx")
    )
}
else {
    @(
        @("Direct", "DynWinRTJsx", "Reactor"),
        @("Reactor", "Direct", "DynWinRTJsx"),
        @("DynWinRTJsx", "Reactor", "Direct")
    )
}
$rawPath = Join-Path $OutDir "raw.jsonl"
Remove-Item $rawPath -Force -ErrorAction SilentlyContinue

function Get-ReportNumber {
    param(
        [string]$Text,
        [string]$Label
    )
    $match = [regex]::Match(
        $Text,
        "(?m)^$([regex]::Escape($Label))\s*:\s*([0-9.+-]+)"
    )
    if (-not $match.Success) {
        return 0.0
    }
    return [double]::Parse(
        $match.Groups[1].Value,
        [Globalization.CultureInfo]::InvariantCulture
    )
}

function Read-ReactorMetrics {
    param(
        [hashtable]$Variant,
        [double]$Percent
    )
    $directory = $Variant.WorkingDirectory
    $appName = $Variant.AppName
    $reportPath = Join-Path $directory "$appName.report.txt"
    $jsonPath = Join-Path $directory "$appName.metrics.json"
    if (-not (Test-Path $reportPath)) {
        throw "$reportPath was not produced."
    }
    $report = Get-Content $reportPath -Raw
    $json = if (Test-Path $jsonPath) {
        Get-Content $jsonPath -Raw | ConvertFrom-Json
    }
    else {
        $null
    }
    $durationSeconds = Get-ReportNumber $report "Duration"
    $totalRenders = [int](Get-ReportNumber $report "Total Renders")
    $avgUpdate = Get-ReportNumber $report "Avg Update"
    $avgReconcile = Get-ReportNumber $report "Avg Reconcile"
    $avgCombined = Get-ReportNumber $report "Avg Combined"
    if ($avgCombined -eq 0) {
        $avgCombined = $avgUpdate + $avgReconcile
    }
    return [ordered]@{
        app = $appName
        percent = $Percent
        durationSeconds = $durationSeconds
        rendersPerSec = if ($json) {
            [double]$json.rendersPerSec
        }
        elseif ($durationSeconds -gt 0) {
            $totalRenders / $durationSeconds
        }
        else { 0 }
        totalRenders = $totalRenders
        avgUpdateMs = $avgUpdate
        avgReconcileMs = $avgReconcile
        avgCombinedMs = $avgCombined
        avgFps = Get-ReportNumber $report "Avg FPS"
        avgMemoryMB = Get-ReportNumber $report "Avg Memory"
        peakMemoryMB = Get-ReportNumber $report "Peak Memory"
        allocBytesPerRender = Get-ReportNumber $report "Alloc/render"
    }
}

function Read-PresentMetrics {
    param([string]$CsvPath)
    if (-not (Test-Path $CsvPath)) {
        return $null
    }
    $rows = Import-Csv $CsvPath
    $global = $rows |
        Where-Object {
            $_.Provider -eq "GLOBAL" -and
            $_.Event -eq "VSync"
        } |
        Select-Object -First 1
    $present = $rows |
        Where-Object {
            $_.Event -match "Present"
        } |
        Sort-Object { [int]$_.Count } -Descending |
        Select-Object -First 1
    return [ordered]@{
        presentPerSec = if ($present) {
            [double]$present.PerSec
        } else { 0 }
        presentP50Ms = if ($present -and $present.P50ms) {
            [double]$present.P50ms
        } else { 0 }
        presentP95Ms = if ($present -and $present.P95ms) {
            [double]$present.P95ms
        } else { 0 }
        globalVsyncPerSec = if ($global) {
            [double]$global.PerSec
        } else { 0 }
    }
}

function Invoke-Variant {
    param(
        [string]$Name,
        [double]$Percent,
        [int]$Round,
        [bool]$IsWarmup,
        [int]$OrderIndex
    )
    $variant = $variants[$Name]
    $runId = "p$Percent-r$Round-o$OrderIndex-$Name"
    $stdoutPath = Join-Path $OutDir "$runId.stdout.log"
    $stderrPath = Join-Path $OutDir "$runId.stderr.log"
    $metricsPath = if ($Name -eq "DynWinRTJsx") {
        Join-Path $OutDir "$runId.metrics.json"
    }
    else {
        Join-Path $variant.WorkingDirectory "$($variant.AppName).metrics.json"
    }
    $reportPath = Join-Path `
        $variant.WorkingDirectory `
        "$($variant.AppName).report.txt"
    Remove-Item `
        $metricsPath,$reportPath,$stdoutPath,$stderrPath `
        -Force `
        -ErrorAction SilentlyContinue

    $arguments = if ($Name -eq "DynWinRTJsx") {
        $jsxArguments = @(
            "main.js",
            "--percent", "$Percent",
            "--duration", "$Duration",
            "--out", $metricsPath
        )
        if ($Scenario -eq "KeyedList") {
            $jsxArguments += @(
                "--scenario",
                "keyed-list"
            )
        }
        $jsxArguments
    }
    else {
        @(
            "--headless",
            "--percent", "$Percent",
            "--duration", "$Duration",
            "--json"
        )
    }
    $startedAt = [Diagnostics.Stopwatch]::StartNew()
    $process = Start-Process `
        -FilePath $variant.FilePath `
        -ArgumentList $arguments `
        -WorkingDirectory $variant.WorkingDirectory `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -PassThru
    $presentProcess = $null
    $presentCsv = Join-Path $OutDir "$runId.present.csv"
    if ($presentTracer) {
        Start-Sleep -Milliseconds 250
        $presentProcess = Start-Process `
            -FilePath $presentTracer `
            -ArgumentList @(
                "--pid", "$($process.Id)",
                "--duration", "$Duration",
                "--csv", $presentCsv
            ) `
            -WorkingDirectory (Split-Path $presentTracer) `
            -RedirectStandardOutput (Join-Path $OutDir "$runId.present.stdout.log") `
            -RedirectStandardError (Join-Path $OutDir "$runId.present.stderr.log") `
            -PassThru
    }

    $peakRss = 0L
    $windowReadyMs = $null
    $deadline = [DateTime]::UtcNow.AddSeconds($Duration + 90)
    while (-not $process.HasExited) {
        if ([DateTime]::UtcNow -gt $deadline) {
            Stop-Process -Id $process.Id
            throw "$Name timed out."
        }
        try {
            $process.Refresh()
            if (
                $null -eq $windowReadyMs -and
                $process.MainWindowHandle -ne 0
            ) {
                $windowReadyMs =
                    $startedAt.Elapsed.TotalMilliseconds
            }
            $peakRss = [Math]::Max(
                $peakRss,
                [int64]$process.WorkingSet64
            )
        }
        catch {
            # Process may exit between HasExited and Refresh.
        }
        Start-Sleep -Milliseconds 100
    }
    $process.WaitForExit()
    $startedAt.Stop()
    if ($presentProcess) {
        $presentProcess.WaitForExit()
    }
    if ($process.ExitCode -ne 0) {
        $stderr = if (Test-Path $stderrPath) {
            Get-Content $stderrPath -Tail 30
        } else { @() }
        throw "$Name exited with $($process.ExitCode): $($stderr -join [Environment]::NewLine)"
    }

    $metrics = if ($Name -eq "DynWinRTJsx") {
        if (-not (Test-Path $metricsPath)) {
            throw "$Name did not produce $metricsPath."
        }
        Get-Content $metricsPath -Raw |
            ConvertFrom-Json -AsHashtable
    }
    else {
        Read-ReactorMetrics $variant $Percent
    }
    $metrics.reportedRendersPerSec =
        [double]$metrics.rendersPerSec
    $metrics.rendersPerSec =
        [double]$metrics.totalRenders /
        [Math]::Max(0.001, $Duration)
    $present = Read-PresentMetrics $presentCsv
    $process.Refresh()
    $record = [ordered]@{
        variant = $Name
        percent = $Percent
        round = $Round
        warmup = $IsWarmup
        order = $OrderIndex
        wallMs = $startedAt.Elapsed.TotalMilliseconds
        windowReadyMs = $windowReadyMs
        externalPeakRssMB = $peakRss / 1MB
        externalCpuMs = $process.TotalProcessorTime.TotalMilliseconds
        metrics = $metrics
        present = $present
    }
    Add-Content `
        -LiteralPath $rawPath `
        -Value ($record | ConvertTo-Json -Depth 8 -Compress) `
        -Encoding UTF8
    Write-Host (
        "  {0,-12} p={1,3}% r={2} {3,8:N1} renders/s {4,7:N2} ms {5,7:N1} MB" -f
        $Name,
        $Percent,
        $Round,
        [double]$metrics.rendersPerSec,
        [double]$metrics.avgCombinedMs,
        ($peakRss / 1MB)
    )
    return $record
}

function Get-Median {
    param([double[]]$Values)
    $valuesArray = @($Values)
    if ($valuesArray.Count -eq 0) { return 0 }
    $sorted = @($valuesArray | Sort-Object)
    $middle = [int][Math]::Floor($sorted.Count / 2)
    if ($sorted.Count % 2 -eq 1) {
        return [double]$sorted[$middle]
    }
    return (
        [double]$sorted[$middle - 1] +
        [double]$sorted[$middle]
    ) / 2
}

function Get-MeanCi {
    param([double[]]$Values)
    $valuesArray = @($Values)
    if ($valuesArray.Count -eq 0) {
        return @{ mean = 0; low = 0; high = 0 }
    }
    $mean = ($valuesArray | Measure-Object -Average).Average
    if ($valuesArray.Count -lt 2) {
        return @{ mean = $mean; low = $mean; high = $mean }
    }
    $sumSquares = 0.0
    foreach ($value in $valuesArray) {
        $sumSquares += [Math]::Pow($value - $mean, 2)
    }
    $stddev = [Math]::Sqrt(
        $sumSquares / ($valuesArray.Count - 1)
    )
    $margin = 1.96 * $stddev / [Math]::Sqrt($valuesArray.Count)
    return @{
        mean = $mean
        low = $mean - $margin
        high = $mean + $margin
    }
}

$records = [Collections.Generic.List[object]]::new()
foreach ($percent in $Percents) {
    Write-Host "Percent $percent%"
    $roundCount = $Warmup + $Reps
    for ($round = 0; $round -lt $roundCount; $round += 1) {
        $order = $orders[$round % $orders.Count]
        $warmupRun = $round -lt $Warmup
        Write-Host (
            " Round {0}/{1} ({2})" -f
            ($round + 1),
            $roundCount,
            $(if ($warmupRun) { "warmup" } else { "measured" })
        )
        for ($orderIndex = 0; $orderIndex -lt $order.Count; $orderIndex += 1) {
            $record = Invoke-Variant `
                $order[$orderIndex] `
                $percent `
                $round `
                $warmupRun `
                $orderIndex
            $records.Add($record)
            Start-Sleep -Milliseconds 500
        }
    }
}

$measured = @($records | Where-Object { -not $_.warmup })
$groups = [Collections.Generic.List[object]]::new()
foreach ($percent in $Percents) {
    foreach ($name in $variants.Keys) {
        $samples = @(
            $measured |
            Where-Object {
                $_.percent -eq $percent -and
                $_.variant -eq $name
            }
        )
        $groups.Add([pscustomobject][ordered]@{
            variant = $name
            percent = $percent
            samples = $samples.Count
            rendersPerSecMedian = Get-Median @(
                $samples | ForEach-Object {
                    [double]$_.metrics.rendersPerSec
                }
            )
            avgCombinedMsMedian = Get-Median @(
                $samples | ForEach-Object {
                    [double]$_.metrics.avgCombinedMs
                }
            )
            peakRssMBMedian = Get-Median @(
                $samples | ForEach-Object {
                    [double]$_.externalPeakRssMB
                }
            )
            cpuMsMedian = Get-Median @(
                $samples | ForEach-Object {
                    [double]$_.externalCpuMs
                }
            )
            windowReadyMsMedian = Get-Median @(
                $samples | ForEach-Object {
                    if ($null -eq $_.windowReadyMs) {
                        0
                    } else {
                        [double]$_.windowReadyMs
                    }
                }
            )
            presentPerSecMedian = Get-Median @(
                $samples | ForEach-Object {
                    if ($_.present) {
                        [double]$_.present.presentPerSec
                    } else { 0 }
                }
            )
        })
    }
}

$comparisons = [Collections.Generic.List[object]]::new()
foreach ($percent in $Percents) {
    $baselineName = if ($Scenario -eq "KeyedList") {
        "Reactor"
    } else {
        "Direct"
    }
    $baselineSamples = @(
        $measured |
        Where-Object {
            $_.percent -eq $percent -and
            $_.variant -eq $baselineName
        }
    )
    $comparisonNames = if ($Scenario -eq "KeyedList") {
        @("DynWinRTJsx")
    } else {
        @("DynWinRTJsx", "Reactor")
    }
    foreach ($name in $comparisonNames) {
        $variantSamples = @(
            $measured |
            Where-Object {
                $_.percent -eq $percent -and
                $_.variant -eq $name
            }
        )
        $renderDeltas = @()
        $latencyDeltas = @()
        $memoryDeltas = @()
        foreach ($sample in $variantSamples) {
            $baseline = $baselineSamples |
                Where-Object { $_.round -eq $sample.round } |
                Select-Object -First 1
            if (-not $baseline) { continue }
            $renderDeltas += (
                (
                    [double]$sample.metrics.rendersPerSec -
                    [double]$baseline.metrics.rendersPerSec
                ) /
                [Math]::Max(
                    0.0001,
                    [double]$baseline.metrics.rendersPerSec
                ) *
                100
            )
            $latencyDeltas += (
                (
                    [double]$sample.metrics.avgCombinedMs -
                    [double]$baseline.metrics.avgCombinedMs
                ) /
                [Math]::Max(
                    0.0001,
                    [double]$baseline.metrics.avgCombinedMs
                ) *
                100
            )
            $memoryDeltas += (
                (
                    [double]$sample.externalPeakRssMB -
                    [double]$baseline.externalPeakRssMB
                ) /
                [Math]::Max(
                    0.0001,
                    [double]$baseline.externalPeakRssMB
                ) *
                100
            )
        }
        $comparisons.Add([pscustomobject][ordered]@{
            variant = $name
            baseline = $baselineName
            percent = $percent
            rendersPerSecDeltaPercent = Get-MeanCi $renderDeltas
            avgCombinedMsDeltaPercent = Get-MeanCi $latencyDeltas
            peakRssDeltaPercent = Get-MeanCi $memoryDeltas
        })
    }
}

function Git-Revision {
    param([string]$Root)
    return (
        & git -C $Root rev-parse HEAD 2>$null
    ).Trim()
}

$processor = try {
    Get-CimInstance Win32_Processor |
        Select-Object -First 1 -ExpandProperty Name
}
catch {
    "unknown"
}
$refreshRates = try {
    @(
        Get-CimInstance Win32_VideoController |
        Select-Object -ExpandProperty CurrentRefreshRate
    )
}
catch {
    @()
}
$powerPlan = try {
    (& powercfg /getactivescheme 2>$null) -join " "
}
catch {
    "unknown"
}
$metadata = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    machine = $env:COMPUTERNAME
    processor = $processor
    os = [Environment]::OSVersion.VersionString
    architecture = $Platform
    configuration = $Configuration
    scenario = $Scenario
    node = (& $nodePath --version).Trim()
    dotnet = (& $dotnet --version).Trim()
    jsxCommit = Git-Revision $repoRoot
    reactorCommit = Git-Revision $ReactorRoot
    duration = $Duration
    warmup = $Warmup
    reps = $Reps
    percents = $Percents
    includeEtw = [bool]$IncludeEtw
    powerPlan = $powerPlan
    refreshRates = $refreshRates
}
$summary = [ordered]@{
    protocol = "dynwinrt-jsx.winui-comparison"
    version = 1
    metadata = $metadata
    groups = $groups
    comparisons = $comparisons
}
$summaryPath = Join-Path $OutDir "summary.json"
$summary |
    ConvertTo-Json -Depth 10 |
    Set-Content -LiteralPath $summaryPath -Encoding UTF8

Write-Host ""
Write-Host "Median results"
$groups |
    Select-Object `
        percent,
        variant,
        samples,
        @{n="renders/s";e={[Math]::Round($_.rendersPerSecMedian, 2)}},
        @{n="combined ms";e={[Math]::Round($_.avgCombinedMsMedian, 3)}},
        @{n="peak RSS MB";e={[Math]::Round($_.peakRssMBMedian, 1)}},
        @{n="window ms";e={[Math]::Round($_.windowReadyMsMedian, 1)}},
        @{n="present/s";e={[Math]::Round($_.presentPerSecMedian, 2)}} |
    Format-Table -AutoSize
Write-Host "Raw:     $rawPath"
Write-Host "Summary: $summaryPath"
