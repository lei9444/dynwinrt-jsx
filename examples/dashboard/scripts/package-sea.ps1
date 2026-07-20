#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [ValidatePattern("^\d+\.\d+\.\d+\.\d+$")]
    [string]$Version = "1.0.0.0",
    [string]$Publisher = "CN=DynWinRTJSXDev",
    [string]$OutputDirectory,
    [string]$CertificatePath,
    [string]$CertificatePassword = $env:DYNWINRT_JSX_CERT_PASSWORD,
    [string]$WinAppPath,
    [switch]$InstallCertificate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$nodeVersion = "24.18.0"
$nodeArchiveName = "node-v$nodeVersion-win-x64.zip"
$nodeArchiveSha256 = "0ae68406b42d7725661da979b1403ec9926da205c6770827f33aac9d8f26e821"
$nodeExeSha256 = "9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de"
$postjectVersion = "1.0.0-alpha.6"
$postjectApiSha256 = "88931f26b4d3e99e08dc8219a45f576986952fad4d0c78444d27048232b2881b"
$seaExecutableName = "DynWinRTJSXDashboard.exe"

$dashboardRoot = Split-Path $PSScriptRoot -Parent
$packagingRoot = Join-Path $dashboardRoot "packaging"
$stateRoot = Join-Path $dashboardRoot ".winapp\sea-package"
$cacheRoot = Join-Path $stateRoot "cache"
$workRoot = Join-Path $stateRoot "work\$Version"
$layoutRoot = Join-Path $stateRoot "layout\$Version"
$artifactRoot = if ($OutputDirectory) {
    [IO.Path]::GetFullPath($OutputDirectory)
}
else {
    Join-Path $stateRoot "artifacts"
}

if (-not $CertificatePassword) {
    $CertificatePassword = "password"
}

function Invoke-Checked(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$Description
) {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

function Resolve-WinAppExecutable {
    if ($WinAppPath) {
        $resolved = Resolve-Path $WinAppPath -ErrorAction Stop
        return $resolved.Path
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

    throw "winapp CLI was not found. Pass -WinAppPath or build the sibling winappCli repository."
}

function Get-Sha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    try {
        $sha256 = [Security.Cryptography.SHA256]::Create()
        try {
            return (
                [BitConverter]::ToString($sha256.ComputeHash($stream)).
                    Replace("-", "").
                    ToLowerInvariant()
            )
        }
        finally {
            $sha256.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

function Get-VerifiedDownload(
    [string]$Uri,
    [string]$Path,
    [string]$Sha256
) {
    if ((Test-Path $Path) -and (Get-Sha256 $Path) -eq $Sha256) {
        return
    }

    Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    $temporaryPath = "$Path.download"
    Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue

    try {
        Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $temporaryPath
    }
    catch {
        $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
        if (-not $curl) {
            throw
        }
        Invoke-Checked $curl.Source @(
            "--fail",
            "--location",
            "--output", $temporaryPath,
            $Uri
        ) "Download from $Uri"
    }

    $actual = Get-Sha256 $temporaryPath
    if ($actual -ne $Sha256) {
        Remove-Item -LiteralPath $temporaryPath -Force
        throw "SHA256 mismatch for $Uri. Expected $Sha256, received $actual."
    }

    Move-Item -LiteralPath $temporaryPath -Destination $Path
}

function Copy-Directory(
    [string]$Source,
    [string]$Destination
) {
    if (-not (Test-Path $Source)) {
        throw "Required directory was not found: $Source"
    }

    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    Get-ChildItem -LiteralPath $Source -Force |
        Copy-Item -Destination $Destination -Recurse -Force
}

function Copy-RuntimeFile(
    [string]$Source,
    [string]$Destination
) {
    if (-not (Test-Path $Source)) {
        throw "Required file was not found: $Source"
    }

    New-Item -ItemType Directory -Force -Path (Split-Path $Destination -Parent) |
        Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

if (-not ("DynWinRTJsxSeaPe" -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.IO;

public static class DynWinRTJsxSeaPe
{
    public static ushort GetMachine(string fileName)
    {
        using (FileStream stream = File.OpenRead(fileName))
        using (BinaryReader reader = new BinaryReader(stream))
        {
            stream.Position = 0x3c;
            int peOffset = reader.ReadInt32();
            stream.Position = peOffset;
            if (reader.ReadUInt32() != 0x00004550)
            {
                throw new InvalidDataException("The file is not a PE executable.");
            }
            return reader.ReadUInt16();
        }
    }

    public static void SetWindowsSubsystem(string executable)
    {
        byte[] bytes = File.ReadAllBytes(executable);
        int peOffset = BitConverter.ToInt32(bytes, 0x3c);
        if (BitConverter.ToUInt32(bytes, peOffset) != 0x00004550)
        {
            throw new InvalidDataException("The file is not a PE executable.");
        }
        int optionalHeader = peOffset + 24;
        ushort magic = BitConverter.ToUInt16(bytes, optionalHeader);
        if (magic != 0x10b && magic != 0x20b)
        {
            throw new InvalidDataException("Unsupported PE optional header.");
        }
        int subsystem = optionalHeader + 68;
        bytes[subsystem] = 2;
        bytes[subsystem + 1] = 0;

        File.WriteAllBytes(executable, bytes);
    }
}
"@
}

$winapp = Resolve-WinAppExecutable
$nodeArchive = Join-Path $cacheRoot $nodeArchiveName
$nodeDirectory = Join-Path $cacheRoot "node-v$nodeVersion-win-x64"
$nodeExecutable = Join-Path $nodeDirectory "node.exe"
$nodeLicense = Join-Path $nodeDirectory "LICENSE"
$postjectApi = Join-Path $cacheRoot "postject-$postjectVersion-api.js"

New-Item -ItemType Directory -Force -Path $cacheRoot, $artifactRoot | Out-Null
Get-VerifiedDownload `
    "https://nodejs.org/dist/v$nodeVersion/$nodeArchiveName" `
    $nodeArchive `
    $nodeArchiveSha256
Get-VerifiedDownload `
    "https://cdn.jsdelivr.net/npm/postject@$postjectVersion/dist/api.js" `
    $postjectApi `
    $postjectApiSha256

if (-not (Test-Path $nodeExecutable) -or
    (Get-Sha256 $nodeExecutable) -ne $nodeExeSha256) {
    Remove-Item -LiteralPath $nodeDirectory -Recurse -Force -ErrorAction SilentlyContinue
    Expand-Archive -LiteralPath $nodeArchive -DestinationPath $cacheRoot -Force
}

if ((Get-Sha256 $nodeExecutable) -ne $nodeExeSha256) {
    throw "The extracted Node.js executable failed SHA256 verification."
}

if ([DynWinRTJsxSeaPe]::GetMachine($nodeExecutable) -ne 0x8664) {
    throw "The pinned Node.js executable is not x64."
}

$bindingsRoot = Join-Path $dashboardRoot ".winapp\bindings"
$dashboardDist = Join-Path $dashboardRoot "dist"
$jsxPackageRoot = Join-Path $dashboardRoot "node_modules\dynwinrt-jsx"
$dynwinrtPackageRoot = Join-Path $dashboardRoot "node_modules\@microsoft\dynwinrt"
$dynwinrtAddon = Join-Path $dynwinrtPackageRoot "dynwinrt.node"

foreach ($required in @(
    (Join-Path $dashboardRoot "main.js"),
    $dashboardDist,
    $bindingsRoot,
    (Join-Path $jsxPackageRoot "dist"),
    $dynwinrtAddon
)) {
    if (-not (Test-Path $required)) {
        throw "Required build output was not found: $required"
    }
}

if ([DynWinRTJsxSeaPe]::GetMachine($dynwinrtAddon) -ne 0x8664) {
    throw "The installed dynwinrt.node is not x64."
}

Remove-Item -LiteralPath $workRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $layoutRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $workRoot, $layoutRoot | Out-Null

Copy-RuntimeFile `
    (Join-Path $dashboardRoot "main.js") `
    (Join-Path $layoutRoot "main.js")
Copy-RuntimeFile `
    (Join-Path $dashboardRoot "package.json") `
    (Join-Path $layoutRoot "package.json")
Copy-Directory $dashboardDist (Join-Path $layoutRoot "dist")
Copy-Directory $bindingsRoot (Join-Path $layoutRoot ".winapp\bindings")

$jsxDestination = Join-Path $layoutRoot "node_modules\dynwinrt-jsx"
Copy-RuntimeFile `
    (Join-Path $jsxPackageRoot "package.json") `
    (Join-Path $jsxDestination "package.json")
Copy-RuntimeFile `
    (Join-Path $jsxPackageRoot "LICENSE") `
    (Join-Path $jsxDestination "LICENSE")
Copy-Directory `
    (Join-Path $jsxPackageRoot "dist") `
    (Join-Path $jsxDestination "dist")

Copy-Directory `
    $dynwinrtPackageRoot `
    (Join-Path $layoutRoot "node_modules\@microsoft\dynwinrt")
Copy-RuntimeFile `
    $nodeLicense `
    (Join-Path $layoutRoot "licenses\node-LICENSE")

$manifestPath = Join-Path $layoutRoot "Package.appxmanifest"
Copy-RuntimeFile `
    (Join-Path $packagingRoot "Package.appxmanifest") `
    $manifestPath

[xml]$manifest = Get-Content -LiteralPath $manifestPath -Raw
$manifest.Package.Identity.SetAttribute("Version", $Version)
$manifest.Package.Identity.SetAttribute("Publisher", $Publisher)
$manifest.Save($manifestPath)

Invoke-Checked $winapp @(
    "manifest", "update-assets",
    (Join-Path $packagingRoot "dashboard-logo.svg"),
    "--manifest", $manifestPath,
    "--quiet"
) "Asset generation"

$blobPath = Join-Path $workRoot "sea-prep.blob"
$configPath = Join-Path $workRoot "sea-config.json"
$seaConfig = [ordered]@{
    main = (Join-Path $packagingRoot "sea-bootstrap.cjs")
    output = $blobPath
    disableExperimentalSEAWarning = $true
    useSnapshot = $false
    useCodeCache = $false
}
$seaConfig |
    ConvertTo-Json |
    Set-Content -LiteralPath $configPath -Encoding UTF8

Invoke-Checked $nodeExecutable @(
    "--experimental-sea-config",
    $configPath
) "SEA blob generation"

$seaExecutable = Join-Path $layoutRoot $seaExecutableName
Copy-Item -LiteralPath $nodeExecutable -Destination $seaExecutable -Force
Invoke-Checked $winapp @(
    "tool", "signtool",
    "remove", "/s", $seaExecutable
) "Node signature removal"
Invoke-Checked $nodeExecutable @(
    (Join-Path $packagingRoot "inject-sea.cjs"),
    $seaExecutable,
    $blobPath,
    $postjectApi
) "SEA blob injection"
[DynWinRTJsxSeaPe]::SetWindowsSubsystem($seaExecutable)

if (-not $CertificatePath) {
    $certificateRoot = Join-Path $stateRoot "certificate"
    New-Item -ItemType Directory -Force -Path $certificateRoot | Out-Null
    $CertificatePath = Join-Path $certificateRoot "DynWinRTJSXDashboard-dev.pfx"
    Invoke-Checked $winapp @(
        "cert", "generate",
        "--manifest", $manifestPath,
        "--output", $CertificatePath,
        "--password", $CertificatePassword,
        "--export-cer",
        "--if-exists", "Skip",
        "--quiet"
    ) "Development certificate generation"
}
else {
    $CertificatePath = (Resolve-Path $CertificatePath -ErrorAction Stop).Path
}

if ($InstallCertificate) {
    Invoke-Checked $winapp @(
        "cert", "install",
        $CertificatePath
    ) "Certificate installation"
}

Invoke-Checked $winapp @(
    "sign",
    $seaExecutable,
    $CertificatePath,
    "--password", $CertificatePassword,
    "--quiet"
) "SEA executable signing"

$msixPath = Join-Path $artifactRoot "DynWinRTJSXDashboard_${Version}_x64_sea.msix"
Remove-Item -LiteralPath $msixPath -Force -ErrorAction SilentlyContinue
Invoke-Checked $winapp @(
    "package",
    $layoutRoot,
    "--manifest", $manifestPath,
    "--executable", $seaExecutableName,
    "--output", $msixPath,
    "--cert", $CertificatePath,
    "--cert-password", $CertificatePassword,
    "--quiet"
) "MSIX packaging"

Write-Output "SEA MSIX: $msixPath"
Write-Output "Certificate: $CertificatePath"
Write-Output "Install: Add-AppxPackage `"$msixPath`""
