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

## Build command

From `examples/dashboard`:

```powershell
npm run package:sea
```

This expands to:

```text
npm run build
→ powershell -File scripts/package-sea.ps1
```

The default output is:

```text
.winapp\sea-package\artifacts\
  DynWinRTJSXDashboard_1.0.0.0_x64_sea.msix
```

All downloads, temporary files, certificates, package layouts, and output
artifacts remain under `.winapp\sea-package`, which is ignored by Git.

## Pinned build inputs

The x64 workflow pins:

| Input | Version |
|---|---|
| Node.js | 24.18.0 |
| postject | 1.0.0-alpha.6 |

The script downloads the official Node Windows x64 ZIP and the bundled
postject API. Both files are accepted only when their SHA256 values match the
constants in `package-sea.ps1`.

The Node ZIP is extracted to:

```text
.winapp\sea-package\cache\
  node-v24.18.0-win-x64\
    node.exe
    LICENSE
```

The extracted `node.exe` is also checked independently and must have an x64 PE
machine type. The staged `dynwinrt.node` native addon must be x64 as well.

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
.winapp\sea-package\layout\<version>\
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
  --manifest .winapp\sea-package\layout\<version>\Package.appxmanifest
```

## 4. Generate the SEA preparation blob

The script writes a temporary SEA configuration equivalent to:

```json
{
  "main": "packaging/sea-bootstrap.cjs",
  "output": ".winapp/sea-package/work/<version>/sea-prep.blob",
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
  -CertificatePath C:\secure\release.pfx
```

Do not store a release certificate or password in the repository.

## 9. Build and sign the MSIX

The final packaging command is equivalent to:

```powershell
winapp package `
  .winapp\sea-package\layout\<version> `
  --manifest Package.appxmanifest `
  --executable DynWinRTJSXDashboard.exe `
  --output DynWinRTJSXDashboard_<version>_x64_sea.msix `
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

## Install a development package

Trust the generated development certificate once from an elevated terminal:

```powershell
winapp cert install `
  .\.winapp\sea-package\certificate\DynWinRTJSXDashboard-dev.pfx
```

Install the package:

```powershell
Add-AppxPackage `
  .\.winapp\sea-package\artifacts\DynWinRTJSXDashboard_1.0.0.0_x64_sea.msix
```

A development certificate is only suitable for local testing. Public
distribution requires a trusted signing certificate or Microsoft Store
signing.

## Current scope

The checked-in workflow currently produces an x64 package. ARM64 still
requires:

- an ARM64 Node binary and pinned checksums;
- an ARM64 `dynwinrt.node`;
- an ARM64 native UI validation environment;
- a multi-architecture MSIX bundle.

The SEA approach also assumes Worker threads. Code that depends on
`child_process.fork()` needs separate validation because `process.execPath`
points to the application-specific SEA executable rather than a generic Node
CLI.
