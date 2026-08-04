# 7. Persist validated Worker state

The generated template keeps process-owned state in the main process and UI
state in the WinUI Worker.

## Host configuration

`main.js` defines two schemas:

- `validate`: persisted JSON;
- `validateState`: initialized runtime state.

```js
state: {
  defaultState: createDefaultPersistedDashboardState,
  validate: isPersistedDashboardState,
  validateState: isDashboardState,
  initialize(loaded) {
    return {
      ...loaded.state,
      status: 'starting',
      persistenceError: loaded.error,
    }
  },
  persist(state) {
    return {
      version: 1,
      tasks: state.tasks,
      nextTaskId: state.nextTaskId,
      darkTheme: state.darkTheme,
    }
  },
}
```

Invalid persisted data is preserved as a `.corrupt-*` file and replaced with
the default state.

## Incremental Worker updates

Define an application patch:

```ts
export interface DashboardStatePatch {
  readonly tasks?: readonly DashboardTask[]
  readonly nextTaskId?: number
  readonly darkTheme?: boolean
  readonly status?: DashboardState['status']
}
```

Configure the same patch validator and apply function on Host and Worker
bridges. The Dashboard model compares its snapshot with the current bridge
state and calls:

```ts
bridge.patch(patch)
```

The Host assigns revisions. Conflicting speculative writes are rolled back to
the authoritative state and reported through `lastDiagnostic`.

Most screens should never import `dynwinrt-jsx/host` or
`dynwinrt-jsx/worker`; keep that code in `main.js` and `winui-worker.tsx`.

Next: [Add errors and diagnostics](08-errors-and-diagnostics.md).
