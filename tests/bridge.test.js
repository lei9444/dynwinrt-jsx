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

  postMessage(message) {
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

function droppingEndpointPair() {
  const first = new DroppingEndpoint()
  const second = new DroppingEndpoint()
  first.peer = second
  second.peer = first
  return [first, second]
}

test('state bridges synchronize host and client updates', async () => {
  const [hostEndpoint, clientEndpoint] = endpointPair()
  const host = createStateBridge(
    createMessageTransport(hostEndpoint),
    {
      role: 'host',
      channel: 'dashboard',
      initial: { count: 1 },
    },
  )
  const client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      channel: 'dashboard',
      initial: { count: 0 },
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
    },
  )
  const client = createStateBridge(
    createMessageTransport(clientEndpoint),
    {
      role: 'client',
      channel: 'two',
      initial: 'client',
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
    },
  )
  const host = createStateBridge(
    createMessageTransport(hostEndpoint),
    {
      role: 'host',
      initial: { count: 7 },
    },
  )

  await client.ready
  assert.deepEqual(client.state.value, { count: 7 })
  client.dispose()
  host.dispose()
})
