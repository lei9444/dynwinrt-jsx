'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const workerPath = require.resolve('../dist/worker.js')
assert.equal(require.resolve('dynwinrt-jsx/worker'), workerPath)
const {
  createFileHotReloadController,
  installWinUIWindowLifecycle,
} = require('dynwinrt-jsx/worker')

const idleDiagnostics = {
  nativeCreated: 1,
  nativeDisposed: 1,
  activeNative: 0,
  componentsMounted: 1,
  componentsDisposed: 1,
  activeComponents: 0,
  listEntriesCreated: 0,
  listEntriesReused: 0,
}

function createWindowHarness() {
  let closing
  let closed
  const order = []
  return {
    order,
    window: {
      onClosed(callback) {
        closed = callback
        return () => order.push('closed-unsubscribe')
      },
    },
    appWindow: {
      onClosing(callback) {
        closing = callback
        return () => order.push('closing-unsubscribe')
      },
    },
    close(args = { cancel: false }) {
      closing(undefined, args)
      return args
    },
    closed() {
      closed()
    },
  }
}

test('window lifecycle preserves cancellation before teardown', () => {
  const harness = createWindowHarness()
  installWinUIWindowLifecycle({
    application: {
      current: { exit() {} },
    },
    window: harness.window,
    appWindow: harness.appWindow,
    renderer: { diagnostics: idleDiagnostics },
    disposeRender() {
      harness.order.push('render')
    },
    onError(error) {
      throw error
    },
    getRequestedExitCode: () => 0,
    setExitCode() {},
  })

  harness.close({ cancel: true })
  assert.deepEqual(harness.order, [])
})

test('window lifecycle disposes owned work in deterministic order', () => {
  const harness = createWindowHarness()
  const errors = []
  const exitCodes = []
  installWinUIWindowLifecycle({
    application: {
      current: {
        exit() {
          harness.order.push('application-exit')
        },
      },
    },
    window: harness.window,
    appWindow: harness.appWindow,
    renderer: { diagnostics: idleDiagnostics },
    beforeClose() {
      harness.order.push('before-close')
    },
    disposeBeforeRender() {
      harness.order.push('before-render')
    },
    disposeRender() {
      harness.order.push('render')
    },
    disposeAfterRender() {
      harness.order.push('after-render')
    },
    disposeProjection() {
      harness.order.push('projection')
    },
    onDiagnostics() {
      harness.order.push('diagnostics')
    },
    onError(error) {
      errors.push(error)
    },
    getRequestedExitCode: () => 7,
    setExitCode(value) {
      exitCodes.push(value)
    },
  })

  const args = harness.close()
  assert.equal(args.cancel, false)
  assert.deepEqual(harness.order, [
    'before-close',
    'before-render',
    'render',
    'after-render',
    'diagnostics',
    'projection',
    'closing-unsubscribe',
  ])
  assert.deepEqual(exitCodes, [7])
  assert.deepEqual(errors, [])

  harness.closed()
  assert.deepEqual(harness.order.slice(-2), [
    'closed-unsubscribe',
    'application-exit',
  ])
})

test('window lifecycle cancels projection failure and permits retry', () => {
  const harness = createWindowHarness()
  const projectionError = new Error('projection failed')
  const errors = []
  const exitCodes = []
  let projectionAttempts = 0

  installWinUIWindowLifecycle({
    application: {
      current: { exit() {} },
    },
    window: harness.window,
    appWindow: harness.appWindow,
    renderer: { diagnostics: idleDiagnostics },
    disposeRender() {},
    disposeProjection() {
      projectionAttempts += 1
      if (projectionAttempts === 1) {
        throw projectionError
      }
    },
    onError(error) {
      errors.push(error)
    },
    getRequestedExitCode: () => 0,
    setExitCode(value) {
      exitCodes.push(value)
    },
  })

  const first = harness.close()
  assert.equal(first.cancel, true)
  assert.deepEqual(errors, [projectionError])
  assert.deepEqual(exitCodes, [1])

  const second = harness.close()
  assert.equal(second.cancel, false)
  assert.equal(projectionAttempts, 2)
  assert.deepEqual(exitCodes, [1, 0])
  assert.equal(
    harness.order.includes('closing-unsubscribe'),
    true,
  )
})

test('file hot reload controller applies versions and disposes once', async () => {
  let tick
  let content = JSON.stringify({
    type: 'hot-reload',
    version: 1,
  })
  const order = []
  const updates = []
  const reloads = []
  const errors = []
  const pollErrors = []
  const controller = createFileHotReloadController({
    statePath: 'hot.json',
    dispatcherQueue: {
      createTimer() {
        return {
          interval: { duration: 0n },
          isRepeating: false,
          onTick(callback) {
            tick = callback
            return () => order.push('unsubscribe')
          },
          start() {
            order.push('start')
          },
          stop() {
            order.push('stop')
          },
        }
      },
    },
    fileSystem: {
      existsSync: () => true,
      readFileSync: () => content,
    },
    renderHandle: {
      container: {},
      roots: [],
      disposed: false,
      update(child) {
        updates.push(child)
      },
      dispose() {},
    },
    load(message) {
      return `tree-${message.version}`
    },
    beforeReload(message) {
      order.push(`before-${message.version}`)
    },
    onReload(version) {
      reloads.push(version)
    },
    onError(error, version) {
      errors.push({ error, version })
    },
    onPollError(error, version) {
      pollErrors.push({ error, version })
    },
  })

  assert.ok(controller)
  assert.deepEqual(order, ['start'])
  tick()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(updates, ['tree-1'])
  assert.deepEqual(reloads, [1])
  assert.equal(controller.version, 1)

  tick()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(updates, ['tree-1'])

  content = JSON.stringify({
    type: 'hot-build-error',
    version: 2,
  })
  tick()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(updates, ['tree-1', 'tree-2'])
  assert.deepEqual(reloads, [1, 2])
  assert.deepEqual(errors, [])

  content = '{'
  tick()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(pollErrors.length, 1)
  assert.equal(pollErrors[0].version, 2)

  controller.dispose()
  controller.dispose()
  assert.equal(controller.disposed, true)
  assert.deepEqual(order.slice(-2), ['stop', 'unsubscribe'])
})
