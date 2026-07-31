# Native resource ownership

Use `createNativeResourceOwner()` when a component creates several projected,
closeable, or disposable resources.

```ts
const resources = createNativeResourceOwner({
  releaseProjected,
})

const settings = resources.ownProjected(
  new UISettings(),
)
const source = resources.ownCloseable(
  MediaSource.createFromUri(uri),
)
resources.defer(
  settings.onAnimationsEnabledChanged(refresh),
)
```

The owner registers with the current component scope, releases in reverse
order, continues after cleanup failures, and retries only failed entries.
Call `release(value)` when replacing one resource before component disposal.

## Composition animations

```ts
const animations = createCompositionOwner({
  releaseProjected,
})
const compositor = animations.ownProjected(
  CompositionTarget.getCompositorForCurrentThread(),
)
const animation = animations.ownCloseable(
  compositor.createExpressionAnimation(
    'Vector3(source.Offset.X, 0, 0)',
  ),
)

animations.start(element, animation)
```

The owner stops tracked animations before releasing animation/compositor
resources. Renderer-owned native targets are released before their component
scope, so stop their animations from ref clearing:

```tsx
let target: UIElement | null = null

<UI.Button
  ref={(value) => {
    if (!value && target) {
      animations.stopAll(target)
    }
    target = value
  }}
/>
```

For `CompositionObject` property animations:

```ts
animations.startProperty(
  visual,
  'Opacity',
  opacityAnimation,
)
```

Keep application behavior such as popup closing, final property values, and
connected-animation routing outside the generic owner.
