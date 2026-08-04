export interface PersistedAppState {
  readonly version: 1
  readonly count: number
}

export interface AppState extends PersistedAppState {
  readonly status: 'starting' | 'running' | 'closed'
  readonly persistenceError: string | null
}

export function createDefaultPersistedAppState():
PersistedAppState {
  return {
    version: 1,
    count: 0,
  }
}

export function isPersistedAppState(
  value: unknown,
): value is PersistedAppState {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as PersistedAppState).version === 1 &&
    Number.isInteger((value as PersistedAppState).count)
  )
}

export function isAppState(value: unknown): value is AppState {
  return (
    isPersistedAppState(value) &&
    (
      (value as AppState).status === 'starting' ||
      (value as AppState).status === 'running' ||
      (value as AppState).status === 'closed'
    ) &&
    (
      (value as AppState).persistenceError === null ||
      typeof (value as AppState).persistenceError === 'string'
    )
  )
}
