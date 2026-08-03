# Node SEA MSIX packaging

The dashboard packages Node.js as an application-specific Windows executable
by using Node's Single Executable Application (SEA) support. The SEA executable
contains a small startup bootstrap, while the application JavaScript, generated
bindings, and native addon remain external files in the MSIX.

The workflow is implemented by:

- `examples/dashboard/scripts/package-sea.ps1`
- `examples/dashboard/packaging/sea-bootstrap.cjs`
- `examples/dashboard/packaging/inject-sea.cjs`
- `examples/dashboard/packaging/Package.appxmanifest`

## Build commands

From `examples/dashboard`:

```powershell
npm run package:sea:x64
npm run package:sea:arm64
npm run package:sea:bundle
```

`package:sea` remains an alias for the x64 build. The ARM64 and bundle commands
cross-build the native dynwinrt addon with the installed Rust and Visual Studio
ARM64 toolchain before packaging.

The bundle command produces:

```text
.winapp\sea-package\artifacts\
  DynWinRTJSXDashboard_1.0.0.0_x64_sea.msix
  DynWinRTJSXDashboard_1.0.0.0_arm64_sea.msix
  DynWinRTJSXDashboard_1.0.0.0_x64_arm64_sea.msixbundle
  DynWinRTJSXDashboard_1.0.0.0_x64_sea.provenance.json
  DynWinRTJSXDashboard_1.0.0.0_arm64_sea.provenance.json
  DynWinRTJSXDashboard_1.0.0.0_x64_arm64_sea.provenance.json
```

All downloads, temporary files, certificates, package layouts, and output
artifacts remain under `.winapp\sea-package`, which is ignored by Git.

## Pinned build inputs

Both architecture workflows pin:

| Input | Version/target |
|---|---|
| Node.js | 24.18.0 x64 and ARM64 |
| dynwinrt addon | x86_64-pc-windows-msvc and aarch64-pc-windows-msvc |
| postject | 1.0.0-alpha.6 |

The script downloads the official Node Windows ZIP for the target architecture
and the bundled postject API. ARM64 packaging also uses the pinned x64 Node
executable as the build host for SEA preparation and PE injection because the
target executable cannot run on an x64 build machine. All files are accepted
only when their SHA256 values match the constants in `package-sea.ps1`.

The Node ZIP is extracted to:

```text
.winapp\sea-package\cache\
  node-v24.18.0-win-<architecture>\
    node.exe
    LICENSE
```

The extracted `node.exe`, generated SEA executable, and staged
`dynwinrt.node` are checked independently and must match the requested PE
machine type (`0x8664` for x64 or `0xAA64` for ARM64).

Every package writes a provenance document containing:

- the MSIX and SEA executable SHA256 values;
- Node and postject versions and SHA256 values;
- package and generated-binding hashes;
- the signing certificate subject and thumbprint;
- exact dynwinrt-jsx, dynwinrt, and winappCli commits;
- source repository clean/dirty state;
- manifest dependencies.

For a release build, reject dirty source repositories:

```powershell
npm run package:sea -- `
  -Version 1.0.0.1 `
  -CertificatePath C:\secure\release.pfx `
  -RequireCleanSources
```

## 1. Build the application JavaScript

The package command first runs:

```powershell
tsc -p tsconfig.json
```

This generates the dashboard application and UI Worker under `dist`:

```text
dist\
  dashboard-app.js
  dashboard-model.js
  dashboard-state.js
  winui-worker.js
  ...
```

Unpackaged development remains unchanged:

```powershell
npm start
npm run dev
```

## 2. Stage the runtime layout

The packaging script creates:

```text
.winapp\sea-package\layout\<architecture>\<version>\
```

It stages only files required at runtime:

```text
main.js
package.json
dist\
.winapp\bindings\
node_modules\dynwinrt-jsx\
node_modules\@microsoft\dynwinrt\
licenses\node-LICENSE
```

Before staging generated bindings, the packaging script scans runtime imports
from the Dashboard source, adds the fixed binding surface used by
`defineWinUIApp()` and the renderer preset, and follows every relative
CommonJS dependency. It writes a compact lazy `index.js` and copies only that
runtime closure. Declarations, source maps, codegen metadata, and unreachable
binding modules are excluded.

The current Dashboard closure reduced generated bindings from 3,278 files and
36.9 MB to 995 JavaScript files and 21.4 MB, a 41.9% byte reduction. The x64
MSIX decreased from 41.14 MB to 38.04 MB before the additional runtime-package
source-map/declaration filtering.

The compiled application and Worker graph is nine JavaScript files totaling
less than 100 KB. It remains unbundled because separate modules preserve direct
file hot reload, while Node and generated bindings dominate both package size
and cold-start I/O.

The root `package.json` is required because the UI Worker imports generated
bindings through the package import alias:

```json
{
  "imports": {
    "#winapp/bindings": {
      "require": "./.winapp/bindings/index.js"
    }
  }
}
```

The package does not stage a separate `node.exe`.

## 3. Generate the manifest assets

The package manifest declares:

- full-trust desktop execution;
- the Windows App Runtime 2 framework;
- the Microsoft Visual C++ UWP Desktop runtime;
- Start menu visual assets;
- the SEA executable as the application entry point.

The manifest uses:

```xml
<Application
  Executable="$targetnametoken$.exe"
  EntryPoint="Windows.FullTrustApplication">
```

winappCli generates all image scales from the source SVG:

```powershell
winapp manifest update-assets `
  packaging\dashboard-logo.svg `
  --manifest .winapp\sea-package\layout\<architecture>\<version>\Package.appxmanifest
```

## 4. Generate the SEA preparation blob

The script writes a temporary SEA configuration equivalent to:

```json
{
  "main": "packaging/sea-bootstrap.cjs",
  "output": "  .winapp/sea-package/work/<architecture>/<version>/sea-prep.blob",
  "disableExperimentalSEAWarning": true,
  "useSnapshot": false,
  "useCodeCache": false
}
```

It then uses the pinned Node executable:

```powershell
node.exe --experimental-sea-config sea-config.json
```

This generates:

```text
.winapp\sea-package\work\<version>\sea-prep.blob
```

The blob contains the startup bootstrap and SEA metadata. The Node version
that generates the blob must match the Node executable that receives it.

## 5. Create the application executable

The pinned official Node executable is copied as:

```text
DynWinRTJSXDashboard.exe
```

Before modifying it, the script removes the original Node Authenticode
signature:

```powershell
winapp tool signtool remove /s DynWinRTJSXDashboard.exe
```

The original signature cannot remain valid because SEA injection changes the
binary.

## 6. Inject the blob with postject

[postject](https://github.com/nodejs/postject) is an open-source build-time
tool for injecting resources into PE, ELF, and Mach-O executables. Node 24's
official SEA workflow uses it to insert the preparation blob.

The dashboard runs the equivalent of:

```powershell
node.exe packaging\inject-sea.cjs `
  DynWinRTJSXDashboard.exe `
  sea-prep.blob `
  postject-api.js
```

`inject-sea.cjs` calls:

```js
inject(
  executable,
  'NODE_SEA_BLOB',
  fs.readFileSync(blob),
  {
    sentinelFuse:
      'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  },
)
```

postject:

1. parses the Windows PE executable;
2. adds the blob as the `NODE_SEA_BLOB` resource;
3. changes Node's SEA fuse from disabled to enabled.

postject is not included in the final MSIX. It is only a pinned build tool.

## 7. Hide the console window

The downloaded Node executable is a console-subsystem PE. After injection, the
script changes the PE subsystem from:

```text
IMAGE_SUBSYSTEM_WINDOWS_CUI (3)
```

to:

```text
IMAGE_SUBSYSTEM_WINDOWS_GUI (2)
```

The resulting application does not create a visible console or `conhost`
window.

## 8. Sign the executable

When no certificate is supplied, the script creates a local development
certificate:

```powershell
winapp cert generate `
  --manifest Package.appxmanifest `
  --output DynWinRTJSXDashboard-dev.pfx
```

The modified SEA executable is then signed:

```powershell
winapp sign `
  DynWinRTJSXDashboard.exe `
  DynWinRTJSXDashboard-dev.pfx
```

For release packaging, pass a trusted certificate and provide its password
through an environment variable:

```powershell
$env:DYNWINRT_JSX_CERT_PASSWORD = '<certificate password>'
npm run package:sea -- `
  -Version 1.0.0.1 `
  -Publisher 'CN=Your Publisher' `
  -CertificatePath C:\secure\release.pfx `
  -RequireCleanSources
```

Do not store a release certificate or password in the repository.

## 9. Build and sign the MSIX

The final packaging command is equivalent to:

```powershell
winapp package `
  .winapp\sea-package\layout\<architecture>\<version> `
  --manifest Package.appxmanifest `
  --executable DynWinRTJSXDashboard.exe `
  --output DynWinRTJSXDashboard_<version>_<architecture>_sea.msix `
  --cert DynWinRTJSXDashboard-dev.pfx
```

The generated MSIX contains:

```text
DynWinRTJSXDashboard.exe
main.js
package.json
dist\
.winapp\bindings\
node_modules\
Assets\
Package.appxmanifest
resources.pri
```

It does not contain:

```text
node.exe
launcher.exe
postject
TypeScript sources
TypeScript declarations
source maps
```

## Runtime startup

Windows activates the application entry point:

```text
Start menu
→ DynWinRTJSXDashboard.exe
```

Node sees the enabled SEA fuse and executes `NODE_SEA_BLOB`:

```text
DynWinRTJSXDashboard.exe
→ sea-bootstrap.cjs
→ main.js
→ Node Worker
→ dynwinrt
→ WinUI window
```

The bootstrap:

1. resolves the package root from `process.execPath`;
2. changes the working directory to that root;
3. sets `DYNWINRT_JSX_PACKAGED=1`;
4. creates a filesystem-backed `require`;
5. loads the external `main.js`.

The packaged flag prevents `main.js` from calling the unpackaged Windows App
SDK bootstrap. The MSIX framework dependency supplies the Windows App Runtime
instead.

The UI Worker remains a Node Worker thread in the same process. There is no
launcher process and no child `node.exe`.

## Diagnostics

Synchronous bootstrap failures and asynchronous `console.error` or
`console.warn` messages are appended to:

```text
%LOCALAPPDATA%\dynwinrt-jsx\sea-host.log
```

Normal application state remains at:

```text
%LOCALAPPDATA%\dynwinrt-jsx\dashboard-state.json
```

The MSIX installation directory is immutable. Runtime state and diagnostics
must not be written beside the executable.

## Startup timing

The packaged dashboard emits structured startup milestones:

```text
dashboard-startup/main.entered
dashboard-startup/host-api.loaded
dashboard-startup/state.loaded
dashboard-startup/bridge.created
dashboard-startup/worker.created
dashboard-worker/startup.ro-initialized
dashboard-worker/startup.bridge-created
dashboard-worker/startup.renderer-created
dashboard-worker/startup.application-starting
dashboard-worker/startup.window-created
dashboard-worker/startup.state-initialized
dashboard-worker/startup.app-module-loaded
dashboard-worker/startup.native-selftest-loaded
dashboard-worker/startup.tree-rendered
dashboard-worker/startup.hot-session-created
dashboard-worker/startup.window-activated
```

Worker milestones include elapsed time from the SEA bootstrap and from Worker
module execution. Selftest and hot-session milestones are emitted only when
those modes are enabled. This separates package/Node startup, Worker module
loading, WinUI initialization, application module loading, rendering, and
activation.

The main process imports its bridge, persistence, and diagnostics APIs from
`dynwinrt-jsx/host`, which avoids loading renderer and WinUI authoring modules.
Native selftest code is loaded only when `DYNWINRT_JSX_SELFTEST=1`, and the
Tasks/ListView adapter is initialized when the Tasks page is rendered instead
of during application module loading.

On the current x64 development machine, a 15-run warm-start A/B comparison
against the previous package measured:

| Metric | Previous | Optimized |
|---|---:|---:|
| Median process start to `application.ready` | 1083.4ms | 1040.3ms |
| Trimmed average | 1169.5ms | 1123.4ms |

The stable improvement is approximately 43-46ms, or 4%. First launch after an
install or upgrade remains dominated by Windows file paging, signature and
antivirus inspection, Node/V8 startup, and native framework loading before the
first Worker milestone. Treat one first-launch sample as diagnostic evidence,
not a stable benchmark.

## Install a development package

Trust the generated development certificate once from an elevated terminal:

```powershell
winapp cert install `
  .\.winapp\sea-package\certificate\DynWinRTJSXDashboard-dev.pfx
```

Install the package:

```powershell
Add-AppxPackage `
  .\.winapp\sea-package\artifacts\DynWinRTJSXDashboard_1.0.0.0_x64_arm64_sea.msixbundle
```

A development certificate is only suitable for local testing. Public
distribution requires a trusted signing certificate or Microsoft Store
signing.

## Servicing contract

The servicing workflow defaults to x64 and can run on an ARM64 validation
machine with `-Architecture arm64`. It uses two versioned packages and an
isolated state file:

```powershell
npm run package:sea:servicing -- `
  -Architecture x64 `
  -BaseVersion 1.0.20.0 `
  -UpgradeVersion 1.0.21.0 `
  -CertificatePath C:\secure\test-signing.pfx
```

Use `-InstallCertificate` for a generated development certificate when it has
not already been trusted.

The workflow:

1. installs the base package;
2. starts the real packaged application;
3. adds a task through UI Automation and waits for atomic persistence;
4. upgrades to the higher package version;
5. verifies the task and renderer cleanup;
6. rolls back with `Add-AppxPackage -ForceUpdateFromAnyVersion`;
7. verifies the task again;
8. uninstalls the package;
9. verifies that externally owned user state remains;
10. reinstalls the higher version and verifies recovery.

The servicing contract is:

- package upgrades and explicit rollbacks preserve application state;
- uninstall removes the MSIX registration and immutable package files;
- uninstall does not delete `%LOCALAPPDATA%\dynwinrt-jsx` state;
- reinstall reads the preserved state;
- every tested version must close with zero active native and component
  diagnostics.

Each run writes evidence to:

```text
.winapp\sea-package\servicing\run-*\summary.json
```

The summary records every version transition, whether state survived uninstall,
the final installed version, whether the original machine package state was
restored, and any failure. Per-phase stdout and stderr logs record startup and
renderer disposal. Unless `-KeepUpgradeInstalled` is passed, the script restores
the package version that was installed before the test.

The isolated state is written under:

```text
%LOCALAPPDATA%\dynwinrt-jsx\servicing\run-*\
```

The final state is copied into the run evidence directory, then the temporary
LocalAppData directory is removed.

## Clean-machine gate

Copy the signed MSIX and `test-sea-clean-machine.ps1` to a Windows machine that
does not contain this repository, Node.js, winappCli, Visual Studio, or an
existing dashboard installation. Trust a development certificate separately
when the package is not Store/CA signed, then run:

```powershell
.\test-sea-clean-machine.ps1 `
  -PackagePath .\DynWinRTJSXDashboard_1.0.0.0_x64_sea.msix
```

The script only uses built-in Windows PowerShell and AppX commands. It:

1. installs the MSIX;
2. launches the packaged SEA executable in native selftest mode;
3. verifies the real WinUI property, event, keyed identity, automation, focus,
   failure propagation, and cleanup result;
4. records Windows and framework dependency versions;
5. uninstalls the package.

Evidence is written beside the package under `clean-machine-*\summary.json`.
Use `-KeepInstalled` only when the clean machine should retain the package.

## Current scope

The checked-in workflow produces x64 and ARM64 packages plus a signed
multi-architecture development bundle. Remaining external release gates are:

- execution of the native UI and servicing suites on ARM64 Windows hardware;
- a trusted production signing certificate or Store signing;
- execution of `test-sea-clean-machine.ps1` on an external clean Windows
  machine.

The SEA approach also assumes Worker threads. Code that depends on
`child_process.fork()` needs separate validation because `process.execPath`
points to the application-specific SEA executable rather than a generic Node
CLI.
