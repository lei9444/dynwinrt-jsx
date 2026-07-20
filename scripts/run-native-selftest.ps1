#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$NodePath,
    [string]$TypeScriptPath,
    [string]$OutputDirectory,
    [int]$TimeoutMilliseconds = 60000,
    [switch]$SkipBuild,
    [switch]$SkipFailureProbes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$dashboardRoot = Join-Path $repoRoot "examples\dashboard"
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $dashboardRoot ".winapp\native-selftest"
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
    $candidates += Join-Path $env:ProgramFiles "nodejs\node.exe"
    $candidates += Join-Path $env:ProgramFiles "Microsoft Visual Studio\2022\Enterprise\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe"

    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (-not (Test-Path $candidate)) {
            continue
        }
        $metadata = (& $candidate -p "process.arch + '|' + process.versions.node.split('.')[0]").Trim().Split("|")
        if (
            $LASTEXITCODE -eq 0 -and
            $metadata.Count -eq 2 -and
            $metadata[0] -eq "x64" -and
            [int]$metadata[1] -ge 20
        ) {
            return [IO.Path]::GetFullPath($candidate)
        }
    }
    throw "An x64 Node.js 20+ executable is required. Pass -NodePath."
}

function Resolve-TypeScript([string]$RequestedPath) {
    $candidates = @()
    if ($RequestedPath) {
        $candidates += $RequestedPath
    }
    $candidates += Join-Path $repoRoot "node_modules\typescript\bin\tsc"
    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (Test-Path $candidate) {
            return [IO.Path]::GetFullPath($candidate)
        }
    }
    throw "A local TypeScript compiler is required. Pass -TypeScriptPath."
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

function Invoke-TypeScript([string]$Project) {
    & $NodePath $TypeScriptPath "-p" $Project
    if ($LASTEXITCODE -ne 0) {
        throw "TypeScript compilation failed for $Project."
    }
}

function Invoke-Probe(
    [string]$Name,
    [string]$FailureMode = ""
) {
    $stdoutPath = Join-Path $OutputDirectory "$Name.stdout.log"
    $stderrPath = Join-Path $OutputDirectory "$Name.stderr.log"
    $statePath = Join-Path $OutputDirectory "$Name.state.json"
    Remove-Item $stdoutPath, $stderrPath, $statePath -Force -ErrorAction SilentlyContinue

    $oldSelfTest = $env:DYNWINRT_JSX_SELFTEST
    $oldFailure = $env:DYNWINRT_JSX_SELFTEST_FAILURE
    $oldStatePath = $env:DYNWINRT_JSX_STATE_PATH
    $process = $null
    try {
        $env:DYNWINRT_JSX_SELFTEST = "1"
        $env:DYNWINRT_JSX_STATE_PATH = $statePath
        if ($FailureMode) {
            $env:DYNWINRT_JSX_SELFTEST_FAILURE = $FailureMode
        }
        else {
            Remove-Item Env:DYNWINRT_JSX_SELFTEST_FAILURE -ErrorAction SilentlyContinue
        }

        $process = Start-Process `
            -FilePath $NodePath `
            -ArgumentList ".\main.js" `
            -WorkingDirectory $dashboardRoot `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath `
            -PassThru

        if (-not $process.WaitForExit($TimeoutMilliseconds)) {
            throw "Native selftest probe '$Name' timed out."
        }
        return [ordered]@{
            name = $Name
            exitCode = $process.ExitCode
            stdout = Read-SharedText $stdoutPath
            stderr = Read-SharedText $stderrPath
            stdoutPath = $stdoutPath
            stderrPath = $stderrPath
        }
    }
    finally {
        $env:DYNWINRT_JSX_SELFTEST = $oldSelfTest
        $env:DYNWINRT_JSX_SELFTEST_FAILURE = $oldFailure
        $env:DYNWINRT_JSX_STATE_PATH = $oldStatePath
        if ($process) {
            $process.Refresh()
            if (-not $process.HasExited) {
                Stop-Process -Id $process.Id -Force
            }
        }
    }
}

$NodePath = Resolve-Node $NodePath
$TypeScriptPath = Resolve-TypeScript $TypeScriptPath
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

if (-not $SkipBuild) {
    Invoke-TypeScript (Join-Path $repoRoot "tsconfig.json")
    Invoke-TypeScript (Join-Path $dashboardRoot "tsconfig.json")
}

$summaryPath = Join-Path $OutputDirectory "summary.json"
$summary = [ordered]@{
    startedAt = [DateTime]::UtcNow.ToString("o")
    passed = $false
    node = (& $NodePath --version).Trim()
    success = $null
    assertionFailure = $null
    workerFailure = $null
}

try {
    $successProbe = Invoke-Probe "success"
    $combined = "$($successProbe.stdout)`n$($successProbe.stderr)"
    $marker = @(
        $combined -split "\r?\n" |
            Where-Object { $_.StartsWith("DYNWINRT_JSX_NATIVE_SELFTEST ") }
    )
    if ($successProbe.exitCode -ne 0) {
        throw "Native selftest exited with code $($successProbe.exitCode)."
    }
    if ($marker.Count -ne 1) {
        throw "Expected one native selftest result marker, found $($marker.Count)."
    }
    $result = $marker[0].Substring(
        "DYNWINRT_JSX_NATIVE_SELFTEST ".Length
    ) | ConvertFrom-Json
    if (-not $result.passed) {
        throw "Native selftest cases failed."
    }
    if (
        [int]$result.diagnostics.activeNative -ne 0 -or
        [int]$result.diagnostics.activeComponents -ne 0
    ) {
        throw "Native selftest renderer did not return to zero."
    }
    $summary.success = [ordered]@{
        exitCode = $successProbe.exitCode
        result = $result
        stdoutPath = $successProbe.stdoutPath
        stderrPath = $successProbe.stderrPath
    }

    if (-not $SkipFailureProbes) {
        $assertionProbe = Invoke-Probe "assertion-failure" "assertion"
        $assertionOutput = "$($assertionProbe.stdout)`n$($assertionProbe.stderr)"
        $assertionMarker = @(
            $assertionOutput -split "\r?\n" |
                Where-Object { $_.StartsWith("DYNWINRT_JSX_NATIVE_SELFTEST ") }
        )
        if ($assertionProbe.exitCode -eq 0) {
            throw "Intentional assertion failure exited successfully."
        }
        if ($assertionMarker.Count -ne 1) {
            throw "Expected one assertion-failure result marker, found $($assertionMarker.Count)."
        }
        $assertionResult = $assertionMarker[0].Substring(
            "DYNWINRT_JSX_NATIVE_SELFTEST ".Length
        ) | ConvertFrom-Json
        if ($assertionResult.passed) {
            throw "Intentional assertion failure reported success."
        }
        $intentionalCase = @(
            $assertionResult.cases |
                Where-Object { $_.name -eq "intentional-assertion-failure" }
        )
        $failedCases = @(
            $assertionResult.cases |
                Where-Object { -not $_.passed }
        )
        if (
            $intentionalCase.Count -ne 1 -or
            $intentionalCase[0].passed -or
            $failedCases.Count -ne 1
        ) {
            throw "Intentional assertion failure case was not recorded."
        }
        if (
            [int]$assertionResult.diagnostics.activeNative -ne 0 -or
            [int]$assertionResult.diagnostics.activeComponents -ne 0
        ) {
            throw "Assertion-failure probe renderer did not return to zero."
        }
        $summary.assertionFailure = [ordered]@{
            exitCode = $assertionProbe.exitCode
            result = $assertionResult
            stdoutPath = $assertionProbe.stdoutPath
            stderrPath = $assertionProbe.stderrPath
        }

        $failureProbe = Invoke-Probe "worker-failure" "worker"
        $failureOutput = "$($failureProbe.stdout)`n$($failureProbe.stderr)"
        if ($failureProbe.exitCode -eq 0) {
            throw "Intentional Worker failure exited successfully."
        }
        if ($failureOutput -notmatch "Intentional native selftest Worker failure") {
            throw "Intentional Worker failure was not surfaced by the host."
        }
        $summary.workerFailure = [ordered]@{
            exitCode = $failureProbe.exitCode
            surfaced = $true
            stdoutPath = $failureProbe.stdoutPath
            stderrPath = $failureProbe.stderrPath
        }
    }
    $summary.passed = $true
}
finally {
    $summary.completedAt = [DateTime]::UtcNow.ToString("o")
    [IO.File]::WriteAllText(
        $summaryPath,
        "$($summary | ConvertTo-Json -Depth 12)`n"
    )
}

Write-Host "Native WinUI selftest passed."
Write-Host "Summary: $summaryPath"
