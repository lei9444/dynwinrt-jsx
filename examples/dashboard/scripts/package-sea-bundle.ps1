#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [ValidatePattern("^\d+\.\d+\.\d+\.\d+$")]
    [string]$Version = "1.0.0.0",
    [string]$Publisher = "CN=DynWinRTJSXDev",
    [string]$OutputDirectory,
    [string]$CertificatePath,
    [string]$CertificatePassword = $env:DYNWINRT_JSX_CERT_PASSWORD,
    [string]$Arm64DynWinRTAddonPath,
    [string]$WinAppPath,
    [switch]$InstallCertificate,
    [switch]$RequireCleanSources
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$dashboardRoot = Split-Path $PSScriptRoot -Parent
$packageScript = Join-Path $PSScriptRoot "package-sea.ps1"
$stateRoot = Join-Path $dashboardRoot ".winapp\sea-package"
$artifactRoot = if ($OutputDirectory) {
    [IO.Path]::GetFullPath($OutputDirectory)
}
else {
    Join-Path $stateRoot "artifacts"
}
if (-not $CertificatePassword) {
    $CertificatePassword = "password"
}
$certificateProvided = -not [string]::IsNullOrWhiteSpace(
    $CertificatePath
)
if (-not $CertificatePath) {
    $CertificatePath = Join-Path `
        $stateRoot `
        "certificate\DynWinRTJSXDashboard-dev.pfx"
}
if (-not $Arm64DynWinRTAddonPath) {
    $Arm64DynWinRTAddonPath = Join-Path `
        $stateRoot `
        "native\arm64\dynwinrt.node"
}

function Resolve-WinAppExecutable {
    if ($WinAppPath) {
        return (Resolve-Path $WinAppPath -ErrorAction Stop).Path
    }
    $command = Get-Command winapp -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }
    $sibling = [IO.Path]::GetFullPath(
        (Join-Path $dashboardRoot "..\..\..\winappCli\src\winapp-npm\bin\win-x64\winapp.exe")
    )
    if (Test-Path $sibling) {
        return $sibling
    }
    throw "winapp CLI was not found. Pass -WinAppPath."
}

function Get-Sha256([string]$Path) {
    return (
        Get-FileHash -LiteralPath $Path -Algorithm SHA256
    ).Hash.ToLowerInvariant()
}

function Build-Architecture(
    [string]$TargetArchitecture,
    [string]$AddonPath
) {
    $arguments = @{
        Version = $Version
        Architecture = $TargetArchitecture
        Publisher = $Publisher
        OutputDirectory = $artifactRoot
        CertificatePassword = $CertificatePassword
        WinAppPath = $script:resolvedWinApp
    }
    if (Test-Path -LiteralPath $CertificatePath) {
        $arguments.CertificatePath = $CertificatePath
    }
    if ($AddonPath) {
        $arguments.DynWinRTAddonPath = $AddonPath
    }
    if ($RequireCleanSources) {
        $arguments.RequireCleanSources = $true
    }
    & $packageScript @arguments | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "SEA packaging failed for $TargetArchitecture."
    }
}

$resolvedWinApp = Resolve-WinAppExecutable
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
Build-Architecture "x64" $null
if (-not (Test-Path -LiteralPath $Arm64DynWinRTAddonPath)) {
    throw "ARM64 dynwinrt addon was not found at $Arm64DynWinRTAddonPath."
}
Build-Architecture "arm64" $Arm64DynWinRTAddonPath

if ($InstallCertificate) {
    & $resolvedWinApp "cert" "install" $CertificatePath
    if ($LASTEXITCODE -ne 0) {
        throw "Development certificate installation failed."
    }
}

$x64Package = Join-Path `
    $artifactRoot `
    "DynWinRTJSXDashboard_${Version}_x64_sea.msix"
$arm64Package = Join-Path `
    $artifactRoot `
    "DynWinRTJSXDashboard_${Version}_arm64_sea.msix"
$bundleWorkRoot = Join-Path $stateRoot "bundle\$Version"
$bundleInputRoot = Join-Path $bundleWorkRoot "input"
$bundleInspectRoot = Join-Path $bundleWorkRoot "inspect"
Remove-Item `
    -LiteralPath $bundleWorkRoot `
    -Recurse `
    -Force `
    -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $bundleInputRoot -Force |
    Out-Null
Copy-Item -LiteralPath $x64Package -Destination $bundleInputRoot
Copy-Item -LiteralPath $arm64Package -Destination $bundleInputRoot
$bundlePath = Join-Path `
    $artifactRoot `
    "DynWinRTJSXDashboard_${Version}_x64_arm64_sea.msixbundle"
Remove-Item -LiteralPath $bundlePath -Force -ErrorAction SilentlyContinue
& $resolvedWinApp `
    "tool" "makeappx" `
    "bundle" `
    "/d" $bundleInputRoot `
    "/p" $bundlePath `
    "/bv" $Version `
    "/o"
if ($LASTEXITCODE -ne 0) {
    throw "SEA MSIX bundle packaging failed."
}
& $resolvedWinApp `
    "sign" `
    $bundlePath `
    $CertificatePath `
    "--password" $CertificatePassword `
    "--quiet"
if ($LASTEXITCODE -ne 0) {
    throw "SEA MSIX bundle signing failed."
}
& $resolvedWinApp `
    "tool" "makeappx" `
    "unbundle" `
    "/p" $bundlePath `
    "/d" $bundleInspectRoot `
    "/o"
if ($LASTEXITCODE -ne 0) {
    throw "SEA MSIX bundle inspection failed."
}
$bundleManifestPath = Join-Path `
    $bundleInspectRoot `
    "AppxMetadata\AppxBundleManifest.xml"
if (-not (Test-Path -LiteralPath $bundleManifestPath)) {
    throw "The bundle manifest was not extracted."
}
[xml]$bundleManifest = Get-Content `
    -LiteralPath $bundleManifestPath `
    -Raw
$bundleIdentityVersion = [string](
    $bundleManifest.Bundle.Identity.Version
)
if ($bundleIdentityVersion -cne $Version) {
    throw "Bundle identity version $bundleIdentityVersion does not match $Version."
}
$bundleArchitectures = @(
    $bundleManifest.Bundle.Packages.Package |
        ForEach-Object {
            ([string]$_.Architecture).ToLowerInvariant()
        } |
        Sort-Object -Unique
)
if (
    $bundleArchitectures.Count -ne 2 -or
    $bundleArchitectures[0] -cne "arm64" -or
    $bundleArchitectures[1] -cne "x64"
) {
    throw "Bundle architectures are invalid: $($bundleArchitectures -join ', ')."
}
$x64Provenance = Join-Path `
    $artifactRoot `
    "DynWinRTJSXDashboard_${Version}_x64_sea.provenance.json"
$arm64Provenance = Join-Path `
    $artifactRoot `
    "DynWinRTJSXDashboard_${Version}_arm64_sea.provenance.json"
$provenancePath = Join-Path `
    $artifactRoot `
    "DynWinRTJSXDashboard_${Version}_x64_arm64_sea.provenance.json"
$provenance = [ordered]@{
    schemaVersion = 1
    generatedAt = [DateTime]::UtcNow.ToString("O")
    version = $Version
    publisher = $Publisher
    architectures = @("x64", "arm64")
    bundle = [ordered]@{
        file = [IO.Path]::GetFileName($bundlePath)
        identityVersion = $bundleIdentityVersion
        architectures = $bundleArchitectures
        size = (Get-Item -LiteralPath $bundlePath).Length
        sha256 = Get-Sha256 $bundlePath
    }
    packages = @(
        [ordered]@{
            architecture = "x64"
            file = [IO.Path]::GetFileName($x64Package)
            sha256 = Get-Sha256 $x64Package
            provenanceFile =
                [IO.Path]::GetFileName($x64Provenance)
            provenanceSha256 = Get-Sha256 $x64Provenance
        },
        [ordered]@{
            architecture = "arm64"
            file = [IO.Path]::GetFileName($arm64Package)
            sha256 = Get-Sha256 $arm64Package
            provenanceFile =
                [IO.Path]::GetFileName($arm64Provenance)
            provenanceSha256 = Get-Sha256 $arm64Provenance
        }
    )
    certificateProvided = $certificateProvided
}
$provenance |
    ConvertTo-Json -Depth 6 |
    Set-Content -LiteralPath $provenancePath -Encoding UTF8

Write-Output "SEA MSIX bundle: $bundlePath"
Write-Output "Provenance: $provenancePath"
