#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$WorkRoot,
    [string]$NodePath,
    [string]$DotNetPath,
    [string]$OutputDirectory,
    [string]$TargetRoot,
    [string]$ReleaseSetDirectory,
    [ValidateSet("dashboard", "minimal")]
    [string]$Template = "dashboard",
    [int]$TimeoutMilliseconds = 30000,
    [switch]$SkipReleaseBuild,
    [switch]$AllowDirtySources
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
if (-not $WorkRoot) {
    $WorkRoot = Split-Path $repoRoot -Parent
}
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path `
        $repoRoot `
        ".winapp\release-app-smoke"
}
if (-not $TargetRoot) {
    $TargetRoot = Join-Path `
        $env:TEMP `
        "dynwinrt-jsx-release-apps"
}
$packScript = Join-Path $PSScriptRoot "pack-release-set.ps1"

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

function Invoke-Checked(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory
) {
    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$FilePath $($Arguments -join ' ') exited with $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

function Read-SharedText([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
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

function Wait-ForWindow(
    [int]$ProcessId,
    [string]$WinAppPath
) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds(
        $TimeoutMilliseconds
    )
    while ([DateTime]::UtcNow -lt $deadline) {
        $windows = @(
            & $WinAppPath `
                ui list-windows `
                -a "dynwinrt-jsx" `
                --json |
            ConvertFrom-Json
        )
        $window = $windows |
            Where-Object { $_.processId -eq $ProcessId } |
            Select-Object -First 1
        if ($window) {
            return $window
        }
        Start-Sleep -Milliseconds 100
    }
    throw "Release-set app window did not appear."
}

function Invoke-WinApp(
    [string]$WinAppPath,
    [string[]]$Arguments
) {
    & $WinAppPath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "winapp $($Arguments -join ' ') exited with $LASTEXITCODE."
    }
}

function Get-Package(
    $ReleaseSet,
    [string]$Name
) {
    $package = @($ReleaseSet.packages) |
        Where-Object { $_.name -eq $Name } |
        Select-Object -First 1
    if (-not $package) {
        throw "Release set does not contain $Name."
    }
    return $package
}

function Assert-ReleaseArtifacts(
    $ReleaseSet,
    [string]$Directory
) {
    foreach ($package in @($ReleaseSet.packages)) {
        $path = Join-Path $Directory $package.file
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Release artifact was not found: $path"
        }
        $item = Get-Item -LiteralPath $path
        if ([long]$package.bytes -ne $item.Length) {
            throw "Release artifact size changed: $($package.file)"
        }
        $hash = (
            Get-FileHash -LiteralPath $path -Algorithm SHA256
        ).Hash.ToLowerInvariant()
        if ($hash -cne [string]$package.sha256) {
            throw "Release artifact hash changed: $($package.file)"
        }
    }
}

function Assert-ExactProjectManifest(
    $Project,
    $ReleaseSet
) {
    foreach ($entry in $ReleaseSet.template.dependencies.PSObject.Properties) {
        $actual = if ($entry.Name -in @(
            "@microsoft/dynwinrt",
            "dynwinrt-jsx"
        )) {
            $Project.dependencies.PSObject.Properties[$entry.Name].Value
        }
        else {
            $Project.devDependencies.PSObject.Properties[$entry.Name].Value
        }
        if ($actual -cne $entry.Value) {
            throw (
                "Generated app declares {0}@{1}; expected {2}." -f
                $entry.Name,
                $actual,
                $entry.Value
            )
        }
        if ($actual -match "^(file:|https?:)|[~^*]") {
            throw "Generated app dependency is not exact: $($entry.Name)@$actual"
        }
    }
}

$NodePath = Resolve-Node $NodePath
$DotNetPath = Resolve-DotNet10 $DotNetPath
$npmPath = Join-Path (Split-Path $NodePath -Parent) "npm.cmd"
$oldPath = $env:PATH
$env:PATH = "$(Split-Path $NodePath -Parent);$env:PATH"

$stamp = (
    "{0}-{1}" -f
    [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss-fff"),
    [guid]::NewGuid().ToString("N").Substring(0, 8)
)
$runDirectory = Join-Path $OutputDirectory "run-$stamp"
New-Item `
    -ItemType Directory `
    -Path $runDirectory `
    -Force |
    Out-Null
if (-not $ReleaseSetDirectory) {
    $ReleaseSetDirectory = Join-Path $runDirectory "release-set"
}
$manifestPath = Join-Path $runDirectory "compatibility.json"
$stdoutPath = Join-Path $runDirectory "app.stdout.log"
$stderrPath = Join-Path $runDirectory "app.stderr.log"
$npmCache = Join-Path $runDirectory "npm-cache"
$creatorRoot = Join-Path $runDirectory "creator"

$result = [ordered]@{
    protocol = "dynwinrt-jsx.release-app-smoke"
    version = 1
    startedAt = [DateTime]::UtcNow.ToString("o")
    status = "running"
    template = $Template
    releaseSet = $null
    target = $null
    projectManifest = $null
    installed = $null
    diagnostics = $null
    artifacts = [ordered]@{
        stdout = $stdoutPath
        stderr = $stderrPath
    }
}

$process = $null
$windowHandle = 0
try {
    if (-not (Test-Path -LiteralPath $ReleaseSetDirectory)) {
        $packArgs = @{
            WorkRoot = $WorkRoot
            NodePath = $NodePath
            DotNetPath = $DotNetPath
            OutputDirectory = $ReleaseSetDirectory
        }
        if ($SkipReleaseBuild) {
            $packArgs.SkipBuild = $true
        }
        if ($AllowDirtySources) {
            $packArgs.AllowDirtySources = $true
        }
        & $packScript @packArgs
    }
    $releaseSetPath = Join-Path `
        $ReleaseSetDirectory `
        "release-set.json"
    if (-not (Test-Path -LiteralPath $releaseSetPath)) {
        throw "Release-set manifest was not found: $releaseSetPath"
    }
    $releaseSet = Get-Content `
        -LiteralPath $releaseSetPath `
        -Raw |
        ConvertFrom-Json
    if (
        $releaseSet.protocol -cne
        "dynwinrt-jsx.release-set"
    ) {
        throw "Unexpected release-set protocol."
    }
    $result.releaseSet = $releaseSet
    Assert-ReleaseArtifacts $releaseSet $ReleaseSetDirectory

    New-Item -ItemType Directory -Path $creatorRoot -Force |
        Out-Null
    Invoke-Checked `
        $npmPath `
        @("init", "-y", "--silent") `
        $creatorRoot
    $jsxPackage = Get-Package $releaseSet "dynwinrt-jsx"
    $jsxTarball = Join-Path `
        $ReleaseSetDirectory `
        $jsxPackage.file
    Invoke-Checked `
        $npmPath `
        @(
            "install",
            "--no-save",
            "--package-lock=false",
            "--no-audit",
            "--no-fund",
            "--cache",
            $npmCache,
            $jsxTarball
        ) `
        $creatorRoot

    New-Item -ItemType Directory -Path $TargetRoot -Force |
        Out-Null
    $target = Join-Path $TargetRoot "$Template-app-$stamp"
    $result.target = $target
    $creator = Join-Path `
        $creatorRoot `
        "node_modules\dynwinrt-jsx\bin\create.js"
    Invoke-Checked `
        $NodePath `
        @(
            $creator,
            "create",
            $target,
            "--template",
            $Template
        ) `
        $creatorRoot

    $tarballs = @(
        "@microsoft/dynwinrt",
        "@microsoft/dynwinrt-codegen",
        "@microsoft/winappcli",
        "dynwinrt-jsx"
    ) | ForEach-Object {
        $package = Get-Package $releaseSet $_
        Join-Path $ReleaseSetDirectory $package.file
    }
    $installArguments = @(
        "install",
        "--no-save",
        "--package-lock=false",
        "--no-audit",
        "--no-fund",
        "--cache",
        $npmCache
    )
    $installArguments += $tarballs
    Invoke-Checked `
        $npmPath `
        $installArguments `
        $target

    $projectManifest = Get-Content `
        -LiteralPath (Join-Path $target "package.json") `
        -Raw |
        ConvertFrom-Json
    Assert-ExactProjectManifest $projectManifest $releaseSet
    $result.projectManifest = $projectManifest

    $installed = [ordered]@{}
    foreach ($entry in @(
        [pscustomobject]@{
            name = "@microsoft/dynwinrt"
            path = "node_modules\@microsoft\dynwinrt"
        },
        [pscustomobject]@{
            name = "@microsoft/dynwinrt-codegen"
            path = "node_modules\@microsoft\dynwinrt-codegen"
        },
        [pscustomobject]@{
            name = "@microsoft/winappcli"
            path = "node_modules\@microsoft\winappcli"
        },
        [pscustomobject]@{
            name = "dynwinrt-jsx"
            path = "node_modules\dynwinrt-jsx"
        },
        [pscustomobject]@{
            name = "typescript"
            path = "node_modules\typescript"
        }
    )) {
        $packageRoot = Join-Path $target $entry.path
        $item = Get-Item -LiteralPath $packageRoot
        if ($item.LinkType) {
            throw "Installed package is linked instead of packed: $($entry.name)"
        }
        $packageManifest = Get-Content `
            -LiteralPath (Join-Path $packageRoot "package.json") `
            -Raw |
            ConvertFrom-Json
        $installed[$entry.name] = $packageManifest.version
        $expected = $releaseSet.template.dependencies.PSObject.Properties[
            $entry.name
        ]
        if ($expected -and $expected.Value -cne $packageManifest.version) {
            throw (
                "Installed {0}@{1}; expected {2}." -f
                $entry.name,
                $packageManifest.version,
                $expected.Value
            )
        }
    }
    $result.installed = $installed

    Invoke-Checked $npmPath @("run", "setup") $target
    Invoke-Checked $npmPath @("run", "build") $target

    $winappPath = Join-Path `
        $target `
        "node_modules\@microsoft\winappcli\bin\win-x64\winapp.exe"
    $oldStatePath = $env:DYNWINRT_JSX_STATE_PATH
    try {
        $env:DYNWINRT_JSX_STATE_PATH = Join-Path `
            $runDirectory `
            "state.json"
        $process = Start-Process `
            -FilePath $NodePath `
            -ArgumentList "main.js" `
            -WorkingDirectory $target `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath `
            -PassThru
    }
    finally {
        $env:DYNWINRT_JSX_STATE_PATH = $oldStatePath
    }
    $window = Wait-ForWindow $process.Id $winappPath
    $windowHandle = [long]$window.hwnd
    if ($Template -eq "minimal") {
        Invoke-WinApp $winappPath @(
            "ui", "wait-for", "Count: 0",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp $winappPath @(
            "ui", "invoke", "IncrementButton",
            "-w", "$windowHandle"
        )
        Invoke-WinApp $winappPath @(
            "ui", "wait-for", "Count: 1",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
    }
    else {
        Invoke-WinApp $winappPath @(
            "ui", "wait-for", "HomePageHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp $winappPath @(
            "ui", "invoke", "IncrementButton",
            "-w", "$windowHandle"
        )
        Invoke-WinApp $winappPath @(
            "ui", "wait-for", "Native count: 1",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp $winappPath @(
            "ui", "invoke", "AboutButton",
            "-w", "$windowHandle"
        )
        Invoke-WinApp $winappPath @(
            "ui", "wait-for", "AboutDialog",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp $winappPath @(
            "ui", "invoke", "Done",
            "-w", "$windowHandle"
        )
        Invoke-WinApp $winappPath @(
            "ui", "invoke", "Settings",
            "-w", "$windowHandle"
        )
        Invoke-WinApp $winappPath @(
            "ui", "wait-for", "SettingsPageHeading",
            "-w", "$windowHandle",
            "--timeout", "$TimeoutMilliseconds"
        )
        Invoke-WinApp $winappPath @(
            "ui", "invoke", "ThemeToggle",
            "-w", "$windowHandle"
        )
        Invoke-WinApp $winappPath @(
            "ui", "invoke", "ThemeToggle",
            "-w", "$windowHandle"
        )
    }
    Invoke-WinApp $winappPath @(
        "ui", "invoke", "Close",
        "-w", "$windowHandle"
    )
    if (-not $process.WaitForExit($TimeoutMilliseconds)) {
        throw "Release-set app did not exit."
    }
    if ($process.ExitCode -ne 0) {
        throw "Release-set app exited with code $($process.ExitCode)."
    }

    $stdout = Read-SharedText $stdoutPath
    $stderr = Read-SharedText $stderrPath
    $diagnostics = [regex]::Match(
        $stdout,
        "renderer disposed cleanly: (\{[^\r\n]+\})"
    )
    if (-not $diagnostics.Success) {
        throw "Release-set app did not report renderer cleanup."
    }
    if (-not [string]::IsNullOrWhiteSpace($stderr)) {
        throw "Release-set app wrote errors: $stderr"
    }
    $result.status = "passed"
    $result.processId = $process.Id
    $result.exitCode = $process.ExitCode
    $result.windowHandle = $windowHandle
    $result.diagnostics = (
        $diagnostics.Groups[1].Value |
        ConvertFrom-Json
    )
}
catch {
    $result.status = "failed"
    $result.error = $_.Exception.Message
    throw
}
finally {
    if ($process) {
        $process.Refresh()
        if (-not $process.HasExited) {
            Stop-Process -Id $process.Id -Force
        }
    }
    $env:PATH = $oldPath
    $result.completedAt = [DateTime]::UtcNow.ToString("o")
    $result |
        ConvertTo-Json -Depth 10 |
        Set-Content `
            -LiteralPath $manifestPath `
            -Encoding UTF8
}

Write-Host "Release app smoke passed: $manifestPath"
