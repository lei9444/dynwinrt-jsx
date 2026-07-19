'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createNavigationItem,
  createNavigationViewControl,
  createRenderer,
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

function renderer() {
  return createRenderer({
    asCollection(value) {
      return value instanceof TestVector ? value : null
    },
  })
}

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
