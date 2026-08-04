import {
  computed,
  createRoot,
  effect,
  signal,
  type Cleanup,
  type ReadonlySignal,
  type Signal,
} from 'dynwinrt-jsx/core'
import type { StateBridge } from 'dynwinrt-jsx/host'
import type { AppState } from './app-state'

export interface AppModel {
  readonly status: Signal<AppState['status']>
  readonly count: Signal<number>
  readonly countText: ReadonlySignal<string>
  increment(): void
  dispose(): void
}

export function createAppModel(
  bridge: StateBridge<AppState>,
  initialState: AppState,
): AppModel {
  return createRoot((dispose: Cleanup) => {
    const status = signal<AppState['status']>(
      initialState.status,
    )
    const count = signal(initialState.count)
    const countText = computed(
      () => `Count: ${count.value}`,
    )
    effect(() => {
      bridge.set({
        ...initialState,
        status: status.value,
        count: count.value,
        persistenceError: null,
      })
    })
    return {
      status,
      count,
      countText,
      increment() {
        count.value += 1
      },
      dispose,
    }
  })
}
