'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createRendererHeartbeatSharedState,
  createRendererHeartbeatMonitor,
  getRendererHeartbeatSharedState,
  rendererHeartbeatSharedStateIndex,
  summarizeRendererHeartbeatTimeout,
} = require('dynwinrt-jsx/host')

function heartbeat(sequence, sentAt = sequence * 10) {
  return {
    sequence,
    sentAt,
    snapshot: {
      timestamp: sentAt,
      diagnostics: {},
      nodes: [],
      reactive: {
        rootScopeIds: [],
        scopes: [],
        observers: [],
        dependencies: [],
      },
      subscriptions: [],
      operations: [],
    },
  }
}

test('heartbeat monitor detects timeout and recovery', () => {
  let now = 100
  let scheduled
  let cancelled = false
  const timeouts = []
  const recoveries = []
  const monitor = createRendererHeartbeatMonitor({
    timeoutMs: 50,
    checkIntervalMs: 10,
    now: () => now,
    schedule(callback, intervalMs) {
      scheduled = { callback, intervalMs }
      return () => {
        cancelled = true
      }
    },
    onTimeout(status) {
      timeouts.push(status)
    },
    onRecovered(status) {
      recoveries.push(status)
    },
  })

  assert.equal(scheduled.intervalMs, 10)
  assert.equal(monitor.snapshot().state, 'waiting')
  now = 149
  scheduled.callback()
  assert.equal(monitor.snapshot().state, 'waiting')
  now = 150
  scheduled.callback()
  assert.equal(monitor.snapshot().state, 'timedOut')
  assert.equal(timeouts.length, 1)

  now = 500
  assert.equal(monitor.receive(heartbeat(1)), true)
  assert.equal(monitor.snapshot().state, 'healthy')
  assert.equal(recoveries.length, 1)
  assert.equal(monitor.receive(heartbeat(1)), false)

  now = 549
  scheduled.callback()
  assert.equal(monitor.snapshot().state, 'healthy')
  now = 550
  scheduled.callback()
  assert.equal(monitor.snapshot().state, 'timedOut')
  assert.equal(timeouts.length, 2)
  scheduled.callback()
  assert.equal(timeouts.length, 2)

  now = 560
  assert.equal(monitor.receive(heartbeat(2)), true)
  assert.equal(monitor.snapshot().state, 'healthy')
  assert.equal(recoveries.length, 2)
  assert.equal(monitor.snapshot().timeoutCount, 2)

  monitor.dispose()
  assert.equal(monitor.disposed, true)
  assert.equal(monitor.snapshot().state, 'disposed')
  assert.equal(cancelled, true)
  assert.equal(monitor.receive(heartbeat(3)), false)
})

test('heartbeat monitor validates timing options', () => {
  assert.throws(
    () => createRendererHeartbeatMonitor({
      timeoutMs: 0,
    }),
    /timeoutMs must be a positive integer/,
  )
  assert.throws(
    () => createRendererHeartbeatMonitor({
      checkIntervalMs: -1,
    }),
    /checkIntervalMs must be a positive integer/,
  )
})

test('heartbeat timeout summaries identify the active page and hot operations', () => {
  const current = heartbeat(7, 1_000)
  current.snapshot.nodes.push({
    id: 1,
    kind: 'component',
    label: 'GridViewPage',
    scopeId: 1,
  })
  current.snapshot.operations.push(
    {
      sequence: 1,
      timestamp: 900,
      kind: 'event.invoke',
      target: 'NumberBox',
      name: 'onValueChanged',
    },
    {
      sequence: 2,
      timestamp: 950,
      kind: 'property.apply',
      target: 'Border',
      property: 'width',
    },
    {
      sequence: 3,
      timestamp: 975,
      kind: 'property.apply',
      target: 'Border',
      property: 'width',
    },
  )
  const summary = summarizeRendererHeartbeatTimeout({
    state: 'timedOut',
    timeoutMs: 5_000,
    lastSequence: 7,
    lastReceivedAt: 1_000,
    timeoutCount: 1,
    lastHeartbeat: current,
  })

  assert.equal(summary.suspectedComponent, 'GridViewPage')
  assert.equal(summary.lastHeartbeatSequence, 7)
  assert.equal(summary.lastOperation.kind, 'property.apply')
  assert.deepEqual(summary.hotOperations[0], {
    kind: 'property.apply',
    target: 'Border',
    name: 'width',
    count: 2,
  })
  assert.equal(summary.recentOperations.length, 3)
})

test('heartbeat shared state supports atomic host acknowledgements', () => {
  const buffer = createRendererHeartbeatSharedState()
  const state = getRendererHeartbeatSharedState(buffer)

  Atomics.store(
    state,
    rendererHeartbeatSharedStateIndex.acknowledgedSequence,
    7n,
  )
  Atomics.store(
    state,
    rendererHeartbeatSharedStateIndex.exportStatus,
    -1n,
  )

  assert.equal(
    Atomics.load(
      state,
      rendererHeartbeatSharedStateIndex.acknowledgedSequence,
    ),
    7n,
  )
  assert.equal(
    Atomics.load(
      state,
      rendererHeartbeatSharedStateIndex.exportStatus,
    ),
    -1n,
  )
  assert.throws(
    () => getRendererHeartbeatSharedState(
      new SharedArrayBuffer(8),
    ),
    /requires 6 BigInt64 values/,
  )
})

test('heartbeat monitor retries failed schedule cleanup', () => {
  let attempts = 0
  const monitor = createRendererHeartbeatMonitor({
    schedule() {
      return () => {
        attempts += 1
        if (attempts === 1) {
          throw new Error('cancel failed')
        }
      }
    },
  })

  assert.throws(
    () => monitor.dispose(),
    /cancel failed/,
  )
  assert.equal(monitor.disposed, false)
  monitor.dispose()
  assert.equal(monitor.disposed, true)
  assert.equal(attempts, 2)
})
