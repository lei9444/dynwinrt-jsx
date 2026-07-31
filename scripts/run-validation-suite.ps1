#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [ValidateSet("quick", "native", "full")]
    [string]$Profile = "quick",
    [string]$OutputDirectory,
    [string]$NodePath,
    [string]$DotNetPath,
    [string]$WinAppPath,
    [switch]$SkipDesktopInput,
    [switch]$PlanOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$galleryRoot = Join-Path $repoRoot "examples\gallery"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path `
        $repoRoot `
        ".winapp\validation\$stamp"
}
New-Item -ItemType Directory -Path $OutputDirectory -Force |
    Out-Null
$OutputDirectory = (Resolve-Path $OutputDirectory).Path

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
    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (Test-Path $candidate) {
            return [IO.Path]::GetFullPath($candidate)
        }
    }
    throw "Node.js was not found. Pass -NodePath."
}

function Resolve-DotNet10([string]$RequestedPath) {
    $candidates = @()
    if ($RequestedPath) {
        $candidates += $RequestedPath
    }
    $command = Get-Command dotnet.exe -ErrorAction SilentlyContinue
    if ($command) {
        $candidates += $command.Source
    }
    $candidates += @(
        (Join-Path $HOME ".dotnet10latest\dotnet.exe"),
        (Join-Path $HOME ".dotnet\dotnet.exe"),
        "C:\.tools\dotnet\dotnet.exe",
        (Join-Path $env:ProgramFiles "dotnet\dotnet.exe")
    )
    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (
            (Test-Path $candidate) -and
            ((& $candidate --list-sdks) -match "(?m)^10\.0\.")
        ) {
            return [IO.Path]::GetFullPath($candidate)
        }
    }
    throw ".NET SDK 10.x was not found. Pass -DotNetPath."
}

$node = Resolve-Node $NodePath
$dotnet = if ($Profile -eq "full") {
    Resolve-DotNet10 $DotNetPath
} else {
    $null
}
$npm = Join-Path (Split-Path $node) "npm.cmd"
$pwsh = (Get-Command pwsh.exe -ErrorAction Stop).Source
$env:PATH = "$(Split-Path $node);$env:PATH"

function New-Step(
    [string]$Id,
    [string]$Description,
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory,
    [string[]]$Profiles
) {
    [pscustomobject][ordered]@{
        id = $Id
        description = $Description
        filePath = $FilePath
        arguments = $Arguments
        workingDirectory = $WorkingDirectory
        profiles = $Profiles
    }
}

$steps = @(
    New-Step `
        "package-check" `
        "Typecheck, build, and run the package test suite." `
        $npm `
        @("run", "check") `
        $repoRoot `
        @("quick", "native", "full")
    New-Step `
        "gallery-lifecycle" `
        "Build Gallery and run lifecycle/module tests." `
        $npm `
        @("--prefix", $galleryRoot, "run", "test:lifecycle") `
        $repoRoot `
        @("quick", "native", "full")
    New-Step `
        "native-selftest" `
        "Run real-WinUI property, event, ownership, and cleanup selftests." `
        $pwsh `
        @(
            "-NoProfile",
            "-File",
            (Join-Path $PSScriptRoot "run-native-selftest.ps1"),
            "-NodePath",
            $node
        ) `
        $repoRoot `
        @("native", "full")
    New-Step `
        "gallery-router-uia" `
        "Run Gallery lazy-route and navigation UI Automation smoke." `
        $pwsh `
        @(
            "-NoProfile",
            "-File",
            (Join-Path $galleryRoot "scripts\smoke-ui.ps1"),
            "-RouterOnly",
            "-SkipKeyboardInput",
            $(if ($WinAppPath) {
                "-WinAppPath"
            } else {
                $null
            }),
            $(if ($WinAppPath) {
                $WinAppPath
            } else {
                $null
            })
        ) `
        $galleryRoot `
        @("native", "full")
    New-Step `
        "gallery-motion-uia" `
        "Run Composition animation start/stop/resource ownership UIA." `
        $pwsh `
        @(
            "-NoProfile",
            "-File",
            (Join-Path $galleryRoot "scripts\smoke-ui.ps1"),
            "-MotionOnly",
            "-SkipKeyboardInput",
            $(if ($WinAppPath) {
                "-WinAppPath"
            } else {
                $null
            }),
            $(if ($WinAppPath) {
                $WinAppPath
            } else {
                $null
            })
        ) `
        $galleryRoot `
        @("native", "full")
    New-Step `
        "dashboard-soak" `
        "Run repeated Dashboard route/evidence/orphan/final-idle validation." `
        $pwsh `
        @(
            "-NoProfile",
            "-File",
            (Join-Path $PSScriptRoot "repeat-dashboard-smoke.ps1"),
            "-Cycles",
            "3",
            "-NodePath",
            $node,
            "-DotNetPath",
            $dotnet,
            "-SkipDesktopInput"
        ) `
        $repoRoot `
        @("full")
    New-Step `
        "gallery-full-uia" `
        "Run the complete interactive Gallery category/control UIA matrix." `
        $pwsh `
        @(
            "-NoProfile",
            "-File",
            (Join-Path $galleryRoot "scripts\smoke-ui.ps1"),
            $(if ($SkipDesktopInput) {
                "-CategoryOnly"
            } else {
                $null
            }),
            $(if ($SkipDesktopInput) {
                "-SkipKeyboardInput"
            } else {
                $null
            }),
            $(if ($WinAppPath) {
                "-WinAppPath"
            } else {
                $null
            }),
            $(if ($WinAppPath) {
                $WinAppPath
            } else {
                $null
            })
        ) `
        $galleryRoot `
        @("full")
    New-Step `
        "accessibility-matrix" `
        "Run High Contrast, text scale, motion, keyboard, and UIA validation." `
        $pwsh `
        @(
            "-NoProfile",
            "-File",
            (Join-Path $PSScriptRoot "run-accessibility-matrix.ps1"),
            "-NodePath",
            $node,
            "-IncludeUIA",
            $(if ($SkipDesktopInput) {
                "-SkipDesktopInput"
            } else {
                $null
            })
        ) `
        $repoRoot `
        @("full")
    New-Step `
        "generated-app" `
        "Create and smoke a fresh local generated application." `
        $pwsh `
        @(
            "-NoProfile",
            "-File",
            (Join-Path $PSScriptRoot "smoke-generated-app-local.ps1"),
            "-NodePath",
            $node,
            "-DotNetPath",
            $dotnet
        ) `
        $repoRoot `
        @("full")
) | Where-Object {
    $_.profiles -contains $Profile
} | ForEach-Object {
    $_.arguments = @(
        $_.arguments |
        Where-Object {
            -not [string]::IsNullOrWhiteSpace($_)
        }
    )
    $_
}

$results = [Collections.Generic.List[object]]::new()
function ConvertTo-ProcessArgument([string]$Value) {
    if ($Value -notmatch '[\s"]') {
        return $Value
    }
    return '"' + $Value.Replace('"', '\"') + '"'
}

foreach ($step in $steps) {
    $stdoutPath = Join-Path `
        $OutputDirectory `
        "$($step.id).stdout.log"
    $stderrPath = Join-Path `
        $OutputDirectory `
        "$($step.id).stderr.log"
    $startedAt = Get-Date
    Write-Host "[$($step.id)] $($step.description)"

    if ($PlanOnly) {
        $results.Add([pscustomobject][ordered]@{
            id = $step.id
            description = $step.description
            status = "planned"
            durationMs = 0
            exitCode = $null
            stdout = $stdoutPath
            stderr = $stderrPath
        })
        continue
    }

    $timer = [Diagnostics.Stopwatch]::StartNew()
    $argumentLine = (
        $step.arguments |
        ForEach-Object {
            ConvertTo-ProcessArgument $_
        }
    ) -join " "
    $process = Start-Process `
        -FilePath $step.filePath `
        -ArgumentList $argumentLine `
        -WorkingDirectory $step.workingDirectory `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -PassThru `
        -Wait
    $timer.Stop()
    $status = if ($process.ExitCode -eq 0) {
        "passed"
    } else {
        "failed"
    }
    $results.Add([pscustomobject][ordered]@{
        id = $step.id
        description = $step.description
        status = $status
        startedAt = $startedAt.ToUniversalTime().ToString("o")
        durationMs = $timer.Elapsed.TotalMilliseconds
        exitCode = $process.ExitCode
        stdout = $stdoutPath
        stderr = $stderrPath
    })
    Write-Host (
        "  {0} in {1:N1}s" -f
        $status,
        $timer.Elapsed.TotalSeconds
    )
}

$failed = @(
    $results |
    Where-Object { $_.status -eq "failed" }
)
$summary = [ordered]@{
    protocol = "dynwinrt-jsx.validation-suite"
    version = 1
    generatedAt =
        (Get-Date).ToUniversalTime().ToString("o")
    profile = $Profile
    planOnly = [bool]$PlanOnly
    repository = $repoRoot
    commit = (
        & git -C $repoRoot rev-parse HEAD 2>$null
    ).Trim()
    success = $failed.Count -eq 0
    steps = $results
}
$summaryPath = Join-Path $OutputDirectory "summary.json"
$summary |
    ConvertTo-Json -Depth 8 |
    Set-Content -LiteralPath $summaryPath -Encoding UTF8

$results |
    Select-Object `
        id,
        status,
        exitCode,
        @{n="seconds";e={[Math]::Round($_.durationMs / 1000, 1)}} |
    Format-Table -AutoSize
Write-Host "Summary: $summaryPath"

if ($failed.Count -gt 0) {
    exit 1
}
