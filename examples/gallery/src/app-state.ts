export interface PersistedAppState {
  readonly version: 1
  readonly count: number
  readonly darkTheme: boolean
  readonly updatedAt: string | null
  readonly recentPageIds?: readonly string[]
  readonly favoritePageIds?: readonly string[]
  readonly route?: string
  readonly searchQuery?: string
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
    recentPageIds: [],
    favoritePageIds: [],
    route: 'home',
    searchQuery: '',
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
    isStringArray(
      (value as PersistedAppState).recentPageIds,
    ) &&
    isStringArray(
      (value as PersistedAppState).favoritePageIds,
    ) &&
    isOptionalString((value as PersistedAppState).route) &&
    isOptionalString((value as PersistedAppState).searchQuery) &&
    (
      (value as PersistedAppState).updatedAt === null ||
      typeof (value as PersistedAppState).updatedAt === 'string'
    )
  )
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isStringArray(value: unknown): boolean {
  return (
    value === undefined ||
    (
      Array.isArray(value) &&
      value.every((item) => typeof item === 'string')
    )
  )
}
