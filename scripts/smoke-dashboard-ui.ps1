#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$WorkRoot,
    [string]$WinAppPath,
    [string]$App = "DynWinRT JSX Workspace",
    [string]$OutputDirectory,
    [int]$TimeoutMilliseconds = 10000,
    [switch]$KeepOpen
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
if (-not $WorkRoot) {
    $WorkRoot = Split-Path $repoRoot -Parent
}
$dashboardRoot = Join-Path $repoRoot "examples\dashboard"
if (-not $WinAppPath) {
    $WinAppPath = Join-Path $WorkRoot "winappCli\src\winapp-npm\bin\win-x64\winapp.exe"
}
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $dashboardRoot ".winapp\smoke"
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

function Get-ToggleState([string]$Selector) {
    $json = Invoke-WinApp @(
        "ui", "inspect", $Selector,
        "-a", $App,
        "--json"
    ) -Capture
    $result = $json | ConvertFrom-Json
    return $result.windows[0].elements[0].toggleState
}

function Get-ObjectProperty($Object, [string]$Name) {
    $property = $Object.PSObject.Properties[$Name]
    if ($property) {
        return $property.Value
    }
    return $null
}

function Get-FlattenedElements($Elements) {
    $result = @()
    foreach ($element in @($Elements)) {
        $result += $element
        $children = $element.PSObject.Properties["children"]
        if ($children -and $children.Value) {
            $result += Get-FlattenedElements $children.Value
        }
    }
    return $result
}

function Require-AutomationSelector(
    $Inspection,
    [string]$AutomationId
) {
    $elements = @(
        $Inspection.windows |
            ForEach-Object { Get-FlattenedElements $_.elements }
    )
    $matches = @(
        $elements |
            Where-Object {
                (Get-ObjectProperty $_ "automationId") -eq $AutomationId
            }
    )
    if ($matches.Count -ne 1) {
        throw "Expected one element with AutomationId '$AutomationId', found $($matches.Count)."
    }
    $selector = Get-ObjectProperty $matches[0] "selector"
    if ($selector -ne $AutomationId) {
        throw "AutomationId '$AutomationId' resolved to unstable selector '$selector'."
    }
    return $selector
}

function Wait-ForProcessExit([int]$ProcessId) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        if (-not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
            return
        }
        Start-Sleep -Milliseconds 100
    }
    throw "Dashboard process $ProcessId did not exit within $TimeoutMilliseconds ms."
}

if (-not (Test-Path $WinAppPath)) {
    throw "winapp.exe was not found at $WinAppPath."
}

$pidPath = Join-Path $dashboardRoot ".winapp\dashboard.pid"
$statusJson = Invoke-WinApp @(
    "ui", "status",
    "-a", $App,
    "--json"
) -Capture
$dashboardPid = [int](($statusJson | ConvertFrom-Json).processId)
if (-not (Get-Process -Id $dashboardPid -ErrorAction SilentlyContinue)) {
    throw "Dashboard process $dashboardPid is not running."
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$inspectionPath = Join-Path $OutputDirectory "interactive-elements.json"
$initialScreenshot = Join-Path $OutputDirectory "dashboard-initial.png"
$focusScreenshot = Join-Path $OutputDirectory "dashboard-focus.png"
$taskScreenshot = Join-Path $OutputDirectory "dashboard-task-added.png"
Remove-Item @(
    $inspectionPath,
    $initialScreenshot,
    $focusScreenshot,
    $taskScreenshot
) -Force -ErrorAction SilentlyContinue

$cleanupError = $null
try {
    Invoke-WinApp @(
        "ui", "wait-for", "FocusModeButton",
        "-a", $App,
        "--timeout", "$TimeoutMilliseconds"
    )

    $inspection = Invoke-WinApp @(
        "ui", "inspect",
        "-a", $App,
        "--interactive",
        "--json"
    ) -Capture
    [IO.File]::WriteAllText($inspectionPath, "$inspection`n")
    $inspectionObject = $inspection | ConvertFrom-Json
    $themeSelector = Require-AutomationSelector $inspectionObject "ThemeToggle"
    $focusSelector = Require-AutomationSelector $inspectionObject "FocusModeButton"
    $inputSelector = Require-AutomationSelector $inspectionObject "TaskInput"
    $addTaskSelector = Require-AutomationSelector $inspectionObject "AddTaskButton"

    Invoke-WinApp @(
        "ui", "screenshot",
        "-a", $App,
        "--output", $initialScreenshot
    )

    $initialTheme = Get-ToggleState $themeSelector
    Invoke-WinApp @("ui", "invoke", $themeSelector, "-a", $App)
    $updatedTheme = Get-ToggleState $themeSelector
    if ($updatedTheme -eq $initialTheme) {
        throw "The theme toggle did not change state."
    }
    Invoke-WinApp @("ui", "invoke", $themeSelector, "-a", $App)
    if ((Get-ToggleState $themeSelector) -ne $initialTheme) {
        throw "The theme toggle did not return to its initial state."
    }

    Invoke-WinApp @("ui", "invoke", $focusSelector, "-a", $App)
    Invoke-WinApp @(
        "ui", "wait-for", $focusSelector,
        "-a", $App,
        "--property", "Name",
        "--value", "Exit focus",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-a", $App,
        "--output", $focusScreenshot
    )

    Invoke-WinApp @("ui", "invoke", $focusSelector, "-a", $App)
    Invoke-WinApp @(
        "ui", "wait-for", $inputSelector,
        "-a", $App,
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "set-value", $inputSelector, "UI automation task",
        "-a", $App
    )
    Invoke-WinApp @("ui", "invoke", $addTaskSelector, "-a", $App)
    Invoke-WinApp @(
        "ui", "wait-for", "UI automation task",
        "-a", $App,
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-a", $App,
        "--output", $taskScreenshot
    )
}
finally {
    if (
        -not $KeepOpen -and
        (Get-Process -Id $dashboardPid -ErrorAction SilentlyContinue)
    ) {
        try {
            Invoke-WinApp @("ui", "invoke", "Close", "-a", $App)
            Wait-ForProcessExit $dashboardPid
        }
        catch {
            $cleanupError = $_
            Write-Warning "Failed to close the dashboard after smoke execution: $_"
        }
    }
}

if ($KeepOpen) {
    Write-Host "Dashboard UI smoke completed; window left open." -ForegroundColor Green
    return
}

if ($cleanupError) {
    throw $cleanupError
}

$stdoutPath = Join-Path $dashboardRoot ".winapp\dashboard.stdout.log"
$stderrPath = Join-Path $dashboardRoot ".winapp\dashboard.stderr.log"
$stdout = if (Test-Path $stdoutPath) {
    [IO.File]::ReadAllText($stdoutPath)
}
else {
    ""
}
$stderr = if (Test-Path $stderrPath) {
    [IO.File]::ReadAllText($stderrPath)
}
else {
    ""
}
if ($stdout -notmatch "renderer disposed cleanly") {
    throw "Dashboard did not report clean renderer disposal."
}
if (-not [string]::IsNullOrWhiteSpace($stderr)) {
    throw "Dashboard wrote errors during the smoke run: $stderr"
}

Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
Write-Host "Dashboard UI smoke completed successfully." -ForegroundColor Green
