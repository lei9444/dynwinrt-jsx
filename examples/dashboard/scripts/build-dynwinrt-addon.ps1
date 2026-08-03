#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [ValidateSet("x64", "arm64")]
    [string]$Architecture = "arm64",
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$dashboardRoot = Split-Path $PSScriptRoot -Parent
$dynwinrtRoot = [IO.Path]::GetFullPath(
    (Join-Path $dashboardRoot "..\..\..\dynwinrt")
)
$bindingsRoot = Join-Path $dynwinrtRoot "bindings\js"
$napi = Join-Path $bindingsRoot "node_modules\.bin\napi.cmd"
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) {
    $nodePath = Join-Path $env:ProgramFiles "nodejs\node.exe"
    if (Test-Path -LiteralPath $nodePath) {
        $env:Path = "$(Split-Path $nodePath -Parent);$env:Path"
        $node = Get-Command node.exe -ErrorAction SilentlyContinue
    }
}
$target = if ($Architecture -eq "arm64") {
    "aarch64-pc-windows-msvc"
}
else {
    "x86_64-pc-windows-msvc"
}
$machine = if ($Architecture -eq "arm64") {
    0xAA64
}
else {
    0x8664
}
if (-not $OutputPath) {
    $OutputPath = Join-Path `
        $dashboardRoot `
        ".winapp\sea-package\native\$Architecture\dynwinrt.node"
}
$OutputPath = [IO.Path]::GetFullPath($OutputPath)

foreach ($required in @(
    (Join-Path $dynwinrtRoot "Cargo.toml"),
    (Join-Path $bindingsRoot "Cargo.toml"),
    $napi
)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Required dynwinrt build input was not found: $required"
    }
    if (-not $node) {
        throw "Node.js was not found. Install the pinned development Node version."
    }
}

Push-Location $bindingsRoot
try {
    & $napi `
        build `
        --no-const-enum `
        --platform `
        --release `
        --target $target `
        -o dist
    if ($LASTEXITCODE -ne 0) {
        throw "dynwinrt $Architecture build failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

$candidates = @(
    (Join-Path $bindingsRoot "dist\dynwinrt.node"),
    (Join-Path $bindingsRoot "dist\dynwinrt.win32-$Architecture-msvc.node"),
    (Join-Path $dynwinrtRoot "target\$target\release\jswinrt_rs.dll")
)

function Get-PeMachine([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    try {
        $reader = [IO.BinaryReader]::new($stream)
        try {
            $stream.Position = 0x3c
            $peOffset = $reader.ReadInt32()
            $stream.Position = $peOffset
            if ($reader.ReadUInt32() -ne 0x00004550) {
                throw "$Path is not a PE executable."
            }
            return $reader.ReadUInt16()
        }
        finally {
            $reader.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

$builtAddon = $null
foreach ($candidate in $candidates) {
    if (
        (Test-Path -LiteralPath $candidate) -and
        (Get-PeMachine $candidate) -eq $machine
    ) {
        $builtAddon = (Resolve-Path -LiteralPath $candidate).Path
        break
    }
}
if (-not $builtAddon) {
    throw "The dynwinrt build did not produce an $Architecture native addon."
}

New-Item `
    -ItemType Directory `
    -Path (Split-Path $OutputPath -Parent) `
    -Force |
    Out-Null
Copy-Item -LiteralPath $builtAddon -Destination $OutputPath -Force
if ((Get-PeMachine $OutputPath) -ne $machine) {
    throw "The staged dynwinrt addon is not $Architecture."
}

Write-Output $OutputPath
