#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$WorkRoot,
    [string]$NodePath,
    [string]$TypeScriptPath,
    [string]$DotNetPath,
    [string]$OutputDirectory,
    [string]$TargetRoot,
    [int]$TimeoutMilliseconds = 30000,
    [switch]$SkipSharedRestore
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$dashboardRoot = Join-Path $repoRoot "examples\dashboard"
if (-not $WorkRoot) {
    $WorkRoot = Split-Path $repoRoot -Parent
}
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $repoRoot ".winapp\generated-app-smoke"
}
if (-not $TargetRoot) {
    $TargetRoot = Join-Path $env:TEMP "dynwinrt-jsx-generated-apps"
}

$dynwinrtRoot = $null
$winappCliRoot = $null
$winappNpmRoot = $null
$prepareScript = Join-Path $PSScriptRoot "run-dashboard-local.ps1"
$creator = Join-Path $repoRoot "bin\create.js"

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
    throw "A local TypeScript compiler is required. Pass -TypeScriptPath."
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
        if (
            (Test-Path $candidate) -and
            ((& $candidate --list-sdks) -match "(?m)^10\.0\.")
        ) {
            return [IO.Path]::GetFullPath($candidate)
        }
    }
    throw ".NET SDK 10.x is required. Pass -DotNetPath."
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

function Invoke-WinApp([string[]]$Arguments, [switch]$Capture) {
    if ($Capture) {
        $output = & $winappExecutable @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "winapp $($Arguments -join ' ') exited with code $LASTEXITCODE."
        }
        return $output -join "`n"
    }
    & $winappExecutable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "winapp $($Arguments -join ' ') exited with code $LASTEXITCODE."
    }
}

function Set-DirectoryJunction([string]$Path, [string]$Target) {
    Remove-Item $Path -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Junction -Path $Path -Target $Target | Out-Null
}

function Wait-Ready(
    [Diagnostics.Process]$Process,
    [string]$StdoutPath,
    [string]$StderrPath
) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $Process.Refresh()
        if ($Process.HasExited) {
            throw "Generated app exited before readiness with code $($Process.ExitCode). $(Read-SharedText $StderrPath)"
        }
        if ((Read-SharedText $StdoutPath) -match "WinUI app is ready") {
            return
        }
        Start-Sleep -Milliseconds 100
    }
    throw "Generated app did not report readiness within $TimeoutMilliseconds ms."
}

function Wait-Exit([int]$ProcessId) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        if (-not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
            return
        }
        Start-Sleep -Milliseconds 100
    }
    throw "Generated app process $ProcessId did not exit within $TimeoutMilliseconds ms."
}

function Get-RepoState([string]$Path) {
    $diff = git -C $Path --no-pager diff HEAD --binary | Out-String
    $diffBytes = [Text.Encoding]::UTF8.GetBytes($diff)
    $status = @(
        git -C $Path status --porcelain=v1 --untracked-files=all
    )
    $untracked = [System.Collections.Generic.List[object]]::new()
    $state = [Text.StringBuilder]::new($diff)
    foreach ($relativePath in @(
        git -C $Path ls-files --others --exclude-standard
    )) {
        $fullPath = Join-Path $Path $relativePath
        $hash = (Get-FileHash $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
        $untracked.Add([pscustomobject]@{
            path = $relativePath
            sha256 = $hash
        })
        [void]$state.AppendLine("$relativePath`t$hash")
    }
    $stateBytes = [Text.Encoding]::UTF8.GetBytes($state.ToString())
    return [ordered]@{
        commit = (git -C $Path rev-parse HEAD).Trim()
        branch = (git -C $Path branch --show-current).Trim()
        dirty = $status.Count -gt 0
        status = $status
        trackedDiffSha256 = [Convert]::ToHexString(
            [Security.Cryptography.SHA256]::HashData($diffBytes)
        ).ToLowerInvariant()
        untrackedFiles = $untracked
        workingTreeStateSha256 = [Convert]::ToHexString(
            [Security.Cryptography.SHA256]::HashData($stateBytes)
        ).ToLowerInvariant()
    }
}

function Get-ObjectProperty($Object, [string]$Name) {
    $property = $Object.PSObject.Properties[$Name]
    if ($property) {
        return $property.Value
    }
    return $null
}

function Get-FlattenedElements($Elements) {
    $result = @()
    foreach ($element in @($Elements)) {
        $result += $element
        $children = Get-ObjectProperty $element "children"
        if ($children) {
            $result += Get-FlattenedElements $children
        }
    }
    return $result
}

function Read-WinAppPackages([string]$Path) {
    $packages = [System.Collections.Generic.List[object]]::new()
    $name = $null
    foreach ($line in Get-Content $Path) {
        if ($line -match "^\s*-\s+name:\s*(.+?)\s*$") {
            $name = $Matches[1]
        }
        elseif ($name -and $line -match "^\s+version:\s*(.+?)\s*$") {
            $packages.Add([pscustomobject]@{
                name = $name
                version = $Matches[1]
            })
            $name = $null
        }
    }
    return $packages
}

$runDirectory = Join-Path $OutputDirectory (
    "run-{0}-{1}" -f
        [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss-fff"),
        [guid]::NewGuid().ToString("N").Substring(0, 8)
)
New-Item -ItemType Directory -Force -Path $runDirectory | Out-Null
$manifestPath = Join-Path $runDirectory "compatibility.json"
$stdoutPath = Join-Path $runDirectory "app.stdout.log"
$stderrPath = Join-Path $runDirectory "app.stderr.log"
$inspectionPath = Join-Path $runDirectory "interactive-elements.json"
$initialScreenshot = Join-Path $runDirectory "generated-app-initial.png"
$updatedScreenshot = Join-Path $runDirectory "generated-app-updated.png"
$themeProbeBefore = Join-Path $runDirectory "theme-probe-before.png"
$themeProbeAfter = Join-Path $runDirectory "theme-probe-after.png"

$result = [ordered]@{
    startedAt = [DateTime]::UtcNow.ToString("o")
    status = "running"
    architecture = "x64"
    sources = $null
    tools = $null
    targetRoot = $TargetRoot
    target = $null
    artifacts = [ordered]@{
        inspection = $inspectionPath
        initialScreenshot = $initialScreenshot
        updatedScreenshot = $updatedScreenshot
        themeProbeBefore = $themeProbeBefore
        themeProbeAfter = $themeProbeAfter
        stdout = $stdoutPath
        stderr = $stderrPath
    }
}

$process = $null
$windowHandle = $null
try {
    New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null
    $target = Join-Path $TargetRoot (
        "app-{0}-{1}" -f
            [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss-fff"),
            [guid]::NewGuid().ToString("N").Substring(0, 8)
    )
    $result.target = $target
    $dynwinrtRoot = Join-Path $WorkRoot "dynwinrt"
    $winappCliRoot = Join-Path $WorkRoot "winappCli"
    $winappNpmRoot = Join-Path $winappCliRoot "src\winapp-npm"
    $NodePath = Resolve-Node $NodePath
    $TypeScriptPath = Resolve-TypeScript $TypeScriptPath
    $DotNetPath = Resolve-DotNet10 $DotNetPath
    $env:PATH = "$(Split-Path $NodePath -Parent);$env:PATH"
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"
    $env:WINAPP_CLI_TELEMETRY_OPTOUT = "1"
    $result.sources = [ordered]@{
        dynwinrt = Get-RepoState $dynwinrtRoot
        dynwinrtJsx = Get-RepoState $repoRoot
        winappCli = Get-RepoState $winappCliRoot
    }
    $result.tools = [ordered]@{
        node = (& $NodePath --version).Trim()
        typescript = (& $NodePath $TypeScriptPath --version).Trim()
        cargo = (cargo --version).Trim()
        dotnet = (& $DotNetPath --version).Trim()
    }

    $prepareArgs = @{
        WorkRoot = $WorkRoot
        NodePath = $NodePath
        TypeScriptPath = $TypeScriptPath
        DotNetPath = $DotNetPath
        NoLaunch = $true
    }
    if ($SkipSharedRestore) {
        $prepareArgs.SkipRestore = $true
    }
    & $prepareScript @prepareArgs

    Invoke-Checked $NodePath @(
        $creator,
        "create",
        $target,
        "--local-root",
        $WorkRoot
    ) $repoRoot

    $targetMicrosoft = Join-Path $target "node_modules\@microsoft"
    New-Item -ItemType Directory -Force -Path $targetMicrosoft | Out-Null
    Copy-Item `
        (Join-Path $dashboardRoot "node_modules\@microsoft\dynwinrt") `
        (Join-Path $targetMicrosoft "dynwinrt") `
        -Recurse `
        -Force
    Copy-Item `
        (Join-Path $dashboardRoot "node_modules\@microsoft\dynwinrt-codegen") `
        (Join-Path $targetMicrosoft "dynwinrt-codegen") `
        -Recurse `
        -Force
    Set-DirectoryJunction `
        (Join-Path $target "node_modules\dynwinrt-jsx") `
        $repoRoot

    $winappWrapper = Join-Path $winappNpmRoot "dist\cli.js"
    $winappExecutable = Join-Path $winappNpmRoot "bin\win-x64\winapp.exe"
    Invoke-Checked $NodePath @($winappWrapper, "restore") $target
    Invoke-Checked $NodePath @(
        $TypeScriptPath,
        "-p",
        (Join-Path $target "tsconfig.json")
    ) $target

    $result.projectManifest = Get-Content (Join-Path $target "package.json") -Raw |
        ConvertFrom-Json
    $result.winappPackages = Read-WinAppPackages (Join-Path $target "winapp.yaml")

    $oldStatePath = $env:DYNWINRT_JSX_STATE_PATH
    try {
        $env:DYNWINRT_JSX_STATE_PATH = Join-Path $runDirectory "state.json"
        $process = Start-Process `
            -FilePath $NodePath `
            -ArgumentList ".\main.js" `
            -WorkingDirectory $target `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath `
            -PassThru
    }
    finally {
        $env:DYNWINRT_JSX_STATE_PATH = $oldStatePath
    }
    Wait-Ready $process $stdoutPath $stderrPath

    $status = Invoke-WinApp @(
        "ui", "status",
        "-a", "$($process.Id)",
        "--json"
    ) -Capture | ConvertFrom-Json
    if ([int]$status.processId -ne $process.Id) {
        throw "UIA resolved PID $($status.processId), expected $($process.Id)."
    }
    $windowHandle = [long]$status.hwnd

    $inspection = Invoke-WinApp @(
        "ui", "inspect",
        "-w", "$windowHandle",
        "--interactive",
        "--json"
    ) -Capture
    [IO.File]::WriteAllText($inspectionPath, "$inspection`n")
    $elements = @(
        ($inspection | ConvertFrom-Json).windows[0].elements
    )
    $increment = $elements | Where-Object {
        (Get-ObjectProperty $_ "automationId") -eq "IncrementButton"
    }
    if (@($increment).Count -ne 1) {
        throw "Generated app controls were not uniquely discoverable through UIA."
    }
    $fullInspection = Invoke-WinApp @(
        "ui", "inspect",
        "-w", "$windowHandle",
        "--depth", "8",
        "--json"
    ) -Capture | ConvertFrom-Json
    $heading = @(
        Get-FlattenedElements $fullInspection.windows[0].elements |
            Where-Object {
                (Get-ObjectProperty $_ "automationId") -eq "HomePageHeading"
            }
    )
    if ($heading.Count -ne 1) {
        throw "Generated app theme probe text was not uniquely discoverable."
    }

    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $initialScreenshot
    )
    Invoke-WinApp @(
        "ui", "screenshot", (Get-ObjectProperty $heading[0] "selector"),
        "-w", "$windowHandle",
        "--output", $themeProbeBefore
    )
    Invoke-WinApp @(
        "ui", "invoke", $increment.selector,
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "Native count: 1",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )

    Invoke-WinApp @(
        "ui", "invoke", "AboutButton",
        "-w", "$windowHandle"
    )
    Invoke-WinApp @(
        "ui", "wait-for", "AboutDialog",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    Invoke-WinApp @("ui", "invoke", "Done", "-w", "$windowHandle")

    Invoke-WinApp @("ui", "invoke", "Settings", "-w", "$windowHandle")
    Invoke-WinApp @(
        "ui", "wait-for", "SettingsPageHeading",
        "-w", "$windowHandle",
        "--timeout", "$TimeoutMilliseconds"
    )
    $settingsInspection = Invoke-WinApp @(
        "ui", "inspect",
        "-w", "$windowHandle",
        "--interactive",
        "--json"
    ) -Capture | ConvertFrom-Json
    $theme = @(
        Get-FlattenedElements $settingsInspection.windows[0].elements |
            Where-Object {
                (Get-ObjectProperty $_ "automationId") -eq "ThemeToggle"
            }
    )
    if ($theme.Count -ne 1) {
        throw "Generated app theme toggle was not uniquely discoverable."
    }
    $settingsTree = Invoke-WinApp @(
        "ui", "inspect",
        "-w", "$windowHandle",
        "--depth", "8",
        "--json"
    ) -Capture | ConvertFrom-Json
    $heading = @(
        Get-FlattenedElements $settingsTree.windows[0].elements |
            Where-Object {
                (Get-ObjectProperty $_ "automationId") -eq "SettingsPageHeading"
            }
    )
    if ($heading.Count -ne 1) {
        throw "Generated app settings theme probe was not uniquely discoverable."
    }

    $themeBefore = (
        Invoke-WinApp @(
            "ui", "inspect", $theme.selector,
            "-w", "$windowHandle",
            "--json"
        ) -Capture |
            ConvertFrom-Json
    ).windows[0].elements[0].toggleState
    Invoke-WinApp @(
        "ui", "invoke", $theme.selector,
        "-w", "$windowHandle"
    )
    $themeAfter = (
        Invoke-WinApp @(
            "ui", "inspect", $theme.selector,
            "-w", "$windowHandle",
            "--json"
        ) -Capture |
            ConvertFrom-Json
    ).windows[0].elements[0].toggleState
    if ($themeAfter -eq $themeBefore) {
        throw "Generated app theme toggle did not change state."
    }
    Start-Sleep -Milliseconds 500
    Invoke-WinApp @(
        "ui", "screenshot",
        "-w", "$windowHandle",
        "--output", $updatedScreenshot
    )
    Invoke-WinApp @(
        "ui", "screenshot", (Get-ObjectProperty $heading[0] "selector"),
        "-w", "$windowHandle",
        "--output", $themeProbeAfter
    )
    $themeProbeBeforeHash = (
        Get-FileHash $themeProbeBefore -Algorithm SHA256
    ).Hash.ToLowerInvariant()
    $themeProbeAfterHash = (
        Get-FileHash $themeProbeAfter -Algorithm SHA256
    ).Hash.ToLowerInvariant()
    if ($themeProbeBeforeHash -eq $themeProbeAfterHash) {
        throw "Generated app theme-dependent text did not change visually."
    }
    Invoke-WinApp @(
        "ui", "invoke", $theme.selector,
        "-w", "$windowHandle"
    )

    Invoke-WinApp @(
        "ui", "invoke", "Close",
        "-w", "$windowHandle"
    )
    Wait-Exit $process.Id
    $process.Refresh()
    if ($process.ExitCode -ne 0) {
        throw "Generated app exited with code $($process.ExitCode)."
    }

    $stdout = Read-SharedText $stdoutPath
    $stderr = Read-SharedText $stderrPath
    $diagnostics = [regex]::Match(
        $stdout,
        "renderer disposed cleanly: (\{[^\r\n]+\})"
    )
    if (-not $diagnostics.Success) {
        throw "Generated app did not report renderer disposal diagnostics."
    }
    if (-not [string]::IsNullOrWhiteSpace($stderr)) {
        throw "Generated app wrote errors: $stderr"
    }

    $result.status = "passed"
    $result.processId = $process.Id
    $result.exitCode = $process.ExitCode
    $result.windowHandle = $windowHandle
    $result.incrementSelector = $increment.selector
    $result.themeSelector = $theme.selector
    $result.themeBefore = $themeBefore
    $result.themeAfter = $themeAfter
    $result.themeProbeBeforeSha256 = $themeProbeBeforeHash
    $result.themeProbeAfterSha256 = $themeProbeAfterHash
    $result.diagnostics = $diagnostics.Groups[1].Value | ConvertFrom-Json
}
catch {
    $result.status = "failed"
    $result.error = $_.Exception.Message
    throw
}
finally {
    $cleanup = [ordered]@{
        attempted = $false
        forced = $false
        succeeded = $true
        error = $null
    }
    if ($process) {
        $result.processId = $process.Id
        if ($windowHandle) {
            $result.windowHandle = $windowHandle
        }
        $process.Refresh()
        if (-not $process.HasExited) {
            $cleanup.attempted = $true
            if ($windowHandle) {
                try {
                    Invoke-WinApp @(
                        "ui", "invoke", "Close",
                        "-w", "$windowHandle"
                    )
                    Wait-Exit $process.Id
                }
                catch {
                    $cleanup.error = $_.Exception.Message
                }
            }
            else {
                $cleanup.forced = $true
            }
            $process.Refresh()
            if (-not $process.HasExited) {
                try {
                    $cleanup.forced = $true
                    Stop-Process -Id $process.Id -Force -ErrorAction Stop
                    Wait-Process -Id $process.Id -Timeout 5 -ErrorAction Stop
                }
                catch {
                    $cleanup.succeeded = $false
                    $cleanup.error = $_.Exception.Message
                }
            }
        }
        $process.Refresh()
        if ($process.HasExited) {
            $result.exitCode = $process.ExitCode
        }
        else {
            $cleanup.succeeded = $false
            $cleanup.error ??= "Generated app process remained running after cleanup."
        }
    }
    $result.cleanup = $cleanup
    $result.completedAt = [DateTime]::UtcNow.ToString("o")
    [IO.File]::WriteAllText(
        $manifestPath,
        "$($result | ConvertTo-Json -Depth 12)`n"
    )
}

Write-Host "Generated app compatibility smoke passed." -ForegroundColor Green
Write-Host "Manifest: $manifestPath" -ForegroundColor Green
