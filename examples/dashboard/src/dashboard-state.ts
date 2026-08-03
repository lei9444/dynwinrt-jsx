export interface DashboardTask {
  readonly id: number
  readonly title: string
  readonly detail: string
  readonly completed: boolean
}

export interface PersistedDashboardState {
  readonly version: 1
  readonly tasks: readonly DashboardTask[]
  readonly nextTaskId: number
  readonly darkTheme: boolean
  readonly updatedAt: string | null
}

export interface DashboardState extends PersistedDashboardState {
  readonly status: 'starting' | 'running' | 'closed'
  readonly persistenceError: string | null
}

export interface DashboardStatePatch {
  readonly tasks?: readonly DashboardTask[]
  readonly nextTaskId?: number
  readonly darkTheme?: boolean
  readonly updatedAt?: string | null
  readonly status?: DashboardState['status']
  readonly persistenceError?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTask(value: unknown): value is DashboardTask {
  return (
    isRecord(value) &&
    Number.isInteger(value.id) &&
    (value.id as number) > 0 &&
    typeof value.title === 'string' &&
    typeof value.detail === 'string' &&
    typeof value.completed === 'boolean'
  )
}

export function createDefaultPersistedDashboardState():
PersistedDashboardState {
  return {
    version: 1,
    tasks: [
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
    ],
    nextTaskId: 4,
    darkTheme: true,
    updatedAt: null,
  }
}

export function isPersistedDashboardState(
  value: unknown,
): value is PersistedDashboardState {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.tasks) ||
    !value.tasks.every(isTask) ||
    !Number.isInteger(value.nextTaskId) ||
    typeof value.darkTheme !== 'boolean' ||
    !(
      value.updatedAt === null ||
      typeof value.updatedAt === 'string'
    )
  ) {
    return false
  }
  const maxTaskId = value.tasks.reduce(
    (maximum, task) => Math.max(maximum, task.id),
    0,
  )
  const uniqueTaskIds = new Set(value.tasks.map((task) => task.id))
  return (
    uniqueTaskIds.size === value.tasks.length &&
    (value.nextTaskId as number) > maxTaskId
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

export function isDashboardStatePatch(
  value: unknown,
): value is DashboardStatePatch {
  if (!isRecord(value)) {
    return false
  }
  const keys = Object.keys(value)
  if (
    keys.length === 0 ||
    keys.some((key) => ![
      'tasks',
      'nextTaskId',
      'darkTheme',
      'updatedAt',
      'status',
      'persistenceError',
    ].includes(key))
  ) {
    return false
  }
  return (
    (
      value.tasks === undefined ||
      (
        Array.isArray(value.tasks) &&
        value.tasks.every(isTask)
      )
    ) &&
    (
      value.nextTaskId === undefined ||
      Number.isInteger(value.nextTaskId)
    ) &&
    (
      value.darkTheme === undefined ||
      typeof value.darkTheme === 'boolean'
    ) &&
    (
      value.updatedAt === undefined ||
      value.updatedAt === null ||
      typeof value.updatedAt === 'string'
    ) &&
    (
      value.status === undefined ||
      value.status === 'starting' ||
      value.status === 'running' ||
      value.status === 'closed'
    ) &&
    (
      value.persistenceError === undefined ||
      value.persistenceError === null ||
      typeof value.persistenceError === 'string'
    )
  )
}

export function applyDashboardStatePatch(
  state: DashboardState,
  patch: DashboardStatePatch,
): DashboardState {
  return {
    ...state,
    ...patch,
  }
}

export function createDashboardStatePatch(
  previous: DashboardState,
  next: DashboardState,
): DashboardStatePatch {
  const patch: {
    -readonly [Key in keyof DashboardStatePatch]:
      DashboardStatePatch[Key]
  } = {}
  if (previous.tasks !== next.tasks) {
    patch.tasks = next.tasks
  }
  if (previous.nextTaskId !== next.nextTaskId) {
    patch.nextTaskId = next.nextTaskId
  }
  if (previous.darkTheme !== next.darkTheme) {
    patch.darkTheme = next.darkTheme
  }
  if (previous.updatedAt !== next.updatedAt) {
    patch.updatedAt = next.updatedAt
  }
  if (previous.status !== next.status) {
    patch.status = next.status
  }
  if (previous.persistenceError !== next.persistenceError) {
    patch.persistenceError = next.persistenceError
  }
  return patch
}
