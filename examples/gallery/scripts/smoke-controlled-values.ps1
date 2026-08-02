#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [ValidateRange(1, 20)]
    [int]$Cycles = 3,
    [string]$WinAppPath,
    [string]$OutputDirectory,
    [int]$TimeoutMilliseconds = 15000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$galleryRoot = Split-Path $PSScriptRoot -Parent
if (-not $OutputDirectory) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputDirectory = Join-Path `
        $galleryRoot `
        ".winapp\controlled-values\$stamp"
}
New-Item `
    -ItemType Directory `
    -Path $OutputDirectory `
    -Force |
    Out-Null
$OutputDirectory = (
    Resolve-Path -LiteralPath $OutputDirectory
).Path

$routes = @(
    "pivot",
    "tab-view",
    "semantic-zoom",
    "tree-view"
)
$results = [Collections.Generic.List[object]]::new()
$built = $false

foreach ($route in $routes) {
    for ($cycle = 1; $cycle -le $Cycles; $cycle += 1) {
        $evidence = Join-Path `
            $OutputDirectory `
            "$route-$cycle"
        $parameters = @{
            ControlledOnly = $true
            ControlledRoute = $route
            SkipKeyboardInput = $true
            TimeoutMilliseconds = $TimeoutMilliseconds
            EvidenceRoot = $evidence
        }
        if ($built) {
            $parameters.SkipBuild = $true
        }
        if ($WinAppPath) {
            $parameters.WinAppPath = $WinAppPath
        }

        $startedAt = Get-Date
        Write-Host "[$route $cycle/$Cycles]"
        & (Join-Path $PSScriptRoot "smoke-ui.ps1") @parameters
        $built = $true
        $results.Add([ordered]@{
            route = $route
            cycle = $cycle
            durationMs = (
                (Get-Date) - $startedAt
            ).TotalMilliseconds
            evidence = $evidence
        })
    }
}

$summary = [ordered]@{
    protocol = "dynwinrt-jsx.controlled-value-smoke"
    version = 1
    generatedAt = [DateTime]::UtcNow.ToString("o")
    cycles = $Cycles
    routes = $routes
    results = $results
}
$summaryPath = Join-Path $OutputDirectory "summary.json"
$summary |
    ConvertTo-Json -Depth 6 |
    Set-Content `
        -LiteralPath $summaryPath `
        -Encoding UTF8

Write-Host "Controlled-value smoke passed: $summaryPath"
