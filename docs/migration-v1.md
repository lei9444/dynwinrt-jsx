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

Manual `PropertyValue.createBoolean()` wrappers are no longer needed for these JSX properties.

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

## Root replacement

Use `RenderHandle.update(nextTree)` to replace a mounted root, or `createHotRoot()` when a development integration needs to rerun a render factory.

## New subtree primitives

- `Context.Provider` and `useContext()` pass values through renderer scopes.
- `onMount()` runs after the owned native subtree mounts and may return cleanup.
- `ErrorBoundary` catches mount and reactive update errors.
- `Portal` mounts a subtree in another native host.
- `VirtualFor` bounds fixed-height list rendering.

These primitives own their reactive work and release it when the subtree is removed.
