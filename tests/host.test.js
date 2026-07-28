'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

test('host entry avoids renderer and WinUI modules', () => {
  const hostPath = require.resolve('../dist/host.js')
  assert.equal(require.resolve('dynwinrt-jsx/host'), hostPath)

  for (const modulePath of [
    hostPath,
    require.resolve('../dist/runtime/bridge.js'),
    require.resolve('../dist/runtime/capability.js'),
    require.resolve('../dist/runtime/diagnostics.js'),
    require.resolve('../dist/runtime/diagnostic-evidence.js'),
    require.resolve('../dist/runtime/persistence.js'),
    require.resolve('../dist/runtime/heartbeat.js'),
    require.resolve('../dist/runtime/host-app.js'),
  ]) {
    delete require.cache[modulePath]
  }

  const host = require('dynwinrt-jsx/host')
  assert.equal(typeof host.createMessageTransport, 'function')
  assert.equal(typeof host.capabilityAvailable, 'function')
  assert.equal(typeof host.createStateBridge, 'function')
  assert.equal(typeof host.createDiagnosticChannel, 'function')
  assert.equal(typeof host.createDiagnosticBuffer, 'function')
  assert.equal(
    typeof host.createDiagnosticEvidenceBundle,
    'function',
  )
  assert.equal(typeof host.createDiagnosticRecord, 'function')
  assert.equal(
    typeof host.isDiagnosticProtocolRecord,
    'function',
  )
  assert.equal(typeof host.createJsonStateStore, 'function')
  assert.equal(typeof host.defineWinUIHost, 'function')

  for (const modulePath of [
    require.resolve('../dist/index.js'),
    require.resolve('../dist/renderer/renderer.js'),
    require.resolve('../dist/winui/winui.js'),
    require.resolve('../dist/core/control-flow.js'),
  ]) {
    assert.equal(require.cache[modulePath], undefined)
  }
})

test('defined WinUI Host owns state and Worker cleanup', async (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'dynwinrt-jsx-host-'),
  )
  t.after(() => {
    fs.rmSync(directory, {
      recursive: true,
      force: true,
    })
  })
  const statePath = path.join(directory, 'state.json')
  const hotStatePath = path.join(
    directory,
    'hot',
    'state.json',
  )
  const messages = []
  const { defineWinUIHost } =
    require('../dist/host.js')
  const host = defineWinUIHost({
    rootDirectory: directory,
    workerPath: path.join(
      __dirname,
      'fixtures',
      'host-worker.js',
    ),
    bootstrap: false,
    hotReload: {
      enabled: true,
      statePath: hotStatePath,
      reloadFiles: [],
      restartFiles: [],
    },
    logger: {
      log: (message) => messages.push(String(message)),
      warn: (message) => messages.push(String(message)),
      error: (message) => messages.push(String(message)),
    },
    state: {
      path: statePath,
      defaultState: () => ({
        version: 1,
        count: 3,
      }),
      validate(value) {
        return (
          typeof value === 'object' &&
          value !== null &&
          value.version === 1 &&
          Number.isInteger(value.count)
        )
      },
      initialize(loaded) {
        return {
          ...loaded.state,
          status: 'starting',
        }
      },
      persist(state) {
        return {
          version: 1,
          count: state.count,
        }
      },
      isReady: (state) => state.status === 'running',
      describe: (_state, persisted) => ({
        count: persisted.count,
      }),
    },
  })

  assert.equal(host.started, false)
  assert.equal(await host.run(), 0)
  assert.equal(host.started, true)
  assert.equal(host.disposed, true)
  assert.equal(host.worker, null)
  assert.equal(host.bridge, null)
  assert.equal(fs.existsSync(hotStatePath), false)
  assert.deepEqual(
    JSON.parse(fs.readFileSync(statePath, 'utf8')),
    {
      version: 1,
      count: 4,
    },
  )
  assert.ok(
    messages.some((message) =>
      message.includes('WinUI app is ready.'),
    ),
  )
  assert.ok(
    messages.some((message) =>
      message.includes('renderer disposed cleanly'),
    ),
  )
  assert.ok(
    messages.some((message) =>
      message.includes('hot reload is active'),
    ),
  )
})

test('defined WinUI Host terminates a failed startup Worker', async (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'dynwinrt-jsx-host-failure-'),
  )
  t.after(() => {
    fs.rmSync(directory, {
      recursive: true,
      force: true,
    })
  })
  const { defineWinUIHost } =
    require('../dist/host.js')
  const host = defineWinUIHost({
    rootDirectory: directory,
    workerPath: path.join(
      __dirname,
      'fixtures',
      'host-worker.js',
    ),
    bootstrap: false,
    logger: {
      log() {},
      warn() {},
      error() {},
    },
    state: {
      path: path.join(directory, 'state.json'),
      defaultState: () => ({
        version: 1,
        count: 0,
      }),
      validate: () => true,
      initialize: (loaded) => loaded.state,
      persist: (state) => state,
    },
    onWorkerCreated() {
      throw new Error('startup hook failed')
    },
  })

  await assert.rejects(
    host.run(),
    /startup hook failed/,
  )
  assert.equal(host.disposed, true)
  assert.equal(host.worker, null)
  assert.equal(host.bridge, null)
})
