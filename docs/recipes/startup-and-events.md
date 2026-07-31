# Startup and high-frequency events

## Lazy pages

Keep non-first-screen modules outside the Worker startup graph:

```tsx
const SettingsPage = createLazyComponent(
  () => (
    require('./settings') as
      typeof import('./settings')
  ).SettingsPage,
)
```

The loader is synchronous, caches only a successful result, preserves a normal
component scope, and routes failures to the nearest `ErrorBoundary`.

## Last-value-per-frame events

```tsx
const scheduleFrame =
  createCompositionFrameScheduler(CompositionTarget)
const pointerMoved = createScopedLastValueCoalescer(
  scheduleFrame,
  (args: PointerRoutedEventArgs) => {
    pointer.value = args
  },
)

<UI.Canvas
  onPointerMoved={(_sender, args) =>
    pointerMoved.push(args)
  }
/>
```

This intentionally drops intermediate values and publishes the latest value
once per composition frame. Do not use it for ordered input, text entry,
clicks, commands, or events where every transition matters.

## ScrollViewer sampling

```ts
const scroller = createScrollViewerController({
  sampling: 'frame',
  scheduleFrame,
})
```

- `immediate`: publish every native callback.
- `frame`: publish the latest offsets once per frame.
- `native`: install no JS subscriptions; call `refresh()` when needed.

Use native virtualization for long lists. Coalescing does not reduce the number
of realized controls.
