#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PackagePath,
    [string]$OutputDirectory,
    [int]$TimeoutMilliseconds = 120000,
    [switch]$KeepInstalled
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$packageName = "DynWinRTJSXDashboard"
$PackagePath = (Resolve-Path $PackagePath -ErrorAction Stop).Path
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path `
        (Split-Path $PackagePath -Parent) `
        "clean-machine-$([DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss-fff"))"
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$stdoutPath = Join-Path $OutputDirectory "stdout.log"
$stderrPath = Join-Path $OutputDirectory "stderr.log"
$statePath = Join-Path $OutputDirectory "dashboard-state.json"
$summaryPath = Join-Path $OutputDirectory "summary.json"

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

if (Get-AppxPackage -Name $packageName) {
    throw "$packageName is already installed. Run this gate on a clean machine."
}

$installedByRun = $false
$process = $null
$failureMessage = $null
$result = $null

try {
    Add-AppxPackage -Path $PackagePath
    $installedByRun = $true

    $package = Get-AppxPackage -Name $packageName
    if (-not $package) {
        throw "$packageName was not found after installation."
    }

    $executable = Join-Path `
        $package.InstallLocation `
        "DynWinRTJSXDashboard.exe"
    $previousSelfTest = $env:DYNWINRT_JSX_SELFTEST
    $previousStatePath = $env:DYNWINRT_JSX_STATE_PATH
    try {
        $env:DYNWINRT_JSX_SELFTEST = "1"
        $env:DYNWINRT_JSX_STATE_PATH = $statePath
        $process = Start-Process `
            -FilePath $executable `
            -WorkingDirectory $package.InstallLocation `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath `
            -PassThru
    }
    finally {
        $env:DYNWINRT_JSX_SELFTEST = $previousSelfTest
        $env:DYNWINRT_JSX_STATE_PATH = $previousStatePath
    }

    if (-not $process.WaitForExit($TimeoutMilliseconds)) {
        throw "Packaged native selftest timed out after $TimeoutMilliseconds ms."
    }
    if ($process.ExitCode -ne 0) {
        throw "Packaged native selftest exited with code $($process.ExitCode)."
    }

    $stdout = Get-Content -LiteralPath $stdoutPath -Raw
    $stderr = Get-Content -LiteralPath $stderrPath -Raw
    if (-not [string]::IsNullOrWhiteSpace($stderr)) {
        throw "Packaged native selftest wrote to stderr: $stderr"
    }

    $markers = @(
        $stdout -split "\r?\n" |
            Where-Object {
                $_.StartsWith("DYNWINRT_JSX_NATIVE_SELFTEST ")
            }
    )
    if ($markers.Count -ne 1) {
        throw "Expected one native selftest marker, found $($markers.Count)."
    }

    $result = $markers[0].Substring(
        "DYNWINRT_JSX_NATIVE_SELFTEST ".Length
    ) | ConvertFrom-Json
    if (-not $result.passed) {
        throw "Packaged native selftest reported failed cases."
    }
    if (
        [int]$result.diagnostics.activeNative -ne 0 -or
        [int]$result.diagnostics.activeComponents -ne 0
    ) {
        throw "Packaged native selftest did not return renderer diagnostics to zero."
    }
}
catch {
    $failureMessage = $_.Exception.ToString()
    throw
}
finally {
    if ($process) {
        $process.Refresh()
        if (-not $process.HasExited) {
            Stop-Process -Id $process.Id -Force
        }
    }

    $installed = Get-AppxPackage -Name $packageName
    $windowsAppRuntime = Get-AppxPackage -Name "Microsoft.WindowsAppRuntime.2" |
        Where-Object Architecture -eq "X64" |
        Sort-Object Version -Descending |
        Select-Object -First 1
    $vcRuntime = Get-AppxPackage -Name "Microsoft.VCLibs.140.00.UWPDesktop" |
        Where-Object Architecture -eq "X64" |
        Sort-Object Version -Descending |
        Select-Object -First 1
    $operatingSystem = Get-CimInstance Win32_OperatingSystem

    $summary = [ordered]@{
        passed = $null -eq $failureMessage
        packagePath = $PackagePath
        packageFullName = if ($installed) {
            $installed.PackageFullName
        }
        else {
            $null
        }
        windows = [ordered]@{
            caption = $operatingSystem.Caption
            version = $operatingSystem.Version
            buildNumber = $operatingSystem.BuildNumber
            architecture = $operatingSystem.OSArchitecture
        }
        dependencies = [ordered]@{
            windowsAppRuntime = if ($windowsAppRuntime) {
                $windowsAppRuntime.PackageFullName
            }
            else {
                $null
            }
            vcRuntime = if ($vcRuntime) {
                $vcRuntime.PackageFullName
            }
            else {
                $null
            }
        }
        nativeSelfTest = $result
        stdoutPath = $stdoutPath
        stderrPath = $stderrPath
        error = $failureMessage
    }
    $summary |
        ConvertTo-Json -Depth 12 |
        Set-Content -LiteralPath $summaryPath -Encoding UTF8

    if ($installedByRun -and -not $KeepInstalled) {
        $package = Get-AppxPackage -Name $packageName
        if ($package) {
            Remove-AppxPackage -Package $package.PackageFullName
        }
    }
}

Write-Output "Clean-machine summary: $summaryPath"
