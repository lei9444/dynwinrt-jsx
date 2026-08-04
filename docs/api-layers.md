# Progressive API layers

New applications should import from focused package entry points instead of
learning the complete compatibility root.

```tsx
import {
  ErrorBoundary,
  For,
  computed,
  signal,
} from 'dynwinrt-jsx/core'
import {
  createControls,
  showContentDialog,
} from 'dynwinrt-jsx/controls'
import {
  styles,
  thickness,
  tokens,
} from 'dynwinrt-jsx/winui'
```

`dynwinrt-jsx` continues to export the complete 1.0 surface for compatibility.
The focused entry points are additive and do not require an immediate
migration.

The project creator supports two starting points:

- `--template minimal` for a Counter and the production Host/Worker lifecycle;
- `--template dashboard` for routing, theme, diagnostics, and hot reload.

## Which entry point should I use?

| Entry point | Use it for | Runtime exports |
|---|---|---:|
| `dynwinrt-jsx/core` | Signals, control flow, Context, routing, async work, JSX types | 39 |
| `dynwinrt-jsx/controls` | Typed control factories, navigation, lists, dialogs, overlays, focus | 26 |
| `dynwinrt-jsx/winui` | Renderer preset, WinUI values, resources, themes, tokens, styles | 21 |
| `dynwinrt-jsx/diagnostics` | Structured diagnostics, evidence, inspector types | 22 |
| `dynwinrt-jsx/native` | Raw renderer, adapters, projected ownership, Composition | 20 |
| `dynwinrt-jsx/host` | Main-process bootstrap, persistence, Worker ownership | advanced |
| `dynwinrt-jsx/worker` | WinUI STA application and Window lifecycle | advanced |

The counts include escape hatches inside each layer. A normal screen generally
uses fewer than fifteen runtime APIs.

## Start with these APIs

### Reactive UI

- `signal`
- `computed`
- `batch`
- `For`
- `Show`
- `ErrorBoundary`

### Application structure

- `createContext`
- `createRouter`
- `RouterProvider`
- `Outlet`

### WinUI authoring

- `createControls`
- `createWinUIControls`
- `createNavigationViewControl`
- `showContentDialog`
- `thickness`
- `tokens`
- `styles`

Do not study the remaining exports before a task requires them.

## Escalation path

1. Build screens with `core`, `controls`, and `winui`.
2. Add `diagnostics` when the application needs evidence or an in-app
   diagnostics surface.
3. Use `native` only for a missing adapter, projected resource ownership,
   custom renderer configuration, or Composition work.
4. Let the generated template own `host` and `worker` imports. Change those
   files only for process-level behavior.

## Common import patterns

### A normal screen

```tsx
import {
  For,
  Show,
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
import * as WinUIBindings from '#winapp/bindings'

const UI = createWinUIControls(WinUIBindings)
```

### A routed application shell

```tsx
import {
  Outlet,
  RouterProvider,
  createRouter,
} from 'dynwinrt-jsx/core'
import {
  createNavigationViewControl,
  createRouterNavigationViewShell,
} from 'dynwinrt-jsx/controls'
```

### Diagnostics

```ts
import {
  createDiagnosticChannel,
  formatRendererDiagnostics,
} from 'dynwinrt-jsx/diagnostics'
```

### A deliberate native escape hatch

```ts
import {
  adapter,
  createNativeResourceOwner,
  native,
} from 'dynwinrt-jsx/native'
```

## Mental model

The focused entry points organize discovery; they do not create separate
runtimes. All layers share the same renderer, reactive graph, scopes, and
native ownership rules.

A function component still runs once per mount. Signals update the affected
native property or child range directly. Removing a subtree releases its
effects, subscriptions, refs, native events, and owned projected values.
