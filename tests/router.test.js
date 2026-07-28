'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  Outlet,
  RouterProvider,
  computed,
  createControls,
  createDiagnosticChannel,
  createRenderer,
  createRouter,
  createRouterNavigationHost,
  createRouterNavigationViewShell,
  defineRouteRegistry,
  onCleanup,
  parseRouterQuery,
  stringifyRouterQuery,
  useRouteParams,
  useRouteQuery,
  useRouteState,
} = require('../dist/index.js')
const { jsx } = require('../dist/jsx-runtime.js')
const {
  FakePanel,
  FakeTextBlock,
  FakeWindow,
} = require('./fakes')

const UI = createControls({
  Panel: FakePanel,
  TextBlock: FakeTextBlock,
})

function createTestRenderer() {
  return createRenderer({
    createText(value) {
      const text = new FakeTextBlock()
      text.text = value
      return text
    },
  })
}

function textAt(panel, index) {
  return panel.children.getAt(index).text
}

test('router preserves route scopes across parameter changes', () => {
  let layoutMounts = 0
  let layoutDisposals = 0
  let userMounts = 0
  let userDisposals = 0
  let homeMounts = 0

  function Layout() {
    layoutMounts += 1
    onCleanup(() => {
      layoutDisposals += 1
    })
    return jsx(UI.Panel, {
      children: [
        jsx(UI.TextBlock, { text: 'Shell' }),
        jsx(Outlet, {}),
      ],
    })
  }

  function UserPage() {
    userMounts += 1
    onCleanup(() => {
      userDisposals += 1
    })
    const params = useRouteParams()
    const query = useRouteQuery()
    const state = useRouteState()
    return jsx(UI.TextBlock, {
      text: computed(() => {
        const tab = query.value.tab
        const source = state.value?.source ?? 'none'
        return `${params.value.id}:${String(tab)}:${source}`
      }),
    })
  }

  function HomePage() {
    homeMounts += 1
    return jsx(UI.TextBlock, { text: 'Home' })
  }

  const router = createRouter({
    routes: [
      {
        id: 'root',
        path: '/',
        render: () => jsx(Layout, {}),
        children: [
          {
            id: 'home',
            index: true,
            render: () => jsx(HomePage, {}),
          },
          {
            id: 'user',
            path: 'users/:id',
            render: () => jsx(UserPage, {}),
          },
        ],
      },
    ],
    initialEntries: [
      {
        path: '/users/1?tab=profile',
        state: { source: 'initial' },
      },
    ],
  })
  const renderer = createTestRenderer()
  const window = new FakeWindow()
  const handle = renderer.render(
    jsx(RouterProvider, {
      router,
      disposeOnUnmount: true,
      children: jsx(Outlet, {}),
    }),
    window,
  )
  const layout = window.content

  assert.equal(layoutMounts, 1)
  assert.equal(userMounts, 1)
  assert.equal(textAt(layout, 1), '1:profile:initial')

  router.navigate('/users/2?tab=activity', {
    state: { source: 'push' },
  })

  assert.equal(layoutMounts, 1)
  assert.equal(userMounts, 1)
  assert.equal(userDisposals, 0)
  assert.equal(textAt(layout, 1), '2:activity:push')
  assert.deepEqual(router.matches.value.map((match) => match.id), [
    'root',
    'user',
  ])

  router.navigate('/')

  assert.equal(layoutMounts, 1)
  assert.equal(userDisposals, 1)
  assert.equal(homeMounts, 1)
  assert.equal(textAt(layout, 1), 'Home')

  handle.dispose()

  assert.equal(layoutDisposals, 1)
  assert.equal(router.disposed, true)
  assert.equal(renderer.diagnostics.activeNative, 0)
  assert.equal(renderer.diagnostics.activeComponents, 0)
})

test('nested RouterProvider starts a new outlet depth', () => {
  const innerRouter = createRouter({
    routes: [{
      id: 'inner',
      path: '/',
      render: () =>
        jsx(UI.TextBlock, { text: 'Inner' }),
    }],
  })
  function OuterPage() {
    return jsx(RouterProvider, {
      router: innerRouter,
      disposeOnUnmount: true,
      children: jsx(Outlet, {}),
    })
  }
  const outerRouter = createRouter({
    routes: [{
      id: 'outer',
      path: '/',
      render: () => jsx(OuterPage, {}),
    }],
  })
  const renderer = createTestRenderer()
  const window = new FakeWindow()
  const handle = renderer.render(
    jsx(RouterProvider, {
      router: outerRouter,
      disposeOnUnmount: true,
      children: jsx(Outlet, {}),
    }),
    window,
  )

  assert.equal(window.content.text, 'Inner')
  handle.dispose()
  assert.equal(outerRouter.disposed, true)
  assert.equal(innerRouter.disposed, true)
})

test('router supports route ids, query, replace, and history', () => {
  const router = createRouter({
    routes: [
      {
        id: 'home',
        path: '/',
        render: () => null,
      },
      {
        id: 'task',
        path: '/tasks/:taskId',
        render: () => null,
      },
      {
        id: 'settings',
        path: '/settings',
        render: () => null,
      },
    ],
  })

  assert.equal(
    router.pathFor('task', { taskId: 42 }, {
      filter: ['open', 'mine'],
    }),
    '/tasks/42?filter=open&filter=mine',
  )

  router.navigate({
    routeId: 'task',
    params: { taskId: 42 },
    query: { tab: 'detail' },
  }, {
    state: { selected: true },
  })

  assert.equal(router.pathname.value, '/tasks/42')
  assert.equal(router.routeId.value, 'task')
  assert.deepEqual(router.query.value, { tab: 'detail' })
  assert.deepEqual(router.state.value, { selected: true })
  assert.equal(router.canGoBack.value, true)

  router.replace({ routeId: 'settings' })
  assert.equal(router.pathname.value, '/settings')
  assert.equal(router.history.value.entries.length, 2)

  assert.equal(router.back(), true)
  assert.equal(router.pathname.value, '/')
  assert.equal(router.canGoForward.value, true)
  assert.equal(router.forward(), true)
  assert.equal(router.pathname.value, '/settings')
  assert.equal(router.forward(), false)
  assert.equal(
    router.lastTransition.value.reason,
    'history-boundary',
  )
  router.dispose()
})

test('route registry creates typed-style targets and paths', () => {
  const registry = defineRouteRegistry({
    home: {
      path: '/',
      render: () => null,
    },
    task: {
      path: '/tasks/:taskId',
      parentId: 'home',
      navigationId: 'tasks',
      render: () => null,
    },
  })
  const router = createRouter({
    routes: registry.routes,
  })

  assert.deepEqual(registry.ids, ['home', 'task'])
  assert.deepEqual(
    registry.target('task', {
      params: { taskId: 42 },
      query: { tab: 'detail' },
      hash: 'activity',
    }),
    {
      routeId: 'task',
      params: { taskId: 42 },
      query: { tab: 'detail' },
      hash: 'activity',
    },
  )
  assert.equal(
    registry.pathFor(router, 'task', {
      params: { taskId: 42 },
      query: { tab: 'detail' },
      hash: 'activity',
    }),
    '/tasks/42?tab=detail#activity',
  )
  assert.throws(
    () => registry.target('missing'),
    /Unknown route registry id/,
  )
  router.dispose()
})

test('router can initialize from a route id', () => {
  const router = createRouter({
    routes: [
      {
        id: 'home',
        path: '/',
        render: () => null,
      },
      {
        id: 'task',
        path: '/tasks/:taskId',
        render: () => null,
      },
    ],
    initialRouteId: 'task',
    initialRouteParams: {
      taskId: 42,
    },
  })

  assert.equal(router.routeId.value, 'task')
  assert.equal(router.pathname.value, '/tasks/42')
  router.dispose()

  assert.throws(
    () => createRouter({
      routes: [{
        id: 'home',
        path: '/',
        render: () => null,
      }],
      initialEntries: ['/'],
      initialRouteId: 'home',
    }),
    /mutually exclusive/,
  )
})

test('router supports logical parent navigation and navigation ids', () => {
  const router = createRouter({
    routes: [
      {
        id: 'home',
        path: '/',
        render: () => null,
      },
      {
        id: 'tasks',
        path: '/tasks',
        render: () => null,
      },
      {
        id: 'task-detail',
        path: '/tasks/:taskId',
        parentId: 'tasks',
        navigationId: 'tasks',
        render: () => null,
      },
    ],
    initialEntries: ['/tasks/42'],
  })

  assert.equal(router.routeId.value, 'task-detail')
  assert.equal(router.navigationRouteId.value, 'tasks')
  assert.equal(router.canGoUp.value, true)
  assert.equal(router.up(), true)
  assert.equal(router.routeId.value, 'tasks')
  assert.equal(router.history.value.entries.length, 1)
  assert.equal(router.lastTransition.value.action, 'up')
  assert.equal(router.up(), false)
  router.dispose()
})

test('router up uses structural parents for child routes', () => {
  const router = createRouter({
    routes: [
      {
        id: 'home',
        path: '/',
        render: () => null,
      },
      {
        id: 'category',
        path: '/category',
        parentId: 'home',
        render: () => null,
        children: [{
          id: 'sample',
          path: 'sample',
          render: () => null,
        }],
      },
    ],
    initialRouteId: 'sample',
  })

  assert.equal(router.pathname.value, '/category/sample')
  assert.equal(router.leafMatch.value.parentId, 'category')
  assert.equal(router.up(), true)
  assert.equal(router.routeId.value, 'category')
  assert.equal(router.pathname.value, '/category')
  assert.equal(router.up(), true)
  assert.equal(router.routeId.value, 'home')
  router.dispose()
})

test('router rolls back failed reactive commits', () => {
  const router = createRouter({
    routes: [
      {
        id: 'home',
        path: '/',
        render: () => null,
      },
      {
        id: 'tasks',
        path: '/tasks',
        render: () => null,
      },
    ],
  })
  const unsubscribe = router.location.subscribe((value) => {
    if (value.pathname === '/tasks') {
      throw new Error('location rejected')
    }
  })

  assert.throws(
    () => router.navigate('/tasks'),
    /location rejected/,
  )
  assert.equal(router.pathname.value, '/')
  assert.equal(router.routeId.value, 'home')
  assert.equal(router.history.value.entries.length, 1)
  assert.equal(router.history.value.index, 0)
  assert.equal(router.lastTransition.value.phase, 'failed')

  unsubscribe()
  router.navigate('/tasks')
  assert.equal(router.pathname.value, '/tasks')
  router.dispose()
})

test('router rejects synchronous transition re-entry', () => {
  let router
  router = createRouter({
    routes: [
      {
        id: 'home',
        path: '/',
        render: () => null,
      },
      {
        id: 'tasks',
        path: '/tasks',
        render: () => null,
      },
    ],
    onTransition(transition) {
      if (transition.phase === 'committing') {
        router.navigate('/')
      }
    },
  })

  assert.throws(
    () => router.navigate('/tasks'),
    /cannot re-enter an active transition/,
  )
  assert.equal(router.pathname.value, '/')
  router.dispose()
})

test('router diagnostics use stable route ids', () => {
  const records = []
  const router = createRouter({
    routes: [
      {
        id: 'home',
        path: '/',
        render: () => null,
      },
      {
        id: 'task',
        path: '/tasks/:taskId',
        render: () => null,
      },
    ],
    diagnostics: createDiagnosticChannel({
      source: 'router-test',
      onRecord(record) {
        records.push(record)
      },
    }),
  })

  router.navigate('/tasks/private-value')
  assert.equal(
    records.some(
      (record) =>
        JSON.stringify(record).includes('private-value'),
    ),
    false,
  )
  assert.ok(
    records.some(
      (record) =>
        record.kind === 'route' &&
        record.payload.fromRoute === 'home' &&
        record.payload.toRoute === 'task' &&
        record.payload.phase === 'completed',
    ),
  )

  assert.throws(
    () => router.navigate('/missing/private-value'),
    /No route matches/,
  )
  assert.equal(router.pathname.value, '/tasks/private-value')
  assert.equal(
    records.at(-1).payload.toRoute,
    '<unmatched>',
  )
  assert.equal(
    records.at(-1).payload.reason,
    'no-match',
  )
  router.dispose()
})

test('router NavigationView host bridges route ids', () => {
  const router = createRouter({
    routes: [
      {
        id: 'home',
        path: '/',
        render: () => null,
      },
      {
        id: 'tasks',
        path: '/tasks',
        render: () => null,
      },
      {
        id: 'settings',
        path: '/settings',
        render: () => null,
      },
    ],
  })
  const queue = []
  const selections = []
  const host = createRouterNavigationHost(router, {
    enqueue(callback) {
      queue.push(callback)
      return true
    },
    selectRoute(routeId) {
      selections.push(routeId)
    },
  })

  host.requestNativeNavigation('tasks')
  queue.shift()()
  queue.shift()()
  assert.equal(router.routeId.value, 'tasks')

  router.navigate({ routeId: 'settings' })
  assert.equal(selections.at(-1), 'settings')

  host.dispose()
  router.dispose()
})

test('router NavigationView host resolves parameterized targets', () => {
  const router = createRouter({
    routes: [
      {
        id: 'home',
        path: '/',
        render: () => null,
      },
      {
        id: 'task-detail',
        path: '/tasks/:taskId',
        navigationId: 'tasks',
        render: () => null,
      },
    ],
  })
  const queue = []
  const selections = []
  const host = createRouterNavigationHost(router, {
    enqueue(callback) {
      queue.push(callback)
      return true
    },
    selectRoute(routeId) {
      selections.push(routeId)
    },
    targetForRoute(routeId) {
      return routeId === 'tasks'
        ? {
            routeId: 'task-detail',
            params: { taskId: 42 },
          }
        : { routeId }
    },
  })

  host.requestNativeNavigation('tasks')
  queue.shift()()
  queue.shift()()

  assert.equal(router.pathname.value, '/tasks/42')
  assert.equal(router.navigationRouteId.value, 'tasks')
  assert.equal(selections.at(-1), 'home')
  host.dispose()
  router.dispose()
})

test('router NavigationView shell owns items and selection', () => {
  class Vector {
    values = []

    append(value) {
      this.values.push(value)
    }
  }
  class Item {
    menuItems = new Vector()
    name = ''
    content = null
    icon = null
    selectsOnInvoked = true
    isExpanded = false
  }
  class Text {
    text = ''
  }
  const router = createRouter({
    routes: [
      {
        id: 'home',
        path: '/',
        render: () => null,
      },
      {
        id: 'work',
        path: '/work',
        render: () => null,
      },
      {
        id: 'tasks',
        path: '/tasks',
        render: () => null,
      },
      {
        id: 'task-detail',
        path: '/tasks/:taskId',
        navigationId: 'tasks',
        render: () => null,
      },
      {
        id: 'settings',
        path: '/settings',
        render: () => null,
      },
    ],
  })
  const queue = []
  const releases = []
  let failedRelease = false
  let tasksItem = null
  const shell = createRouterNavigationViewShell({
    router,
    bindings: {
      NavigationViewItem: Item,
      TextBlock: Text,
    },
    items: [
      {
        routeId: 'home',
        label: 'Home',
      },
      {
        routeId: 'work',
        label: 'Work',
        children: [
          {
            routeId: 'tasks',
            label: 'Tasks',
          },
        ],
      },
    ],
    settingsRouteId: 'settings',
    preservePaneOpenOnSelection: true,
    enqueue(callback) {
      queue.push(callback)
      return true
    },
    releaseProjected(value) {
      releases.push(value)
      if (value === tasksItem && !failedRelease) {
        failedRelease = true
        throw new Error('release failed')
      }
    },
  })
  tasksItem = shell.itemForRoute('tasks')
  const settingsItem = new Item()
  const navigation = {
    selectedItem: null,
    settingsItem,
    isPaneOpen: false,
  }

  shell.ref(navigation)
  assert.equal(
    navigation.selectedItem,
    shell.itemForRoute('home'),
  )
  assert.equal(shell.menuItems.length, 2)
  assert.equal(
    shell.menuItems[1].menuItems.values[0],
    shell.itemForRoute('tasks'),
  )

  router.navigate({
    routeId: 'task-detail',
    params: { taskId: 42 },
  })
  assert.equal(
    navigation.selectedItem,
    shell.itemForRoute('tasks'),
  )
  assert.equal(shell.menuItems[1].isExpanded, true)

  navigation.selectedItem = shell.itemForRoute('home')
  const projectedHomeItem = new Item()
  projectedHomeItem.name = 'home'
  shell.onSelectionChanged(navigation, {
    isSettingsSelected: false,
    selectedItemContainer: projectedHomeItem,
  })
  queue.shift()()
  queue.shift()()
  assert.equal(router.routeId.value, 'home')

  navigation.isPaneOpen = true
  navigation.selectedItem = shell.itemForRoute('work')
  shell.onSelectionChanged(navigation, {
    isSettingsSelected: false,
    selectedItemContainer: shell.itemForRoute('work'),
  })
  navigation.isPaneOpen = false
  queue.shift()()
  queue.shift()()
  queue.shift()()
  assert.equal(router.routeId.value, 'work')
  assert.equal(navigation.isPaneOpen, false)
  queue.shift()()
  assert.equal(navigation.isPaneOpen, true)

  navigation.isPaneOpen = true
  navigation.selectedItem = settingsItem
  shell.onSelectionChanged(navigation, {
    isSettingsSelected: true,
    selectedItemContainer: settingsItem,
  })
  navigation.isPaneOpen = false
  queue.shift()()
  queue.shift()()
  assert.equal(router.routeId.value, 'settings')
  queue.shift()()
  queue.shift()()
  assert.equal(navigation.isPaneOpen, true)
  assert.equal(navigation.selectedItem, settingsItem)

  assert.throws(
    () => shell.dispose(),
    /release failed/,
  )
  assert.equal(shell.disposed, false)
  shell.dispose()
  assert.equal(shell.disposed, true)
  shell.ref(null)
  assert.equal(
    releases.filter((value) => value === tasksItem).length,
    2,
  )
  router.dispose()
})

test('router NavigationView shell releases partial item creation', () => {
  class Vector {
    append() {}
  }
  let itemCount = 0
  class Item {
    menuItems = itemCount++ === 0
      ? new Vector()
      : undefined
    name = ''
    content = null
    icon = null
    selectsOnInvoked = true
  }
  class Text {
    text = ''
  }
  const router = createRouter({
    routes: [{
      id: 'home',
      path: '/',
      render: () => null,
    }],
  })
  const released = []

  assert.throws(
    () => createRouterNavigationViewShell({
      router,
      bindings: {
        NavigationViewItem: Item,
        TextBlock: Text,
      },
      items: [
        {
          routeId: 'home',
          label: 'Home',
        },
        {
          name: 'group',
          label: 'Group',
          children: [{
            routeId: 'child',
            label: 'Child',
          }],
        },
      ],
      enqueue: () => true,
      releaseProjected: (value) => released.push(value),
    }),
    /does not expose menuItems/,
  )
  assert.equal(released.length, 4)
  router.dispose()
})

test('router validates definitions and query encoding', () => {
  assert.deepEqual(
    parseRouterQuery('?tag=a&tag=b&empty='),
    {
      tag: ['a', 'b'],
      empty: '',
    },
  )
  const specialQuery = parseRouterQuery(
    '?__proto__=safe&constructor=value',
  )
  assert.equal(specialQuery.__proto__, 'safe')
  assert.equal(specialQuery.constructor, 'value')
  assert.equal(
    stringifyRouterQuery({
      z: true,
      a: 'hello world',
      omitted: null,
    }),
    '?a=hello+world&z=true',
  )
  const wildcardRouter = createRouter({
    routes: [
      {
        id: 'files',
        path: '/files/*',
        render: () => null,
      },
    ],
    initialEntries: ['/files/a/b'],
  })
  assert.equal(
    wildcardRouter.leafMatch.value.params.value['*'],
    'a/b',
  )
  assert.equal(
    wildcardRouter.pathFor('files', { '*': 'c/d' }),
    '/files/c/d',
  )
  wildcardRouter.dispose()
  assert.throws(
    () => createRouter({
      routes: [
        {
          id: 'duplicate',
          path: '/',
          render: () => null,
        },
        {
          id: 'duplicate',
          path: '/other',
          render: () => null,
        },
      ],
    }),
    /Duplicate route id/,
  )
  assert.throws(
    () => createRouter({
      routes: [
        {
          id: 'same',
          path: '/',
          render: () => null,
          children: [
            {
              id: 'same',
              index: true,
              render: () => null,
            },
          ],
        },
      ],
    }),
    /Duplicate route id/,
  )
  assert.throws(
    () => createRouter({
      routes: [
        {
          id: 'invalid',
          path: '/files/*/detail',
          render: () => null,
        },
      ],
    }),
    /wildcard must be the final segment/,
  )
  assert.throws(
    () => createRouter({
      routes: [
        {
          id: 'parent',
          path: '/items/:id',
          render: () => null,
          children: [
            {
              id: 'child',
              path: 'details/:id',
              render: () => null,
            },
          ],
        },
      ],
    }),
    /repeats parameter 'id'/,
  )
  assert.throws(
    () => createRouter({
      routes: [
        {
          id: 'root',
          path: '/',
          render: () => null,
          children: {},
        },
      ],
    }),
    /children must be an array/,
  )
  assert.throws(
    () => createRouter({
      routes: [{
        id: 'orphan',
        path: '/',
        parentId: 'missing',
        render: () => null,
      }],
    }),
    /unknown parent route/,
  )
  assert.throws(
    () => createRouter({
      routes: [
        {
          id: 'first',
          path: '/',
          parentId: 'second',
          render: () => null,
        },
        {
          id: 'second',
          path: '/second',
          parentId: 'first',
          render: () => null,
        },
      ],
    }),
    /cyclic parent route/,
  )
  const targetRouter = createRouter({
    routes: [{
      id: 'home',
      path: '/',
      render: () => null,
    }],
  })
  assert.throws(
    () => targetRouter.navigate(null),
    /target must be a path string or target object/,
  )
  targetRouter.dispose()
})
