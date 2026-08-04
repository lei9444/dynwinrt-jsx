#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$WinAppPath,
    [int]$TimeoutMilliseconds = 10000,
    [switch]$SkipKeyboardInput,
    [switch]$RouterOnly,
    [switch]$ClipboardOnly,
    [switch]$SystemOnly,
    [switch]$ShellOnly,
    [switch]$MotionOnly,
    [switch]$CategoryOnly,
    [switch]$DesignOnly,
    [switch]$ControlledOnly,
    [ValidateSet("pivot", "tab-view", "semantic-zoom", "tree-view")]
    [string]$ControlledRoute = "pivot",
    [switch]$SkipBuild,
    [string]$EvidenceRoot,
    [switch]$PackagedShellPositivePath,
    [string]$PackagedGalleryLaunchCommand,
    [switch]$WindowingOnly,
    [switch]$WindowingTeardownOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not ([System.Management.Automation.PSTypeName]"GallerySmokeNativeMethods").Type) {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class GallerySmokeNativeMethods
{
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(
        IntPtr hWnd,
        IntPtr hWndInsertAfter,
        int x,
        int y,
        int width,
        int height,
        uint flags);

    [DllImport("user32.dll")]
    public static extern uint GetDpiForWindow(IntPtr hWnd);
}
"@
}

function Set-GalleryWindowSize(
    [int64]$WindowHandle,
    [int]$Width,
    [int]$Height
) {
    $changed = [GallerySmokeNativeMethods]::SetWindowPos(
        [IntPtr]$WindowHandle,
        [IntPtr]::Zero,
        0,
        0,
        $Width,
        $Height,
        0x0016
    )
    if (-not $changed) {
        throw "SetWindowPos failed for Gallery window $WindowHandle."
    }
    Start-Sleep -Milliseconds 350
}

function Set-GalleryWindowEffectiveSize(
    [int64]$WindowHandle,
    [int]$Width,
    [int]$Height
) {
    $dpi = [GallerySmokeNativeMethods]::GetDpiForWindow(
        [IntPtr]$WindowHandle
    )
    if ($dpi -eq 0) {
        throw "GetDpiForWindow failed for Gallery window $WindowHandle."
    }
    $scale = $dpi / 96.0
    Set-GalleryWindowSize `
        $WindowHandle `
        ([Math]::Round($Width * $scale)) `
        ([Math]::Round($Height * $scale))
}

$galleryRoot = Split-Path $PSScriptRoot -Parent
$repoRoot = Split-Path (Split-Path $galleryRoot -Parent) -Parent
$workRoot = Split-Path $repoRoot -Parent
if (
    $PackagedShellPositivePath -and
    [string]::IsNullOrWhiteSpace($PackagedGalleryLaunchCommand)
) {
    throw "-PackagedShellPositivePath requires -PackagedGalleryLaunchCommand pointing to an identity-enabled Gallery executable. The unpackaged 'node main.js' launch is not a packaged positive path."
}
if (-not $WinAppPath) {
    $WinAppPath = Join-Path $workRoot "winappCli\src\winapp-npm\bin\win-x64\winapp.exe"
}
if (-not (Test-Path $WinAppPath)) {
    throw "winapp.exe was not found at '$WinAppPath'."
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

function Invoke-LockSafeElement(
    [int64]$WindowHandle,
    [string]$Selector
) {
    for ($attempt = 1; $attempt -le 3; $attempt += 1) {
        & $WinAppPath ui invoke $Selector -w "$WindowHandle"
        if ($LASTEXITCODE -eq 0) {
            return
        }
        Start-Sleep -Milliseconds 150
    }
    if (-not $SkipKeyboardInput) {
        Invoke-WinApp @(
            "ui", "click", $Selector,
            "-w", "$WindowHandle"
        )
        return
    }
    throw "Element '$Selector' did not expose an invoke pattern."
}

function Get-VisibleButtonSelector(
    [int64]$WindowHandle,
    [string]$Name
) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds(
        $TimeoutMilliseconds
    )
    while ([DateTime]::UtcNow -lt $deadline) {
        $searchJson = Invoke-WinApp @(
            "ui", "search", $Name,
            "-w", "$WindowHandle",
            "--json"
        ) -Capture
        $match = @(
            ($searchJson | ConvertFrom-Json).matches
        ) | Where-Object {
            $_.type -eq "Button" -and
            $_.name -eq $Name -and
            -not $_.isOffscreen -and
            $_.isInvokable
        } | Select-Object -First 1
        if ($match) {
            return $match.selector
        }
        Start-Sleep -Milliseconds 100
    }
    throw "Invokable Button '$Name' was not found."
}

function Get-ElementName(
    [int64]$WindowHandle,
    [string]$AutomationId
) {
    $json = Invoke-WinApp @(
        "ui", "get-property", $AutomationId,
        "-w", "$WindowHandle",
        "--json"
    ) -Capture
    return ($json | ConvertFrom-Json).properties.Name
}

function Assert-ElementName(
    [int64]$WindowHandle,
    [string]$AutomationId,
    [string]$ExpectedName,
    [string]$Description
) {
    $actualName = Get-ElementName $WindowHandle $AutomationId
    if ($actualName -cne $ExpectedName) {
        throw "$Description reported '$actualName'; expected '$ExpectedName'."
    }
}

function Wait-ElementNameMatch(
    [int64]$WindowHandle,
    [string]$AutomationId,
    [string]$Pattern,
    [string]$Description
) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds(
        $TimeoutMilliseconds
    )
    $lastName = $null
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            $name = Get-ElementName $WindowHandle $AutomationId
            $lastName = $name
            if ($name -match $Pattern) {
                return $Matches
            }
        }
        catch {
        }
        Start-Sleep -Milliseconds 100
    }
    throw "$Description did not match '$Pattern'; last value was '$lastName'."
}

function Wait-IndexedControlledState(
    [int64]$WindowHandle,
    [string]$AutomationId,
    [string]$CaptureAutomationId,
    [int]$Expected,
    [string]$Description
) {
    Start-Sleep -Milliseconds 250
    Invoke-WinApp @(
        "ui", "invoke", $CaptureAutomationId,
        "-w", "$WindowHandle"
    )
    $match = Wait-ElementNameMatch `
        $WindowHandle `
        $AutomationId `
        "^signal=(-?\d+);native=(-?\d+);events=(\d+)$" `
        $Description
    $signalValue = [int]$match[1]
    $nativeValue = [int]$match[2]
    $events = [int]$match[3]
    if (
        $signalValue -ne $Expected -or
        $nativeValue -ne $Expected
    ) {
        throw "$Description settled at signal=$signalValue, native=$nativeValue; expected $Expected."
    }
    if ($events -gt 20) {
        throw "$Description produced $events selection events."
    }
}

function Wait-SemanticControlledState(
    [int64]$WindowHandle,
    [ValidateSet("in", "out")]
    [string]$Expected,
    [string]$Description
) {
    Start-Sleep -Milliseconds 350
    Invoke-WinApp @(
        "ui", "invoke", "GallerySemanticZoomCaptureControlled",
        "-w", "$WindowHandle"
    )
    $match = Wait-ElementNameMatch `
        $WindowHandle `
        "GallerySemanticZoomControlledStatus" `
        "^signal=(in|out);native=(in|out);events=(\d+)$" `
        $Description
    if (
        $match[1] -cne $Expected -or
        $match[2] -cne $Expected
    ) {
        throw "$Description settled at signal=$($match[1]), native=$($match[2]); expected $Expected."
    }
    if ([int]$match[3] -gt 20) {
        throw "$Description produced $($match[3]) view events."
    }
}

function Wait-ForGalleryWindow([int]$ProcessId) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $json = Invoke-WinApp @(
            "ui", "list-windows",
            "-a", "dynwinrt-jsx Gallery",
            "--json"
        ) -Capture
        $window = @($json | ConvertFrom-Json) |
            Where-Object { $_.processId -eq $ProcessId } |
            Select-Object -First 1
        if ($window) {
            return $window
        }
        Start-Sleep -Milliseconds 100
    }
    throw "The Gallery window did not appear within $TimeoutMilliseconds ms."
}

function Wait-ForProcessWindow(
    [int]$ProcessId,
    [string]$Title,
    [int64]$ExcludeHandle = 0
) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $json = Invoke-WinApp @(
            "ui", "list-windows",
            "-a", $Title,
            "--json"
        ) -Capture
        $window = @($json | ConvertFrom-Json) |
            Where-Object {
                $_.processId -eq $ProcessId -and
                [int64]$_.hwnd -ne $ExcludeHandle
            } |
            Select-Object -First 1
        if ($window) {
            return $window
        }
        Start-Sleep -Milliseconds 100
    }
    throw "The '$Title' window did not appear within $TimeoutMilliseconds ms."
}

function Assert-NoProcessWindow(
    [int]$ProcessId,
    [string]$Title,
    [int64]$ExcludeHandle = 0
) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $json = Invoke-WinApp @(
            "ui", "list-windows",
            "-a", $Title,
            "--json"
        ) -Capture
        $window = @($json | ConvertFrom-Json) |
            Where-Object {
                $_.processId -eq $ProcessId -and
                [int64]$_.hwnd -ne $ExcludeHandle
            } |
            Select-Object -First 1
        if (-not $window) {
            return
        }
        Start-Sleep -Milliseconds 100
    }
    throw "The '$Title' secondary window remained open after cleanup."
}

function Assert-Responsive([int]$ProcessId, [string]$Page) {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    if (-not $process.Responding) {
        throw "The Gallery stopped responding on '$Page'."
    }
}

function Wait-ForAnyText(
    [int64]$WindowHandle,
    [string[]]$Texts,
    [string]$Description
) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        foreach ($text in $Texts) {
            $json = & $WinAppPath ui search $text `
                -w "$WindowHandle" --json 2>$null
            if ($LASTEXITCODE -eq 0 -and $json) {
                $matches = @((($json -join "`n") | ConvertFrom-Json).matches)
                if ($matches.Count -gt 0) {
                    return $text
                }
            }
        }
        Start-Sleep -Milliseconds 100
    }
    throw "$Description did not report any expected truthful state: $($Texts -join '; ')"
}

function Get-UiTreeElements([object[]]$Nodes) {
    foreach ($node in @($Nodes)) {
        $node
        if (
            $node.PSObject.Properties.Name -contains "children" -and
            $node.children
        ) {
            Get-UiTreeElements @($node.children)
        }
    }
}

function Ensure-NavigationItem(
    [int64]$WindowHandle,
    [string]$Selector
) {
    & $WinAppPath ui wait-for $Selector -w "$WindowHandle" --timeout 100 *> $null
    if ($LASTEXITCODE -eq 0) {
        return
    }
    & $WinAppPath ui scroll-into-view $Selector -w "$WindowHandle" *> $null
    if ($LASTEXITCODE -eq 0) {
        return
    }
    Invoke-WinApp @(
        "ui", "invoke", "PART_PaneToggleButton",
        "-w", "$WindowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", $Selector,
        "-w", "$WindowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
}

function Invoke-GalleryRoute(
    [int64]$WindowHandle,
    [string]$Selector,
    [string]$Heading,
    [string]$ParentSelector = ""
) {
    for ($attempt = 1; $attempt -le 2; $attempt += 1) {
        & $WinAppPath ui wait-for $Selector `
            -w "$WindowHandle" `
            --timeout 100 *> $null
        if ($LASTEXITCODE -ne 0 -and $ParentSelector) {
            Invoke-WinApp @(
                "ui", "invoke", $ParentSelector,
                "-w", "$WindowHandle"
            )
        }
        Ensure-NavigationItem $WindowHandle $Selector
        Invoke-WinApp @(
            "ui", "invoke", $Selector,
            "-w", "$WindowHandle"
        )
        & $WinAppPath ui wait-for $Heading `
            -w "$WindowHandle" `
            --timeout "$TimeoutMilliseconds" *> $null
        if ($LASTEXITCODE -eq 0) {
            return
        }
    }
    throw "Gallery route '$Selector' did not show '$Heading' after two attempts."
}

if (-not $EvidenceRoot) {
    $EvidenceRoot = Join-Path $galleryRoot ".winapp\smoke"
}
$evidenceRoot = [IO.Path]::GetFullPath($EvidenceRoot)
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$stdoutPath = Join-Path $evidenceRoot "gallery.stdout.log"
$stderrPath = Join-Path $evidenceRoot "gallery.stderr.log"
$screenshotPath = Join-Path $evidenceRoot "gallery.png"
$homeScreenshotPath = Join-Path $evidenceRoot "home.png"
$allWideScreenshotPath = Join-Path $evidenceRoot "all-wide.png"
$allNarrowScreenshotPath = Join-Path $evidenceRoot "all-narrow.png"
$categoryScreenshotPath = Join-Path $evidenceRoot "basic-input-category.png"
$collectionsCategoryScreenshotPath = Join-Path $evidenceRoot "collections-category.png"
$dateTimeCategoryScreenshotPath = Join-Path $evidenceRoot "date-time-category.png"
$dialogsFlyoutsCategoryScreenshotPath = Join-Path $evidenceRoot "dialogs-flyouts-category.png"
$statusInfoCategoryScreenshotPath = Join-Path $evidenceRoot "status-info-category.png"
$layoutCategoryScreenshotPath = Join-Path $evidenceRoot "layout-category.png"
$menusToolbarsCategoryScreenshotPath = Join-Path $evidenceRoot "menus-toolbars-category.png"
$navigationCategoryScreenshotPath = Join-Path $evidenceRoot "navigation-category.png"
$scrollingCategoryScreenshotPath = Join-Path $evidenceRoot "scrolling-category.png"
$textCategoryScreenshotPath = Join-Path $evidenceRoot "text-category.png"
$fundamentalsCategoryScreenshotPath = Join-Path $evidenceRoot "fundamentals-category.png"
$designCategoryScreenshotPath = Join-Path $evidenceRoot "design-category.png"
$accessibilityCategoryScreenshotPath = Join-Path $evidenceRoot "accessibility-category.png"
$stylesCategoryScreenshotPath = Join-Path $evidenceRoot "styles-category.png"
$motionCategoryScreenshotPath = Join-Path $evidenceRoot "motion-category.png"
$windowingCategoryScreenshotPath = Join-Path $evidenceRoot "windowing-category.png"
$systemCategoryScreenshotPath = Join-Path $evidenceRoot "system-category.png"
$shellCategoryScreenshotPath = Join-Path $evidenceRoot "shell-category.png"
$sourceCodeScreenshotPath = Join-Path $evidenceRoot "source-code.png"
$smokeStatePath = Join-Path $evidenceRoot "state.json"
$heartbeatEvidencePath = Join-Path $evidenceRoot "heartbeat-timeout.json"
$inspectorExportPath = Join-Path $evidenceRoot "inspector-snapshot.json"
Remove-Item -Path $smokeStatePath -Force -ErrorAction SilentlyContinue
Remove-Item -Path $heartbeatEvidencePath -Force -ErrorAction SilentlyContinue
Remove-Item -Path $inspectorExportPath -Force -ErrorAction SilentlyContinue
$smokeInitialState = if ($RouterOnly) {
    '{"version":1,"count":0,"darkTheme":false,"updatedAt":null,"route":"toggle-switch","recentPageIds":["buttons","collections","overlays","range-progress","choices-status","layout","text-input","icons"],"favoritePageIds":["buttons","collections","overlays","range-progress","choices-status","layout","text-input","icons"]}'
}
elseif ($MotionOnly) {
    '{"version":1,"count":0,"darkTheme":false,"updatedAt":null,"route":"animation-interop","recentPageIds":["buttons","collections","overlays","range-progress","choices-status","layout","text-input","icons"],"favoritePageIds":["buttons","collections","overlays","range-progress","choices-status","layout","text-input","icons"]}'
}
elseif ($ControlledOnly) {
    '{"version":1,"count":0,"darkTheme":false,"updatedAt":null,"route":"' +
        $ControlledRoute +
        '","recentPageIds":["buttons","collections","overlays","range-progress","choices-status","layout","text-input","icons"],"favoritePageIds":["buttons","collections","overlays","range-progress","choices-status","layout","text-input","icons"]}'
}
else {
    '{"version":1,"count":0,"darkTheme":false,"updatedAt":null,"recentPageIds":["buttons","collections","overlays","range-progress","choices-status","layout","text-input","icons"],"favoritePageIds":["buttons","collections","overlays","range-progress","choices-status","layout","text-input","icons"]}'
}
[IO.File]::WriteAllText($smokeStatePath, $smokeInitialState)
$env:DYNWINRT_JSX_STATE_PATH = $smokeStatePath
$env:DYNWINRT_JSX_HEARTBEAT_PATH = $heartbeatEvidencePath
$env:DYNWINRT_JSX_INSPECTOR_EXPORT_PATH = $inspectorExportPath

if (-not $SkipBuild) {
    & npm.cmd --prefix $galleryRoot run build:dynwinrt
    if ($LASTEXITCODE -ne 0) {
        throw "Gallery dynwinrt preparation failed."
    }
    & npm.cmd --prefix $galleryRoot run build
    if ($LASTEXITCODE -ne 0) {
        throw "Gallery build failed."
    }
}

if ($PackagedShellPositivePath) {
    $packagedCommand = Get-Command `
        $PackagedGalleryLaunchCommand `
        -ErrorAction Stop
    $appProcess = Start-Process `
        -FilePath $packagedCommand.Source `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -PassThru
}
else {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $appProcess = Start-Process `
        -FilePath $nodePath `
        -ArgumentList "main.js" `
        -WorkingDirectory $galleryRoot `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -PassThru
}

$windowHandle = $null
try {
    $window = Wait-ForGalleryWindow $appProcess.Id
    $windowHandle = [int64]$window.hwnd
    Start-Sleep -Milliseconds 200
    $migratedState = Get-Content $smokeStatePath -Raw |
        ConvertFrom-Json
    if (
        $migratedState.recentPageIds -notcontains "button" -or
        $migratedState.favoritePageIds -notcontains "button" -or
        $migratedState.recentPageIds -notcontains "items-repeater" -or
        $migratedState.favoritePageIds -notcontains "items-repeater" -or
        $migratedState.recentPageIds -notcontains "content-dialog" -or
        $migratedState.favoritePageIds -notcontains "content-dialog" -or
        $migratedState.recentPageIds -notcontains "progress-bar" -or
        $migratedState.favoritePageIds -notcontains "progress-bar" -or
        $migratedState.recentPageIds -notcontains "info-bar" -or
        $migratedState.favoritePageIds -notcontains "info-bar" -or
        $migratedState.recentPageIds -notcontains "grid" -or
        $migratedState.favoritePageIds -notcontains "grid" -or
        $migratedState.recentPageIds -notcontains "text-box" -or
        $migratedState.favoritePageIds -notcontains "text-box" -or
        $migratedState.recentPageIds -notcontains "iconography" -or
        $migratedState.favoritePageIds -notcontains "iconography" -or
        $migratedState.recentPageIds -contains "buttons" -or
        $migratedState.favoritePageIds -contains "buttons" -or
        $migratedState.recentPageIds -contains "collections" -or
        $migratedState.favoritePageIds -contains "collections" -or
        $migratedState.recentPageIds -contains "overlays" -or
        $migratedState.favoritePageIds -contains "overlays" -or
        $migratedState.recentPageIds -contains "range-progress" -or
        $migratedState.favoritePageIds -contains "range-progress" -or
        $migratedState.recentPageIds -contains "choices-status" -or
        $migratedState.favoritePageIds -contains "choices-status" -or
        $migratedState.recentPageIds -contains "layout" -or
        $migratedState.favoritePageIds -contains "layout" -or
        $migratedState.recentPageIds -contains "text-input" -or
        $migratedState.favoritePageIds -contains "text-input" -or
        $migratedState.recentPageIds -contains "icons" -or
        $migratedState.favoritePageIds -contains "icons"
    ) {
        throw "Legacy Gallery page IDs were not migrated."
    }

    if ($RouterOnly) {
        Invoke-WinApp @(
            "ui", "wait-for", "ToggleSwitchPageHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Ensure-NavigationItem $windowHandle "GalleryBasicInputCategoryNavItem"
        Invoke-WinApp @(
            "ui", "invoke", "GalleryBasicInputCategoryNavItem",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "BasicInputCategoryPageHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "invoke", "Open ToggleSwitch",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "ToggleSwitchPageHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "invoke", "GalleryBasicInputCategoryNavItem",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "BasicInputCategoryPageHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Ensure-NavigationItem $windowHandle "GalleryFundamentalsCategoryNavItem"
        Invoke-WinApp @(
            "ui", "invoke", "GalleryFundamentalsCategoryNavItem",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "FundamentalsCategoryPageHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        for ($cycle = 1; $cycle -le 5; $cycle += 1) {
            Invoke-GalleryRoute `
                $windowHandle `
                "GallerybindingNavItem" `
                "BindingPageHeading" `
                "GalleryFundamentalsCategoryNavItem"
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryRenderError",
                "-w", "$windowHandle",
                "--gone",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-GalleryRoute `
                $windowHandle `
                "GallerytemplatesNavItem" `
                "TemplatesPageHeading" `
                "GalleryFundamentalsCategoryNavItem"
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryRenderError",
                "-w", "$windowHandle",
                "--gone",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        Invoke-WinApp @(
            "ui", "set-value", "TextBox", "multiple windows xaml",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "GallerySearchHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "set-value", "TextBox", "",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "GalleryHomeHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "invoke", "GalleryDiagnosticsNavItem",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "DiagnosticsPageHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @("ui", "invoke", "Settings", "-w", "$windowHandle")
        Invoke-WinApp @(
            "ui", "wait-for", "SettingsPageHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "invoke", "GalleryHomeNavItem",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "GalleryHomeHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @("ui", "invoke", "Close", "-w", "$windowHandle")
        if (-not $appProcess.WaitForExit($TimeoutMilliseconds)) {
            throw "The Gallery did not exit after Router smoke."
        }
        $windowHandle = 0
        if ($appProcess.ExitCode -ne 0) {
            throw "The Gallery Router smoke exited with code $($appProcess.ExitCode)."
        }
        $stdout = Get-Content $stdoutPath -Raw
        if ($stdout -notmatch "renderer disposed cleanly") {
            throw "The Gallery Router smoke did not report clean renderer disposal."
        }
        if (Test-Path $heartbeatEvidencePath) {
            throw "The Gallery Router smoke produced heartbeat timeout evidence."
        }
        Write-Host "Gallery Router smoke passed. Evidence: $evidenceRoot"
        return
    }

    if ($MotionOnly) {
        Invoke-WinApp @(
            "ui", "wait-for", "AnimationInteropPageHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "GalleryMotionAnimationInteropPopupTarget",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "invoke", "GalleryMotionAnimationInteropSpring",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "GalleryMotionAnimationInteropResult",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "invoke", "PART_BackButton",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "MotionCategoryPageHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "invoke", "PART_BackButton",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "GalleryHomeHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "GalleryRenderError",
            "-w", "$windowHandle",
            "--gone",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @("ui", "invoke", "Close", "-w", "$windowHandle")
        if (-not $appProcess.WaitForExit($TimeoutMilliseconds)) {
            throw "The Gallery did not exit after Motion smoke."
        }
        $windowHandle = 0
        if ($appProcess.ExitCode -ne 0) {
            throw "The Gallery Motion smoke exited with code $($appProcess.ExitCode)."
        }
        $stdout = Get-Content $stdoutPath -Raw
        if ($stdout -notmatch "renderer disposed cleanly") {
            throw "The Gallery Motion smoke did not report clean renderer disposal."
        }
        if (Test-Path $heartbeatEvidencePath) {
            throw "The Gallery Motion smoke produced heartbeat timeout evidence."
        }
        Write-Host "Gallery Motion smoke passed. Evidence: $evidenceRoot"
        return
    }

    if ($ControlledOnly) {
        switch ($ControlledRoute) {
            "pivot" {
                Invoke-WinApp @(
                    "ui", "wait-for", "PivotPageHeading",
                    "-w", "$windowHandle",
                    "--timeout", "$TimeoutMilliseconds"
                )
                Wait-IndexedControlledState `
                $windowHandle `
                "GalleryPivotControlledStatus" `
                "GalleryPivotCaptureControlled" `
                0 `
                "Pivot initial controlled state"
            Invoke-WinApp @(
                "ui", "invoke", "GalleryPivotProgrammaticUrgent",
                "-w", "$windowHandle"
            )
            Wait-IndexedControlledState `
                $windowHandle `
                "GalleryPivotControlledStatus" `
                "GalleryPivotCaptureControlled" `
                3 `
                "Pivot Signal update"
            Invoke-WinApp @(
                "ui", "invoke", "GalleryPivotFlagged",
                "-w", "$windowHandle"
            )
            Wait-IndexedControlledState `
                $windowHandle `
                "GalleryPivotControlledStatus" `
                "GalleryPivotCaptureControlled" `
                2 `
                "Pivot native update"
            Invoke-WinApp @(
                "ui", "invoke", "GalleryPivotRapidSelection",
                "-w", "$windowHandle"
            )
            Wait-IndexedControlledState `
                $windowHandle `
                "GalleryPivotControlledStatus" `
                "GalleryPivotCaptureControlled" `
                0 `
                "Pivot rapid update"
            }
            "tab-view" {
                Invoke-WinApp @(
                "ui", "wait-for", "TabViewPageHeading",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
                )
                Wait-IndexedControlledState `
                $windowHandle `
                "GalleryTabViewControlledStatus" `
                "GalleryTabViewCaptureControlled" `
                0 `
                "TabView initial controlled state"
                Invoke-WinApp @(
                "ui", "invoke", "GalleryTabViewSelectDocument2",
                "-w", "$windowHandle"
                )
                Wait-IndexedControlledState `
                $windowHandle `
                "GalleryTabViewControlledStatus" `
                "GalleryTabViewCaptureControlled" `
                2 `
                "TabView Signal update"
                Invoke-WinApp @(
                "ui", "invoke", "GalleryTabViewTab1",
                "-w", "$windowHandle"
                )
                Wait-IndexedControlledState `
                $windowHandle `
                "GalleryTabViewControlledStatus" `
                "GalleryTabViewCaptureControlled" `
                1 `
                "TabView native update"
                Invoke-WinApp @(
                "ui", "invoke", "GalleryTabViewRapidSelection",
                "-w", "$windowHandle"
                )
                Wait-IndexedControlledState `
                $windowHandle `
                "GalleryTabViewControlledStatus" `
                "GalleryTabViewCaptureControlled" `
                0 `
                "TabView rapid update"
            }
            "semantic-zoom" {
                Invoke-WinApp @(
                "ui", "wait-for", "SemanticZoomPageHeading",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
                )
                Wait-SemanticControlledState `
                $windowHandle `
                "in" `
                "SemanticZoom initial controlled state"
                Invoke-WinApp @(
                "ui", "invoke", "GallerySemanticZoomSignalOut",
                "-w", "$windowHandle"
                )
                Wait-SemanticControlledState `
                $windowHandle `
                "out" `
                "SemanticZoom Signal out"
                Invoke-WinApp @(
                "ui", "invoke", "GallerySemanticZoomSignalIn",
                "-w", "$windowHandle"
                )
                Wait-SemanticControlledState `
                $windowHandle `
                "in" `
                "SemanticZoom Signal in"
                Invoke-WinApp @(
                "ui", "invoke", "GallerySemanticZoomRapidViews",
                "-w", "$windowHandle"
                )
                Wait-SemanticControlledState `
                $windowHandle `
                "out" `
                "SemanticZoom rapid update"
                Invoke-WinApp @(
                "ui", "invoke", "GallerySemanticZoomToggle",
                "-w", "$windowHandle"
                )
                Wait-SemanticControlledState `
                $windowHandle `
                "in" `
                "SemanticZoom native update"
            }
            "tree-view" {
                Invoke-WinApp @(
                "ui", "wait-for", "TreeViewPageHeading",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
                )
                Invoke-WinApp @(
                "ui", "invoke", "GalleryTreeViewSelectTwo",
                "-w", "$windowHandle"
                )
                Start-Sleep -Milliseconds 250
                Invoke-WinApp @(
                "ui", "invoke", "GalleryTreeViewCaptureControlled",
                "-w", "$windowHandle"
                )
                $null = Wait-ElementNameMatch `
                $windowHandle `
                "GalleryTreeViewControlledStatus" `
                "^selected=8;events=0$" `
                "TreeView programmatic selection"
                Invoke-WinApp @(
                "ui", "invoke", "GalleryTreeViewClearSelection",
                "-w", "$windowHandle"
                )
                Start-Sleep -Milliseconds 250
                Invoke-WinApp @(
                "ui", "invoke", "GalleryTreeViewCaptureControlled",
                "-w", "$windowHandle"
                )
                $null = Wait-ElementNameMatch `
                $windowHandle `
                "GalleryTreeViewControlledStatus" `
                "^selected=0;events=0$" `
                "TreeView selection clear"
            }
        }
        Invoke-WinApp @(
            "ui", "wait-for", "GalleryRenderError",
            "-w", "$windowHandle",
            "--gone",
            "--timeout", "$TimeoutMilliseconds"
        )

        Invoke-WinApp @(
            "ui", "invoke", "Close",
            "-w", "$windowHandle"
        )
        if (-not $appProcess.WaitForExit($TimeoutMilliseconds)) {
            throw "The Gallery did not exit after controlled-value smoke."
        }
        $windowHandle = 0
        if ($appProcess.ExitCode -ne 0) {
            throw "The Gallery controlled-value smoke exited with code $($appProcess.ExitCode)."
        }
        $stdout = Get-Content $stdoutPath -Raw
        if ($stdout -notmatch "renderer disposed cleanly") {
            throw "The Gallery controlled-value smoke did not report clean renderer disposal."
        }
        if (Test-Path $heartbeatEvidencePath) {
            throw "The Gallery controlled-value smoke produced heartbeat timeout evidence."
        }
        Write-Host "Gallery $ControlledRoute controlled-value smoke passed. Evidence: $evidenceRoot"
        return
    }

    if (-not (
        $ClipboardOnly -or
        $SystemOnly -or
        $ShellOnly -or
        $DesignOnly
    )) {
    Ensure-NavigationItem $windowHandle "GalleryAllControlsNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryAllControlsNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "AllControlsPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Set-GalleryWindowEffectiveSize $windowHandle 1280 820
    Invoke-WinApp @(
        "ui", "wait-for", "AllControlsPageHeading",
        "-w", "$windowHandle",
        "--property", "HelpText",
        "--value", "Catalog layout: wide;",
        "--contains",
        "--timeout", "$TimeoutMilliseconds"
    )
    $allWideLayoutJson = Invoke-WinApp @(
        "ui", "get-property", "AllControlsPageHeading",
        "-w", "$windowHandle",
        "--json"
    ) -Capture
    $allWideLayout = (
        $allWideLayoutJson | ConvertFrom-Json
    ).properties.HelpText
    if (
        [string]$allWideLayout -notmatch
        "^Catalog layout: wide; columns=[2-9][0-9]*; cardWidth=300; cardHeight=96$"
    ) {
        throw "The All catalog did not report a wide multi-column layout: '$allWideLayout'."
    }
    $allWideJson = Invoke-WinApp @(
        "ui", "search", "Open AcrylicBrush",
        "-w", "$windowHandle",
        "--json"
    ) -Capture
    $allWideCard = @(
        ($allWideJson | ConvertFrom-Json).matches
    ) | Where-Object {
        $_.type -eq "Button" -and
        $_.name -eq "Open AcrylicBrush"
    } | Select-Object -First 1
    $allWideAnimatedJson = Invoke-WinApp @(
        "ui", "search", "Open AnimatedIcon",
        "-w", "$windowHandle",
        "--json"
    ) -Capture
    $allWideAnimated = @(
        ($allWideAnimatedJson | ConvertFrom-Json).matches
    ) | Where-Object {
        $_.type -eq "Button" -and
        $_.name -eq "Open AnimatedIcon"
    } | Select-Object -First 1
    if (
        -not $allWideCard -or
        -not $allWideAnimated -or
        [Math]::Abs(
            [double]$allWideCard.y -
            [double]$allWideAnimated.y
        ) -gt 1 -or
        [Math]::Abs(
            [double]$allWideCard.x -
            [double]$allWideAnimated.x
        ) -lt 1
    ) {
        throw "The wide All catalog did not place its first cards in one row."
    }
    $webViewJson = Invoke-WinApp @(
        "ui", "search", "Open WebView2",
        "-w", "$windowHandle",
        "--json"
    ) -Capture
    $webViewCard = @(
        ($webViewJson | ConvertFrom-Json).matches
    ) | Where-Object {
        $_.type -eq "Button" -and
        $_.name -eq "Open WebView2"
    } | Select-Object -First 1
    if (-not $webViewCard -or $webViewCard.isEnabled) {
        throw "The deferred WebView2 catalog card was not disabled."
    }
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $allWideScreenshotPath
    )

    Set-GalleryWindowEffectiveSize $windowHandle 640 820
    Invoke-WinApp @(
        "ui", "wait-for", "AllControlsPageHeading",
        "-w", "$windowHandle",
        "--property", "HelpText",
        "--value", "Catalog layout: narrow;",
        "--contains",
        "--timeout", "$TimeoutMilliseconds"
    )
    $allNarrowLayoutJson = Invoke-WinApp @(
        "ui", "get-property", "AllControlsPageHeading",
        "-w", "$windowHandle",
        "--json"
    ) -Capture
    $allNarrowLayout = (
        $allNarrowLayoutJson | ConvertFrom-Json
    ).properties.HelpText
    if (
        [string]$allNarrowLayout -notmatch
        "^Catalog layout: narrow; columns=1; cardWidth=[0-9]+; cardHeight=120$"
    ) {
        throw "The All catalog did not report a narrow one-column layout: '$allNarrowLayout'."
    }
    $allNarrowAcrylicJson = Invoke-WinApp @(
        "ui", "search", "Open AcrylicBrush",
        "-w", "$windowHandle",
        "--json"
    ) -Capture
    $allNarrowAnimatedJson = Invoke-WinApp @(
        "ui", "search", "Open AnimatedIcon",
        "-w", "$windowHandle",
        "--json"
    ) -Capture
    $allNarrowAcrylic = @(
        ($allNarrowAcrylicJson | ConvertFrom-Json).matches
    ) | Where-Object {
        $_.type -eq "Button" -and
        $_.name -eq "Open AcrylicBrush"
    } | Select-Object -First 1
    $allNarrowAnimated = @(
        ($allNarrowAnimatedJson | ConvertFrom-Json).matches
    ) | Where-Object {
        $_.type -eq "Button" -and
        $_.name -eq "Open AnimatedIcon"
    } | Select-Object -First 1
    if (
        -not $allNarrowAcrylic -or
        -not $allNarrowAnimated -or
        [Math]::Abs(
            [double]$allNarrowAcrylic.x -
            [double]$allNarrowAnimated.x
        ) -gt 1 -or
        [double]$allNarrowAnimated.y -le
        [double]$allNarrowAcrylic.y
    ) {
        throw "The narrow All catalog did not switch to one-column 120px cards."
    }
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $allNarrowScreenshotPath
    )
    Set-GalleryWindowSize $windowHandle $window.width $window.height

    Ensure-NavigationItem $windowHandle "GalleryBasicInputCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryBasicInputCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "BasicInputCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open Button",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $categoryScreenshotPath
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open ToggleSwitch",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "invoke", "Open ToggleSwitch",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "ToggleSwitchPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )

    Ensure-NavigationItem $windowHandle "GalleryCollectionsCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryCollectionsCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "CollectionsCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open FlipView",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $collectionsCategoryScreenshotPath
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open TreeView",
        "-w", "$windowHandle"
    )

    Ensure-NavigationItem $windowHandle "GalleryDateTimeCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryDateTimeCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "DateTimeCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open CalendarDatePicker",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $dateTimeCategoryScreenshotPath
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open TimePicker",
        "-w", "$windowHandle"
    )

    Ensure-NavigationItem $windowHandle "GalleryDialogsFlyoutsCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryDialogsFlyoutsCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "DialogsFlyoutsCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open ContentDialog",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $dialogsFlyoutsCategoryScreenshotPath
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open TeachingTip",
        "-w", "$windowHandle"
    )

    Ensure-NavigationItem $windowHandle "GalleryStatusInfoCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryStatusInfoCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "StatusInfoCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open InfoBadge",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $statusInfoCategoryScreenshotPath
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open ToolTip",
        "-w", "$windowHandle"
    )

    Ensure-NavigationItem $windowHandle "GalleryLayoutCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryLayoutCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "LayoutCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open Border",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $layoutCategoryScreenshotPath
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open Viewbox",
        "-w", "$windowHandle"
    )

    Ensure-NavigationItem $windowHandle "GalleryMenusToolbarsCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryMenusToolbarsCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "MenusToolbarsCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open AppBarButton",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $menusToolbarsCategoryScreenshotPath
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open XamlUICommand",
        "-w", "$windowHandle"
    )

    Ensure-NavigationItem $windowHandle "GalleryNavigationCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryNavigationCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "NavigationCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open BreadcrumbBar",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $navigationCategoryScreenshotPath
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open TabView",
        "-w", "$windowHandle"
    )

    Ensure-NavigationItem $windowHandle "GalleryScrollingCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryScrollingCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "ScrollingCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open AnnotatedScrollBar",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $scrollingCategoryScreenshotPath
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open SemanticZoom",
        "-w", "$windowHandle"
    )

    Ensure-NavigationItem $windowHandle "GalleryTextCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryTextCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "TextCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open AutoSuggestBox",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $textCategoryScreenshotPath
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open TextBox",
        "-w", "$windowHandle"
    )

    Ensure-NavigationItem $windowHandle "GalleryFundamentalsCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryFundamentalsCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "FundamentalsCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open Resources",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $fundamentalsCategoryScreenshotPath
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open Scratch Pad",
        "-w", "$windowHandle"
    )

    Ensure-NavigationItem $windowHandle "GalleryDesignCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryDesignCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "DesignCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open Color",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $designCategoryScreenshotPath
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open Typography",
        "-w", "$windowHandle"
    )

    Ensure-NavigationItem $windowHandle "GalleryAccessibilityCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryAccessibilityCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "AccessibilityCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open Color Contrast",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $accessibilityCategoryScreenshotPath
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open Screen Reader",
        "-w", "$windowHandle"
    )

    Ensure-NavigationItem $windowHandle "GalleryStylesCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryStylesCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "StylesCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open AcrylicBrush",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $stylesCategoryScreenshotPath
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open ThemeShadow",
        "-w", "$windowHandle"
    )

    Ensure-NavigationItem $windowHandle "GalleryMediaCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryMediaCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "MediaCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open AnimatedVisualPlayer",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open Sound",
        "-w", "$windowHandle"
    )

    Ensure-NavigationItem $windowHandle "GalleryMotionCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryMotionCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "MotionCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open Animation interop",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "Open ParallaxView",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $motionCategoryScreenshotPath
    )

    Ensure-NavigationItem $windowHandle "GalleryWindowingCategoryNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryWindowingCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "WindowingCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "GalleryOpenPage-app-window",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "GalleryOpenPage-title-bar",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $windowingCategoryScreenshotPath
    )
    }

    if (-not $ShellOnly) {
    Ensure-NavigationItem $windowHandle "GallerySystemCategoryNavItem"
    Invoke-WinApp @(
        "ui", "scroll-into-view", "GallerySystemCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "invoke", "GallerySystemCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "SystemCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "GalleryOpenPage-clipboard",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "GalleryOpenPage-storage-pickers",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $systemCategoryScreenshotPath
    )
    }

    if (-not ($ClipboardOnly -or $SystemOnly)) {
    Ensure-NavigationItem $windowHandle "GalleryShellCategoryNavItem"
    Invoke-WinApp @(
        "ui", "scroll-into-view", "GalleryShellCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "invoke", "GalleryShellCategoryNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "ShellCategoryPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "GalleryOpenPage-app-notifications",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "scroll-into-view", "GalleryOpenPage-jump-list",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $shellCategoryScreenshotPath
    )
    }

    $routes = @(
        [pscustomobject]@{ Name = "Open Signals and control flow"; Heading = "SignalsPageHeading"; Probe = $null; Query = "reactivity" },
        [pscustomobject]@{ Name = "Open Button"; Heading = "ButtonPageHeading"; Probe = $null; Query = "click command" },
        [pscustomobject]@{ Name = "Open DropDownButton"; Heading = "DropDownButtonPageHeading"; Probe = $null; Query = "dropdownbutton" },
        [pscustomobject]@{ Name = "Open HyperlinkButton"; Heading = "HyperlinkButtonPageHeading"; Probe = $null; Query = "hyperlinkbutton" },
        [pscustomobject]@{ Name = "Open RepeatButton"; Heading = "RepeatButtonPageHeading"; Probe = $null; Query = "repeatbutton" },
        [pscustomobject]@{ Name = "Open ToggleButton"; Heading = "ToggleButtonPageHeading"; Probe = $null; Query = "togglebutton" },
        [pscustomobject]@{ Name = "Open SplitButton"; Heading = "SplitButtonPageHeading"; Probe = $null; Query = "splitbutton" },
        [pscustomobject]@{ Name = "Open ToggleSplitButton"; Heading = "ToggleSplitButtonPageHeading"; Probe = $null; Query = "togglesplitbutton" },
        [pscustomobject]@{ Name = "Open CheckBox"; Heading = "CheckBoxPageHeading"; Probe = $null; Query = "three state checkbox" },
        [pscustomobject]@{ Name = "Open ColorPicker"; Heading = "ColorPickerPageHeading"; Probe = $null; Query = "colorpicker spectrum" },
        [pscustomobject]@{ Name = "Open ComboBox"; Heading = "ComboBoxPageHeading"; Probe = $null; Query = "combobox picker" },
        [pscustomobject]@{ Name = "Open RadioButton"; Heading = "RadioButtonPageHeading"; Probe = $null; Query = "radiobutton choice" },
        [pscustomobject]@{ Name = "Open RatingControl"; Heading = "RatingControlPageHeading"; Probe = $null; Query = "ratingcontrol stars" },
        [pscustomobject]@{ Name = "Open Slider"; Heading = "SliderPageHeading"; Probe = $null; Query = "slider ticks" },
        [pscustomobject]@{ Name = "Open ToggleSwitch"; Heading = "ToggleSwitchPageHeading"; Probe = $null; Query = "toggleswitch" },
        [pscustomobject]@{ Name = "Open Selection controls"; Heading = "SelectionPageHeading"; Probe = "GalleryControlledListViewSample"; Query = "listview" },
        [pscustomobject]@{ Name = "Open InfoBadge"; Heading = "InfoBadgePageHeading"; Probe = "GalleryInfoBadgeDynamic"; Query = "infobadge count" },
        [pscustomobject]@{ Name = "Open InfoBar"; Heading = "InfoBarPageHeading"; Probe = "GalleryInfoBarSeverityControl"; Query = "infobar severity" },
        [pscustomobject]@{ Name = "Open ProgressBar"; Heading = "ProgressBarPageHeading"; Probe = "GalleryProgressBarDeterminate"; Query = "progressbar paused" },
        [pscustomobject]@{ Name = "Open ProgressRing"; Heading = "ProgressRingPageHeading"; Probe = "GalleryProgressRingDeterminate"; Query = "progressring activity" },
        [pscustomobject]@{ Name = "Open ToolTip"; Heading = "ToolTipPageHeading"; Probe = "GalleryToolTipSimpleButton"; Query = "tooltip placement" },
        [pscustomobject]@{ Name = "Open FlipView"; Heading = "FlipViewPageHeading"; Probe = "GalleryCollectionsFlipViewSample"; Query = "flipview carousel" },
        [pscustomobject]@{ Name = "Open GridView"; Heading = "GridViewPageHeading"; Probe = "GalleryCollectionsGridViewSample"; Query = "gridview tiles" },
        [pscustomobject]@{ Name = "Open ItemsRepeater"; Heading = "ItemsRepeaterPageHeading"; Probe = "GalleryCollectionsItemsRepeaterSample"; Query = "itemsrepeater virtualization" },
        [pscustomobject]@{ Name = "Open ItemsView"; Heading = "ItemsViewPageHeading"; Probe = "GalleryCollectionsItemsViewSample"; Query = "itemsview layout" },
        [pscustomobject]@{ Name = "Open ListView"; Heading = "ListViewPageHeading"; Probe = "GalleryCollectionsListViewSelectionSample"; Query = "listview filter" },
        [pscustomobject]@{ Name = "Open PullToRefresh"; Heading = "PullToRefreshPageHeading"; Probe = "GalleryCollectionsPullToRefreshSample"; Query = "refreshcontainer" },
        [pscustomobject]@{ Name = "Open TreeView"; Heading = "TreeViewPageHeading"; Probe = "GalleryCollectionsTreeViewSample"; Query = "treeview hierarchy" },
        [pscustomobject]@{ Name = "Open CalendarDatePicker"; Heading = "CalendarDatePickerPageHeading"; Probe = "GalleryCalendarDatePickerControl"; Query = "calendardatepicker" },
        [pscustomobject]@{ Name = "Open CalendarView"; Heading = "CalendarViewPageHeading"; Probe = "GalleryCalendarViewControl"; Query = "calendarview language" },
        [pscustomobject]@{ Name = "Open DatePicker"; Heading = "DatePickerPageHeading"; Probe = "GalleryDatePickerFormattedControl"; Query = "datepicker year" },
        [pscustomobject]@{ Name = "Open TimePicker"; Heading = "TimePickerPageHeading"; Probe = "GalleryTimePicker24HourControl"; Query = "timepicker clock" },
        [pscustomobject]@{ Name = "Open ContentDialog"; Heading = "ContentDialogPageHeading"; Probe = "GalleryContentDialogDefaultShow"; Query = "contentdialog modal" },
        [pscustomobject]@{ Name = "Open Flyout"; Heading = "FlyoutPageHeading"; Probe = "GalleryFlyoutShow"; Query = "flyout confirmation" },
        [pscustomobject]@{ Name = "Open Popup"; Heading = "PopupPageHeading"; Probe = "GalleryPopupShow"; Query = "popup offset" },
        [pscustomobject]@{ Name = "Open TeachingTip"; Heading = "TeachingTipPageHeading"; Probe = "GalleryTeachingTipTargetedShow"; Query = "teachingtip guidance" },
        [pscustomobject]@{ Name = "Open Border"; Heading = "BorderPageHeading"; Probe = "GalleryLayoutBorderSample"; Query = "border thickness" },
        [pscustomobject]@{ Name = "Open Canvas"; Heading = "CanvasPageHeading"; Probe = "GalleryLayoutCanvasSample"; Query = "canvas zindex" },
        [pscustomobject]@{ Name = "Open Expander"; Heading = "ExpanderPageHeading"; Probe = "GalleryLayoutExpanderDirectionSample"; Query = "expander" },
        [pscustomobject]@{ Name = "Open Grid"; Heading = "GridPageHeading"; Probe = "GalleryLayoutGridSample"; Query = "grid spacing" },
        [pscustomobject]@{ Name = "Open RelativePanel"; Heading = "RelativePanelPageHeading"; Probe = "GalleryLayoutRelativePanelSample"; Query = "relativepanel align" },
        [pscustomobject]@{ Name = "Open SplitView"; Heading = "SplitViewPageHeading"; Probe = "GalleryLayoutSplitViewSample"; Query = "splitview pane" },
        [pscustomobject]@{ Name = "Open StackPanel"; Heading = "StackPanelPageHeading"; Probe = "GalleryLayoutStackPanelSample"; Query = "stackpanel spacing" },
        [pscustomobject]@{ Name = "Open VariableSizedWrapGrid"; Heading = "VariableSizedWrapGridPageHeading"; Probe = "GalleryLayoutVariableSizedWrapGridSample"; Query = "variablesizedwrapgrid span" },
        [pscustomobject]@{ Name = "Open Viewbox"; Heading = "ViewboxPageHeading"; Probe = "GalleryLayoutViewboxSample"; Query = "viewbox stretch" },
        [pscustomobject]@{ Name = "Open AnimatedVisualPlayer"; Heading = "AnimatedVisualPlayerPageHeading"; Probe = "GalleryMediaAnimatedVisualPlayerSample"; Query = "animatedvisualplayer motion graphics" },
        [pscustomobject]@{ Name = "Open Capture Element / Camera Preview"; Heading = "CaptureElementPreviewPageHeading"; Probe = "GalleryMediaCameraSample"; Query = "camera preview" },
        [pscustomobject]@{ Name = "Open Image"; Heading = "ImagePageHeading"; Probe = "GalleryMediaImageLocalSample"; Query = "image bitmap gif svg" },
        [pscustomobject]@{ Name = "Open MapControl"; Heading = "MapControlPageHeading"; Probe = "GalleryMediaMapControlSample"; Query = "mapcontrol azure maps" },
        [pscustomobject]@{ Name = "Open MediaPlayerElement"; Heading = "MediaPlayerElementPageHeading"; Probe = "GalleryMediaPlayerTransportSample"; Query = "mediaplayerelement video" },
        [pscustomobject]@{ Name = "Open PersonPicture"; Heading = "PersonPicturePageHeading"; Probe = "GalleryMediaPersonPictureSample"; Query = "personpicture avatar" },
        [pscustomobject]@{ Name = "Open Sound"; Heading = "SoundPageHeading"; Probe = "GalleryMediaSoundToggleSample"; Query = "elementsoundplayer audio" },
        [pscustomobject]@{ Name = "Open Animation interop"; Heading = "AnimationInteropPageHeading"; Probe = "GalleryMotionAnimationInteropStatus"; Query = "composition expression interop" },
        [pscustomobject]@{ Name = "Open Connected Animation"; Heading = "ConnectedAnimationPageHeading"; Probe = "GalleryMotionConnectedAnimationStatus"; Query = "connected animation continuity" },
        [pscustomobject]@{ Name = "Open Easing Functions"; Heading = "EasingFunctionsPageHeading"; Probe = "GalleryMotionEasingStatus"; Query = "easing animation curve velocity" },
        [pscustomobject]@{ Name = "Open Implicit Transitions"; Heading = "ImplicitTransitionsPageHeading"; Probe = "GalleryMotionImplicitTransitionsStatus"; Query = "implicit property transition" },
        [pscustomobject]@{ Name = "Open Page Transitions"; Heading = "PageTransitionsPageHeading"; Probe = "GalleryMotionPageTransitionsStatus"; Query = "navigationtransitioninfo page transition" },
        [pscustomobject]@{ Name = "Open Theme Transitions"; Heading = "ThemeTransitionsPageHeading"; Probe = "GalleryMotionThemeTransitionsStatus"; Query = "theme entrance popup transition" },
        [pscustomobject]@{ Name = "Open ParallaxView"; Heading = "ParallaxViewPageHeading"; Probe = "GalleryMotionParallaxStatus"; Query = "parallaxview scrolling effect" },
        [pscustomobject]@{ Name = "Open AppWindow"; Heading = "AppWindowPageHeading"; Probe = "GalleryWindowingAppWindowGeneralSample"; Query = "appwindow presenter" },
        [pscustomobject]@{ Name = "Open AppWindowTitleBar"; Heading = "AppWindowTitleBarPageHeading"; Probe = "GalleryWindowingAppWindowTitleBarColorsSample"; Query = "appwindowtitlebar caption" },
        [pscustomobject]@{ Name = "Open Multiple windows"; Heading = "MultipleWindowsPageHeading"; Probe = "GalleryWindowingMultipleWindowsSample"; Query = "multiple windows xaml" },
        [pscustomobject]@{ Name = "Open TitleBar"; Heading = "TitleBarPageHeading"; Probe = "GalleryWindowingTitleBarConfigurationSample"; Query = "titlebar drag region" },
        [pscustomobject]@{ Name = "Open ContentIsland"; Heading = "ContentIslandPageHeading"; Probe = "GallerySystemContentIslandSample"; Query = "content island hosting" },
        [pscustomobject]@{ Name = "Open Storage pickers"; Heading = "StoragePickersPageHeading"; Probe = "GallerySystemStoragePickerCapabilitySample"; Query = "file picker folderpicker" },
        [pscustomobject]@{ Name = "Open Clipboard"; Heading = "ClipboardPageHeading"; Probe = "GallerySystemClipboardTextSample"; Query = "clipboard copy paste" },
        [pscustomobject]@{ Name = "Open App notifications"; Heading = "AppNotificationsPageHeading"; Probe = "GalleryShellAppNotificationCapabilitySample"; Query = "toast notification center" },
        [pscustomobject]@{ Name = "Open Badge notifications"; Heading = "BadgeNotificationsPageHeading"; Probe = "GalleryShellBadgeCapabilitySample"; Query = "taskbar badge" },
        [pscustomobject]@{ Name = "Open JumpList"; Heading = "JumpListPageHeading"; Probe = "GalleryShellJumpListCapabilitySample"; Query = "jump list taskbar" },
        [pscustomobject]@{ Name = "Open AppBarButton"; Heading = "AppBarButtonPageHeading"; Probe = "GalleryMenusAppBarButtonBasicSample"; Query = "appbarbutton command" },
        [pscustomobject]@{ Name = "Open AppBarSeparator"; Heading = "AppBarSeparatorPageHeading"; Probe = "GalleryMenusAppBarSeparatorSample"; Query = "appbarseparator commandbar" },
        [pscustomobject]@{ Name = "Open AppBarToggleButton"; Heading = "AppBarToggleButtonPageHeading"; Probe = "GalleryAppBarToggleButtonControl"; Query = "appbartogglebutton toggle" },
        [pscustomobject]@{ Name = "Open CommandBar"; Heading = "CommandBarPageHeading"; Probe = "GalleryCommandBarControl"; Query = "commandbar overflow" },
        [pscustomobject]@{ Name = "Open CommandBarFlyout"; Heading = "CommandBarFlyoutPageHeading"; Probe = "GalleryCommandBarFlyoutShow"; Query = "commandbarflyout context" },
        [pscustomobject]@{ Name = "Open MenuBar"; Heading = "MenuBarPageHeading"; Probe = "GalleryMenuBarControl"; Query = "menubar submenu" },
        [pscustomobject]@{ Name = "Open MenuFlyout"; Heading = "MenuFlyoutPageHeading"; Probe = "GalleryMenuFlyoutBasicShow"; Query = "menuflyout radio" },
        [pscustomobject]@{ Name = "Open SwipeControl"; Heading = "SwipeControlPageHeading"; Probe = "GalleryMenusSwipeRevealSample"; Query = "swipecontrol reveal" },
        [pscustomobject]@{ Name = "Open StandardUICommand"; Heading = "StandardUICommandPageHeading"; Probe = "GalleryStandardUICommandButton"; Query = "standarduicommand delete" },
        [pscustomobject]@{ Name = "Open XamlUICommand"; Heading = "XamlUICommandPageHeading"; Probe = "GalleryXamlUICommandPrimary"; Query = "xamluicommand reusable" },
        [pscustomobject]@{ Name = "Open BreadcrumbBar"; Heading = "BreadcrumbBarPageHeading"; Probe = "GalleryBreadcrumbBarControl"; Query = "breadcrumbbar path" },
        [pscustomobject]@{ Name = "Open NavigationView"; Heading = "NavigationViewPageHeading"; Probe = "GalleryNavigationViewControl"; Query = "navigationview pane" },
        [pscustomobject]@{ Name = "Open Pivot"; Heading = "PivotPageHeading"; Probe = "GalleryPivotControl"; Query = "pivot tabbed" },
        [pscustomobject]@{ Name = "Open SelectorBar"; Heading = "SelectorBarPageHeading"; Probe = "GallerySelectorBarControl"; Query = "selectorbar segmented" },
        [pscustomobject]@{ Name = "Open TabView"; Heading = "TabViewPageHeading"; Probe = "GalleryTabViewControl"; Query = "tabview documents" },
        [pscustomobject]@{ Name = "Open AnnotatedScrollBar"; Heading = "AnnotatedScrollBarPageHeading"; Probe = "GalleryAnnotatedScrollBarSample"; Query = "annotatedscrollbar labels" },
        [pscustomobject]@{ Name = "Open PipsPager"; Heading = "PipsPagerPageHeading"; Probe = "GalleryPipsPagerControl"; Query = "pipspager pagination" },
        [pscustomobject]@{ Name = "GalleryOpenPage-scroll-view"; Heading = "ScrollViewPageHeading"; Probe = "GalleryScrollViewSample"; Query = "scrollview pan zoom" },
        [pscustomobject]@{ Name = "GalleryOpenPage-scroll-viewer"; Heading = "ScrollViewerPageHeading"; Probe = "GalleryScrollViewerSample"; Query = "scrollviewer viewport" },
        [pscustomobject]@{ Name = "Open SemanticZoom"; Heading = "SemanticZoomPageHeading"; Probe = "GallerySemanticZoomSample"; Query = "semanticzoom grouped" },
        [pscustomobject]@{ Name = "Open AutoSuggestBox"; Heading = "AutoSuggestBoxPageHeading"; Probe = "GalleryAutoSuggestBoxInput"; Query = "autosuggestbox query" },
        [pscustomobject]@{ Name = "Open NumberBox"; Heading = "NumberBoxPageHeading"; Probe = "GalleryNumberBoxInput"; Query = "numberbox expression" },
        [pscustomobject]@{ Name = "Open PasswordBox"; Heading = "PasswordBoxPageHeading"; Probe = "GalleryPasswordBoxInput"; Query = "passwordbox reveal" },
        [pscustomobject]@{ Name = "Open RichEditBox"; Heading = "RichEditBoxPageHeading"; Probe = "GalleryRichEditBoxSample"; Query = "richeditbox document" },
        [pscustomobject]@{ Name = "Open RichTextBlock"; Heading = "RichTextBlockPageHeading"; Probe = "GalleryRichTextBlockSample"; Query = "richtextblock paragraph" },
        [pscustomobject]@{ Name = "Open TextBlock"; Heading = "TextBlockPageHeading"; Probe = "GalleryTextBlockControl"; Query = "textblock wrapping" },
        [pscustomobject]@{ Name = "Open TextBox"; Heading = "TextBoxPageHeading"; Probe = "GalleryTextBoxInput"; Query = "textbox multiline" },
        [pscustomobject]@{ Name = "Open Resources"; Heading = "ResourcesPageHeading"; Probe = "GalleryResourcesSample"; Query = "resourcedictionary themeresource" },
        [pscustomobject]@{ Name = "Open Style"; Heading = "StylePageHeading"; Probe = "GalleryStyleSample"; Query = "style setter implicit" },
        [pscustomobject]@{ Name = "Open Binding"; Heading = "BindingPageHeading"; Probe = "GalleryBindingInput"; Query = "binding twoway source" },
        [pscustomobject]@{ Name = "Open Templates"; Heading = "TemplatesPageHeading"; Probe = "GalleryTemplatesSample"; Query = "templates controltemplate" },
        [pscustomobject]@{ Name = "Open Custom & User Controls"; Heading = "CustomUserControlsPageHeading"; Probe = "GalleryCustomControlsSample"; Query = "custom user controls" },
        [pscustomobject]@{ Name = "Open XAML Conditions"; Heading = "XamlConditionsPageHeading"; Probe = "GalleryXamlConditionsSample"; Query = "xaml conditions" },
        [pscustomobject]@{ Name = "Open Scratch Pad"; Heading = "ScratchPadPageHeading"; Probe = "GalleryScratchPadSample"; Query = "scratch pad playground" },
        [pscustomobject]@{ Name = "Open Color"; Heading = "ColorPageHeading"; Probe = "Copy TextFillColorPrimaryBrush"; Query = "color palette" },
        [pscustomobject]@{ Name = "Open Geometry"; Heading = "GeometryPageHeading"; Probe = "GalleryDesignGeometrySample"; Query = "geometry corner radius" },
        [pscustomobject]@{ Name = "Open Iconography"; Heading = "IconographyPageHeading"; Probe = "GalleryIconographySearch"; Query = "iconography symbolicon" },
        [pscustomobject]@{ Name = "Open Spacing"; Heading = "SpacingPageHeading"; Probe = "GalleryDesignSpacingSample"; Query = "spacing padding" },
        [pscustomobject]@{ Name = "Open Typography"; Heading = "TypographyPageHeading"; Probe = "GalleryDesignTypographySample"; Query = "typography hierarchy" },
        [pscustomobject]@{ Name = "Open Color Contrast"; Heading = "ColorContrastPageHeading"; Probe = "GalleryAccessibilityContrastSample"; Query = "color contrast wcag" },
        [pscustomobject]@{ Name = "Open Keyboard Navigation"; Heading = "KeyboardNavigationPageHeading"; Probe = "GalleryAccessibilityKeyboardTarget"; Query = "keyboard navigation focus" },
        [pscustomobject]@{ Name = "Open Screen Reader"; Heading = "ScreenReaderPageHeading"; Probe = "GalleryAccessibilityScreenReaderAction"; Query = "screen reader automation" },
        [pscustomobject]@{ Name = "Open AcrylicBrush"; Heading = "AcrylicBrushPageHeading"; Probe = "GalleryStylesAcrylicSample"; Query = "acrylicbrush material" },
        [pscustomobject]@{ Name = "Open AnimatedIcon"; Heading = "AnimatedIconPageHeading"; Probe = "GalleryStylesAnimatedIconSample"; Query = "animatedicon lottie" },
        [pscustomobject]@{ Name = "Open Compact Sizing"; Heading = "CompactSizingPageHeading"; Probe = "GalleryStylesCompactSizingSample"; Query = "compact sizing density" },
        [pscustomobject]@{ Name = "Open IconElement"; Heading = "IconElementPageHeading"; Probe = "GalleryStylesIconElementSample"; Query = "iconelement fonticon" },
        [pscustomobject]@{ Name = "Open Line"; Heading = "LinePageHeading"; Probe = "GalleryStylesLineSample"; Query = "line stroke" },
        [pscustomobject]@{ Name = "Open Shape"; Heading = "ShapePageHeading"; Probe = "GalleryStylesShapeSample"; Query = "shape ellipse rectangle" },
        [pscustomobject]@{ Name = "Open RadialGradientBrush"; Heading = "RadialGradientBrushPageHeading"; Probe = "GalleryStylesRadialGradientSample"; Query = "radialgradientbrush" },
        [pscustomobject]@{ Name = "Open System Backdrops (Mica/Acrylic)"; Heading = "SystemBackdropsPageHeading"; Probe = "GalleryStylesSystemBackdropsSample"; Query = "system backdrops mica" },
        [pscustomobject]@{ Name = "Open SystemBackdropElement"; Heading = "SystemBackdropElementPageHeading"; Probe = "GalleryStylesSystemBackdropElementSample"; Query = "systembackdropelement" },
        [pscustomobject]@{ Name = "Open ThemeShadow"; Heading = "ThemeShadowPageHeading"; Probe = "GalleryStylesThemeShadowSample"; Query = "themeshadow elevation" }
    )
    if ($ClipboardOnly) {
        $routes = @($routes | Where-Object {
            $_.Heading -eq "ClipboardPageHeading"
        })
    }
    elseif ($SystemOnly) {
        $routes = @($routes | Where-Object {
            $_.Heading -in @(
                "ClipboardPageHeading",
                "ContentIslandPageHeading",
                "StoragePickersPageHeading"
            )
        })
    }
    elseif ($ShellOnly) {
        $routes = @($routes | Where-Object {
            $_.Heading -in @(
                "AppNotificationsPageHeading",
                "BadgeNotificationsPageHeading",
                "JumpListPageHeading"
            )
        })
    }
    elseif ($WindowingOnly -or $WindowingTeardownOnly) {
        $windowingHeadings = if ($WindowingTeardownOnly) {
            @("MultipleWindowsPageHeading")
        }
        else {
            @(
                "AppWindowPageHeading",
                "AppWindowTitleBarPageHeading",
                "MultipleWindowsPageHeading",
                "TitleBarPageHeading"
            )
        }
        $routes = @($routes | Where-Object {
            $_.Heading -in $windowingHeadings
        })
    }
    elseif ($DesignOnly) {
        $routes = @($routes | Where-Object {
            $_.Heading -in @(
                "ColorPageHeading",
                "GeometryPageHeading",
                "IconographyPageHeading",
                "SpacingPageHeading",
                "TypographyPageHeading"
            )
        })
    }
    if ($CategoryOnly) {
        Invoke-WinApp @(
            "ui", "wait-for", "GalleryRenderError",
            "-w", "$windowHandle",
            "--gone",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "invoke", "Close",
            "-w", "$windowHandle"
        )
        if (-not $appProcess.WaitForExit($TimeoutMilliseconds)) {
            throw "The Gallery did not exit after category smoke."
        }
        $windowHandle = 0
        if ($appProcess.ExitCode -ne 0) {
            throw "The Gallery category smoke exited with code $($appProcess.ExitCode)."
        }
        $stdout = Get-Content $stdoutPath -Raw
        if ($stdout -notmatch "renderer disposed cleanly") {
            throw "The Gallery category smoke did not report clean renderer disposal."
        }
        if (Test-Path $heartbeatEvidencePath) {
            throw "The Gallery category smoke produced heartbeat timeout evidence."
        }
        Write-Host "Gallery category smoke passed. Evidence: $evidenceRoot"
        return
    }

    foreach ($route in $routes) {
        Ensure-NavigationItem $windowHandle "GalleryHomeNavItem"
        Invoke-WinApp @(
            "ui", "invoke", "GalleryHomeNavItem",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "GalleryHomeHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Start-Sleep -Milliseconds 150
        Invoke-WinApp @(
            "ui", "set-value", "TextBox", $route.Query,
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "GallerySearchHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "scroll-into-view", $route.Name,
            "-w", "$windowHandle"
        )
        $routeSelector = Get-VisibleButtonSelector `
            $windowHandle `
            $route.Name
        Invoke-LockSafeElement $windowHandle $routeSelector
        Invoke-WinApp @(
            "ui", "wait-for", $route.Heading,
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Start-Sleep -Milliseconds 100
        if ($route.Probe) {
            Invoke-WinApp @(
                "ui", "wait-for", $route.Probe,
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        Assert-Responsive $appProcess.Id $route.Name
        if ($route.Heading -eq "AnimationInteropPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryMotionAnimationInteropSpring",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMotionAnimationInteropSpring",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Spring scale target: 1.5",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ConnectedAnimationPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryMotionConnectedNavigate",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMotionConnectedNavigate",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Connected destination: page 2",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "EasingFunctionsPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryMotionEasingAnimate",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMotionEasingAnimate",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Standard easing target: 200",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ImplicitTransitionsPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryMotionImplicitTransitionsBackground",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMotionImplicitTransitionsBackground",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Background transition applied: yellow.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "PageTransitionsPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryMotionPageTransitionsForward",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMotionPageTransitionsForward",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Showing sample page 2",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryMotionPageTransitionSurface2",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMotionPageTransitionsBackward",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryMotionPageTransitionSurface1",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMotionPageTransitionsForward",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryMotionPageTransitionSurface2",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMotionPageTransitionsBackward",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Showing sample page 1",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryMotionPageTransitionSurface1",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ThemeTransitionsPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryMotionThemeTransitionsAdd",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMotionThemeTransitionsAdd",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Entrance items: 6",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Entrance rectangle 6",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ParallaxViewPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMotionParallaxApplyShift",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryMotionParallaxResult",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            $parallaxResultJson = Invoke-WinApp @(
                "ui", "search", "Parallax vertical shift applied:",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $parallaxResult = @(
                ($parallaxResultJson | ConvertFrom-Json).matches
            ) | Where-Object {
                $_.name -eq "Parallax vertical shift applied: 250" -or
                $_.name -eq "Parallax vertical shift applied: 0"
            } | Select-Object -First 1
            if (-not $parallaxResult) {
                throw "ParallaxView did not apply the expected enabled or reduced-motion shift."
            }
        }
        if ($route.Heading -eq "AppWindowPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryWindowingAppWindowShowOverlapped",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryWindowingAppWindowShowOverlapped",
                "-w", "$windowHandle"
            )
            $presenterWindow = Wait-ForProcessWindow `
                $appProcess.Id `
                "OverlappedPresenter sample" `
                $windowHandle
            $presenterWindowHandle = [int64]$presenterWindow.hwnd
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryWindowingOverlappedChildClose",
                "-w", "$presenterWindowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryWindowingOverlappedChildClose",
                "-w", "$presenterWindowHandle"
            )
            Assert-NoProcessWindow `
                $appProcess.Id `
                "OverlappedPresenter sample" `
                $windowHandle

            Invoke-WinApp @(
                "ui", "invoke", "GalleryWindowingAppWindowShowOverlapped",
                "-w", "$windowHandle"
            )
            $presenterCleanupWindow = Wait-ForProcessWindow `
                $appProcess.Id `
                "OverlappedPresenter sample" `
                $windowHandle
            Ensure-NavigationItem $windowHandle "GalleryHomeNavItem"
            Invoke-WinApp @(
                "ui", "invoke", "GalleryHomeNavItem",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryHomeHeading",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Assert-NoProcessWindow `
                $appProcess.Id `
                "OverlappedPresenter sample" `
                $windowHandle
        }
        if ($route.Heading -eq "AppWindowTitleBarPageHeading") {
            Invoke-WinApp @(
                "ui", "wait-for", "AppWindowTitleBar customization is supported.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryWindowingAppWindowTitleBarShowColors",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryWindowingAppWindowTitleBarShowColors",
                "-w", "$windowHandle"
            )
            $titleBarWindow = Wait-ForProcessWindow `
                $appProcess.Id `
                "AppWindowTitleBar color customization" `
                $windowHandle
            $titleBarWindowHandle = [int64]$titleBarWindow.hwnd
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryWindowingTitleBarColorsChildClose",
                "-w", "$titleBarWindowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryWindowingTitleBarColorsChildClose",
                "-w", "$titleBarWindowHandle"
            )
            Assert-NoProcessWindow `
                $appProcess.Id `
                "AppWindowTitleBar color customization" `
                $windowHandle
        }
        if ($route.Heading -eq "MultipleWindowsPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryWindowingCreateNewWindow",
                "-w", "$windowHandle"
            )
            $childWindow = Wait-ForProcessWindow `
                $appProcess.Id `
                "dynwinrt-jsx Gallery — child window" `
                $windowHandle
            $childWindowHandle = [int64]$childWindow.hwnd
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryWindowingMultipleChildHeading",
                "-w", "$childWindowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryWindowingMultipleChildClose",
                "-w", "$childWindowHandle"
            )
            Assert-NoProcessWindow `
                $appProcess.Id `
                "dynwinrt-jsx Gallery — child window" `
                $windowHandle
            Invoke-WinApp @(
                "ui", "wait-for", "All child windows are closed.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )

            Invoke-WinApp @(
                "ui", "invoke", "GalleryWindowingCreateCancelingWindow",
                "-w", "$windowHandle"
            )
            $cleanupWindow = Wait-ForProcessWindow `
                $appProcess.Id `
                "dynwinrt-jsx Gallery — child window" `
                $windowHandle
            $cleanupWindowHandle = [int64]$cleanupWindow.hwnd
            Invoke-WinApp @(
                "ui", "invoke", "Close",
                "-w", "$cleanupWindowHandle"
            )
            Start-Sleep -Milliseconds 500
            $stillOpenWindow = Wait-ForProcessWindow `
                $appProcess.Id `
                "dynwinrt-jsx Gallery — child window" `
                $windowHandle
            Ensure-NavigationItem $windowHandle "GalleryHomeNavItem"
            Invoke-WinApp @(
                "ui", "invoke", "GalleryHomeNavItem",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryHomeHeading",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Assert-NoProcessWindow `
                $appProcess.Id `
                "dynwinrt-jsx Gallery — child window" `
                $windowHandle
        }
        if ($route.Heading -eq "TitleBarPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryWindowingTitleBarShowDragRegions",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryWindowingTitleBarShowDragRegions",
                "-w", "$windowHandle"
            )
            $controlTitleBarWindow = Wait-ForProcessWindow `
                $appProcess.Id `
                "Drag regions" `
                $windowHandle
            $controlTitleBarWindowHandle = [int64]$controlTitleBarWindow.hwnd
            Invoke-WinApp @(
                "ui", "invoke", "GalleryWindowingToggleExtraTitleBarButton",
                "-w", "$controlTitleBarWindowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Added a Button to TitleBar.Content.",
                "-w", "$controlTitleBarWindowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryWindowingRecomputeDragRegions",
                "-w", "$controlTitleBarWindowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "RecomputeDragRegions() called.",
                "-w", "$controlTitleBarWindowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryWindowingDragRegionsChildClose",
                "-w", "$controlTitleBarWindowHandle"
            )
            Assert-NoProcessWindow `
                $appProcess.Id `
                "Drag regions" `
                $windowHandle
            Invoke-WinApp @(
                "ui", "wait-for", "TitleBar drag-regions sample closed.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ClipboardPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value",
                "GallerySystemClipboardInput",
                "System clipboard smoke",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GallerySystemClipboardCopy",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for",
                "Text durably copied to the system Clipboard.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GallerySystemClipboardPaste",
                "-w", "$windowHandle"
            )
            try {
                Invoke-WinApp @(
                    "ui", "wait-for",
                    "Clipboard text: System clipboard smoke",
                    "-w", "$windowHandle",
                    "--timeout", "$TimeoutMilliseconds"
                )
            }
            catch {
                $clipboardStatus = & $WinAppPath ui get-property `
                    "GallerySystemClipboardCopyStatus" `
                    -w "$windowHandle" --json 2>$null
                $clipboardText = & $WinAppPath ui get-property `
                    "GallerySystemClipboardPastedText" `
                    -w "$windowHandle" --json 2>$null
                throw "Clipboard paste did not settle to the expected text within $TimeoutMilliseconds ms. Status: $($clipboardStatus -join ' ') Text: $($clipboardText -join ' ')"
            }
        }
        if ($route.Heading -eq "ContentIslandPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GallerySystemContentIslandCreate",
                "-w", "$windowHandle"
            )
            Start-Sleep -Milliseconds 300
            $contentIslandConnected = & $WinAppPath ui search `
                "ContentIsland connected" -w "$windowHandle" --json 2>$null
            $contentIslandUnavailable = & $WinAppPath ui search `
                "ContentIsland unavailable" -w "$windowHandle" --json 2>$null
            $connectedMatches = if ($contentIslandConnected) {
                @((($contentIslandConnected -join "`n") | ConvertFrom-Json).matches)
            }
            else {
                @()
            }
            $unavailableMatches = if ($contentIslandUnavailable) {
                @((($contentIslandUnavailable -join "`n") | ConvertFrom-Json).matches)
            }
            else {
                @()
            }
            if (
                @($connectedMatches).Count -eq 0 -and
                @($unavailableMatches).Count -eq 0
            ) {
                throw "ContentIsland did not report a truthful connected or unavailable state."
            }
            if (@($connectedMatches).Count -gt 0) {
                Invoke-WinApp @(
                    "ui", "invoke", "GallerySystemContentIslandRelease",
                    "-w", "$windowHandle"
                )
                try {
                    Invoke-WinApp @(
                        "ui", "wait-for", "ContentIsland resources released.",
                        "-w", "$windowHandle",
                        "--timeout", "$TimeoutMilliseconds"
                    )
                }
                catch {
                    $contentIslandStatus = & $WinAppPath ui get-property `
                        "GallerySystemContentIslandStatus" `
                        -w "$windowHandle" --json 2>$null
                    throw "ContentIsland release failed. Status: $($contentIslandStatus -join ' ')"
                }
            }
        }
        if ($route.Heading -eq "StoragePickersPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GallerySystemStoragePickerCheck",
                "-w", "$windowHandle"
            )
            Start-Sleep -Milliseconds 200
            $pickerAvailable = & $WinAppPath ui search `
                "Native storage pickers are available" -w "$windowHandle" --json 2>$null
            $pickerUnavailable = & $WinAppPath ui search `
                "Native storage pickers are unavailable" -w "$windowHandle" --json 2>$null
            $availableMatches = if ($pickerAvailable) {
                @((($pickerAvailable -join "`n") | ConvertFrom-Json).matches)
            }
            else {
                @()
            }
            $pickerUnavailableMatches = if ($pickerUnavailable) {
                @((($pickerUnavailable -join "`n") | ConvertFrom-Json).matches)
            }
            else {
                @()
            }
            if (
                @($availableMatches).Count -eq 0 -and
                @($pickerUnavailableMatches).Count -eq 0
            ) {
                throw "Storage pickers did not report a truthful available or unavailable state."
            }
        }
        if ($route.Heading -eq "AppNotificationsPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryShellAppNotificationProbe",
                "-w", "$windowHandle"
            )
            if ($PackagedShellPositivePath) {
                $registrationName = Get-ElementName `
                    $windowHandle `
                    "GalleryShellAppNotificationRegistrationStatus"
                if (
                    $registrationName -notmatch
                    "^(Packaged|App-specific launcher) registration succeeded\. Notifications are "
                ) {
                    throw "App notification registration did not reach the positive path: '$registrationName'."
                }
                if ($registrationName.EndsWith("Notifications are enabled.")) {
                    Wait-ForAnyText $windowHandle @(
                        "App notification path verified",
                        "Windows accepted and removed the suppressed probe"
                    ) "packaged App notification positive path"
                }
            }
            else {
                Assert-ElementName `
                    $windowHandle `
                    "GalleryShellAppNotificationRegistrationStatus" `
                    "App notifications unavailable: unpackaged registration requires an app-specific launcher/AUMID activation path; this Gallery is hosted by shared node.exe." `
                    "App notification prerequisite"
            }
        }
        if ($route.Heading -eq "BadgeNotificationsPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryShellBadgeProbe",
                "-w", "$windowHandle"
            )
            if ($PackagedShellPositivePath) {
                Invoke-WinApp @(
                    "ui", "wait-for", "Badge path verified",
                    "-w", "$windowHandle",
                    "--timeout", "$TimeoutMilliseconds"
                )
            }
            else {
                Assert-ElementName `
                    $windowHandle `
                    "GalleryShellBadgeStatus" `
                    "Badge notifications unavailable: taskbar badges require package identity, and this Gallery is running unpackaged." `
                    "Badge prerequisite"
            }
        }
        if ($route.Heading -eq "JumpListPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryShellJumpListProbe",
                "-w", "$windowHandle"
            )
            if ($PackagedShellPositivePath) {
                Invoke-WinApp @(
                    "ui", "wait-for", "JumpList path verified",
                    "-w", "$windowHandle",
                    "--timeout", "$TimeoutMilliseconds"
                )
            }
            else {
                Assert-ElementName `
                    $windowHandle `
                    "GalleryShellJumpListStatus" `
                    "JumpList unavailable: Windows.UI.StartScreen.JumpList requires package identity, and this Gallery is running unpackaged." `
                    "JumpList prerequisite"
            }
        }
        if ($route.Heading -eq "ButtonPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryBasicInputButtonControl",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "You clicked the button 1 times.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryBasicInputButtonSampleSourceToggle",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryBasicInputButtonSampleCopy",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryBasicInputButtonSampleCopy",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Copied",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryCopyLinkButton-button",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Page link copied",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "screenshot",
                "-w", "$windowHandle",
                "--output", $sourceCodeScreenshotPath
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryThemeButton-button",
                "-w", "$windowHandle"
            )
            Start-Sleep -Milliseconds 150
            Invoke-WinApp @(
                "ui", "invoke", "GalleryThemeButton-button",
                "-w", "$windowHandle"
            )
            Start-Sleep -Milliseconds 150
        }
        if ($route.Heading -eq "DropDownButtonPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryBasicInputDropDownButtonControl",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryBasicInputDropDownSend",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryBasicInputDropDownSend",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Selected: Send",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "HyperlinkButtonPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryBasicInputHyperlinkInternal",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "ToggleButtonPageHeading",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "RepeatButtonPageHeading") {
            $repeatSearchJson = Invoke-WinApp @(
                "ui", "search", "Click and hold",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $repeatButton = @(
                ($repeatSearchJson | ConvertFrom-Json).matches
            ) | Where-Object {
                $_.type -eq "Button"
            } | Select-Object -First 1
            if (-not $repeatButton) {
                throw "The RepeatButton interaction target was not found."
            }
            Invoke-WinApp @(
                "ui", "invoke", $repeatButton.selector,
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Repeat count: 1",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ToggleButtonPageHeading") {
            $toggleButtonSearchJson = Invoke-WinApp @(
                "ui", "search", "Toggle is off",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $toggleButton = @(
                ($toggleButtonSearchJson | ConvertFrom-Json).matches
            ) | Where-Object {
                $_.type -eq "Button"
            } | Select-Object -First 1
            if (-not $toggleButton) {
                throw "The ToggleButton interaction target was not found."
            }
            Invoke-WinApp @(
                "ui", "invoke", $toggleButton.selector,
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Output: checked",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if (
            $route.Heading -eq "SplitButtonPageHeading" -and
            -not $SkipKeyboardInput
        ) {
            Invoke-WinApp @(
                "ui", "focus", "GalleryBasicInputSplitButtonControl",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "send-keys", "alt+down",
                "-w", "$windowHandle",
                "--via", "send-input"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryBasicInputSplitBlue",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryBasicInputSplitBlue",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Selected color: Blue; applied 0 times",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if (
            $route.Heading -eq "ToggleSplitButtonPageHeading" -and
            -not $SkipKeyboardInput
        ) {
            Invoke-WinApp @(
                "ui", "focus", "GalleryBasicInputToggleSplitButtonControl",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "send-keys", "alt+down",
                "-w", "$windowHandle",
                "--via", "send-input"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryBasicInputToggleSplitRoman",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryBasicInputToggleSplitRoman",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Roman numerals: enabled",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "CheckBoxPageHeading") {
            $checkBoxSearchJson = Invoke-WinApp @(
                "ui", "search", "Two-state CheckBox",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $checkBox = @(
                ($checkBoxSearchJson | ConvertFrom-Json).matches
            ) | Where-Object {
                $_.type -eq "CheckBox"
            } | Select-Object -First 1
            if (-not $checkBox) {
                throw "The CheckBox interaction target was not found."
            }
            Invoke-WinApp @(
                "ui", "invoke", $checkBox.selector,
                "-w", "$windowHandle"
            )
            Start-Sleep -Milliseconds 150
            $checkBoxStateJson = Invoke-WinApp @(
                "ui", "get-property", $checkBox.selector,
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $checkBoxState = $checkBoxStateJson | ConvertFrom-Json
            if ($checkBoxState.properties.ToggleState -ne "On") {
                throw "The CheckBox did not enter the checked state."
            }
            Invoke-WinApp @(
                "ui", "wait-for", "Two-state output: checked",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ColorPickerPageHeading") {
            $ringSearchJson = Invoke-WinApp @(
                "ui", "search", "Ring spectrum",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $ringCheckBox = @(
                ($ringSearchJson | ConvertFrom-Json).matches
            ) | Where-Object {
                $_.type -eq "CheckBox"
            } | Select-Object -First 1
            if (-not $ringCheckBox) {
                throw "The ColorPicker ring option was not found."
            }
            Invoke-WinApp @(
                "ui", "scroll-into-view", $ringCheckBox.selector,
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", $ringCheckBox.selector,
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Spectrum: Ring",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if (
            $route.Heading -eq "ComboBoxPageHeading" -and
            -not $SkipKeyboardInput
        ) {
            $comboBoxTreeJson = Invoke-WinApp @(
                "ui", "inspect",
                "-w", "$windowHandle",
                "--interactive",
                "--json"
            ) -Capture
            $comboBoxTree = $comboBoxTreeJson | ConvertFrom-Json
            $comboBox = Get-UiTreeElements @(
                $comboBoxTree.windows[0].elements
            ) | Where-Object {
                $_.type -eq "ComboBox" -and
                -not $_.isOffscreen -and
                $_.width -gt 0
            } | Sort-Object y | Select-Object -First 1
            if (-not $comboBox) {
                throw "The ComboBox interaction target was not found."
            }
            Invoke-WinApp @(
                "ui", "focus", $comboBox.selector,
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", $comboBox.selector,
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "send-keys", "down",
                "-w", "$windowHandle",
                "--via", "send-input"
            )
            Invoke-WinApp @(
                "ui", "send-keys", "enter",
                "-w", "$windowHandle",
                "--via", "send-input"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Selected: Green",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "RadioButtonPageHeading") {
            $radioButtonSearchJson = Invoke-WinApp @(
                "ui", "search", "Option 2",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $radioButton = @(
                ($radioButtonSearchJson | ConvertFrom-Json).matches
            ) | Where-Object {
                $_.type -eq "RadioButton"
            } | Select-Object -First 1
            if (-not $radioButton) {
                throw "The RadioButton interaction target was not found."
            }
            Invoke-WinApp @(
                "ui", "invoke", $radioButton.selector,
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Selected: Option 2",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "RatingControlPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryBasicInputRatingPlaceholderSlider",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "set-value", "GalleryBasicInputRatingPlaceholderSlider", "4",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Placeholder: 4",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "SliderPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value", "GalleryBasicInputSliderControl", "60",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Value: 60",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ToggleSwitchPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryBasicInputToggleSwitchControl",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Notifications are on",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "FlipViewPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryCollectionsFlipViewNext",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryCollectionsFlipViewNext",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Current item: Grapes",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "GridViewPageHeading") {
            $gridItemSearchJson = Invoke-WinApp @(
                "ui", "search", "Cliff",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $gridItem = @(
                ($gridItemSearchJson | ConvertFrom-Json).matches
            ) | Where-Object {
                $_.type -eq "ListItem" -and
                $_.name -eq "Cliff"
            } | Select-Object -First 1
            if (-not $gridItem) {
                throw "The GridView item target was not found."
            }
            Invoke-WinApp @(
                "ui", "invoke", $gridItem.selector,
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Invoked: Cliff",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            foreach ($width in @(100, 240, 120, 220, 140, 200, 160, 180)) {
                Invoke-WinApp @(
                    "ui", "set-value",
                    "GalleryCollectionsGridViewTileWidth", "$width",
                    "-w", "$windowHandle"
                )
            }
            Invoke-WinApp @(
                "ui", "wait-for", "GridViewPageHeading",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Assert-Responsive $appProcess.Id "GridView tile width stress"
        }
        if ($route.Heading -eq "ItemsRepeaterPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryCollectionsRepeaterAdd",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Item 7",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if (
            $route.Heading -eq "ItemsViewPageHeading" -and
            -not $SkipKeyboardInput
        ) {
            $itemsViewItemSearchJson = Invoke-WinApp @(
                "ui", "search", "Cliff",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $itemsViewItem = @(
                ($itemsViewItemSearchJson | ConvertFrom-Json).matches
            ) | Where-Object {
                $_.type -eq "Group" -and
                $_.name -eq "Cliff" -and
                -not $_.isOffscreen
            } | Select-Object -First 1
            if (-not $itemsViewItem) {
                throw "The ItemsView item target was not found."
            }
            Invoke-WinApp @(
                "ui", "click", $itemsViewItem.selector,
                "-w", "$windowHandle",
                "--double"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Invoked: Cliff",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ListViewPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryCollectionsListViewFilter",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "set-value", "GalleryCollectionsListViewFilter", "Contoso",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "2 contacts",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "PullToRefreshPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryCollectionsRequestRefresh",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Basic refresh completed.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if (
            $route.Heading -eq "TreeViewPageHeading" -and
            -not $SkipKeyboardInput
        ) {
            $treeItemSearchJson = Invoke-WinApp @(
                "ui", "search", "Documents",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $treeItem = @(
                ($treeItemSearchJson | ConvertFrom-Json).matches
            ) | Where-Object {
                $_.type -eq "TreeItem" -and
                $_.name -eq "Documents" -and
                -not $_.isOffscreen
            } | Select-Object -First 1
            if (-not $treeItem) {
                throw "The TreeView invocation target was not found."
            }
            Invoke-WinApp @(
                "ui", "click", $treeItem.selector,
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Invoked: Documents",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryCollectionsTreeViewAddRoot",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryCollectionsTreeViewAddRoot",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "New folder 1",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "CalendarViewPageHeading") {
            Invoke-WinApp @(
                "ui", "wait-for",
                "Group labels: on; out-of-scope dates: on.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryCalendarViewGroupLabels",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for",
                "Group labels: off; out-of-scope dates: on.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ContentDialogPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryContentDialogDefaultShow",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "PrimaryButton",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "PrimaryButton",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "User saved their work",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "FlyoutPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryFlyoutShow",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryFlyoutConfirm",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryFlyoutConfirm",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Cart emptied.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "PopupPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryPopupShow",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Simple Popup",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryPopupClose",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Popup closed.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "TeachingTipPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryTeachingTipNonTargetedShow",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Close button",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "Close button",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Non-targeted tip is closed.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "InfoBadgePageHeading") {
            Invoke-WinApp @(
                "ui", "set-value", "GalleryInfoBadgeValueInput", "7",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "InfoBadge value: 7",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "InfoBarPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryInfoBarIconVisible",
                "-w", "$windowHandle"
            )
            Ensure-NavigationItem $windowHandle "Galleryinfo-badgeNavItem"
            Invoke-WinApp @(
                "ui", "invoke", "Galleryinfo-badgeNavItem",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "InfoBadgePageHeading",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Ensure-NavigationItem $windowHandle "Galleryinfo-barNavItem"
            Invoke-WinApp @(
                "ui", "invoke", "Galleryinfo-barNavItem",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "InfoBarPageHeading",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ProgressBarPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value", "GalleryProgressBarValue", "42",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "42%",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ProgressRingPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value", "GalleryProgressRingValue", "64",
                "-w", "$windowHandle"
            )
        }
        if ($route.Heading -eq "ToolTipPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryToolTipSimpleButton",
                "-w", "$windowHandle"
            )
        }
        if ($route.Heading -eq "BorderPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value", "GalleryBorderThickness", "6",
                "-w", "$windowHandle"
            )
        }
        if ($route.Heading -eq "CanvasPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value", "GalleryCanvasZIndex", "4",
                "-w", "$windowHandle"
            )
        }
        if ($route.Heading -eq "GridPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value", "GalleryGridRowSpacing", "12",
                "-w", "$windowHandle"
            )
        }
        if ($route.Heading -eq "SplitViewPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GallerySplitViewMessages",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Selected: Messages",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "StackPanelPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value", "GalleryStackPanelSpacing", "12",
                "-w", "$windowHandle"
            )
        }
        if ($route.Heading -eq "ViewboxPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value", "GalleryViewboxWidth", "260",
                "-w", "$windowHandle"
            )
        }
        if ($route.Heading -eq "AppBarToggleButtonPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryAppBarToggleButtonControl",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Pinned.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "CommandBarPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryCommandBarRun",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "CommandBar action simulated.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "CommandBarFlyoutPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryCommandBarFlyoutShow",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryCommandBarFlyoutCopy",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "MenuBarPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "File",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryMenuBarNew",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMenuBarNew",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "New selected.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "MenuFlyoutPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMenuFlyoutBasicShow",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryMenuFlyoutOpen",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMenuFlyoutOpen",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Open selected.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "StandardUICommandPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryStandardUICommandButton",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Delete command executed.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "XamlUICommandPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryXamlUICommandPrimary",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Archive command executed.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "BreadcrumbBarPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "Northwind",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Current location: Northwind",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "NavigationViewPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryNavigationViewFavorites",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Selected: Favorites",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "PivotPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryPivotFlagged",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Selected: Flagged",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "SelectorBarPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GallerySelectorBarFavorites",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Selected: Favorites",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "TabViewPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "AddButton",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Document 3 added.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Native tab count: 4",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            $tabViewTreeJson = Invoke-WinApp @(
                "ui", "inspect",
                "-w", "$windowHandle",
                "--interactive",
                "--depth", "20",
                "--json"
            ) -Capture
            $tabViewTree = $tabViewTreeJson | ConvertFrom-Json
            $lastCloseButton = Get-UiTreeElements @(
                $tabViewTree.windows[0].elements
            ) | Where-Object {
                $_.automationId -eq "CloseButton"
            } | Select-Object -Last 1
            if (-not $lastCloseButton) {
                throw "The TabView close button was not found."
            }
            Invoke-WinApp @(
                "ui", "invoke", $lastCloseButton.selector,
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Document 2 closed.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Native tab count: 3",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "AnnotatedScrollBarPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value",
                "GalleryAnnotatedScrollBarMaxHeight", "240",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Maximum height: 240",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryAnnotatedScrollBarGold",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Visible section: Gold.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "PipsPagerPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "Next page",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Page 2 of 8 selected",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ScrollViewPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryScrollViewDown",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Scroll completed at",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ScrollViewerPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryScrollViewerDown",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Can scroll up: yes",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "SemanticZoomPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GallerySemanticZoomToggle",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GallerySemanticZoomToggle",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Zoomed-out view active.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GallerySemanticZoomSelectLayout",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GallerySemanticZoomSelectLayout",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Selected group: Layout",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GallerySemanticZoomToggle",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GallerySemanticZoomToggle",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Zoomed-in view active.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "AutoSuggestBoxPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryAutoSuggestBoxDraft",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Draft query: grid",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "NumberBoxPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value", "GalleryNumberBoxInput", "12",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Value: 12",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "PasswordBoxPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value", "GalleryPasswordBoxInput", "secret",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "6 password characters",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "RichEditBoxPageHeading") {
            Invoke-WinApp @(
                "ui", "wait-for",
                "Document text: RichEditBox supports multiline editing, selection, and formatting.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryRichEditBoxClear",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Document cleared.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Document text: (empty)",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "RichTextBlockPageHeading") {
            Invoke-WinApp @(
                "ui", "wait-for", "formatted text",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for",
                "Each Paragraph owns an InlineCollection, while each Run remains a projected WinUI text element.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryRichTextBlockLines",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Maximum lines: 2",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "TextBlockPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value", "GalleryTextBlockFontSize", "24",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Font size: 24",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "TextBoxPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value", "GalleryTextBoxInput", "Hello",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Current text: Hello",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ResourcesPageHeading") {
            $themeBeforeJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryResourcesThemeName",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $themeBefore = $themeBeforeJson | ConvertFrom-Json
            $themeBeforeName = [string]$themeBefore.windows[0].elements[0].name
            Invoke-WinApp @(
                "ui", "invoke", "GalleryThemeButton-resources",
                "-w", "$windowHandle"
            )
            Start-Sleep -Milliseconds 250
            $themeAfterJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryResourcesThemeName",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $themeAfter = $themeAfterJson | ConvertFrom-Json
            $themeAfterName = [string]$themeAfter.windows[0].elements[0].name
            if ($themeBeforeName -eq $themeAfterName) {
                throw "The scoped theme ResourceDictionary did not refresh."
            }
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryResourcesVerifyNative",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryResourcesVerifyNative",
                "-w", "$windowHandle"
            )
            $nativeThemeJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryResourcesNativeStatus",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $nativeTheme = $nativeThemeJson | ConvertFrom-Json
            if (
                [string]$nativeTheme.windows[0].elements[0].name -ne
                "Native background opacity: 0.73"
            ) {
                throw "The dark native theme resource brush was not resolved."
            }
            Invoke-WinApp @(
                "ui", "invoke", "GalleryThemeButton-resources",
                "-w", "$windowHandle"
            )
            Start-Sleep -Milliseconds 250
        }
        if ($route.Heading -eq "StylePageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryStyleNativeStyledButton",
                "-w", "$windowHandle"
            )
            $styledButtonJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryStyleNativeStyledButton",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $styledButton = $styledButtonJson | ConvertFrom-Json
            if ([double]$styledButton.windows[0].elements[0].width -lt 200) {
                throw "The explicit TSX style recipe did not apply MinWidth."
            }
        }
        if ($route.Heading -eq "BindingPageHeading") {
            Invoke-WinApp @(
                "ui", "set-value", "GalleryBindingOneWaySource", "OneWay",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "OneWay",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            $oneWayTargetJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryBindingOneWayTarget",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $oneWayTarget = $oneWayTargetJson | ConvertFrom-Json
            if (
                [string]$oneWayTarget.windows[0].elements[0].value -ne
                "OneWay"
            ) {
                throw "OneWay binding did not update its target."
            }
            Invoke-WinApp @(
                "ui", "set-value", "GalleryBindingInput", "Grace",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "TwoWay value: Grace",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            $bindingMirrorJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryBindingTwoWayMirror",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $bindingMirror = $bindingMirrorJson | ConvertFrom-Json
            if (
                [string]$bindingMirror.windows[0].elements[0].value -ne
                "Grace"
            ) {
                throw "TwoWay binding did not update the second TextBox."
            }
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryBindingDetailItem1",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryBindingDetailItem1",
                "-w", "$windowHandle"
            )
            $detailTitleName = ""
            $detailDeadline = [DateTime]::UtcNow.AddMilliseconds(
                $TimeoutMilliseconds
            )
            while (
                $detailTitleName -ne "Item 2" -and
                [DateTime]::UtcNow -lt $detailDeadline
            ) {
                $detailTitleJson = Invoke-WinApp @(
                    "ui", "inspect", "GalleryBindingDetailTitle",
                    "-w", "$windowHandle",
                    "--json"
                ) -Capture
                $detailTitle = $detailTitleJson | ConvertFrom-Json
                $detailTitleName = [string](
                    $detailTitle.windows[0].elements[0].name
                )
                if ($detailTitleName -ne "Item 2") {
                    Start-Sleep -Milliseconds 50
                }
            }
            if ($detailTitleName -ne "Item 2") {
                throw "Binding ListView selection did not update the detail pane."
            }
        }
        if ($route.Heading -eq "TemplatesPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryTemplatesStackPanel",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Items panel: StackPanel",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryTemplatesStackLayout",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryTemplatesWrapGrid",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Items panel: WrapGrid",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Ensure-NavigationItem $windowHandle "GallerybindingNavItem"
            Invoke-WinApp @(
                "ui", "invoke", "GallerybindingNavItem",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "BindingPageHeading",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Ensure-NavigationItem $windowHandle "GallerytemplatesNavItem"
            Invoke-WinApp @(
                "ui", "invoke", "GallerytemplatesNavItem",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "TemplatesPageHeading",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "CustomUserControlsPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryCustomControlIncrement",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Increment count: 1",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "set-value", "GalleryCustomPasswordInput", "Password1",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Password is valid",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "set-value", "GalleryCustomTemperatureInput", "100",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryCustomTemperatureConvert",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryCustomTemperatureStatus",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            $temperatureJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryCustomTemperatureStatus",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $temperature = $temperatureJson | ConvertFrom-Json
            if (
                [string]$temperature.windows[0].elements[0].name -notlike
                "Fahrenheit: 212.00*"
            ) {
                throw "The temperature UserControl did not convert 100 Celsius."
            }
        }
        if ($route.Heading -eq "XamlConditionsPageHeading") {
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryXamlConditionsNewExperience",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            $conditionsTreeJson = Invoke-WinApp @(
                "ui", "inspect",
                "-w", "$windowHandle",
                "--depth", "12",
                "--json"
            ) -Capture
            $conditionsTree = $conditionsTreeJson | ConvertFrom-Json
            $staleDisabled = Get-UiTreeElements @(
                $conditionsTree.windows[0].elements
            ) | Where-Object {
                $_.automationId -eq "GalleryXamlConditionsLegacyMode"
            } | Select-Object -First 1
            if ($staleDisabled) {
                throw "The false startup XAML condition was mounted."
            }
        }
        if ($route.Heading -eq "ScratchPadPageHeading") {
            $scratchMarkup = '<TextBlock Text="Scratch loaded" />'
            Invoke-WinApp @(
                "ui", "set-value", "GalleryScratchPadEditor", $scratchMarkup,
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryScratchPadLoad",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Load successful.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            $scratchTreeJson = Invoke-WinApp @(
                "ui", "inspect",
                "-w", "$windowHandle",
                "--depth", "12",
                "--json"
            ) -Capture
            $scratchTree = $scratchTreeJson | ConvertFrom-Json
            $scratchLoaded = Get-UiTreeElements @(
                $scratchTree.windows[0].elements
            ) | Where-Object {
                $_.name -eq "Scratch loaded"
            } | Select-Object -First 1
            if (-not $scratchLoaded) {
                throw "The Scratch Pad did not load the entered XAML."
            }
        }
        if ($route.Heading -eq "ColorPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "Copy TextFillColorSecondaryBrush",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "Copy TextFillColorSecondaryBrush",
                "-w", "$windowHandle"
            )
            $colorClipboard = ""
            $colorClipboardDeadline = [DateTime]::UtcNow.AddMilliseconds(
                $TimeoutMilliseconds
            )
            while ([DateTime]::UtcNow -lt $colorClipboardDeadline) {
                $colorClipboard = [string](Get-Clipboard -Raw)
                if (
                    $colorClipboard.Trim() -ceq
                    "TextFillColorSecondaryBrush"
                ) {
                    break
                }
                Start-Sleep -Milliseconds 100
            }
            if (
                $colorClipboard.Trim() -cne
                "TextFillColorSecondaryBrush"
            ) {
                throw "Color did not copy the selected WinUI brush resource."
            }
        }
        if ($route.Heading -eq "GeometryPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryDesignGeometryControl",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryDesignGeometryControl",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryDesignGeometryControl",
                "-w", "$windowHandle",
                "--property", "Name",
                "--value", "Native corner radius: 4",
                "--contains",
                "--timeout", "$TimeoutMilliseconds"
            )
            $geometryNativeJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryDesignGeometryControl",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $geometryNative = $geometryNativeJson | ConvertFrom-Json
            if (
                [string]$geometryNative.windows[0].elements[0].name -notmatch
                "Native corner radius: 4$"
            ) {
                throw "Geometry did not apply the native 4px control radius."
            }
        }
        if ($route.Heading -eq "IconographyPageHeading") {
            $iconSearchJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryIconographySearch",
                "-w", "$windowHandle",
                "--depth", "4",
                "--json"
            ) -Capture
            $iconSearch = $iconSearchJson | ConvertFrom-Json
            $iconSearchEdit = Get-UiTreeElements @(
                $iconSearch.windows[0].elements
            ) | Where-Object {
                $_.type -eq "Edit"
            } | Select-Object -First 1
            if (-not $iconSearchEdit) {
                throw "The Iconography search TextBox was not found."
            }
            Invoke-WinApp @(
                "ui", "set-value", $iconSearchEdit.selector, "RotationLock",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryIconographySelectedName",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            $iconNameJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryIconographySelectedName",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $iconName = $iconNameJson | ConvertFrom-Json
            if (
                [string]$iconName.windows[0].elements[0].name -ne
                "RotationLock"
            ) {
                throw "The iconography search did not select RotationLock."
            }
        }
        if ($route.Heading -eq "SpacingPageHeading") {
            $spacingNativeJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryDesignSpacingNativeStatus",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $spacingNative = $spacingNativeJson | ConvertFrom-Json
            if (
                [string]$spacingNative.windows[0].elements[0].name -ne
                "Native 24epx sample width: 24"
            ) {
                throw "The 24epx spacing sample did not use a native width of 24."
            }
        }
        if ($route.Heading -eq "TypographyPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryDesignTypographyTitle",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryDesignTypographyTitle",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryDesignTypographyTitle",
                "-w", "$windowHandle",
                "--property", "Name",
                "--value", "Native title font size: 28",
                "--contains",
                "--timeout", "$TimeoutMilliseconds"
            )
            $typographyNativeJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryDesignTypographyTitle",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $typographyNative = $typographyNativeJson | ConvertFrom-Json
            if (
                [string]$typographyNative.windows[0].elements[0].name -notmatch
                "Native title font size: 28$"
            ) {
                throw "The Title type-ramp row did not use a native size of 28."
            }
        }
        if ($route.Heading -eq "ColorContrastPageHeading") {
            Invoke-WinApp @(
                "ui", "wait-for",
                "Contrast ratio: 21.00:1",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "KeyboardNavigationPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryAccessibilityKeyboardMoveFocus",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Second button received focus.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryAccessibilityAcceleratorRed",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryAccessibilityAcceleratorRed",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for",
                "Red selected; native accelerator: Ctrl+R.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if (
            $route.Heading -eq "KeyboardNavigationPageHeading" -and
            -not $SkipKeyboardInput
        ) {
            Invoke-WinApp @(
                "ui", "focus", "GalleryAccessibilityKeyboardFirst",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "send-keys", "tab",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Second button received focus.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ScreenReaderPageHeading") {
            $screenReaderActionJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryAccessibilityScreenReaderAction",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $screenReaderAction = $screenReaderActionJson | ConvertFrom-Json
            if (
                [string]$screenReaderAction.windows[0].elements[0].name -ne
                "Complete download"
            ) {
                throw "The screen-reader automation name is missing."
            }
            Invoke-WinApp @(
                "ui", "invoke", "GalleryAccessibilityScreenReaderAction",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Download completed.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "LiveRegionChanged raised.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "AnimatedVisualPlayerPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMediaAnimatedVisualPlayerPlay",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Animation playing forward.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMediaAnimatedVisualPlayerStop",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Animation stopped.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "CaptureElementPreviewPageHeading") {
            $cameraStatusJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryMediaCameraStatus",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $cameraStatus = $cameraStatusJson | ConvertFrom-Json
            if (
                [string]$cameraStatus.windows[0].elements[0].name -ne
                "Camera preview not started."
            ) {
                throw "The camera page did not expose its capability state."
            }
        }
        if ($route.Heading -eq "ImagePageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view",
                "GalleryMediaImageStretchUniformToFill",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMediaImageStretchUniformToFill",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Stretch: UniformToFill",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryMediaImageGifSample",
                "-w", "$windowHandle"
            )
        }
        if ($route.Heading -eq "MapControlPageHeading") {
            $mapStatusJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryMediaMapStatus",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $mapStatusObject = $mapStatusJson | ConvertFrom-Json
            $mapStatus = [string](
                $mapStatusObject.windows[0].elements[0].name
            )
            if ($mapStatus -notmatch "unavailable") {
                throw "Unexpected unpackaged MapControl state: $mapStatus"
            }
        }
        if ($route.Heading -eq "MediaPlayerElementPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view",
                "GalleryMediaPlayerAutoplaySample",
                "-w", "$windowHandle"
            )
            Assert-Responsive $appProcess.Id "MediaPlayerElement playback"
        }
        if ($route.Heading -eq "PersonPicturePageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMediaPersonPictureMode1",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Profile type: Display Name",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "SoundPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMediaSoundToggle",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryMediaSoundFocus",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryMediaSoundFocus",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Played Focus sound.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "AcrylicBrushPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryStylesAcrylicToggle",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Solid fallback enabled.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Native fallback: on",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "AnimatedIconPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryStylesAnimatedIconToggle",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "AnimatedIcon state: PointerOver",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "CompactSizingPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryStylesCompactSizingToggle",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Compact sizing enabled.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Native minimum height: 28",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "IconElementPageHeading") {
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryStylesPathIconSample",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "LinePageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryStylesLineThicknessPreset",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "GalleryStylesLineNativeStatus",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            $lineStatusJson = Invoke-WinApp @(
                "ui", "inspect", "GalleryStylesLineNativeStatus",
                "-w", "$windowHandle",
                "--json"
            ) -Capture
            $lineStatus = $lineStatusJson | ConvertFrom-Json
            if (
                [string]$lineStatus.windows[0].elements[0].name -notlike
                "*stroke 8"
            ) {
                throw "The native Line stroke thickness did not update."
            }
        }
        if ($route.Heading -eq "RadialGradientBrushPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryStylesRadialGradientRadiusPreset",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "radius 0.80,0.80",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "SystemBackdropsPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryStylesSystemBackdropsAcrylic",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Window backdrop: Desktop Acrylic",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "SystemBackdropElementPageHeading") {
            Invoke-WinApp @(
                "ui", "wait-for", "Window backdrop restored: yes",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "invoke", "GalleryStylesSystemBackdropElementToggle",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Element backdrop: Mica",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Native element backdrop assigned; radius 8.",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ThemeShadowPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryStylesThemeShadowToggle",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Elevation: 8",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Native elevation: 8; receivers: 1",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "SelectionPageHeading") {
            Invoke-WinApp @(
                "ui", "scroll-into-view", "GalleryControlledListViewSample",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "scroll-into-view", "Normal",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "invoke", "Normal",
                "-w", "$windowHandle"
            )
            Assert-Responsive $appProcess.Id "controlled ListView selection"
        }
        if ($route.Heading -eq "SignalsPageHeading") {
            Invoke-WinApp @(
                "ui", "invoke", "GalleryFavoriteButton-signals",
                "-w", "$windowHandle"
            )
            Ensure-NavigationItem $windowHandle "GalleryHomeNavItem"
            Invoke-WinApp @(
                "ui", "invoke", "GalleryHomeNavItem",
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Recently visited",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Open Signals and control flow",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
    }

    if ($ClipboardOnly -or $SystemOnly -or $ShellOnly) {
        Invoke-WinApp @(
            "ui", "invoke", "Close",
            "-w", "$windowHandle"
        )
        $scope = if ($ClipboardOnly) {
            "Clipboard"
        }
        elseif ($SystemOnly) {
            "System"
        }
        else {
            "Shell"
        }
        if (-not $appProcess.WaitForExit($TimeoutMilliseconds)) {
            throw "The Gallery did not exit after the $scope smoke."
        }
        if ($appProcess.ExitCode -ne 0) {
            throw "The Gallery exited with code $($appProcess.ExitCode) after the $scope smoke."
        }
        $windowHandle = 0
        Write-Host "Gallery $scope UI smoke passed. Evidence: $evidenceRoot"
        return
    }

    if ($WindowingOnly -or $WindowingTeardownOnly) {
        Ensure-NavigationItem $windowHandle "GalleryHomeNavItem"
        Invoke-WinApp @(
            "ui", "invoke", "GalleryHomeNavItem",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "GalleryHomeHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "set-value", "TextBox", "multiple windows xaml",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "GallerySearchHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "invoke", "Open Multiple windows",
            "-w", "$windowHandle"
        )
        Invoke-WinApp @(
            "ui", "wait-for", "MultipleWindowsPageHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "invoke", "GalleryWindowingCreateCancelingWindow",
            "-w", "$windowHandle"
        )
        $normalCloseChild = Wait-ForProcessWindow `
            $appProcess.Id `
            "dynwinrt-jsx Gallery — child window" `
            $windowHandle
        $normalCloseChildHandle = [int64]$normalCloseChild.hwnd
        Invoke-WinApp @(
            "ui", "invoke", "Close",
            "-w", "$normalCloseChildHandle"
        )
        Start-Sleep -Milliseconds 500
        $stillOpenWindow = Wait-ForProcessWindow `
            $appProcess.Id `
            "dynwinrt-jsx Gallery — child window" `
            $windowHandle
        Invoke-WinApp @(
            "ui", "invoke", "Close",
            "-w", "$windowHandle"
        )
        if (-not $appProcess.WaitForExit($TimeoutMilliseconds)) {
            throw "The Gallery did not exit after normal close with a child window open."
        }
        Assert-NoProcessWindow `
            $appProcess.Id `
            "dynwinrt-jsx Gallery — child window" `
            $windowHandle
        $windowHandle = 0
        Write-Host "Gallery Windowing UI smoke passed. Evidence: $evidenceRoot"
        return
    }

    if ($DesignOnly) {
        Invoke-WinApp @(
            "ui", "wait-for", "GalleryRenderError",
            "-w", "$windowHandle",
            "--gone",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp @(
            "ui", "invoke", "Close",
            "-w", "$windowHandle"
        )
        if (-not $appProcess.WaitForExit($TimeoutMilliseconds)) {
            throw "The Gallery did not exit after Design smoke."
        }
        $windowHandle = 0
        if ($appProcess.ExitCode -ne 0) {
            throw "The Gallery Design smoke exited with code $($appProcess.ExitCode)."
        }
        $stdout = Get-Content $stdoutPath -Raw
        if ($stdout -notmatch "renderer disposed cleanly") {
            throw "The Gallery Design smoke did not report clean renderer disposal."
        }
        if (Test-Path $heartbeatEvidencePath) {
            throw "The Gallery Design smoke produced heartbeat timeout evidence."
        }
        Write-Host "Gallery Design smoke passed. Evidence: $evidenceRoot"
        return
    }

    Ensure-NavigationItem $windowHandle "GalleryHomeNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryHomeNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "GalleryHomeHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "set-value", "TextBox", "",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "GalleryHomeHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $homeScreenshotPath
    )
    $scrollBeforeJson = Invoke-WinApp @(
        "ui", "get-property", "GalleryFeatureScroller",
        "-w", "$windowHandle",
        "--json"
    ) -Capture
    $scrollBefore = $scrollBeforeJson | ConvertFrom-Json
    Invoke-WinApp @(
        "ui", "invoke", "GalleryFeatureNext",
        "-w", "$windowHandle"
    )
    Start-Sleep -Milliseconds 200
    $scrollAfterJson = Invoke-WinApp @(
        "ui", "get-property", "GalleryFeatureScroller",
        "-w", "$windowHandle",
        "--json"
    ) -Capture
    $scrollAfter = $scrollAfterJson | ConvertFrom-Json
    if (
        [double]$scrollAfter.properties.ScrollHorizontalPercent -le
        [double]$scrollBefore.properties.ScrollHorizontalPercent
    ) {
        throw "The Home feature carousel did not move forward."
    }
    Invoke-WinApp @(
        "ui", "invoke", "GalleryFeaturePrevious",
        "-w", "$windowHandle"
    )
    $recentScrollBeforeJson = Invoke-WinApp @(
        "ui", "get-property", "GalleryRecentScroller",
        "-w", "$windowHandle",
        "--json"
    ) -Capture
    $recentScrollBefore = $recentScrollBeforeJson | ConvertFrom-Json
    Invoke-WinApp @(
        "ui", "invoke", "GalleryRecentNext",
        "-w", "$windowHandle"
    )
    Start-Sleep -Milliseconds 200
    $recentScrollAfterJson = Invoke-WinApp @(
        "ui", "get-property", "GalleryRecentScroller",
        "-w", "$windowHandle",
        "--json"
    ) -Capture
    $recentScrollAfter = $recentScrollAfterJson | ConvertFrom-Json
    if (
        [double]$recentScrollAfter.properties.ScrollHorizontalPercent -le
        [double]$recentScrollBefore.properties.ScrollHorizontalPercent
    ) {
        throw "The recently visited carousel did not move forward."
    }
    Invoke-WinApp @(
        "ui", "invoke", "GalleryRecentPrevious",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "invoke", "GalleryFavoritesSelector",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Favorite samples",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Open Signals and control flow",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Assert-Responsive $appProcess.Id "Home favorites"

    Invoke-WinApp @(
        "ui", "invoke", "GalleryDiagnosticsNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "DiagnosticsPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "GalleryHeartbeatStatus",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "GalleryInspectorSummary",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    $heartbeatDeadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    $expectedHeartbeatStatus =
        if ($env:DYNWINRT_JSX_HEARTBEAT -eq "0") {
            "disabled"
        }
        else {
            "connected"
        }
    $heartbeatReady = $false
    while ([DateTime]::UtcNow -lt $heartbeatDeadline) {
        $heartbeatJson = Invoke-WinApp @(
            "ui", "get-property", "GalleryHeartbeatStatus",
            "-w", "$windowHandle",
            "--json"
        ) -Capture
        $heartbeat = $heartbeatJson | ConvertFrom-Json
        if (
            [string]$heartbeat.properties.Name -match
            "Heartbeat: $expectedHeartbeatStatus"
        ) {
            $heartbeatReady = $true
            break
        }
        Start-Sleep -Milliseconds 100
    }
    if (-not $heartbeatReady) {
        throw "The Gallery heartbeat did not reach '$expectedHeartbeatStatus'."
    }
    Invoke-WinApp @(
        "ui", "invoke", "GalleryInspectorExport",
        "-w", "$windowHandle"
    )
    $exportDeadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    while (
        -not (Test-Path $inspectorExportPath) -and
        [DateTime]::UtcNow -lt $exportDeadline
    ) {
        Start-Sleep -Milliseconds 100
    }
    if (-not (Test-Path $inspectorExportPath)) {
        throw "The Gallery inspector snapshot was not exported."
    }
    $statusDeadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    $exportAcknowledged = $false
    while ([DateTime]::UtcNow -lt $statusDeadline) {
        $statusJson = Invoke-WinApp @(
            "ui", "get-property", "GalleryInspectorExportStatus",
            "-w", "$windowHandle",
            "--json"
        ) -Capture
        $exportStatus = $statusJson | ConvertFrom-Json
        if ([string]$exportStatus.properties.Name -match "Exported to") {
            $exportAcknowledged = $true
            break
        }
        Start-Sleep -Milliseconds 100
    }
    if (-not $exportAcknowledged) {
        throw "The Gallery did not acknowledge the inspector export."
    }
    $inspectorExport = Get-Content $inspectorExportPath -Raw |
        ConvertFrom-Json
    if (
        $inspectorExport.type -ne "renderer-inspector" -or
        $null -eq $inspectorExport.snapshot.nodes -or
        $null -eq $inspectorExport.snapshot.operations
    ) {
        throw "The Gallery inspector export is invalid."
    }
    Invoke-WinApp @(
        "ui", "invoke", "SettingsItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "SettingsPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Assert-Responsive $appProcess.Id "Settings"
    if (Test-Path $heartbeatEvidencePath) {
        throw "The Gallery heartbeat timed out during UI smoke."
    }

    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $screenshotPath
    )

    Ensure-NavigationItem $windowHandle "GalleryHomeNavItem"
    Invoke-WinApp @(
        "ui", "invoke", "GalleryHomeNavItem",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "GalleryHomeHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "set-value", "TextBox", "multiple windows xaml",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "GallerySearchHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "invoke", "Open Multiple windows",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "MultipleWindowsPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @(
        "ui", "invoke", "GalleryWindowingCreateCancelingWindow",
        "-w", "$windowHandle"
    )
    $normalCloseChild = Wait-ForProcessWindow `
        $appProcess.Id `
        "dynwinrt-jsx Gallery — child window" `
        $windowHandle
    $normalCloseChildHandle = [int64]$normalCloseChild.hwnd
    Invoke-WinApp @(
        "ui", "invoke", "Close",
        "-w", "$normalCloseChildHandle"
    )
    Start-Sleep -Milliseconds 500
    $stillOpenWindow = Wait-ForProcessWindow `
        $appProcess.Id `
        "dynwinrt-jsx Gallery — child window" `
        $windowHandle
    Invoke-WinApp @(
        "ui", "invoke", "Close",
        "-w", "$windowHandle"
    )
    if (-not $appProcess.WaitForExit($TimeoutMilliseconds)) {
        throw "The Gallery did not exit after normal close with a child window open."
    }
    Assert-NoProcessWindow `
        $appProcess.Id `
        "dynwinrt-jsx Gallery — child window" `
        $windowHandle
    $windowHandle = 0
    Write-Host "Gallery UI smoke passed. Evidence: $evidenceRoot"
}
finally {
    if ($windowHandle) {
        & $WinAppPath ui invoke Close -w "$windowHandle" 2>$null | Out-Null
    }
    if (-not $appProcess.HasExited) {
        if (-not $appProcess.WaitForExit(5000)) {
            Stop-Process -Id $appProcess.Id -Force
        }
    }
    Remove-Item Env:DYNWINRT_JSX_STATE_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:DYNWINRT_JSX_HEARTBEAT_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:DYNWINRT_JSX_INSPECTOR_EXPORT_PATH -ErrorAction SilentlyContinue
}
