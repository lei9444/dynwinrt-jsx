# dynwinrt-jsx WinUI app

The generated application includes:

- a Worker-owned WinUI STA and stable host state bridge;
- a NavigationView application shell;
- scoped ContentDialog rendering;
- renderer diagnostics and accessibility selectors; and
- versioned TSX hot reload that preserves the Window and model state.

```powershell
npm run setup
npm start
```

Use development hot reload after setup:

```powershell
npm run dev
```

Changes to `src/app.tsx` replace the root tree without restarting the Worker.
Changes to `src/app-model.ts`, `src/winui-worker.tsx`, generated bindings, or
the native runtime require a restart.

`main.js` bootstraps the Windows App SDK before starting the UI Worker. The
Worker owns the STA, `Application`, `Window`, model, and renderer; `src/app.tsx`
contains the reloadable TSX application tree.
