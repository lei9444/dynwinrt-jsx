import {
  batch,
  signal,
  type Cleanup,
  type ReadonlySignal,
} from '../core/reactive'

export interface MessageTransport {
  postMessage(message: unknown): void
  subscribe(listener: (message: unknown) => void): Cleanup
}

export interface MessageEndpoint {
  postMessage(message: unknown): void
  addEventListener?(
    type: 'message',
    listener: (event: { data: unknown }) => void,
  ): void
  removeEventListener?(
    type: 'message',
    listener: (event: { data: unknown }) => void,
  ): void
  on?(type: 'message', listener: (message: unknown) => void): unknown
  off?(type: 'message', listener: (message: unknown) => void): unknown
  removeListener?(
    type: 'message',
    listener: (message: unknown) => void,
  ): unknown
  start?(): void
}

export function createMessageTransport(
  endpoint: MessageEndpoint,
): MessageTransport {
  return {
    postMessage(message) {
      endpoint.postMessage(message)
    },
    subscribe(listener) {
      if (
        endpoint.addEventListener &&
        endpoint.removeEventListener
      ) {
        const eventListener = (event: { data: unknown }) => {
          listener(event.data)
        }
        endpoint.addEventListener('message', eventListener)
        endpoint.start?.()
        return () => {
          endpoint.removeEventListener?.('message', eventListener)
        }
      }

      if (endpoint.on) {
        endpoint.on('message', listener)
        return () => {
          if (endpoint.off) {
            endpoint.off('message', listener)
          } else {
            endpoint.removeListener?.('message', listener)
          }
        }
      }

      throw new TypeError(
        'Message endpoint must support addEventListener or on("message").',
      )
    },
  }
}

const bridgeProtocol = 'dynwinrt-jsx.state.v2'

type BridgePayload =
  | {
      readonly type: 'request'
      readonly requestId: number
    }
  | {
      readonly type: 'ack'
      readonly requestId: number
      readonly revision: number
    }
  | {
      readonly type: 'ready'
      readonly requestId: number
      readonly revision: number
    }
  | {
      readonly type: 'set'
      readonly baseRevision: number
      readonly generation: number
      readonly requestId: number
      readonly value: unknown
    }
  | {
      readonly type: 'state'
      readonly generation?: number
      readonly revision: number
      readonly requestId?: number
      readonly value: unknown
    }
  | {
      readonly type: 'patch'
      readonly baseRevision: number
      readonly generation?: number
      readonly revision?: number
      readonly requestId?: number
      readonly value: unknown
    }
  | {
      readonly type: 'command'
      readonly generation: number
      readonly revision: number
      readonly value: unknown
    }
  | {
      readonly type: 'event'
      readonly revision: number
      readonly value: unknown
    }
  | {
      readonly type: 'conflict'
      readonly expectedRevision: number
      readonly generation: number
      readonly receivedRevision: number
      readonly requestId?: number
      readonly value: unknown
    }
  | {
      readonly type: 'reject'
      readonly code: StateBridgeDiagnosticCode
      readonly generation: number
      readonly revision: number
      readonly requestId?: number
      readonly value: unknown
    }

interface BridgeMessageEnvelope {
  readonly protocol: typeof bridgeProtocol
  readonly channel: string
  readonly type: string
  readonly [key: string]: unknown
}

function readBridgeMessage(
  value: unknown,
  channel: string,
): BridgeMessageEnvelope | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const message = value as Partial<BridgeMessageEnvelope>
  if (
    message.protocol !== bridgeProtocol ||
    message.channel !== channel
  ) {
    return null
  }
  return message as BridgeMessageEnvelope
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isRequestId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function isGeneration(value: unknown): value is number {
  return isRequestId(value)
}

export type StateBridgeRole = 'host' | 'client'

export type StateBridgeValidator<Value> = (
  value: unknown,
) => value is Value

export interface StateBridgePatchOptions<State, Patch> {
  readonly validate: StateBridgeValidator<Patch>
  readonly apply: (state: State, patch: Patch) => State
}

export interface StateBridgeMessageContext {
  readonly channel: string
  readonly revision: number
}

export interface StateBridgeCommandOptions<Command> {
  readonly validate: StateBridgeValidator<Command>
  readonly handle?: (
    command: Command,
    context: StateBridgeMessageContext,
  ) => void
}

export interface StateBridgeEventOptions<Event> {
  readonly validate: StateBridgeValidator<Event>
  readonly handle?: (
    event: Event,
    context: StateBridgeMessageContext,
  ) => void
}

export type StateBridgeDiagnosticCode =
  | 'disposed-before-ready'
  | 'invalid-command'
  | 'invalid-event'
  | 'invalid-initial-state'
  | 'invalid-message'
  | 'invalid-patch'
  | 'invalid-state'
  | 'patch-application-failed'
  | 'revision-conflict'
  | 'unexpected-message'

export interface StateBridgeDiagnostic {
  readonly code: StateBridgeDiagnosticCode
  readonly severity: 'warning' | 'error'
  readonly role: StateBridgeRole
  readonly channel: string
  readonly direction: 'local' | 'inbound'
  readonly message: string
  readonly expectedRevision?: number
  readonly receivedRevision?: number
}

export class StateBridgeError extends Error {
  readonly diagnostic: StateBridgeDiagnostic

  constructor(diagnostic: StateBridgeDiagnostic) {
    super(diagnostic.message)
    this.name = 'StateBridgeError'
    this.diagnostic = diagnostic
  }
}

export interface StateBridgeOptions<
  State,
  Patch = never,
  Command = never,
  Event = never,
> {
  readonly role: StateBridgeRole
  readonly initial: State
  readonly channel?: string
  readonly validate: StateBridgeValidator<State>
  readonly patch?: StateBridgePatchOptions<State, Patch>
  readonly commands?: StateBridgeCommandOptions<Command>
  readonly events?: StateBridgeEventOptions<Event>
  readonly onDiagnostic?: (
    diagnostic: StateBridgeDiagnostic,
  ) => void
}

export interface StateBridge<
  State,
  Patch = never,
  Command = never,
  Event = never,
> {
  readonly state: ReadonlySignal<State>
  readonly revision: ReadonlySignal<number>
  readonly lastDiagnostic:
    ReadonlySignal<StateBridgeDiagnostic | null>
  readonly ready: Promise<void>
  readonly disposed: boolean
  readonly failed: boolean
  set(value: State): void
  update(updater: (previous: State) => State): void
  patch(value: Patch): void
  sendCommand(command: Command): void
  emitEvent(event: Event): void
  dispose(): void
}

interface PendingRequest {
  readonly kind: 'set' | 'patch'
  readonly generation: number
  readonly revision: number
}

export function createStateBridge<
  State,
  Patch = never,
  Command = never,
  Event = never,
>(
  transport: MessageTransport,
  options: StateBridgeOptions<State, Patch, Command, Event>,
): StateBridge<State, Patch, Command, Event> {
  const channel = options.channel ?? 'default'
  if (
    (options.role !== 'host' && options.role !== 'client') ||
    channel.length === 0 ||
    typeof options.validate !== 'function'
  ) {
    throw new TypeError(
      'State bridge options require a role, non-empty channel, and state validator.',
    )
  }
  if (
    options.patch &&
    (
      typeof options.patch.validate !== 'function' ||
      typeof options.patch.apply !== 'function'
    )
  ) {
    throw new TypeError(
      'State bridge patch options require validate() and apply().',
    )
  }
  if (
    options.commands &&
    (
      typeof options.commands.validate !== 'function' ||
      (
        options.role === 'host' &&
        typeof options.commands.handle !== 'function'
      )
    )
  ) {
    throw new TypeError(
      'State bridge command options require validate() and handle().',
    )
  }
  if (
    options.events &&
    (
      typeof options.events.validate !== 'function' ||
      (
        options.role === 'client' &&
        typeof options.events.handle !== 'function'
      )
    )
  ) {
    throw new TypeError(
      'State bridge event options require validate() and handle().',
    )
  }

  const createDiagnostic = (
    code: StateBridgeDiagnosticCode,
    severity: StateBridgeDiagnostic['severity'],
    direction: StateBridgeDiagnostic['direction'],
    message: string,
    revisions: {
      readonly expectedRevision?: number
      readonly receivedRevision?: number
    } = {},
  ): StateBridgeDiagnostic => ({
    code,
    severity,
    role: options.role,
    channel,
    direction,
    message,
    ...revisions,
  })
  if (!options.validate(options.initial)) {
    throw new StateBridgeError(createDiagnostic(
      'invalid-initial-state',
      'error',
      'local',
      `Initial state for channel "${channel}" failed schema validation.`,
    ))
  }

  const state = signal(options.initial)
  const revision = signal(0)
  const lastDiagnostic =
    signal<StateBridgeDiagnostic | null>(null)
  const pendingRequests = new Map<number, PendingRequest>()
  const rejectedClientGenerations = new Set<number>()
  const queuedCommands: Command[] = []
  const queuedEvents: Event[] = []
  let disposed = false
  let resolveReady: (() => void) | undefined
  let rejectReady: ((error: unknown) => void) | undefined
  let readyResolved = options.role === 'host'
  let readyRejected = false
  let nextRequestId = 1
  let readyRequestId = options.role === 'client'
    ? nextRequestId++
    : undefined
  let clientGeneration = 1
  let clientTransitionDepth = 0
  let hostTransitionDepth = 0
  const ready = readyResolved
    ? Promise.resolve()
    : new Promise<void>((resolve, reject) => {
        resolveReady = resolve
        rejectReady = reject
      })
  void ready.catch(() => {})

  const report = (diagnostic: StateBridgeDiagnostic) => {
    lastDiagnostic.value = diagnostic
    options.onDiagnostic?.(diagnostic)
    return new StateBridgeError(diagnostic)
  }

  const rejectClientReady = (error: StateBridgeError) => {
    if (readyResolved || readyRejected) {
      return
    }
    readyRejected = true
    rejectReady?.(error)
    resolveReady = undefined
    rejectReady = undefined
  }

  const resolveClientReady = () => {
    if (readyResolved || readyRejected) {
      return
    }
    readyResolved = true
    resolveReady?.()
    resolveReady = undefined
    rejectReady = undefined
  }

  const send = (message: BridgePayload) => {
    if (disposed) {
      throw new Error('Cannot send through a disposed state bridge.')
    }

    transport.postMessage({
      protocol: bridgeProtocol,
      channel,
      ...message,
    })
  }

  const sendSnapshotRequest = (
    requestId = nextRequestId++,
  ) => {
    send({
      type: 'request',
      requestId,
    })
    return requestId
  }

  const sendCommandNow = (command: Command) => {
    send({
      type: 'command',
      generation: clientGeneration,
      revision: revision.peek(),
      value: command,
    })
  }

  const flushQueuedCommands = () => {
    if (clientTransitionDepth > 0) {
      return
    }
    while (queuedCommands.length > 0) {
      sendCommandNow(queuedCommands.shift()!)
    }
  }

  const sendEventNow = (event: Event) => {
    send({
      type: 'event',
      revision: revision.peek(),
      value: event,
    })
  }

  const flushQueuedEvents = () => {
    if (hostTransitionDepth > 0) {
      return
    }
    while (queuedEvents.length > 0) {
      sendEventNow(queuedEvents.shift()!)
    }
  }

  const publishState = (
    requestId?: number,
    generation?: number,
  ) => {
    send({
      type: 'state',
      revision: revision.peek(),
      ...(requestId === undefined ? {} : { requestId }),
      ...(generation === undefined ? {} : { generation }),
      value: state.peek(),
    })
  }

  const applyHostState = (
    next: State,
    requestId?: number,
    generation?: number,
  ) => {
    hostTransitionDepth += 1
    let published = false
    try {
      batch(() => {
        state.value = next
        revision.value += 1
      })
      publishState(requestId, generation)
      published = true
    }
    finally {
      hostTransitionDepth -= 1
      if (published) {
        flushQueuedEvents()
      }
      else if (hostTransitionDepth === 0) {
        queuedEvents.length = 0
      }
    }
  }

  const applyPatch = (current: State, value: Patch): State => {
    if (!options.patch) {
      throw new StateBridgeError(createDiagnostic(
        'invalid-patch',
        'error',
        'local',
        `State patches are not configured for channel "${channel}".`,
      ))
    }
    return options.patch.apply(current, value)
  }

  const publishPatch = (
    value: Patch,
    baseRevision: number,
    nextRevision: number,
    requestId?: number,
    generation?: number,
  ) => {
    send({
      type: 'patch',
      baseRevision,
      ...(generation === undefined ? {} : { generation }),
      revision: nextRevision,
      ...(requestId === undefined ? {} : { requestId }),
      value,
    })
  }

  const applyHostPatch = (
    value: Patch,
    requestId?: number,
    generation?: number,
  ) => {
    const baseRevision = revision.peek()
    const next = applyPatch(state.peek(), value)
    if (!options.validate(next)) {
      throw new StateBridgeError(createDiagnostic(
        'invalid-state',
        'error',
        'local',
        `Applying a state patch for channel "${channel}" produced invalid state.`,
      ))
    }
    hostTransitionDepth += 1
    let published = false
    try {
      batch(() => {
        state.value = next
        revision.value = baseRevision + 1
      })
      publishPatch(
        value,
        baseRevision,
        baseRevision + 1,
        requestId,
        generation,
      )
      published = true
    }
    finally {
      hostTransitionDepth -= 1
      if (published) {
        flushQueuedEvents()
      }
      else if (hostTransitionDepth === 0) {
        queuedEvents.length = 0
      }
    }
  }

  const resetClientState = (
    next: unknown,
    nextRevision: unknown,
  ): boolean => {
    if (
      !isRevision(nextRevision) ||
      !options.validate(next)
    ) {
      const error = report(createDiagnostic(
        'invalid-state',
        'error',
        'inbound',
        `Authoritative state for channel "${channel}" failed schema validation.`,
      ))
      rejectClientReady(error)
      return false
    }
    batch(() => {
      state.value = next
      revision.value = nextRevision
    })
    pendingRequests.clear()
    queuedCommands.length = 0
    return true
  }

  const sendConflict = (
    receivedRevision: number,
    generation: number,
    requestId?: number,
  ) => {
    const expectedRevision = revision.peek()
    report(createDiagnostic(
      'revision-conflict',
      'warning',
      'inbound',
      `State update for channel "${channel}" targeted revision ${receivedRevision}, but the Host is at revision ${expectedRevision}.`,
      { expectedRevision, receivedRevision },
    ))
    send({
      type: 'conflict',
      expectedRevision,
      generation,
      receivedRevision,
      ...(requestId === undefined ? {} : { requestId }),
      value: state.peek(),
    })
  }

  const sendRejection = (
    code: StateBridgeDiagnosticCode,
    generation: number,
    requestId?: number,
  ) => {
    send({
      type: 'reject',
      code,
      generation,
      revision: revision.peek(),
      ...(requestId === undefined ? {} : { requestId }),
      value: state.peek(),
    })
  }

  const unsubscribe = transport.subscribe((rawMessage) => {
    if (disposed || readyRejected) {
      return
    }
    const raw = readBridgeMessage(rawMessage, channel)
    if (!raw) {
      return
    }

    if (options.role === 'host') {
      if (raw.type === 'request') {
        if (!isRequestId(raw.requestId)) {
          report(createDiagnostic(
            'invalid-message',
            'error',
            'inbound',
            `State request for channel "${channel}" has an invalid request ID.`,
          ))
          return
        }
        publishState(raw.requestId)
        return
      }
      if (raw.type === 'ack') {
        if (
          !isRequestId(raw.requestId) ||
          !isRevision(raw.revision)
        ) {
          report(createDiagnostic(
            'invalid-message',
            'error',
            'inbound',
            `State acknowledgement for channel "${channel}" is invalid.`,
          ))
          return
        }
        if (raw.revision !== revision.peek()) {
          publishState(raw.requestId)
          return
        }
        send({
          type: 'ready',
          requestId: raw.requestId,
          revision: raw.revision,
        })
        return
      }
      if (raw.type === 'set') {
        if (
          !isRevision(raw.baseRevision) ||
          !isGeneration(raw.generation) ||
          !isRequestId(raw.requestId)
        ) {
          report(createDiagnostic(
            'invalid-message',
            'error',
            'inbound',
            `State set message for channel "${channel}" has an invalid revision or request ID.`,
          ))
          if (
            isRequestId(raw.requestId) &&
            isGeneration(raw.generation)
          ) {
            sendRejection(
              'invalid-message',
              raw.generation,
              raw.requestId,
            )
          }
          return
        }
        if (rejectedClientGenerations.has(raw.generation)) {
          sendRejection(
            'revision-conflict',
            raw.generation,
            raw.requestId,
          )
          return
        }
        if (raw.baseRevision !== revision.peek()) {
          rejectedClientGenerations.add(raw.generation)
          sendConflict(
            raw.baseRevision,
            raw.generation,
            raw.requestId,
          )
          return
        }
        if (!options.validate(raw.value)) {
          report(createDiagnostic(
            'invalid-state',
            'error',
            'inbound',
            `State set message for channel "${channel}" failed schema validation.`,
          ))
          rejectedClientGenerations.add(raw.generation)
          sendRejection(
            'invalid-state',
            raw.generation,
            raw.requestId,
          )
          return
        }
        applyHostState(
          raw.value,
          raw.requestId,
          raw.generation,
        )
        return
      }
      if (raw.type === 'patch') {
        if (
          !isRevision(raw.baseRevision) ||
          !isGeneration(raw.generation) ||
          !isRequestId(raw.requestId) ||
          !options.patch ||
          !options.patch.validate(raw.value)
        ) {
          report(createDiagnostic(
            'invalid-patch',
            'error',
            'inbound',
            `State patch message for channel "${channel}" failed schema validation.`,
          ))
          if (
            isRequestId(raw.requestId) &&
            isGeneration(raw.generation)
          ) {
            rejectedClientGenerations.add(raw.generation)
            sendRejection(
              'invalid-patch',
              raw.generation,
              raw.requestId,
            )
          }
          return
        }
        if (rejectedClientGenerations.has(raw.generation)) {
          sendRejection(
            'revision-conflict',
            raw.generation,
            raw.requestId,
          )
          return
        }
        if (raw.baseRevision !== revision.peek()) {
          rejectedClientGenerations.add(raw.generation)
          sendConflict(
            raw.baseRevision,
            raw.generation,
            raw.requestId,
          )
          return
        }
        try {
          applyHostPatch(
            raw.value,
            raw.requestId,
            raw.generation,
          )
        }
        catch (error) {
          report(createDiagnostic(
            'patch-application-failed',
            'error',
            'inbound',
            `State patch for channel "${channel}" could not be applied: ${String(error)}`,
          ))
          rejectedClientGenerations.add(raw.generation)
          sendRejection(
            'patch-application-failed',
            raw.generation,
            raw.requestId,
          )
        }
        return
      }
      if (raw.type === 'command') {
        if (
          !isRevision(raw.revision) ||
          !isGeneration(raw.generation) ||
          !options.commands ||
          !options.commands.validate(raw.value)
        ) {
          report(createDiagnostic(
            'invalid-command',
            'error',
            'inbound',
            `Command for channel "${channel}" failed schema validation.`,
          ))
          return
        }
        if (rejectedClientGenerations.has(raw.generation)) {
          return
        }
        if (raw.revision !== revision.peek()) {
          rejectedClientGenerations.add(raw.generation)
          sendConflict(
            raw.revision,
            raw.generation,
          )
          return
        }
        options.commands.handle!(raw.value, {
          channel,
          revision: raw.revision,
        })
        return
      }
      report(createDiagnostic(
        'unexpected-message',
        'warning',
        'inbound',
        `Host state bridge for channel "${channel}" received unexpected message type "${raw.type}".`,
      ))
      return
    }

    if (raw.type === 'ready') {
      if (readyResolved) {
        return
      }
      if (
        !isRequestId(raw.requestId) ||
        !isRevision(raw.revision) ||
        raw.requestId !== readyRequestId ||
        raw.revision !== revision.peek()
      ) {
        report(createDiagnostic(
          'invalid-message',
          'error',
          'inbound',
          `State readiness acknowledgement for channel "${channel}" is invalid or stale.`,
        ))
        if (!readyResolved && readyRequestId !== undefined) {
          sendSnapshotRequest(readyRequestId)
        }
        return
      }
      resolveClientReady()
      return
    }

    if (raw.type === 'state') {
      if (
        !readyResolved &&
        raw.requestId !== readyRequestId
      ) {
        sendSnapshotRequest(readyRequestId!)
        return
      }
      if (
        !isRevision(raw.revision) ||
        !options.validate(raw.value) ||
        (
          raw.requestId !== undefined &&
          !isRequestId(raw.requestId)
        )
      ) {
        const error = report(createDiagnostic(
          'invalid-state',
          'error',
          'inbound',
          `State message for channel "${channel}" failed schema validation.`,
        ))
        rejectClientReady(error)
        return
      }
      if (!readyResolved) {
        batch(() => {
          state.value = raw.value as State
          revision.value = raw.revision as number
        })
        send({
          type: 'ack',
          requestId: raw.requestId as number,
          revision: raw.revision as number,
        })
        return
      }
      const currentRevision = revision.peek()
      const pending = isRequestId(raw.requestId)
        ? pendingRequests.get(raw.requestId)
        : undefined
      if (
        pending &&
        (
          !isGeneration(raw.generation) ||
          pending.generation !== raw.generation
        )
      ) {
        return
      }
      if (
        pending?.kind === 'set' &&
        pending.revision === raw.revision
      ) {
        pendingRequests.delete(raw.requestId as number)
        if (raw.revision < currentRevision) {
          return
        }
      } else if (raw.revision < currentRevision) {
        return
      } else if (
        raw.revision === currentRevision &&
        pendingRequests.size > 0
      ) {
        report(createDiagnostic(
          'revision-conflict',
          'warning',
          'inbound',
          `State message for channel "${channel}" conflicted with a pending Client update.`,
          {
            expectedRevision: currentRevision,
            receivedRevision: raw.revision,
          },
        ))
        sendSnapshotRequest()
        return
      }
      batch(() => {
        state.value = raw.value as State
        revision.value = raw.revision as number
      })
      for (const [requestId, request] of pendingRequests) {
        if (request.revision <= (raw.revision as number)) {
          pendingRequests.delete(requestId)
        }
      }
      return
    }

    if (raw.type === 'patch') {
      if (
        !isRevision(raw.baseRevision) ||
        !isRevision(raw.revision) ||
        raw.revision !== raw.baseRevision + 1 ||
        (
          raw.requestId !== undefined &&
          !isRequestId(raw.requestId)
        ) ||
        !options.patch ||
        !options.patch.validate(raw.value)
      ) {
        report(createDiagnostic(
          'invalid-patch',
          'error',
          'inbound',
          `State patch message for channel "${channel}" failed schema validation.`,
        ))
        sendSnapshotRequest()
        return
      }
      const pending = isRequestId(raw.requestId)
        ? pendingRequests.get(raw.requestId)
        : undefined
      if (
        pending &&
        (
          !isGeneration(raw.generation) ||
          pending.generation !== raw.generation
        )
      ) {
        return
      }
      if (
        pending?.kind === 'patch' &&
        pending.revision === raw.revision
      ) {
        pendingRequests.delete(raw.requestId as number)
        return
      }
      const currentRevision = revision.peek()
      if ((raw.revision as number) <= currentRevision) {
        return
      }
      if (raw.baseRevision !== currentRevision) {
        report(createDiagnostic(
          'revision-conflict',
          'warning',
          'inbound',
          `State patch for channel "${channel}" expected Client revision ${raw.baseRevision}, but the Client is at revision ${currentRevision}.`,
          {
            expectedRevision: raw.baseRevision as number,
            receivedRevision: currentRevision,
          },
        ))
        sendSnapshotRequest()
        return
      }
      let next: State
      try {
        next = applyPatch(state.peek(), raw.value as Patch)
      }
      catch (error) {
        report(createDiagnostic(
          'patch-application-failed',
          'error',
          'inbound',
          `State patch for channel "${channel}" could not be applied: ${String(error)}`,
        ))
        sendSnapshotRequest()
        return
      }
      if (!options.validate(next)) {
        report(createDiagnostic(
          'invalid-state',
          'error',
          'inbound',
          `State patch for channel "${channel}" produced invalid state.`,
        ))
        sendSnapshotRequest()
        return
      }
      batch(() => {
        state.value = next
        revision.value = raw.revision as number
      })
      return
    }

    if (raw.type === 'conflict') {
      if (
        !isRevision(raw.expectedRevision) ||
        !isRevision(raw.receivedRevision) ||
        !isGeneration(raw.generation)
      ) {
        report(createDiagnostic(
          'invalid-message',
          'error',
          'inbound',
          `Revision conflict message for channel "${channel}" is invalid.`,
        ))
        return
      }
      if (raw.generation !== clientGeneration) {
        return
      }
      report(createDiagnostic(
        'revision-conflict',
        'warning',
        'inbound',
        `Client state update for channel "${channel}" targeted revision ${raw.receivedRevision}, but the Host is at revision ${raw.expectedRevision}.`,
        {
          expectedRevision: raw.expectedRevision,
          receivedRevision: raw.receivedRevision,
        },
      ))
      clientGeneration = raw.generation + 1
      resetClientState(raw.value, raw.expectedRevision)
      return
    }

    if (raw.type === 'reject') {
      if (
        typeof raw.code !== 'string' ||
        !isRevision(raw.revision) ||
        !isGeneration(raw.generation)
      ) {
        report(createDiagnostic(
          'invalid-message',
          'error',
          'inbound',
          `State rejection message for channel "${channel}" is invalid.`,
        ))
        return
      }
      if (raw.generation !== clientGeneration) {
        return
      }
      const code = raw.code as StateBridgeDiagnosticCode
      report(createDiagnostic(
        code,
        'error',
        'inbound',
        `Host rejected a state update for channel "${channel}" with code "${code}".`,
      ))
      clientGeneration = raw.generation + 1
      resetClientState(raw.value, raw.revision)
      return
    }

    if (raw.type === 'event') {
      if (
        !isRevision(raw.revision) ||
        !options.events ||
        !options.events.validate(raw.value)
      ) {
        report(createDiagnostic(
          'invalid-event',
          'error',
          'inbound',
          `Event for channel "${channel}" failed schema validation.`,
        ))
        return
      }
      if (raw.revision > revision.peek()) {
        report(createDiagnostic(
          'revision-conflict',
          'warning',
          'inbound',
          `Event for channel "${channel}" references future revision ${raw.revision}.`,
          {
            expectedRevision: revision.peek(),
            receivedRevision: raw.revision,
          },
        ))
        sendSnapshotRequest()
        return
      }
      options.events.handle!(raw.value, {
        channel,
        revision: raw.revision,
      })
      return
    }

    report(createDiagnostic(
      'unexpected-message',
      'warning',
      'inbound',
      `Client state bridge for channel "${channel}" received unexpected message type "${raw.type}".`,
    ))
  })

  if (options.role === 'client') {
    sendSnapshotRequest(readyRequestId!)
  } else {
    publishState()
  }

  return {
    state,
    revision,
    lastDiagnostic,
    ready,
    get disposed() {
      return disposed
    },
    get failed() {
      return readyRejected
    },
    set(value) {
      if (disposed) {
        throw new Error('Cannot update a disposed state bridge.')
      }
      if (options.role === 'client' && !readyResolved) {
        throw new Error(
          readyRejected
            ? 'Cannot update a failed state bridge.'
            : 'Client state bridge must synchronize before updates.',
        )
      }
      if (!options.validate(value)) {
        throw new StateBridgeError(createDiagnostic(
          'invalid-state',
          'error',
          'local',
          `State update for channel "${channel}" failed schema validation.`,
        ))
      }

      if (options.role === 'host') {
        applyHostState(value)
      } else {
        const previous = state.peek()
        const baseRevision = revision.peek()
        const requestId = nextRequestId++
        const generation = clientGeneration
        const queuedCommandCount = queuedCommands.length
        pendingRequests.set(requestId, {
          kind: 'set',
          generation,
          revision: baseRevision + 1,
        })
        clientTransitionDepth += 1
        let sent = false
        try {
          batch(() => {
            state.value = value
            revision.value = baseRevision + 1
          })
          send({
            type: 'set',
            baseRevision,
            generation,
            requestId,
            value,
          })
          sent = true
        }
        catch (error) {
          pendingRequests.delete(requestId)
          queuedCommands.splice(queuedCommandCount)
          batch(() => {
            state.value = previous
            revision.value = baseRevision
          })
          queuedCommands.splice(queuedCommandCount)
          throw error
        }
        finally {
          clientTransitionDepth -= 1
          if (sent) {
            flushQueuedCommands()
          }
        }
      }
    },
    update(updater) {
      this.set(updater(state.peek()))
    },
    patch(value) {
      if (disposed) {
        throw new Error('Cannot update a disposed state bridge.')
      }
      if (options.role === 'client' && !readyResolved) {
        throw new Error(
          readyRejected
            ? 'Cannot update a failed state bridge.'
            : 'Client state bridge must synchronize before updates.',
        )
      }
      if (!options.patch || !options.patch.validate(value)) {
        throw new StateBridgeError(createDiagnostic(
          'invalid-patch',
          'error',
          'local',
          `State patch for channel "${channel}" failed schema validation.`,
        ))
      }
      if (options.role === 'host') {
        applyHostPatch(value)
        return
      }
      const previous = state.peek()
      const baseRevision = revision.peek()
      const next = applyPatch(previous, value)
      if (!options.validate(next)) {
        throw new StateBridgeError(createDiagnostic(
          'invalid-state',
          'error',
          'local',
          `State patch for channel "${channel}" produced invalid state.`,
        ))
      }
      const requestId = nextRequestId++
      const generation = clientGeneration
      const queuedCommandCount = queuedCommands.length
      pendingRequests.set(requestId, {
        kind: 'patch',
        generation,
        revision: baseRevision + 1,
      })
      clientTransitionDepth += 1
      let sent = false
      try {
        batch(() => {
          state.value = next
          revision.value = baseRevision + 1
        })
        send({
          type: 'patch',
          baseRevision,
          generation,
          requestId,
          value,
        })
        sent = true
      }
      catch (error) {
        pendingRequests.delete(requestId)
        queuedCommands.splice(queuedCommandCount)
        batch(() => {
          state.value = previous
          revision.value = baseRevision
        })
        queuedCommands.splice(queuedCommandCount)
        throw error
      }
      finally {
        clientTransitionDepth -= 1
        if (sent) {
          flushQueuedCommands()
        }
      }
    },
    sendCommand(command) {
      if (disposed) {
        throw new Error('Cannot send through a disposed state bridge.')
      }
      if (options.role === 'client' && !readyResolved) {
        throw new Error(
          readyRejected
            ? 'Cannot use a failed state bridge.'
            : 'Client state bridge must synchronize before commands.',
        )
      }
      if (
        options.role !== 'client' ||
        !options.commands ||
        !options.commands.validate(command)
      ) {
        throw new StateBridgeError(createDiagnostic(
          'invalid-command',
          'error',
          'local',
          `Command for channel "${channel}" is invalid or unavailable for this bridge role.`,
        ))
      }
      if (clientTransitionDepth > 0) {
        queuedCommands.push(command)
      }
      else {
        sendCommandNow(command)
      }
    },
    emitEvent(event) {
      if (disposed) {
        throw new Error('Cannot send through a disposed state bridge.')
      }
      if (
        options.role !== 'host' ||
        !options.events ||
        !options.events.validate(event)
      ) {
        throw new StateBridgeError(createDiagnostic(
          'invalid-event',
          'error',
          'local',
          `Event for channel "${channel}" is invalid or unavailable for this bridge role.`,
        ))
      }
      if (hostTransitionDepth > 0) {
        queuedEvents.push(event)
      }
      else {
        sendEventNow(event)
      }
    },
    dispose() {
      if (disposed) {
        return
      }

      disposed = true
      unsubscribe()
      pendingRequests.clear()
      queuedCommands.length = 0
      queuedEvents.length = 0
      if (!readyResolved && !readyRejected) {
        rejectClientReady(report(createDiagnostic(
          'disposed-before-ready',
          'error',
          'local',
          `State bridge for channel "${channel}" was disposed before synchronization completed.`,
        )))
      }
    },
  }
}
