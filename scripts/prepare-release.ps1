#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$OutputDirectory,
    [string]$NodePath,
    [switch]$RequireCleanSources,
    [switch]$RequireTagMatch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path `
        $repoRoot `
        ".winapp\release\$([DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss"))"
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)

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
        if (Test-Path -LiteralPath $candidate) {
            return [IO.Path]::GetFullPath($candidate)
        }
    }
    throw "Node.js was not found. Pass -NodePath."
}

function Invoke-Checked(
    [string]$FilePath,
    [string[]]$Arguments,
    [switch]$Capture
) {
    Push-Location $repoRoot
    try {
        if ($Capture) {
            $output = @(& $FilePath @Arguments)
            if ($LASTEXITCODE -ne 0) {
                throw "$FilePath $($Arguments -join ' ') exited with $LASTEXITCODE."
            }
            return $output
        }
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$FilePath $($Arguments -join ' ') exited with $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

function Remove-GitRemoteCredentials([string]$Remote) {
    if ($Remote -match "^(https?://)[^/@]+@(.+)$") {
        return "$($Matches[1])$($Matches[2])"
    }
    return $Remote
}

$NodePath = Resolve-Node $NodePath
$npm = Join-Path (Split-Path $NodePath -Parent) "npm.cmd"
if (-not (Test-Path -LiteralPath $npm)) {
    throw "npm was not found beside $NodePath."
}
$env:PATH = "$(Split-Path $NodePath -Parent);$env:PATH"
$package = Get-Content `
    -LiteralPath (Join-Path $repoRoot "package.json") `
    -Raw |
    ConvertFrom-Json
if ($package.version -notmatch "^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$") {
    throw "package.json must contain an exact semantic version."
}
$changelog = Get-Content `
    -LiteralPath (Join-Path $repoRoot "CHANGELOG.md") `
    -Raw
if ($changelog -notmatch "(?m)^## $([regex]::Escape($package.version))$") {
    throw "CHANGELOG.md does not contain a section for $($package.version)."
}
if ($RequireTagMatch) {
    $tag = $env:GITHUB_REF_NAME
    if ([string]::IsNullOrWhiteSpace($tag)) {
        throw "GITHUB_REF_NAME is required for tag validation."
    }
    if ($tag -cne "v$($package.version)") {
        throw "Release tag $tag does not match package version $($package.version)."
    }
}

$sourceStatus = @(
    git -C $repoRoot status --porcelain=v1 --untracked-files=all
)
if ($RequireCleanSources -and $sourceStatus.Count -gt 0) {
    throw "Release source is dirty:`n$($sourceStatus -join "`n")"
}

New-Item -ItemType Directory -Path $OutputDirectory -Force |
    Out-Null
if (
    Get-ChildItem -LiteralPath $OutputDirectory -Force |
        Select-Object -First 1
) {
    throw "Release output directory is not empty: $OutputDirectory"
}

Invoke-Checked $npm @("run", "check")
$packOutput = Invoke-Checked $npm @(
    "pack",
    "--ignore-scripts",
    "--json",
    "--pack-destination",
    $OutputDirectory
) -Capture
$packResult = $packOutput -join "`n" | ConvertFrom-Json
$tarball = Join-Path $OutputDirectory $packResult[0].filename
if (-not (Test-Path -LiteralPath $tarball)) {
    throw "npm pack did not create $tarball."
}

$entries = @(& tar -tf $tarball)
if ($LASTEXITCODE -ne 0) {
    throw "Failed to inspect $tarball."
}
$required = @(
    "package/package.json",
    "package/dist/index.js",
    "package/dist/index.d.ts",
    "package/dist/core.js",
    "package/dist/core.d.ts",
    "package/dist/controls.js",
    "package/dist/controls.d.ts",
    "package/dist/winui.js",
    "package/dist/winui.d.ts",
    "package/dist/native.js",
    "package/dist/native.d.ts",
    "package/dist/diagnostics.js",
    "package/dist/diagnostics.d.ts",
    "package/dist/host.js",
    "package/dist/host.d.ts",
    "package/dist/worker.js",
    "package/dist/worker.d.ts",
    "package/bin/create.js",
    "package/templates/winui/main.js",
    "package/templates/winui/src/app-state.ts",
    "package/templates/winui/src/winui-worker.tsx",
    "package/templates/winui-minimal/package.json",
    "package/templates/winui-minimal/src/app.tsx",
    "package/templates/winui-minimal/src/winui-worker.tsx",
    "package/docs/public-api-baseline.json",
    "package/docs/api-layers.md",
    "package/docs/tutorial-dashboard/README.md",
    "package/docs/versioning.md",
    "package/README.md",
    "package/CHANGELOG.md",
    "package/LICENSE"
)
$missing = @(
    $required |
        Where-Object { $entries -notcontains $_ }
)
if ($missing.Count -gt 0) {
    throw "Release tarball is missing: $($missing -join ', ')"
}

$manifestPath = Join-Path $OutputDirectory "release-manifest.json"
$manifest = [ordered]@{
    protocol = "dynwinrt-jsx.release"
    version = 1
    generatedAt = [DateTime]::UtcNow.ToString("O")
    package = [ordered]@{
        name = $package.name
        version = $package.version
        file = [IO.Path]::GetFileName($tarball)
        bytes = (Get-Item -LiteralPath $tarball).Length
        sha256 = (
            Get-FileHash -LiteralPath $tarball -Algorithm SHA256
        ).Hash.ToLowerInvariant()
    }
    publicApi = [ordered]@{
        baseline = "docs/public-api-baseline.json"
        sha256 = (
            Get-FileHash `
                -LiteralPath (Join-Path $repoRoot "docs\public-api-baseline.json") `
                -Algorithm SHA256
        ).Hash.ToLowerInvariant()
    }
    source = [ordered]@{
        repository = Remove-GitRemoteCredentials (
            (git -C $repoRoot remote get-url origin).Trim()
        )
        branch = (
            git -C $repoRoot branch --show-current
        ).Trim()
        commit = (
            git -C $repoRoot rev-parse HEAD
        ).Trim()
        dirty = $sourceStatus.Count -gt 0
        status = $sourceStatus
    }
    tools = [ordered]@{
        node = (& $NodePath --version).Trim()
        npm = (& $npm --version).Trim()
    }
}
$manifest |
    ConvertTo-Json -Depth 8 |
    Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Output "Release package: $tarball"
Write-Output "Release manifest: $manifestPath"
