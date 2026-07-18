#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$WorkRoot,
    [string]$WinAppPath,
    [string]$App = "DynWinRT JSX Workspace",
    [int]$ExpectedProcessId,
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
        "-w", "$WindowHandle",
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

function Find-UniqueElement(
    $Inspection,
    [string]$Type,
    [string]$Name
) {
    $elements = @(
        $Inspection.windows |
            ForEach-Object { Get-FlattenedElements $_.elements }
    )
    $matches = @(
        $elements |
            Where-Object {
                (Get-ObjectProperty $_ "type") -eq $Type -and
                (Get-ObjectProperty $_ "name") -eq $Name
            }
    )
    if ($matches.Count -ne 1) {
        throw "Expected one $Type named '$Name', found $($matches.Count)."
    }
    return $matches[0]
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

$mutexHash = [Convert]::ToHexString(
    [Security.Cryptography.SHA256]::HashData(
        [Text.Encoding]::UTF8.GetBytes($dashboardRoot)
    )
).Substring(0, 16)
$mutex = [Threading.Mutex]::new(
    $false,
    "Local\dynwinrt-jsx-dashboard-lifecycle-$mutexHash"
)
$ownsMutex = $false

try {
    try {
        $ownsMutex = $mutex.WaitOne(0)
    }
    catch [Threading.AbandonedMutexException] {
        $ownsMutex = $true
    }
    if (-not $ownsMutex) {
        throw "Another dashboard lifecycle operation is already active."
    }

if (-not (Test-Path $WinAppPath)) {
    throw "winapp.exe was not found at $WinAppPath."
}

$pidPath = Join-Path $dashboardRoot ".winapp\dashboard.pid"
$Target = if ($ExpectedProcessId) {
    "$ExpectedProcessId"
}
else {
    $App
}
$statusJson = Invoke-WinApp @(
    "ui", "status",
    "-a", $Target,
    "--json"
) -Capture
$status = $statusJson | ConvertFrom-Json
$dashboardPid = [int]$status.processId
$WindowHandle = [long]$status.hwnd
if ($ExpectedProcessId -and $dashboardPid -ne $ExpectedProcessId) {
    throw "Expected dashboard PID $ExpectedProcessId, but UIA resolved PID $dashboardPid."
}
if (-not (Get-Process -Id $dashboardPid -ErrorAction SilentlyContinue)) {
    throw "Dashboard process $dashboardPid is not running."
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$inspectionPath = Join-Path $OutputDirectory "interactive-elements.json"
$layoutEvidencePath = Join-Path $OutputDirectory "grid-layout.json"
$initialScreenshot = Join-Path $OutputDirectory "dashboard-initial.png"
$focusScreenshot = Join-Path $OutputDirectory "dashboard-focus.png"
$taskScreenshot = Join-Path $OutputDirectory "dashboard-task-added.png"
Remove-Item @(
    $inspectionPath,
    $layoutEvidencePath,
    $initialScreenshot,
    $focusScreenshot,
    $taskScreenshot
) -Force -ErrorAction SilentlyContinue

$cleanupError = $null
try {
    Invoke-WinApp @(
        "ui", "wait-for", "FocusModeButton",
        "-w", "$WindowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )

    $inspection = Invoke-WinApp @(
        "ui", "inspect",
        "-w", "$WindowHandle",
        "--interactive",
        "--json"
    ) -Capture
    [IO.File]::WriteAllText($inspectionPath, "$inspection`n")
    $inspectionObject = $inspection | ConvertFrom-Json
    $themeSelector = Require-AutomationSelector $inspectionObject "ThemeToggle"
    $focusSelector = Require-AutomationSelector $inspectionObject "FocusModeButton"
    $inputSelector = Require-AutomationSelector $inspectionObject "TaskInput"
    $addTaskSelector = Require-AutomationSelector $inspectionObject "AddTaskButton"
    $fullInspection = Invoke-WinApp @(
        "ui", "inspect",
        "-w", "$WindowHandle",
        "--depth", "10",
        "--json"
    ) -Capture | ConvertFrom-Json
    $metricNames = @("TASKS", "COMPLETE", "RUNTIME", "BUILD")
    $metrics = @(
        $metricNames |
            ForEach-Object {
                Find-UniqueElement $fullInspection "Text" $_
            }
    )
    for ($index = 1; $index -lt $metrics.Count; $index += 1) {
        if ($metrics[$index].x -le $metrics[$index - 1].x) {
            throw "Metric Grid columns are not ordered left to right."
        }
        if ([Math]::Abs($metrics[$index].y - $metrics[0].y) -gt 8) {
            throw "Metric Grid items are not aligned in the same row."
        }
    }
    $tasksTitle = Find-UniqueElement $fullInspection "Text" "Sprint tasks"
    $healthTitle = Find-UniqueElement $fullInspection "Text" "Runtime health"
    if ($healthTitle.x -le $tasksTitle.x) {
        throw "Dashboard detail Grid columns are not ordered left to right."
    }
    if ([Math]::Abs($healthTitle.y - $tasksTitle.y) -gt 8) {
        throw "Dashboard detail Grid items are not aligned in the same row."
    }
    [IO.File]::WriteAllText(
        $layoutEvidencePath,
        "$([ordered]@{
            metrics = $metrics | ForEach-Object {
                [ordered]@{
                    name = $_.name
                    x = $_.x
                    y = $_.y
                    width = $_.width
                    height = $_.height
                }
            }
            tasks = [ordered]@{
                x = $tasksTitle.x
                y = $tasksTitle.y
            }
            health = [ordered]@{
                x = $healthTitle.x
                y = $healthTitle.y
            }
        } | ConvertTo-Json -Depth 5)`n"
    )

    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$WindowHandle",
        "--output", $initialScreenshot
    )

    $initialTheme = Get-ToggleState $themeSelector
    Invoke-WinApp @("ui", "invoke", $themeSelector, "-w", "$WindowHandle")
    $updatedTheme = Get-ToggleState $themeSelector
    if ($updatedTheme -eq $initialTheme) {
        throw "The theme toggle did not change state."
    }
    Invoke-WinApp @("ui", "invoke", $themeSelector, "-w", "$WindowHandle")
    if ((Get-ToggleState $themeSelector) -ne $initialTheme) {
        throw "The theme toggle did not return to its initial state."
    }

    Invoke-WinApp @("ui", "invoke", $focusSelector, "-w", "$WindowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", $focusSelector,
        "-w", "$WindowHandle",
        "--property", "Name",
        "--value", "Exit focus",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$WindowHandle",
        "--output", $focusScreenshot
    )

    Invoke-WinApp @("ui", "invoke", $focusSelector, "-w", "$WindowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", $inputSelector,
        "-w", "$WindowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "set-value", $inputSelector, "UI automation task",
        "-w", "$WindowHandle"
    )
    Invoke-WinApp @("ui", "invoke", $addTaskSelector, "-w", "$WindowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", "UI automation task",
        "-w", "$WindowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$WindowHandle",
        "--output", $taskScreenshot
    )
}
finally {
    if (
        -not $KeepOpen -and
        (Get-Process -Id $dashboardPid -ErrorAction SilentlyContinue)
    ) {
        try {
            Invoke-WinApp @("ui", "invoke", "Close", "-w", "$WindowHandle")
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

if (Test-Path $pidPath) {
    $recordedPid = [int]([IO.File]::ReadAllText($pidPath).Trim())
    if ($recordedPid -eq $dashboardPid) {
        Remove-Item $pidPath -Force
    }
}
Write-Host "Dashboard UI smoke completed successfully." -ForegroundColor Green
}
finally {
    if ($ownsMutex) {
        $mutex.ReleaseMutex()
    }
    $mutex.Dispose()
}
