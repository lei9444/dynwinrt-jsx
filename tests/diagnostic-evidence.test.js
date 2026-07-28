'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  assertRendererInspectionIdle,
  createDiagnosticBuffer,
  createDiagnosticChannel,
  createDiagnosticEvidenceBundle,
  diagnosticEvidenceProtocolName,
  formatDiagnosticProtocolRecordSummary,
  hasActiveRendererInspection,
} = require('../dist/index.js')

function inspection(active = false) {
  return {
    timestamp: 10,
    diagnostics: {
      nativeCreated: active ? 1 : 0,
      nativeDisposed: 0,
      activeNative: active ? 1 : 0,
      componentsMounted: 0,
      componentsDisposed: 0,
      activeComponents: 0,
      listEntriesCreated: 0,
      listEntriesReused: 0,
    },
    nodes: active
      ? [{ id: 1, kind: 'native', label: 'Button', scopeId: 1 }]
      : [],
    reactive: {
      rootScopeIds: active ? [1] : [],
      scopes: active ? [{ id: 1 }] : [],
      observers: [],
      dependencies: [],
    },
    subscriptions: [],
    operations: [],
  }
}

test('diagnostic buffer is bounded and observable', () => {
  const records = []
  const buffer = createDiagnosticBuffer({
    maxRecords: 2,
    now: () => new Date('2026-07-27T12:00:00.000Z'),
  })
  const unsubscribe = buffer.subscribe((record) => {
    records.push(record.sequence)
  })
  const channel = createDiagnosticChannel({
    source: 'evidence-test',
    onRecord(record) {
      buffer.append(record)
    },
  })

  channel.lifecycle({
    target: 'worker',
    state: 'starting',
    stage: 'start',
  })
  channel.lifecycle({
    target: 'worker',
    state: 'running',
    stage: 'ready',
  })
  channel.lifecycle({
    target: 'worker',
    state: 'stopping',
    stage: 'close',
  })

  const snapshot = buffer.snapshot()
  assert.deepEqual(records, [1, 2, 3])
  assert.equal(snapshot.records.length, 2)
  assert.deepEqual(
    snapshot.records.map((record) => record.sequence),
    [2, 3],
  )
  assert.equal(snapshot.droppedRecords, 1)
  assert.equal(
    snapshot.capturedAt,
    '2026-07-27T12:00:00.000Z',
  )
  const summary = JSON.parse(
    formatDiagnosticProtocolRecordSummary(
      snapshot.records.at(-1),
    ),
  )
  assert.equal(summary.summary.stage, 'close')

  unsubscribe()
  buffer.clear()
  assert.equal(buffer.size, 0)
  assert.equal(buffer.droppedRecords, 0)
})

test('renderer inspection idle assertion covers full ownership', () => {
  assert.equal(
    hasActiveRendererInspection(inspection(false)),
    false,
  )
  assert.doesNotThrow(() =>
    assertRendererInspectionIdle(inspection(false)),
  )
  assert.equal(
    hasActiveRendererInspection(inspection(true)),
    true,
  )
  assert.throws(
    () => assertRendererInspectionIdle(inspection(true)),
    /is not idle/,
  )
})

test('diagnostic evidence bundles protocol, renderer, and routes', () => {
  const buffer = createDiagnosticBuffer({
    now: () => new Date('2026-07-27T12:00:00.000Z'),
  })
  const evidence = createDiagnosticEvidenceBundle({
    diagnostics: buffer.snapshot(),
    renderer: inspection(false),
    routes: [{
      routeId: 'home',
      path: '/',
      status: 'passed',
      durationMs: 12,
    }],
    metadata: {
      processId: 42,
    },
    now: () => new Date('2026-07-27T12:00:01.000Z'),
  })

  assert.equal(
    evidence.protocol,
    diagnosticEvidenceProtocolName,
  )
  assert.equal(evidence.rendererIdle.idle, true)
  assert.equal(evidence.routes[0].routeId, 'home')
  assert.equal(evidence.metadata.processId, 42)
  assert.equal(
    evidence.generatedAt,
    '2026-07-27T12:00:01.000Z',
  )
})

test('diagnostic summaries omit full snapshot payloads', () => {
  let snapshotRecord
  const channel = createDiagnosticChannel({
    source: 'evidence-test',
    onRecord(record) {
      snapshotRecord = record
    },
  })
  channel.snapshot({
    name: 'renderer',
    data: {
      privateValue: 'not-for-console',
    },
  })

  const formatted =
    formatDiagnosticProtocolRecordSummary(snapshotRecord)
  assert.equal(
    formatted.includes('not-for-console'),
    false,
  )
  assert.equal(
    JSON.parse(formatted).summary.name,
    'renderer',
  )
})
