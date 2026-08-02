'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createControls,
  createPivotControl,
  createRenderer,
  signal,
} = require('../dist')
const { jsx } = require('../dist/jsx-runtime')
const { FakeWindow } = require('./fakes')

class FakeItemCollection {
  values = []

  constructor(owner) {
    this.owner = owner
  }

  get size() {
    return this.values.length
  }

  getAt(index) {
    return this.values[index]
  }

  insertAt(index, value) {
    this.values.splice(index, 0, value)
    this.owner.itemsChanged()
  }

  removeAt(index) {
    this.owner.order.push('child-remove')
    this.values.splice(index, 1)
    this.owner.itemsChanged()
  }

  append(value) {
    this.values.push(value)
    this.owner.itemsChanged()
  }

  clear() {
    this.owner.order.push('children-clear')
    this.values.length = 0
    this.owner.itemsChanged()
  }
}

class FakePivot {
  selectedItem = null
  propertyHandlers = new Map()
  selectionListeners = new Set()
  nextToken = 1n
  _selectedIndex = -1
  disconnected = false
  order = []

  constructor() {
    this.items = new FakeItemCollection(this)
  }

  get selectedIndex() {
    return this._selectedIndex
  }

  set selectedIndex(value) {
    if (this.disconnected) {
      throw new Error('Pivot is disconnected')
    }
    const next =
      value >= this.items.size ? -1 : value
    this.setSelection(next)
  }

  setSelection(index) {
    if (this._selectedIndex === index) {
      return
    }
    this._selectedIndex = index
    this.selectedItem =
      index >= 0 ? this.items.getAt(index) : null
    for (const listener of [...this.selectionListeners]) {
      listener(this, {})
    }
    for (const [property, callback] of this.propertyHandlers.values()) {
      callback(this, property)
    }
  }

  itemsChanged() {
    if (this._selectedIndex >= this.items.size) {
      this.setSelection(-1)
    }
  }

  onSelectionChanged(callback) {
    this.selectionListeners.add(callback)
    return () => this.selectionListeners.delete(callback)
  }

  registerPropertyChangedCallback(property, callback) {
    const token = this.nextToken
    this.nextToken += 1n
    this.propertyHandlers.set(token, [property, callback])
    return token
  }

  unregisterPropertyChangedCallback(_property, token) {
    this.order.push('unsubscribe')
    this.propertyHandlers.delete(token)
  }

  disconnect() {
    this.order.push('release')
    this.disconnected = true
  }
}

class FakeTextBlock {
  text = ''
}

const UI = createControls({
  TextBlock: FakeTextBlock,
})

function createPivot() {
  return createPivotControl({
    Pivot: FakePivot,
    selectedIndexProperty: {},
  })
}

function renderer() {
  return createRenderer({
    onError(error) {
      throw error
    },
    releaseNative(value) {
      value.disconnect?.()
    },
  })
}

test('Pivot synchronizes selectedIndex and unsubscribes before release', () => {
  const Pivot = createPivot()
  const selectedIndex = signal(1)
  const changes = []
  const rawEvents = []
  const window = new FakeWindow()
  const handle = renderer().render(
    jsx(Pivot, {
      selectedIndex,
      onSelectedIndexChange(index) {
        changes.push(index)
        selectedIndex.value = index
      },
      onSelectionChanged() {
        rawEvents.push('selection')
      },
      children: [
        jsx(UI.TextBlock, { text: 'All' }),
        jsx(UI.TextBlock, { text: 'Unread' }),
      ],
    }),
    window,
  )
  const pivot = window.content

  assert.equal(pivot.selectedIndex, 1)
  assert.equal(pivot.selectedItem.text, 'Unread')

  pivot.selectedIndex = 0

  assert.equal(selectedIndex.value, 0)
  assert.equal(pivot.selectedIndex, 0)
  assert.deepEqual(changes, [0])
  assert.deepEqual(rawEvents, ['selection'])
  assert.equal(pivot.propertyHandlers.size, 1)

  handle.dispose()

  assert.equal(pivot.propertyHandlers.size, 0)
  assert.equal(pivot.selectionListeners.size, 0)
  assert.equal(pivot.items.size, 0)
  assert.equal(pivot.disconnected, true)
  assert.equal(pivot.order[0], 'unsubscribe')
  assert.deepEqual(pivot.order.slice(1), [
    'child-remove',
    'child-remove',
    'release',
  ])
})

test('Pivot validates selectedIndex and rejects controlled selectedItem', () => {
  const Pivot = createPivot()

  assert.throws(
    () => renderer().render(
      jsx(Pivot, {
        selectedIndex: 1.5,
        onSelectedIndexChange() {},
        children: jsx(UI.TextBlock, { text: 'All' }),
      }),
      new FakeWindow(),
    ),
    /Pivot selectedIndex must be an integer/,
  )
  assert.throws(
    () => renderer().render(
      jsx(Pivot, {
        selectedItem: {},
        children: jsx(UI.TextBlock, { text: 'All' }),
      }),
      new FakeWindow(),
    ),
    /supports controlled selectedIndex only/,
  )
})
