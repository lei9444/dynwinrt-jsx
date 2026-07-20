# Native WinUI dashboard

This example renders a native WinUI 3 workspace dashboard from TSX. It exercises a NavigationView application shell, scoped ContentDialog rendering, deterministic signals, refs, Fluent resources, stable keyed lists, error recovery, theme switching, diagnostics, and native window lifecycle.

Its metric and task surfaces use `createGridControl()` with typed
`gridLength.auto()`, `gridLength.pixel()`, and `gridLength.star()` definitions.
The UI smoke records Grid column positions in `.winapp\smoke\grid-layout.json`.

## Prerequisites

- Windows 10 or newer
- Node.js 20 or newer
- Rust toolchain
- Sibling repositories at `..\..\..\dynwinrt` and `..\..\..\winappCli`
- A built local dynwinrt JavaScript runtime under `dynwinrt\bindings\js\dist`

All npm dependencies are exact versions or local `file:` references.

## Run

```powershell
npm install
npm run setup
npm start
```

For state-preserving TSX hot reload:

```powershell
npm run dev
```

## Package the x64 SEA application

The package workflow downloads the exact Node.js 24.18.0 x64 archive and
postject 1.0.0-alpha.6 API bundle, verifies both SHA256 values, injects the
small bootstrap into a Windows GUI copy of `node.exe`, stages only runtime
files, and uses winappCli for assets, signing, and MSIX creation:

```powershell
npm run package:sea
```

See [`docs/sea-packaging.md`](../../docs/sea-packaging.md) for the complete
command-by-command build and runtime flow.

The signed development package and certificate are written under
`.winapp\sea-package`. Trust the generated certificate once from an elevated
terminal, then install the package:

```powershell
winapp cert install .\.winapp\sea-package\certificate\DynWinRTJSXDashboard-dev.pfx
Add-AppxPackage .\.winapp\sea-package\artifacts\DynWinRTJSXDashboard_1.0.0.0_x64_sea.msix
```

Use a release certificate without placing its password in source control:

```powershell
$env:DYNWINRT_JSX_CERT_PASSWORD = '<certificate password>'
npm run package:sea -- `
  -Version 1.0.0.1 `
  -Publisher 'CN=Your Publisher' `
  -CertificatePath C:\secure\release.pfx
```

The MSIX contains the SEA executable, external application JavaScript,
generated bindings, and native dynwinrt runtime. It does not contain a separate
`node.exe` or launcher process. Packaged asynchronous host errors are appended
to `%LOCALAPPDATA%\dynwinrt-jsx\sea-host.log`. Normal `npm start` remains
unpackaged.

`setup` builds the current local dynwinrt code generator, restores the pinned Windows SDK packages from `winapp.yaml`, and generates `.winapp\bindings`.

Use `npm run generate` after changing the `winapp.jsBindings` roots without changing SDK versions.

From the `dynwinrt-jsx` repository root, the same application can be prepared
from sibling source repositories without npm:

```powershell
.\scripts\run-dashboard-local.ps1 `
  -DotNetPath C:\path\to\dotnet.exe `
  -TypeScriptPath C:\path\to\typescript\bin\tsc

.\scripts\smoke-dashboard-ui.ps1

.\scripts\smoke-dashboard-hot-reload.ps1

.\scripts\smoke-dashboard-persistence.ps1

.\scripts\repeat-dashboard-smoke.ps1 `
  -Cycles 5 `
  -SkipRestore `
  -UseExistingWinAppCli `
  -TypeScriptPath C:\path\to\typescript\bin\tsc
```

The UI smoke run verifies navigation, Grid layout, task entry, ContentDialog,
diagnostics, theme switching, focus, screenshots, normal window close, and zero
active renderer records after disposal. The hot reload smoke verifies stable
PID/HWND identity, retained model state, build-error fallback, recovery, and
clean disposal.

The repeated lifecycle smoke prepares once, launches a fresh process for each
cycle, and records exit codes, renderer counts, process memory, handles, threads,
logs, UI inspection, and screenshots in a timestamped
`.winapp\lifecycle-smoke\run-*` directory.

The dashboard main process persists tasks, IDs, theme, and update time to
`%LOCALAPPDATA%\dynwinrt-jsx\dashboard-state.json`. Set
`DYNWINRT_JSX_STATE_PATH` to isolate development or test state. Invalid state is
renamed to `.corrupt-*`, restored to defaults, and reported on the dashboard.

The Windows App SDK is bootstrapped in `main.js`. A revisioned state bridge connects the main thread to the UI Worker. `src\winui-worker.tsx` owns the UI STA and stable model, while `src\dashboard-app.tsx` is the reloadable application module.
