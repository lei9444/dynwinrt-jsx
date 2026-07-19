#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$WorkRoot,
    [string]$NodePath,
    [string]$WinAppPath,
    [string]$OutputDirectory,
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
    $OutputDirectory = Join-Path $dashboardRoot ".winapp\persistence-smoke"
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$statePath = Join-Path $OutputDirectory "state.json"
Remove-Item $statePath, "$statePath.corrupt-*" -Force -ErrorAction SilentlyContinue

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

function Start-Dashboard([string]$Name) {
    $stdoutPath = Join-Path $OutputDirectory "$Name.stdout.log"
    $stderrPath = Join-Path $OutputDirectory "$Name.stderr.log"
    Remove-Item $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
    try {
        $oldStatePath = $env:DYNWINRT_JSX_STATE_PATH
        try {
            $env:DYNWINRT_JSX_STATE_PATH = $statePath
            $process = Start-Process `
                -FilePath $NodePath `
                -ArgumentList ".\main.js" `
                -WorkingDirectory $dashboardRoot `
                -RedirectStandardOutput $stdoutPath `
                -RedirectStandardError $stderrPath `
                -PassThru
        }
        finally {
            $env:DYNWINRT_JSX_STATE_PATH = $oldStatePath
        }
        Wait-ForText $stdoutPath "dashboard is ready"
        $status = Invoke-WinApp @(
            "ui", "status",
            "-a", "$($process.Id)",
            "--json"
        ) -Capture | ConvertFrom-Json
        return [pscustomobject]@{
            process = $process
            hwnd = [long]$status.hwnd
            stdout = $stdoutPath
            stderr = $stderrPath
        }
    }
    catch {
        if (
            $process -and
            (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)
        ) {
            Stop-Process -Id $process.Id
        }
        throw
    }
}

function Stop-Dashboard($Run) {
    try {
        Invoke-WinApp @("ui", "invoke", "Close", "-w", "$($Run.hwnd)")
        Wait-Process -Id $Run.process.Id -Timeout 15
        Wait-ForText $Run.stdout "renderer disposed cleanly"
        $stderr = Read-SharedText $Run.stderr
        if (
            -not [string]::IsNullOrWhiteSpace($stderr) -and
            $stderr -notmatch '"event":"state.recovered"'
        ) {
            throw "Dashboard wrote errors: $stderr"
        }
    }
    finally {
        if (Get-Process -Id $Run.process.Id -ErrorAction SilentlyContinue) {
            Stop-Process -Id $Run.process.Id
        }
    }
}

$first = Start-Dashboard "first"
try {
    Invoke-WinApp @("ui", "invoke", "TasksNavItem", "-w", "$($first.hwnd)")
    Invoke-WinApp @(
        "ui", "wait-for", "TasksPageHeading",
        "-w", "$($first.hwnd)",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "set-value", "TaskInput", "Persisted task",
        "-w", "$($first.hwnd)"
    )
    Start-Sleep -Milliseconds 500
    Invoke-WinApp @("ui", "invoke", "AddTaskButton", "-w", "$($first.hwnd)")
    Invoke-WinApp @(
        "ui", "wait-for", "TaskCheck4",
        "-w", "$($first.hwnd)",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @("ui", "invoke", "Settings", "-w", "$($first.hwnd)")
    Invoke-WinApp @(
        "ui", "wait-for", "SettingsPageHeading",
        "-w", "$($first.hwnd)",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @("ui", "invoke", "ThemeToggle", "-w", "$($first.hwnd)")
}
finally {
    if (Get-Process -Id $first.process.Id -ErrorAction SilentlyContinue) {
        Stop-Dashboard $first
    }
}

$stored = [IO.File]::ReadAllText($statePath) | ConvertFrom-Json
if (
    $stored.version -ne 1 -or
    $stored.darkTheme -ne $false -or
    @($stored.tasks | Where-Object { $_.title -eq "Persisted task" }).Count -ne 1
) {
    throw "Persisted dashboard state did not contain the expected task/theme."
}

$second = Start-Dashboard "second"
try {
    Invoke-WinApp @("ui", "invoke", "TasksNavItem", "-w", "$($second.hwnd)")
    Invoke-WinApp @(
        "ui", "wait-for", "TaskCheck4",
        "-w", "$($second.hwnd)",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @("ui", "invoke", "Settings", "-w", "$($second.hwnd)")
    Invoke-WinApp @(
        "ui", "wait-for", "SettingsPageHeading",
        "-w", "$($second.hwnd)",
        "--timeout", "$TimeoutMilliseconds"
    )
    $theme = Invoke-WinApp @(
        "ui", "inspect", "ThemeToggle",
        "-w", "$($second.hwnd)",
        "--json"
    ) -Capture | ConvertFrom-Json
    if ($theme.windows[0].elements[0].toggleState -ne "Off") {
        throw "Persisted theme was not restored."
    }
}
finally {
    if (Get-Process -Id $second.process.Id -ErrorAction SilentlyContinue) {
        Stop-Dashboard $second
    }
}

[IO.File]::WriteAllText($statePath, "{invalid json")
$third = Start-Dashboard "recovery"
try {
    Invoke-WinApp @(
        "ui", "wait-for", "DashboardPageHeading",
        "-w", "$($third.hwnd)",
        "--timeout", "$TimeoutMilliseconds"
    )
    $persistenceStatus = Invoke-WinApp @(
        "ui", "inspect", "PersistenceStatus",
        "-w", "$($third.hwnd)",
        "--json"
    ) -Capture | ConvertFrom-Json
    if (
        $persistenceStatus.windows[0].elements[0].name -notmatch
        "^State recovery error:"
    ) {
        throw "Recovery error was not exposed in PersistenceStatus."
    }
    $corruptFiles = @(Get-ChildItem "$statePath.corrupt-*" -ErrorAction SilentlyContinue)
    if ($corruptFiles.Count -ne 1) {
        throw "Corrupt state was not preserved exactly once."
    }
}
finally {
    if (Get-Process -Id $third.process.Id -ErrorAction SilentlyContinue) {
        Stop-Dashboard $third
    }
}

Write-Host "Dashboard persistence smoke completed successfully." -ForegroundColor Green
