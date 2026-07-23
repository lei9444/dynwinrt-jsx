'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const workerPath = require.resolve('../dist/worker.js')
assert.equal(require.resolve('dynwinrt-jsx/worker'), workerPath)
const {
  createFileHotReloadController,
  createRendererHeartbeatController,
  installWinUIWindowLifecycle,
  runWinUIWorkerApp,
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

test('worker app owns startup, mount, activation, and close order', () => {
  const order = []
  const errors = []
  let projectionCreated = false
  let closing
  let closed
  const appWindow = {
    onClosing(callback) {
      closing = callback
      return () => order.push('closing-unsubscribe')
    },
  }
  const window = {
    get appWindow() {
      assert.equal(projectionCreated, false)
      order.push('app-window')
      return appWindow
    },
    onClosed(callback) {
      closed = callback
      return () => order.push('closed-unsubscribe')
    },
    activate() {
      order.push('activate')
    },
  }
  const renderHandle = {
    container: window,
    roots: [],
    disposed: false,
    update() {},
    dispose() {
      order.push('render-dispose')
    },
  }

  const exitCode = runWinUIWorkerApp({
    application: {
      current: {
        exit() {
          order.push('application-exit')
        },
      },
      start(callback) {
        order.push('application-start')
        callback()
      },
      create(callback) {
        order.push('application-create')
        callback()
      },
    },
    createRenderer() {
      order.push('renderer-create')
      return {
        diagnostics: idleDiagnostics,
        render(child, container) {
          order.push(`render:${child}`)
          assert.equal(container, window)
          return renderHandle
        },
      }
    },
    createWindow() {
      order.push('window-create')
      return window
    },
    configureWindow() {
      order.push('window-configure')
    },
    createProjectionScope() {
      projectionCreated = true
      order.push('projection-create')
      return {
        dispose() {
          order.push('projection-dispose')
        },
      }
    },
    mount() {
      order.push('mount')
      return {
        child: 'tree',
        beforeClose() {
          order.push('before-close')
        },
        disposeAfterRender() {
          order.push('after-render')
        },
        afterRender() {
          order.push('after-render-hook')
          return {
            disposeBeforeRender() {
              order.push('before-render')
            },
          }
        },
        onProjectionDisposed() {
          order.push('projection-disposed')
        },
        afterActivate(context) {
          order.push('after-activate')
          context.setExitCode(7)
          closing(undefined, { cancel: false })
          closed()
        },
      }
    },
    onDiagnostics() {
      order.push('diagnostics')
    },
    onError(error) {
      errors.push(error)
    },
  })

  assert.equal(exitCode, 7)
  assert.deepEqual(errors, [])
  assert.deepEqual(order, [
    'renderer-create',
    'application-start',
    'application-create',
    'window-create',
    'app-window',
    'window-configure',
    'projection-create',
    'mount',
    'render:tree',
    'after-render-hook',
    'activate',
    'after-activate',
    'before-close',
    'before-render',
    'render-dispose',
    'after-render',
    'diagnostics',
    'projection-dispose',
    'projection-disposed',
    'closing-unsubscribe',
    'closed-unsubscribe',
    'application-exit',
  ])
})

test('worker app cleans projection scope after mount failure', () => {
  const order = []
  const failure = new Error('mount failed')
  const errors = []

  const exitCode = runWinUIWorkerApp({
    application: {
      current: {
        exit() {
          order.push('application-exit')
        },
      },
      start(callback) {
        callback()
      },
      create(callback) {
        callback()
      },
    },
    createRenderer() {
      return {
        diagnostics: idleDiagnostics,
        render() {
          throw new Error('render should not run')
        },
      }
    },
    createWindow() {
      return {
        appWindow: {
          onClosing() {
            return () => {}
          },
        },
        onClosed() {
          return () => {}
        },
        activate() {},
      }
    },
    createProjectionScope() {
      return {
        dispose() {
          order.push('projection-dispose')
        },
      }
    },
    mount() {
      throw failure
    },
    onError(error) {
      errors.push(error)
    },
  })

  assert.equal(exitCode, 1)
  assert.deepEqual(errors, [failure])
  assert.deepEqual(order, [
    'projection-dispose',
    'application-exit',
  ])
})

test('worker app does not repeat successful cleanup after activation failure', () => {
  const failure = new Error('after activate failed')
  const errors = []
  const counts = {
    beforeRender: 0,
    afterRender: 0,
    projection: 0,
  }
  let closing
  let closed
  let exiting = false

  const exitCode = runWinUIWorkerApp({
    application: {
      current: {
        exit() {
          if (exiting) {
            return
          }
          exiting = true
          closing(undefined, { cancel: false })
          closed()
        },
      },
      start(callback) {
        callback()
      },
      create(callback) {
        callback()
      },
    },
    createRenderer() {
      return {
        diagnostics: idleDiagnostics,
        render() {
          return {
            container: {},
            roots: [],
            disposed: false,
            update() {},
            dispose() {},
          }
        },
      }
    },
    createWindow() {
      const appWindow = {
        onClosing(callback) {
          closing = callback
          return () => {}
        },
      }
      return {
        appWindow,
        onClosed(callback) {
          closed = callback
          return () => {}
        },
        activate() {},
      }
    },
    createProjectionScope() {
      return {
        dispose() {
          counts.projection += 1
        },
      }
    },
    mount() {
      return {
        child: 'tree',
        disposeAfterRender() {
          counts.afterRender += 1
        },
        afterRender() {
          return {
            disposeBeforeRender() {
              counts.beforeRender += 1
            },
          }
        },
        afterActivate() {
          throw failure
        },
      }
    },
    onError(error) {
      errors.push(error)
    },
  })

  assert.equal(exitCode, 1)
  assert.deepEqual(errors, [failure])
  assert.deepEqual(counts, {
    beforeRender: 1,
    afterRender: 1,
    projection: 1,
  })
})

test('worker app runs beforeClose once across projection retry', () => {
  let closing
  let closed
  let beforeCloseCount = 0
  let projectionAttempts = 0
  const errors = []

  const exitCode = runWinUIWorkerApp({
    application: {
      current: { exit() {} },
      start(callback) {
        callback()
      },
      create(callback) {
        callback()
      },
    },
    createRenderer() {
      return {
        diagnostics: idleDiagnostics,
        render() {
          return {
            container: {},
            roots: [],
            disposed: false,
            update() {},
            dispose() {},
          }
        },
      }
    },
    createWindow() {
      return {
        appWindow: {
          onClosing(callback) {
            closing = callback
            return () => {}
          },
        },
        onClosed(callback) {
          closed = callback
          return () => {}
        },
        activate() {},
      }
    },
    createProjectionScope() {
      return {
        dispose() {
          projectionAttempts += 1
          if (projectionAttempts === 1) {
            throw new Error('projection retry')
          }
        },
      }
    },
    mount() {
      return {
        child: 'tree',
        beforeClose() {
          beforeCloseCount += 1
        },
        afterActivate() {
          const first = { cancel: false }
          closing(undefined, first)
          assert.equal(first.cancel, true)
          const second = { cancel: false }
          closing(undefined, second)
          assert.equal(second.cancel, false)
          closed()
        },
      }
    },
    onError(error) {
      errors.push(error)
    },
  })

  assert.equal(exitCode, 0)
  assert.equal(beforeCloseCount, 1)
  assert.equal(projectionAttempts, 2)
  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /projection retry/)
})

test('worker app reports renderer creation failure without starting', () => {
  const failure = new Error('renderer failed')
  const errors = []
  let started = false

  const exitCode = runWinUIWorkerApp({
    application: {
      current: { exit() {} },
      start() {
        started = true
      },
      create() {},
    },
    createRenderer() {
      throw failure
    },
    createWindow() {
      throw new Error('window should not be created')
    },
    mount() {
      throw new Error('mount should not run')
    },
    onError(error) {
      errors.push(error)
    },
  })

  assert.equal(exitCode, 1)
  assert.equal(started, false)
  assert.deepEqual(errors, [failure])
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

test('renderer heartbeat emits inspector snapshots and disposes once', () => {
  let tick
  let now = 10
  const order = []
  const heartbeats = []
  const errors = []
  const controller = createRendererHeartbeatController({
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
    renderer: {
      inspector: {
        snapshot() {
          return {
            timestamp: now,
            diagnostics: idleDiagnostics,
            nodes: [],
            reactive: {
              rootScopeIds: [],
              scopes: [],
              observers: [],
              dependencies: [],
            },
            subscriptions: [],
            operations: [],
          }
        },
      },
    },
    intervalDuration: 20n,
    now: () => {
      now += 1
      return now
    },
    onHeartbeat(value) {
      heartbeats.push(value)
    },
    onError(error) {
      errors.push(error)
    },
  })

  assert.deepEqual(order, ['start'])
  assert.equal(controller.sequence, 1)
  assert.equal(heartbeats[0].sequence, 1)
  tick()
  assert.equal(controller.sequence, 2)
  assert.equal(heartbeats[1].sentAt, 12)
  assert.equal(controller.lastHeartbeat, heartbeats[1])
  assert.deepEqual(errors, [])

  controller.dispose()
  controller.dispose()
  assert.equal(controller.disposed, true)
  assert.deepEqual(order.slice(-2), ['stop', 'unsubscribe'])
  tick()
  assert.equal(controller.sequence, 2)
})

test('renderer heartbeat validates intervals and reports tick errors', () => {
  assert.throws(
    () => createRendererHeartbeatController({
      dispatcherQueue: {
        createTimer() {
          throw new Error('timer should not be created')
        },
      },
      renderer: {},
      onHeartbeat() {},
      onError() {},
      intervalDuration: 0n,
    }),
    /intervalDuration must be positive/,
  )

  let tick
  const errors = []
  const controller = createRendererHeartbeatController({
    dispatcherQueue: {
      createTimer() {
        return {
          interval: { duration: 0n },
          isRepeating: false,
          onTick(callback) {
            tick = callback
            return () => {}
          },
          start() {},
          stop() {},
        }
      },
    },
    renderer: {
      inspector: {
        snapshot() {
          throw new Error('snapshot failed')
        },
      },
    },
    onHeartbeat() {},
    onError(error) {
      errors.push(error)
    },
  })
  assert.match(errors[0].message, /snapshot failed/)
  tick()
  assert.equal(errors.length, 2)
  controller.dispose()
})

test('renderer heartbeat retries failed timer cleanup', () => {
  let stopAttempts = 0
  let unsubscribeAttempts = 0
  const controller = createRendererHeartbeatController({
    dispatcherQueue: {
      createTimer() {
        return {
          interval: { duration: 0n },
          isRepeating: false,
          onTick() {
            return () => {
              unsubscribeAttempts += 1
            }
          },
          start() {},
          stop() {
            stopAttempts += 1
            if (stopAttempts === 1) {
              throw new Error('stop failed')
            }
          },
        }
      },
    },
    renderer: {
      inspector: {
        snapshot() {
          return {
            timestamp: 0,
            diagnostics: idleDiagnostics,
            nodes: [],
            reactive: {
              rootScopeIds: [],
              scopes: [],
              observers: [],
              dependencies: [],
            },
            subscriptions: [],
            operations: [],
          }
        },
      },
    },
    onHeartbeat() {},
    onError(error) {
      throw error
    },
  })

  assert.throws(
    () => controller.dispose(),
    /stop failed/,
  )
  assert.equal(controller.disposed, false)
  controller.dispose()
  assert.equal(controller.disposed, true)
  assert.equal(stopAttempts, 2)
  assert.equal(unsubscribeAttempts, 1)
})
