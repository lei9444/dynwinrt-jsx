'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

test('host entry avoids renderer and WinUI modules', () => {
  const hostPath = require.resolve('../dist/host.js')
  assert.equal(require.resolve('dynwinrt-jsx/host'), hostPath)

  for (const modulePath of [
    hostPath,
    require.resolve('../dist/bridge.js'),
    require.resolve('../dist/diagnostics.js'),
    require.resolve('../dist/persistence.js'),
  ]) {
    delete require.cache[modulePath]
  }

  const host = require('dynwinrt-jsx/host')
  assert.equal(typeof host.createMessageTransport, 'function')
  assert.equal(typeof host.createStateBridge, 'function')
  assert.equal(typeof host.createDiagnosticRecord, 'function')
  assert.equal(typeof host.createJsonStateStore, 'function')

  for (const modulePath of [
    require.resolve('../dist/index.js'),
    require.resolve('../dist/renderer.js'),
    require.resolve('../dist/winui.js'),
    require.resolve('../dist/control-flow.js'),
  ]) {
    assert.equal(require.cache[modulePath], undefined)
  }
})
