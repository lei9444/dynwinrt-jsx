#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$ReactorRoot = (
        Join-Path $PSScriptRoot "..\..\..\microsoft-ui-reactor"
    ),
    [ValidateSet("x64", "ARM64")]
    [string]$Platform = "x64",
    [int]$Count = 5000,
    [int]$Duration = 5,
    [switch]$WithEdits,
    [int]$EditsPerSecond = 4,
    [int]$Warmup = 1,
    [int]$Reps = 5,
    [switch]$SkipBuild,
    [string]$DotnetPath,
    [string]$OutDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$jsxRoot = Join-Path $PSScriptRoot "dynwinrt-jsx"
$ReactorRoot = (Resolve-Path $ReactorRoot).Path
if (-not $OutDir) {
    $OutDir = Join-Path `
        $PSScriptRoot `
        ("results\virtual-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
}
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$OutDir = (Resolve-Path $OutDir).Path
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) {
    $nodeCommand.Source
} else {
    "C:\Program Files\nodejs\node.exe"
}
$npmPath = Join-Path (Split-Path $nodePath) "npm.cmd"
$dotnet = if ($DotnetPath) {
    (Resolve-Path $DotnetPath).Path
} else {
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
            throw "$FilePath exited with $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

function Find-Exe {
    param([string]$Root, [string]$Name)
    $file = Get-ChildItem `
        (Join-Path $Root "bin") `
        -Filter "$Name.exe" `
        -File `
        -Recurse |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $file) {
        throw "$Name.exe was not found."
    }
    return $file.FullName
}

if (-not $SkipBuild) {
    Invoke-Checked $npmPath @("run", "build") $jsxRoot
    foreach ($project in @(
        "StressPerf.VirtualList.WinUI",
        "StressPerf.VirtualList.Reactor"
    )) {
        Invoke-Checked $dotnet @(
            "build",
            (Join-Path $ReactorRoot "tests\stress_perf\$project\$project.csproj"),
            "-c", "Release",
            "-p:Platform=$Platform",
            "--nologo"
        ) $ReactorRoot
    }
}

$directRoot = Join-Path $ReactorRoot "tests\stress_perf\StressPerf.VirtualList.WinUI"
$reactorRoot = Join-Path $ReactorRoot "tests\stress_perf\StressPerf.VirtualList.Reactor"
$directExe = Find-Exe $directRoot "StressPerf.VirtualList.WinUI"
$reactorExe = Find-Exe $reactorRoot "StressPerf.VirtualList.Reactor"
$variants = [ordered]@{
    Direct = @{
        FilePath = $directExe
        WorkingDirectory = Split-Path $directExe
        AppName = "StressPerf.VirtualList.WinUI"
    }
    DynWinRTJsx = @{
        FilePath = $nodePath
        WorkingDirectory = $jsxRoot
        AppName = "DynWinRTJsx.VirtualList"
    }
    Reactor = @{
        FilePath = $reactorExe
        WorkingDirectory = Split-Path $reactorExe
        AppName = "StressPerf.VirtualList.Reactor"
    }
}
$orders = @(
    @("Direct", "DynWinRTJsx", "Reactor"),
    @("Reactor", "Direct", "DynWinRTJsx"),
    @("DynWinRTJsx", "Reactor", "Direct")
)
$rawPath = Join-Path $OutDir "raw.jsonl"
Remove-Item $rawPath -Force -ErrorAction SilentlyContinue
$records = [Collections.Generic.List[object]]::new()

function Report-Number {
    param([string]$Text, [string]$Label)
    $match = [regex]::Match(
        $Text,
        "(?m)^$([regex]::Escape($Label))\s*:\s*([0-9.+-]+)"
    )
    if (-not $match.Success) { return 0.0 }
    return [double]::Parse(
        $match.Groups[1].Value,
        [Globalization.CultureInfo]::InvariantCulture
    )
}

function Invoke-Variant {
    param(
        [string]$Name,
        [int]$Round,
        [bool]$WarmupRun,
        [int]$OrderIndex
    )
    $variant = $variants[$Name]
    $runId = "r$Round-o$OrderIndex-$Name"
    $stdout = Join-Path $OutDir "$runId.stdout.log"
    $stderr = Join-Path $OutDir "$runId.stderr.log"
    $metricsPath = Join-Path $OutDir "$runId.metrics.json"
    $reportPath = Join-Path `
        $variant.WorkingDirectory `
        "$($variant.AppName).report.txt"
    Remove-Item `
        $stdout,$stderr,$metricsPath,$reportPath `
        -Force `
        -ErrorAction SilentlyContinue
    $arguments = if ($Name -eq "DynWinRTJsx") {
        @(
            "main.js",
            "--scenario", "virtual-list",
            "--count", "$Count",
            "--duration", "$Duration",
            "--edits-per-second", "$EditsPerSecond",
            "--out", $metricsPath
        ) + $(if ($WithEdits) { @("--with-edits") } else { @() })
    }
    else {
        @(
            "--headless",
            "--count", "$Count",
            "--duration", "$Duration",
            "--edits-per-second", "$EditsPerSecond"
        ) + $(if ($WithEdits) { @("--with-edits") } else { @() })
    }
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $process = Start-Process `
        -FilePath $variant.FilePath `
        -ArgumentList $arguments `
        -WorkingDirectory $variant.WorkingDirectory `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru
    $peakRss = 0L
    $windowReady = $null
    $deadline = [DateTime]::UtcNow.AddSeconds($Duration + 60)
    while (-not $process.HasExited) {
        if ([DateTime]::UtcNow -gt $deadline) {
            Stop-Process -Id $process.Id
            throw "$Name virtual list timed out."
        }
        $process.Refresh()
        $peakRss = [Math]::Max(
            $peakRss,
            [int64]$process.WorkingSet64
        )
        if (
            $null -eq $windowReady -and
            $process.MainWindowHandle -ne 0
        ) {
            $windowReady =
                $timer.Elapsed.TotalMilliseconds
        }
        Start-Sleep -Milliseconds 100
    }
    $process.WaitForExit()
    $timer.Stop()
    if ($process.ExitCode -ne 0) {
        throw "$Name exited with $($process.ExitCode)."
    }
    $metrics = if ($Name -eq "DynWinRTJsx") {
        Get-Content $metricsPath -Raw |
            ConvertFrom-Json -AsHashtable
    }
    else {
        $report = Get-Content $reportPath -Raw
        [ordered]@{
            app = $variant.AppName
            count = [int](Report-Number $report "Count")
            edits = [int](Report-Number $report "Edits")
            frames = [int](Report-Number $report "Frames")
            avgFrameMs = Report-Number $report "Avg dt"
            p50FrameMs = Report-Number $report "P50 dt"
            p95FrameMs = Report-Number $report "P95 dt"
            p99FrameMs = Report-Number $report "P99 dt"
            peakMemoryMB = Report-Number $report "PeakWS"
        }
    }
    $record = [ordered]@{
        variant = $Name
        round = $Round
        warmup = $WarmupRun
        order = $OrderIndex
        wallMs = $timer.Elapsed.TotalMilliseconds
        windowReadyMs = $windowReady
        externalPeakRssMB = $peakRss / 1MB
        metrics = $metrics
    }
    Add-Content `
        $rawPath `
        ($record | ConvertTo-Json -Depth 6 -Compress) `
        -Encoding UTF8
    Write-Host (
        "  {0,-12} frames={1,4} p95={2,7:N2} ms rss={3,7:N1} MB" -f
        $Name,
        [int]$metrics.frames,
        [double]$metrics.p95FrameMs,
        ($peakRss / 1MB)
    )
    return $record
}

$roundCount = $Warmup + $Reps
for ($round = 0; $round -lt $roundCount; $round += 1) {
    $warmupRun = $round -lt $Warmup
    $order = $orders[$round % $orders.Count]
    Write-Host (
        "Round {0}/{1} ({2})" -f
        ($round + 1),
        $roundCount,
        $(if ($warmupRun) { "warmup" } else { "measured" })
    )
    for ($index = 0; $index -lt $order.Count; $index += 1) {
        $records.Add(
            (Invoke-Variant `
                $order[$index] `
                $round `
                $warmupRun `
                $index)
        )
        Start-Sleep -Milliseconds 250
    }
}

function Median {
    param([double[]]$Values)
    $sorted = @($Values | Sort-Object)
    if ($sorted.Count -eq 0) { return 0 }
    $middle = [int][Math]::Floor($sorted.Count / 2)
    if ($sorted.Count % 2) {
        return [double]$sorted[$middle]
    }
    return (
        [double]$sorted[$middle - 1] +
        [double]$sorted[$middle]
    ) / 2
}

$measured = @($records | Where-Object { -not $_.warmup })
$groups = foreach ($name in $variants.Keys) {
    $samples = @(
        $measured |
        Where-Object { $_.variant -eq $name }
    )
    [pscustomobject][ordered]@{
        variant = $name
        samples = $samples.Count
        framesMedian = Median @(
            $samples | ForEach-Object {
                [double]$_.metrics.frames
            }
        )
        p50FrameMsMedian = Median @(
            $samples | ForEach-Object {
                [double]$_.metrics.p50FrameMs
            }
        )
        p95FrameMsMedian = Median @(
            $samples | ForEach-Object {
                [double]$_.metrics.p95FrameMs
            }
        )
        p99FrameMsMedian = Median @(
            $samples | ForEach-Object {
                [double]$_.metrics.p99FrameMs
            }
        )
        peakRssMBMedian = Median @(
            $samples | ForEach-Object {
                [double]$_.externalPeakRssMB
            }
        )
    }
}
$summary = [ordered]@{
    protocol = "dynwinrt-jsx.winui-virtual-list"
    version = 1
    count = $Count
    duration = $Duration
    withEdits = [bool]$WithEdits
    editsPerSecond = $EditsPerSecond
    warmup = $Warmup
    reps = $Reps
    groups = $groups
}
$summaryPath = Join-Path $OutDir "summary.json"
$summary |
    ConvertTo-Json -Depth 8 |
    Set-Content $summaryPath -Encoding UTF8
$groups |
    Format-Table `
        variant,
        samples,
        @{n="frames";e={$_.framesMedian}},
        @{n="p50 ms";e={[Math]::Round($_.p50FrameMsMedian, 2)}},
        @{n="p95 ms";e={[Math]::Round($_.p95FrameMsMedian, 2)}},
        @{n="peak RSS MB";e={[Math]::Round($_.peakRssMBMedian, 1)}} `
        -AutoSize
Write-Host "Raw:     $rawPath"
Write-Host "Summary: $summaryPath"
