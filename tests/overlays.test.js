'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createControls,
  createRenderer,
  createTeachingTip,
  showFlyout,
  showMenuFlyout,
} = require('../dist/index.js')

class TestVector {
  values = []
  get size() {
    return this.values.length
  }
  get length() {
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
    this.values.push(value)
  }
  clear() {
    this.values.length = 0
  }
  toArray() {
    return this.values.slice()
  }
}

class TestPanel {
  children = new TestVector()
}

class TestMenuItem {
  text = ''
}

class TestFlyout {
  content = null
  xamlRoot = null
  isOpen = false
  target = null
  showOptions = null
  closedHandlers = new Set()
  hideCalls = 0

  showAt(target, showOptions) {
    this.target = target
    this.showOptions = showOptions
    this.isOpen = true
  }

  hide() {
    this.hideCalls += 1
    if (!this.isOpen) {
      return
    }
    this.isOpen = false
    for (const handler of this.closedHandlers) {
      handler(this, {})
    }
  }

  onClosed(callback) {
    this.closedHandlers.add(callback)
    return () => this.closedHandlers.delete(callback)
  }
}

class TestPropertyFlyout extends TestFlyout {
  propertyHandlers = new Map()
  nextToken = 1n

  registerPropertyChangedCallback(property, callback) {
    const token = this.nextToken
    this.nextToken += 1n
    this.propertyHandlers.set(token, [property, callback])
    return token
  }

  unregisterPropertyChangedCallback(_property, token) {
    this.propertyHandlers.delete(token)
  }

  hide() {
    super.hide()
    for (const [property, callback] of this.propertyHandlers.values()) {
      callback(this, property)
    }
  }
}

class TestMenuFlyout {
  items = new TestVector()
  xamlRoot = null
  isOpen = false
  target = null
  point = null
  closedHandlers = new Set()
  hideCalls = 0

  showAt(target, point) {
    this.target = target
    this.point = point
    this.isOpen = true
  }

  hide() {
    this.hideCalls += 1
    if (!this.isOpen) {
      return
    }
    this.isOpen = false
    for (const handler of this.closedHandlers) {
      handler(this, {})
    }
  }

  onClosed(callback) {
    this.closedHandlers.add(callback)
    return () => this.closedHandlers.delete(callback)
  }
}

class TestTeachingTip {
  content = null
  xamlRoot = null
  target = null
  #isOpen = false
  failOpen = false
  closedHandlers = new Set()

  get isOpen() {
    return this.#isOpen
  }

  set isOpen(value) {
    if (value && this.failOpen) {
      throw new Error('open failed')
    }
    if (this.#isOpen === value) {
      return
    }
    this.#isOpen = value
    if (!value) {
      for (const handler of this.closedHandlers) {
        handler(this, { reason: 2 })
      }
    }
  }

  onClosed(callback) {
    this.closedHandlers.add(callback)
    return () => this.closedHandlers.delete(callback)
  }
}

function createTestRenderer() {
  return createRenderer({
    asCollection(value) {
      return value instanceof TestVector ? value : null
    },
  })
}

test('showFlyout anchors to target and disposes content on native Closed', () => {
  const renderer = createTestRenderer()
  const UI = createControls({ Panel: TestPanel })
  const flyout = new TestFlyout()
  const target = { id: 'anchor' }
  const root = { id: 'xaml-root' }
  let closedCount = 0

  const controller = showFlyout(
    renderer,
    flyout,
    target,
    UI.Panel({}),
    {
      xamlRoot: root,
      onClosed: () => {
        closedCount += 1
      },
    },
  )

  assert.equal(flyout.xamlRoot, root)
  assert.equal(flyout.target, target)
  assert.equal(flyout.isOpen, true)
  assert.notEqual(flyout.content, null)
  assert.equal(controller.isOpen, true)
  assert.equal(controller.disposed, false)

  flyout.hide()

  assert.equal(flyout.content, null, 'owned content must dispose from native Closed')
  assert.equal(closedCount, 1)
  assert.equal(controller.disposed, true)
  assert.equal(flyout.closedHandlers.size, 0, 'Closed handler must be removed')

  controller.dispose()
  assert.equal(closedCount, 1)
})

test('showFlyout forwards FlyoutShowOptions as the second showAt argument', () => {
  const renderer = createTestRenderer()
  const UI = createControls({ Panel: TestPanel })
  const flyout = new TestFlyout()
  const target = { id: 'anchor' }
  const showOptions = { placement: 3 }

  showFlyout(renderer, flyout, target, UI.Panel({}), { showOptions })

  assert.equal(flyout.showOptions, showOptions)
})

test('showFlyout cleans up when native showAt fails', () => {
  const renderer = createTestRenderer()
  const UI = createControls({ Panel: TestPanel })
  const flyout = new TestFlyout()
  flyout.showAt = () => {
    throw new Error('show failed')
  }

  assert.throws(
    () => showFlyout(renderer, flyout, {}, UI.Panel({})),
    /show failed/,
  )
  assert.equal(flyout.content, null)
  assert.equal(flyout.closedHandlers.size, 0)
})

test('showFlyout can observe IsOpen without a projected Closed event', () => {
  const renderer = createTestRenderer()
  const UI = createControls({ Panel: TestPanel })
  const flyout = new TestPropertyFlyout()
  const isOpenProperty = {}
  flyout.onClosed = undefined

  const controller = showFlyout(
    renderer,
    flyout,
    {},
    UI.Panel({}),
    { isOpenProperty },
  )
  flyout.hide()

  assert.equal(controller.disposed, true)
  assert.equal(flyout.content, null)
  assert.equal(flyout.propertyHandlers.size, 0)
})

test('showFlyout supports explicit-close ownership without native events', () => {
  const renderer = createTestRenderer()
  const UI = createControls({ Panel: TestPanel })
  const flyout = new TestFlyout()
  flyout.onClosed = undefined

  const controller = showFlyout(
    renderer,
    flyout,
    {},
    UI.Panel({}),
    { observeClose: false },
  )
  controller.hide()

  assert.equal(controller.disposed, true)
  assert.equal(flyout.content, null)
})

test('showFlyout.dispose() forces a native hide and cleans up without double-closing', () => {
  const renderer = createTestRenderer()
  const UI = createControls({ Panel: TestPanel })
  const flyout = new TestFlyout()
  let closedCount = 0

  const controller = showFlyout(renderer, flyout, {}, UI.Panel({}), {
    onClosed: () => {
      closedCount += 1
    },
  })

  controller.dispose()

  assert.equal(flyout.isOpen, false)
  assert.equal(flyout.hideCalls, 1)
  assert.equal(flyout.content, null)
  assert.equal(controller.disposed, true)
  assert.equal(closedCount, 1)

  controller.dispose()
  assert.equal(flyout.hideCalls, 1, 'second dispose() must not hide again')
  assert.equal(closedCount, 1, 'second dispose() must not notify onClosed again')
})

test('showMenuFlyout anchors to target with a point and syncs the items collection', () => {
  const renderer = createTestRenderer()
  const UI = createControls({ MenuFlyoutItem: TestMenuItem })
  const menuFlyout = new TestMenuFlyout()
  const target = { id: 'anchor' }
  const point = { x: 12, y: 34 }

  const controller = showMenuFlyout(
    renderer,
    menuFlyout,
    target,
    [UI.MenuFlyoutItem({ text: 'One' }), UI.MenuFlyoutItem({ text: 'Two' })],
    { point },
  )

  assert.equal(menuFlyout.target, target)
  assert.deepEqual(menuFlyout.point, point)
  assert.equal(menuFlyout.items.values.length, 2)
  assert.equal(menuFlyout.isOpen, true)

  menuFlyout.hide()

  assert.equal(menuFlyout.items.values.length, 0, 'items must be released on Closed')
  assert.equal(controller.disposed, true)
})

test('showMenuFlyout defaults the offset point to the origin', () => {
  const renderer = createTestRenderer()
  const UI = createControls({ MenuFlyoutItem: TestMenuItem })
  const menuFlyout = new TestMenuFlyout()

  showMenuFlyout(
    renderer,
    menuFlyout,
    {},
    [UI.MenuFlyoutItem({ text: 'One' })],
  )

  assert.deepEqual(menuFlyout.point, { x: 0, y: 0 })
})

test('createTeachingTip supports open/close cycles and disposes content per cycle', () => {
  const renderer = createTestRenderer()
  const UI = createControls({ Panel: TestPanel })
  const tip = new TestTeachingTip()
  const target = { id: 'anchor' }
  const root = { id: 'xaml-root' }

  const controller = createTeachingTip(renderer, tip, {
    xamlRoot: root,
    target,
  })

  assert.equal(tip.xamlRoot, root)
  assert.equal(tip.target, target)
  assert.equal(controller.isOpen, false)

  const firstContent = UI.Panel({})
  controller.open(firstContent)

  assert.equal(controller.isOpen, true)
  assert.notEqual(tip.content, null)
  const firstMountedContent = tip.content

  controller.close()

  assert.equal(controller.isOpen, false)
  assert.equal(tip.content, null, 'owned content must dispose when the tip closes')

  controller.open(UI.Panel({}))
  assert.equal(controller.isOpen, true)
  assert.notEqual(tip.content, null)
  assert.notEqual(tip.content, firstMountedContent)

  controller.dispose()

  assert.equal(controller.isOpen, false)
  assert.equal(tip.content, null)
  assert.equal(controller.disposed, true)
  assert.equal(tip.closedHandlers.size, 0, 'Closed handler must be removed on dispose')
})

test('createTeachingTip.open() replaces content that is still mounted', () => {
  const renderer = createTestRenderer()
  const UI = createControls({ Panel: TestPanel })
  const tip = new TestTeachingTip()

  const controller = createTeachingTip(renderer, tip)

  controller.open(UI.Panel({}))
  const firstContent = tip.content
  controller.open(UI.Panel({}))

  assert.notEqual(tip.content, null)
  assert.notEqual(tip.content, firstContent, 'stale content must be disposed before remount')
  assert.equal(controller.isOpen, true)
})

test('createTeachingTip cleans up content when opening fails', () => {
  const renderer = createTestRenderer()
  const UI = createControls({ Panel: TestPanel })
  const tip = new TestTeachingTip()
  const controller = createTeachingTip(renderer, tip)
  tip.failOpen = true

  assert.throws(
    () => controller.open(UI.Panel({})),
    /open failed/,
  )
  assert.equal(tip.content, null)
  controller.dispose()
})

test('createTeachingTip forwards onClosed for natural closes and forced dispose', () => {
  const renderer = createTestRenderer()
  const UI = createControls({ Panel: TestPanel })
  const tip = new TestTeachingTip()
  const reasons = []

  const controller = createTeachingTip(renderer, tip, {
    onClosed: (args) => reasons.push(args.reason),
  })

  controller.open(UI.Panel({}))
  controller.close()
  assert.deepEqual(reasons, [2])

  controller.open(UI.Panel({}))
  controller.dispose()
  assert.deepEqual(reasons, [2, 2])
  assert.equal(tip.closedHandlers.size, 0)
})

test('createTeachingTip.dispose() rejects further open() calls', () => {
  const renderer = createTestRenderer()
  const UI = createControls({ Panel: TestPanel })
  const tip = new TestTeachingTip()

  const controller = createTeachingTip(renderer, tip)
  controller.open(UI.Panel({}))
  controller.dispose()

  assert.throws(
    () => controller.open(UI.Panel({})),
    /disposed TeachingTip controller/,
  )
})
