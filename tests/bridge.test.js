'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createMessageTransport,
  createStateBridge,
} = require('../dist')

class FakeEndpoint {
  peer = null
  listeners = new Set()
  sent = []

  postMessage(message) {
    this.sent.push(message)
    for (const listener of [...this.peer.listeners]) {
      listener(message)
    }
  }

  on(type, listener) {
    assert.equal(type, 'message')
    this.listeners.add(listener)
  }

  off(type, listener) {
    assert.equal(type, 'message')
    this.listeners.delete(listener)
  }
}

function endpointPair() {
  const first = new FakeEndpoint()
  const second = new FakeEndpoint()
  first.peer = second
  second.peer = first
  return [first, second]
}

class DroppingEndpoint {
  peer = null
  listener = null

  postMessage(message) {
    this.peer?.listener?.(message)
  }

  on(type, listener) {
    assert.equal(type, 'message')
    this.listener = listener
  }

  off(type, listener) {
    assert.equal(type, 'message')
    if (this.listener === listener) {
      this.listener = null
    }
  }
}

class QueuedEndpoint extends FakeEndpoint {
  queue = []

  postMessage(message) {
    this.sent.push(message)
    this.peer.queue.push(message)
  }

  flushOne() {
    const message = this.queue.shift()
    if (message === undefined) {
      return false
    }
    for (const listener of [...this.listeners]) {
      listener(message)
    }
    return true
  }
}

function queuedEndpointPair() {
  const first = new QueuedEndpoint()
  const second = new QueuedEndpoint()
  first.peer = second
  second.peer = first
  return [first, second]
}

function flushQueuedPair(first, second) {
  let progress = true
  let turns = 0
  while (progress) {
    progress = false
    progress = first.flushOne() || progress
    progress = second.flushOne() || progress
    turns += 1
    if (turns > 100) {
      throw new Error('Queued bridge messages did not settle.')
    }
  }
}

function droppingEndpointPair() {
  const first = new DroppingEndpoint()
  const second = new DroppingEndpoint()
  first.peer = second
  second.peer = first
  return [first, second]
}

function isCountState(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number.isInteger(value.count)
  )
}

test('state bridges synchronize host and client updates', async () => {
  const [hostEndpoint, clientEndpoint] = endpointPair()
  const host = createStateBridge(
    createMessageTransport(hostEndpoint),
    {
      role: 'host',
      channel: 'dashboard',
      initial: { count: 1 },
      validate: isCountState,
    },
  )
  const client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      channel: 'dashboard',
      initial: { count: 0 },
      validate: isCountState,
    },
  )

  await client.ready
  assert.deepEqual(client.state.value, { count: 1 })

  host.update((state) => ({ count: state.count + 1 }))
  assert.deepEqual(client.state.value, { count: 2 })
  assert.equal(client.revision.value, 1)

  client.set({ count: 5 })
  assert.deepEqual(host.state.value, { count: 5 })
  assert.deepEqual(client.state.value, { count: 5 })
  assert.equal(host.revision.value, 2)
  assert.equal(client.revision.value, 2)

  host.dispose()
  client.dispose()
  assert.equal(hostEndpoint.listeners.size, 0)
  assert.equal(clientEndpoint.listeners.size, 0)
  assert.throws(() => host.set({ count: 6 }), /disposed/)
})

test('state bridge channels are isolated', async () => {
  const [hostEndpoint, clientEndpoint] = endpointPair()
  const host = createStateBridge(
    createMessageTransport(hostEndpoint),
    {
      role: 'host',
      channel: 'one',
      initial: 'host',
      validate: (value) => typeof value === 'string',
    },
  )
  const client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      channel: 'two',
      initial: 'client',
      validate: (value) => typeof value === 'string',
    },
  )

  host.set('changed')
  assert.equal(client.state.value, 'client')

  host.dispose()
  client.dispose()
})

test('state bridge connects when the client starts before the host', async () => {
  const [hostEndpoint, clientEndpoint] = droppingEndpointPair()
  const client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      initial: { count: 0 },
      validate: isCountState,
    },
  )
  const host = createStateBridge(
    createMessageTransport(hostEndpoint),
    {
      role: 'host',
      initial: { count: 7 },
      validate: isCountState,
    },
  )

  await client.ready
  assert.deepEqual(client.state.value, { count: 7 })
  client.dispose()
  host.dispose()
})

test('state bridge validates initial and local state', async () => {
  const [hostEndpoint, clientEndpoint] = endpointPair()
  assert.throws(
    () => createStateBridge(
      createMessageTransport(hostEndpoint),
      {
        role: 'host',
        initial: { count: 'invalid' },
        validate: isCountState,
      },
    ),
    /Initial state.*schema validation/,
  )

  const host = createStateBridge(
    createMessageTransport(hostEndpoint),
    {
      role: 'host',
      initial: { count: 1 },
      validate: isCountState,
    },
  )
  const client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      initial: { count: 0 },
      validate: isCountState,
    },
  )
  await client.ready
  const sentBefore = clientEndpoint.sent.length
  assert.throws(
    () => client.set({ count: 'invalid' }),
    /failed schema validation/,
  )
  assert.deepEqual(client.state.value, { count: 1 })
  assert.equal(clientEndpoint.sent.length, sentBefore)
  client.dispose()
  host.dispose()
})

test('state bridge rejects invalid inbound state without mutation', async () => {
  const [hostEndpoint, clientEndpoint] = endpointPair()
  const client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      channel: 'validated',
      initial: { count: 0 },
      validate: isCountState,
    },
  )
  const readyRequest = clientEndpoint.sent.at(-1)

  hostEndpoint.postMessage({
    protocol: 'dynwinrt-jsx.state.v2',
    channel: 'validated',
    type: 'state',
    requestId: readyRequest.requestId,
    revision: 1,
    value: { count: 'invalid' },
  })

  await assert.rejects(client.ready, /schema validation/)
  assert.deepEqual(client.state.value, { count: 0 })
  assert.equal(client.revision.value, 0)
  assert.equal(client.failed, true)
  assert.equal(client.lastDiagnostic.value.code, 'invalid-state')

  hostEndpoint.postMessage({
    protocol: 'dynwinrt-jsx.state.v2',
    channel: 'validated',
    type: 'state',
    revision: 2,
    value: { count: 2 },
  })
  assert.deepEqual(client.state.value, { count: 0 })
  assert.equal(client.revision.value, 0)
  assert.throws(
    () => client.set({ count: 2 }),
    /failed state bridge/,
  )
  client.dispose()
})

test('client mutations require initial authoritative synchronization', async () => {
  const [hostEndpoint, clientEndpoint] = droppingEndpointPair()
  const client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      initial: { count: 0 },
      validate: isCountState,
    },
  )

  assert.throws(
    () => client.set({ count: 1 }),
    /must synchronize before updates/,
  )
  assert.throws(
    () => client.sendCommand({ type: 'increment' }),
    /must synchronize before commands/,
  )
  assert.deepEqual(client.state.value, { count: 0 })
  assert.equal(client.revision.value, 0)
  client.dispose()
  await assert.rejects(client.ready, /disposed before synchronization/)
})

test('state bridge applies typed incremental patches', async () => {
  const [hostEndpoint, clientEndpoint] = endpointPair()
  const patchOptions = {
    validate(value) {
      return (
        typeof value === 'object' &&
        value !== null &&
        Number.isInteger(value.delta)
      )
    },
    apply(state, patch) {
      return { count: state.count + patch.delta }
    },
  }
  const host = createStateBridge(
    createMessageTransport(hostEndpoint),
    {
      role: 'host',
      initial: { count: 1 },
      validate: isCountState,
      patch: patchOptions,
    },
  )
  const client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      initial: { count: 0 },
      validate: isCountState,
      patch: patchOptions,
    },
  )
  await client.ready

  client.patch({ delta: 2 })
  assert.deepEqual(host.state.value, { count: 3 })
  assert.deepEqual(client.state.value, { count: 3 })
  assert.equal(host.revision.value, 1)
  assert.equal(client.revision.value, 1)
  assert.equal(clientEndpoint.sent.at(-1).type, 'patch')
  assert.equal(hostEndpoint.sent.at(-1).type, 'patch')

  host.patch({ delta: 4 })
  assert.deepEqual(host.state.value, { count: 7 })
  assert.deepEqual(client.state.value, { count: 7 })
  assert.equal(client.revision.value, 2)
  assert.throws(
    () => client.patch({ delta: 'invalid' }),
    /patch.*schema validation/,
  )
  client.dispose()
  host.dispose()
})

test('state bridge reports and repairs revision conflicts', async () => {
  const [hostEndpoint, clientEndpoint] = endpointPair()
  const host = createStateBridge(
    createMessageTransport(hostEndpoint),
    {
      role: 'host',
      channel: 'conflict',
      initial: { count: 1 },
      validate: isCountState,
    },
  )
  const client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      channel: 'conflict',
      initial: { count: 0 },
      validate: isCountState,
    },
  )
  await client.ready
  host.set({ count: 2 })

  clientEndpoint.postMessage({
    protocol: 'dynwinrt-jsx.state.v2',
    channel: 'conflict',
    type: 'set',
    baseRevision: 0,
    generation: 1,
    requestId: 99,
    value: { count: 9 },
  })

  assert.deepEqual(host.state.value, { count: 2 })
  assert.deepEqual(client.state.value, { count: 2 })
  assert.equal(host.revision.value, 1)
  assert.equal(client.revision.value, 1)
  assert.equal(
    host.lastDiagnostic.value.code,
    'revision-conflict',
  )
  assert.equal(
    client.lastDiagnostic.value.code,
    'revision-conflict',
  )
  client.dispose()
  host.dispose()
})

test('state bridge rejects dependent speculative writes after conflict', async () => {
  const [hostEndpoint, clientEndpoint] = queuedEndpointPair()
  const host = createStateBridge(
    createMessageTransport(hostEndpoint),
    {
      role: 'host',
      initial: { count: 0 },
      validate: isCountState,
    },
  )
  const client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      initial: { count: 0 },
      validate: isCountState,
    },
  )
  flushQueuedPair(hostEndpoint, clientEndpoint)
  await client.ready

  client.set({ count: 1 })
  client.set({ count: 2 })
  host.set({ count: 10 })
  flushQueuedPair(hostEndpoint, clientEndpoint)

  assert.deepEqual(host.state.value, { count: 10 })
  assert.deepEqual(client.state.value, { count: 10 })
  assert.equal(host.revision.value, 1)
  assert.equal(client.revision.value, 1)
  assert.equal(
    client.lastDiagnostic.value.code,
    'revision-conflict',
  )
  client.dispose()
  host.dispose()
})

test('state bridge handshake waits for the current Host revision', async () => {
  const [hostEndpoint, clientEndpoint] = queuedEndpointPair()
  const host = createStateBridge(
    createMessageTransport(hostEndpoint),
    {
      role: 'host',
      initial: { count: 0 },
      validate: isCountState,
    },
  )
  const client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      initial: { count: -1 },
      validate: isCountState,
    },
  )
  host.set({ count: 1 })

  flushQueuedPair(hostEndpoint, clientEndpoint)
  await client.ready

  assert.deepEqual(client.state.value, { count: 1 })
  assert.equal(client.revision.value, 1)
  client.dispose()
  host.dispose()
})

test('state bridge publishes state before reentrant commands and events', async () => {
  const [hostEndpoint, clientEndpoint] = endpointPair()
  const commands = []
  const events = []
  let host
  let client
  const isCommand = (value) =>
    typeof value === 'object' &&
    value !== null &&
    value.type === 'observe'
  const isEvent = (value) =>
    typeof value === 'object' &&
    value !== null &&
    value.type === 'changed'
  host = createStateBridge(
    createMessageTransport(hostEndpoint),
    {
      role: 'host',
      initial: { count: 0 },
      validate: isCountState,
      commands: {
        validate: isCommand,
        handle() {
          commands.push(host.state.value.count)
        },
      },
      events: {
        validate: isEvent,
      },
    },
  )
  client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      initial: { count: 0 },
      validate: isCountState,
      commands: {
        validate: isCommand,
      },
      events: {
        validate: isEvent,
        handle() {
          events.push(client.state.value.count)
        },
      },
    },
  )
  await client.ready
  const unsubscribeClient = client.state.subscribe((value) => {
    if (value.count === 1) {
      client.sendCommand({ type: 'observe' })
    }
  })
  const unsubscribeHost = host.state.subscribe((value) => {
    if (value.count === 2) {
      host.emitEvent({ type: 'changed' })
    }
  })

  client.set({ count: 1 })
  host.set({ count: 2 })

  assert.deepEqual(commands, [1])
  assert.deepEqual(events, [2])
  unsubscribeClient()
  unsubscribeHost()
  client.dispose()
  host.dispose()
})

test('state bridge validates typed commands and events', async () => {
  const [hostEndpoint, clientEndpoint] = endpointPair()
  const commands = []
  const events = []
  const isCommand = (value) =>
    typeof value === 'object' &&
    value !== null &&
    value.type === 'increment'
  const isEvent = (value) =>
    typeof value === 'object' &&
    value !== null &&
    value.type === 'saved'
  const host = createStateBridge(
    createMessageTransport(hostEndpoint),
    {
      role: 'host',
      initial: { count: 1 },
      validate: isCountState,
      commands: {
        validate: isCommand,
        handle: (command, context) => {
          commands.push([command, context.revision])
        },
      },
      events: {
        validate: isEvent,
      },
    },
  )
  const client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      initial: { count: 0 },
      validate: isCountState,
      commands: {
        validate: isCommand,
      },
      events: {
        validate: isEvent,
        handle: (event, context) => {
          events.push([event, context.revision])
        },
      },
    },
  )
  await client.ready

  client.sendCommand({ type: 'increment' })
  host.emitEvent({ type: 'saved' })
  assert.deepEqual(commands, [[{ type: 'increment' }, 0]])
  assert.deepEqual(events, [[{ type: 'saved' }, 0]])
  assert.throws(
    () => client.sendCommand({ type: 'invalid' }),
    /Command.*invalid/,
  )
  assert.throws(
    () => client.emitEvent({ type: 'saved' }),
    /Event.*unavailable/,
  )
  client.dispose()
  host.dispose()
})

test('disposing an unsynchronized client rejects ready and unsubscribes', async () => {
  const [hostEndpoint, clientEndpoint] = droppingEndpointPair()
  const client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      initial: { count: 0 },
      validate: isCountState,
    },
  )
  client.dispose()

  await assert.rejects(client.ready, /disposed before synchronization/)
  assert.equal(clientEndpoint.listener, null)
  assert.equal(hostEndpoint.listener, null)
})
