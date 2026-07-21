#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [ValidatePattern("^\d+\.\d+\.\d+\.\d+$")]
    [string]$BaseVersion = "1.0.20.0",
    [ValidatePattern("^\d+\.\d+\.\d+\.\d+$")]
    [string]$UpgradeVersion = "1.0.21.0",
    [string]$Publisher = "CN=DynWinRTJSXDev",
    [string]$CertificatePath,
    [string]$CertificatePassword = $env:DYNWINRT_JSX_CERT_PASSWORD,
    [string]$WinAppPath,
    [switch]$InstallCertificate,
    [switch]$SkipBuild,
    [switch]$RequireCleanSources,
    [switch]$KeepUpgradeInstalled
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([Version]$UpgradeVersion -le [Version]$BaseVersion) {
    throw "UpgradeVersion must be greater than BaseVersion."
}

$dashboardRoot = Split-Path $PSScriptRoot -Parent
$packageScript = Join-Path $PSScriptRoot "package-sea.ps1"
$stateRoot = Join-Path $dashboardRoot ".winapp\sea-package"
$artifactRoot = Join-Path $stateRoot "artifacts"
$runId = "run-$([DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss-fff"))"
$runRoot = Join-Path $stateRoot "servicing\$runId"
$externalStateRoot = Join-Path `
    $env:LOCALAPPDATA `
    "dynwinrt-jsx\servicing\$runId"
$statePath = Join-Path $externalStateRoot "dashboard-state.json"
$stateEvidencePath = Join-Path $runRoot "dashboard-state.json"
$summaryPath = Join-Path $runRoot "summary.json"
$taskTitle = "MSIX servicing $runId"
$packageName = "DynWinRTJSXDashboard"
$applicationId = "dynWinRTJSXDashboard"

if (-not $CertificatePassword) {
    $CertificatePassword = "password"
}

function Invoke-WinApp([string[]]$Arguments) {
    & $script:resolvedWinApp @Arguments | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "winapp $($Arguments -join " ") failed with exit code $LASTEXITCODE."
    }
}

function Resolve-WinAppExecutable {
    if ($WinAppPath) {
        return (Resolve-Path $WinAppPath -ErrorAction Stop).Path
    }

    $command = Get-Command winapp -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $sibling = [IO.Path]::GetFullPath(
        (Join-Path $dashboardRoot "..\..\..\winappCli\src\winapp-npm\bin\win-x64\winapp.exe")
    )
    if (Test-Path $sibling) {
        return $sibling
    }

    throw "winapp CLI was not found. Pass -WinAppPath or build the sibling winappCli repository."
}

function Get-Sha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    try {
        $sha256 = [Security.Cryptography.SHA256]::Create()
        try {
            return (
                [BitConverter]::ToString($sha256.ComputeHash($stream)).
                    Replace("-", "").
                    ToLowerInvariant()
            )
        }
        finally {
            $sha256.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

function Get-PackagePath([string]$Version) {
    return Join-Path `
        $artifactRoot `
        "DynWinRTJSXDashboard_${Version}_x64_sea.msix"
}

function Get-ProvenancePath([string]$Version) {
    return Join-Path `
        $artifactRoot `
        "DynWinRTJSXDashboard_${Version}_x64_sea.provenance.json"
}

function Build-Package([string]$Version) {
    $arguments = @{
        Version = $Version
        Publisher = $Publisher
        CertificatePassword = $CertificatePassword
        WinAppPath = $script:resolvedWinApp
    }
    if ($CertificatePath) {
        $arguments.CertificatePath = $CertificatePath
    }
    if ($RequireCleanSources) {
        $arguments.RequireCleanSources = $true
    }

    & $packageScript @arguments | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "SEA packaging failed for version $Version."
    }
}

function Assert-Provenance(
    [string]$Version,
    [string]$PackagePath
) {
    $provenancePath = Get-ProvenancePath $Version
    if (-not (Test-Path $provenancePath)) {
        throw "Provenance was not generated for version $Version."
    }

    $provenance = Get-Content -LiteralPath $provenancePath -Raw |
        ConvertFrom-Json
    if ($provenance.package.version -ne $Version) {
        throw "Provenance version mismatch for $Version."
    }
    if ($provenance.package.sha256 -ne (Get-Sha256 $PackagePath)) {
        throw "Provenance SHA256 mismatch for $Version."
    }
}

function Install-PackageVersion(
    [string]$Version,
    [string]$PackagePath
) {
    Add-AppxPackage `
        -Path $PackagePath `
        -ForceApplicationShutdown `
        -ForceUpdateFromAnyVersion

    $installed = Get-AppxPackage -Name $packageName
    if (-not $installed) {
        throw "Package $packageName was not found after installing $Version."
    }
    if ($installed.Version.ToString() -ne $Version) {
        throw "Expected installed version $Version, received $($installed.Version)."
    }
    return $installed
}

function Remove-InstalledPackage {
    $installed = Get-AppxPackage -Name $packageName
    if (-not $installed) {
        return
    }

    Remove-AppxPackage -Package $installed.PackageFullName
    if (Get-AppxPackage -Name $packageName) {
        throw "Package $packageName remained installed after removal."
    }
}

function Wait-ForWindow(
    [Diagnostics.Process]$Process,
    [int]$TimeoutMilliseconds = 15000
) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $Process.Refresh()
        if ($Process.HasExited) {
            throw "Dashboard exited during startup with code $($Process.ExitCode)."
        }

        $output = @(
            & $script:resolvedWinApp `
                "ui" "status" `
                "-a" "$($Process.Id)" `
                "--json" 2>$null
        )
        if ($LASTEXITCODE -eq 0 -and $output.Count -gt 0) {
            $status = $output -join "`n" | ConvertFrom-Json
            if ([long]$status.hwnd -ne 0) {
                return $status
            }
        }
        Start-Sleep -Milliseconds 200
    }

    throw "Dashboard window did not appear within $TimeoutMilliseconds ms."
}

function Start-Dashboard(
    [string]$Phase,
    [string]$ExpectedVersion
) {
    $installed = Get-AppxPackage -Name $packageName
    if (-not $installed) {
        throw "Cannot start $Phase because the dashboard package is not installed."
    }
    if ($installed.Version.ToString() -ne $ExpectedVersion) {
        throw "Cannot start ${Phase}: expected $ExpectedVersion, installed $($installed.Version)."
    }

    $phaseRoot = Join-Path $runRoot $Phase
    New-Item -ItemType Directory -Force -Path $phaseRoot | Out-Null
    $stdoutPath = Join-Path $phaseRoot "stdout.log"
    $stderrPath = Join-Path $phaseRoot "stderr.log"
    $executable = Join-Path $installed.InstallLocation "DynWinRTJSXDashboard.exe"

    $previousStatePath = $env:DYNWINRT_JSX_STATE_PATH
    $env:DYNWINRT_JSX_STATE_PATH = $statePath
    try {
        $process = Start-Process `
            -FilePath $executable `
            -WorkingDirectory $installed.InstallLocation `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath `
            -PassThru
    }
    finally {
        $env:DYNWINRT_JSX_STATE_PATH = $previousStatePath
    }

    $status = Wait-ForWindow $process
    $children = @(
        Get-CimInstance Win32_Process |
            Where-Object ParentProcessId -eq $process.Id
    )
    if ($children.Count -ne 0) {
        throw "$Phase created unexpected child processes."
    }

    return [pscustomobject]@{
        Phase = $Phase
        Version = $ExpectedVersion
        Process = $process
        Hwnd = "$($status.hwnd)"
        StdoutPath = $stdoutPath
        StderrPath = $stderrPath
    }
}

function Invoke-WindowCommand(
    [pscustomobject]$Session,
    [string[]]$Arguments
) {
    Invoke-WinApp ($Arguments + @("-w", $Session.Hwnd))
}

function Wait-ForTask(
    [pscustomobject]$Session,
    [string]$Title
) {
    Invoke-WindowCommand $Session @(
        "ui", "invoke", "TasksNavItem"
    )
    Invoke-WindowCommand $Session @(
        "ui", "wait-for", "TasksPageHeading",
        "--timeout", "10000"
    )
    Invoke-WindowCommand $Session @(
        "ui", "wait-for", "Remove $Title",
        "--timeout", "10000"
    )
}

function Add-ServicingTask([pscustomobject]$Session) {
    Invoke-WindowCommand $Session @(
        "ui", "invoke", "TasksNavItem"
    )
    Invoke-WindowCommand $Session @(
        "ui", "wait-for", "TasksPageHeading",
        "--timeout", "10000"
    )
    Invoke-WindowCommand $Session @(
        "ui", "set-value", "TaskInput", $taskTitle
    )
    Invoke-WindowCommand $Session @(
        "ui", "invoke", "AddTaskButton"
    )
    Invoke-WindowCommand $Session @(
        "ui", "wait-for", "Remove $taskTitle",
        "--timeout", "10000"
    )
}

function Wait-ForPersistedTask([string]$Title) {
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    while ([DateTime]::UtcNow -lt $deadline) {
        if (Test-Path $statePath) {
            $state = Get-Content -LiteralPath $statePath -Raw |
                ConvertFrom-Json
            if (@($state.tasks | Where-Object title -eq $Title).Count -eq 1) {
                return
            }
        }
        Start-Sleep -Milliseconds 200
    }
    throw "Task '$Title' was not persisted to $statePath."
}

function Close-Dashboard([pscustomobject]$Session) {
    Invoke-WindowCommand $Session @("ui", "invoke", "Close")

    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    while ([DateTime]::UtcNow -lt $deadline) {
        $Session.Process.Refresh()
        if ($Session.Process.HasExited) {
            break
        }
        Start-Sleep -Milliseconds 200
    }

    $Session.Process.Refresh()
    if (-not $Session.Process.HasExited) {
        throw "$($Session.Phase) did not exit after closing its window."
    }
    $Session.Process.WaitForExit()
    $exitCode = $Session.Process.ExitCode
    if ($null -ne $exitCode -and $exitCode -ne 0) {
        throw "$($Session.Phase) exited with code $exitCode."
    }

    $stderr = if (Test-Path $Session.StderrPath) {
        Get-Content -LiteralPath $Session.StderrPath -Raw
    }
    else {
        ""
    }
    if (-not [string]::IsNullOrWhiteSpace($stderr)) {
        throw "$($Session.Phase) wrote to stderr: $stderr"
    }

    $stdout = Get-Content -LiteralPath $Session.StdoutPath -Raw
    $cleanupMatches = [regex]::Matches(
        $stdout,
        "dynwinrt-jsx renderer disposed cleanly: (?<json>\{[^\r\n]+\})"
    )
    if ($cleanupMatches.Count -eq 0) {
        throw "$($Session.Phase) did not report renderer cleanup."
    }

    $diagnostics = $cleanupMatches[
        $cleanupMatches.Count - 1
    ].Groups["json"].Value |
        ConvertFrom-Json
    if (
        $diagnostics.activeNative -ne 0 -or
        $diagnostics.activeComponents -ne 0 -or
        $diagnostics.nativeCreated -ne $diagnostics.nativeDisposed -or
        $diagnostics.componentsMounted -ne $diagnostics.componentsDisposed
    ) {
        throw "$($Session.Phase) reported incomplete renderer cleanup."
    }

    return $diagnostics
}

function Close-ExistingDashboards {
    $processes = @(
        Get-CimInstance Win32_Process -Filter "Name='DynWinRTJSXDashboard.exe'"
    )
    foreach ($processInfo in $processes) {
        $statusOutput = @(
            & $script:resolvedWinApp `
                "ui" "status" `
                "-a" "$($processInfo.ProcessId)" `
                "--json" 2>$null
        )
        if ($LASTEXITCODE -ne 0 -or $statusOutput.Count -eq 0) {
            throw "Cannot close existing dashboard process $($processInfo.ProcessId)."
        }
        $status = $statusOutput -join "`n" | ConvertFrom-Json
        Invoke-WinApp @(
            "ui", "invoke", "Close",
            "-w", "$($status.hwnd)"
        )

        $deadline = [DateTime]::UtcNow.AddSeconds(15)
        while (
            [DateTime]::UtcNow -lt $deadline -and
            (Get-Process -Id $processInfo.ProcessId -ErrorAction SilentlyContinue)
        ) {
            Start-Sleep -Milliseconds 200
        }
        if (Get-Process -Id $processInfo.ProcessId -ErrorAction SilentlyContinue) {
            throw "Existing dashboard process $($processInfo.ProcessId) did not exit."
        }
    }
}

$resolvedWinApp = Resolve-WinAppExecutable
New-Item -ItemType Directory -Force -Path $runRoot | Out-Null

$basePackage = Get-PackagePath $BaseVersion
$upgradePackage = Get-PackagePath $UpgradeVersion
$initialPackage = Get-AppxPackage -Name $packageName
$initialVersion = if ($initialPackage) {
    $initialPackage.Version.ToString()
}
else {
    $null
}
$initialPackagePath = if ($initialVersion) {
    Get-PackagePath $initialVersion
}
else {
    $null
}
$transitions = @()
$activeSession = $null
$failureMessage = $null
$packageMutationStarted = $false
$machineStateRestored = $false

try {
    Close-ExistingDashboards

    if (
        -not $KeepUpgradeInstalled -and
        $initialVersion -and
        -not (Test-Path $initialPackagePath)
    ) {
        throw "Cannot restore initially installed version $initialVersion because its MSIX artifact is unavailable. Pass -KeepUpgradeInstalled to proceed."
    }

    if (-not $SkipBuild) {
        Build-Package $BaseVersion
        if (-not $CertificatePath) {
            $CertificatePath = Join-Path `
                $stateRoot `
                "certificate\DynWinRTJSXDashboard-dev.pfx"
        }
        Build-Package $UpgradeVersion
    }

    foreach ($path in @($basePackage, $upgradePackage, $CertificatePath)) {
        if (-not $path -or -not (Test-Path $path)) {
            throw "Required servicing input was not found: $path"
        }
    }

    if ($InstallCertificate) {
        Invoke-WinApp @("cert", "install", $CertificatePath)
    }

    Assert-Provenance $BaseVersion $basePackage
    Assert-Provenance $UpgradeVersion $upgradePackage

    $installed = Install-PackageVersion $BaseVersion $basePackage
    $packageMutationStarted = $true
    $transitions += [ordered]@{
        action = "install"
        version = $installed.Version.ToString()
    }
    $activeSession = Start-Dashboard "base-install" $BaseVersion
    Add-ServicingTask $activeSession
    Wait-ForPersistedTask $taskTitle
    $baseDiagnostics = Close-Dashboard $activeSession
    $activeSession = $null

    $installed = Install-PackageVersion $UpgradeVersion $upgradePackage
    $transitions += [ordered]@{
        action = "upgrade"
        version = $installed.Version.ToString()
    }
    $activeSession = Start-Dashboard "upgrade" $UpgradeVersion
    Wait-ForTask $activeSession $taskTitle
    $upgradeDiagnostics = Close-Dashboard $activeSession
    $activeSession = $null

    $installed = Install-PackageVersion $BaseVersion $basePackage
    $transitions += [ordered]@{
        action = "rollback"
        version = $installed.Version.ToString()
    }
    $activeSession = Start-Dashboard "rollback" $BaseVersion
    Wait-ForTask $activeSession $taskTitle
    $rollbackDiagnostics = Close-Dashboard $activeSession
    $activeSession = $null

    Remove-InstalledPackage
    if (-not (Test-Path $statePath)) {
        throw "Uninstall removed the externally owned dashboard state."
    }
    Wait-ForPersistedTask $taskTitle
    $transitions += [ordered]@{
        action = "uninstall"
        version = $null
        statePreserved = $true
    }

    $installed = Install-PackageVersion $UpgradeVersion $upgradePackage
    $transitions += [ordered]@{
        action = "reinstall"
        version = $installed.Version.ToString()
    }
    $activeSession = Start-Dashboard "reinstall" $UpgradeVersion
    Wait-ForTask $activeSession $taskTitle
    $reinstallDiagnostics = Close-Dashboard $activeSession
    $activeSession = $null
}
catch {
    $failureMessage = $_.Exception.ToString()
    throw
}
finally {
    if ($activeSession) {
        try {
            $activeSession.Process.Refresh()
            if (-not $activeSession.Process.HasExited) {
                Close-Dashboard $activeSession | Out-Null
            }
        }
        catch {
            if (-not $activeSession.Process.HasExited) {
                Stop-Process -Id $activeSession.Process.Id -Force
            }
            Write-Warning "Failed to close the active servicing process: $_"
        }
    }

    if ($packageMutationStarted -and -not $KeepUpgradeInstalled) {
        try {
            if ($initialVersion) {
                Install-PackageVersion `
                    $initialVersion `
                    $initialPackagePath |
                    Out-Null
            }
            else {
                Remove-InstalledPackage
            }
            $machineStateRestored = $true
        }
        catch {
            Write-Warning "Failed to restore the initial package state: $_"
        }
    }
    elseif (
        $packageMutationStarted -and
        $KeepUpgradeInstalled -and
        -not (Get-AppxPackage -Name $packageName) -and
        (Test-Path $upgradePackage)
    ) {
        try {
            Install-PackageVersion $UpgradeVersion $upgradePackage | Out-Null
        }
        catch {
            Write-Warning "Failed to restore the upgrade package: $_"
        }
    }

    $statePreserved = if (Test-Path $statePath) {
        try {
            $state = Get-Content -LiteralPath $statePath -Raw |
                ConvertFrom-Json
            @($state.tasks | Where-Object title -eq $taskTitle).Count -eq 1
        }
        catch {
            $false
        }
    }
    else {
        $false
    }
    if (Test-Path $statePath) {
        Copy-Item -LiteralPath $statePath -Destination $stateEvidencePath -Force
    }

    $summary = [ordered]@{
        runId = $runId
        passed = $null -eq $failureMessage
        baseVersion = $BaseVersion
        upgradeVersion = $UpgradeVersion
        initialInstalledVersion = $initialVersion
        finalInstalledVersion = if (Get-AppxPackage -Name $packageName) {
            (Get-AppxPackage -Name $packageName).Version.ToString()
        }
        else {
            $null
        }
        taskTitle = $taskTitle
        statePath = $statePath
        stateEvidencePath = $stateEvidencePath
        statePreservedAcrossUninstall = $statePreserved
        keepUpgradeInstalled = [bool]$KeepUpgradeInstalled
        machineStateRestored = $machineStateRestored
        transitions = $transitions
        error = $failureMessage
    }
    $summary |
        ConvertTo-Json -Depth 8 |
        Set-Content -LiteralPath $summaryPath -Encoding UTF8

    Remove-Item `
        -LiteralPath $externalStateRoot `
        -Recurse `
        -Force `
        -ErrorAction SilentlyContinue
}

Write-Output "SEA servicing summary: $summaryPath"
