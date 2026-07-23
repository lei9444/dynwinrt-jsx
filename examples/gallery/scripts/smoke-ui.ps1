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

$evidenceRoot = Join-Path $galleryRoot ".winapp\smoke"
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$stdoutPath = Join-Path $evidenceRoot "gallery.stdout.log"
$stderrPath = Join-Path $evidenceRoot "gallery.stderr.log"
$screenshotPath = Join-Path $evidenceRoot "gallery.png"
$homeScreenshotPath = Join-Path $evidenceRoot "home.png"
$smokeStatePath = Join-Path $evidenceRoot "state.json"
Remove-Item -Path $smokeStatePath -Force -ErrorAction SilentlyContinue
[IO.File]::WriteAllText(
    $smokeStatePath,
    '{"version":1,"count":0,"darkTheme":false,"updatedAt":null,"recentPageIds":[],"favoritePageIds":[]}'
)
$env:DYNWINRT_JSX_STATE_PATH = $smokeStatePath

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

    $routes = @(
        [pscustomobject]@{ Name = "Open Signals and control flow"; Heading = "SignalsPageHeading"; Probe = $null; Query = "reactivity" },
        [pscustomobject]@{ Name = "Open Buttons and toggles"; Heading = "ButtonsPageHeading"; Probe = $null; Query = "checkbox" },
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
}
