import {
  batch,
  signal,
  type Cleanup,
  type ReadonlySignal,
} from './reactive'

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

const bridgeProtocol = 'dynwinrt-jsx.state.v1'

interface BridgeMessage {
  readonly protocol: typeof bridgeProtocol
  readonly channel: string
  readonly type: 'request' | 'set' | 'state'
  readonly revision?: number
  readonly value?: unknown
}

function isBridgeMessage(
  value: unknown,
  channel: string,
): value is BridgeMessage {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const message = value as Partial<BridgeMessage>
  return (
    message.protocol === bridgeProtocol &&
    message.channel === channel &&
    (
      message.type === 'request' ||
      message.type === 'set' ||
      message.type === 'state'
    )
  )
}

export type StateBridgeRole = 'host' | 'client'

export interface StateBridgeOptions<State> {
  readonly role: StateBridgeRole
  readonly initial: State
  readonly channel?: string
}

export interface StateBridge<State> {
  readonly state: ReadonlySignal<State>
  readonly revision: ReadonlySignal<number>
  readonly ready: Promise<void>
  readonly disposed: boolean
  set(value: State): void
  update(updater: (previous: State) => State): void
  dispose(): void
}

export function createStateBridge<State>(
  transport: MessageTransport,
  options: StateBridgeOptions<State>,
): StateBridge<State> {
  const channel = options.channel ?? 'default'
  const state = signal(options.initial)
  const revision = signal(0)
  let disposed = false
  let resolveReady: (() => void) | undefined
  let readyResolved = options.role === 'host'
  const ready = readyResolved
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        resolveReady = resolve
      })

  const send = (message: Omit<BridgeMessage, 'protocol' | 'channel'>) => {
    if (disposed) {
      throw new Error('Cannot send through a disposed state bridge.')
    }

    transport.postMessage({
      protocol: bridgeProtocol,
      channel,
      ...message,
    } satisfies BridgeMessage)
  }

  const publishState = () => {
    send({
      type: 'state',
      revision: revision.peek(),
      value: state.peek(),
    })
  }

  const applyHostState = (next: State) => {
    batch(() => {
      state.value = next
      revision.value += 1
    })
    publishState()
  }

  const unsubscribe = transport.subscribe((rawMessage) => {
    if (disposed || !isBridgeMessage(rawMessage, channel)) {
      return
    }

    if (options.role === 'host') {
      if (rawMessage.type === 'request') {
        publishState()
      } else if (rawMessage.type === 'set') {
        applyHostState(rawMessage.value as State)
      }
      return
    }

    if (
      rawMessage.type !== 'state' ||
      typeof rawMessage.revision !== 'number' ||
      rawMessage.revision < revision.peek()
    ) {
      return
    }

    batch(() => {
      state.value = rawMessage.value as State
      revision.value = rawMessage.revision as number
    })

    if (!readyResolved) {
      readyResolved = true
      resolveReady?.()
      resolveReady = undefined
    }
  })

  if (options.role === 'client') {
    send({ type: 'request' })
  } else {
    publishState()
  }

  return {
    state,
    revision,
    ready,
    get disposed() {
      return disposed
    },
    set(value) {
      if (disposed) {
        throw new Error('Cannot update a disposed state bridge.')
      }

      if (options.role === 'host') {
        applyHostState(value)
      } else {
        state.value = value
        send({
          type: 'set',
          revision: revision.peek(),
          value,
        })
      }
    },
    update(updater) {
      this.set(updater(state.peek()))
    },
    dispose() {
      if (disposed) {
        return
      }

      disposed = true
      unsubscribe()
    },
  }
}
