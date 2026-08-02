# dynwinrt-jsx

`dynwinrt-jsx` 1.0 is a type-safe declarative UI runtime for building native WinUI 3 apps with standard TypeScript TSX. It wraps dynwinrt-generated classes: rendered elements are real WinUI controls, with no browser or React runtime.

Components use React-like composition and Solid-style fine-grained signals. A component runs once when mounted; signals update only the affected native properties or child ranges.

Documentation:

- [Capability matrix](docs/capabilities.md)
- [Public API index](docs/api-index.md)
- [Validation guide](docs/validation.md)
- [Async actions](docs/recipes/async-actions.md)
- [Startup and event coalescing](docs/recipes/startup-and-events.md)
- [Native resource ownership](docs/recipes/native-resources.md)

```tsx
import {
  computed,
  createControls,
  createWinUIRendererPreset,
  signal,
} from 'dynwinrt-jsx'
import * as bindings from './.winapp/bindings/index.js'

const UI = createControls({
  Button: bindings.Button,
  StackPanel: bindings.StackPanel,
  TextBlock: bindings.TextBlock,
})
const renderer = createWinUIRendererPreset(bindings).createRenderer()

function Counter() {
  const count = signal(0)
  return (
    <UI.StackPanel spacing={12}>
      <UI.TextBlock
        text={computed(() => `Count: ${count.value}`)}
      />
      <UI.Button onClick={() => count.value += 1}>
        Increment
      </UI.Button>
    </UI.StackPanel>
  )
}
```

## Create an app

Dependencies in the generated project use exact versions; the command does not resolve npm `latest`.

```powershell
npx dynwinrt-jsx@1.0.0 create my-winui-app
cd my-winui-app
npm install
npm run setup
npm start
```

Release validation packs those exact versions into a local artifact set, then
creates the application through the packaged CLI in normal mode:

```powershell
npm run validate:release
```

The smoke uses an isolated npm cache and verifies that the generated manifest
retains exact registry-style versions instead of sibling `file:` dependencies.

Use development hot reload after setup:

```powershell
npm run dev
```

Run the repository's real WinUI in-process verification tier:

```powershell
.\scripts\run-native-selftest.ps1
```

The runner compiles the framework and dashboard, executes native property,
effect, DispatcherQueue event, keyed identity, ErrorBoundary, automation,
focus, and cleanup assertions, then runs an intentional Worker startup failure.
It writes structured evidence to
`examples\dashboard\.winapp\native-selftest\summary.json`.

Run the reversible accessibility settings matrix:

```powershell
.\scripts\run-accessibility-matrix.ps1 -IncludeUIA
```

This temporarily enables High Contrast, applies 150% text scale, and disables
animations. Original user settings are restored in `finally`. See
[`docs/accessibility-verification.md`](docs/accessibility-verification.md) for
the automated evidence and manual Narrator checklist.

Run the cross-framework WinUI StockGrid benchmark against direct C# WinUI and
Microsoft.UI.Reactor:

```powershell
.\benchmarks\winui-comparison\run-comparison.ps1 `
  -ReactorRoot ..\microsoft-ui-reactor `
  -Percents 0,50,100 `
  -Duration 10 `
  -Warmup 2 `
  -Reps 12
```

See [`benchmarks/winui-comparison/README.md`](benchmarks/winui-comparison/README.md)
for environment controls, optional ETW Present tracing, and result semantics.

The generated app keeps its Window, Worker, and model state alive while
reloading `src/app.tsx`. Changes to the Worker, model, generated bindings, or
native runtime require a restart.

The main process also persists model state atomically. By default generated apps
write under `%LOCALAPPDATA%\dynwinrt-jsx\<project>\state.json`; override the
location with `DYNWINRT_JSX_STATE_PATH`. Invalid JSON or schema data is renamed
to a timestamped `.corrupt-*` file, the default state is restored, and the
recovery error remains visible in Diagnostics.

Renderer heartbeat timeout evidence includes a compact suspected component,
last operation, hot-operation counts, and the recent operation tail before the
full inspector snapshot.

Main-process hosts can import bridge, persistence, and diagnostics APIs from
`dynwinrt-jsx/host` without loading renderer or WinUI authoring modules:

```js
const {
  createMessageTransport,
  createStateBridge,
  createJsonStateStore,
} = require('dynwinrt-jsx/host')
```

`defineWinUIHost()` is the preferred main-process host. It owns Windows App
SDK bootstrap, the Worker and transferred state port, atomic persistence,
standard Worker diagnostics, optional file hot reload, and exit cleanup:

```js
const { defineWinUIHost } = require('dynwinrt-jsx/host')

const host = defineWinUIHost({
  rootDirectory: __dirname,
  state: {
    defaultState: createDefaultPersistedAppState,
    validate: isPersistedAppState,
    initialize: (loaded) => ({
      ...loaded.state,
      status: 'starting',
      persistenceError: loaded.error,
    }),
    persist: ({ version, count, updatedAt }) => ({
      version,
      count,
      updatedAt,
    }),
    isReady: (state) => state.status === 'running',
  },
  evidence: {
    heartbeat: true,
    inspector: true,
    diagnostics: true,
    final: {
      assertIdle: true,
    },
  },
})

host.run().then(
  (code) => {
    process.exitCode = code
  },
  (error) => {
    console.error(error)
    process.exitCode = 1
  },
)
```

Set `bootstrap: false` only when another host already initialized the Windows
App SDK. `workerData` can add application-specific transferred configuration;
the Host always owns `statePort`, `initialState`, and `hotStatePath`.
The evidence preset additionally injects `heartbeatEnabled`,
`heartbeatState`, `inspectorExportPath`, and `diagnosticsExportPath`; it
handles Worker heartbeat, inspector-export, diagnostics-export, timeout, and
final-evidence messages with atomic writes.

Worker entry points can reuse deterministic Window teardown and file-backed hot
reload without copying the lifecycle implementation:

```ts
import {
  createFileHotReloadController,
  defineWinUIApp,
  installWinUIWindowLifecycle,
  runWinUIWorkerApp,
} from 'dynwinrt-jsx/worker'
```

`defineWinUIApp()` is the preferred generated-binding host:

```ts
const app = defineWinUIApp({
  bindings: WinUIBindings,
  initializeRuntime() {
    roInitialize(0)
  },
  configureWindow({ window }) {
    window.title = 'My WinUI app'
  },
  mount({
    bindings,
    renderer,
    window,
    createProjectedOwner,
    ownProjected,
    createProjected,
  }) {
    window.systemBackdrop = new bindings.MicaBackdrop()
    return {
      child: renderApp({
        renderer,
        window,
        createProjectedOwner,
        ownProjected,
        createProjected,
      }),
    }
  },
  onError: reportWorkerError,
})

void app.run()
```

For the standard Node Worker entry, create one
`createWinUIWorkerRuntime()` session. It reads Host worker data, owns the state
bridge, resolves hot modules from the application root, forwards standard
messages, manages heartbeat/Host shared state, and closes the state port:

```ts
const runtime = createWinUIWorkerRuntime<AppState>({
  channel: 'app-state',
  moduleId: './dist/app.js',
})

const app = defineWinUIApp({
  bindings: WinUIBindings,
  mount({ renderer, window }) {
    const model = createAppModel(
      runtime.bridge,
      runtime.workerData.initialState,
    )
    return {
      child: runtime.loadModule<AppModule>().renderApp({
        model,
        renderer,
        window,
      }),
      beforeClose() {
        runtime.bridge.set(model.snapshot('closed'))
      },
      disposeAfterRender: model.dispose,
      afterRender({ renderHandle }) {
        return runtime.createRenderedHooks({
          dispatcherQueue: window.dispatcherQueue,
          renderer,
          renderHandle,
          load: () =>
            runtime.loadModule<AppModule>(true)
              .renderApp({ model, renderer, window }),
        })
      },
    }
  },
  ...runtime.appCallbacks,
})

void runtime.run(app)
```

`createWinUICleanup()` and `createWinUIAsyncCleanup()` compose owned services.
Successful actions run once; failed actions remain retryable; all remaining
actions still run before the first or aggregate error is reported. The Window
lifecycle cancels the initial close while asynchronous cleanup runs and only
re-closes after it succeeds.

The binding namespace must provide generated `Application.startScheduled()`,
`Window`, `createProjectedLifetimeScope()`, and `releaseProjected()`.
The host creates the WinUI renderer preset, forces renderer-owned native
release through `releaseProjected`, creates the Window and projection scope,
installs deterministic close handling, and returns `Promise<number>` after the
application exits. The app definition is one-shot and exposes detected renderer
capabilities. Configure, mount, close, post-render, and post-activation hooks
remain available through typed contexts containing the binding namespace,
release function, renderer, Window, AppWindow, and optional diagnostic channel.
`runWinUIWorkerApp()` remains the lower-level escape hatch for custom renderer,
Window, or projection ownership.

The Worker caches `Application.current`, `Window`, and `AppWindow` before the
projection scope is created, then releases those root wrappers from
`Window.Closed` after ordinary renderer/projection teardown.
Mounted applications can return `beforeCloseAsync()` for process-owned
asynchronous cleanup. The lifecycle cancels the initial close, awaits the hook
while native projections are still alive, performs ordinary synchronous
renderer and projection teardown, then closes the Window.

For sibling source repositories under one work directory:

```powershell
node C:\path\to\dynwinrt-jsx\bin\create.js create my-winui-app `
  --local-root C:\path\to\work
```

Local mode writes `file:` dependencies and builds the local Rust code generator during `npm run setup`.

See the [application readiness roadmap](docs/application-readiness-roadmap.md)
for the staged path from the current 1.0 runtime to a supported application and
an independently consumable framework.

## 1.0 features

- Standard TypeScript automatic JSX runtime and fragments
- Typed native properties and events inferred from generated dynwinrt classes
- Deterministic signals, computed values, effects, batching, roots, and scoped cleanup
- Function components, refs, `onMount()`, and `onCleanup()`
- Context providers scoped to native subtrees
- Signal-native nested routing with owned outlets and in-memory history
- `Show`, stable keyed `For`, fixed-height `VirtualFor`, and native
  `ItemsRepeater`/`ItemsView` virtualization
- `ErrorBoundary` for mount and reactive update failures
- `Portal` for rendering into another native host
- Signal-backed event handlers and one/two-way binding props
- WinUI resources, attached properties, nullable Boolean boxing, and value helpers
- Typed theme resources with effective-element resolution and scoped overrides
- Typed design tokens, signal-backed style recipes, and centralized theme transitions
- Whole-root hot refresh and explicit `RenderHandle.update()`
- Revisioned host/client state bridge for Worker and `MessagePort` endpoints
- Native lifecycle diagnostics and deterministic disposal
- Dependency-free WinUI project scaffolding

## TypeScript configuration

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "dynwinrt-jsx",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true
  }
}
```

The library has no direct runtime dependency on dynwinrt. Applications provide generated classes to `createControls()` and `createWinUIRenderer()`.

## Source layout

The root of `src/` contains only package entry points. Implementation modules
are grouped by responsibility:

| Directory | Responsibility |
|---|---|
| `src/core/` | Signals, VNodes, Context, control flow, and bindings |
| `src/renderer/` | Native mounting, adapters, lifecycle, hot replacement, and inspection |
| `src/winui/` | WinUI controls, values, resources, themes, and styling |
| `src/runtime/` | State bridge, persistence, diagnostics, and heartbeat |

## Core API

### Native controls

```tsx
const UI = createControls({
  Border,
  Button,
  StackPanel,
  TextBlock,
})
```

Use `adapter.collectionSlotFrom()` when the generated property exposes an
observable or read-only interface but a mutable collection view is available.
The getter is resolved again for every synchronization so controls can replace
their projected collection view after loading.
Use `adapter.selfCollection()` when the projected object is itself the native
collection, such as `SwipeItems`.

Writable generated properties become JSX properties. Generated `onX(callback)` methods become typed event properties. Use `native()` when a class needs custom construction.

Primitive children become native `TextBlock` instances. Primitive `content`, `header`, `onContent`, and `offContent` values are also converted to `TextBlock`; Boolean `isChecked` values on nullable ToggleButton-family controls are boxed as `IReference<Boolean>` when the required generated bindings are supplied. Nullable `CalendarDatePicker.date`, `DatePicker.selectedDate`, and `TimePicker.selectedTime` values are likewise boxed as their generated `IReference<DateTime>` or `IReference<TimeSpan>` projections. Controls with non-nullable properties continue to receive their native struct or primitive value directly.

```tsx
<UI.ToggleSwitch header="Dark theme" isOn={darkTheme} />
<UI.CheckBox isChecked={isComplete} />
```

Use `thickness()`, `cornerRadius()`, and `color()` for common WinUI value structs.

### Native adapters

Use `native()` adapters for generated controls whose authoring shape is not a
direct writable property. The descriptor vocabulary covers one-way,
initial-only, controlled, coercing, reference, transactional collection, named
slot, and default-child behavior:

```tsx
const CommandSurface = native<
  CommandBar,
  { commands?: MaybeSignal<readonly object[]> }
>(CommandBar, {
  adapters: {
    commands: adapter.collection({
      get: (instance) =>
        instance.primaryCommands.asVector(),
      label: 'CommandBar primaryCommands',
    }),
  },
  children: adapter.slot('content'),
})
```

Ordinary generated properties still use direct assignment. Collection
adapters validate the complete array and roll back failed native replacement;
slot adapters own and dispose the JSX subtree they mount.

Property adapters run before children by default. Use `adapter.withPhase()` when
a native property depends on mounted slots, items, or the completed native
record:

```ts
const SelectedControl = native(Selector, {
  adapters: {
    selectedIndex: adapter.withPhase(
      adapter.controlled(/* native read/write subscription */),
      'afterChildren',
    ),
  },
})
```

The available phases are `beforeChildren`, `afterChildren`, and `afterMount`.
Initial event handlers are connected after `afterChildren` properties so
programmatic mount writes do not appear as user events.

Controlled adapters subscribe to native readback, suppress programmatic change
echoes, and forward only genuine user changes:

```ts
const ControlledSlider = native(Slider, {
  adapters: {
    value: adapter.controlled(
      {
        changeProperty: 'onValueChange',
        read: (slider) => slider.value,
        write: (slider, value) => {
          slider.value = value as number
        },
        subscribe: (slider, changed) =>
          slider.onValueChanged(changed),
        echo: 'synchronous',
      },
      (value) => Number(value),
    ),
  },
})
```

Echo modes are `synchronous`, `deferred`, and `setterScope`. Controlled
descriptors may provide `equals`, `maxPendingWrites`, and a transactional
`rollback` callback for partial native writes. Rollback requires
`synchronous` or `setterScope` echo mode because a failed deferred write cannot
reliably distinguish its queued echo from the rollback echo.

The model remains authoritative after a genuine native change. If the change
callback leaves the source signal unchanged, the renderer reapplies the latest
resolved and coerced model value after the current reactive flush, without
leaking another change callback. This lets collection and property effects
settle before a rejected native value is restored.
`setterScope` suppresses every callback raised inside the setter, including
native coercion readback; coerce the model value first when the model must
exactly match the native result.

### WinUI object values

Create object-valued properties from the generated constructors inside the
WinUI application callback:

```tsx
const logoUri = createUri(Uri, 'ms-appx:///Assets/Logo.png')
const logo = createBitmapImage(BitmapImage, logoUri, {
  decodePixelWidth: 64,
})
const accent = createSolidColorBrush(
  SolidColorBrush,
  color(0, 120, 212),
)

<UI.Image source={logo} />
<UI.TextBlock foreground={accent} fontFamily={
  createFontFamily(FontFamily, 'Segoe UI Variable Text')
} />
```

`BitmapImage` is the constructible `ImageSource` implementation.
`createBitmapIcon()` accepts the same generated `Uri` object. For other
nullable WinRT value types, combine `createReferenceBoxing()` with the matching
`PropertyValue.createX` and generated `IReference_X` binding, then call
`boxNullable()`.

### Theme resources and scoped overrides

Use typed `theme` tokens for values that should follow Light, Dark, and High
Contrast modes:

```tsx
<UI.Border
  background={theme.cardBackground}
  borderBrush={theme.cardStroke}
>
  <UI.TextBlock foreground={theme.primaryText} text="Workspace" />
</UI.Border>
```

`theme.ref(key, fallback?)` is the string-key escape hatch. Theme references
resolve from the target element's nearest resource dictionaries, respect the
nearest explicit `requestedTheme`, and update from `ActualThemeChanged` and
High Contrast notifications. Use `resource()` for static resource lookup.

Override individual WinUI control resources without replacing the native
template:

```tsx
<UI.Button
  resourceOverrides={{
    ButtonBackground: theme.accent,
    ButtonBackgroundPointerOver: theme.accentSecondary,
    ButtonBackgroundPressed: theme.accentTertiary,
    ButtonForeground: theme.textOnAccent,
  }}
>
  Save
</UI.Button>
```

Overrides update transactionally, preserve existing local values, and restore
them when the owning JSX scope is disposed. Prefer theme references inside
overrides; literal brushes do not adapt to High Contrast automatically.

### Design tokens and style recipes

Use `tokens` for shared spacing, typography, radius, and elevation values:

```tsx
<UI.StackPanel
  padding={thickness(tokens.spacing.xl)}
  spacing={tokens.spacing.lg}
>
  <UI.TextBlock
    {...styles.heading({ level: 'title' })}
    text="Workspace"
  />
</UI.StackPanel>
```

`tokens.elevation` contains typed Z-translation values. Pair them with an
explicit native `Shadow` when a visible shadow is required; recipes do not
create projected shadow objects at module initialization.

Built-in recipes return normal JSX property bags:

```tsx
<UI.Border {...styles.card({ surface: 'layer' })}>
  <UI.Button {...styles.button({ variant: 'accent' })}>
    Save
  </UI.Button>
</UI.Border>
```

Variant selections can be signals. The affected native properties update
without remounting the component:

```tsx
const tone = signal<'attention' | 'success'>('attention')

<UI.Border {...styles.status({ tone })}>
  <UI.TextBlock text="Build status" />
</UI.Border>
```

Create application-specific recipes with `createStyleRecipe()`. Every property
changed by a variant must have a base value so signal-driven variant changes
can reset it deterministically.

Use `createWinUIThemeController()` to keep application, subtree, and title-bar
themes synchronized from one state signal:

```ts
const controller = createWinUIThemeController({
  isDark: model.darkTheme,
  setDark: model.setDarkTheme,
  application: Application.current,
  applicationTheme: ApplicationTheme,
  elementTheme: ElementTheme,
  titleBar: window.appWindow.titleBar,
  titleBarTheme: TitleBarTheme,
})
```

Bind `controller.requestedTheme` to the application-shell element and dispose
the controller with its owning component.

### Grid definitions

Create a specialized Grid component when an application needs declarative row
or column definitions:

```tsx
const LayoutGrid = createGridControl({
  Grid: bindings.Grid,
  RowDefinition: bindings.RowDefinition,
  ColumnDefinition: bindings.ColumnDefinition,
})

<LayoutGrid
  rowDefinitions={[
    gridLength.auto(),
    { size: gridLength.star(), min: 120 },
  ]}
  columnDefinitions={[
    gridLength.pixel(240),
    gridLength.star(2),
  ]}
  columnSpacing={12}
>
  <UI.TextBlock gridRow={1} gridColumn={1} text="Workspace" />
</LayoutGrid>
```

Add `RowDefinition` and `ColumnDefinition` from
`Microsoft.UI.Xaml.Controls` to the application's
`winapp.jsBindings.additionalWinmds`. Use a codegen/runtime pair that supports
parameterized collection interfaces.

Definition arrays may be signals. A changed array reference validates and
creates the complete new definition set before transactionally replacing the
native collections. Native `RowDefinition` and `ColumnDefinition` instances are
accepted as escape hatches. Grid track strings are intentionally not parsed.

### Application shell adapters

Use `createNavigationViewControl()` for the native `menuItems` and
`footerMenuItems` collections:

```tsx
const Navigation = createNavigationViewControl({
  NavigationView: bindings.NavigationView,
})

const home = createNavigationItem(
  {
    NavigationViewItem: bindings.NavigationViewItem,
    TextBlock: bindings.TextBlock,
    AutomationProperties: bindings.AutomationProperties,
  },
  {
    name: 'home',
    label: 'Home',
    icon: createSymbolIcon(bindings.SymbolIcon, bindings.Symbol.Home),
    automationId: 'HomeNavItem',
  },
)

<Navigation menuItems={[home]}>
  <HomePage />
</Navigation>
```

Collection changes validate before mutation and roll back if a native append
fails. `createFocusTarget()` combines a native ref with typed `focus()` calls.

When a native `SelectionChanged` event replaces the current page, use
`createNavigationHost()` instead of binding `selectedItem` and content directly
to the same route signal. The host suppresses programmatic selection feedback,
coalesces rapid native selections, disposes the old page in one queued turn,
and mounts only the latest route in a later turn:

```tsx
const navigationHost = createNavigationHost({
  route: model.route,
  navigate: (route) => model.navigate(route),
  enqueue: (callback) =>
    window.dispatcherQueue.tryEnqueue(
      DispatcherQueuePriority.Low,
      callback,
    ),
  selectRoute(route) {
    const item = routeItems.get(route)
    if (navigation.current && item) {
      navigation.current.selectedItem = item
    }
  },
})
onCleanup(navigationHost.dispose)

<Navigation
  ref={(value) => {
    navigation.current = value
    if (value) {
      navigationHost.synchronizeSelection()
    }
  }}
  onSelectionChanged={(_sender, args) => {
    navigationHost.requestNativeNavigation(
      args.selectedItemContainer.name as AppRoute,
    )
  }}
>
  {navigationHost.render((route) => renderRoute(route))}
</Navigation>
```

The supplied `enqueue` function must defer work to a later native dispatcher
turn; a microtask does not cross the active WinUI selection/layout transaction.
Queue rejection throws and leaves the controller retryable. `render()` creates
the single owned route outlet and deactivates the host before the current page
is disposed during whole-shell teardown. Keep `onCleanup(navigationHost.dispose)`
as an idempotent fallback if mounting fails before the outlet is attached.

For application routing, prefer `createRouter()` with `RouterProvider` and
`Outlet`. Routes are matched by stable IDs and path patterns; nested layouts
remain mounted while only the changed outlet subtree is disposed:

```tsx
const router = createRouter({
  routes: [
    {
      id: 'root',
      path: '/',
      render: () => <AppLayout />,
      children: [
        {
          id: 'home',
          index: true,
          render: () => <HomePage />,
        },
        {
          id: 'task',
          path: 'tasks/:taskId',
          render: () => <TaskPage />,
        },
      ],
    },
  ],
})
onCleanup(router.dispose)

function AppLayout() {
  return (
    <UI.Grid>
      <AppNavigation />
      <Outlet />
    </UI.Grid>
  )
}

function TaskPage() {
  const params = useRouteParams()
  const query = useRouteQuery()
  return (
    <UI.TextBlock
      text={computed(() =>
        `Task ${params.value.taskId}; tab ${String(query.value.tab)}`,
      )}
    />
  )
}

<RouterProvider router={router}>
  <Outlet />
</RouterProvider>
```

`navigate()`, `replace()`, `back()`, `forward()`, and `go()` update an in-memory
history. Targets can be path strings or `{ routeId, params, query, hash }`
objects, and `pathFor()` generates a path from a route ID. Location, params,
query, state, matches, route ID, and history are readonly signals. Changing
params, query, or state for the same route updates those signals without
remounting the route component; changing a route ID releases the old native
subtree and reactive scope exactly once.

Use `defineRouteRegistry()` when route IDs and paths are known statically. IDs
are inferred from object keys and `:params`/`*` are inferred from each path:

```ts
const routes = defineRouteRegistry({
  home: {
    path: '/',
    render: () => <HomePage />,
  },
  task: {
    path: '/tasks/:taskId',
    parentId: 'home',
    navigationId: 'tasks',
    render: () => <TaskPage />,
  },
})
const router = createRouter({ routes: routes.routes })

router.navigate(routes.target('task', {
  params: { taskId: 42 },
  query: { tab: 'activity' },
}))
```

Parameterized registry targets require their inferred params at compile time.
`parentId` enables `router.up()`: it returns to a matching previous parent
entry or replaces the current entry with the logical parent. `navigationId`
lets parameterized/detail routes keep a stable NavigationView selection.

Use `createRouterNavigationViewShell()` for the normal native
`NavigationView` path. It creates menu/footer items from route metadata, owns
route-item maps, synchronizes native selection, expands parent groups for
detail routes, and retains separate DispatcherQueue turns for old-page
disposal and target mounting:

```tsx
const routeDefinitions = [{
  id: 'home',
  path: '/',
  handle: {
    navigation: {
      label: 'Home',
      order: 0,
      createIcon: () =>
        createSymbolIcon(SymbolIcon, Symbol.Home),
      automationId: 'HomeNavItem',
    },
  },
  render: () => <HomePage />,
}, {
  id: 'tasks',
  path: '/tasks',
  handle: {
    navigation: {
      label: 'Tasks',
      group: {
        id: 'work',
        label: 'Work',
        order: 10,
      },
    },
  },
  render: () => <TasksPage />,
}]
const router = createRouter({
  routes: routeDefinitions,
})
const navigationShell = createRouterNavigationViewShell({
  router,
  routes: routeDefinitions,
  bindings: {
    NavigationViewItem,
    TextBlock,
    AutomationProperties,
  },
  settingsRouteId: 'settings',
  preservePaneOpenOnSelection: true,
  createProjectedOwner,
  enqueue: (callback) =>
    window.dispatcherQueue.tryEnqueue(
      DispatcherQueuePriority.Low,
      callback,
    ),
  targetForRoute(routeId) {
    return routeId === 'tasks'
      ? routes.target('task', {
          params: { taskId: selectedTaskId.value },
        })
      : { routeId }
  },
})
onCleanup(navigationShell.dispose)

<Navigation
  ref={navigationShell.ref}
  menuItems={navigationShell.menuItems}
  footerMenuItems={navigationShell.footerMenuItems}
  onSelectionChanged={navigationShell.onSelectionChanged}
>
  <RouterProvider router={router}>
    {navigationShell.render(() => <Outlet />)}
  </RouterProvider>
</Navigation>
```

`handle.navigation` supports label, order, menu/footer placement, automation
metadata, icon factories, and virtual groups for routes that do not share a
structural parent. Routes without navigation metadata remain hidden.
`createRouterNavigationHost()` remains the lower-level bridge when native
items are created or selected by application-specific policy. The shell uses
the app-bound `createProjectedOwner` (or a raw `releaseProjected` fallback) to
retry-release every item, label, and icon factory result it creates.

The router is not React Router and does not use browser history. Route render
functions mount once per matched route identity; application changes flow
through signals. Transition diagnostics contain stable route IDs and reason
codes, not path parameters or query values.

The generated template, Dashboard, and Gallery use the high-level shell.
Gallery generates its category/item definitions from page metadata and builds
the root route tree from `pages/*/routes.tsx`; each category folder owns its
category fallback and sample child routes. The persisted route remains the
hot-reload seed, and structural parents plus `up()` provide generic
sample-to-category back navigation instead of category-specific branches.

Use one application-scoped `createSecondaryWindowManager()` when pages create
additional XAML `Window` or raw `AppWindow` instances. Each page owns a scope,
so route replacement closes only that page's windows while application shutdown
can close every remaining scope before renderer and projection teardown:

```tsx
const secondaryWindows = createSecondaryWindowManager<
  bindings.Window,
  bindings.AppWindow
>({
  renderer,
  createWindow() {
    const window = new bindings.Window()
    window.systemBackdrop = new bindings.MicaBackdrop()
    return window
  },
})

const pageWindows = secondaryWindows.createScope()
onCleanup(pageWindows.dispose)

pageWindows.openXamlWindow({
  title: 'Child window',
  content: (window) => (
    <UI.Button onClick={() => window.close()}>
      Close
    </UI.Button>
  ),
  onClosing(_window, args) {
    args.cancel = hasUnsavedWork.value
  },
})

pageWindows.openAppWindow({
  create: () => bindings.AppWindow.create(
    presenter,
    ownerWindowId,
    dispatcherQueue,
  ),
  title: 'Modal tool',
  width: 420,
  height: 260,
})
```

Scopes override application close cancellation only during forced teardown,
dispose XAML render handles before native destruction, retry failed render or
subscription cleanup, and fall back to `AppWindow.destroy()` when a later
handler cancels a forced XAML close. Call
`secondaryWindows.disposeAsync(enqueue)` from `beforeCloseAsync()` so forced
child teardown runs after the main window's active Closing callback. The call
is idempotent after successful shutdown and remains retryable after failure.

Use `Capability<T>` for prerequisites that may be absent because of package
identity, registration, permissions, hardware/services, or the current host:

```ts
const camera = device
  ? capabilityAvailable(device, { source: 'hardware' })
  : capabilityUnavailable(
      'No camera device is available.',
      { source: 'hardware' },
    )

if (camera.available) {
  startPreview(camera.value)
}
else {
  showUnavailable(camera.reason)
}
```

Available values contain `value`; unavailable values always contain a
non-empty `reason`. Optional `details` are preserved by `mapCapability()`.
These plain values are exported from both `dynwinrt-jsx` and
`dynwinrt-jsx/host`, so serializable values can cross a Worker boundary.

Use `createCapabilityOwner()` when an available capability also owns a local
resource:

```ts
const island = createCapabilityOwner(
  capabilityAvailable(resources),
  (value) => releaseContentIsland(value),
)
onCleanup(island.dispose)
```

The owner is idempotent after success. If cleanup throws, `disposed` remains
false and a later `dispose()` retries the same resource. Cleanup must be
synchronous; Promise-returning callbacks are rejected.

For a projected object that is already available, use
`createProjectedValueOwner()` directly. `ownProjectedValue()` additionally
registers disposal with the current component scope:

```ts
const brush = ownProjectedValue(
  new SolidColorBrush(),
  releaseProjected,
)
```

Manual projected owners are idempotent after success and remain retryable when
release throws. Release callbacks must be synchronous.

`defineWinUIApp()` binds these operations to the generated
`releaseProjected()` function. Pass `createProjectedOwner`, `ownProjected`, and
`createProjected` from its context into application components:

```ts
function Page(context: AppContext) {
  const brush = context.createProjected(
    () => new SolidColorBrush(),
  )
  return <UI.Border background={brush} />
}
```

`ownProjected()` and `createProjected()` register with the current component
or effect scope. Calling them outside a reactive scope releases the new value
before reporting the scope error. Use `createProjectedOwner()` for manual,
retryable ordering.

Use `createListViewControl()` when JSX children should populate native
`items`, with owned `header` and `footer` slots:

```tsx
const Tasks = createListViewControl({
  ListView,
  selectedIndexProperty: Selector.selectedIndexProperty,
})
const selectedIndex = signal(-1)

<Tasks
  selectedIndex={selectedIndex}
  onSelectedIndexChange={(index) => {
    selectedIndex.value = index
  }}
  header={<UI.TextBlock text="Sprint tasks" />}
>
  <For each={tasks} key={(task) => task.id}>
    {(task) => <UI.ListViewItem content={task.title} />}
  </For>
</Tasks>
```

Items and named slots mount before the initial controlled `selectedIndex` is
applied. Programmatic selection writes suppress their matching native change.
Supplying `Selector.selectedIndexProperty` uses a dependency-property callback,
which avoids relying on generic WinRT event-delegate projection. Raw
`onSelectionChanged` remains available when that projected event is usable.
`createListViewScrollTarget()` provides a typed
`scrollIntoView()` ref; use `createFocusTarget()` for focus.

Use `createComboBoxControl()` for owned item/header content and controlled
selection:

```tsx
const Priority = createComboBoxControl({
  ComboBox,
  selectedIndexProperty: Selector.selectedIndexProperty,
})
const priority = signal(0)

<Priority
  selectedIndex={priority}
  onSelectedIndexChange={(index) => {
    priority.value = index
  }}
  header={<UI.TextBlock text="Priority" />}
  placeholderText="Choose priority"
>
  <UI.TextBlock text="Low" />
  <UI.TextBlock text="High" />
</Priority>
```

The adapter mounts items before applying the initial selection and restores a
rejected native selection after the current reactive flush. The specialized
control intentionally supports controlled `selectedIndex` only because generic
`selectedItem` readback does not preserve projected JavaScript identity. Use a
raw native ComboBox or its ref when `selectedItem` is required. Raw
`onSelectionChanged`, `onDropDownOpened`, and `onDropDownClosed` remain
available.

Use `createPivotControl()` when a Pivot's selected index is Signal-owned:

```tsx
const MailPivot = createPivotControl({
  Pivot,
  selectedIndexProperty: Pivot.selectedIndexProperty,
})

<MailPivot
  selectedIndex={section}
  onSelectedIndexChange={(index) => {
    section.value = index
  }}
>
  <UI.PivotItem header="All">...</UI.PivotItem>
  <UI.PivotItem header="Unread">...</UI.PivotItem>
</MailPivot>
```

The property-changed subscription is released with the native scope, avoiding
late `SelectionChanged` writes while Pivot removes its item containers during
window teardown. Raw Pivot events and refs remain available.

Use `createSelectorBarControl()` for owned native `SelectorBarItem` children
and index-based controlled selection:

```tsx
const FilterBar = createSelectorBarControl({
  SelectorBar,
})
const selectedSection = signal(0)

<FilterBar
  selectedIndex={selectedSection}
  onSelectedIndexChange={(index) => {
    selectedSection.value = index
  }}
>
  <UI.SelectorBarItem text="Recent" />
  <UI.SelectorBarItem text="Favorites" />
</FilterBar>
```

The adapter maps `selectedIndex` to the identity of the corresponding native
item after children mount. Raw `onSelectionChanged` remains available;
`selectedItem` stays an escape hatch on the raw projected control.

Use `createScrollViewerController()` as a native ref when navigation controls
need reactive offsets and boundary state:

```tsx
const scroller = createScrollViewerController<ScrollViewer>()

<UI.ScrollViewer ref={scroller}>
  {content}
</UI.ScrollViewer>
<UI.Button
  isEnabled={scroller.canScrollForward}
  onClick={() =>
    scroller.scrollHorizontalByViewport(1)
  }
/>
```

The controller tracks ViewChanged, SizeChanged, Loaded, and LayoutUpdated,
clamps offset writes, uses `ChangeView`, and releases subscriptions when its
ref is cleared.

High-frequency views can publish at most once per composition frame:

```tsx
const scheduleFrame =
  createCompositionFrameScheduler(CompositionTarget)
const scroller =
  createScrollViewerController<ScrollViewer>({
    sampling: 'frame',
    scheduleFrame,
  })
```

`sampling: 'immediate'` is the default. `sampling: 'native'` installs no
ViewChanged/layout subscriptions; call `refresh()` when JavaScript needs a
snapshot. The same scheduler supports last-value-per-frame native events:

```tsx
const pointerMoved = createScopedLastValueCoalescer(
  scheduleFrame,
  (args: PointerRoutedEventArgs) => {
    latestPointer.value = args
  },
)

<UI.Canvas
  onPointerMoved={(_sender, args) =>
    pointerMoved.push(args)
  }
/>
```

Use `createLastValueCoalescer()` outside a component-owned scope and dispose it
explicitly.

Common automation metadata is available directly on native JSX controls:

```tsx
<UI.TextBlock
  automationId="TaskInputLabel"
  automationHeadingLevel={1}
  text="New task"
/>
<UI.TextBox
  automationId="TaskInput"
  automationLabeledBy={labelSignal}
/>
```

Supported metadata includes name, help text, accelerator key, full description,
accessibility view, labeled-by, heading level, position/size in set, live
setting, dialog state, and automation control type.

Create a reusable renderer preset from the complete generated binding
namespace:

```ts
import * as WinUIBindings from '#winapp/bindings'

const winuiRenderer = createWinUIRendererPreset(WinUIBindings)
const renderer = winuiRenderer.createRenderer()
```

`winuiRenderer.capabilities` reports text, nullable Boolean, projected
collection, resource, Grid, Canvas, and Automation support. Passing the full
namespace automatically enables every generated capability. If a nullable
ToggleButton-family `isChecked`, primitive content/header/on/off content,
primitive child, or
projected collection is used without its required binding, the renderer names
the missing generated type instead of forwarding an invalid value to WinUI.

Register additional WinUI attached properties when an application generates
the owning type:

```tsx
const renderer = createWinUIRenderer(bindings, {
  attachedProperties: {
    dock: { owner: DockPanel, method: 'setDock' },
  },
})
```

When `ToolTipService` is present in the generated binding namespace, native
controls accept typed tooltip attached properties directly:

```tsx
<UI.Button
  toolTip="Save the current document"
  toolTipPlacement={PlacementMode.Top}
>
  Save
</UI.Button>
```

Primitive tooltip values are converted to native `TextBlock` content; pass a
projected `ToolTip` instance for offsets, placement, or custom content.

Canvas z-order, RelativePanel sibling/panel relationships, and
VariableSizedWrapGrid spans are also available as typed attached JSX props:

```tsx
<UI.Border canvasZIndex={2} />
<UI.Border
  relativePanelRightOf={anchor}
  relativePanelAlignTopWith={anchor}
/>
<UI.Border variableSizedWrapGridColumnSpan={2} />
```

Custom registrations require the named static setter. Add the matching prop to
a specialized `native<Instance, ExtraProps>()` component contract so TSX remains
strict.

Render dialog content with a renderer-owned scope:

```tsx
const result = await showContentDialog(
  renderer,
  dialog,
  window.content.xamlRoot,
  <UI.TextBlock text="Native dialog content" />,
  { restoreFocus: () => trigger.focus() },
)
```

The content is disposed from the native `Closed` event, even when Promise
continuations cannot run until the WinUI loop exits. Focus restoration is also
performed from that native event.

TeachingTip content can use the same signal-owned lifecycle:

```tsx
<UI.TeachingTip target={target} isOpen={tipOpen}>
  <Show when={tipOpen}>
    <UI.TextBlock text="Guidance" />
  </Show>
</UI.TeachingTip>
```

`createTeachingTip()` returns an `open(content)`/`close()` controller that
releases each content scope from the native close transition. Dispose active
controllers from the owning component or window cleanup. Pass an instance
already mounted in the owner's native tree, and use the generated
`isOpenProperty` when the projected generic `Closed` event is unavailable.

`showFlyout()`, `showMenuFlyout()`, and `showPopup()` own their rendered content
and release it when the native overlay closes or the returned controller is
disposed.

Pass a refresh signal as the third `resource()` argument when a runtime theme change should resolve the resource again:

```tsx
<UI.Border
  background={resource(
    'CardBackgroundFillColorDefaultBrush',
    fallbackBrush,
    darkTheme,
  )}
/>
```

Update the signal and WinUI application theme in one batch. This lets WinUI select the new theme before tracked resources resolve again:

```tsx
batch(() => {
  darkTheme.value = isDark
  Application.current.requestedTheme =
    isDark ? ApplicationTheme.Dark : ApplicationTheme.Light
})
```

### Reactivity and lifecycle

```tsx
const name = signal('WinUI')
const greeting = computed(() => `Hello, ${name.value}`)

effect(() => {
  console.log(greeting.value)
  return () => console.log('effect cleanup')
})

onMount(() => {
  console.log('native subtree mounted')
  return () => console.log('subtree disposed')
})
```

Computed observers flush before effects, so effects see a consistent graph. `createRoot()` creates an explicit lifetime outside a rendered component. Cleanup remains idempotent and continues through later cleanup callbacks if one throws.

### Context

```tsx
const Theme = createContext<'light' | 'dark'>('light')

function Status() {
  const theme = useContext(Theme)
  return <UI.TextBlock text={`Theme: ${theme}`} />
}

<Theme.Provider value="dark">
  <Status />
</Theme.Provider>
```

### Control flow

```tsx
<Show when={isReady} fallback={<UI.TextBlock text="Loading" />}>
  <UI.TextBlock text="Ready" />
</Show>

<For each={tasks} key={(task) => task.id}>
  {(task, index) => (
    <TaskRow task={task} index={index} />
  )}
</For>
```

Keyed entries retain their native control identity when moved. The item index is a `ReadonlySignal<number>` and updates without remounting the entry.

Use `createLazyComponent()` to keep synchronous modules outside the startup
path while preserving an independent component scope:

```tsx
const SettingsPage = createLazyComponent(
  () => (
    require('./settings') as
      typeof import('./settings')
  ).SettingsPage,
)

<SettingsPage context={context} />
```

The loader runs on the first component mount and caches only a successful
component result. Loading errors remain visible to the nearest
`ErrorBoundary`. The API is synchronous; it does not add Suspense or
Promise-based rendering.

Use `createAsyncAction()` for user-triggered asynchronous work:

```tsx
const pickFile = createAsyncAction(
  async (_input, { signal }) => {
    const picker = new FileOpenPicker(windowId)
    picker.fileTypeFilter.append('*')
    const file =
      await picker.pickSingleFileAsync(signal)
    return file?.path ?? 'Canceled'
  },
)

<UI.Button
  isEnabled={computed(() => !pickFile.pending.value)}
  onClick={() => pickFile.run()}
>
  Pick file
</UI.Button>

<AsyncView
  state={pickFile}
  pending={<UI.ProgressRing isActive />}
  error={(error) => (
    <UI.TextBlock text={String(error)} />
  )}
>
  {(path) => <UI.TextBlock text={path} />}
</AsyncView>
```

The default `drop` concurrency ignores duplicate runs while pending.
`concurrency: 'replace'` aborts the previous run. Actions created during
component mount are disposed with their reactive scope. Late results cannot
overwrite current state.

Recipe authors can register partially created resources with the operation
scope:

```ts
const capture = scope.closeable(new MediaCapture())
const session = scope.disposable(createSession(capture))
```

Operation-owned resources are released in reverse order on failure,
cancellation, stale completion, replacement, or component disposal.
Successful values remain owned by the action until they are replaced or the
action is disposed. `AsyncView` rethrows unrendered errors to the nearest
`ErrorBoundary`.

`VirtualFor` bounds the mounted range for large fixed-height collections:

```tsx
<VirtualFor
  each={rows}
  start={firstVisibleRow}
  count={visibleRowCount}
  itemSize={36}
  overscan={3}
  key={(row) => row.id}
  renderSpacer={(size) => <UI.Border height={size} />}
>
  {(row) => <Row value={row} />}
</VirtualFor>
```

The application updates `start` from its scroll position. Spacers preserve the full logical extent.

Use `createItemsRepeaterControl()` when WinUI should own realization,
measurement, and recycling for dynamic-height rows:

```tsx
const VirtualList = createItemsRepeaterControl({
  ItemsRepeater,
  ContentControl,
  IElementFactory,
  IObservableVector_Object,
  PropertyValue,
  IReference_Int32,
})
const layout = new StackLayout()
layout.spacing = 8

<UI.ScrollViewer height={400}>
  <VirtualList
    each={rows}
    key={(row) => row.id}
    layout={layout}
    verticalCacheLength={0.5}
  >
    {(row, index) => (
      <Row value={row} index={index} />
    )}
  </VirtualList>
</UI.ScrollViewer>
```

`ItemsRepeater` does not provide its own scrolling surface. Its factory keeps
the native working set bounded, preserves the item scope when a stable key
moves, resets the scope when the keyed item identity changes, and releases
pooled entries with the owning renderer. Source updates mutate the projected
observable vector in place with keyed insert/remove operations, so the native
ItemsSource identity remains stable.

Use `createVirtualizedItemsControl()` for controls such as `ItemsView` that
share the `ItemsSource` plus `IElementFactory` protocol but require a different
native item container:

```tsx
const mountHosts = new WeakMap<ItemContainer, ContentControl>()
const Items = createVirtualizedItemsControl({
  Control: ItemsView,
  ItemHost: ItemContainer,
  initializeItemHost(host) {
    const mountHost = new ContentControl()
    host.child = mountHost
    mountHosts.set(host, mountHost)
  },
  getItemMountHost(host) {
    const mountHost = mountHosts.get(host)
    if (!mountHost) {
      throw new Error('ItemsView mount host is missing.')
    }
    return mountHost
  },
  clearItemsSource(instance) {
    instance.itemsSource = null
  },
  IElementFactory,
  IObservableVector_Object,
  PropertyValue,
  IReference_Int32,
}, {
  displayName: 'ItemsView',
})
```

The optional persistent mount host keeps renderer-owned JSX content separate
from a native outer item container that must remain intact while the control
recycles or releases it. `clearItemsSource` can preserve control-specific
cleanup semantics without changing `ItemsRepeater` behavior.

### Error boundaries and portals

```tsx
<ErrorBoundary
  reset={retryToken}
  fallback={(error, context) => (
    <UI.TextBlock text={`${context.phase}: ${String(error)}`} />
  )}
>
  <Workspace />
</ErrorBoundary>

<Portal mount={overlayHost}>
  <Notification />
</Portal>
```

Changing the optional `reset` signal remounts an error boundary's primary subtree. A portal target must support one of the normal native child shapes.

### Binding props

Binding helpers return props intended for JSX spread:

```tsx
const name = signal('')

<UI.TextBlock {...bind.oneWay(name, 'text')} />
<UI.TextBox
  {...bind.twoWay(name, 'text', 'onTextChanged')}
/>
```

Use the optional fourth `twoWay()` argument when an event sender needs custom value projection.
For projected reference types that need domain-specific identity, pass an optional fifth equality callback; it distinguishes delayed programmatic echoes from user changes.

### Worker state bridge

```ts
const bridge = createStateBridge(
  createMessageTransport(messagePort),
  {
    role: 'client',
    channel: 'app-state',
    initial: { count: 0 },
  },
)

await bridge.ready
bridge.update((state) => ({ ...state, count: state.count + 1 }))
```

The host is authoritative and assigns monotonically increasing revisions. Client writes are optimistic and then replaced by the host response. Both creation orders are supported: clients request state and hosts publish their initial state. State is transferred as a complete structured-clone value, not as patches.

### Rendering and hot refresh

`renderer.render()` returns a handle with `update()`, `dispose()`, `disposed`, `roots`, and `container`. `createHotRoot()` calls the supplied render function again and replaces the root tree on `refresh()`.

If native child detachment fails, `dispose()` throws while the handle remains
undisposed and reports the retained native roots. Do not call `update()` in
this state; correct the native failure and retry `dispose()`.

`createHotReloadSession()` adds monotonic version handling, stale reload
rejection, and error fallback rendering. The generated app polls a version file
from a `DispatcherQueueTimer`, so reload work executes on the WinUI STA while
the main process and host-owned state remain alive.

Renderer diagnostics expose active native/component counts and cumulative keyed-entry creation/reuse counts for leak checks.

Every renderer also exposes a structured runtime inspector:

```ts
const renderer = createRenderer({
  inspector: { maxOperations: 200 },
})
const snapshot = renderer.inspector.snapshot()
```

Snapshots include active renderer nodes, scope ownership, signal/effect
dependency edges, event and resource subscriptions, renderer counters, and a
bounded recent-operation log. Operation records contain only type names,
property/event/resource identifiers, counts, sequence numbers, and error types;
property values, signal values, application state, and error messages are never
captured.

Use `renderer.inspector.getOperations()` for the current bounded log and
`clearOperations()` after collecting evidence. `maxOperations` defaults to 200,
is capped at 10,000, and can be set to `0` to disable operation recording while
retaining live snapshots.

Use the optional Worker heartbeat when the Host must detect a blocked WinUI UI
thread. `createRendererHeartbeatController()` emits inspector snapshots from a
`DispatcherQueueTimer`; `createRendererHeartbeatMonitor()` tracks startup,
healthy, timeout, and recovery states in the Host:

```ts
// Worker
const heartbeat = createRendererHeartbeatController({
  dispatcherQueue: window.dispatcherQueue,
  renderer,
  onHeartbeat: (value) => parentPort.postMessage({
    type: 'heartbeat',
    value,
  }),
  onError,
})

// Host
const monitor = createRendererHeartbeatMonitor({
  timeoutMs: 5000,
  schedule(callback, intervalMs) {
    const timer = setInterval(callback, intervalMs)
    return () => clearInterval(timer)
  },
  onTimeout: saveLastHeartbeatEvidence,
})
```

The heartbeat is optional and independent of rendering. A shared
`BigInt64Array` created by `createRendererHeartbeatSharedState()` can return
Host acknowledgements and export status to a Worker whose Node message
callbacks are paused inside the native WinUI loop.

`createDiagnosticRecord()` and `formatDiagnosticRecord()` produce structured
JSON events for startup, Worker failures, hot reload, and disposal evidence.

For machine-readable framework diagnostics, use the versioned protocol channel:

```ts
const diagnostics = createDiagnosticChannel({
  source: 'app-worker',
  onRecord(record) {
    parentPort.postMessage({
      type: 'diagnostic',
      record,
    })
  },
})

diagnostics.lifecycle({
  target: 'worker',
  state: 'starting',
  stage: 'bootstrap',
})
diagnostics.ownership(() => {
  const snapshot = renderer.inspector.snapshot()
  const counts = createRendererOwnershipCounts(snapshot)
  return {
    owner: 'renderer',
    resource: 'native-tree',
    ownership: 'owned',
    action: 'snapshot',
    activeCount: counts.activeNative,
    counts,
  }
})
```

Every emitted record includes the `dynwinrt-jsx.diagnostics` protocol name,
version `1`, a per-channel sequence, timestamp, source, kind, level, and typed
payload. Categories cover lifecycle state, native ownership, route
transitions, structured errors, and snapshots. `isEnabled(kind)` and lazy
payload callbacks let disabled snapshot categories avoid inspector work.
Error records include only the stable error type, code, and HRESULT by default;
message and stack capture require explicit `detail` opt-in because they can
contain paths or application data. `createDiagnosticRecord()` remains the
unversioned helper for application-specific ad hoc logs. Keep error context
and custom snapshot payloads privacy-safe, and use stable route IDs and reason
codes rather than URLs or text containing user data.

Use `createDiagnosticBuffer()` to retain a bounded cross-process event tail,
then combine it with renderer, heartbeat, and route-smoke evidence:

```ts
const buffer = createDiagnosticBuffer({ maxRecords: 500 })
const diagnostics = createDiagnosticChannel({
  source: 'app-worker',
  onRecord(record) {
    buffer.append(record)
    parentPort.postMessage({ type: 'diagnostic', value: record })
  },
})

const evidence = createDiagnosticEvidenceBundle({
  diagnostics: buffer.snapshot(),
  renderer: renderer.inspector.snapshot(),
  routes: routeSmokeResults,
})
```

`assertRendererInspectionIdle()` is the strong teardown gate: it checks native
and component counts plus inspector nodes, reactive scopes/observers/
dependencies, subscriptions, and failed subscription cleanup. The Dashboard
Diagnostics page exports the same `dynwinrt-jsx.evidence` format used by
heartbeat timeouts and final process-exit evidence.
Use `formatDiagnosticProtocolRecordSummary()` for console logs so full
inspector snapshot payloads remain in evidence files instead of flooding
stdout.

`createJsonStateStore()` provides validated atomic JSON load/save behavior:

```ts
const store = createJsonStateStore({
  path: statePath,
  defaultState: () => ({ version: 1, count: 0 }),
  validate: isAppState,
})
const loaded = store.load()
store.save({ version: 1, count: 1 })
```

Recovery returns the default state together with an explicit error and the path
of the preserved corrupt file.

## Native child shapes

| Native shape | JSX behavior |
|---|---|
| `children` collection | Inserts, removes, and moves native children |
| `child` property | Accepts one child, such as `Border` |
| `content` property | Accepts one child, such as `Button` or `Window` |
| `items` collection | Uses ordered collection synchronization |

`resource(key, fallback?)` resolves a static resource from the target element,
its ancestors, then `Application.current.resources`. `theme.ref()` uses the
same lookup chain plus theme dictionaries and automatic theme refresh.

## WinUI lifecycle

Bootstrap the Windows App SDK in the main process before creating the UI Worker. The Worker must call `roInitialize(0)`, enter `Application.startScheduled()`, create resources with `Application.create()`, and create/render all WinUI objects from that STA.

Generated bindings include a package-local lifetime module. Tracking remains
inactive until the UI host explicitly creates a scope:

```ts
const lifetime = createProjectedLifetimeScope()
```

Applications that never create a scope do not allocate WeakRefs or retain
projected objects.

Create Application, Window, and AppWindow before the lifetime scope. Dispose
application-owned scopes and the projection scope from `AppWindow.Closing`
before native window teardown. Register app-owned close-veto handlers during
mount; the final teardown handler runs afterward and returns when `args.cancel`
is true. Use `Window.Closed` only to unsubscribe the final handler and call
`Application.current.exit()`. Report ordinary cleanup failures without vetoing
the native close; only a projection-scope release failure should cancel close
so its retained values can be retried. See
[`examples/dashboard`](examples/dashboard) and the generated template for the
complete ordering.

## Migration from 0.1

- The second `For` render argument is now `ReadonlySignal<number>`, not `number`.
- Keyed reordering preserves native controls; a changed item object for the same key still remounts that entry.
- Use binding helpers as JSX spreads.
- WinUI nullable Boolean and primitive header/content conversion are automatic when their bindings are configured.
- `RenderHandle.update()` can replace an existing root.

See [`docs/migration-v1.md`](docs/migration-v1.md) for examples.

## Limits

- This is not React-compatible and does not implement hooks, React reconciliation, or React DevTools.
- Function components do not rerender as a unit; use signals for changing values.
- `Show`, hot-root refresh, and changed keyed item objects remount their affected subtree.
- `VirtualFor` remains fixed-height application-managed windowing; use
  `createItemsRepeaterControl()` for native dynamic-height virtualization.
- The state bridge clones complete state and does not provide schema validation or incremental patches.
- WinRT object properties still require projected objects unless a registered converter handles that property.
- All WinUI object creation, reads, and writes must remain on the UI STA.

## Development

```powershell
npm install
npm run check
npm pack
```

Runtime tests use fake native controls; strict TSX contracts are compiled separately. The suite covers deterministic scheduling, lifecycle, Context, boundaries, portals, virtualization, bindings, Worker transport, hot updates, 1,000-item keyed movement, disposal, and scaffolding.

Hosted Windows CI runs the source/type/package contract only. Native WinUI UIA
tests require an interactive desktop and sibling dynwinrt/winappCli artifacts:

```powershell
.\scripts\smoke-dashboard-ui.ps1
.\scripts\smoke-dashboard-hot-reload.ps1 -ReloadCycles 3
.\scripts\smoke-dashboard-persistence.ps1
.\scripts\repeat-dashboard-smoke.ps1 -Cycles 5 -UseExistingWinAppCli
```

Lifecycle summaries record renderer balance plus private memory, working set,
handles, threads, and CPU. Trend checks use warmed median windows rather than
single-process absolute limits.

### Local x64 source workflow

The dashboard can be built from the sibling `dynwinrt` and `winappCli`
repositories without installing npm packages:

```powershell
.\scripts\run-dashboard-local.ps1 `
  -DotNetPath C:\path\to\dotnet.exe `
  -TypeScriptPath C:\path\to\typescript\bin\tsc

.\scripts\smoke-dashboard-ui.ps1

.\scripts\repeat-dashboard-smoke.ps1 `
  -Cycles 5 `
  -SkipRestore `
  -DotNetPath C:\path\to\dotnet.exe `
  -TypeScriptPath C:\path\to\typescript\bin\tsc

.\scripts\smoke-generated-app-local.ps1 `
  -DotNetPath C:\path\to\dotnet.exe `
  -TypeScriptPath C:\path\to\typescript\bin\tsc

.\scripts\smoke-generated-app-release.ps1 `
  -DotNetPath C:\path\to\dotnet.exe
```

Add `-SkipDesktopInput` when running in a locked or non-interactive session.
This skips only SendInput and post-dialog keyboard-focus assertions; UIA
patterns, route transitions, accessibility-tree checks, diagnostics export,
single-window checks, close, process exit, and renderer-idle evidence still
run. Each cycle writes:

- `route-smoke.json` with stable route IDs and timings;
- `diagnostics-evidence.json` from the in-app export;
- `final-evidence.json` with the final idle renderer snapshot;
- `heartbeat-timeout.json` only when the UI thread times out; and
- `hang-capture/` with CDB thread stacks when a live process fails a cycle.

The preparation script builds the local dynwinrt runtime and code generator,
publishes the x64 winapp CLI, uses winapp's normal restore/codegen pipeline,
links the local JSX package, compiles the dashboard, and launches it. It
requires Rust, an x64 Node.js 20+ executable, .NET SDK 10.x, a local TypeScript
compiler, and the sibling repositories under the same work directory.

Use `-NoLaunch` to prepare only, `-SkipRestore` to reuse existing generated
bindings, and `-Wait` when an automation host must keep the launch process
alive. The smoke script uses `winapp ui` to exercise the native window and
writes screenshots under `examples\dashboard\.winapp\smoke`.

The repeat script prepares the dashboard once, then runs multiple independent
launch, interaction, screenshot, close, and process-exit cycles. Each run writes
a machine-readable `summary.json` with per-cycle renderer diagnostics under
`examples\dashboard\.winapp\lifecycle-smoke`.

The generated-app smoke creates a fresh project outside the repository, wires
physical local runtime/codegen packages without npm installation, restores and
generates bindings, compiles and launches the template, and verifies increment,
theme switching, screenshots, process exit, and renderer disposal. It writes a
`compatibility.json` containing source commits, dirty/untracked state hashes,
tool versions, SDK pins, UI selectors, and native diagnostics under
`.winapp\generated-app-smoke`.

Use `-SkipSharedRestore` only after the dashboard bindings have already been
generated by a previous local preparation run.

The Gallery's local `npm run setup` and `npm run generate` build both the
sibling dynwinrt native runtime and code generator from the same source
revision before generating bindings. Do not rebuild only the code generator:
main-generated runtime-class signatures require the matching native runtime.
`npm run dev`, `npm start`, and Gallery UI smoke also perform the same
incremental alignment before launching.

The repository includes a project-level Copilot Agent Skill at
`.github/skills/dynwinrt-jsx/SKILL.md`. Reload project skills with
`/skills reload` after adding the repository to a Copilot CLI session.
