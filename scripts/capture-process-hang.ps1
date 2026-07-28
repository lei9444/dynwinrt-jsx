#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [int]$ProcessId,
    [Parameter(Mandatory)]
    [string]$OutputDirectory,
    [string]$CdbPath,
    [ValidateRange(5, 300)]
    [int]$TimeoutSeconds = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$summaryPath = Join-Path $OutputDirectory "capture.json"
$stdoutPath = Join-Path $OutputDirectory "cdb.stdout.log"
$stderrPath = Join-Path $OutputDirectory "cdb.stderr.log"
$processPath = Join-Path $OutputDirectory "process.json"

function Write-CaptureSummary(
    [string]$Status,
    [string]$Reason,
    [string]$ResolvedCdbPath = "",
    [Nullable[int]]$ExitCode = $null
) {
    $summary = [ordered]@{
        protocol = "dynwinrt-jsx.hang-capture"
        version = 1
        capturedAt = [DateTime]::UtcNow.ToString("o")
        processId = $ProcessId
        status = $Status
        reason = $Reason
        cdbPath = if ($ResolvedCdbPath) {
            $ResolvedCdbPath
        }
        else {
            $null
        }
        exitCode = $ExitCode
        stdoutPath = if (Test-Path $stdoutPath) {
            $stdoutPath
        }
        else {
            $null
        }
        stderrPath = if (Test-Path $stderrPath) {
            $stderrPath
        }
        else {
            $null
        }
        processPath = if (Test-Path $processPath) {
            $processPath
        }
        else {
            $null
        }
    }
    [IO.File]::WriteAllText(
        $summaryPath,
        "$($summary | ConvertTo-Json -Depth 5)`n"
    )
}

$target = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
if (-not $target) {
    Write-CaptureSummary "skipped" "The target process is no longer running."
    Write-Output $summaryPath
    return
}

$target.Refresh()
[IO.File]::WriteAllText(
    $processPath,
    "$([ordered]@{
        processId = $target.Id
        processName = $target.ProcessName
        startTime = $target.StartTime.ToUniversalTime().ToString("o")
        capturedAt = [DateTime]::UtcNow.ToString("o")
        responding = $target.Responding
        workingSetBytes = [long]$target.WorkingSet64
        privateMemoryBytes = [long]$target.PrivateMemorySize64
        handleCount = [int]$target.HandleCount
        threadCount = [int]$target.Threads.Count
        cpuSeconds = [Math]::Round(
            $target.TotalProcessorTime.TotalSeconds,
            3
        )
    } | ConvertTo-Json -Depth 5)`n"
)

$candidates = @()
if ($CdbPath) {
    $candidates += $CdbPath
}
$command = Get-Command cdb.exe -ErrorAction SilentlyContinue
if ($command) {
    $candidates += $command.Source
}
$candidates += @(
    (Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\Debuggers\x64\cdb.exe"),
    (Join-Path $env:ProgramFiles "Windows Kits\10\Debuggers\x64\cdb.exe")
)
$resolvedCdb = $candidates |
    Where-Object { $_ -and (Test-Path $_) } |
    Select-Object -First 1

if (-not $resolvedCdb) {
    Write-CaptureSummary `
        "skipped" `
        "cdb.exe was not found; process metadata was captured."
    Write-Output $summaryPath
    return
}

Remove-Item $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
$debugger = $null
try {
    $debuggerArguments = (
        "-pv -p {0} -c `"{1}`"" -f
            $ProcessId,
            ".symfix;.reload;~* kb;!analyze -hang;qd"
    )
    $debugger = Start-Process `
        -FilePath $resolvedCdb `
        -ArgumentList $debuggerArguments `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -PassThru
    try {
        Wait-Process -Id $debugger.Id -Timeout $TimeoutSeconds
    }
    catch {
        if (Get-Process -Id $debugger.Id -ErrorAction SilentlyContinue) {
            Stop-Process -Id $debugger.Id -Force
        }
        Write-CaptureSummary `
            "failed" `
            "cdb.exe did not finish within $TimeoutSeconds seconds." `
            $resolvedCdb
        Write-Output $summaryPath
        return
    }
    $debugger.Refresh()
    if ($debugger.ExitCode -ne 0) {
        Write-CaptureSummary `
            "failed" `
            "cdb.exe exited with a non-zero code." `
            $resolvedCdb `
            $debugger.ExitCode
        Write-Output $summaryPath
        return
    }
    Write-CaptureSummary `
        "captured" `
        "All thread stacks and hang analysis were captured." `
        $resolvedCdb `
        $debugger.ExitCode
}
catch {
    Write-CaptureSummary `
        "failed" `
        $_.Exception.Message `
        $resolvedCdb
}

Write-Output $summaryPath
