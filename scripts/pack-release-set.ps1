#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$WorkRoot,
    [string]$NodePath,
    [string]$DotNetPath,
    [string]$OutputDirectory,
    [switch]$SkipBuild,
    [switch]$AllowDirtySources
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
if (-not $WorkRoot) {
    $WorkRoot = Split-Path $repoRoot -Parent
}
if (-not $OutputDirectory) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputDirectory = Join-Path `
        $repoRoot `
        ".winapp\release-set\$stamp"
}

$dynwinrtRoot = Join-Path $WorkRoot "dynwinrt"
$dynwinrtRuntimeRoot = Join-Path $dynwinrtRoot "bindings\js"
$codegenRoot = Join-Path $dynwinrtRoot "tools\dynwinrt-codegen\npm"
$winappRoot = Join-Path $WorkRoot "winappCli"
$winappNpmRoot = Join-Path $winappRoot "src\winapp-npm"
$winappProject = Join-Path `
    $winappRoot `
    "src\winapp-CLI\WinApp.Cli\WinApp.Cli.csproj"
$templateManifestPath = Join-Path `
    $repoRoot `
    "templates\winui\package.json"

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
            (Test-Path -LiteralPath $candidate) -and
            ((& $candidate --list-sdks) -match "(?m)^10\.0\.")
        ) {
            return [IO.Path]::GetFullPath($candidate)
        }
    }
    throw ".NET SDK 10.x was not found. Pass -DotNetPath."
}

function Require-Path([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Label was not found at $Path."
    }
}

function Invoke-Checked(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory,
    [switch]$Capture
) {
    Push-Location $WorkingDirectory
    try {
        if ($Capture) {
            $output = & $FilePath @Arguments
            if ($LASTEXITCODE -ne 0) {
                throw "$FilePath $($Arguments -join ' ') exited with $LASTEXITCODE."
            }
            return @($output)
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

function Read-Manifest([string]$Root) {
    return Get-Content `
        -LiteralPath (Join-Path $Root "package.json") `
        -Raw |
        ConvertFrom-Json
}

function Ensure-NpmDependencies(
    [string]$Root,
    [string]$Probe
) {
    if (Test-Path -LiteralPath (Join-Path $Root $Probe)) {
        return
    }
    Invoke-Checked `
        $npmPath `
        @(
            "ci",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund"
        ) `
        $Root
}

function Assert-ExactVersion(
    [string]$Value,
    [string]$Label
) {
    if (
        $Value -notmatch
        "^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$"
    ) {
        throw "$Label must use an exact semantic version; found '$Value'."
    }
}

function Get-RepoState([string]$Root) {
    $status = @(
        git -C $Root status --porcelain=v1 --untracked-files=all
    )
    if (-not $AllowDirtySources -and $status.Count -gt 0) {
        throw "Release source is dirty: $Root`n$($status -join "`n")"
    }
    return [ordered]@{
        repository = (
            git -C $Root config --get remote.origin.url
        ).Trim()
        commit = (git -C $Root rev-parse HEAD).Trim()
        branch = (git -C $Root branch --show-current).Trim()
        dirty = $status.Count -gt 0
        status = $status
    }
}

function Get-StatusText([string]$Root) {
    return @(
        git -C $Root status --porcelain=v1 --untracked-files=all
    ) -join "`n"
}

function Pack-Package(
    [string]$Root,
    [string]$Name,
    [string]$Version,
    [string]$TemplateSpec
) {
    $output = Invoke-Checked `
        $npmPath `
        @(
            "pack",
            "--quiet",
            "--pack-destination",
            $OutputDirectory
        ) `
        $Root `
        -Capture
    $fileName = @(
        $output |
        Where-Object {
            -not [string]::IsNullOrWhiteSpace($_)
        }
    )[-1].Trim()
    $artifactPath = Join-Path $OutputDirectory $fileName
    Require-Path $artifactPath "$Name package"
    return [ordered]@{
        name = $Name
        version = $Version
        templateSpec = $TemplateSpec
        file = $fileName
        bytes = (Get-Item -LiteralPath $artifactPath).Length
        sha256 = (
            Get-FileHash `
                -LiteralPath $artifactPath `
                -Algorithm SHA256
        ).Hash.ToLowerInvariant()
    }
}

foreach ($required in @(
    $dynwinrtRoot,
    $dynwinrtRuntimeRoot,
    $codegenRoot,
    $winappRoot,
    $winappNpmRoot,
    $winappProject,
    $templateManifestPath
)) {
    Require-Path $required "Release-set input"
}

$NodePath = Resolve-Node $NodePath
$DotNetPath = Resolve-DotNet10 $DotNetPath
$npmPath = Join-Path (Split-Path $NodePath -Parent) "npm.cmd"
Require-Path $npmPath "npm"
$nodeArchitecture = (& $NodePath -p "process.arch").Trim()
if ($nodeArchitecture -cne "x64") {
    throw "The x64 release set requires x64 Node.js; found $nodeArchitecture."
}

New-Item `
    -ItemType Directory `
    -Path $OutputDirectory `
    -Force |
    Out-Null
$OutputDirectory = (
    Resolve-Path -LiteralPath $OutputDirectory
).Path
if (
    Get-ChildItem `
        -LiteralPath $OutputDirectory `
        -Force |
    Select-Object -First 1
) {
    throw "Release-set output directory is not empty: $OutputDirectory"
}

$template = Get-Content `
    -LiteralPath $templateManifestPath `
    -Raw |
    ConvertFrom-Json
$runtimeManifest = Read-Manifest $dynwinrtRuntimeRoot
$codegenManifest = Read-Manifest $codegenRoot
$winappManifest = Read-Manifest $winappNpmRoot
$jsxManifest = Read-Manifest $repoRoot

$expected = [ordered]@{
    "@microsoft/dynwinrt" =
        $template.dependencies."@microsoft/dynwinrt"
    "dynwinrt-jsx" =
        $template.dependencies."dynwinrt-jsx"
    "@microsoft/dynwinrt-codegen" =
        $template.devDependencies."@microsoft/dynwinrt-codegen"
    "@microsoft/winappcli" =
        $template.devDependencies."@microsoft/winappcli"
    "typescript" =
        $template.devDependencies.typescript
}
foreach ($entry in $expected.GetEnumerator()) {
    Assert-ExactVersion $entry.Value $entry.Key
}

$actualVersions = [ordered]@{
    "@microsoft/dynwinrt" = $runtimeManifest.version
    "dynwinrt-jsx" = $jsxManifest.version
    "@microsoft/dynwinrt-codegen" = $codegenManifest.version
    "@microsoft/winappcli" = $winappManifest.version
}
foreach ($entry in $actualVersions.GetEnumerator()) {
    if ($expected[$entry.Key] -cne $entry.Value) {
        throw (
            "Template expects {0}@{1}, but the source package is {2}." -f
            $entry.Key,
            $expected[$entry.Key],
            $entry.Value
        )
    }
}
if ($codegenManifest.version -cne $runtimeManifest.version) {
    throw (
        "dynwinrt runtime/codegen versions differ: {0} vs {1}." -f
        $runtimeManifest.version,
        $codegenManifest.version
    )
}

$sourceRoots = [ordered]@{
    dynwinrt = $dynwinrtRoot
    dynwinrtJsx = $repoRoot
    winappCli = $winappRoot
}
$sourceStates = [ordered]@{}
$sourceStatuses = [ordered]@{}
foreach ($entry in $sourceRoots.GetEnumerator()) {
    $sourceStates[$entry.Key] = Get-RepoState $entry.Value
    $sourceStatuses[$entry.Key] = Get-StatusText $entry.Value
}

$oldDotNetRoot = $env:DOTNET_ROOT
$oldPath = $env:PATH
try {
    $env:DOTNET_ROOT = Split-Path $DotNetPath -Parent
    $env:PATH = (
        "$(Split-Path $NodePath -Parent);" +
        "$env:DOTNET_ROOT;$env:PATH"
    )
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"
    $env:WINAPP_CLI_TELEMETRY_OPTOUT = "1"

    if (-not $SkipBuild) {
        Ensure-NpmDependencies `
            $dynwinrtRuntimeRoot `
            "node_modules\.bin\napi.cmd"
        Ensure-NpmDependencies `
            $winappNpmRoot `
            "node_modules\.bin\tsc.cmd"
        Ensure-NpmDependencies `
            $repoRoot `
            "node_modules\.bin\tsc.cmd"
        Invoke-Checked `
            $npmPath `
            @("run", "build") `
            $dynwinrtRuntimeRoot
        Invoke-Checked `
            "cargo.exe" `
            @(
                "build",
                "--release",
                "-p",
                "dynwinrt-codegen"
            ) `
            $dynwinrtRoot
        $codegenBinDirectory = Join-Path $codegenRoot "bin\x64"
        New-Item `
            -ItemType Directory `
            -Path $codegenBinDirectory `
            -Force |
            Out-Null
        Copy-Item `
            -LiteralPath (
                Join-Path `
                    $dynwinrtRoot `
                    "target\release\dynwinrt-codegen.exe"
            ) `
            -Destination (
                Join-Path `
                    $codegenBinDirectory `
                    "dynwinrt-codegen.exe"
            ) `
            -Force

        Invoke-Checked `
            $npmPath `
            @("run", "compile") `
            $winappNpmRoot
        Invoke-Checked `
            $DotNetPath `
            @(
                "publish",
                $winappProject,
                "-c",
                "Release",
                "-r",
                "win-x64",
                "--self-contained",
                "-o",
                (Join-Path $winappNpmRoot "bin\win-x64")
            ) `
            $winappRoot
    }

    $packages = @(
        Pack-Package `
            $dynwinrtRuntimeRoot `
            "@microsoft/dynwinrt" `
            $runtimeManifest.version `
            $expected["@microsoft/dynwinrt"]
        Pack-Package `
            $codegenRoot `
            "@microsoft/dynwinrt-codegen" `
            $codegenManifest.version `
            $expected["@microsoft/dynwinrt-codegen"]
        Pack-Package `
            $winappNpmRoot `
            "@microsoft/winappcli" `
            $winappManifest.version `
            $expected["@microsoft/winappcli"]
        Pack-Package `
            $repoRoot `
            "dynwinrt-jsx" `
            $jsxManifest.version `
            $expected["dynwinrt-jsx"]
    )
}
finally {
    $env:DOTNET_ROOT = $oldDotNetRoot
    $env:PATH = $oldPath
}

foreach ($entry in $sourceRoots.GetEnumerator()) {
    $current = Get-StatusText $entry.Value
    if ($current -cne $sourceStatuses[$entry.Key]) {
        throw "Release-set build changed tracked source state in $($entry.Value)."
    }
}

$manifest = [ordered]@{
    protocol = "dynwinrt-jsx.release-set"
    version = 1
    generatedAt = [DateTime]::UtcNow.ToString("o")
    architecture = "x64"
    outputDirectory = $OutputDirectory
    template = [ordered]@{
        path = $templateManifestPath
        dependencies = $expected
    }
    tools = [ordered]@{
        node = (& $NodePath --version).Trim()
        nodeArchitecture = $nodeArchitecture
        dotnet = (& $DotNetPath --version).Trim()
        cargo = (cargo --version).Trim()
    }
    sources = $sourceStates
    packages = $packages
}
$manifestPath = Join-Path $OutputDirectory "release-set.json"
$manifest |
    ConvertTo-Json -Depth 8 |
    Set-Content `
        -LiteralPath $manifestPath `
        -Encoding UTF8

Write-Host "Release set: $manifestPath"
