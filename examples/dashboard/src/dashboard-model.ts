import {
  batch,
  computed,
  createRoot,
  effect,
  signal,
  type Cleanup,
  type RendererDiagnostics,
  type Signal,
} from 'dynwinrt-jsx'
import {
  type DashboardState,
  type DashboardTask,
  type PersistedDashboardState,
} from './dashboard-state'

export type {
  DashboardState,
  DashboardTask,
  PersistedDashboardState,
} from './dashboard-state'

export type DashboardRoute =
  | 'dashboard'
  | 'tasks'
  | 'diagnostics'
  | 'settings'

export interface DashboardBridge {
  set(value: DashboardState): void
}

export interface DashboardModel {
  readonly status: Signal<DashboardState['status']>
  readonly route: Signal<DashboardRoute>
  readonly darkTheme: Signal<boolean>
  readonly focusMode: Signal<boolean>
  readonly tasks: Signal<DashboardTask[]>
  readonly nextTaskId: Signal<number>
  readonly updatedAt: Signal<string | null>
  readonly persistenceError: Signal<string | null>
  readonly completedCount: ReturnType<typeof computed<number>>
  readonly completion: ReturnType<typeof computed<number>>
  readonly taskSummary: ReturnType<typeof computed<string>>
  readonly buildStatus: ReturnType<typeof computed<string>>
  readonly hotStatus: Signal<string>
  readonly hotVersion: Signal<number>
  readonly lastError: Signal<string | null>
  readonly diagnostics: Signal<RendererDiagnostics>
  updateTask(id: number, completed: boolean): void
  removeTask(id: number): void
  addTask(title: string): void
  setDarkTheme(value: boolean): void
  snapshot(status?: DashboardState['status']): DashboardState
  dispose(): void
}

const idleDiagnostics: RendererDiagnostics = {
  nativeCreated: 0,
  nativeDisposed: 0,
  activeNative: 0,
  componentsMounted: 0,
  componentsDisposed: 0,
  activeComponents: 0,
  listEntriesCreated: 0,
  listEntriesReused: 0,
}

export function createDashboardModel(
  bridge: DashboardBridge,
  initialState: DashboardState,
): DashboardModel {
  return createRoot((dispose: Cleanup) => {
    const route = signal<DashboardRoute>('dashboard')
    const status = signal<DashboardState['status']>(initialState.status)
    const darkTheme = signal(initialState.darkTheme)
    const focusMode = signal(false)
    const nextTaskId = signal(initialState.nextTaskId)
    const tasks = signal<DashboardTask[]>([...initialState.tasks])
    const updatedAt = signal(initialState.updatedAt)
    const persistenceError = signal(initialState.persistenceError)
    const completedCount = computed(
      () => tasks.value.filter((task) => task.completed).length,
    )
    const completion = computed(() =>
      tasks.value.length === 0
        ? 0
        : Math.round(
            (completedCount.value / tasks.value.length) * 100,
          ),
    )
    const taskSummary = computed(
      () => `${completedCount.value} of ${tasks.value.length} completed`,
    )
    const buildStatus = computed(() =>
      completion.value === 100 ? 'Ready to ship' : 'In progress',
    )
    const hotStatus = signal('ready')
    const hotVersion = signal(0)
    const lastError = signal<string | null>(null)
    const diagnostics = signal(idleDiagnostics)
    const snapshot = (
      nextStatus = status.value,
    ): DashboardState => ({
        version: 1,
        status: nextStatus,
        tasks: tasks.value,
        nextTaskId: nextTaskId.value,
        darkTheme: darkTheme.value,
        updatedAt: updatedAt.value,
        persistenceError: persistenceError.value,
    })
    effect(() => {
      bridge.set(snapshot())
    })

    const markChanged = () => {
      updatedAt.value = new Date().toISOString()
      persistenceError.value = null
    }

    return {
      status,
      route,
      darkTheme,
      focusMode,
      tasks,
      nextTaskId,
      updatedAt,
      persistenceError,
      completedCount,
      completion,
      taskSummary,
      buildStatus,
      hotStatus,
      hotVersion,
      lastError,
      diagnostics,
      updateTask(id, completed) {
        batch(() => {
          tasks.value = tasks.value.map((task) =>
            task.id === id ? { ...task, completed } : task,
          )
          markChanged()
        })
      },
      removeTask(id) {
        batch(() => {
          tasks.value = tasks.value.filter((task) => task.id !== id)
          markChanged()
        })
      },
      addTask(title) {
        const trimmed = title.trim()
        if (!trimmed) {
          return
        }
        batch(() => {
          tasks.value = [
            ...tasks.value,
            {
              id: nextTaskId.value,
              title: trimmed,
              detail: 'Added from the native WinUI text box',
              completed: false,
            },
          ]
          nextTaskId.value += 1
          markChanged()
        })
      },
      setDarkTheme(value) {
        if (darkTheme.value === value) {
          return
        }
        batch(() => {
          darkTheme.value = value
          markChanged()
        })
      },
      snapshot,
      dispose,
    }
  })
}
