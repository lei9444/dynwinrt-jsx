# 1. Create and run the project

Create the application from an empty parent directory:

```powershell
npx dynwinrt-jsx@1.0.0 create task-dashboard --template minimal
cd task-dashboard
npm install
npm run setup
npm start
```

`setup` restores the Windows App SDK inputs and generates the dynwinrt
JavaScript bindings. `start` compiles TypeScript and launches the WinUI Worker.
The `dashboard` template is the larger ready-made shell; this tutorial starts
minimal and adds each capability deliberately.

## Generated structure

```text
main.js                 Main-process Host
src/app-state.ts        Persisted and runtime state schemas
src/app-model.ts        Signals and application operations
src/app.tsx             Current screen
src/winui-worker.tsx    WinUI STA and Window lifecycle
```

For normal feature work, stay in:

- `src/app-state.ts`;
- `src/app-model.ts`;
- `src/app.tsx`.

The Host and Worker files are advanced integration points.

When later chapters add an application shell, keep renderer and
projected-ownership types in a dedicated shell context file. Ordinary screen
modules should stay on `core`, `controls`, and `winui`.

## Recommended imports

Application code should use the focused layers:

```ts
import {
  computed,
  signal,
} from 'dynwinrt-jsx/core'
import {
  createWinUIControls,
} from 'dynwinrt-jsx/controls'
import {
  styles,
  thickness,
} from 'dynwinrt-jsx/winui'
```

Generated native classes still come from:

```ts
import {
  Button,
  StackPanel,
  TextBlock,
} from '#winapp/bindings'
```

These are real projected WinUI classes, not DOM elements.

## Checkpoint

Run:

```powershell
npm run build
npm start
```

The generated Counter should open, increment, and close without editing
renderer or Worker lifecycle code.

Next: [Build the reactive model](02-reactive-model.md).
