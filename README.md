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

Renderer diagnostics expose active native/component counts and cumulative keyed-entry creation/reuse counts for leak checks.

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

Dispose the render handle from the window's closed callback, then call `Application.current.exit()`. See [`examples/dashboard`](examples/dashboard) and the generated template for complete implementations.

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
