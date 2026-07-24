#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$WinAppPath,
    [int]$TimeoutMilliseconds = 10000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$galleryRoot = Split-Path $PSScriptRoot -Parent
$repoRoot = Split-Path (Split-Path $galleryRoot -Parent) -Parent
$workRoot = Split-Path $repoRoot -Parent
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

function Assert-Responsive([int]$ProcessId, [string]$Page) {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    if (-not $process.Responding) {
        throw "The Gallery stopped responding on '$Page'."
    }
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

$evidenceRoot = Join-Path $galleryRoot ".winapp\smoke"
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$stdoutPath = Join-Path $evidenceRoot "gallery.stdout.log"
$stderrPath = Join-Path $evidenceRoot "gallery.stderr.log"
$screenshotPath = Join-Path $evidenceRoot "gallery.png"
$homeScreenshotPath = Join-Path $evidenceRoot "home.png"
$categoryScreenshotPath = Join-Path $evidenceRoot "basic-input-category.png"
$sourceCodeScreenshotPath = Join-Path $evidenceRoot "source-code.png"
$smokeStatePath = Join-Path $evidenceRoot "state.json"
$heartbeatEvidencePath = Join-Path $evidenceRoot "heartbeat-timeout.json"
$inspectorExportPath = Join-Path $evidenceRoot "inspector-snapshot.json"
Remove-Item -Path $smokeStatePath -Force -ErrorAction SilentlyContinue
Remove-Item -Path $heartbeatEvidencePath -Force -ErrorAction SilentlyContinue
Remove-Item -Path $inspectorExportPath -Force -ErrorAction SilentlyContinue
[IO.File]::WriteAllText(
    $smokeStatePath,
    '{"version":1,"count":0,"darkTheme":false,"updatedAt":null,"recentPageIds":["buttons"],"favoritePageIds":["buttons"]}'
)
$env:DYNWINRT_JSX_STATE_PATH = $smokeStatePath
$env:DYNWINRT_JSX_HEARTBEAT_PATH = $heartbeatEvidencePath
$env:DYNWINRT_JSX_INSPECTOR_EXPORT_PATH = $inspectorExportPath

& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    throw "Gallery build failed."
}

$nodePath = (Get-Command node -ErrorAction Stop).Source
$appProcess = Start-Process `
    -FilePath $nodePath `
    -ArgumentList "main.js" `
    -WorkingDirectory $galleryRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru

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
        $migratedState.recentPageIds -contains "buttons" -or
        $migratedState.favoritePageIds -contains "buttons"
    ) {
        throw "The legacy 'buttons' page ID was not migrated to 'button'."
    }

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
        [pscustomobject]@{ Name = "Open Text and numeric input"; Heading = "TextInputPageHeading"; Probe = "GalleryTextInputSample"; Query = "passwordbox" },
        [pscustomobject]@{ Name = "Open Range and progress"; Heading = "RangeProgressPageHeading"; Probe = "GalleryRangeProgressSample"; Query = "progressring" },
        [pscustomobject]@{ Name = "Open Choices and status"; Heading = "ChoicesStatusPageHeading"; Probe = "GalleryChoicesStatusSample"; Query = "infobar" },
        [pscustomobject]@{ Name = "Open Collections and virtualization"; Heading = "CollectionsPageHeading"; Probe = $null; Query = "itemsrepeater" },
        [pscustomobject]@{ Name = "Open Grid and layout"; Heading = "LayoutPageHeading"; Probe = $null; Query = "grid layout" },
        [pscustomobject]@{ Name = "Open Dialogs and flyouts"; Heading = "OverlaysPageHeading"; Probe = $null; Query = "contentdialog" },
        [pscustomobject]@{ Name = "Open Resources and styling"; Heading = "ResourcesPageHeading"; Probe = $null; Query = "theme resource" },
        [pscustomobject]@{ Name = "Open Icons and glyphs"; Heading = "IconsPageHeading"; Probe = "GalleryIconsSample"; Query = "symbolicon" }
    )

    foreach ($route in $routes) {
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
        Invoke-WinApp @(
            "ui", "invoke", $route.Name,
            "-w", "$windowHandle"
        )
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
        if ($route.Heading -eq "SplitButtonPageHeading") {
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
        if ($route.Heading -eq "ToggleSplitButtonPageHeading") {
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
                "ui", "click", $checkBox.selector,
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
                "ui", "click", $ringCheckBox.selector,
                "-w", "$windowHandle"
            )
            Invoke-WinApp @(
                "ui", "wait-for", "Spectrum: Ring",
                "-w", "$windowHandle",
                "--timeout", "$TimeoutMilliseconds"
            )
        }
        if ($route.Heading -eq "ComboBoxPageHeading") {
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

    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $screenshotPath
    )
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
