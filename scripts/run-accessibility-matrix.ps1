#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$NodePath,
    [string]$TypeScriptPath,
    [string]$WinAppPath,
    [string]$OutputDirectory,
    [int]$TimeoutMilliseconds = 60000,
    [switch]$IncludeUIA
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$workRoot = Split-Path $repoRoot -Parent
$dashboardRoot = Join-Path $repoRoot "examples\dashboard"
$selfTestScript = Join-Path $PSScriptRoot "run-native-selftest.ps1"
$uiSmokeScript = Join-Path $PSScriptRoot "smoke-dashboard-ui.ps1"
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $repoRoot "examples\dashboard\.winapp\accessibility-matrix"
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

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
        $metadata = (
            & $candidate -p "process.arch + '|' + process.versions.node.split('.')[0]"
        ).Trim().Split("|")
        if (
            $LASTEXITCODE -eq 0 -and
            $metadata.Count -eq 2 -and
            $metadata[0] -eq "x64" -and
            [int]$metadata[1] -ge 22
        ) {
            return [IO.Path]::GetFullPath($candidate)
        }
    }
    throw "An x64 Node.js 22+ executable is required. Pass -NodePath."
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

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class DynWinRtAccessibilitySettings
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct HighContrast
    {
        public uint cbSize;
        public uint dwFlags;
        public IntPtr lpszDefaultScheme;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool SystemParametersInfo(
        uint action,
        uint param,
        ref HighContrast value,
        uint flags);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SystemParametersInfo(
        uint action,
        uint param,
        ref int value,
        uint flags);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SystemParametersInfo(
        uint action,
        uint param,
        IntPtr value,
        uint flags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr SendMessageTimeout(
        IntPtr window,
        uint message,
        IntPtr wParam,
        string lParam,
        uint flags,
        uint timeout,
        out IntPtr result);

    public static HighContrast GetHighContrast()
    {
        var value = new HighContrast
        {
            cbSize = (uint)Marshal.SizeOf<HighContrast>()
        };
        if (!SystemParametersInfo(0x0042, value.cbSize, ref value, 0))
        {
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        return value;
    }

    public static void SetHighContrast(uint flags, string scheme)
    {
        IntPtr schemePointer = IntPtr.Zero;
        try
        {
            if (!string.IsNullOrEmpty(scheme))
            {
                schemePointer = Marshal.StringToHGlobalUni(scheme);
            }
            var value = new HighContrast
            {
                cbSize = (uint)Marshal.SizeOf<HighContrast>(),
                dwFlags = flags,
                lpszDefaultScheme = schemePointer,
            };
            if (!SystemParametersInfo(0x0043, value.cbSize, ref value, 0x3))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
        }
        finally
        {
            if (schemePointer != IntPtr.Zero)
            {
                Marshal.FreeHGlobal(schemePointer);
            }
        }
    }

    public static bool GetAnimationsEnabled()
    {
        int value = 0;
        if (!SystemParametersInfo(0x1042, 0, ref value, 0))
        {
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        return value != 0;
    }

    public static void SetAnimationsEnabled(bool enabled)
    {
        if (!SystemParametersInfo(
            0x1043,
            enabled ? 1u : 0u,
            IntPtr.Zero,
            0x3))
        {
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }
    }

    public static void BroadcastAccessibilityChange()
    {
        IntPtr result;
        var sent = SendMessageTimeout(
            new IntPtr(0xffff),
            0x001A,
            IntPtr.Zero,
            "Accessibility",
            0x2,
            5000,
            out result);
        var error = Marshal.GetLastWin32Error();
        if (sent == IntPtr.Zero && error != 0)
        {
            throw new Win32Exception(error);
        }
    }
}
'@

function Get-HighContrastSnapshot {
    $value = [DynWinRtAccessibilitySettings]::GetHighContrast()
    return [ordered]@{
        flags = [uint32]$value.dwFlags
        enabled = (($value.dwFlags -band 1) -ne 0)
        scheme = if ($value.lpszDefaultScheme -eq [IntPtr]::Zero) {
            ""
        }
        else {
            [Runtime.InteropServices.Marshal]::PtrToStringUni(
                $value.lpszDefaultScheme
            )
        }
    }
}

function Set-HighContrastEnabled(
    [bool]$Enabled,
    $Snapshot
) {
    $flags = [uint32]$Snapshot.flags
    if ($Enabled) {
        $flags = $flags -bor 1
    }
    else {
        $flags = $flags -band ([uint32]::MaxValue -bxor 1)
    }
    [DynWinRtAccessibilitySettings]::SetHighContrast(
        $flags,
        [string]$Snapshot.scheme
    )
    Start-Sleep -Seconds 2
}

function Get-TextScaleSnapshot {
    $path = "HKCU:\Software\Microsoft\Accessibility"
    $property = Get-ItemProperty `
        -Path $path `
        -Name TextScaleFactor `
        -ErrorAction SilentlyContinue
    return [ordered]@{
        path = $path
        existed = $null -ne $property
        value = if ($property) {
            [int]$property.TextScaleFactor
        }
        else {
            100
        }
    }
}

function Set-TextScale(
    [int]$Percent,
    $Snapshot
) {
    Set-ItemProperty `
        -Path $Snapshot.path `
        -Name TextScaleFactor `
        -Type DWord `
        -Value $Percent
    [DynWinRtAccessibilitySettings]::BroadcastAccessibilityChange()
    Start-Sleep -Seconds 2
}

function Restore-TextScale($Snapshot) {
    if ($Snapshot.existed) {
        Set-ItemProperty `
            -Path $Snapshot.path `
            -Name TextScaleFactor `
            -Type DWord `
            -Value $Snapshot.value
    }
    else {
        Remove-ItemProperty `
            -Path $Snapshot.path `
            -Name TextScaleFactor `
            -ErrorAction SilentlyContinue
    }
    [DynWinRtAccessibilitySettings]::BroadcastAccessibilityChange()
    Start-Sleep -Seconds 2
}

function Invoke-Profile(
    [string]$Name,
    [Nullable[bool]]$ExpectedHighContrast,
    [Nullable[double]]$ExpectedTextScale,
    [Nullable[bool]]$ExpectedAnimations
) {
    $directory = Join-Path $OutputDirectory $Name
    & $selfTestScript `
        -NodePath $NodePath `
        -TypeScriptPath $TypeScriptPath `
        -OutputDirectory $directory `
        -TimeoutMilliseconds $TimeoutMilliseconds `
        -SkipBuild `
        -SkipFailureProbes
    if ($LASTEXITCODE -ne 0) {
        throw "Accessibility profile '$Name' selftest failed."
    }
    $summaryPath = Join-Path $directory "summary.json"
    $summary = Get-Content $summaryPath -Raw | ConvertFrom-Json
    $environment = $summary.success.result.environment

    if (
        $null -ne $ExpectedHighContrast -and
        [bool]$environment.highContrast -ne [bool]$ExpectedHighContrast
    ) {
        throw "Profile '$Name' expected High Contrast $([bool]$ExpectedHighContrast), found $($environment.highContrast)."
    }
    if (
        $null -ne $ExpectedTextScale -and
        [Math]::Abs(
            [double]$environment.textScaleFactor -
            [double]$ExpectedTextScale
        ) -gt 0.01
    ) {
        throw "Profile '$Name' expected text scale $([double]$ExpectedTextScale), found $($environment.textScaleFactor)."
    }
    if (
        $null -ne $ExpectedAnimations -and
        [bool]$environment.animationsEnabled -ne [bool]$ExpectedAnimations
    ) {
        throw "Profile '$Name' expected animations $([bool]$ExpectedAnimations), found $($environment.animationsEnabled)."
    }

    $uia = $null
    if ($IncludeUIA) {
        $uia = Invoke-DashboardUIAProfile $Name
    }

    return [ordered]@{
        name = $Name
        environment = $environment
        summaryPath = $summaryPath
        uia = $uia
    }
}

function Invoke-DashboardUIAProfile([string]$Name) {
    if (-not $WinAppPath -or -not (Test-Path $WinAppPath)) {
        throw "winapp.exe is required for -IncludeUIA. Pass -WinAppPath."
    }
    $directory = Join-Path $OutputDirectory "$Name\uia"
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $stdoutPath = Join-Path $directory "dashboard.stdout.log"
    $stderrPath = Join-Path $directory "dashboard.stderr.log"
    $statePath = Join-Path $directory "dashboard.state.json"
    Remove-Item $stdoutPath, $stderrPath, $statePath -Force -ErrorAction SilentlyContinue

    $oldStatePath = $env:DYNWINRT_JSX_STATE_PATH
    $oldSelfTest = $env:DYNWINRT_JSX_SELFTEST
    $oldFailure = $env:DYNWINRT_JSX_SELFTEST_FAILURE
    $process = $null
    try {
        $env:DYNWINRT_JSX_STATE_PATH = $statePath
        Remove-Item Env:DYNWINRT_JSX_SELFTEST -ErrorAction SilentlyContinue
        Remove-Item Env:DYNWINRT_JSX_SELFTEST_FAILURE -ErrorAction SilentlyContinue
        $process = Start-Process `
            -FilePath $NodePath `
            -ArgumentList ".\main.js" `
            -WorkingDirectory $dashboardRoot `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath `
            -PassThru

        $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
        $ready = $false
        while ([DateTime]::UtcNow -lt $deadline) {
            Start-Sleep -Milliseconds 100
            $process.Refresh()
            if ($process.HasExited) {
                throw "Dashboard profile '$Name' exited before readiness with code $($process.ExitCode). $(Read-SharedText $stderrPath)"
            }
            if ((Read-SharedText $stdoutPath) -match "dashboard is ready") {
                $ready = $true
                break
            }
        }
        if (-not $ready) {
            throw "Dashboard profile '$Name' did not become ready."
        }

        & $uiSmokeScript `
            -WinAppPath $WinAppPath `
            -ExpectedProcessId $process.Id `
            -OutputDirectory $directory `
            -TimeoutMilliseconds ([Math]::Min($TimeoutMilliseconds, 30000)) `
            -KeepOpen | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "Dashboard profile '$Name' UIA smoke failed."
        }

        $statusText = (
            & $WinAppPath "ui" "status" "-a" "$($process.Id)" "--json"
        ) -join "`n"
        $status = $statusText | ConvertFrom-Json
        & $WinAppPath "ui" "invoke" "Close" "-w" "$($status.hwnd)" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Dashboard profile '$Name' close failed."
        }
        if (-not $process.WaitForExit(30000)) {
            throw "Dashboard profile '$Name' did not exit."
        }
        if ($process.ExitCode -ne 0) {
            throw "Dashboard profile '$Name' exited with code $($process.ExitCode)."
        }
        $logs = "$(Read-SharedText $stdoutPath)`n$(Read-SharedText $stderrPath)"
        if (
            $logs -notmatch '"activeNative":0' -or
            $logs -notmatch '"activeComponents":0'
        ) {
            throw "Dashboard profile '$Name' renderer did not return to zero."
        }
        return [ordered]@{
            exitCode = $process.ExitCode
            outputDirectory = $directory
        }
    }
    finally {
        $env:DYNWINRT_JSX_STATE_PATH = $oldStatePath
        $env:DYNWINRT_JSX_SELFTEST = $oldSelfTest
        $env:DYNWINRT_JSX_SELFTEST_FAILURE = $oldFailure
        if ($process) {
            $process.Refresh()
            if (-not $process.HasExited) {
                Stop-Process -Id $process.Id -Force
            }
        }
    }
}

$NodePath = Resolve-Node $NodePath
$TypeScriptPath = if ($TypeScriptPath) {
    [IO.Path]::GetFullPath($TypeScriptPath)
}
else {
    [IO.Path]::GetFullPath(
        (Join-Path $repoRoot "node_modules\typescript\bin\tsc")
    )
}
if ($IncludeUIA -and -not $WinAppPath) {
    $WinAppPath = Join-Path $workRoot "winappCli\src\winapp-npm\bin\win-x64\winapp.exe"
}
if ($WinAppPath) {
    $WinAppPath = [IO.Path]::GetFullPath($WinAppPath)
}

& $NodePath $TypeScriptPath "-p" (Join-Path $repoRoot "tsconfig.json")
if ($LASTEXITCODE -ne 0) {
    throw "Framework TypeScript build failed."
}
& $NodePath $TypeScriptPath "-p" (Join-Path $repoRoot "examples\dashboard\tsconfig.json")
if ($LASTEXITCODE -ne 0) {
    throw "Dashboard TypeScript build failed."
}

$highContrastSnapshot = Get-HighContrastSnapshot
$textScaleSnapshot = Get-TextScaleSnapshot
$animationsSnapshot =
    [DynWinRtAccessibilitySettings]::GetAnimationsEnabled()
$summaryPath = Join-Path $OutputDirectory "summary.json"
$summary = [ordered]@{
    startedAt = [DateTime]::UtcNow.ToString("o")
    passed = $false
    original = [ordered]@{
        highContrast = $highContrastSnapshot
        textScale = $textScaleSnapshot
        animationsEnabled = $animationsSnapshot
    }
    profiles = @()
}
$matrixError = $null
$restorationError = $null

try {
    $current = Invoke-Profile `
        "current" `
        $null `
        $null `
        $null
    $summary.profiles += $current

    try {
        Set-HighContrastEnabled $true $highContrastSnapshot
        $summary.profiles += Invoke-Profile `
            "high-contrast" `
            $true `
            $null `
            $null
    }
    finally {
        [DynWinRtAccessibilitySettings]::SetHighContrast(
            [uint32]$highContrastSnapshot.flags,
            [string]$highContrastSnapshot.scheme
        )
        Start-Sleep -Seconds 2
    }

    try {
        Set-TextScale 150 $textScaleSnapshot
        $summary.profiles += Invoke-Profile `
            "text-150" `
            $null `
            1.5 `
            $null
    }
    finally {
        Restore-TextScale $textScaleSnapshot
    }

    try {
        [DynWinRtAccessibilitySettings]::SetAnimationsEnabled($false)
        Start-Sleep -Seconds 2
        $summary.profiles += Invoke-Profile `
            "reduced-motion" `
            $null `
            $null `
            $false
    }
    finally {
        [DynWinRtAccessibilitySettings]::SetAnimationsEnabled(
            $animationsSnapshot
        )
        Start-Sleep -Seconds 2
    }

    $summary.profiles += Invoke-Profile `
        "restored" `
        ([bool]$highContrastSnapshot.enabled) `
        ([double]$textScaleSnapshot.value / 100) `
        ([bool]$animationsSnapshot)
    $summary.passed = $true
}
catch {
    $matrixError = $_
}
finally {
    try {
        [DynWinRtAccessibilitySettings]::SetHighContrast(
            [uint32]$highContrastSnapshot.flags,
            [string]$highContrastSnapshot.scheme
        )
        Start-Sleep -Seconds 2
    }
    catch {
        $restorationError ??= $_
    }
    try {
        Restore-TextScale $textScaleSnapshot
    }
    catch {
        $restorationError ??= $_
    }
    try {
        [DynWinRtAccessibilitySettings]::SetAnimationsEnabled(
            $animationsSnapshot
        )
        Start-Sleep -Seconds 2
    }
    catch {
        $restorationError ??= $_
    }
    $summary.completedAt = [DateTime]::UtcNow.ToString("o")
    try {
        [IO.File]::WriteAllText(
            $summaryPath,
            "$($summary | ConvertTo-Json -Depth 12)`n"
        )
    }
    catch {
        $restorationError ??= $_
    }
}

if ($matrixError) {
    throw $matrixError
}
if ($restorationError) {
    throw $restorationError
}

Write-Host "Accessibility matrix passed."
Write-Host "Summary: $summaryPath"
