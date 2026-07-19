import {
  computed,
  createRoot,
  effect,
  signal,
  type Cleanup,
  type RendererDiagnostics,
  type Signal,
} from 'dynwinrt-jsx'

export type AppRoute = 'home' | 'diagnostics' | 'settings'

export interface AppState {
  readonly status: 'starting' | 'running' | 'closed'
  readonly count: number
}

export interface AppModel {
  readonly status: Signal<AppState['status']>
  readonly route: Signal<AppRoute>
  readonly count: Signal<number>
  readonly darkTheme: Signal<boolean>
  readonly hotStatus: Signal<string>
  readonly hotVersion: Signal<number>
  readonly lastError: Signal<string | null>
  readonly diagnostics: Signal<RendererDiagnostics>
  readonly countText: ReturnType<typeof computed<string>>
  dispose(): void
}

interface StateBridge {
  set(value: AppState): void
}

export function createAppModel(bridge: StateBridge): AppModel {
  return createRoot((dispose: Cleanup) => {
    const route = signal<AppRoute>('home')
    const status = signal<AppState['status']>('starting')
    const count = signal(0)
    const darkTheme = signal(true)
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
    effect(() => {
      bridge.set({
        status: status.value,
        count: count.value,
      })
    })
    return {
      status,
      route,
      count,
      darkTheme,
      hotStatus,
      hotVersion,
      lastError,
      diagnostics,
      countText,
      dispose,
    }
  })
}
