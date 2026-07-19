import {
  color,
  computed,
  createRoot,
  effect,
  signal,
  type Cleanup,
  type RendererDiagnostics,
  type Signal,
} from 'dynwinrt-jsx'
import {
  SolidColorBrush,
} from '../.winapp/bindings/index.js'

export type DashboardRoute =
  | 'dashboard'
  | 'tasks'
  | 'diagnostics'
  | 'settings'

export interface DashboardTask {
  readonly id: number
  readonly title: string
  readonly detail: string
  readonly completed: boolean
}

export interface DashboardState {
  readonly status: 'starting' | 'running' | 'closed'
  readonly taskCount: number
  readonly completedCount: number
}

export interface DashboardBridge {
  set(value: DashboardState): void
}

export interface DashboardColors {
  readonly blue: SolidColorBrush
  readonly green: SolidColorBrush
  readonly orange: SolidColorBrush
  readonly purple: SolidColorBrush
  readonly white: SolidColorBrush
}

export interface DashboardModel {
  readonly status: Signal<DashboardState['status']>
  readonly route: Signal<DashboardRoute>
  readonly darkTheme: Signal<boolean>
  readonly focusMode: Signal<boolean>
  readonly tasks: Signal<DashboardTask[]>
  readonly nextTaskId: Signal<number>
  readonly completedCount: ReturnType<typeof computed<number>>
  readonly completion: ReturnType<typeof computed<number>>
  readonly taskSummary: ReturnType<typeof computed<string>>
  readonly buildStatus: ReturnType<typeof computed<string>>
  readonly hotStatus: Signal<string>
  readonly hotVersion: Signal<number>
  readonly lastError: Signal<string | null>
  readonly diagnostics: Signal<RendererDiagnostics>
  readonly colors: DashboardColors
  updateTask(id: number, completed: boolean): void
  removeTask(id: number): void
  addTask(title: string): void
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

const brush = (r: number, g: number, b: number, a = 255) =>
  new SolidColorBrush(color(r, g, b, a))

export function createDashboardModel(
  bridge: DashboardBridge,
): DashboardModel {
  return createRoot((dispose: Cleanup) => {
    const route = signal<DashboardRoute>('dashboard')
    const status = signal<DashboardState['status']>('starting')
    const darkTheme = signal(true)
    const focusMode = signal(false)
    const nextTaskId = signal(4)
    const tasks = signal<DashboardTask[]>([
      {
        id: 1,
        title: 'Finalize JSX renderer',
        detail: 'Native children, events, refs, and disposal',
        completed: true,
      },
      {
        id: 2,
        title: 'Exercise real WinUI bindings',
        detail: 'Run the TSX dashboard through dynwinrt',
        completed: false,
      },
      {
        id: 3,
        title: 'Build the pilot application shell',
        detail: 'Navigation, dialogs, diagnostics, and hot reload',
        completed: false,
      },
    ])
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
    const colors: DashboardColors = {
      blue: brush(0, 120, 212),
      green: brush(16, 124, 16),
      orange: brush(202, 80, 16),
      purple: brush(136, 23, 152),
      white: brush(255, 255, 255),
    }

    effect(() => {
      bridge.set({
        status: status.value,
        taskCount: tasks.value.length,
        completedCount: completedCount.value,
      })
    })

    return {
      status,
      route,
      darkTheme,
      focusMode,
      tasks,
      nextTaskId,
      completedCount,
      completion,
      taskSummary,
      buildStatus,
      hotStatus,
      hotVersion,
      lastError,
      diagnostics,
      colors,
      updateTask(id, completed) {
        tasks.value = tasks.value.map((task) =>
          task.id === id ? { ...task, completed } : task,
        )
      },
      removeTask(id) {
        tasks.value = tasks.value.filter((task) => task.id !== id)
      },
      addTask(title) {
        const trimmed = title.trim()
        if (!trimmed) {
          return
        }
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
      },
      dispose,
    }
  })
}
