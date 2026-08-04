# 9. Validate and package the app

## Source checks

```powershell
npm run build
```

In the framework repository, the equivalent complete source gate is:

```powershell
npm run check
```

## Native behavior

Validate real WinUI behavior for:

- property and event updates;
- keyed identity;
- controlled selection;
- dialogs and focus;
- repeated close and cleanup;
- Worker startup failure.

The framework reference commands are:

```powershell
.\scripts\run-native-selftest.ps1
.\scripts\run-validation-suite.ps1 -Profile native
```

## Release-set application

The exact dependency set can create and run an application without sibling
links:

```powershell
npm run validate:release
```

Validate the minimal starter explicitly from packed artifacts:

```powershell
.\scripts\smoke-generated-app-release.ps1 -Template minimal
```

## MSIX

The reference Dashboard supports:

```powershell
npm run package:sea:x64
npm run package:sea:arm64
npm run package:sea:bundle
```

The packaging workflow:

- pins and verifies Node inputs;
- checks PE architecture for the SEA executable and dynwinrt addon;
- prunes generated bindings to the runtime CommonJS closure;
- excludes declarations and source maps;
- signs development artifacts;
- records hashes and source provenance.

Production signing, Store submission, clean-machine servicing, and native ARM64
UI validation require their external environments.

## Final checklist

- The application uses `core`, `controls`, and `winui` for normal screens.
- `native` imports are deliberate and documented.
- Host and Worker state validators agree.
- Every route has an ErrorBoundary.
- Close returns renderer diagnostics to zero.
- Package versions are exact.

Return to the [tutorial index](README.md) or compare the result with
[`examples/dashboard`](../../examples/dashboard).
