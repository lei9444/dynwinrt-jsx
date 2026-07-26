'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createNavigationHost,
  createNavigationItem,
  createNavigationViewControl,
  createRenderer,
  native,
  signal,
} = require('../dist/index.js')

class TestVector {
  values = []
  failAppendAt = null
  appendIndex = 0

  get size() {
    return this.values.length
  }

  getAt(index) {
    return this.values[index]
  }

  insertAt(index, value) {
    this.values.splice(index, 0, value)
  }

  removeAt(index) {
    this.values.splice(index, 1)
  }

  append(value) {
    if (this.failAppendAt === this.appendIndex) {
      this.failAppendAt = null
      throw new Error('append failed')
    }
    this.appendIndex += 1
    this.values.push(value)
  }

  clear() {
    this.values.length = 0
    this.appendIndex = 0
  }
}

class TestPanel {
  children = new TestVector()
}

class TestNavigationView {
  menuItems = new TestVector()
  footerMenuItems = new TestVector()
  content = null
}

class TestTextBlock {
  text = ''
}

class TestNavigationItem {
  name = ''
  content = null
  icon = null
  selectsOnInvoked = true
}

const TestText = native(TestTextBlock)

function renderer() {
  return createRenderer({
    asCollection(value) {
      return value instanceof TestVector ? value : null
    },
  })
}

class TestNavigationQueue {
  callbacks = []
  accept = true

  enqueue(callback) {
    if (!this.accept) {
      return false
    }
    this.callbacks.push(callback)
    return true
  }

  runNext() {
    const callback = this.callbacks.shift()
    assert.ok(callback, 'expected a queued navigation callback')
    callback()
  }
}

test('NavigationHost synchronizes programmatic routes without feedback', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const selections = []
  let echoSelection = null
  const host = createNavigationHost({
    route,
    navigate(nextRoute) {
      route.value = nextRoute
    },
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute(nextRoute) {
      selections.push(nextRoute)
      echoSelection?.(nextRoute)
    },
  })
  echoSelection = (nextRoute) => {
    host.requestNativeNavigation(nextRoute)
  }

  assert.equal(host.renderedRoute.value, 'home')
  assert.deepEqual(selections, ['home'])

  route.value = 'settings'

  assert.equal(host.renderedRoute.value, 'settings')
  assert.deepEqual(selections, ['home', 'settings'])
  assert.equal(queue.callbacks.length, 0)

  host.synchronizeSelection()
  assert.deepEqual(selections, ['home', 'settings', 'settings'])
  host.dispose()
  assert.equal(host.disposed, true)
})

test('NavigationHost separates native disposal and target mounting', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const navigated = []
  const selections = []
  const host = createNavigationHost({
    route,
    navigate(nextRoute) {
      navigated.push(nextRoute)
      route.value = nextRoute
    },
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute(nextRoute) {
      selections.push(nextRoute)
    },
  })

  host.requestNativeNavigation('tasks')
  assert.equal(host.renderedRoute.value, 'home')
  assert.equal(route.value, 'home')
  assert.equal(queue.callbacks.length, 1)

  queue.runNext()
  assert.equal(host.renderedRoute.value, null)
  assert.equal(route.value, 'tasks')
  assert.deepEqual(navigated, ['tasks'])
  assert.equal(queue.callbacks.length, 1)

  queue.runNext()
  assert.equal(host.renderedRoute.value, 'tasks')
  assert.deepEqual(selections, ['home'])
  host.dispose()
})

test('NavigationHost coalesces native routes and skips stale mounts', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const navigated = []
  const host = createNavigationHost({
    route,
    navigate(nextRoute) {
      navigated.push(nextRoute)
      route.value = nextRoute
    },
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute() {},
  })

  host.requestNativeNavigation('tasks')
  host.requestNativeNavigation('settings')
  assert.equal(queue.callbacks.length, 1)

  queue.runNext()
  assert.equal(route.value, 'settings')
  assert.equal(host.renderedRoute.value, null)

  host.requestNativeNavigation('home')
  queue.runNext()
  assert.equal(host.renderedRoute.value, null)

  queue.runNext()
  assert.equal(route.value, 'home')
  assert.equal(host.renderedRoute.value, null)

  queue.runNext()
  assert.equal(host.renderedRoute.value, 'home')
  assert.deepEqual(navigated, ['settings', 'home'])
  host.dispose()
})

test('NavigationHost preserves newer programmatic routes', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const navigated = []
  const selections = []
  const host = createNavigationHost({
    route,
    navigate(nextRoute) {
      navigated.push(nextRoute)
      route.value = nextRoute
    },
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute(nextRoute) {
      selections.push(nextRoute)
    },
  })

  host.requestNativeNavigation('tasks')
  route.value = 'settings'
  queue.runNext()

  assert.equal(route.value, 'settings')
  assert.equal(host.renderedRoute.value, 'settings')
  assert.deepEqual(navigated, [])
  assert.deepEqual(selections, ['home', 'settings'])
  host.dispose()
})

test('NavigationHost cancels stale target mounts for programmatic routes', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const host = createNavigationHost({
    route,
    navigate(nextRoute) {
      route.value = nextRoute
    },
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute() {},
  })

  host.requestNativeNavigation('tasks')
  queue.runNext()
  assert.equal(host.renderedRoute.value, null)

  route.value = 'settings'
  assert.equal(host.renderedRoute.value, 'settings')
  queue.runNext()
  assert.equal(host.renderedRoute.value, 'settings')
  host.dispose()
})

test('NavigationHost honors route changes during page disposal', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const navigated = []
  const host = createNavigationHost({
    route,
    navigate(nextRoute) {
      navigated.push(nextRoute)
      route.value = nextRoute
    },
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute() {},
  })
  const unsubscribe = host.renderedRoute.subscribe((value) => {
    if (value === null) {
      route.value = 'settings'
    }
  })

  host.requestNativeNavigation('tasks')
  queue.runNext()

  assert.equal(route.value, 'settings')
  assert.equal(host.renderedRoute.value, 'settings')
  assert.deepEqual(navigated, [])
  unsubscribe()
  host.dispose()
})

test('NavigationHost honors disposal during page disposal', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const navigated = []
  let host
  host = createNavigationHost({
    route,
    navigate(nextRoute) {
      navigated.push(nextRoute)
      route.value = nextRoute
    },
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute() {},
  })
  const unsubscribe = host.renderedRoute.subscribe((value) => {
    if (value === null) {
      host.dispose()
    }
  })

  host.requestNativeNavigation('tasks')
  queue.runNext()

  assert.equal(host.disposed, true)
  assert.deepEqual(navigated, [])
  assert.equal(queue.callbacks.length, 0)
  unsubscribe()
})

test('NavigationHost remounts after repeated current-route selection', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const host = createNavigationHost({
    route,
    navigate(nextRoute) {
      route.value = nextRoute
    },
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute() {},
  })

  host.requestNativeNavigation('tasks')
  queue.runNext()
  assert.equal(host.renderedRoute.value, null)

  host.requestNativeNavigation('tasks')
  queue.runNext()
  assert.equal(host.renderedRoute.value, null)

  queue.runNext()
  assert.equal(host.renderedRoute.value, 'tasks')
  host.dispose()
})

test('NavigationHost restores model selection when navigation is rejected', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const selections = []
  const host = createNavigationHost({
    route,
    navigate() {},
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute(nextRoute) {
      selections.push(nextRoute)
    },
  })

  host.requestNativeNavigation('tasks')
  queue.runNext()
  assert.equal(host.renderedRoute.value, null)
  queue.runNext()

  assert.equal(route.value, 'home')
  assert.equal(host.renderedRoute.value, 'home')
  assert.deepEqual(selections, ['home', 'home'])
  host.dispose()
})

test('NavigationHost honors route changes during selection restoration', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  let selectionCount = 0
  const host = createNavigationHost({
    route,
    navigate() {},
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute() {
      selectionCount += 1
      if (selectionCount === 2) {
        route.value = 'settings'
      }
    },
  })

  host.requestNativeNavigation('tasks')
  queue.runNext()
  queue.runNext()

  assert.equal(route.value, 'settings')
  assert.equal(host.renderedRoute.value, 'settings')
  host.dispose()
})

test('NavigationHost honors disposal during selection restoration', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  let selectionCount = 0
  let host
  host = createNavigationHost({
    route,
    navigate() {},
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute() {
      selectionCount += 1
      if (selectionCount === 2) {
        host.dispose()
      }
    },
  })

  host.requestNativeNavigation('tasks')
  queue.runNext()
  queue.runNext()

  assert.equal(host.disposed, true)
  assert.equal(host.renderedRoute.value, null)
})

test('NavigationHost restores content when selection restoration fails', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  let selectionCount = 0
  const host = createNavigationHost({
    route,
    navigate() {},
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute() {
      selectionCount += 1
      if (selectionCount === 2) {
        throw new Error('selection restore failed')
      }
    },
  })

  host.requestNativeNavigation('tasks')
  queue.runNext()
  assert.throws(
    () => queue.runNext(),
    /selection restore failed/,
  )
  assert.equal(host.renderedRoute.value, 'home')
  host.dispose()
})

test('NavigationHost honors route changes during failure recovery', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const selections = []
  let transitionStarted = false
  const host = createNavigationHost({
    route,
    navigate() {
      throw new Error('navigation failed')
    },
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute(nextRoute) {
      selections.push(nextRoute)
    },
  })
  const unsubscribe = host.renderedRoute.subscribe((value) => {
    if (value === null) {
      transitionStarted = true
    }
    else if (transitionStarted && value === 'home') {
      route.value = 'settings'
    }
  })

  host.requestNativeNavigation('tasks')
  assert.throws(
    () => queue.runNext(),
    /navigation failed/,
  )

  assert.equal(route.value, 'settings')
  assert.equal(host.renderedRoute.value, 'settings')
  assert.deepEqual(selections, ['home', 'settings'])
  unsubscribe()
  host.dispose()
})

test('NavigationHost honors disposal during failure recovery', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const selections = []
  let transitionStarted = false
  let host
  host = createNavigationHost({
    route,
    navigate() {
      throw new Error('navigation failed')
    },
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute(nextRoute) {
      selections.push(nextRoute)
    },
  })
  const unsubscribe = host.renderedRoute.subscribe((value) => {
    if (value === null) {
      transitionStarted = true
    }
    else if (transitionStarted && value === 'home') {
      host.dispose()
    }
  })

  host.requestNativeNavigation('tasks')
  assert.throws(
    () => queue.runNext(),
    /navigation failed/,
  )

  assert.equal(host.disposed, true)
  assert.deepEqual(selections, ['home'])
  unsubscribe()
})

test('NavigationHost surfaces queue failures and remains retryable', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const selections = []
  const host = createNavigationHost({
    route,
    navigate(nextRoute) {
      route.value = nextRoute
    },
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute(nextRoute) {
      selections.push(nextRoute)
    },
  })

  queue.accept = false
  assert.throws(
    () => host.requestNativeNavigation('tasks'),
    /Failed to queue navigation route 'tasks'/,
  )
  assert.equal(host.renderedRoute.value, 'home')
  assert.deepEqual(selections, ['home', 'home'])

  queue.accept = true
  host.requestNativeNavigation('tasks')
  queue.runNext()
  queue.runNext()
  assert.equal(host.renderedRoute.value, 'tasks')
  host.dispose()
})

test('NavigationHost resets state when initial enqueue throws', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const selections = []
  let shouldThrow = true
  const host = createNavigationHost({
    route,
    navigate(nextRoute) {
      route.value = nextRoute
    },
    enqueue(callback) {
      if (shouldThrow) {
        shouldThrow = false
        throw new Error('enqueue failed')
      }
      return queue.enqueue(callback)
    },
    selectRoute(nextRoute) {
      selections.push(nextRoute)
    },
  })

  assert.throws(
    () => host.requestNativeNavigation('tasks'),
    /enqueue failed/,
  )
  assert.deepEqual(selections, ['home', 'home'])
  host.requestNativeNavigation('settings')
  queue.runNext()
  queue.runNext()
  assert.equal(host.renderedRoute.value, 'settings')
  host.dispose()
})

test('NavigationHost does not enqueue after navigation disposes it', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  let enqueueCount = 0
  let host
  host = createNavigationHost({
    route,
    navigate() {
      host.dispose()
    },
    enqueue(callback) {
      enqueueCount += 1
      return queue.enqueue(callback)
    },
    selectRoute() {},
  })

  host.requestNativeNavigation('tasks')
  queue.runNext()

  assert.equal(host.disposed, true)
  assert.equal(enqueueCount, 1)
})

test('NavigationHost restores content when target mounting cannot queue', () => {
  const route = signal('home')
  const callbacks = []
  let enqueueCount = 0
  const host = createNavigationHost({
    route,
    navigate(nextRoute) {
      route.value = nextRoute
    },
    enqueue(callback) {
      enqueueCount += 1
      if (enqueueCount === 2) {
        return false
      }
      callbacks.push(callback)
      return true
    },
    selectRoute() {},
  })

  host.requestNativeNavigation('tasks')
  assert.throws(
    () => callbacks.shift()(),
    /Failed to mount navigation route 'tasks'/,
  )
  assert.equal(route.value, 'tasks')
  assert.equal(host.renderedRoute.value, 'tasks')
  host.dispose()
})

test('NavigationHost restores content when target enqueue throws', () => {
  const route = signal('home')
  const callbacks = []
  let enqueueCount = 0
  const host = createNavigationHost({
    route,
    navigate(nextRoute) {
      route.value = nextRoute
    },
    enqueue(callback) {
      enqueueCount += 1
      if (enqueueCount === 2) {
        throw new Error('mount enqueue failed')
      }
      callbacks.push(callback)
      return true
    },
    selectRoute() {},
  })

  host.requestNativeNavigation('tasks')
  assert.throws(
    () => callbacks.shift()(),
    /mount enqueue failed/,
  )
  assert.equal(route.value, 'tasks')
  assert.equal(host.renderedRoute.value, 'tasks')
  host.dispose()
})

test('NavigationHost cancels queued work when disposed', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const navigated = []
  const host = createNavigationHost({
    route,
    navigate(nextRoute) {
      navigated.push(nextRoute)
      route.value = nextRoute
    },
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute() {},
  })

  host.requestNativeNavigation('tasks')
  host.dispose()
  queue.runNext()

  assert.deepEqual(navigated, [])
  assert.equal(route.value, 'home')
  assert.throws(
    () => host.requestNativeNavigation('settings'),
    /disposed NavigationHost/,
  )
})

test('NavigationHost outlet deactivates before page cleanup', () => {
  const route = signal('home')
  const queue = new TestNavigationQueue()
  const testRenderer = renderer()
  const root = new TestPanel()
  const host = createNavigationHost({
    route,
    navigate(nextRoute) {
      route.value = nextRoute
    },
    enqueue: (callback) => queue.enqueue(callback),
    selectRoute() {},
  })

  const handle = testRenderer.render(
    host.render((currentRoute) =>
      TestText({
        text: currentRoute,
        ref(value) {
          if (value === null && currentRoute === 'home') {
            route.value = 'settings'
          }
        },
      }),
    ),
    root,
  )

  assert.equal(root.children.getAt(0).text, 'home')
  handle.dispose()

  assert.equal(host.disposed, true)
  assert.equal(route.value, 'settings')
  assert.equal(root.children.size, 0)
  assert.equal(testRenderer.diagnostics.activeNative, 0)
  assert.equal(testRenderer.diagnostics.activeComponents, 0)
})

test('NavigationView collections mount, update, and roll back', () => {
  const NavigationView = createNavigationViewControl({
    NavigationView: TestNavigationView,
  })
  const menuItems = signal([{ name: 'dashboard' }])
  const footerMenuItems = signal([{ name: 'diagnostics' }])
  const root = new TestPanel()
  let navigation

  const handle = renderer().render(
    NavigationView({
      ref(value) {
        navigation = value
      },
      menuItems,
      footerMenuItems,
    }),
    root,
  )

  assert.deepEqual(navigation.menuItems.values, [
    { name: 'dashboard' },
  ])
  assert.deepEqual(navigation.footerMenuItems.values, [
    { name: 'diagnostics' },
  ])

  menuItems.value = [
    { name: 'dashboard' },
    { name: 'tasks' },
  ]
  assert.equal(navigation.menuItems.size, 2)

  const previous = navigation.menuItems.getAt(0)
  navigation.menuItems.failAppendAt = 1
  assert.throws(() => {
    menuItems.value = [
      { name: 'settings' },
      { name: 'tasks' },
    ]
  }, /append failed/)
  assert.equal(navigation.menuItems.size, 2)
  assert.equal(navigation.menuItems.getAt(0), previous)

  handle.dispose()
  assert.equal(root.children.size, 0)
})

test('NavigationView validates collections before mutation', () => {
  const NavigationView = createNavigationViewControl({
    NavigationView: TestNavigationView,
  })
  const menuItems = signal([{ name: 'dashboard' }])
  const root = new TestPanel()
  let navigation

  const handle = renderer().render(
    NavigationView({
      ref(value) {
        navigation = value
      },
      menuItems,
    }),
    root,
  )

  const previous = navigation.menuItems.getAt(0)
  assert.throws(() => {
    menuItems.value = 'invalid'
  }, /menuItems must be an array/)
  assert.equal(navigation.menuItems.getAt(0), previous)
  handle.dispose()
})

test('navigation item factory creates typed native content and metadata', () => {
  const automation = []
  const icon = { symbol: 1 }
  const item = createNavigationItem(
    {
      NavigationViewItem: TestNavigationItem,
      TextBlock: TestTextBlock,
      AutomationProperties: {
        setAutomationId(target, value) {
          automation.push(['id', target, value])
        },
        setName(target, value) {
          automation.push(['name', target, value])
        },
        setPositionInSet(target, value) {
          automation.push(['position', target, value])
        },
        setSizeOfSet(target, value) {
          automation.push(['size', target, value])
        },
      },
    },
    {
      name: 'tasks',
      label: 'Tasks',
      icon,
      automationId: 'TasksNavItem',
      automationName: 'Tasks page',
      automationPositionInSet: 2,
      automationSizeOfSet: 3,
    },
  )

  assert.equal(item.name, 'tasks')
  assert.equal(item.content.text, 'Tasks')
  assert.equal(item.icon, icon)
  assert.deepEqual(
    automation.map(([kind, , value]) => [kind, value]),
    [
      ['id', 'TasksNavItem'],
      ['name', 'Tasks page'],
      ['position', 2],
      ['size', 3],
    ],
  )
})

test('navigation item metadata never fails silently', () => {
  assert.throws(
    () => createNavigationItem(
      {
        NavigationViewItem: TestNavigationItem,
        TextBlock: TestTextBlock,
      },
      {
        name: 'tasks',
        label: 'Tasks',
        automationPositionInSet: 1,
      },
    ),
    /requires AutomationProperties bindings/,
  )
})
