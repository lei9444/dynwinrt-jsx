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

.\scripts\repeat-dashboard-smoke.ps1 `
  -Cycles 5 `
  -SkipRestore `
  -DotNetPath C:\path\to\dotnet.exe `
  -TypeScriptPath C:\path\to\typescript\bin\tsc
```

The UI smoke run verifies navigation, Grid layout, task entry, ContentDialog,
diagnostics, theme switching, focus, screenshots, normal window close, and zero
active renderer records after disposal. The hot reload smoke verifies stable
PID/HWND identity, retained model state, build-error fallback, recovery, and
clean disposal.

The repeated lifecycle smoke prepares once, launches a fresh process for each
cycle, and records exit codes, renderer counts, logs, UI inspection, and
screenshots in a timestamped `.winapp\lifecycle-smoke\run-*` directory.

The Windows App SDK is bootstrapped in `main.js`. A revisioned state bridge connects the main thread to the UI Worker. `src\winui-worker.tsx` owns the UI STA and stable model, while `src\dashboard-app.tsx` is the reloadable application module.
