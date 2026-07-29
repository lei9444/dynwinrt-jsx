#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$ReactorRoot = (
        Join-Path $PSScriptRoot "..\..\..\microsoft-ui-reactor"
    ),
    [ValidateSet("x64", "ARM64")]
    [string]$Platform = "x64",
    [string[]]$Tests = @(
        "M1", "M2", "M3",
        "M7", "M8", "M9", "M10"
    ),
    [int]$Iterations = 100,
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
        ("results\micro-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
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
    $project = Join-Path `
        $ReactorRoot `
        "tests\perf_bench\PerfBench.ControlModel\PerfBench.ControlModel.csproj"
    Invoke-Checked $dotnet @(
        "build",
        $project,
        "-c", "Release",
        "-p:Platform=$Platform",
        "--nologo"
    ) $ReactorRoot
}

$controlRoot = Join-Path `
    $ReactorRoot `
    "tests\perf_bench\PerfBench.ControlModel"
$controlExe = Find-Exe `
    $controlRoot `
    "PerfBench.ControlModel"
$variants = @("Direct", "DynWinRTJsx", "Reactor")
$orders = @(
    @("Direct", "DynWinRTJsx", "Reactor"),
    @("Reactor", "Direct", "DynWinRTJsx"),
    @("DynWinRTJsx", "Reactor", "Direct")
)
$rawPath = Join-Path $OutDir "raw.jsonl"
Remove-Item $rawPath -Force -ErrorAction SilentlyContinue
$records = [Collections.Generic.List[object]]::new()

function Invoke-MicroVariant {
    param(
        [string]$Variant,
        [int]$Round,
        [bool]$WarmupRun,
        [int]$OrderIndex
    )
    $runId = "r$Round-o$OrderIndex-$Variant"
    $outputPath = Join-Path $OutDir "$runId.results.jsonl"
    $stdout = Join-Path $OutDir "$runId.stdout.log"
    $stderr = Join-Path $OutDir "$runId.stderr.log"
    Remove-Item `
        $outputPath,$stdout,$stderr `
        -Force `
        -ErrorAction SilentlyContinue
    if ($Variant -eq "DynWinRTJsx") {
        $process = Start-Process `
            -FilePath $nodePath `
            -ArgumentList @(
                "--expose-gc",
                "main.js",
                "--scenario", "micro",
                "--iterations", "$Iterations",
                "--reps", "1",
                "--out", $outputPath
            ) `
            -WorkingDirectory $jsxRoot `
            -RedirectStandardOutput $stdout `
            -RedirectStandardError $stderr `
            -PassThru `
            -Wait
        if ($process.ExitCode -ne 0) {
            throw "DynWinRTJsx micro exited with $($process.ExitCode)."
        }
        $payload = Get-Content $outputPath -Raw |
            ConvertFrom-Json
        $rows = @($payload.results)
    }
    else {
        $arguments = @(
            "--headless",
            "--test"
        ) + $Tests + @(
            "--variant", $Variant,
            "--iterations", "$Iterations",
            "--reps", "1",
            "--out", $outputPath
        )
        $process = Start-Process `
            -FilePath $controlExe `
            -ArgumentList $arguments `
            -WorkingDirectory (Split-Path $controlExe) `
            -RedirectStandardOutput $stdout `
            -RedirectStandardError $stderr `
            -PassThru `
            -Wait
        if ($process.ExitCode -ne 0) {
            throw "$Variant micro exited with $($process.ExitCode)."
        }
        $rows = @(
            Get-Content $outputPath |
            ForEach-Object {
                $_ | ConvertFrom-Json
            }
        )
    }
    foreach ($row in $rows) {
        $record = [ordered]@{
            variant = $Variant
            round = $Round
            warmup = $WarmupRun
            order = $OrderIndex
            benchId = $row.benchId
            benchName = $row.benchName
            iterations = $row.iterations
            meanNs = $row.meanNs
            allocationPerOp = if (
                $Variant -eq "DynWinRTJsx"
            ) {
                [double]$row.heapDeltaBytes /
                [Math]::Max(1, [int]$row.iterations)
            }
            else {
                [double]$row.allocBytes /
                [Math]::Max(1, [int]$row.iterations)
            }
            allocationKind = if (
                $Variant -eq "DynWinRTJsx"
            ) {
                "V8HeapDelta"
            }
            else {
                "ManagedAllocatedBytes"
            }
        }
        $records.Add($record)
        Add-Content `
            $rawPath `
            ($record | ConvertTo-Json -Compress) `
            -Encoding UTF8
    }
    Write-Host "  $Variant completed $($rows.Count) benches"
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
        Invoke-MicroVariant `
            $order[$index] `
            $round `
            $warmupRun `
            $index
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
$groups = foreach ($test in $Tests) {
    foreach ($variant in $variants) {
        $samples = @(
            $measured |
            Where-Object {
                $_.benchId -eq $test -and
                $_.variant -eq $variant
            }
        )
        $firstSample = if ($samples.Count -gt 0) {
            $samples[0]
        } else {
            $null
        }
        [pscustomobject][ordered]@{
            benchId = $test
            benchName = if ($firstSample) {
                $firstSample.benchName
            } else { "" }
            variant = $variant
            samples = $samples.Count
            meanNsMedian = Median @(
                $samples | ForEach-Object {
                    [double]$_.meanNs
                }
            )
            allocationPerOpMedian = Median @(
                $samples | ForEach-Object {
                    [double]$_.allocationPerOp
                }
            )
            allocationKind = if ($firstSample) {
                $firstSample.allocationKind
            } else { "" }
        }
    }
}
$summary = [ordered]@{
    protocol = "dynwinrt-jsx.winui-control-model"
    version = 1
    tests = $Tests
    iterations = $Iterations
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
        benchId,
        variant,
        samples,
        @{n="median ns/op";e={[Math]::Round($_.meanNsMedian, 1)}},
        @{n="alloc/heap delta per op";e={[Math]::Round($_.allocationPerOpMedian, 1)}},
        allocationKind `
        -AutoSize
Write-Host "Raw:     $rawPath"
Write-Host "Summary: $summaryPath"
