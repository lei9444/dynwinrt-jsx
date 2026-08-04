# 2. Build the reactive model

Define the serializable state in `src/app-state.ts`:

```ts
export interface DashboardTask {
  readonly id: number
  readonly title: string
  readonly completed: boolean
}

export interface PersistedDashboardState {
  readonly version: 1
  readonly tasks: readonly DashboardTask[]
  readonly nextTaskId: number
  readonly darkTheme: boolean
}

export interface DashboardState
extends PersistedDashboardState {
  readonly status: 'starting' | 'running' | 'closed'
  readonly persistenceError: string | null
}
```

Keep runtime validation beside the types. TypeScript types do not validate
messages or persisted JSON:

```ts
function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDashboardTask(
  value: unknown,
): value is DashboardTask {
  return (
    isRecord(value) &&
    Number.isInteger(value.id) &&
    (value.id as number) > 0 &&
    typeof value.title === 'string' &&
    typeof value.completed === 'boolean'
  )
}

export function createDefaultPersistedDashboardState():
PersistedDashboardState {
  return {
    version: 1,
    tasks: [],
    nextTaskId: 1,
    darkTheme: false,
  }
}

export function isPersistedDashboardState(
  value: unknown,
): value is PersistedDashboardState {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.tasks) ||
    !value.tasks.every(isDashboardTask) ||
    !Number.isInteger(value.nextTaskId) ||
    typeof value.darkTheme !== 'boolean'
  ) {
    return false
  }
  const ids = value.tasks.map((task) => task.id)
  const maxId = ids.length === 0 ? 0 : Math.max(...ids)
  return (
    new Set(ids).size === ids.length &&
    (value.nextTaskId as number) > maxId
  )
}

export function isDashboardState(
  value: unknown,
): value is DashboardState {
  return (
    isPersistedDashboardState(value) &&
    (
      (value as DashboardState).status === 'starting' ||
      (value as DashboardState).status === 'running' ||
      (value as DashboardState).status === 'closed'
    ) &&
    (
      (value as DashboardState).persistenceError === null ||
      typeof (value as DashboardState).persistenceError === 'string'
    )
  )
}
```

The production reference in
[`dashboard-state.ts`](../../examples/dashboard/src/dashboard-state.ts)
adds the same invariants plus its additional persisted fields.

## Create the model

In `src/app-model.ts`:

```ts
import {
  batch,
  computed,
  createRoot,
  signal,
  type Cleanup,
  type Signal,
} from 'dynwinrt-jsx/core'

export interface DashboardModel {
  readonly tasks: Signal<DashboardTask[]>
  readonly nextTaskId: Signal<number>
  readonly darkTheme: Signal<boolean>
  readonly completedCount: ReturnType<typeof computed<number>>
  addTask(title: string): void
  updateTask(id: number, completed: boolean): void
  removeTask(id: number): void
  setDarkTheme(value: boolean): void
  dispose(): void
}

export function createDashboardModel(
  initial: DashboardState,
): DashboardModel {
  return createRoot((dispose: Cleanup) => {
    const tasks = signal([...initial.tasks])
    const nextTaskId = signal(initial.nextTaskId)
    const darkTheme = signal(initial.darkTheme)

    const completedCount = computed(
      () => tasks.value.filter((task) => task.completed).length,
    )

    const addTask = (title: string) => {
      const normalized = title.trim()
      if (!normalized) return
      batch(() => {
        tasks.value = [
          ...tasks.value,
          {
            id: nextTaskId.value,
            title: normalized,
            completed: false,
          },
        ]
        nextTaskId.value += 1
      })
    }

    return {
      tasks,
      nextTaskId,
      darkTheme,
      completedCount,
      addTask,
      updateTask(id, completed) {
        tasks.value = tasks.value.map((task) =>
          task.id === id
            ? { ...task, completed }
            : task,
        )
      },
      removeTask(id) {
        tasks.value = tasks.value.filter(
          (task) => task.id !== id,
        )
      },
      setDarkTheme(value) {
        darkTheme.value = value
      },
      dispose,
    }
  })
}
```

## Why `createRoot`?

The model owns computed values, effects, and subscriptions. Calling `dispose`
releases that reactive scope as one unit.

Components do not rerun when a Signal changes. Read Signals through native
properties, `computed`, `Show`, or `For`.

## Checkpoint

Export `DashboardModel` with the model factory. Later chapters add UI around
these operations without changing the ownership model.

Create the model in the generated Worker mount callback and keep
`disposeAfterRender: model.dispose`.

Next: [Create the native layout](03-controls-and-layout.md).
