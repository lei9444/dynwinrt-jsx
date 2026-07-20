'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createControls,
  createFocusTarget,
  createListViewControl,
  createListViewScrollTarget,
  createRenderer,
  For,
  signal,
} = require('../dist/index.js')
class FakeItemCollection {
  values = []
  failAppendAt = null
  appendIndex = 0

  get size() {
    return this.values.length
  }

  get length() {
    return this.values.length
  }

  getAt(index) {
    return this.values[index]
  }

  toArray() {
    return [...this.values]
  }

  indexOf(value) {
    return this.values.indexOf(value)
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

class FakeListView {
  constructor() {
    this.items = new FakeItemCollection()
    this.header = null
    this.footer = null
    this.selectedItem = null
    this.selectionMode = 0
    this._selectedIndex = -1
    this.listeners = new Set()
    this.propertyHandlers = new Map()
    this.nextToken = 1n
    this.focusCalls = []
    this.scrollCalls = []
  }

  get selectedIndex() {
    return this._selectedIndex
  }

  set selectedIndex(value) {
    this._selectedIndex = value
    for (const listener of [...this.listeners]) {
      listener(this, { addedItems: [], removedItems: [] })
    }
    for (const [property, callback] of this.propertyHandlers.values()) {
      callback(this, property)
    }
  }

  onSelectionChanged(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  registerPropertyChangedCallback(property, callback) {
    const token = this.nextToken
    this.nextToken += 1n
    this.propertyHandlers.set(token, [property, callback])
    return token
  }

  unregisterPropertyChangedCallback(_property, token) {
    this.propertyHandlers.delete(token)
  }

  focus(state) {
    this.focusCalls.push(state)
    return true
  }

  scrollIntoView(item, alignment) {
    this.scrollCalls.push([item, alignment])
  }
}

class FakeVector {
  values = []

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
    this.values.push(value)
  }

  clear() {
    this.values.length = 0
  }
}

class FakePanel {
  children = new FakeVector()
}

class FakeTextBlock {
  text = ''
}

function renderer() {
  return createRenderer({
    onError(error) {
      throw error
    },
  })
}

test('ListView default children map to the native items collection using existing renderer sync behavior', () => {
  // Default children -> items uses the renderer's generic CollectionAdapter
  // sync, same as any other control. ListView does not layer its own
  // transactional rollback on top of it; a failed native mutation must
  // surface visibly (not be swallowed) and must not tear down the ListView
  // instance, but the exact post-failure collection state is whatever the
  // renderer's existing (non-rollback) sync produces.
  const UI = createControls({ TextBlock: FakeTextBlock })
  const ListView = createListViewControl({ ListView: FakeListView })
  const rows = signal([{ label: 'One' }, { label: 'Two' }])
  let control
  const errors = []

  const handle = createRenderer({
    onError(error) {
      errors.push(error)
    },
  }).render(
    ListView({
      ref(value) {
        control = value
      },
      children: For({
        each: rows,
        children: (row) => UI.TextBlock({ text: row.label }),
      }),
    }),
    new FakePanel(),
  )

  assert.deepEqual(
    control.items.values.map((node) => node.text),
    ['One', 'Two'],
  )

  control.items.failAppendAt = control.items.appendIndex
  rows.value = [...rows.value, { label: 'Three' }]

  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /append failed/)
  assert.ok(control, 'ListView instance must not be disposed by a child sync error')

  rows.value = [...rows.value, { label: 'Four' }]
  assert.deepEqual(
    control.items.values.map((node) => node.text).slice(0, 2),
    ['One', 'Two'],
  )

  const mounted = control
  handle.dispose()
  assert.equal(control, null)
  assert.equal(mounted.items.size, 0)
})

test('ListView header and footer are named slots with owned lifetimes', () => {
  const UI = createControls({ TextBlock: FakeTextBlock })
  const ListView = createListViewControl({ ListView: FakeListView })
  let control

  const handle = renderer().render(
    ListView({
      ref(value) {
        control = value
      },
      header: UI.TextBlock({ text: 'Header' }),
      footer: UI.TextBlock({ text: 'Footer' }),
    }),
    new FakePanel(),
  )

  assert.equal(control.header.text, 'Header')
  assert.equal(control.footer.text, 'Footer')

  const mounted = control
  handle.dispose()
  assert.equal(control, null)
  assert.equal(mounted.header, null)
  assert.equal(mounted.footer, null)
})

test('ListView selectedIndex is controlled and suppresses its own SelectionChanged echo', () => {
  const ListView = createListViewControl({ ListView: FakeListView })
  const selectedIndex = signal(0)
  const changes = []
  const rawEvents = []
  let control

  const handle = renderer().render(
    ListView({
      ref(value) {
        control = value
      },
      selectedIndex,
      onSelectedIndexChange(index) {
        changes.push(index)
      },
      onSelectionChanged() {
        rawEvents.push('raw')
      },
    }),
    new FakePanel(),
  )

  assert.equal(control.selectedIndex, 0)
  assert.deepEqual(changes, [])

  selectedIndex.value = 1
  assert.equal(control.selectedIndex, 1)
  assert.deepEqual(changes, [])
  assert.deepEqual(rawEvents, ['raw'])

  control.selectedIndex = 2
  assert.deepEqual(changes, [2])
  assert.deepEqual(rawEvents, ['raw', 'raw'])

  handle.dispose()
})

test('ListView rejects invalid controlled selectedIndex values', () => {
  const ListView = createListViewControl({ ListView: FakeListView })

  assert.throws(
    () => renderer().render(
      ListView({ selectedIndex: 1.5 }),
      new FakePanel(),
    ),
    /selectedIndex must be an integer/,
  )
})

test('ListView leaves a plain onSelectionChanged prop untouched without a controlled callback', () => {
  const ListView = createListViewControl({ ListView: FakeListView })
  const rawEvents = []
  let control

  const handle = renderer().render(
    ListView({
      ref(value) {
        control = value
      },
      onSelectionChanged() {
        rawEvents.push('raw')
      },
    }),
    new FakePanel(),
  )

  control.selectedIndex = 1
  assert.deepEqual(rawEvents, ['raw'])
  handle.dispose()
})

test('ListView can observe selectedIndex without the projected event', () => {
  const selectedIndexProperty = {}
  const ListView = createListViewControl({
    ListView: FakeListView,
    selectedIndexProperty,
  })
  const selectedIndex = signal(0)
  const changes = []
  let control

  const handle = renderer().render(
    ListView({
      ref(value) {
        control = value
      },
      selectedIndex,
      onSelectedIndexChange(index) {
        changes.push(index)
      },
    }),
    new FakePanel(),
  )

  assert.equal(control.listeners.size, 0)
  assert.equal(control.propertyHandlers.size, 1)
  selectedIndex.value = 1
  assert.deepEqual(changes, [])
  control.selectedIndex = 2
  assert.deepEqual(changes, [2])

  const mounted = control
  handle.dispose()
  assert.equal(mounted.propertyHandlers.size, 0)
})

test('ListView instances work with the generic focus target helper', () => {
  const ListView = createListViewControl({ ListView: FakeListView })
  const focusTarget = createFocusTarget(2)
  let control

  const handle = renderer().render(
    ListView({
      ref(value) {
        focusTarget.current = value
        control = value
      },
    }),
    new FakePanel(),
  )

  assert.equal(focusTarget.focus(), true)
  assert.deepEqual(control.focusCalls, [2])
  assert.equal(focusTarget.focus(1), true)
  assert.deepEqual(control.focusCalls, [2, 1])

  handle.dispose()
  focusTarget.current = null
  assert.equal(focusTarget.focus(), false)
})

test('createListViewScrollTarget forwards scrollIntoView and no-ops without an instance', () => {
  const scrollTarget = createListViewScrollTarget()
  assert.doesNotThrow(() => scrollTarget.scrollIntoView({ id: 1 }))

  const control = new FakeListView()
  scrollTarget.current = control
  const item = { id: 2 }
  scrollTarget.scrollIntoView(item, 1)
  assert.deepEqual(control.scrollCalls, [[item, 1]])

  scrollTarget.scrollIntoView(item)
  assert.deepEqual(control.scrollCalls[1], [item, undefined])
})
