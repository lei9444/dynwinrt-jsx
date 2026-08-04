# Async actions

Use `createAsyncAction()` for button-triggered asynchronous work. The action
owns cancellation, stale-result suppression, pending/error/value state, and
component-scope disposal.

```tsx
const pickFile = createAsyncAction(
  async (_input, { signal, throwIfAborted }) => {
    const picker = new FileOpenPicker(windowId)
    picker.fileTypeFilter.append('*')
    const file =
      await picker.pickSingleFileAsync(signal)
    throwIfAborted()
    return file?.path ?? 'Canceled'
  },
)
```

```tsx
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

## Concurrency

- `drop` is the default and ignores another `run()` while pending.
- `replace` aborts the previous operation and prevents its result from
  replacing the current value.

## Native resources

Recipe authors can transfer partially created resources to the operation:

```ts
const action = createAsyncAction(
  async (_input, { signal, scope, throwIfAborted }) => {
    const capture = scope.closeable(new MediaCapture())
    await capture.initializeAsync(settings, signal)
    throwIfAborted()
    return scope.disposable(
      createCameraSession(capture),
    )
  },
  { concurrency: 'replace' },
)
```

Resources are released in reverse order on failure, cancellation, replacement,
stale completion, or component disposal. Successful values remain owned until
replaced or disposed.

Do not wrap synchronous constructors or simple values in an async action.
Keep device selection, picker configuration, and application error wording in
application-level recipes.
