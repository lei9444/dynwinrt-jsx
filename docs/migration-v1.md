# Migrating to dynwinrt-jsx 1.0

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
