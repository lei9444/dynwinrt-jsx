#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [ValidatePattern("^\d+\.\d+\.\d+\.\d+$")]
    [string]$Version = "1.0.0.0",
    [ValidateSet("x64", "arm64")]
    [string]$Architecture = "x64",
    [string]$Publisher = "CN=DynWinRTJSXDev",
    [string]$OutputDirectory,
    [string]$CertificatePath,
    [string]$CertificatePassword = $env:DYNWINRT_JSX_CERT_PASSWORD,
    [string]$DynWinRTAddonPath,
    [string]$WinAppPath,
    [switch]$InstallCertificate,
    [switch]$RequireCleanSources
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$nodeVersion = "24.18.0"
$nodeArtifacts = @{
    x64 = [ordered]@{
        archiveSha256 = "0ae68406b42d7725661da979b1403ec9926da205c6770827f33aac9d8f26e821"
        executableSha256 = "9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de"
        machine = 0x8664
    }
    arm64 = [ordered]@{
        archiveSha256 = "f274669adb93b1fd0fbf8f21fd078609e9dcc84333d4f2718d2dde3f9a161a01"
        executableSha256 = "c7225670c3f477778e18c43a55867f7a0d76468221245e5981ab80eb953c8102"
        machine = 0xAA64
    }
}
$targetNodeArtifact = $nodeArtifacts[$Architecture]
$targetMachine = [uint16]$targetNodeArtifact.machine
$postjectVersion = "1.0.0-alpha.6"
$postjectApiSha256 = "88931f26b4d3e99e08dc8219a45f576986952fad4d0c78444d27048232b2881b"
$seaExecutableName = "DynWinRTJSXDashboard.exe"

$dashboardRoot = Split-Path $PSScriptRoot -Parent
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $dashboardRoot "..\.."))
$dynwinrtRoot = [IO.Path]::GetFullPath((Join-Path $dashboardRoot "..\..\..\dynwinrt"))
$winappRepositoryRoot = [IO.Path]::GetFullPath((Join-Path $dashboardRoot "..\..\..\winappCli"))
$packagingRoot = Join-Path $dashboardRoot "packaging"
$stateRoot = Join-Path $dashboardRoot ".winapp\sea-package"
$cacheRoot = Join-Path $stateRoot "cache"
$workRoot = Join-Path $stateRoot "work\$Architecture\$Version"
$layoutRoot = Join-Path $stateRoot "layout\$Architecture\$Version"
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

function Invoke-Captured(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$Description
) {
    $output = @(& $FilePath @Arguments)
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
    return $output
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

function Get-GitRepositoryInfo(
    [string]$Name,
    [string]$Path
) {
    if (-not (Test-Path $Path)) {
        throw "Required source repository was not found: $Path"
    }

    $commit = @(
        Invoke-Captured "git" @("-C", $Path, "rev-parse", "HEAD") "$Name commit"
    )[0].Trim()
    $status = @(
        Invoke-Captured "git" @(
            "-C", $Path,
            "status", "--porcelain", "--untracked-files=normal"
        ) "$Name status"
    )
    $remote = @(
        Invoke-Captured "git" @(
            "-C", $Path,
            "remote", "get-url", "origin"
        ) "$Name remote"
    )[0].Trim()
    if ($remote -match "^(https?://)[^/@]+@(.+)$") {
        $remote = "$($Matches[1])$($Matches[2])"
    }

    return [ordered]@{
        name = $Name
        remote = $remote
        commit = $commit
        clean = $status.Count -eq 0
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

function Get-NodeDistribution([string]$TargetArchitecture) {
    $artifact = $nodeArtifacts[$TargetArchitecture]
    $archiveName = "node-v$nodeVersion-win-$TargetArchitecture.zip"
    $archivePath = Join-Path $cacheRoot $archiveName
    $directory = Join-Path `
        $cacheRoot `
        "node-v$nodeVersion-win-$TargetArchitecture"
    $executable = Join-Path $directory "node.exe"
    $license = Join-Path $directory "LICENSE"

    Get-VerifiedDownload `
        "https://nodejs.org/dist/v$nodeVersion/$archiveName" `
        $archivePath `
        $artifact.archiveSha256
    if (
        -not (Test-Path $executable) -or
        (Get-Sha256 $executable) -ne $artifact.executableSha256
    ) {
        Remove-Item `
            -LiteralPath $directory `
            -Recurse `
            -Force `
            -ErrorAction SilentlyContinue
        Expand-Archive `
            -LiteralPath $archivePath `
            -DestinationPath $cacheRoot `
            -Force
    }
    if ((Get-Sha256 $executable) -ne $artifact.executableSha256) {
        throw "The extracted $TargetArchitecture Node.js executable failed SHA256 verification."
    }
    if (
        [DynWinRTJsxSeaPe]::GetMachine($executable) -ne
        [uint16]$artifact.machine
    ) {
        throw "The pinned Node.js executable is not $TargetArchitecture."
    }
    return [pscustomobject]@{
        Architecture = $TargetArchitecture
        ArchiveName = $archiveName
        ArchiveSha256 = $artifact.archiveSha256
        Executable = $executable
        ExecutableSha256 = $artifact.executableSha256
        License = $license
    }
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

function Copy-JavaScriptTree(
    [string]$Source,
    [string]$Destination
) {
    if (-not (Test-Path -LiteralPath $Source)) {
        throw "Required directory was not found: $Source"
    }
    $sourceRoot = (Resolve-Path -LiteralPath $Source).Path
    foreach (
        $file in Get-ChildItem `
            -LiteralPath $sourceRoot `
            -Filter "*.js" `
            -File `
            -Recurse
    ) {
        $relativePath = $file.FullName.Substring(
            $sourceRoot.Length
        ).TrimStart("\")
        $destinationPath = Join-Path `
            $Destination `
            $relativePath
        New-Item `
            -ItemType Directory `
            -Path (Split-Path $destinationPath -Parent) `
            -Force |
            Out-Null
        Copy-Item `
            -LiteralPath $file.FullName `
            -Destination $destinationPath `
            -Force
    }
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
$sourceRepositories = @(
    Get-GitRepositoryInfo "dynwinrt-jsx" $repositoryRoot
    Get-GitRepositoryInfo "dynwinrt" $dynwinrtRoot
    Get-GitRepositoryInfo "winappCli" $winappRepositoryRoot
)
if ($RequireCleanSources) {
    $dirtyRepositories = @(
        $sourceRepositories | Where-Object { -not $_.clean }
    )
    if ($dirtyRepositories.Count -gt 0) {
        throw "Release packaging requires clean source repositories: $(
            ($dirtyRepositories | ForEach-Object { $_.name }) -join ", "
        )."
    }
}

$postjectApi = Join-Path $cacheRoot "postject-$postjectVersion-api.js"

New-Item -ItemType Directory -Force -Path $cacheRoot, $artifactRoot | Out-Null
Get-VerifiedDownload `
    "https://cdn.jsdelivr.net/npm/postject@$postjectVersion/dist/api.js" `
    $postjectApi `
    $postjectApiSha256
$targetNode = Get-NodeDistribution $Architecture
$buildNode = if ($Architecture -eq "x64") {
    $targetNode
}
else {
    Get-NodeDistribution "x64"
}

$bindingsRoot = Join-Path $dashboardRoot ".winapp\bindings"
$dashboardDist = Join-Path $dashboardRoot "dist"
$jsxPackageRoot = Join-Path $dashboardRoot "node_modules\dynwinrt-jsx"
$dynwinrtPackageRoot = Join-Path $dashboardRoot "node_modules\@microsoft\dynwinrt"

foreach ($required in @(
    (Join-Path $dashboardRoot "main.js"),
    $dashboardDist,
    $bindingsRoot,
    (Join-Path $jsxPackageRoot "dist"),
    $dynwinrtPackageRoot
)) {
    if (-not (Test-Path $required)) {
        throw "Required build output was not found: $required"
    }
}

function Resolve-DynWinRTAddon {
    $candidates = @()
    if ($DynWinRTAddonPath) {
        $candidates += $DynWinRTAddonPath
    }
    if ($Architecture -eq "x64") {
        $candidates += Join-Path $dynwinrtPackageRoot "dynwinrt.node"
    }
    $targetTriple = if ($Architecture -eq "arm64") {
        "aarch64-pc-windows-msvc"
    }
    else {
        "x86_64-pc-windows-msvc"
    }
    $targetNativeName = if ($Architecture -eq "arm64") {
        "dynwinrt.win32-arm64-msvc.node"
    }
    else {
        "dynwinrt.win32-x64-msvc.node"
    }
    $candidates += @(
        (Join-Path $stateRoot "native\$Architecture\dynwinrt.node"),
        (Join-Path $dynwinrtRoot "bindings\js\dist\$targetNativeName"),
        (Join-Path $dynwinrtRoot "bindings\js\dist\dynwinrt.node"),
        (Join-Path $dynwinrtRoot "target\$targetTriple\release\jswinrt_rs.dll"),
        (Join-Path $dynwinrtPackageRoot "dynwinrt.node")
    )
    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (-not (Test-Path -LiteralPath $candidate)) {
            continue
        }
        $resolved = (Resolve-Path -LiteralPath $candidate).Path
        if ([DynWinRTJsxSeaPe]::GetMachine($resolved) -eq $targetMachine) {
            return $resolved
        }
    }
    throw "An $Architecture dynwinrt.node was not found. Pass -DynWinRTAddonPath after building target $targetTriple."
}
$dynwinrtAddon = Resolve-DynWinRTAddon

Remove-Item -LiteralPath $workRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $layoutRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $workRoot, $layoutRoot | Out-Null
$prunedBindingsRoot = Join-Path $workRoot "bindings"
$bindingPruneReportPath = Join-Path $workRoot "binding-prune.json"
Invoke-Checked $buildNode.Executable @(
    (Join-Path $PSScriptRoot "prune-winrt-bindings.js"),
    $bindingsRoot,
    $prunedBindingsRoot,
    (Join-Path $dashboardRoot "src"),
    $bindingPruneReportPath
) "Generated binding pruning"

Copy-RuntimeFile `
    (Join-Path $dashboardRoot "main.js") `
    (Join-Path $layoutRoot "main.js")
Copy-RuntimeFile `
    (Join-Path $dashboardRoot "package.json") `
    (Join-Path $layoutRoot "package.json")
Copy-Directory $dashboardDist (Join-Path $layoutRoot "dist")
Copy-Directory `
    $prunedBindingsRoot `
    (Join-Path $layoutRoot ".winapp\bindings")

$jsxDestination = Join-Path $layoutRoot "node_modules\dynwinrt-jsx"
Copy-RuntimeFile `
    (Join-Path $jsxPackageRoot "package.json") `
    (Join-Path $jsxDestination "package.json")
Copy-RuntimeFile `
    (Join-Path $jsxPackageRoot "LICENSE") `
    (Join-Path $jsxDestination "LICENSE")
Copy-JavaScriptTree `
    (Join-Path $jsxPackageRoot "dist") `
    (Join-Path $jsxDestination "dist")

$dynwinrtDestination = Join-Path `
    $layoutRoot `
    "node_modules\@microsoft\dynwinrt"
Copy-RuntimeFile `
    (Join-Path $dynwinrtPackageRoot "package.json") `
    (Join-Path $dynwinrtDestination "package.json")
Copy-JavaScriptTree `
    $dynwinrtPackageRoot `
    $dynwinrtDestination
if (Test-Path -LiteralPath (Join-Path $dynwinrtPackageRoot "LICENSE")) {
    Copy-RuntimeFile `
        (Join-Path $dynwinrtPackageRoot "LICENSE") `
        (Join-Path $dynwinrtDestination "LICENSE")
}
Copy-RuntimeFile `
    $dynwinrtAddon `
    (Join-Path $dynwinrtDestination "dynwinrt.node")
Copy-RuntimeFile `
    $targetNode.License `
    (Join-Path $layoutRoot "licenses\node-LICENSE")

$manifestPath = Join-Path $layoutRoot "Package.appxmanifest"
Copy-RuntimeFile `
    (Join-Path $packagingRoot "Package.appxmanifest") `
    $manifestPath

[xml]$manifest = Get-Content -LiteralPath $manifestPath -Raw
$manifest.Package.Identity.SetAttribute("Version", $Version)
$manifest.Package.Identity.SetAttribute("Publisher", $Publisher)
$manifest.Package.Identity.SetAttribute(
    "ProcessorArchitecture",
    $Architecture
)
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

Invoke-Checked $buildNode.Executable @(
    "--experimental-sea-config",
    $configPath
) "SEA blob generation"

$seaExecutable = Join-Path $layoutRoot $seaExecutableName
Copy-Item `
    -LiteralPath $targetNode.Executable `
    -Destination $seaExecutable `
    -Force
Invoke-Checked $winapp @(
    "tool", "signtool",
    "remove", "/s", $seaExecutable
) "Node signature removal"
Invoke-Checked $buildNode.Executable @(
    (Join-Path $packagingRoot "inject-sea.cjs"),
    $seaExecutable,
    $blobPath,
    $postjectApi
) "SEA blob injection"
[DynWinRTJsxSeaPe]::SetWindowsSubsystem($seaExecutable)
if ([DynWinRTJsxSeaPe]::GetMachine($seaExecutable) -ne $targetMachine) {
    throw "The generated SEA executable is not $Architecture."
}

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

$msixPath = Join-Path `
    $artifactRoot `
    "DynWinRTJSXDashboard_${Version}_${Architecture}_sea.msix"
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

$dashboardPackage = Get-Content `
    -LiteralPath (Join-Path $dashboardRoot "package.json") `
    -Raw |
    ConvertFrom-Json
$jsxPackage = Get-Content `
    -LiteralPath (Join-Path $jsxPackageRoot "package.json") `
    -Raw |
    ConvertFrom-Json
$dynwinrtPackage = Get-Content `
    -LiteralPath (Join-Path $dynwinrtPackageRoot "package.json") `
    -Raw |
    ConvertFrom-Json
$typescriptPackage = Get-Content `
    -LiteralPath (Join-Path $dashboardRoot "node_modules\typescript\package.json") `
    -Raw |
    ConvertFrom-Json
$winappPackage = Get-Content `
    -LiteralPath (Join-Path $winappRepositoryRoot "src\winapp-npm\package.json") `
    -Raw |
    ConvertFrom-Json
$winappVersion = (
    Invoke-Captured $winapp @("--version") "winapp version"
) -join "`n"
$signingCertificate = New-Object `
    -TypeName Security.Cryptography.X509Certificates.X509Certificate2 `
    -ArgumentList @(
        $CertificatePath,
        $CertificatePassword,
        [Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet
    )
try {
    $signature = [ordered]@{
        subject = $signingCertificate.Subject
        thumbprint = $signingCertificate.Thumbprint
        notBefore = $signingCertificate.NotBefore.ToUniversalTime().ToString("O")
        notAfter = $signingCertificate.NotAfter.ToUniversalTime().ToString("O")
    }
}
finally {
    $signingCertificate.Reset()
}

$manifestDependencies = @(
    $manifest.Package.Dependencies.PackageDependency |
        ForEach-Object {
            [ordered]@{
                name = $_.Name
                publisher = $_.Publisher
                minVersion = $_.MinVersion
            }
        }
)
$bindingPrune = Get-Content `
    -LiteralPath $bindingPruneReportPath `
    -Raw |
    ConvertFrom-Json
$applicationJavaScriptFiles = @(
    Get-ChildItem `
        -LiteralPath $dashboardDist `
        -Filter "*.js" `
        -File `
        -Recurse
)
$applicationJavaScriptBytes = (
    $applicationJavaScriptFiles |
        Measure-Object -Property Length -Sum
).Sum
$provenancePath = Join-Path `
    $artifactRoot `
    "DynWinRTJSXDashboard_${Version}_${Architecture}_sea.provenance.json"
$provenance = [ordered]@{
    schemaVersion = 1
    generatedAt = [DateTime]::UtcNow.ToString("O")
    package = [ordered]@{
        name = $manifest.Package.Identity.Name
        version = $Version
        publisher = $Publisher
        architecture = $Architecture
        file = [IO.Path]::GetFileName($msixPath)
        size = (Get-Item -LiteralPath $msixPath).Length
        sha256 = Get-Sha256 $msixPath
    }
    executable = [ordered]@{
        file = $seaExecutableName
        size = (Get-Item -LiteralPath $seaExecutable).Length
        sha256 = Get-Sha256 $seaExecutable
        signature = $signature
    }
    inputs = [ordered]@{
        node = [ordered]@{
            version = $nodeVersion
            targetArchitecture = $Architecture
            archive = $targetNode.ArchiveName
            archiveSha256 = $targetNode.ArchiveSha256
            executableSha256 = $targetNode.ExecutableSha256
            buildHostArchitecture = $buildNode.Architecture
            buildHostExecutableSha256 = $buildNode.ExecutableSha256
        }
        postject = [ordered]@{
            version = $postjectVersion
            apiSha256 = $postjectApiSha256
        }
        packages = [ordered]@{
            dashboard = $dashboardPackage.version
            dynwinrtJsx = $jsxPackage.version
            dynwinrt = $dynwinrtPackage.version
            typescript = $typescriptPackage.version
            winappCliPackage = $winappPackage.version
            winappCliExecutable = $winappVersion.Trim()
        }
        dynwinrtAddonSha256 = Get-Sha256 $dynwinrtAddon
        bindingsIndexSha256 = Get-Sha256 (
            Join-Path $prunedBindingsRoot "index.js"
        )
        generatedBindings = [ordered]@{
            sourceFiles = $bindingPrune.source.files
            sourceBytes = $bindingPrune.source.bytes
            runtimeFiles = $bindingPrune.runtime.files
            runtimeBytes = $bindingPrune.runtime.bytes
            savedFiles = $bindingPrune.saved.files
            savedBytes = $bindingPrune.saved.bytes
            savedPercent = $bindingPrune.saved.percent
            selectedExports = $bindingPrune.selectedExports
        }
        applicationJavaScript = [ordered]@{
            files = $applicationJavaScriptFiles.Count
            bytes = $applicationJavaScriptBytes
            bundled = $false
            reason = "The application and Worker output is already a small hot-reloadable CommonJS graph; generated bindings and the Node executable dominate package size."
        }
        runtimePackageFiltering = [ordered]@{
            declarationsIncluded = $false
            sourceMapsIncluded = $false
        }
        packageLockSha256 = Get-Sha256 (Join-Path $dashboardRoot "package-lock.json")
    }
    manifest = [ordered]@{
        sha256 = Get-Sha256 $manifestPath
        dependencies = $manifestDependencies
    }
    sourceRepositories = $sourceRepositories
    allSourcesClean = @(
        $sourceRepositories | Where-Object { -not $_.clean }
    ).Count -eq 0
}
$provenance |
    ConvertTo-Json -Depth 10 |
    Set-Content -LiteralPath $provenancePath -Encoding UTF8

Write-Output "SEA MSIX: $msixPath"
Write-Output "Provenance: $provenancePath"
Write-Output "Certificate: $CertificatePath"
Write-Output "Install: Add-AppxPackage `"$msixPath`""
