#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$WorkRoot,
    [string]$NodePath,
    [string]$TypeScriptPath,
    [string]$DotNetPath,
    [switch]$SkipRestore,
    [switch]$NoLaunch,
    [switch]$Wait
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
if (-not $WorkRoot) {
    $WorkRoot = Split-Path $repoRoot -Parent
}
$WorkRoot = [IO.Path]::GetFullPath($WorkRoot)

$dynwinrtRoot = Join-Path $WorkRoot "dynwinrt"
$winappCliRoot = Join-Path $WorkRoot "winappCli"
$dashboardRoot = Join-Path $repoRoot "examples\dashboard"
$winappNpmRoot = Join-Path $winappCliRoot "src\winapp-npm"
$localPackagesRoot = Join-Path $dashboardRoot "node_modules"
$pidPath = Join-Path $dashboardRoot ".winapp\dashboard.pid"

function Write-Step([string]$Message) {
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Path([string]$Path, [string]$Label) {
    if (-not (Test-Path $Path)) {
        throw "$Label was not found at $Path."
    }
}

function Read-SharedText([string]$Path) {
    if (-not (Test-Path $Path)) {
        return ""
    }

    $stream = [IO.FileStream]::new(
        $Path,
        [IO.FileMode]::Open,
        [IO.FileAccess]::Read,
        [IO.FileShare]::ReadWrite
    )
    try {
        $reader = [IO.StreamReader]::new($stream)
        try {
            return $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

function Invoke-Checked(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory
) {
    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$FilePath exited with code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

function Resolve-Node([string]$RequestedPath) {
    $candidates = @()
    if ($RequestedPath) {
        $candidates += $RequestedPath
    }
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($command) {
        $candidates += $command.Source
    }
    $candidates += Join-Path $env:ProgramFiles "Microsoft Visual Studio\2022\Enterprise\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe"

    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (-not (Test-Path $candidate)) {
            continue
        }
        $metadata = (
            & $candidate -p "process.arch + '|' + process.versions.node.split('.')[0]"
        ).Trim().Split("|")
        if (
            $LASTEXITCODE -eq 0 -and
            $metadata.Count -eq 2 -and
            $metadata[0] -eq "x64" -and
            [int]$metadata[1] -ge 20
        ) {
            return [IO.Path]::GetFullPath($candidate)
        }
    }

    throw "An x64 Node.js 20+ executable is required. Pass -NodePath with a local node.exe."
}

function Resolve-TypeScript([string]$RequestedPath) {
    $candidates = @()
    if ($RequestedPath) {
        $candidates += $RequestedPath
    }
    $candidates += Join-Path $repoRoot "node_modules\typescript\bin\tsc"

    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (Test-Path $candidate) {
            return [IO.Path]::GetFullPath($candidate)
        }
    }

    throw "A local TypeScript compiler is required. Pass -TypeScriptPath with TypeScript's bin\tsc file."
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
        (Join-Path $HOME ".dotnet\dotnet.exe"),
        "C:\.tools\dotnet\dotnet.exe",
        (Join-Path $env:ProgramFiles "dotnet\dotnet.exe")
    )

    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (-not (Test-Path $candidate)) {
            continue
        }
        $sdks = & $candidate --list-sdks
        if ($LASTEXITCODE -eq 0 -and $sdks -match "(?m)^10\.0\.") {
            return [IO.Path]::GetFullPath($candidate)
        }
    }

    throw ".NET SDK 10.x is required to build winappCli. Pass -DotNetPath with a local dotnet.exe."
}

function Write-LocalRuntimePackage(
    [string]$PackageDirectory,
    [string]$NativeModule
) {
    Remove-Item $PackageDirectory -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $PackageDirectory | Out-Null
    Copy-Item $NativeModule (Join-Path $PackageDirectory "dynwinrt.node") -Force

    $manifest = @{
        name = "@microsoft/dynwinrt"
        version = "0.1.0-local"
        private = $true
        main = "index.js"
        types = "index.d.ts"
    } | ConvertTo-Json
    [IO.File]::WriteAllText(
        (Join-Path $PackageDirectory "package.json"),
        "$manifest`n"
    )
    [IO.File]::WriteAllText(
        (Join-Path $PackageDirectory "index.js"),
        "'use strict'`n`nmodule.exports = require('./dynwinrt.node')`n"
    )
    [IO.File]::WriteAllText(
        (Join-Path $PackageDirectory "index.d.ts"),
        @"
export type DynWinRtStruct = unknown
export type DynWinRtType = unknown
export type DynWinRtValue = unknown
export type WinGuid = unknown

export function initWinappsdk(major: number, minor: number): void
export function roInitialize(apartmentType?: number): void
"@
    )
}

function Write-LocalCodegenPackage(
    [string]$PackageDirectory,
    [string]$CodegenExecutable
) {
    Remove-Item $PackageDirectory -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $PackageDirectory | Out-Null

    $manifest = @{
        name = "@microsoft/dynwinrt-codegen"
        version = "0.1.0"
        private = $true
        bin = @{
            "dynwinrt-codegen" = "./cli.js"
        }
    } | ConvertTo-Json -Depth 3
    [IO.File]::WriteAllText(
        (Join-Path $PackageDirectory "package.json"),
        "$manifest`n"
    )

    $executableLiteral = $CodegenExecutable | ConvertTo-Json -Compress
    [IO.File]::WriteAllText(
        (Join-Path $PackageDirectory "cli.js"),
        @"
#!/usr/bin/env node
'use strict'

const { spawnSync } = require('node:child_process')

const executable = $executableLiteral
const args = process.argv.slice(2)

if (args[0] === 'runtime-dependency') {
  console.log('@microsoft/dynwinrt@0.1.0')
  process.exit(0)
}

if (args[0] === 'capabilities') {
  const result = spawnSync(executable, ['capabilities'], { encoding: 'utf8' })
  if (result.status !== 0) {
    process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }
  const capabilities = new Set(
    result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
  )
  capabilities.add('runtime-dependency')
  console.log([...capabilities].join('\n'))
  process.exit(0)
}

const forwarded = args.filter(
  (arg) =>
    arg !== '--source-map' &&
    arg !== '--declaration' &&
    arg !== '--no-declaration',
)
const result = spawnSync(executable, forwarded, { stdio: 'inherit' })
process.exit(result.status ?? 1)
"@
    )
}

function Set-DirectoryJunction([string]$Path, [string]$Target) {
    Remove-Item $Path -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Junction -Path $Path -Target $Target | Out-Null
}

function Wait-ForReplaceableDirectory([string]$Path) {
    if (-not (Test-Path $Path)) {
        return
    }

    $parent = Split-Path $Path -Parent
    $leaf = Split-Path $Path -Leaf
    for ($attempt = 1; $attempt -le 5; $attempt += 1) {
        $probeLeaf = "$leaf.rename-probe.$([guid]::NewGuid().ToString('N'))"
        $probe = Join-Path $parent $probeLeaf
        try {
            Rename-Item $Path $probeLeaf
            Rename-Item $probe $leaf
            return
        }
        catch {
            if ((Test-Path $probe) -and -not (Test-Path $Path)) {
                Rename-Item $probe $leaf -ErrorAction SilentlyContinue
            }
            if ($attempt -eq 5) {
                throw "Generated bindings are locked at $Path. Close the dashboard and retry."
            }
            Start-Sleep -Milliseconds 500
        }
    }
}

Require-Path $dynwinrtRoot "dynwinrt repository"
Require-Path $winappCliRoot "winappCli repository"
Require-Path $dashboardRoot "dashboard example"

if ([Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne "X64") {
    throw "The local dashboard workflow currently supports Windows x64 only."
}

if (Test-Path $pidPath) {
    $existingPid = [int]([IO.File]::ReadAllText($pidPath).Trim())
    if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
        throw "The dashboard is already running with PID $existingPid. Close it before rebuilding generated bindings."
    }
    Remove-Item $pidPath -Force
}

$NodePath = Resolve-Node $NodePath
$TypeScriptPath = Resolve-TypeScript $TypeScriptPath
$DotNetPath = Resolve-DotNet10 $DotNetPath
$nodeDirectory = Split-Path $NodePath -Parent
$env:PATH = "$nodeDirectory;$env:PATH"
$env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"
$env:WINAPP_CLI_TELEMETRY_OPTOUT = "1"

Write-Step "Building dynwinrt runtime and code generator"
$cargoTargetRoot = Join-Path $dynwinrtRoot "target\dynwinrt-jsx-local"
Invoke-Checked "cargo.exe" @(
    "build",
    "--release",
    "--target", "x86_64-pc-windows-msvc",
    "--target-dir", $cargoTargetRoot,
    "-p", "jswinrt_rs",
    "-p", "dynwinrt-codegen"
) $dynwinrtRoot

$cargoOutput = Join-Path $cargoTargetRoot "x86_64-pc-windows-msvc\release"
$runtimeModule = Join-Path $cargoOutput "jswinrt_rs.dll"
$codegenExecutable = Join-Path $cargoOutput "dynwinrt-codegen.exe"
Require-Path $runtimeModule "dynwinrt native module"
Require-Path $codegenExecutable "dynwinrt code generator"

Write-Step "Building dynwinrt-jsx"
Invoke-Checked $NodePath @(
    $TypeScriptPath,
    "-p", (Join-Path $repoRoot "tsconfig.json")
) $repoRoot

Write-Step "Building winappCli Node wrapper"
Invoke-Checked $NodePath @(
    $TypeScriptPath,
    "-p", (Join-Path $winappNpmRoot "tsconfig.json"),
    "--noCheck"
) $winappNpmRoot

Write-Step "Publishing winappCli for x64"
$installerDirectory = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer"
if (Test-Path $installerDirectory) {
    $env:PATH = "$installerDirectory;$env:PATH"
}
$winappOutput = Join-Path $winappNpmRoot "bin\win-x64"
Invoke-Checked $DotNetPath @(
    "publish",
    (Join-Path $winappCliRoot "src\winapp-CLI\WinApp.Cli\WinApp.Cli.csproj"),
    "-c", "Release",
    "-r", "win-x64",
    "--self-contained",
    "-o", $winappOutput
) $winappCliRoot

$winappExecutable = Join-Path $winappOutput "winapp.exe"
$winappWrapper = Join-Path $winappNpmRoot "dist\cli.js"
Require-Path $winappExecutable "winappCli native executable"
Require-Path $winappWrapper "winappCli Node wrapper"

Write-Step "Preparing local dashboard packages"
$microsoftScope = Join-Path $localPackagesRoot "@microsoft"
New-Item -ItemType Directory -Force -Path $microsoftScope | Out-Null
Write-LocalRuntimePackage `
    (Join-Path $microsoftScope "dynwinrt") `
    $runtimeModule
Write-LocalCodegenPackage `
    (Join-Path $microsoftScope "dynwinrt-codegen") `
    $codegenExecutable
Set-DirectoryJunction `
    (Join-Path $localPackagesRoot "dynwinrt-jsx") `
    $repoRoot

if (-not $SkipRestore) {
    Write-Step "Restoring pinned SDKs and generating WinRT bindings"
    Wait-ForReplaceableDirectory `
        (Join-Path $dashboardRoot ".winapp\bindings")
    Invoke-Checked $NodePath @(
        $winappWrapper,
        "restore"
    ) $dashboardRoot
}
else {
    Require-Path `
        (Join-Path $dashboardRoot ".winapp\bindings\index.js") `
        "generated dashboard bindings"
}

Write-Step "Compiling the dashboard"
Invoke-Checked $NodePath @(
    $TypeScriptPath,
    "-p", (Join-Path $dashboardRoot "tsconfig.json")
) $dashboardRoot

if ($NoLaunch) {
    Write-Host "Dashboard preparation completed." -ForegroundColor Green
    return
}

Write-Step "Launching the native dashboard"
$stdoutPath = Join-Path $dashboardRoot ".winapp\dashboard.stdout.log"
$stderrPath = Join-Path $dashboardRoot ".winapp\dashboard.stderr.log"
Remove-Item $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
$process = Start-Process `
    -FilePath $NodePath `
    -ArgumentList ".\main.js" `
    -WorkingDirectory $dashboardRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru
[IO.File]::WriteAllText($pidPath, "$($process.Id)`n")

$deadline = [DateTime]::UtcNow.AddSeconds(30)
while ([DateTime]::UtcNow -lt $deadline) {
    if ($process.HasExited) {
        $stderr = Read-SharedText $stderrPath
        throw "Dashboard exited before becoming ready. $stderr"
    }
    if (
        (Test-Path $stdoutPath) -and
        ((Read-SharedText $stdoutPath) -match "dashboard is ready")
    ) {
        Write-Host "Dashboard is ready (PID $($process.Id))." -ForegroundColor Green
        if ($Wait) {
            Wait-Process -Id $process.Id
            $process.Refresh()
            if ($process.ExitCode -ne 0) {
                $stderr = Read-SharedText $stderrPath
                throw "Dashboard exited with code $($process.ExitCode). $stderr"
            }
        }
        return
    }
    Start-Sleep -Milliseconds 250
    $process.Refresh()
}

throw "Dashboard did not report readiness within 30 seconds. See $stderrPath."
