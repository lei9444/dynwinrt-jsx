'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createRenderer,
  createSecondaryWindowManager,
  native,
  onCleanup,
} = require('../dist/index.js')

class FakeEvent {
  entries = []
  subscribeFailures = 0
  unsubscribeFailures = 0

  subscribe(callback) {
    if (this.subscribeFailures > 0) {
      this.subscribeFailures -= 1
      throw new Error('subscribe failed')
    }
    const entry = {
      active: true,
      callback,
    }
    this.entries.push(entry)
    return () => {
      if (!entry.active) {
        return
      }
      if (this.unsubscribeFailures > 0) {
        this.unsubscribeFailures -= 1
        throw new Error('unsubscribe failed')
      }
      entry.active = false
    }
  }

  emit(...args) {
    let firstError
    for (const entry of this.entries) {
      if (!entry.active) {
        continue
      }
      try {
        entry.callback(...args)
      }
      catch (error) {
        firstError ??= error
      }
    }
    if (firstError !== undefined) {
      throw firstError
    }
  }
}

class FakeAppWindow {
  title = ''
  size = null
  shown = false
  destroyed = false
  destroyCount = 0
  failDestroyCount = 0
  closing = new FakeEvent()
  destroying = new FakeEvent()
  forceDestroy = null

  onClosing(callback) {
    return this.closing.subscribe(callback)
  }

  onDestroying(callback) {
    return this.destroying.subscribe(callback)
  }

  resizeClient(size) {
    this.size = size
  }

  show() {
    this.shown = true
  }

  requestClose() {
    const args = { cancel: false }
    this.closing.emit(this, args)
    if (!args.cancel) {
      this.destroy()
    }
    return args
  }

  destroy() {
    this.destroyCount += 1
    if (this.failDestroyCount > 0) {
      this.failDestroyCount -= 1
      throw new Error('destroy failed')
    }
    if (this.destroyed) {
      return
    }
    this.destroyed = true
    if (this.forceDestroy) {
      this.destroying.emit(this, undefined)
      this.forceDestroy()
      return
    }
    this.destroying.emit(this, undefined)
  }
}

class FakeXamlWindow {
  title = ''
  content = null
  activated = false
  closed = false
  appWindow = new FakeAppWindow()
  closedEvent = new FakeEvent()

  constructor() {
    this.appWindow.forceDestroy = () => this.finishClose()
  }

  onClosed(callback) {
    return this.closedEvent.subscribe(callback)
  }

  activate() {
    this.activated = true
  }

  close() {
    if (this.closed) {
      return
    }
    const args = { cancel: false }
    let closeError
    try {
      this.appWindow.closing.emit(this.appWindow, args)
    }
    catch (error) {
      closeError = error
    }
    if (!args.cancel) {
      try {
        this.finishClose()
      }
      catch (error) {
        closeError ??= error
      }
    }
    if (closeError !== undefined) {
      throw closeError
    }
  }

  finishClose() {
    if (this.closed) {
      return
    }
    let firstError
    if (!this.appWindow.destroyed) {
      this.appWindow.destroyed = true
      try {
        this.appWindow.destroying.emit(
          this.appWindow,
          undefined,
        )
      }
      catch (error) {
        firstError = error
      }
    }
    this.closed = true
    try {
      this.closedEvent.emit(this, undefined)
    }
    catch (error) {
      firstError ??= error
    }
    if (firstError !== undefined) {
      throw firstError
    }
  }
}

class TestText {
  text = ''
}

const TestTextControl = native(TestText)

function createRendererHarness(
  disposeFailures = 0,
  renderFailures = 0,
) {
  const handles = []
  return {
    handles,
    renderer: {
      render(child, target) {
        if (renderFailures > 0) {
          renderFailures -= 1
          throw new Error('render failed')
        }
        const handle = {
          child,
          target,
          disposed: false,
          dispose() {
            if (this.disposed) {
              return
            }
            if (disposeFailures > 0) {
              disposeFailures -= 1
              throw new Error('render dispose failed')
            }
            this.disposed = true
          },
        }
        handles.push(handle)
        return handle
      },
    },
  }
}

function createManager(options = {}) {
  const rendererHarness =
    createRendererHarness(
      options.disposeFailures,
      options.renderFailures,
    )
  const windows = []
  const manager = createSecondaryWindowManager({
    renderer: rendererHarness.renderer,
    createWindow() {
      const window = new FakeXamlWindow()
      windows.push(window)
      return window
    },
    configureWindow: options.configureWindow,
  })
  return {
    manager,
    windows,
    ...rendererHarness,
  }
}

test('secondary XAML windows preserve cancellation and force teardown', () => {
  const cleanup = []
  const closed = []
  const { manager, windows, handles } = createManager({
    configureWindow() {
      return () => cleanup.push('manager-configure')
    },
  })
  const scope = manager.createScope()
  scope.openXamlWindow({
    title: 'Child',
    configure() {
      return () => cleanup.push('window-configure')
    },
    content: () => ({ page: 'child' }),
    onClosing(_window, args) {
      args.cancel = true
    },
    onClosed() {
      closed.push('closed')
    },
  })

  const natural = windows[0].appWindow.requestClose()
  assert.equal(natural.cancel, true)
  assert.equal(handles[0].disposed, false)
  assert.equal(scope.xamlWindowCount, 1)

  scope.dispose()

  assert.equal(windows[0].closed, true)
  assert.equal(handles[0].disposed, true)
  assert.equal(scope.xamlWindowCount, 0)
  assert.equal(scope.disposed, true)
  assert.deepEqual(cleanup, [
    'window-configure',
    'manager-configure',
  ])
  assert.deepEqual(closed, [])
})

test('secondary XAML content runs in renderer ownership', () => {
  const renderer = createRenderer()
  const windows = []
  const manager = createSecondaryWindowManager({
    renderer,
    createWindow() {
      const window = new FakeXamlWindow()
      windows.push(window)
      return window
    },
  })
  const scope = manager.createScope()
  let cleanupCount = 0
  const handle = scope.openXamlWindow({
    title: 'Owned content',
    content: () => {
      onCleanup(() => {
        cleanupCount += 1
      })
      return TestTextControl({ text: 'Owned' })
    },
  })

  assert.equal(windows[0].content.text, 'Owned')
  handle.close()

  assert.equal(cleanupCount, 1)
  assert.equal(windows[0].content, null)
  assert.equal(renderer.diagnostics.activeNative, 0)
  assert.equal(renderer.diagnostics.activeComponents, 0)
  scope.dispose()
  manager.dispose()
})

test('secondary XAML render cleanup remains retryable', () => {
  const { manager, windows, handles } = createManager({
    disposeFailures: 1,
  })
  const scope = manager.createScope()
  scope.openXamlWindow({
    title: 'Retry child',
    content: () => ({ page: 'child' }),
  })

  assert.throws(
    () => scope.dispose(),
    /render dispose failed/,
  )
  assert.equal(windows[0].closed, true)
  assert.equal(handles[0].disposed, true)
  assert.equal(scope.disposed, false)
  assert.equal(scope.xamlWindowCount, 0)

  scope.dispose()

  assert.equal(windows[0].closed, true)
  assert.equal(handles[0].disposed, true)
  assert.equal(scope.disposed, true)
})

test('failed secondary XAML creation releases its owned record', () => {
  const { manager } = createManager({
    renderFailures: 1,
  })
  const scope = manager.createScope()

  assert.throws(
    () => scope.openXamlWindow({
      title: 'Failed child',
      content: () => ({ page: 'child' }),
    }),
    /render failed/,
  )

  assert.equal(scope.xamlWindowCount, 0)
  assert.equal(manager.xamlWindowCount, 0)
  scope.dispose()
  manager.dispose()
})

test('failed XAML Closing subscription forces rollback destruction', () => {
  const { manager, handles } = createManager()
  const scope = manager.createScope()

  assert.throws(
    () => scope.openXamlWindow({
      title: 'Failed Closing subscription',
      configure(window) {
        const unsubscribe = window.appWindow.onClosing(
          (_sender, args) => {
            args.cancel = true
          },
        )
        window.appWindow.closing.subscribeFailures = 1
        return unsubscribe
      },
      content: () => ({ page: 'child' }),
    }),
    /subscribe failed/,
  )

  assert.equal(handles[0].disposed, true)
  assert.equal(scope.xamlWindowCount, 0)
  assert.equal(manager.xamlWindowCount, 0)
  scope.dispose()
  manager.dispose()
})

test('throwing XAML onClosing still disposes render before close', () => {
  const { manager, windows, handles } = createManager()
  const scope = manager.createScope()
  const handle = scope.openXamlWindow({
    title: 'Throwing close',
    content: () => ({ page: 'child' }),
    onClosing() {
      throw new Error('closing failed')
    },
  })

  assert.throws(
    () => handle.close(),
    /closing failed/,
  )
  assert.equal(handles[0].disposed, true)
  assert.equal(windows[0].closed, true)
  assert.equal(scope.xamlWindowCount, 0)
  scope.dispose()
})

test('natural XAML close preserves earlier cancellation', () => {
  const rendererHarness = createRendererHarness()
  let window
  const manager = createSecondaryWindowManager({
    renderer: rendererHarness.renderer,
    createWindow() {
      window = new FakeXamlWindow()
      window.appWindow.onClosing((_sender, args) => {
        args.cancel = true
      })
      return window
    },
  })
  const scope = manager.createScope()
  const handle = scope.openXamlWindow({
    title: 'Earlier cancel',
    content: () => ({ page: 'child' }),
    onClosing(_window, args) {
      args.cancel = false
    },
  })

  handle.close()

  assert.equal(window.closed, false)
  assert.equal(rendererHarness.handles[0].disposed, false)
  scope.dispose()
})

test('natural XAML close preserves configure cancellation', () => {
  const { manager, windows, handles } = createManager()
  const scope = manager.createScope()
  const handle = scope.openXamlWindow({
    title: 'Configure cancel',
    configure(window) {
      return window.appWindow.onClosing((_sender, args) => {
        args.cancel = true
      })
    },
    content: () => ({ page: 'child' }),
  })

  handle.close()

  assert.equal(windows[0].closed, false)
  assert.equal(handles[0].disposed, false)
  scope.dispose()
})

test('natural XAML close preserves later cancellation and content', () => {
  const renderer = createRenderer()
  const windows = []
  const manager = createSecondaryWindowManager({
    renderer,
    createWindow() {
      const window = new FakeXamlWindow()
      windows.push(window)
      return window
    },
  })
  const scope = manager.createScope()
  const handle = scope.openXamlWindow({
    title: 'Later cancel',
    content: () => TestTextControl({ text: 'Still here' }),
  })
  handle.appWindow.onClosing((_sender, args) => {
    args.cancel = true
  })

  handle.close()

  assert.equal(handle.closed, false)
  assert.equal(windows[0].content.text, 'Still here')
  assert.equal(renderer.diagnostics.activeNative, 1)
  scope.dispose()
  assert.equal(renderer.diagnostics.activeNative, 0)
  manager.dispose()
})

test('reentrant XAML close releases newly returned cleanup', () => {
  let cleanupCount = 0
  const { manager } = createManager({
    configureWindow(window) {
      window.close()
      return () => {
        cleanupCount += 1
      }
    },
  })
  const scope = manager.createScope()

  assert.throws(
    () => scope.openXamlWindow({
      title: 'Reentrant configure close',
      content: () => ({ page: 'child' }),
    }),
    /closed during configuration/,
  )

  assert.equal(cleanupCount, 1)
  assert.equal(scope.xamlWindowCount, 0)
  scope.dispose()
})

test('reentrant XAML content close disposes the returned render handle', () => {
  const renderer = createRenderer()
  const windows = []
  const manager = createSecondaryWindowManager({
    renderer,
    createWindow() {
      const window = new FakeXamlWindow()
      windows.push(window)
      return window
    },
  })
  const scope = manager.createScope()

  assert.throws(
    () => scope.openXamlWindow({
      title: 'Reentrant content close',
      content(window) {
        window.close()
        return TestTextControl({ text: 'Child' })
      },
    }),
    /closed during creation/,
  )

  assert.equal(windows[0].content, null)
  assert.equal(renderer.diagnostics.activeNative, 0)
  assert.equal(renderer.diagnostics.activeComponents, 0)
  assert.equal(scope.xamlWindowCount, 0)
  scope.dispose()
})

test('reentrant XAML configure cleanup does not recurse', () => {
  const { manager } = createManager()
  const scope = manager.createScope()
  let handle
  handle = scope.openXamlWindow({
    title: 'Reentrant cleanup',
    configure() {
      return () => handle.close()
    },
    content: () => ({ page: 'child' }),
  })

  handle.close()

  assert.equal(handle.closed, true)
  assert.equal(scope.xamlWindowCount, 0)
  scope.dispose()
})

test('secondary XAML teardown destroys a later-canceled close', () => {
  const { manager, windows } = createManager()
  const scope = manager.createScope()
  const handle = scope.openXamlWindow({
    title: 'Late cancel',
    content: () => ({ page: 'child' }),
  })
  handle.appWindow.onClosing((_sender, args) => {
    args.cancel = true
  })

  scope.closeAll()

  assert.equal(windows[0].closed, true)
  assert.equal(windows[0].appWindow.destroyCount, 1)
  assert.equal(scope.xamlWindowCount, 0)
})

test('scope teardown suppresses reentrant sibling onClosed callbacks', () => {
  const { manager } = createManager()
  const scope = manager.createScope()
  const closed = []
  let second
  scope.openXamlWindow({
    title: 'First',
    content: () => ({ page: 'first' }),
    onClosing() {
      second.close()
    },
    onClosed() {
      closed.push('first')
    },
  })
  second = scope.openXamlWindow({
    title: 'Second',
    content: () => ({ page: 'second' }),
    onClosed() {
      closed.push('second')
    },
  })

  scope.dispose()

  assert.deepEqual(closed, [])
  assert.equal(scope.disposed, true)
})

test('cyclic sibling closes do not recurse during scope teardown', () => {
  const { manager } = createManager()
  const scope = manager.createScope()
  let first
  let second
  first = scope.openXamlWindow({
    title: 'First cycle',
    content: () => ({ page: 'first' }),
    onClosing() {
      second.close()
    },
  })
  second = scope.openXamlWindow({
    title: 'Second cycle',
    content: () => ({ page: 'second' }),
    onClosing() {
      first.close()
    },
  })

  scope.dispose()

  assert.equal(first.closed, true)
  assert.equal(second.closed, true)
  assert.equal(scope.disposed, true)
})

test('configure-installed cyclic closes do not recurse', () => {
  const { manager } = createManager()
  const scope = manager.createScope()
  let first
  let second
  first = scope.openXamlWindow({
    title: 'First configured cycle',
    configure(window) {
      return window.appWindow.onClosing(() => {
        second.close()
      })
    },
    content: () => ({ page: 'first' }),
  })
  second = scope.openXamlWindow({
    title: 'Second configured cycle',
    configure(window) {
      return window.appWindow.onClosing(() => {
        first.close()
      })
    },
    content: () => ({ page: 'second' }),
  })

  scope.dispose()

  assert.equal(first.closed, true)
  assert.equal(second.closed, true)
  assert.equal(scope.disposed, true)
})

test('manager teardown suppresses cross-scope onClosed callbacks', () => {
  const { manager } = createManager()
  const firstScope = manager.createScope()
  const secondScope = manager.createScope()
  const closed = []
  let second
  firstScope.openXamlWindow({
    title: 'First scope',
    content: () => ({ page: 'first' }),
    onClosing() {
      second.close()
    },
  })
  second = secondScope.openXamlWindow({
    title: 'Second scope',
    content: () => ({ page: 'second' }),
    onClosed() {
      closed.push('second')
    },
  })

  manager.dispose()

  assert.deepEqual(closed, [])
  assert.equal(manager.disposed, true)
})

test('secondary XAML subscription cleanup retries after native close', () => {
  const closed = []
  const { manager, windows } = createManager()
  const scope = manager.createScope()
  const handle = scope.openXamlWindow({
    title: 'Subscription retry',
    content: () => ({ page: 'child' }),
    onClosed() {
      closed.push('closed')
    },
  })
  windows[0].closedEvent.unsubscribeFailures = 1

  assert.throws(
    () => handle.close(),
    /unsubscribe failed/,
  )
  assert.equal(handle.closed, true)
  assert.equal(scope.xamlWindowCount, 1)

  handle.close()

  assert.equal(scope.xamlWindowCount, 0)
  assert.deepEqual(closed, ['closed'])
})

test('secondary AppWindows preserve cancellation and destroy on scope disposal', () => {
  const manager = createManager().manager
  const scope = manager.createScope()
  const appWindow = new FakeAppWindow()
  const closed = []
  const handle = scope.openAppWindow({
    create: () => appWindow,
    title: 'Modal',
    width: 420,
    height: 260,
    onClosing(_window, args) {
      args.cancel = true
    },
    onClosed() {
      closed.push('closed')
    },
  })

  assert.equal(appWindow.title, 'Modal')
  assert.deepEqual(appWindow.size, {
    width: 420,
    height: 260,
  })
  assert.equal(appWindow.shown, true)
  assert.equal(appWindow.requestClose().cancel, true)
  assert.equal(handle.closed, false)

  scope.dispose()

  assert.equal(handle.closed, true)
  assert.equal(scope.appWindowCount, 0)
  assert.deepEqual(closed, [])
})

test('failed secondary AppWindow creation releases its owned record', () => {
  const manager = createManager().manager
  const scope = manager.createScope()
  const appWindow = new FakeAppWindow()
  appWindow.destroying.subscribeFailures = 1

  assert.throws(
    () => scope.openAppWindow({
      create: () => appWindow,
      title: 'Failed AppWindow',
      width: 320,
      height: 200,
    }),
    /subscribe failed/,
  )

  assert.equal(appWindow.destroyed, true)
  assert.equal(scope.appWindowCount, 0)
  assert.equal(manager.appWindowCount, 0)
  scope.dispose()
  manager.dispose()
})

test('reentrant AppWindow destruction during show releases its record', () => {
  const manager = createManager().manager
  const scope = manager.createScope()
  const appWindow = new FakeAppWindow()
  appWindow.show = function showAndDestroy() {
    this.shown = true
    this.destroy()
  }

  assert.throws(
    () => scope.openAppWindow({
      create: () => appWindow,
      title: 'Reentrant AppWindow',
      width: 320,
      height: 200,
    }),
    /closed during creation/,
  )

  assert.equal(scope.appWindowCount, 0)
  assert.equal(manager.appWindowCount, 0)
  scope.dispose()
  manager.dispose()
})

test('natural AppWindow close preserves earlier cancellation', () => {
  const manager = createManager().manager
  const scope = manager.createScope()
  const appWindow = new FakeAppWindow()
  appWindow.onClosing((_sender, args) => {
    args.cancel = true
  })
  scope.openAppWindow({
    create: () => appWindow,
    title: 'Earlier AppWindow cancel',
    width: 320,
    height: 200,
    onClosing(_window, args) {
      args.cancel = false
    },
  })

  assert.equal(appWindow.requestClose().cancel, true)
  assert.equal(appWindow.destroyed, false)
  scope.dispose()
})

test('secondary AppWindow subscription cleanup remains retryable', () => {
  const manager = createManager().manager
  const scope = manager.createScope()
  const appWindow = new FakeAppWindow()
  const handle = scope.openAppWindow({
    create: () => appWindow,
    title: 'Retry AppWindow',
    width: 320,
    height: 200,
  })
  appWindow.destroying.unsubscribeFailures = 1

  assert.throws(
    () => handle.close(),
    /unsubscribe failed/,
  )
  assert.equal(handle.closed, true)
  assert.equal(scope.appWindowCount, 1)

  handle.close()

  assert.equal(scope.appWindowCount, 0)
})

test('secondary window manager closes every scope and prevents reuse', () => {
  const { manager } = createManager()
  const first = manager.createScope()
  const second = manager.createScope()
  first.openXamlWindow({
    title: 'First',
    content: () => ({ page: 'first' }),
  })
  second.openAppWindow({
    create: () => new FakeAppWindow(),
    title: 'Second',
    width: 300,
    height: 180,
  })

  manager.dispose()

  assert.equal(manager.disposed, true)
  assert.equal(manager.xamlWindowCount, 0)
  assert.equal(manager.appWindowCount, 0)
  assert.equal(first.disposed, true)
  assert.equal(second.disposed, true)
  assert.throws(
    () => manager.createScope(),
    /disposed secondary window manager/,
  )
})

test('secondary window manager defers application teardown', async () => {
  const { manager } = createManager()
  const scope = manager.createScope()
  scope.openXamlWindow({
    title: 'Deferred',
    content: () => ({ page: 'deferred' }),
  })
  let queued

  const disposal = manager.disposeAsync((callback) => {
    queued = callback
    return true
  })
  const completed = new Promise((resolve, reject) => {
    disposal.then(resolve, reject)
  })

  assert.equal(manager.disposed, false)
  queued()
  await completed
  assert.equal(manager.disposed, true)
  assert.equal(scope.disposed, true)
})

test('secondary window async teardown reports queue rejection', async () => {
  const { manager } = createManager()

  const disposal = manager.disposeAsync(() => false)
  await assert.rejects(
    new Promise((resolve, reject) => {
      disposal.then(resolve, reject)
    }),
    /could not be queued/,
  )
  assert.equal(manager.disposed, false)
  manager.dispose()
})
