import type { RendererDiagnostics } from '../renderer/renderer'
import type {
  RendererInspectionSnapshot,
} from '../renderer/inspector'

export type DiagnosticLevel = 'info' | 'warning' | 'error'

export interface DiagnosticRecord {
  readonly timestamp: string
  readonly source: string
  readonly event: string
  readonly level: DiagnosticLevel
  readonly details: Readonly<Record<string, unknown>>
}

export const diagnosticProtocolName =
  'dynwinrt-jsx.diagnostics' as const
export const diagnosticProtocolVersion = 1 as const

export type DiagnosticProtocolKind =
  | 'lifecycle'
  | 'ownership'
  | 'route'
  | 'error'
  | 'snapshot'

export interface DiagnosticLifecycleStateMap {
  readonly host:
    | 'starting'
    | 'running'
    | 'stopping'
    | 'stopped'
    | 'failed'
  readonly worker:
    | 'created'
    | 'starting'
    | 'running'
    | 'stopping'
    | 'stopped'
    | 'failed'
  readonly application:
    | 'starting'
    | 'created'
    | 'running'
    | 'exiting'
    | 'exited'
    | 'failed'
  readonly window:
    | 'creating'
    | 'created'
    | 'activating'
    | 'active'
    | 'closing'
    | 'closed'
    | 'failed'
  readonly renderer:
    | 'creating'
    | 'created'
    | 'mounting'
    | 'mounted'
    | 'disposing'
    | 'idle'
    | 'failed'
  readonly projection:
    | 'creating'
    | 'created'
    | 'active'
    | 'disposing'
    | 'disposed'
    | 'failed'
}

export type DiagnosticLifecycleTarget =
  keyof DiagnosticLifecycleStateMap

export type DiagnosticLifecycleEvent = {
  readonly [Target in DiagnosticLifecycleTarget]: {
    readonly target: Target
    readonly state: DiagnosticLifecycleStateMap[Target]
    readonly stage: string
  }
}[DiagnosticLifecycleTarget]

export type DiagnosticNativeOwnership =
  | 'owned'
  | 'borrowed'
  | 'shared'

export type DiagnosticOwnershipAction =
  | 'acquired'
  | 'released'
  | 'release-failed'
  | 'snapshot'

export interface DiagnosticOwnershipEvent {
  readonly owner: string
  readonly resource: string
  readonly ownership: DiagnosticNativeOwnership
  readonly action: DiagnosticOwnershipAction
  readonly activeCount: number
  readonly counts?: Readonly<Record<string, number>>
}

export type RendererOwnershipCounts = Readonly<
  Record<string, number> & {
    readonly nativeCreated: number
    readonly nativeDisposed: number
    readonly activeNative: number
    readonly componentsMounted: number
    readonly componentsDisposed: number
    readonly activeComponents: number
    readonly listEntriesCreated: number
    readonly listEntriesReused: number
    readonly inspectionNodes: number
    readonly reactiveScopes: number
    readonly reactiveObservers: number
    readonly reactiveDependencies: number
    readonly subscriptions: number
    readonly cleanupFailedSubscriptions: number
  }
>

export type DiagnosticRoutePhase =
  | 'requested'
  | 'committing'
  | 'completed'
  | 'cancelled'
  | 'failed'

export type DiagnosticRouteAction =
  | 'push'
  | 'replace'
  | 'back'
  | 'forward'
  | 'up'
  | 'synchronize'

export type DiagnosticRouteTrigger =
  | 'programmatic'
  | 'native'
  | 'history'
  | 'redirect'

export interface DiagnosticRouteEvent {
  readonly transitionId: string
  readonly phase: DiagnosticRoutePhase
  readonly action: DiagnosticRouteAction
  readonly trigger: DiagnosticRouteTrigger
  readonly fromRoute: string | null
  readonly toRoute: string
  readonly reason?: string
}

export type DiagnosticErrorDetail =
  | 'name'
  | 'message'
  | 'stack'

export interface DiagnosticErrorDescription {
  readonly name: string
  readonly message?: string
  readonly stack?: string
  readonly code?: string | number
  readonly hresult?: number
  readonly aggregateErrorNames?: readonly string[]
}

export interface DiagnosticErrorEvent {
  readonly category: string
  readonly operation: string
  readonly fatal: boolean
  readonly error: DiagnosticErrorDescription
  readonly context?: Readonly<Record<string, unknown>>
}

export interface DiagnosticErrorInput {
  readonly category: string
  readonly operation: string
  readonly fatal?: boolean
  readonly error: unknown
  readonly context?: Readonly<Record<string, unknown>>
  readonly detail?: DiagnosticErrorDetail
}

export interface DiagnosticSnapshotEvent {
  readonly name: string
  readonly data: unknown
}

interface DiagnosticProtocolPayloadMap {
  readonly lifecycle: DiagnosticLifecycleEvent
  readonly ownership: DiagnosticOwnershipEvent
  readonly route: DiagnosticRouteEvent
  readonly error: DiagnosticErrorEvent
  readonly snapshot: DiagnosticSnapshotEvent
}

export interface DiagnosticProtocolEnvelope<
  Kind extends DiagnosticProtocolKind,
  Payload,
> {
  readonly protocol: typeof diagnosticProtocolName
  readonly version: typeof diagnosticProtocolVersion
  readonly sequence: number
  readonly timestamp: string
  readonly source: string
  readonly kind: Kind
  readonly level: DiagnosticLevel
  readonly payload: Payload
}

export type DiagnosticProtocolRecordFor<
  Kind extends DiagnosticProtocolKind,
> = DiagnosticProtocolEnvelope<
  Kind,
  DiagnosticProtocolPayloadMap[Kind]
>

export type DiagnosticProtocolRecord = {
  readonly [Kind in DiagnosticProtocolKind]:
    DiagnosticProtocolRecordFor<Kind>
}[DiagnosticProtocolKind]

type LazyDiagnosticInput<Input> = Input | (() => Input)

export interface DiagnosticChannelOptions {
  readonly source: string
  readonly onRecord: (record: DiagnosticProtocolRecord) => void
  readonly isEnabled?: (kind: DiagnosticProtocolKind) => boolean
  readonly now?: () => Date
  readonly initialSequence?: number
  readonly errorDetail?: DiagnosticErrorDetail
}

export interface DiagnosticChannel {
  readonly sequence: number
  isEnabled(kind: DiagnosticProtocolKind): boolean
  lifecycle(
    event: LazyDiagnosticInput<DiagnosticLifecycleEvent>,
  ): DiagnosticProtocolRecordFor<'lifecycle'> | undefined
  ownership(
    event: LazyDiagnosticInput<DiagnosticOwnershipEvent>,
  ): DiagnosticProtocolRecordFor<'ownership'> | undefined
  route(
    event: LazyDiagnosticInput<DiagnosticRouteEvent>,
  ): DiagnosticProtocolRecordFor<'route'> | undefined
  error(
    event: LazyDiagnosticInput<DiagnosticErrorInput>,
  ): DiagnosticProtocolRecordFor<'error'> | undefined
  snapshot(
    event: LazyDiagnosticInput<DiagnosticSnapshotEvent>,
  ): DiagnosticProtocolRecordFor<'snapshot'> | undefined
}

const diagnosticKinds = new Set<DiagnosticProtocolKind>([
  'lifecycle',
  'ownership',
  'route',
  'error',
  'snapshot',
])
const diagnosticLifecycleStates: Readonly<
  Record<DiagnosticLifecycleTarget, ReadonlySet<string>>
> = {
  host: new Set([
    'starting',
    'running',
    'stopping',
    'stopped',
    'failed',
  ]),
  worker: new Set([
    'created',
    'starting',
    'running',
    'stopping',
    'stopped',
    'failed',
  ]),
  application: new Set([
    'starting',
    'created',
    'running',
    'exiting',
    'exited',
    'failed',
  ]),
  window: new Set([
    'creating',
    'created',
    'activating',
    'active',
    'closing',
    'closed',
    'failed',
  ]),
  renderer: new Set([
    'creating',
    'created',
    'mounting',
    'mounted',
    'disposing',
    'idle',
    'failed',
  ]),
  projection: new Set([
    'creating',
    'created',
    'active',
    'disposing',
    'disposed',
    'failed',
  ]),
}
const diagnosticLifecycleTargets =
  new Set<DiagnosticLifecycleTarget>([
    'host',
    'worker',
    'application',
    'window',
    'renderer',
    'projection',
  ])
const diagnosticOwnerships =
  new Set<DiagnosticNativeOwnership>([
    'owned',
    'borrowed',
    'shared',
  ])
const diagnosticOwnershipActions =
  new Set<DiagnosticOwnershipAction>([
    'acquired',
    'released',
    'release-failed',
    'snapshot',
  ])
const diagnosticRoutePhases =
  new Set<DiagnosticRoutePhase>([
    'requested',
    'committing',
    'completed',
    'cancelled',
    'failed',
  ])
const diagnosticRouteActions =
  new Set<DiagnosticRouteAction>([
    'push',
    'replace',
    'back',
    'forward',
    'up',
    'synchronize',
  ])
const diagnosticRouteTriggers =
  new Set<DiagnosticRouteTrigger>([
    'programmatic',
    'native',
    'history',
    'redirect',
  ])
const diagnosticErrorDetails =
  new Set<DiagnosticErrorDetail>([
    'name',
    'message',
    'stack',
  ])

function requireNonEmptyString(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    throw new TypeError(`${label} must not be empty.`)
  }
  return value
}

function requireNonNegativeInteger(
  value: unknown,
  label: string,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new RangeError(
      `${label} must be a non-negative integer.`,
    )
  }
  return value
}

function requireSetMember<Value extends string>(
  value: unknown,
  values: ReadonlySet<Value>,
  label: string,
): Value {
  if (
    typeof value !== 'string' ||
    !values.has(value as Value)
  ) {
    throw new TypeError(`${label} is not supported.`)
  }
  return value as Value
}

function resolveDiagnosticInput<Input>(
  input: LazyDiagnosticInput<Input>,
): Input {
  return typeof input === 'function'
    ? (input as () => Input)()
    : input
}

function errorName(error: unknown): string {
  if (error instanceof AggregateError) {
    return 'AggregateError'
  }
  if (error instanceof TypeError) {
    return 'TypeError'
  }
  if (error instanceof RangeError) {
    return 'RangeError'
  }
  if (error instanceof ReferenceError) {
    return 'ReferenceError'
  }
  if (error instanceof SyntaxError) {
    return 'SyntaxError'
  }
  if (error instanceof Error) {
    return 'Error'
  }
  return typeof error
}

function readOwnErrorValue(
  error: unknown,
  key: string,
): string | number | undefined {
  if (
    (typeof error !== 'object' || error === null) &&
    typeof error !== 'function'
  ) {
    return undefined
  }
  const descriptor = Object.getOwnPropertyDescriptor(error, key)
  if (!descriptor || !('value' in descriptor)) {
    return undefined
  }
  return typeof descriptor.value === 'string' ||
    typeof descriptor.value === 'number'
    ? descriptor.value
    : undefined
}

export function describeDiagnosticError(
  error: unknown,
  detail: DiagnosticErrorDetail = 'name',
): DiagnosticErrorDescription {
  requireSetMember(
    detail,
    diagnosticErrorDetails,
    'Diagnostic error detail',
  )
  const description: {
    name: string
    message?: string
    stack?: string
    code?: string | number
    hresult?: number
    aggregateErrorNames?: readonly string[]
  } = {
    name: errorName(error),
  }
  const code = readOwnErrorValue(error, 'code')
  if (code !== undefined) {
    description.code = code
  }
  const hresult =
    readOwnErrorValue(error, 'hresult') ??
    readOwnErrorValue(error, 'hResult')
  if (typeof hresult === 'number') {
    description.hresult = hresult
  }
  if (error instanceof AggregateError) {
    description.aggregateErrorNames =
      [...error.errors].map(errorName)
  }
  if (detail !== 'name' && error instanceof Error) {
    description.message = error.message
  }
  if (detail === 'stack' && error instanceof Error) {
    description.stack = error.stack
  }
  return description
}

export function createRendererOwnershipCounts(
  snapshot: RendererInspectionSnapshot,
): RendererOwnershipCounts {
  const diagnostics = snapshot.diagnostics
  return {
    nativeCreated: diagnostics.nativeCreated,
    nativeDisposed: diagnostics.nativeDisposed,
    activeNative: diagnostics.activeNative,
    componentsMounted: diagnostics.componentsMounted,
    componentsDisposed: diagnostics.componentsDisposed,
    activeComponents: diagnostics.activeComponents,
    listEntriesCreated: diagnostics.listEntriesCreated,
    listEntriesReused: diagnostics.listEntriesReused,
    inspectionNodes: snapshot.nodes.length,
    reactiveScopes: snapshot.reactive.scopes.length,
    reactiveObservers: snapshot.reactive.observers.length,
    reactiveDependencies:
      snapshot.reactive.dependencies.length,
    subscriptions: snapshot.subscriptions.length,
    cleanupFailedSubscriptions:
      snapshot.subscriptions.filter(
        (subscription) =>
          subscription.status === 'cleanupFailed',
      ).length,
  }
}

export function createDiagnosticChannel(
  options: DiagnosticChannelOptions,
): DiagnosticChannel {
  const source = requireNonEmptyString(
    options.source,
    'Diagnostic channel source',
  )
  if (typeof options.onRecord !== 'function') {
    throw new TypeError(
      'Diagnostic channel onRecord must be a function.',
    )
  }
  if (
    options.isEnabled !== undefined &&
    typeof options.isEnabled !== 'function'
  ) {
    throw new TypeError(
      'Diagnostic channel isEnabled must be a function.',
    )
  }
  if (
    options.now !== undefined &&
    typeof options.now !== 'function'
  ) {
    throw new TypeError(
      'Diagnostic channel now must be a function.',
    )
  }
  const now = options.now ?? (() => new Date())
  const defaultErrorDetail = requireSetMember(
    options.errorDetail ?? 'name',
    diagnosticErrorDetails,
    'Diagnostic channel errorDetail',
  )
  let sequence = requireNonNegativeInteger(
    options.initialSequence ?? 0,
    'Diagnostic channel initialSequence',
  )

  const isEnabled = (kind: DiagnosticProtocolKind) => {
    const validatedKind = requireSetMember(
      kind,
      diagnosticKinds,
      'Diagnostic protocol kind',
    )
    return options.isEnabled?.(validatedKind) ?? true
  }

  const publish = <Kind extends DiagnosticProtocolKind>(
    kind: Kind,
    level: DiagnosticLevel,
    payload: DiagnosticProtocolPayloadMap[Kind],
  ): DiagnosticProtocolRecordFor<Kind> => {
    const timestamp = now()
    if (
      !(timestamp instanceof Date) ||
      Number.isNaN(timestamp.getTime())
    ) {
      throw new TypeError(
        'Diagnostic channel now() must return a valid Date.',
      )
    }
    sequence += 1
    const record: DiagnosticProtocolRecordFor<Kind> = {
      protocol: diagnosticProtocolName,
      version: diagnosticProtocolVersion,
      sequence,
      timestamp: timestamp.toISOString(),
      source,
      kind,
      level,
      payload,
    }
    return record
  }

  return {
    get sequence() {
      return sequence
    },
    isEnabled,
    lifecycle(input) {
      if (!isEnabled('lifecycle')) {
        return undefined
      }
      const event = resolveDiagnosticInput(input)
      const target = requireSetMember(
        event.target,
        diagnosticLifecycleTargets,
        'Diagnostic lifecycle target',
      )
      requireSetMember(
        event.state,
        diagnosticLifecycleStates[target],
        `Diagnostic lifecycle state for '${target}'`,
      )
      requireNonEmptyString(
        event.stage,
        'Diagnostic lifecycle stage',
      )
      const record = publish(
        'lifecycle',
        event.state === 'failed' ? 'error' : 'info',
        event,
      )
      options.onRecord(record)
      return record
    },
    ownership(input) {
      if (!isEnabled('ownership')) {
        return undefined
      }
      const event = resolveDiagnosticInput(input)
      requireNonEmptyString(
        event.owner,
        'Diagnostic ownership owner',
      )
      requireNonEmptyString(
        event.resource,
        'Diagnostic ownership resource',
      )
      requireSetMember(
        event.ownership,
        diagnosticOwnerships,
        'Diagnostic native ownership',
      )
      requireSetMember(
        event.action,
        diagnosticOwnershipActions,
        'Diagnostic ownership action',
      )
      requireNonNegativeInteger(
        event.activeCount,
        'Diagnostic ownership activeCount',
      )
      for (const [name, count] of Object.entries(
        event.counts ?? {},
      )) {
        requireNonEmptyString(
          name,
          'Diagnostic ownership count name',
        )
        requireNonNegativeInteger(
          count,
          `Diagnostic ownership count '${name}'`,
        )
      }
      const record = publish(
        'ownership',
        event.action === 'release-failed'
          ? 'error'
          : 'info',
        event,
      )
      options.onRecord(record)
      return record
    },
    route(input) {
      if (!isEnabled('route')) {
        return undefined
      }
      const event = resolveDiagnosticInput(input)
      requireNonEmptyString(
        event.transitionId,
        'Diagnostic route transitionId',
      )
      requireNonEmptyString(
        event.toRoute,
        'Diagnostic route toRoute',
      )
      requireSetMember(
        event.phase,
        diagnosticRoutePhases,
        'Diagnostic route phase',
      )
      requireSetMember(
        event.action,
        diagnosticRouteActions,
        'Diagnostic route action',
      )
      requireSetMember(
        event.trigger,
        diagnosticRouteTriggers,
        'Diagnostic route trigger',
      )
      if (event.fromRoute !== null) {
        requireNonEmptyString(
          event.fromRoute,
          'Diagnostic route fromRoute',
        )
      }
      if (event.reason !== undefined) {
        requireNonEmptyString(
          event.reason,
          'Diagnostic route reason',
        )
      }
      const record = publish(
        'route',
        event.phase === 'failed'
          ? 'error'
          : event.phase === 'cancelled'
            ? 'warning'
            : 'info',
        event,
      )
      options.onRecord(record)
      return record
    },
    error(input) {
      if (!isEnabled('error')) {
        return undefined
      }
      const event = resolveDiagnosticInput(input)
      if (
        event.fatal !== undefined &&
        typeof event.fatal !== 'boolean'
      ) {
        throw new TypeError(
          'Diagnostic error fatal must be a boolean.',
        )
      }
      if (
        event.context !== undefined &&
        (
          typeof event.context !== 'object' ||
          event.context === null ||
          Array.isArray(event.context)
        )
      ) {
        throw new TypeError(
          'Diagnostic error context must be an object.',
        )
      }
      const payload: DiagnosticErrorEvent = {
        category: requireNonEmptyString(
          event.category,
          'Diagnostic error category',
        ),
        operation: requireNonEmptyString(
          event.operation,
          'Diagnostic error operation',
        ),
        fatal: event.fatal ?? false,
        error: describeDiagnosticError(
          event.error,
          event.detail ?? defaultErrorDetail,
        ),
        ...(event.context
          ? { context: event.context }
          : {}),
      }
      const record = publish('error', 'error', payload)
      options.onRecord(record)
      return record
    },
    snapshot(input) {
      if (!isEnabled('snapshot')) {
        return undefined
      }
      const event = resolveDiagnosticInput(input)
      requireNonEmptyString(
        event.name,
        'Diagnostic snapshot name',
      )
      if (event.data === undefined) {
        throw new TypeError(
          'Diagnostic snapshot data must not be undefined.',
        )
      }
      const record = publish('snapshot', 'info', event)
      options.onRecord(record)
      return record
    },
  }
}

export function isDiagnosticProtocolRecord(
  value: unknown,
): value is DiagnosticProtocolRecord {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false
  }
  const candidate = value as {
    protocol?: unknown
    version?: unknown
    sequence?: unknown
    timestamp?: unknown
    source?: unknown
    kind?: unknown
    level?: unknown
    payload?: unknown
  }
  if (!(
    candidate.protocol === diagnosticProtocolName &&
    candidate.version === diagnosticProtocolVersion &&
    typeof candidate.sequence === 'number' &&
    Number.isInteger(candidate.sequence) &&
    candidate.sequence > 0 &&
    typeof candidate.timestamp === 'string' &&
    !Number.isNaN(Date.parse(candidate.timestamp)) &&
    typeof candidate.source === 'string' &&
    candidate.source.trim().length > 0 &&
    typeof candidate.kind === 'string' &&
    diagnosticKinds.has(
      candidate.kind as DiagnosticProtocolKind,
    ) &&
    (
      candidate.level === 'info' ||
      candidate.level === 'warning' ||
      candidate.level === 'error'
    ) &&
    typeof candidate.payload === 'object' &&
    candidate.payload !== null
  )) {
    return false
  }
  const payload = candidate.payload as Record<string, unknown>
  if (candidate.kind === 'lifecycle') {
    if (
      typeof payload.target !== 'string' ||
      !Object.hasOwn(
        diagnosticLifecycleStates,
        payload.target,
      )
    ) {
      return false
    }
    const target =
      payload.target as DiagnosticLifecycleTarget
    return (
      typeof payload.state === 'string' &&
      diagnosticLifecycleStates[target].has(
        payload.state,
      ) &&
      typeof payload.stage === 'string' &&
      payload.stage.trim().length > 0
    )
  }
  if (candidate.kind === 'ownership') {
    if (
      typeof payload.owner !== 'string' ||
      payload.owner.trim().length === 0 ||
      typeof payload.resource !== 'string' ||
      payload.resource.trim().length === 0 ||
      typeof payload.ownership !== 'string' ||
      !diagnosticOwnerships.has(
        payload.ownership as DiagnosticNativeOwnership,
      ) ||
      typeof payload.action !== 'string' ||
      !diagnosticOwnershipActions.has(
        payload.action as DiagnosticOwnershipAction,
      ) ||
      typeof payload.activeCount !== 'number' ||
      !Number.isInteger(payload.activeCount) ||
      payload.activeCount < 0
    ) {
      return false
    }
    if (payload.counts === undefined) {
      return true
    }
    if (
      typeof payload.counts !== 'object' ||
      payload.counts === null
    ) {
      return false
    }
    return Object.entries(payload.counts).every(
      ([name, count]) =>
        name.trim().length > 0 &&
        typeof count === 'number' &&
        Number.isInteger(count) &&
        count >= 0,
    )
  }
  if (candidate.kind === 'route') {
    return (
      typeof payload.transitionId === 'string' &&
      payload.transitionId.trim().length > 0 &&
      typeof payload.phase === 'string' &&
      diagnosticRoutePhases.has(
        payload.phase as DiagnosticRoutePhase,
      ) &&
      typeof payload.action === 'string' &&
      diagnosticRouteActions.has(
        payload.action as DiagnosticRouteAction,
      ) &&
      typeof payload.trigger === 'string' &&
      diagnosticRouteTriggers.has(
        payload.trigger as DiagnosticRouteTrigger,
      ) &&
      (
        payload.fromRoute === null ||
        (
          typeof payload.fromRoute === 'string' &&
          payload.fromRoute.trim().length > 0
        )
      ) &&
      typeof payload.toRoute === 'string' &&
      payload.toRoute.trim().length > 0 &&
      (
        payload.reason === undefined ||
        (
          typeof payload.reason === 'string' &&
          payload.reason.trim().length > 0
        )
      )
    )
  }
  if (candidate.kind === 'error') {
    if (
      typeof payload.category !== 'string' ||
      payload.category.trim().length === 0 ||
      typeof payload.operation !== 'string' ||
      payload.operation.trim().length === 0 ||
      typeof payload.fatal !== 'boolean' ||
      typeof payload.error !== 'object' ||
      payload.error === null
    ) {
      return false
    }
    const error = payload.error as Record<string, unknown>
    if (
      typeof error.name === 'string' &&
      error.name.trim().length > 0
    ) {
      return (
        (
          error.message === undefined ||
          typeof error.message === 'string'
        ) &&
        (
          error.stack === undefined ||
          typeof error.stack === 'string'
        ) &&
        (
          error.code === undefined ||
          typeof error.code === 'string' ||
          typeof error.code === 'number'
        ) &&
        (
          error.hresult === undefined ||
          typeof error.hresult === 'number'
        ) &&
        (
          error.aggregateErrorNames === undefined ||
          (
            Array.isArray(error.aggregateErrorNames) &&
            error.aggregateErrorNames.every(
              (name) => typeof name === 'string',
            )
          )
        ) &&
        (
          payload.context === undefined ||
          (
            typeof payload.context === 'object' &&
            payload.context !== null &&
            !Array.isArray(payload.context)
          )
        )
      )
    }
    return false
  }
  return (
    typeof payload.name === 'string' &&
    payload.name.trim().length > 0 &&
    payload.data !== undefined
  )
}

export function formatDiagnosticProtocolRecord(
  record: DiagnosticProtocolRecord,
): string {
  return JSON.stringify(record)
}

export function createDiagnosticRecord(
  source: string,
  event: string,
  details: Readonly<Record<string, unknown>> = {},
  level: DiagnosticLevel = 'info',
): DiagnosticRecord {
  return {
    timestamp: new Date().toISOString(),
    source,
    event,
    level,
    details,
  }
}

export function formatDiagnosticRecord(
  record: DiagnosticRecord,
): string {
  return JSON.stringify(record)
}

export function hasActiveRendererRecords(
  diagnostics: RendererDiagnostics,
): boolean {
  return (
    diagnostics.activeNative !== 0 ||
    diagnostics.activeComponents !== 0
  )
}

export function assertRendererIdle(
  diagnostics: RendererDiagnostics,
  label = 'Renderer disposal',
): void {
  if (hasActiveRendererRecords(diagnostics)) {
    throw new Error(
      `${label} left active records: ${JSON.stringify(diagnostics)}`,
    )
  }
}

export function formatRendererDiagnostics(
  diagnostics: RendererDiagnostics,
): string {
  return [
    `native ${diagnostics.activeNative} active`,
    `components ${diagnostics.activeComponents} active`,
    `lists ${diagnostics.listEntriesCreated} created`,
    `${diagnostics.listEntriesReused} reused`,
  ].join(' · ')
}
