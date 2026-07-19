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
import type { AppState } from './app-state'

export type AppRoute = 'home' | 'diagnostics' | 'settings'

export type { AppState } from './app-state'

export interface AppModel {
  readonly status: Signal<AppState['status']>
  readonly route: Signal<AppRoute>
  readonly count: Signal<number>
  readonly darkTheme: Signal<boolean>
  readonly updatedAt: Signal<string | null>
  readonly persistenceError: Signal<string | null>
  readonly hotStatus: Signal<string>
  readonly hotVersion: Signal<number>
  readonly lastError: Signal<string | null>
  readonly diagnostics: Signal<RendererDiagnostics>
  readonly countText: ReturnType<typeof computed<string>>
  increment(): void
  setDarkTheme(value: boolean): void
  snapshot(status?: AppState['status']): AppState
  dispose(): void
}

interface StateBridge {
  set(value: AppState): void
}

export function createAppModel(
  bridge: StateBridge,
  initialState: AppState,
): AppModel {
  return createRoot((dispose: Cleanup) => {
    const route = signal<AppRoute>('home')
    const status = signal<AppState['status']>(initialState.status)
    const count = signal(initialState.count)
    const darkTheme = signal(initialState.darkTheme)
    const updatedAt = signal(initialState.updatedAt)
    const persistenceError = signal(initialState.persistenceError)
    const hotStatus = signal('ready')
    const hotVersion = signal(0)
    const lastError = signal<string | null>(null)
    const diagnostics = signal<RendererDiagnostics>({
      nativeCreated: 0,
      nativeDisposed: 0,
      activeNative: 0,
      componentsMounted: 0,
      componentsDisposed: 0,
      activeComponents: 0,
      listEntriesCreated: 0,
      listEntriesReused: 0,
    })
    const countText = computed(() => `Native count: ${count.value}`)
    const snapshot = (nextStatus = status.value): AppState => ({
        version: 1,
        status: nextStatus,
        count: count.value,
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
      count,
      darkTheme,
      updatedAt,
      persistenceError,
      hotStatus,
      hotVersion,
      lastError,
      diagnostics,
      countText,
      increment() {
        batch(() => {
          count.value += 1
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
