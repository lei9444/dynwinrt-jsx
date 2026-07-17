# Native WinUI dashboard

This example renders a native WinUI 3 workspace dashboard from TSX. It exercises components, deterministic signals, refs, signal-backed events, Fluent resources, `Show`, stable keyed `For`, ErrorBoundary, automatic WinRT value conversion, theme switching, and native window lifecycle.

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

`setup` builds the current local dynwinrt code generator, restores the pinned Windows SDK packages from `winapp.yaml`, and generates `.winapp\bindings`.

Use `npm run generate` after changing the `winapp.jsBindings` roots without changing SDK versions.

The Windows App SDK is bootstrapped in `main.js`. A revisioned state bridge connects the main thread to the UI Worker. `src\winui-worker.tsx` owns the UI STA, calls `Application.start()`, renders the TSX tree, and exits when the native window closes.
