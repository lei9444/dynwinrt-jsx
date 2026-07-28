'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createDiagnosticChannel,
  createRendererOwnershipCounts,
  diagnosticProtocolName,
  diagnosticProtocolVersion,
  formatDiagnosticProtocolRecord,
  isDiagnosticProtocolRecord,
} = require('../dist/index.js')

const idleDiagnostics = {
  nativeCreated: 4,
  nativeDisposed: 2,
  activeNative: 2,
  componentsMounted: 3,
  componentsDisposed: 1,
  activeComponents: 2,
  listEntriesCreated: 5,
  listEntriesReused: 7,
}

test('diagnostic channel emits versioned ordered records', () => {
  const records = []
  const channel = createDiagnosticChannel({
    source: 'test-worker',
    initialSequence: 4,
    now: () => new Date('2026-07-27T12:00:00.000Z'),
    onRecord(record) {
      records.push(record)
    },
  })

  const lifecycle = channel.lifecycle({
    target: 'worker',
    state: 'starting',
    stage: 'bootstrap',
  })
  const route = channel.route({
    transitionId: 'route-1',
    phase: 'cancelled',
    action: 'replace',
    trigger: 'native',
    fromRoute: 'home',
    toRoute: 'settings',
    reason: 'superseded',
  })

  assert.equal(channel.sequence, 6)
  assert.equal(records.length, 2)
  assert.equal(lifecycle.protocol, diagnosticProtocolName)
  assert.equal(lifecycle.version, diagnosticProtocolVersion)
  assert.equal(lifecycle.sequence, 5)
  assert.equal(lifecycle.timestamp, '2026-07-27T12:00:00.000Z')
  assert.equal(lifecycle.kind, 'lifecycle')
  assert.equal(route.level, 'warning')
  assert.equal(
    isDiagnosticProtocolRecord(
      JSON.parse(formatDiagnosticProtocolRecord(route)),
    ),
    true,
  )
})

test('diagnostic channel gates lazy payload creation by kind', () => {
  let snapshots = 0
  const channel = createDiagnosticChannel({
    source: 'test-worker',
    isEnabled: (kind) => kind !== 'snapshot',
    onRecord() {
      throw new Error('disabled diagnostics must not emit')
    },
  })

  const result = channel.snapshot(() => {
    snapshots += 1
    return {
      name: 'renderer',
      data: {},
    }
  })

  assert.equal(result, undefined)
  assert.equal(snapshots, 0)
  assert.equal(channel.sequence, 0)
})

test('ownership records expose explicit ownership and active counts', () => {
  const snapshot = {
    timestamp: 1,
    diagnostics: idleDiagnostics,
    nodes: [
      { id: 1, kind: 'native', label: 'Button', scopeId: 1 },
      { id: 2, kind: 'component', label: 'App', scopeId: 1 },
    ],
    reactive: {
      rootScopeIds: [1],
      scopes: [{ id: 1 }],
      observers: [{ id: 1 }, { id: 2 }],
      dependencies: [{ id: 1 }],
    },
    subscriptions: [
      {
        id: 1,
        kind: 'event',
        scopeId: 1,
        target: 'Button',
        name: 'onClick',
        status: 'cleanupFailed',
      },
    ],
    operations: [],
  }
  const counts = createRendererOwnershipCounts(snapshot)
  const records = []
  const channel = createDiagnosticChannel({
    source: 'test-worker',
    onRecord: (record) => records.push(record),
  })

  const record = channel.ownership({
    owner: 'renderer',
    resource: 'native-tree',
    ownership: 'owned',
    action: 'snapshot',
    activeCount: counts.activeNative,
    counts,
  })

  assert.equal(record.payload.ownership, 'owned')
  assert.equal(record.payload.activeCount, 2)
  assert.equal(record.payload.counts.reactiveObservers, 2)
  assert.equal(
    record.payload.counts.cleanupFailedSubscriptions,
    1,
  )
  assert.deepEqual(records, [record])
})

test('error records are type-only unless detail is opted in', () => {
  const privateMessage = 'secret path C:\\private'
  const failure = new Error(privateMessage)
  failure.code = 'E_TEST'
  failure.hresult = -2147467259
  const records = []
  const channel = createDiagnosticChannel({
    source: 'test-worker',
    onRecord: (record) => records.push(record),
  })

  const safe = channel.error({
    category: 'hosting',
    operation: 'Window.activate',
    error: failure,
  })
  const detailed = channel.error({
    category: 'hosting',
    operation: 'Window.activate',
    error: failure,
    detail: 'message',
  })

  assert.equal(safe.payload.error.name, 'Error')
  assert.equal(safe.payload.error.code, 'E_TEST')
  assert.equal(safe.payload.error.hresult, -2147467259)
  assert.equal('message' in safe.payload.error, false)
  assert.equal(
    JSON.stringify(safe).includes(privateMessage),
    false,
  )
  assert.equal(detailed.payload.error.message, privateMessage)
  assert.equal(records.length, 2)
})

test('diagnostic protocol rejects invalid stable fields', () => {
  const channel = createDiagnosticChannel({
    source: 'test-worker',
    onRecord() {},
  })

  assert.throws(
    () => channel.lifecycle({
      target: 'window',
      state: 'active',
      stage: '',
    }),
    /stage must not be empty/,
  )
  assert.throws(
    () => channel.lifecycle({
      target: 'worker',
      state: 'active',
      stage: 'worker-active',
    }),
    /state for 'worker' is not supported/,
  )
  assert.throws(
    () => channel.ownership({
      owner: 'renderer',
      resource: 'native-tree',
      ownership: 'owned',
      action: 'snapshot',
      activeCount: -1,
    }),
    /activeCount must be a non-negative integer/,
  )
  assert.throws(
    () => channel.snapshot({
      name: 'renderer',
      data: undefined,
    }),
    /data must not be undefined/,
  )
  assert.equal(
    isDiagnosticProtocolRecord({
      protocol: diagnosticProtocolName,
      version: 2,
    }),
    false,
  )
  assert.equal(
    isDiagnosticProtocolRecord({
      protocol: diagnosticProtocolName,
      version: diagnosticProtocolVersion,
      sequence: 1,
      timestamp: new Date().toISOString(),
      source: 'test-worker',
      kind: 'route',
      level: 'info',
      payload: {
        transitionId: 'route-1',
        phase: 'unknown',
      },
    }),
    false,
  )
})
