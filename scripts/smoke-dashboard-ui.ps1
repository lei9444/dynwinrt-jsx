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

function Get-ToggleState([string]$Selector) {
    $json = Invoke-WinApp @(
        "ui", "inspect", $Selector,
        "-w", "$WindowHandle",
        "--json"
    ) -Capture
    $result = $json | ConvertFrom-Json
    return $result.windows[0].elements[0].toggleState
}

function Get-FocusedElement {
    $json = Invoke-WinApp @(
        "ui", "get-focused",
        "-w", "$WindowHandle",
        "--json"
    ) -Capture
    return Get-ObjectProperty ($json | ConvertFrom-Json) "element"
}

function Test-SelectorHasKeyboardFocus([string]$Selector) {
    $output = & $WinAppPath @(
        "ui", "get-property", $Selector,
        "-w", "$WindowHandle",
        "--property", "HasKeyboardFocus",
        "--json"
    ) 2>$null
    if ($LASTEXITCODE -ne 0) {
        return $false
    }
    $result = $output -join "`n" | ConvertFrom-Json
    return (
        (Get-ObjectProperty $result.properties "HasKeyboardFocus") -eq "True"
    )
}

function Wait-ForFocusedElement(
    [string]$AutomationId = "",
    [string]$Name = ""
) {
    $deadline = [DateTime]::UtcNow.AddSeconds(3)
    $focused = $null
    while ([DateTime]::UtcNow -lt $deadline) {
        $focused = Get-FocusedElement
        if (
            $focused -and
            (
                (
                    $AutomationId -and
                    (Get-ObjectProperty $focused "automationId") -eq $AutomationId
                ) -or
                (
                    $Name -and
                    (Get-ObjectProperty $focused "name") -eq $Name
                )
            )
        ) {
            return $focused
        }
        $selector = if ($AutomationId) {
            $AutomationId
        }
        else {
            $Name
        }
        if ($selector -and (Test-SelectorHasKeyboardFocus $selector)) {
            return @{ selector = $selector }
        }
        Start-Sleep -Milliseconds 100
    }
    throw "Focus did not reach AutomationId '$AutomationId' or Name '$Name'."
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

function Find-UniqueAutomationElement(
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
    return $matches[0]
}

function Assert-AccessibleInteractiveElements($Inspection) {
    $elements = @(
        $Inspection.windows |
            ForEach-Object { Get-FlattenedElements $_.elements }
    )
    $unnamed = @(
        $elements |
            Where-Object {
                (Get-ObjectProperty $_ "type") -in @(
                    "Button",
                    "CheckBox",
                    "Edit",
                    "ListItem"
                ) -and
                [string]::IsNullOrWhiteSpace(
                    [string](Get-ObjectProperty $_ "name")
                )
            }
    )
    if ($unnamed.Count -gt 0) {
        throw "Interactive UIA elements are missing accessible names."
    }
    $duplicateIds = @(
        $elements |
            ForEach-Object {
                Get-ObjectProperty $_ "automationId"
            } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Group-Object |
            Where-Object { $_.Count -gt 1 }
    )
    if ($duplicateIds.Count -gt 0) {
        throw "Duplicate AutomationIds: $($duplicateIds.Name -join ', ')."
    }
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
$taskScreenshot = Join-Path $OutputDirectory "dashboard-task-added.png"
$dialogScreenshot = Join-Path $OutputDirectory "dashboard-dialog.png"
$settingsScreenshot = Join-Path $OutputDirectory "dashboard-settings.png"
Remove-Item @(
    $inspectionPath,
    $layoutEvidencePath,
    $initialScreenshot,
    $taskScreenshot,
    $dialogScreenshot,
    $settingsScreenshot
) -Force -ErrorAction SilentlyContinue

$cleanupError = $null
try {
    Invoke-WinApp @(
        "ui", "wait-for", "DashboardPageHeading",
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
    Assert-AccessibleInteractiveElements $inspectionObject
    $dashboardSelector = Require-AutomationSelector $inspectionObject "DashboardNavItem"
    $tasksSelector = Require-AutomationSelector $inspectionObject "TasksNavItem"
    $diagnosticsSelector = Require-AutomationSelector $inspectionObject "DiagnosticsNavItem"
    $flyoutSelector = Require-AutomationSelector $inspectionObject "ShowFlyoutButton"
    $teachingTipSelector = Require-AutomationSelector $inspectionObject "ShowTeachingTipButton"
    Invoke-WinApp @(
        "ui", "focus", $dashboardSelector,
        "-w", "$WindowHandle"
    )
    $fullInspection = Invoke-WinApp @(
        "ui", "inspect",
        "-w", "$WindowHandle",
        "--depth", "10",
        "--json"
    ) -Capture | ConvertFrom-Json
    $metricIds = @(
        "TasksMetric",
        "CompleteMetric",
        "RuntimeMetric",
        "BuildMetric"
    )
    $metrics = @(
        $metricIds |
            ForEach-Object {
                Find-UniqueAutomationElement $fullInspection $_
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
    $shellTitle = Find-UniqueElement $fullInspection "Text" "Pilot application shell"
    $healthTitle = Find-UniqueElement $fullInspection "Text" "Runtime health"
    if ($healthTitle.x -le $shellTitle.x) {
        throw "Dashboard detail Grid columns are not ordered left to right."
    }
    if ([Math]::Abs($healthTitle.y - $shellTitle.y) -gt 8) {
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
            shell = [ordered]@{
                x = $shellTitle.x
                y = $shellTitle.y
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

    Invoke-WinApp @(
        "ui", "scroll-into-view", $flyoutSelector,
        "-w", "$WindowHandle"
    )
    Invoke-WinApp @("ui", "invoke", $flyoutSelector, "-w", "$WindowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", "Phase2FlyoutContent",
        "-w", "$WindowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @("ui", "invoke", "CloseFlyoutButton", "-w", "$WindowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", "Phase2FlyoutContent",
        "-w", "$WindowHandle",
        "--gone",
        "--timeout", "$TimeoutMilliseconds"
    )

    Invoke-WinApp @(
        "ui", "scroll-into-view", $teachingTipSelector,
        "-w", "$WindowHandle"
    )
    Invoke-WinApp @("ui", "invoke", $teachingTipSelector, "-w", "$WindowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", "Phase2TeachingTipContent",
        "-w", "$WindowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Phase2TeachingTipContent",
        "-w", "$WindowHandle",
        "--gone",
        "--timeout", "$TimeoutMilliseconds"
    )

    Invoke-WinApp @("ui", "invoke", $tasksSelector, "-w", "$WindowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", "TasksPageHeading",
        "-w", "$WindowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    $taskInspection = Invoke-WinApp @(
        "ui", "inspect",
        "-w", "$WindowHandle",
        "--interactive",
        "--json"
    ) -Capture | ConvertFrom-Json
    Assert-AccessibleInteractiveElements $taskInspection
    $inputSelector = Require-AutomationSelector $taskInspection "TaskInput"
    $addTaskSelector = Require-AutomationSelector $taskInspection "AddTaskButton"
    $inputElement = Find-UniqueAutomationElement $taskInspection "TaskInput"
    if ((Get-ObjectProperty $inputElement "name") -ne "New task") {
        throw "TaskInput did not expose its labeled accessible name."
    }
    Invoke-WinApp @(
        "ui", "set-value", $inputSelector, "UI automation task",
        "-w", "$WindowHandle"
    )
    Start-Sleep -Milliseconds 500
    Invoke-WinApp @("ui", "invoke", $addTaskSelector, "-w", "$WindowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", "Remove UI automation task",
        "-w", "$WindowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    $afterAddInspection = Invoke-WinApp @(
        "ui", "inspect",
        "-w", "$WindowHandle",
        "--interactive",
        "--json"
    ) -Capture | ConvertFrom-Json
    $addedTaskItem = Find-UniqueElement `
        $afterAddInspection `
        "ListItem" `
        "UI automation task"
    $addedTaskSelector = Get-ObjectProperty $addedTaskItem "selector"
    $addedTaskAutomationId = Get-ObjectProperty $addedTaskItem "automationId"
    Invoke-WinApp @("ui", "invoke", $addedTaskSelector, "-w", "$WindowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", $addedTaskSelector,
        "-w", "$WindowHandle",
        "--property", "IsSelected",
        "--value", "True",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$WindowHandle",
        "--output", $taskScreenshot
    )
    Invoke-WinApp @(
        "ui", "invoke", "Remove UI automation task",
        "-w", "$WindowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "RemoveTaskDialog",
        "-w", "$WindowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$WindowHandle",
        "--output", $dialogScreenshot
    )
    Invoke-WinApp @("ui", "invoke", "Cancel", "-w", "$WindowHandle")
    Wait-ForFocusedElement -Name "Remove UI automation task" | Out-Null
    Invoke-WinApp @(
        "ui", "invoke", "Remove UI automation task",
        "-w", "$WindowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "RemoveTaskDialog",
        "-w", "$WindowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    $confirmInspection = Invoke-WinApp @(
        "ui", "inspect",
        "-w", "$WindowHandle",
        "--interactive",
        "--json"
    ) -Capture | ConvertFrom-Json
    $primaryButton = Find-UniqueElement $confirmInspection "Button" "Remove"
    Invoke-WinApp @(
        "ui", "invoke", (Get-ObjectProperty $primaryButton "selector"),
        "-w", "$WindowHandle"
    )
    Start-Sleep -Milliseconds 150
    $afterRemoveInspection = Invoke-WinApp @(
        "ui", "inspect",
        "-w", "$WindowHandle",
        "--interactive",
        "--json"
    ) -Capture | ConvertFrom-Json
    $removedTask = @(
        $afterRemoveInspection.windows |
            ForEach-Object { Get-FlattenedElements $_.elements } |
            Where-Object {
                (Get-ObjectProperty $_ "automationId") -eq $addedTaskAutomationId
            }
    )
    if ($removedTask.Count -ne 0) {
        throw "Confirmed task removal left the added task in the UIA tree."
    }
    Wait-ForFocusedElement -AutomationId "AddTaskButton" | Out-Null

    Invoke-WinApp @("ui", "invoke", $diagnosticsSelector, "-w", "$WindowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", "DiagnosticsPageHeading",
        "-w", "$WindowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "HotReloadStatus",
        "-w", "$WindowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    $diagnosticsInspection = Invoke-WinApp @(
        "ui", "inspect",
        "-w", "$WindowHandle",
        "--interactive",
        "--json"
    ) -Capture | ConvertFrom-Json
    Assert-AccessibleInteractiveElements $diagnosticsInspection

    Invoke-WinApp @("ui", "invoke", "Settings", "-w", "$WindowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", "SettingsPageHeading",
        "-w", "$WindowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    $settingsInspection = Invoke-WinApp @(
        "ui", "inspect",
        "-w", "$WindowHandle",
        "--interactive",
        "--json"
    ) -Capture | ConvertFrom-Json
    Assert-AccessibleInteractiveElements $settingsInspection
    $themeSelector = Require-AutomationSelector $settingsInspection "ThemeToggle"
    $initialTheme = Get-ToggleState $themeSelector
    Invoke-WinApp @("ui", "invoke", $themeSelector, "-w", "$WindowHandle")
    if ((Get-ToggleState $themeSelector) -eq $initialTheme) {
        throw "The theme toggle did not change state."
    }
    Invoke-WinApp @("ui", "invoke", $themeSelector, "-w", "$WindowHandle")
    if ((Get-ToggleState $themeSelector) -ne $initialTheme) {
        throw "The theme toggle did not return to its initial state."
    }
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$WindowHandle",
        "--output", $settingsScreenshot
    )

    Invoke-WinApp @("ui", "invoke", $dashboardSelector, "-w", "$WindowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", "DashboardPageHeading",
        "-w", "$WindowHandle",
        "--timeout", "$TimeoutMilliseconds"
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
    Read-SharedText $stdoutPath
}
else {
    ""
}
$stderr = if (Test-Path $stderrPath) {
    Read-SharedText $stderrPath
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
