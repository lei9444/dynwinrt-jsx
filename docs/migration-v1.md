# Migrating to dynwinrt-jsx 1.0

## Progressive package entry points

The complete `dynwinrt-jsx` root remains supported. New applications can use
focused additive entry points:

```ts
import { signal, For } from 'dynwinrt-jsx/core'
import { createControls } from 'dynwinrt-jsx/controls'
import { thickness, styles } from 'dynwinrt-jsx/winui'
```

Advanced APIs are grouped under `dynwinrt-jsx/native` and structured
diagnostics under `dynwinrt-jsx/diagnostics`. Host and Worker entry points are
unchanged. No existing root import must be rewritten.

Additional compatible ergonomics:

- `createWinUIControls(bindings)` lazily creates typed control components from
  a generated binding namespace;
- `showContentDialog({ renderer, dialog, xamlRoot, content })` complements the
  positional signature;
- `createWinUIThemeController({ bindings, ... })` derives generated theme enum
  pairs;
- `AsyncActionContext.throwIfAborted()` forwards to its AbortSignal.

The creator keeps `dashboard` as the default and adds
`--template minimal` for the Counter starter.

## Worker state schemas and protocol

`createStateBridge()`, `createWinUIWorkerRuntime()`, and `defineWinUIHost()`
now require runtime-state validators. Persisted-state validation remains
separate because the initialized Worker state can contain additional fields:

```ts
createStateBridge(transport, {
  role: 'client',
  initial,
  validate: isAppState,
})

createWinUIWorkerRuntime<AppState>({
  moduleId: './dist/app.js',
  validateState: isAppState,
})
```

`defineWinUIHost()` uses `state.validate` for persisted JSON and
`state.validateState` for the initialized and bridged state. The internal wire
protocol is now `dynwinrt-jsx.state.v2`; both Host and Worker must use the same
framework release. Applications can add typed incremental `patch`, Client to
Host `commands`, and Host to Client `events`. Invalid synchronization rejects
`ready`, while later invalid or conflicting messages retain or restore the
last authoritative state and publish `lastDiagnostic`.

## Keyed list indexes

`For` now keeps an entry mounted when it moves. Read its index signal inside a computed value:

```tsx
<For each={items} key={(item) => item.id}>
  {(item, index) => (
    <UI.TextBlock
      text={computed(() => `${index.value + 1}. ${item.title}`)}
    />
  )}
</For>
```

Code that treated the second argument as a number must use `index.value`.

## Binding helpers

Bindings are declarative JSX props:

```tsx
const name = signal('')

<UI.TextBlock {...bind.oneWay(name, 'text')} />
<UI.TextBox
  {...bind.twoWay(name, 'text', 'onTextChanged')}
/>
```

The default two-way reader uses `sender[property]`. Pass a fourth callback for events whose value comes from another location. Two-way bindings suppress delayed programmatic echoes using logical value equality; pass a fifth equality callback for projected reference types with domain-specific identity.

## WinUI values

The WinUI renderer converts Boolean `isChecked` values to generated nullable Boolean references and converts primitive `content` or `header` values to `TextBlock`.

```tsx
<UI.CheckBox isChecked={complete} />
<UI.ToggleSwitch header="Dark theme" />
```

Manual `PropertyValue.createBoolean()` wrappers are no longer needed for these JSX properties. `null` remains valid only when the generated native property is nullable; non-nullable controls such as `ToggleSplitButton` now reject it in TSX and at runtime.

Use the struct helpers instead of repeating object literals:

```tsx
<UI.Border
  padding={thickness(12)}
  cornerRadius={cornerRadius(8)}
/>
```

When changing theme at runtime, pass the theme signal as the third argument so a resource is looked up again:

```tsx
resource('CardBackgroundFillColorDefaultBrush', fallbackBrush, darkTheme)
```

Apply `Application.current.requestedTheme` in the same `batch()` as the signal update so resource effects run only after WinUI has switched theme.

Object-valued properties can use the generated-constructor helpers:

```tsx
const uri = createUri(Uri, 'ms-appx:///Assets/Logo.png')
const source = createBitmapImage(BitmapImage, uri)
const font = createFontFamily(FontFamily, 'Segoe UI Variable Text')
const brush = createSolidColorBrush(SolidColorBrush, color(0, 120, 212))
```

The helpers also cover `BitmapIcon`, relative URIs, and injected
`IReference<T>` boxing through `createReferenceBoxing()` and `boxNullable()`.
Create these projected objects only on the WinUI STA.

## Specialized native adapters

Use the `adapter` descriptors in `native()` instead of adding repeated
`setProperty` branches for collection-valued properties or named JSX slots.
Direct writable generated properties remain unchanged.

```tsx
const Navigation = native<
  NavigationView,
  { menuItems?: MaybeSignal<readonly NavigationViewItem[]> }
>(NavigationView, {
  adapters: {
    menuItems: adapter.collection({
      get: (instance) => instance.menuItems,
    }),
  },
})
```

Available descriptors classify one-way, initial-only, controlled, coercing,
reference, collection, single-slot, and collection-slot behavior. Adapter-owned
slots now dispose their child scopes with the native control.

Property descriptors can opt into `afterChildren` or `afterMount` application
with `adapter.withPhase()`. The default remains `beforeChildren`. Selection
controls now use `afterChildren` directly instead of delaying model values with
wrapper signals. Reactive writes in these later phases run after ordinary
effects in the same flush, so batched item and selection updates preserve their
declared order. Native event props are connected after `afterChildren`
properties; initial programmatic writes therefore no longer invoke raw event
handlers during mount.

Controlled adapters keep the JSX source authoritative. A native change is
forwarded once; if its callback leaves the source signal unchanged, the latest
model value is written back to the control. Transactional `rollback` is
available only with `synchronous` or `setterScope` echo mode. Deferred rollback
is rejected because the failed-write and rollback echoes cannot be identified
reliably.

## Custom attached properties

Pass generated static setters through `createWinUIRenderer()`:

```tsx
createWinUIRenderer(bindings, {
  attachedProperties: {
    dock: { owner: DockPanel, method: 'setDock' },
  },
})
```

Unlike optional built-in registrations, an invalid custom registration throws
when the renderer is created.

## WinUI renderer presets

Pass the complete generated namespace to `createWinUIRendererPreset()` instead
of manually maintaining a renderer-only binding list:

```ts
import * as WinUIBindings from '#winapp/bindings'

const preset = createWinUIRendererPreset(WinUIBindings)
const renderer = preset.createRenderer()
```

The old `createWinUIRenderer(bindings, options)` API remains supported.
Presets expose detected capabilities and produce actionable errors when JSX
uses a missing nullable Boolean, text, or projected collection binding.

## Scoped overlays

For reusable tips, `createTeachingTip()` owns the current content scope across
open/close cycles.
Pass a TeachingTip already mounted in the native tree, dispose the returned
controller when its owner is released, and use `TeachingTip.isOpenProperty` to
observe closure through dependency-property callbacks when generic event
delegates are not projectable.

Generated packages export `createProjectedLifetimeScope()`. Create the scope
after Application, Window, and AppWindow, then dispose renderer state and the
scope from `AppWindow.Closing` before the native window is destroyed. Projects
that never create a scope do not allocate WeakRefs. This prevents late
`XamlRoot` release during Node environment teardown after Flyout use. Keep
failed resource references retryable, allow ordinary cleanup errors to proceed
to `Window.Closed`, and veto close only when projection-scope release itself
fails.

## Scheduled WinUI application start

Regenerate WinUI bindings and prefer the generated
`Application.startScheduled()` method. It returns a Promise when the
application exits and lets the current Node callback unwind before
`Application.Start` takes ownership of the STA. `runWinUIWorkerApp()` selects
this method and returns `Promise<number>`; await its result before disposing
Worker ports or terminating the process. Regenerate bindings before upgrading.

## Generated-binding application host

Prefer `defineWinUIApp()` for normal Worker applications. Pass the complete
generated binding namespace once; the host creates the renderer preset, injects
`releaseProjected` for renderer-owned native values, creates the generated
Window and projection scope, and delegates deterministic teardown to
`runWinUIWorkerApp()`.

`runWinUIWorkerApp()` remains available when an application intentionally owns
a custom renderer, Window factory, or projection-scope strategy. Existing
low-level callers can migrate incrementally without changing their mount and
close hooks.

## Renderer-owned native release

Pass generated `releaseProjected` to
`createWinUIRendererPreset(...).createRenderer({ releaseNative:
releaseProjected })`. The renderer releases only controls and ItemsRepeater
hosts it creates, after child, event, ref, and reactive cleanup. Application-
owned Window, AppWindow, and service projections remain the application's
responsibility.

## Awaited Worker application cleanup

Worker applications with process-owned asynchronous cleanup should use
the `beforeCloseAsync()` hook returned from `runWinUIWorkerApp()`'s `mount()`.
The lifecycle cancels the initial close and awaits the hook while native
projections remain alive, then retries the close and performs synchronous page,
renderer, diagnostics, and projection teardown. A rejected hook keeps the
window open so retryable cleanup can run on the next close attempt.

## Theme resources

Use `theme.*` or `theme.ref(key)` instead of manually coupling `resource()` to
an application theme signal. Theme references now resolve against the target
element and its ancestors, react to `ActualThemeChanged` and High Contrast,
and fall back to application resources.

```tsx
<UI.Border
  background={theme.cardBackground}
  resourceOverrides={{
    ButtonBackground: theme.accent,
  }}
/>
```

`resource()` remains the static-resource API. Custom `resolveResource`
implementations keep `key` and `fallback` as their first two arguments and can
optionally accept `target` and resource `kind` as the third and fourth.

Use `tokens` and `styles` to replace repeated styling literals. Recipes are
plain JSX prop spreads and support signal-backed variants:

```tsx
<UI.Border {...styles.card({ surface: 'layer' })}>
  <UI.TextBlock {...styles.heading({ level: 'subtitle' })} />
</UI.Border>
```

Replace separate Application, root-element, and title-bar theme assignments
with `createWinUIThemeController()`. High Contrast resource transitions remain
automatic through the WinUI resource runtime.

## ListView selection

Create list controls with `createListViewControl()` so default JSX children
populate native `items` and `header`/`footer` are owned named slots. Use a
signal for `selectedIndex` and write genuine native changes back from
`onSelectedIndexChange`. Matching programmatic `SelectionChanged` echoes are
suppressed. Prefer `Selector.selectedIndexProperty` in the control bindings;
`onSelectionChanged` remains available when the raw projected event works.

## ComboBox selection

Create ComboBox controls with `createComboBoxControl()`. JSX children populate
the native items collection, `header` owns its JSX subtree, and
`selectedIndex` is applied after items mount. `onSelectedIndexChange` receives
genuine native changes; leave the source signal unchanged to reject and restore
the model selection. The specialized control intentionally omits
`selectedItem`; use a raw native ComboBox or its ref when projected-object
selection is required.

## SelectorBar and ScrollViewer

Use `createSelectorBarControl()` to own `SelectorBarItem` children and expose
controlled `selectedIndex` instead of storing projected `selectedItem`
identities in application state. Items mount before selection is applied, and
rejected native changes reassert the model index after the reactive flush.

`createScrollViewerController()` replaces application-specific offset refs and
ViewChanged/SizeChanged subscriptions. It exposes reactive offsets, viewport
and scrollable sizes, boundary signals, clamped ChangeView helpers, and
automatic ref cleanup.

## Root replacement

Use `RenderHandle.update(nextTree)` to replace a mounted root, or `createHotRoot()` when a development integration needs to rerun a render factory.

## Runtime inspection

`Renderer.inspector` now exposes privacy-safe, JSON-serializable snapshots of
active native/component records, reactive scope and dependency graphs, event
and resource subscriptions, and recent renderer operations:

```ts
const snapshot = renderer.inspector.snapshot()
```

Operation recording is bounded to 200 entries by default. Configure
`createRenderer({ inspector: { maxOperations } })`, or use `0` when only live
ownership snapshots are required. Inspector records never include property or
signal values.

Render-handle disposal is now retryable when native child detachment throws.
The handle remains undisposed, retains its reported roots, and rejects updates
until a later `dispose()` succeeds.

`dynwinrt-jsx/worker` now exports an optional DispatcherQueue-based renderer
heartbeat controller, and `dynwinrt-jsx/host` exports its timeout monitor and
shared acknowledgement state. Applications decide whether to enable it and
where timeout or inspector JSON evidence is written.

## Structured diagnostics protocol

Use `createDiagnosticChannel()` when diagnostics are consumed by Host tooling,
automation, or an in-app diagnostics surface. It emits versioned records for
lifecycle state, native ownership, route transitions, errors, and snapshots.
The older `createDiagnosticRecord()` helper remains available for unversioned
application-specific logs.

Structured errors are type-only by default. Opt into `message` or `stack`
detail only for a suitably protected local sink because those fields can
contain paths and application data. Error context, custom snapshots, route
IDs, and route reason codes remain caller-provided and should be privacy-safe.

Use `createDiagnosticBuffer()` and `createDiagnosticEvidenceBundle()` for
bounded export files that combine protocol records with renderer, heartbeat,
and route-smoke evidence. Replace raw `activeNative`/`activeComponents` checks
with `assertRendererInspectionIdle()` when a full inspector snapshot is
available.

## Signal-native router

Applications can replace route signals plus manual switch statements with
`createRouter()`, `RouterProvider`, and `Outlet`. Route definitions support
nested layouts, index routes, static segments, `:params`, and a final `*`
segment. Router location, params, query, state, matches, route ID, and history
are signals.

Use `createRouterNavigationHost()` for `NavigationView` selection so native
selection transactions retain the existing separate disposal and mount turns.
`createNavigationHost()` remains available for non-router state machines.

`defineRouteRegistry()` provides inferred route IDs and path params.
`parentId` plus `router.up()` replaces application-specific parent/back
switches, while `navigationId` and `targetForRoute()` support stable
NavigationView selection for detail and parameterized routes.

The router owns in-memory history only; it does not add browser history or
React-style component rerenders. A route with the same ID remains mounted when
only params, query, or state change.

## New subtree primitives

- `Context.Provider` and `useContext()` pass values through renderer scopes.
- `onMount()` runs after the owned native subtree mounts and may return cleanup.
- `ErrorBoundary` catches mount and reactive update errors.
- `Portal` mounts a subtree in another native host.
- `VirtualFor` bounds fixed-height list rendering.
- `createItemsRepeaterControl()` provides native dynamic-height realization and
  recycling inside a `ScrollViewer`.

These primitives own their reactive work and release it when the subtree is removed.

ItemsRepeater applications must generate `ItemsRepeater`, `ContentControl`,
`StackLayout`, `PropertyValue`, `IObservableVector<Object>`, and their interface
dependencies. The control factory accepts those generated bindings, keeps a
bounded pool of native item hosts, applies incremental source mutations, and
preserves a row scope while its key remains stable.
