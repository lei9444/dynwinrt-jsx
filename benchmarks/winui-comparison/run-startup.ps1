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
    [int]$Warmup = 2,
    [int]$Reps = 12,
    [double]$SettleSeconds = 2,
    [switch]$SkipBuild,
    [string]$DotnetPath,
    [string]$OutDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$jsxRoot = Join-Path $PSScriptRoot "dynwinrt-jsx"
$ReactorRoot = (Resolve-Path $ReactorRoot).Path
if (-not $OutDir) {
    $OutDir = Join-Path `
        $PSScriptRoot `
        ("results\startup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
}
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$OutDir = (Resolve-Path $OutDir).Path

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) {
    $nodeCommand.Source
}
else {
    "C:\Program Files\nodejs\node.exe"
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
            throw "$FilePath exited with $LASTEXITCODE."
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
        (Join-Path $ProjectDirectory "bin") `
        -Filter "$AppName.exe" `
        -File `
        -Recurse |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $candidate) {
        throw "$AppName.exe was not found."
    }
    return $candidate.FullName
}

if (-not $SkipBuild) {
    Invoke-Checked $npmPath @("run", "build") $jsxRoot
    foreach ($project in @("BlankWinUI3", "BlankReactor")) {
        $projectPath = Join-Path `
            $ReactorRoot `
            "tests\startup_perf\$project\$project.csproj"
        Invoke-Checked $dotnet @(
            "build",
            $projectPath,
            "-c", "Release",
            "-p:Platform=$Platform",
            "--nologo"
        ) $ReactorRoot
    }
}

$directRoot = Join-Path $ReactorRoot "tests\startup_perf\BlankWinUI3"
$reactorRoot = Join-Path $ReactorRoot "tests\startup_perf\BlankReactor"
$directExe = Find-AppExecutable $directRoot "BlankWinUI3"
$reactorExe = Find-AppExecutable $reactorRoot "BlankReactor"
$variants = [ordered]@{
    Direct = @{
        FilePath = $directExe
        WorkingDirectory = Split-Path $directExe
    }
    DynWinRTJsx = @{
        FilePath = $nodePath
        WorkingDirectory = $jsxRoot
    }
    Reactor = @{
        FilePath = $reactorExe
        WorkingDirectory = Split-Path $reactorExe
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

function Invoke-StartupVariant {
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
    Remove-Item `
        $stdout,$stderr,$metricsPath `
        -Force `
        -ErrorAction SilentlyContinue
    $arguments = if ($Name -eq "DynWinRTJsx") {
        @(
            "main.js",
            "--scenario", "startup",
            "--out", $metricsPath
        )
    }
    else {
        @()
    }
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $process = Start-Process `
        -FilePath $variant.FilePath `
        -ArgumentList $arguments `
        -WorkingDirectory $variant.WorkingDirectory `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru
    $windowReadyMs = $null
    $peakRss = 0L
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while (-not $process.HasExited) {
        if ([DateTime]::UtcNow -gt $deadline) {
            Stop-Process -Id $process.Id
            throw "$Name startup timed out."
        }
        $process.Refresh()
        $peakRss = [Math]::Max(
            $peakRss,
            [int64]$process.WorkingSet64
        )
        if (
            $null -eq $windowReadyMs -and
            $process.MainWindowHandle -ne 0
        ) {
            $windowReadyMs =
                $timer.Elapsed.TotalMilliseconds
            if ($Name -ne "DynWinRTJsx") {
                Start-Sleep -Milliseconds (
                    [int]($SettleSeconds * 1000)
                )
                if (-not $process.HasExited) {
                    Stop-Process -Id $process.Id
                }
            }
        }
        Start-Sleep -Milliseconds 10
    }
    $process.WaitForExit()
    $timer.Stop()
    $internal = if (Test-Path $metricsPath) {
        Get-Content $metricsPath -Raw |
            ConvertFrom-Json
    }
    else {
        $null
    }
    $firstFrameMs = if ($internal) {
        $internal.firstFrameMs
    } else { $null }
    $interactiveMs = if ($internal) {
        $internal.interactiveMs
    } else { $null }
    $moduleEnteredMs = if ($internal) {
        $internal.moduleEnteredMs
    } else { $null }
    $record = [ordered]@{
        variant = $Name
        round = $Round
        warmup = $WarmupRun
        order = $OrderIndex
        processToWindowMs = $windowReadyMs
        wallMs = $timer.Elapsed.TotalMilliseconds
        peakRssMB = $peakRss / 1MB
        firstFrameMs = $firstFrameMs
        interactiveMs = $interactiveMs
        moduleEnteredMs = $moduleEnteredMs
    }
    Add-Content `
        $rawPath `
        ($record | ConvertTo-Json -Compress) `
        -Encoding UTF8
    Write-Host (
        "  {0,-12} window={1,8:N1} ms rss={2,7:N1} MB" -f
        $Name,
        [double]$windowReadyMs,
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
            (Invoke-StartupVariant `
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
    $valuesArray = @($Values | Sort-Object)
    if ($valuesArray.Count -eq 0) { return 0 }
    $middle = [int][Math]::Floor(
        $valuesArray.Count / 2
    )
    if ($valuesArray.Count % 2) {
        return [double]$valuesArray[$middle]
    }
    return (
        [double]$valuesArray[$middle - 1] +
        [double]$valuesArray[$middle]
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
        processToWindowMsMedian = Median @(
            $samples | ForEach-Object {
                [double]$_.processToWindowMs
            }
        )
        peakRssMBMedian = Median @(
            $samples | ForEach-Object {
                [double]$_.peakRssMB
            }
        )
        firstFrameMsMedian = Median @(
            $samples | ForEach-Object {
                if ($null -eq $_.firstFrameMs) {
                    0
                } else {
                    [double]$_.firstFrameMs
                }
            }
        )
        interactiveMsMedian = Median @(
            $samples | ForEach-Object {
                if ($null -eq $_.interactiveMs) {
                    0
                } else {
                    [double]$_.interactiveMs
                }
            }
        )
    }
}
$summary = [ordered]@{
    protocol = "dynwinrt-jsx.winui-startup"
    version = 1
    generatedAt =
        (Get-Date).ToUniversalTime().ToString("o")
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
        @{n="window ms";e={[Math]::Round($_.processToWindowMsMedian, 1)}},
        @{n="peak RSS MB";e={[Math]::Round($_.peakRssMBMedian, 1)}},
        @{n="internal frame ms";e={[Math]::Round($_.firstFrameMsMedian, 1)}} `
        -AutoSize
Write-Host "Raw:     $rawPath"
Write-Host "Summary: $summaryPath"
