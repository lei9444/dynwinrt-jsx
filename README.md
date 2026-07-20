# dynwinrt-jsx

`dynwinrt-jsx` 1.0 is a type-safe declarative UI runtime for building native WinUI 3 apps with standard TypeScript TSX. It wraps dynwinrt-generated classes: rendered elements are real WinUI controls, with no browser or React runtime.

Components use React-like composition and Solid-style fine-grained signals. A component runs once when mounted; signals update only the affected native properties or child ranges.

```tsx
import {
  computed,
  createControls,
  createWinUIRenderer,
  signal,
} from 'dynwinrt-jsx'
import * as bindings from './.winapp/bindings/index.js'

const UI = createControls({
  Button: bindings.Button,
  StackPanel: bindings.StackPanel,
  TextBlock: bindings.TextBlock,
})
const renderer = createWinUIRenderer(bindings)

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

Use development hot reload after setup:

```powershell
npm run dev
```

The generated app keeps its Window, Worker, and model state alive while
reloading `src/app.tsx`. Changes to the Worker, model, generated bindings, or
native runtime require a restart.

The main process also persists model state atomically. By default generated apps
write under `%LOCALAPPDATA%\dynwinrt-jsx\<project>\state.json`; override the
location with `DYNWINRT_JSX_STATE_PATH`. Invalid JSON or schema data is renamed
to a timestamped `.corrupt-*` file, the default state is restored, and the
recovery error remains visible in Diagnostics.

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
- `Show`, stable keyed `For`, and fixed-height `VirtualFor`
- `ErrorBoundary` for mount and reactive update failures
- `Portal` for rendering into another native host
- Signal-backed event handlers and one/two-way binding props
- WinUI resources, attached properties, nullable Boolean boxing, and value helpers
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

Writable generated properties become JSX properties. Generated `onX(callback)` methods become typed event properties. Use `native()` when a class needs custom construction.

Primitive children become native `TextBlock` instances. Primitive `content` and `header` values are also converted to `TextBlock`; Boolean `isChecked` values are boxed as `IReference<Boolean>` when the required generated bindings are supplied.

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
      get: (instance) => instance.primaryCommands,
      label: 'CommandBar primaryCommands',
    }),
  },
  children: adapter.slot('content'),
})
```

Ordinary generated properties still use direct assignment. Collection
adapters validate the complete array and roll back failed native replacement;
slot adapters own and dispose the JSX subtree they mount.

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

Programmatic `selectedIndex` writes suppress their matching native change.
Supplying `Selector.selectedIndexProperty` uses a dependency-property callback,
which avoids relying on generic WinRT event-delegate projection. Raw
`onSelectionChanged` remains available when that projected event is usable.
`createListViewScrollTarget()` provides a typed
`scrollIntoView()` ref; use `createFocusTarget()` for focus.

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

Supported metadata includes name, help text, labeled-by, heading level,
position/size in set, live setting, dialog state, and automation control type.

Register additional WinUI attached properties when an application generates
the owning type:

```tsx
const renderer = createWinUIRenderer(bindings, {
  attachedProperties: {
    dock: { owner: DockPanel, method: 'setDock' },
  },
})
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

`showFlyout()` and `showMenuFlyout()` own their rendered content and release it
when the native overlay closes or the returned controller is disposed.

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

`createHotReloadSession()` adds monotonic version handling, stale reload
rejection, and error fallback rendering. The generated app polls a version file
from a `DispatcherQueueTimer`, so reload work executes on the WinUI STA while
the main process and host-owned state remain alive.

Renderer diagnostics expose active native/component counts and cumulative keyed-entry creation/reuse counts for leak checks.

`createDiagnosticRecord()` and `formatDiagnosticRecord()` produce structured
JSON events for startup, Worker failures, hot reload, and disposal evidence.

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

`resource(key, fallback?)` resolves values through `Application.current.resources`.

## WinUI lifecycle

Bootstrap the Windows App SDK in the main process before creating the UI Worker. The Worker must call `roInitialize(0)`, enter `Application.start()`, create resources with `Application.create()`, and create/render all WinUI objects from that STA.

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
- `VirtualFor` is fixed-height windowing, not WinUI `ItemsRepeater`/`DataTemplate` virtualization.
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
```

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

The repository includes a project-level Copilot Agent Skill at
`.github/skills/dynwinrt-jsx/SKILL.md`. Reload project skills with
`/skills reload` after adding the repository to a Copilot CLI session.
