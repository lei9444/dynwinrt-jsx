#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$WorkRoot,
    [string]$NodePath,
    [string]$WinAppPath,
    [string]$OutputDirectory,
    [ValidateRange(1, 50)]
    [int]$ReloadCycles = 3,
    [int]$TimeoutMilliseconds = 15000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
if (-not $WorkRoot) {
    $WorkRoot = Split-Path $repoRoot -Parent
}
$dashboardRoot = Join-Path $repoRoot "examples\dashboard"
if (-not $NodePath) {
    $NodePath = "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe"
}
if (-not $WinAppPath) {
    $WinAppPath = Join-Path $WorkRoot "winappCli\src\winapp-npm\bin\win-x64\winapp.exe"
}
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $dashboardRoot ".winapp\hot-reload-smoke"
}

function Read-SharedText([string]$Path) {
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

function Wait-ForText([string]$Path, [string]$Pattern) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        if ((Test-Path $Path) -and (Read-SharedText $Path) -match $Pattern) {
            return
        }
        Start-Sleep -Milliseconds 100
    }
    throw "Timed out waiting for '$Pattern' in $Path."
}

function Invoke-WinApp([string[]]$Arguments, [switch]$Capture) {
    if ($Capture) {
        $output = & $WinAppPath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "winapp $($Arguments -join ' ') exited with code $LASTEXITCODE."
        }
        return $output -join "`n"
    }
    & $WinAppPath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "winapp $($Arguments -join ' ') exited with code $LASTEXITCODE."
    }
}

function Write-HotMessage(
    [string]$Path,
    [int]$Version,
    [string]$Type,
    [string]$Message = ""
) {
    $temporary = "$Path.tmp"
    [IO.File]::WriteAllText(
        $temporary,
        "$([ordered]@{
            type = $Type
            version = $Version
            message = $Message
        } | ConvertTo-Json -Compress)`n"
    )
    Move-Item $temporary $Path -Force
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stdoutPath = Join-Path $OutputDirectory "dashboard.stdout.log"
$stderrPath = Join-Path $OutputDirectory "dashboard.stderr.log"
$pidPath = Join-Path $dashboardRoot ".winapp\dashboard.pid"
Remove-Item $stdoutPath, $stderrPath, $pidPath -Force -ErrorAction SilentlyContinue

$oldHot = $env:DYNWINRT_JSX_HOT
$oldSkip = $env:DYNWINRT_JSX_HOT_SKIP_BASELINE
$process = $null
try {
    $env:DYNWINRT_JSX_HOT = "1"
    Remove-Item Env:\DYNWINRT_JSX_HOT_SKIP_BASELINE -ErrorAction SilentlyContinue
    $process = Start-Process `
        -FilePath $NodePath `
        -ArgumentList ".\main.js" `
        -WorkingDirectory $dashboardRoot `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -PassThru
    [IO.File]::WriteAllText($pidPath, "$($process.Id)`n")
}
finally {
    $env:DYNWINRT_JSX_HOT = $oldHot
    $env:DYNWINRT_JSX_HOT_SKIP_BASELINE = $oldSkip
}

try {
    Wait-ForText $stdoutPath "dashboard is ready"
    $status = Invoke-WinApp @(
        "ui", "status",
        "-a", "$($process.Id)",
        "--json"
    ) -Capture | ConvertFrom-Json
    $windowHandle = [long]$status.hwnd
    if ([int]$status.processId -ne $process.Id) {
        throw "UIA resolved PID $($status.processId), expected $($process.Id)."
    }

    Invoke-WinApp @("ui", "invoke", "TasksNavItem", "-w", "$windowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", "TasksPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "set-value", "TaskInput", "Hot reload retained state",
        "-w", "$windowHandle"
    )
    Start-Sleep -Milliseconds 500
    Invoke-WinApp @("ui", "invoke", "AddTaskButton", "-w", "$windowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", "TaskCheck4",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )

    $hotStatePath = Join-Path $env:TEMP "dynwinrt-jsx-hot-$($process.Id).json"
    $appModule = Join-Path $dashboardRoot "dist\dashboard-app.js"
    $version = 0
    for ($cycle = 1; $cycle -le $ReloadCycles; $cycle += 1) {
        $version += 1
        if ($cycle -eq 1) {
            (Get-Item $appModule).LastWriteTime = (Get-Date).AddSeconds($cycle)
        }
        else {
            Write-HotMessage $hotStatePath $version "hot-reload"
        }
        Wait-ForText $stdoutPath "hot reload applied \(version $version\)"
        $afterReload = Invoke-WinApp @(
            "ui", "status",
            "-a", "$($process.Id)",
            "--json"
        ) -Capture | ConvertFrom-Json
        if ([long]$afterReload.hwnd -ne $windowHandle) {
            throw "Hot reload cycle $cycle replaced the native Window handle."
        }
        Invoke-WinApp @(
            "ui", "wait-for", "TaskCheck4",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )

        $version += 1
        Write-HotMessage `
            $hotStatePath `
            $version `
            "hot-build-error" `
            "Synthetic hot build error cycle $cycle"
        Invoke-WinApp @(
            "ui", "wait-for", "HotReloadError",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )

        $version += 1
        Write-HotMessage $hotStatePath $version "hot-reload"
        Wait-ForText $stdoutPath "hot reload applied \(version $version\)"
        Invoke-WinApp @(
            "ui", "wait-for", "TasksPageHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "TaskCheck4",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
    }

    Invoke-WinApp @("ui", "invoke", "Settings", "-w", "$windowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", "SettingsPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    $version += 1
    Write-HotMessage $hotStatePath $version "hot-reload"
    Wait-ForText $stdoutPath "hot reload applied \(version $version\)"
    Invoke-WinApp @(
        "ui", "wait-for", "SettingsPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @("ui", "invoke", "Close", "-w", "$windowHandle")
    Wait-Process -Id $process.Id -Timeout 15
    Wait-ForText $stdoutPath "renderer disposed cleanly"
    $stderr = Read-SharedText $stderrPath
    if (
        -not [string]::IsNullOrWhiteSpace($stderr) -and
        $stderr -notmatch "Synthetic hot build error"
    ) {
        throw "Unexpected hot reload stderr: $stderr"
    }
}
finally {
    if ($process -and (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $process.Id
    }
    if (Test-Path $pidPath) {
        Remove-Item $pidPath -Force
    }
}

Write-Host "Dashboard hot reload smoke completed successfully." -ForegroundColor Green
