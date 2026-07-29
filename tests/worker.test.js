'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { native } = require('../dist/index.js')
const { jsx } = require('../dist/jsx-runtime.js')

const workerPath = require.resolve('../dist/worker.js')
assert.equal(require.resolve('dynwinrt-jsx/worker'), workerPath)
const {
  createDiagnosticChannel,
  createFileHotReloadController,
  createRendererHeartbeatController,
  defineWinUIApp,
  installWinUIWindowLifecycle,
  runWinUIWorkerApp: runWinUIWorkerAppRuntime,
} = require('dynwinrt-jsx/worker')

function runWinUIWorkerApp(options) {
  const application = options.application
  return runWinUIWorkerAppRuntime({
    ...options,
    application:
      typeof application.startScheduled === 'function'
        ? application
        : {
            ...application,
            startScheduled(callback) {
              application.start(callback)
              return Promise.resolve()
            },
          },
  })
}

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

function createWindowHarness(options = {}) {
  let closing
  let closingActive = false
  let closed
  let closeFailures = options.closeFailures ?? 0
  const order = []
  return {
    order,
    window: {
      onClosed(callback) {
        closed = callback
        return () => order.push('closed-unsubscribe')
      },
      close() {
        order.push('window-close')
        if (closeFailures > 0) {
          closeFailures -= 1
          throw new Error('window close failed')
        }
        if (closingActive) {
          const args = { cancel: false }
          closing(undefined, args)
          if (!args.cancel) {
            closed?.()
          }
        }
        else {
          closed?.()
        }
      },
    },
    appWindow: {
      onClosing(callback) {
        closing = callback
        closingActive = true
        return () => {
          closingActive = false
          order.push('closing-unsubscribe')
        }
      },
    },
    close(args = { cancel: false }) {
      if (closingActive) {
        closing(undefined, args)
      }
      return args
    },
    closed() {
      closed()
    },
    isClosingActive() {
      return closingActive
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

test('window lifecycle rejects non-idle inspector state', () => {
  const harness = createWindowHarness()
  const errors = []
  const exitCodes = []
  installWinUIWindowLifecycle({
    application: {
      current: { exit() {} },
    },
    window: harness.window,
    appWindow: harness.appWindow,
    renderer: {
      diagnostics: idleDiagnostics,
      inspector: {
        snapshot() {
          return {
            timestamp: 1,
            diagnostics: idleDiagnostics,
            nodes: [{
              id: 1,
              kind: 'native',
              label: 'Button',
              scopeId: 1,
            }],
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
    disposeRender() {},
    onError(error) {
      errors.push(error)
    },
    getRequestedExitCode: () => 0,
    setExitCode(value) {
      exitCodes.push(value)
    },
  })

  harness.close()

  assert.equal(exitCodes.at(-1), 1)
  assert.match(errors[0].message, /is not idle/)
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

test('window lifecycle awaits async cleanup before teardown', async () => {
  const harness = createWindowHarness()
  let finishCleanup
  const cleanupGate = new Promise((resolve) => {
    finishCleanup = resolve
  })
  installWinUIWindowLifecycle({
    application: {
      current: { exit() {} },
    },
    window: harness.window,
    appWindow: harness.appWindow,
    renderer: { diagnostics: idleDiagnostics },
    async beforeCloseAsync() {
      harness.order.push('async-start')
      await cleanupGate
      harness.order.push('async-finish')
    },
    disposeRender() {
      harness.order.push('render')
    },
    onError(error) {
      throw error
    },
    getRequestedExitCode: () => 0,
    setExitCode() {},
  })

  const args = harness.close()
  assert.equal(args.cancel, true)
  await Promise.resolve()
  assert.deepEqual(harness.order, ['async-start'])
  finishCleanup()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(harness.order, [
    'async-start',
    'async-finish',
    'closing-unsubscribe',
    'window-close',
    'render',
    'closing-unsubscribe',
    'closed-unsubscribe',
  ])
})

test('window lifecycle does not reclose after Closed during async cleanup', async () => {
  const harness = createWindowHarness()
  let finishCleanup
  const cleanupGate = new Promise((resolve) => {
    finishCleanup = resolve
  })
  installWinUIWindowLifecycle({
    application: {
      current: { exit() {} },
    },
    window: harness.window,
    appWindow: harness.appWindow,
    renderer: { diagnostics: idleDiagnostics },
    async beforeCloseAsync() {
      harness.order.push('async-start')
      await cleanupGate
      harness.order.push('async-finish')
    },
    disposeRender() {
      harness.order.push('render')
    },
    onError(error) {
      throw error
    },
    getRequestedExitCode: () => 0,
    setExitCode() {},
  })

  assert.equal(harness.close().cancel, true)
  harness.closed()
  assert.deepEqual(harness.order, [
    'async-start',
  ])

  finishCleanup()
  await new Promise((resolve) => setImmediate(resolve))

  assert.deepEqual(harness.order, [
    'async-start',
    'async-finish',
    'render',
    'closing-unsubscribe',
    'closed-unsubscribe',
  ])
  assert.equal(
    harness.order.includes('window-close'),
    false,
  )
})

test('window lifecycle reports async cleanup failure and permits retry', async () => {
  const harness = createWindowHarness()
  const failure = new Error('async cleanup failed')
  const errors = []
  const exitCodes = []
  let attempts = 0
  installWinUIWindowLifecycle({
    application: {
      current: { exit() {} },
    },
    window: harness.window,
    appWindow: harness.appWindow,
    renderer: { diagnostics: idleDiagnostics },
    async beforeCloseAsync() {
      attempts += 1
      if (attempts === 1) {
        throw failure
      }
    },
    disposeRender() {
      harness.order.push('render')
    },
    onError(error) {
      errors.push(error)
    },
    getRequestedExitCode: () => 0,
    setExitCode(value) {
      exitCodes.push(value)
    },
  })

  assert.equal(harness.close().cancel, true)
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(errors, [failure])
  assert.deepEqual(harness.order, [])

  assert.equal(harness.close().cancel, true)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(attempts, 2)
  assert.deepEqual(harness.order, [
    'closing-unsubscribe',
    'window-close',
    'render',
    'closing-unsubscribe',
    'closed-unsubscribe',
  ])
  assert.equal(exitCodes.at(-1), 1)
})

test('window lifecycle preserves Closing subscription when final close fails', () => {
  const harness = createWindowHarness({
    closeFailures: 1,
  })
  const errors = []
  let asyncAttempts = 0

  installWinUIWindowLifecycle({
    application: {
      current: { exit() {} },
    },
    window: harness.window,
    appWindow: harness.appWindow,
    renderer: { diagnostics: idleDiagnostics },
    beforeCloseAsync() {
      asyncAttempts += 1
    },
    disposeRender() {
      harness.order.push('render')
    },
    onError(error) {
      errors.push(error)
    },
    getRequestedExitCode: () => 0,
    setExitCode() {},
  })

  assert.equal(harness.close().cancel, true)
  assert.match(errors[0].message, /window close failed/)
  assert.equal(
    harness.isClosingActive(),
    true,
  )

  assert.equal(harness.close().cancel, true)
  assert.equal(asyncAttempts, 2)
  assert.equal(
    harness.order.includes('closing-unsubscribe'),
    true,
  )
})

test('window lifecycle does not complete a cancelled final close', () => {
  const closingHandlers = []
  let closed
  let closedCount = 0
  const errors = []
  const releases = []
  const appWindow = {
    onClosing(callback) {
      const entry = { active: true, callback }
      closingHandlers.push(entry)
      return () => {
        entry.active = false
      }
    },
  }
  const emitClosing = () => {
    const args = { cancel: false }
    for (const entry of closingHandlers) {
      if (entry.active) {
        entry.callback(undefined, args)
      }
    }
    if (!args.cancel) {
      closed?.()
      closedCount += 1
    }
    return args
  }
  const window = {
    close() {
      emitClosing()
    },
    onClosed(callback) {
      closed = callback
      return () => {}
    },
  }

  installWinUIWindowLifecycle({
    application: {
      current: { exit() {} },
    },
    window,
    appWindow,
    renderer: { diagnostics: idleDiagnostics },
    beforeCloseAsync() {},
    disposeRender() {},
    releaseAppWindow() {
      releases.push('app-window')
    },
    releaseWindow() {
      releases.push('window')
    },
    releaseApplicationCurrent() {
      releases.push('application')
    },
    onError(error) {
      errors.push(error)
    },
    getRequestedExitCode: () => 0,
    setExitCode() {},
  })
  appWindow.onClosing((_sender, args) => {
    args.cancel = true
  })

  assert.equal(emitClosing().cancel, true)
  assert.equal(closedCount, 0)
  assert.deepEqual(releases, [])
  assert.match(
    errors[0].message,
    /without raising Window\.Closed/,
  )
})

test('window lifecycle preserves cancellation before its final-close handler', () => {
  const closingHandlers = []
  let closedCount = 0
  let closingCount = 0
  const errors = []
  const appWindow = {
    onClosing(callback) {
      const entry = { active: true, callback }
      closingHandlers.push(entry)
      return () => {
        entry.active = false
      }
    },
  }
  appWindow.onClosing((_sender, args) => {
    closingCount += 1
    if (closingCount > 1) {
      args.cancel = true
    }
  })
  const emitClosing = () => {
    const args = { cancel: false }
    for (const entry of closingHandlers) {
      if (entry.active) {
        entry.callback(undefined, args)
      }
    }
    return args
  }
  const window = {
    close() {
      const args = emitClosing()
      if (!args.cancel) {
        closedCount += 1
      }
    },
    onClosed() {
      return () => {}
    },
  }

  installWinUIWindowLifecycle({
    application: {
      current: { exit() {} },
    },
    window,
    appWindow,
    renderer: { diagnostics: idleDiagnostics },
    beforeCloseAsync() {},
    disposeRender() {},
    onError(error) {
      errors.push(error)
    },
    getRequestedExitCode: () => 0,
    setExitCode() {},
  })

  assert.equal(emitClosing().cancel, true)
  assert.equal(closedCount, 0)
  assert.match(
    errors[0].message,
    /without raising Window\.Closed/,
  )
})

test('window lifecycle reports Window.Closed cleanup failures', () => {
  const harness = createWindowHarness()
  const errors = []
  const exitCodes = []
  installWinUIWindowLifecycle({
    application: {
      current: { exit() {} },
    },
    window: harness.window,
    appWindow: harness.appWindow,
    renderer: { diagnostics: idleDiagnostics },
    disposeRender() {},
    releaseAppWindow() {
      throw new Error('root release failed')
    },
    onError(error) {
      errors.push(error)
    },
    getRequestedExitCode: () => 0,
    setExitCode(value) {
      exitCodes.push(value)
    },
  })

  harness.close()
  harness.closed()

  assert.match(errors[0].message, /root release failed/)
  assert.equal(exitCodes.at(-1), 1)
})

test('window lifecycle completes Closed cleanup when final unsubscribe fails', () => {
  let closing
  let closed
  let unsubscribeCount = 0
  const errors = []
  const releases = []
  const appWindow = {
    onClosing(callback) {
      closing = callback
      return () => {
        unsubscribeCount += 1
        if (unsubscribeCount === 2) {
          throw new Error('unsubscribe failed')
        }
      }
    },
  }
  const window = {
    close() {
      const args = { cancel: false }
      closing(undefined, args)
      if (!args.cancel) {
        closed()
      }
    },
    onClosed(callback) {
      closed = callback
      return () => {}
    },
  }

  installWinUIWindowLifecycle({
    application: {
      current: {
        exit() {
          releases.push('application-exit')
        },
      },
    },
    window,
    appWindow,
    renderer: { diagnostics: idleDiagnostics },
    beforeCloseAsync() {},
    disposeRender() {},
    releaseAppWindow() {
      releases.push('app-window')
    },
    releaseWindow() {
      releases.push('window')
    },
    releaseApplicationCurrent() {
      releases.push('application')
    },
    onError(error) {
      errors.push(error)
    },
    getRequestedExitCode: () => 0,
    setExitCode() {},
  })

  closing(undefined, { cancel: false })

  assert.deepEqual(releases, [
    'app-window',
    'window',
    'application-exit',
    'application',
  ])
  assert.match(errors[0].message, /unsubscribe failed/)
})

test('window lifecycle retries projection cleanup after Window.Closed', () => {
  const queue = []
  const errors = []
  const releases = []
  let closing
  let closed
  let projectionAttempts = 0
  let closingUnsubscribeCount = 0
  const window = {
    dispatcherQueue: {
      tryEnqueue(callback) {
        queue.push(callback)
        return true
      },
    },
    close() {
      closed()
    },
    onClosed(callback) {
      closed = callback
      return () => {}
    },
  }
  const appWindow = {
    onClosing(callback) {
      closing = callback
      return () => {
        closingUnsubscribeCount += 1
      }
    },
  }

  installWinUIWindowLifecycle({
    application: {
      current: {
        exit() {
          releases.push('application-exit')
        },
      },
    },
    window,
    appWindow,
    renderer: { diagnostics: idleDiagnostics },
    beforeCloseAsync() {},
    disposeRender() {},
    disposeProjection() {
      projectionAttempts += 1
      if (projectionAttempts === 1) {
        throw new Error('projection failed')
      }
    },
    releaseAppWindow() {
      releases.push('app-window')
    },
    releaseWindow() {
      releases.push('window')
    },
    releaseApplicationCurrent() {
      releases.push('application')
    },
    onError(error) {
      errors.push(error)
    },
    getRequestedExitCode: () => 0,
    setExitCode() {},
  })

  const args = { cancel: false }
  closing(undefined, args)
  assert.equal(args.cancel, true)
  assert.equal(queue.length, 1)

  queue.shift()()
  assert.equal(projectionAttempts, 1)
  assert.deepEqual(releases, [])
  assert.equal(queue.length, 1)

  queue.shift()()
  assert.equal(projectionAttempts, 2)
  assert.equal(closingUnsubscribeCount, 2)
  assert.deepEqual(releases, [
    'app-window',
    'window',
    'application-exit',
    'application',
  ])
  assert.match(errors[0].message, /projection failed/)
})

test('window lifecycle retries immediately when Closed enqueue fails', () => {
  const releases = []
  let projectionAttempts = 0
  let closed
  const window = {
    dispatcherQueue: {
      tryEnqueue() {
        return false
      },
    },
    onClosed(callback) {
      closed = callback
      return () => {}
    },
  }

  installWinUIWindowLifecycle({
    application: {
      current: {
        exit() {
          releases.push('application-exit')
        },
      },
    },
    window,
    appWindow: {
      onClosing() {
        return () => {}
      },
    },
    renderer: { diagnostics: idleDiagnostics },
    disposeRender() {},
    disposeProjection() {
      projectionAttempts += 1
      if (projectionAttempts === 1) {
        throw new Error('projection failed')
      }
    },
    releaseAppWindow() {
      releases.push('app-window')
    },
    releaseWindow() {
      releases.push('window')
    },
    releaseApplicationCurrent() {
      releases.push('application')
    },
    onError() {},
    getRequestedExitCode: () => 0,
    setExitCode() {},
  })

  closed()

  assert.equal(projectionAttempts, 2)
  assert.deepEqual(releases, [
    'app-window',
    'window',
    'application-exit',
    'application',
  ])
})

test('worker app owns startup, mount, activation, and close order', async () => {
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

  const exitCode = await runWinUIWorkerApp({
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
    releaseProjectedValue(value) {
      if (value === appWindow) {
        order.push('release-app-window')
      }
      else if (value === window) {
        order.push('release-window')
      }
      else {
        order.push('release-application')
      }
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
          closing(undefined, { cancel: false           })

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
    'release-app-window',
    'release-window',
    'application-exit',
    'release-application',
  ])
})

test('worker app requires scheduled Application start', async () => {
  const order = []
  const appWindow = {
    onClosing() {
      return () => {}
    },
  }
  const window = {
    appWindow,
    onClosed() {
      return () => {}
    },
    activate() {
      order.push('activate')
    },
  }

  const result = runWinUIWorkerAppRuntime({
    application: {
      current: {
        exit() {},
      },
      startScheduled(callback) {
        order.push('start-scheduled')
        callback()
        return Promise.resolve()
      },
      create(callback) {
        order.push('create')
        callback()
      },
    },
    createRenderer() {
      return {
        diagnostics: idleDiagnostics,
        render() {
          order.push('render')
          return {
            container: window,
            roots: [],
            disposed: false,
            update() {},
            dispose() {},
          }
        },
      }
    },
    createWindow() {
      return window
    },
    mount() {
      return { child: 'tree' }
    },
    onError(error) {
      throw error
    },
  })

  assert.equal(result instanceof Promise, true)
  assert.equal(await result, 0)
  assert.deepEqual(order, [
    'start-scheduled',
    'create',
    'render',
    'activate',
  ])
})

test('worker app cleans projection scope after mount failure', async () => {
  const order = []
  const failure = new Error('mount failed')
  const errors = []

  const exitCode = await runWinUIWorkerApp({
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

test('worker app releases every acquired root after startup failure', () => {
  const order = []
  const current = {
    exit() {
      order.push('application-exit')
    },
  }
  const appWindow = {}
  const window = {
    appWindow,
    onClosed() {
      return () => {}
    },
    activate() {},
  }

  runWinUIWorkerApp({
    application: {
      current,
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
      return window
    },
    releaseProjectedValue(value) {
      if (value === appWindow) {
        order.push('release-app-window')
        throw new Error('app window release failed')
      }
      if (value === window) {
        order.push('release-window')
        return
      }
      if (value === current) {
        order.push('release-application')
      }
    },
    configureWindow() {
      throw new Error('configure failed')
    },
    mount() {
      throw new Error('mount should not run')
    },
    onError() {},
  })

  assert.deepEqual(order, [
    'release-app-window',
    'release-window',
    'application-exit',
    'release-application',
  ])
})

test('worker app does not repeat successful cleanup after activation failure', async () => {
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
  let rootAppWindow
  let rootWindow
  const released = new Set()
  const current = {
    exit() {
      assert.equal(released.has(rootAppWindow), true)
      assert.equal(released.has(rootWindow), true)
      exiting = true
    },
  }

  const exitCode = await runWinUIWorkerApp({
    application: {
      current,
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
      rootAppWindow = {
        onClosing(callback) {
          closing = callback
          return () => {}
        },
      }
      rootWindow = {
        appWindow: rootAppWindow,
        close() {
          const args = { cancel: false }
          closing(undefined, args)
          if (!args.cancel) {
            closed()
          }
        },
        onClosed(callback) {
          closed = callback
          return () => {}
        },
        activate() {},
      }
      return rootWindow
    },
    releaseProjectedValue(value) {
      released.add(value)
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
  assert.equal(released.has(rootAppWindow), true)
  assert.equal(released.has(rootWindow), true)
  assert.equal(released.has(current), true)
})

test('worker app closes through lifecycle when activation exit fails', () => {
  const errors = []
  const order = []
  let closing
  let closed
  const current = {
    exit() {
      throw new Error('application exit failed')
    },
  }
  const appWindow = {
    onClosing(callback) {
      closing = callback
      return () => {}
    },
  }
  const window = {
    appWindow,
    close() {
      const args = { cancel: false }
      closing(undefined, args)
      if (!args.cancel) {
        closed()
      }
    },
    onClosed(callback) {
      closed = callback
      return () => {}
    },
    activate() {
      throw new Error('activate failed')
    },
  }

  runWinUIWorkerApp({
    application: {
      current,
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
            container: window,
            roots: [],
            disposed: false,
            update() {},
            dispose() {
              order.push('render-dispose')
            },
          }
        },
      }
    },
    createWindow() {
      return window
    },
    releaseProjectedValue(value) {
      if (value === appWindow) {
        order.push('release-app-window')
      }
      else if (value === window) {
        order.push('release-window')
      }
      else if (value === current) {
        order.push('release-application')
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
      return { child: 'tree' }
    },
    onError(error) {
      errors.push(error)
    },
  })

  assert.equal(
    errors.some((error) =>
      /activate failed/.test(error.message)),
    true,
  )
  assert.equal(
    errors.some((error) =>
      /application exit failed/.test(error.message)),
    true,
  )
  assert.deepEqual(order, [
    'render-dispose',
    'projection-dispose',
    'release-app-window',
    'release-window',
    'release-application',
  ])
})

test('worker app force-cleans when activation close fails', () => {
  const errors = []
  const order = []
  const current = {
    exit() {
      order.push('application-exit')
    },
  }
  const appWindow = {
    onClosing() {
      return () => {}
    },
  }
  const window = {
    appWindow,
    close() {
      order.push('window-close')
      throw new Error('window close failed')
    },
    onClosed() {
      return () => {}
    },
    activate() {
      throw new Error('activate failed')
    },
  }

  runWinUIWorkerApp({
    application: {
      current,
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
            container: window,
            roots: [],
            disposed: false,
            update() {},
            dispose() {
              order.push('render-dispose')
            },
          }
        },
      }
    },
    createWindow() {
      return window
    },
    releaseProjectedValue(value) {
      if (value === appWindow) {
        order.push('release-app-window')
      }
      else if (value === window) {
        order.push('release-window')
      }
      else if (value === current) {
        order.push('release-application')
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
      return { child: 'tree' }
    },
    onError(error) {
      errors.push(error)
    },
  })

  assert.equal(
    errors.some((error) =>
      /activate failed/.test(error.message)),
    true,
  )
  assert.equal(
    errors.some((error) =>
      /window close failed/.test(error.message)),
    true,
  )
  assert.deepEqual(order, [
    'window-close',
    'render-dispose',
    'projection-dispose',
    'release-app-window',
    'release-window',
    'application-exit',
    'release-application',
  ])
})

test('worker app waits for pending async cleanup after activation failure', async () => {
  const order = []
  let closing
  let closed
  let finishCleanup
  let closeCount = 0
  const cleanupGate = new Promise((resolve) => {
    finishCleanup = resolve
  })
  const window = {
    appWindow: {
      onClosing(callback) {
        closing = callback
        return () => {}
      },
    },
    close() {
      closeCount += 1
      const args = { cancel: false }
      closing(undefined, args)
      if (!args.cancel) {
        closed()
      }
    },
    onClosed(callback) {
      closed = callback
      return () => {}
    },
    activate() {
      throw new Error('activate failed')
    },
  }

  runWinUIWorkerApp({
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
          return {
            container: window,
            roots: [],
            disposed: false,
            update() {},
            dispose() {
              order.push('render-dispose')
            },
          }
        },
      }
    },
    createWindow() {
      return window
    },
    createProjectionScope() {
      return {
        dispose() {
          order.push('projection-dispose')
        },
      }
    },
    mount() {
      return {
        child: 'tree',
        async beforeCloseAsync() {
          order.push('async-start')
          await cleanupGate
          order.push('async-finish')
        },
        afterActivate() {
          throw new Error('after activate failed')
        },
      }
    },
    onError() {},
  })

  assert.deepEqual(order, ['async-start'])
  assert.equal(closeCount, 1)

  finishCleanup()
  await new Promise((resolve) => setImmediate(resolve))

  assert.deepEqual(order, [
    'async-start',
    'async-finish',
    'render-dispose',
    'projection-dispose',
    'application-exit',
  ])
  assert.equal(closeCount, 2)
})

test('worker app runs beforeClose once across projection retry', async () => {
  let closing
  let closed
  let beforeCloseCount = 0
  let projectionAttempts = 0
  const errors = []

  const exitCode = await runWinUIWorkerApp({
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

test('worker app reports renderer creation failure without starting', async () => {
  const failure = new Error('renderer failed')
  const errors = []
  let started = false

  const exitCode = await runWinUIWorkerApp({
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

function createDefinedAppHarness() {
  const order = []
  const released = []
  const scopes = []
  let applicationStartCount = 0

  class TextBlock {
    text = ''
  }

  class Window {
    content = null
    closing
    closed
    appWindow = {
      onClosing: (callback) => {
        this.closing = callback
        return () => order.push('closing-unsubscribe')
      },
    }

    onClosed(callback) {
      this.closed = callback
      return () => order.push('closed-unsubscribe')
    }

    activate() {
      order.push('window-activate')
    }

    close() {
      order.push('window-close')
      const args = { cancel: false }
      this.closing(undefined, args)
      if (!args.cancel) {
        this.closed()
      }
    }
  }

  const current = {
    exit() {
      order.push('application-exit')
    },
  }
  const bindings = {
    Application: {
      current,
      startScheduled(callback) {
        applicationStartCount += 1
        order.push('application-start')
        callback()
        return Promise.resolve()
      },
      create(callback) {
        order.push('application-create')
        callback()
      },
    },
    Window,
    TextBlock,
    createProjectedLifetimeScope() {
      const scope = {
        disposed: false,
        dispose() {
          order.push('projection-dispose')
          scope.disposed = true
        },
      }
      scopes.push(scope)
      return scope
    },
    releaseProjected(value) {
      released.push(value)
    },
  }

  return {
    bindings,
    order,
    released,
    scopes,
    get applicationStartCount() {
      return applicationStartCount
    },
  }
}

test('defined app owns generated renderer and lifetime wiring', async () => {
  const harness = createDefinedAppHarness()
  const Text = native(harness.bindings.TextBlock)
  const records = []
  const errors = []
  let overriddenReleaseCount = 0
  const diagnostics = createDiagnosticChannel({
    source: 'defined-app-test',
    onRecord(record) {
      records.push(record)
    },
  })
  const app = defineWinUIApp({
    bindings: harness.bindings,
    diagnostics,
    initializeRuntime() {
      harness.order.push('runtime-initialize')
    },
    rendererOptions: {
      releaseNative() {
        overriddenReleaseCount += 1
      },
    },
    configureWindow({
      bindings,
      capabilities,
      releaseProjected,
    }) {
      assert.equal(bindings, harness.bindings)
      assert.equal(capabilities.text, true)
      assert.equal(
        releaseProjected,
        harness.bindings.releaseProjected,
      )
      harness.order.push('window-configure')
    },
    mount({
      bindings,
      diagnostics: mountedDiagnostics,
      createProjectedOwner,
      ownProjected,
      createProjected,
    }) {
      assert.equal(bindings, harness.bindings)
      assert.equal(mountedDiagnostics, diagnostics)
      const manual = createProjectedOwner(
        new bindings.TextBlock(),
      )
      manual.dispose()
      function OwnedProjection() {
        const created = createProjected(
          () => new bindings.TextBlock(),
        )
        const owned = new bindings.TextBlock()
        assert.equal(ownProjected(owned), owned)
        assert.notEqual(
          created,
          owned,
        )
        return Text({ text: 'Hello' })
      }
      return {
        child: jsx(OwnedProjection, {}),
        afterActivate({
          window,
          createProjected: renderedCreateProjected,
        }) {
          assert.equal(
            renderedCreateProjected,
            createProjected,
          )
          window.close()
        },
      }
    },
    onError(error) {
      errors.push(error)
    },
  })

  assert.equal(app.started, false)
  assert.equal(app.capabilities.text, true)
  const exitCode = await app.run()

  assert.equal(exitCode, 0)
  assert.equal(app.started, true)
  assert.equal(harness.applicationStartCount, 1)
  assert.equal(harness.scopes.length, 1)
  assert.equal(harness.scopes[0].disposed, true)
  assert.equal(overriddenReleaseCount, 0)
  assert.equal(
    harness.released.some(
      (value) => value instanceof harness.bindings.TextBlock,
    ),
    true,
  )
  assert.deepEqual(errors, [])
  assert.ok(
    records.some(
      (record) =>
        record.kind === 'lifecycle' &&
        record.payload.target === 'window' &&
        record.payload.state === 'active',
    ),
  )
  assert.ok(
    records.some(
      (record) =>
        record.kind === 'ownership' &&
        record.payload.resource === 'projection-scope' &&
        record.payload.action === 'released',
    ),
  )
  assert.ok(
    records.some(
      (record) =>
        record.kind === 'snapshot' &&
        record.payload.name === 'renderer-final',
    ),
  )
  await assert.rejects(
    app.run(),
    /can only run once/,
  )
})

test('defined app reports runtime initialization failure', async () => {
  const harness = createDefinedAppHarness()
  const errors = []
  const records = []
  const app = defineWinUIApp({
    bindings: harness.bindings,
    initializeRuntime() {
      throw new Error('runtime init failed')
    },
    mount() {
      throw new Error('mount should not run')
    },
    diagnostics: createDiagnosticChannel({
      source: 'defined-app-test',
      onRecord(record) {
        records.push(record)
      },
    }),
    onError(error) {
      errors.push(error)
    },
  })

  assert.equal(await app.run(), 1)
  assert.equal(harness.applicationStartCount, 0)
  assert.match(errors[0].message, /runtime init failed/)
  assert.ok(
    records.some(
      (record) =>
        record.kind === 'error' &&
        record.payload.operation === 'worker-starting',
    ),
  )
  assert.ok(
    records.some(
      (record) =>
        record.kind === 'lifecycle' &&
        record.payload.target === 'worker' &&
        record.payload.state === 'failed',
    ),
  )
})

test('defined app does not report pre-activation failures as closed', async () => {
  const harness = createDefinedAppHarness()
  const errors = []
  const records = []
  const app = defineWinUIApp({
    bindings: harness.bindings,
    configureWindow() {
      throw new Error('window configuration failed')
    },
    mount() {
      throw new Error('mount should not run')
    },
    diagnostics: createDiagnosticChannel({
      source: 'defined-app-test',
      onRecord(record) {
        records.push(record)
      },
    }),
    onError(error) {
      errors.push(error)
    },
  })

  assert.equal(await app.run(), 1)
  assert.match(
    errors[0].message,
    /window configuration failed/,
  )
  assert.ok(
    records.some(
      (record) =>
        record.kind === 'lifecycle' &&
        record.payload.target === 'window' &&
        record.payload.state === 'failed',
    ),
  )
  assert.equal(
    records.some(
      (record) =>
        record.kind === 'lifecycle' &&
        record.payload.target === 'window' &&
        record.payload.state === 'closed',
    ),
    false,
  )
})

test('defined app requires the new generated binding contract', () => {
  const harness = createDefinedAppHarness()
  assert.throws(
    () => defineWinUIApp({
      bindings: {
        ...harness.bindings,
        Application: {
          current: harness.bindings.Application.current,
          create: harness.bindings.Application.create,
        },
      },
      mount() {
        return { child: null }
      },
      onError() {},
    }),
    /Application\.startScheduled/,
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
