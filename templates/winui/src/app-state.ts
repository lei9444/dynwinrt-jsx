export interface PersistedAppState {
  readonly version: 1
  readonly count: number
  readonly darkTheme: boolean
  readonly updatedAt: string | null
}

export interface AppState extends PersistedAppState {
  readonly status: 'starting' | 'running' | 'closed'
  readonly persistenceError: string | null
}

export function createDefaultPersistedAppState(): PersistedAppState {
  return {
    version: 1,
    count: 0,
    darkTheme: true,
    updatedAt: null,
  }
}

export function isPersistedAppState(
  value: unknown,
): value is PersistedAppState {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as PersistedAppState).version === 1 &&
    Number.isInteger((value as PersistedAppState).count) &&
    (value as PersistedAppState).count >= 0 &&
    typeof (value as PersistedAppState).darkTheme === 'boolean' &&
    (
      (value as PersistedAppState).updatedAt === null ||
      typeof (value as PersistedAppState).updatedAt === 'string'
    )
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
