# 8. Add errors and diagnostics

## Screen boundaries

```tsx
import {
  ErrorBoundary,
} from 'dynwinrt-jsx/core'

<ErrorBoundary
  fallback={(error) => (
    <UI.TextBlock text={`Screen failed: ${String(error)}`} />
  )}
>
  <TasksPage model={model} />
</ErrorBoundary>
```

Renderer mount and reactive update errors flow to the nearest boundary that
owns the subtree.

## Async actions

Use `createAsyncAction()` for cancellation, stale result suppression, and
operation-owned resources:

```ts
import {
  createAsyncAction,
} from 'dynwinrt-jsx/core'

const refresh = createAsyncAction(async (_input, context) => {
  const result = await loadTasks(context.signal)
  context.throwIfAborted()
  return result
})
```

## Structured diagnostics

```ts
import {
  createDiagnosticChannel,
  formatRendererDiagnostics,
} from 'dynwinrt-jsx/diagnostics'
```

Keep diagnostics privacy-safe. Inspector operation records intentionally omit
property and Signal values.

At close, confirm:

- native created equals native disposed;
- components mounted equals components disposed;
- active native and component counts are zero.

The reference Dashboard also exports heartbeat and inspector evidence through
its Host.

Next: [Validate and package the app](09-validation-and-packaging.md).
