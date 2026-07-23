'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  For,
  batch,
  createComboBoxControl,
  createControls,
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
    this.values.splice(index, 1)
    this.owner.itemsChanged()
  }

  append(value) {
    this.values.push(value)
    this.owner.itemsChanged()
  }

  clear() {
    this.values.length = 0
    this.owner.itemsChanged()
  }
}

class FakeComboBox {
  header = null
  selectedItem = null
  propertyHandlers = new Map()
  selectionListeners = new Set()
  dropDownOpenedListeners = new Set()
  nextToken = 1n
  _selectedIndex = -1

  constructor() {
    this.items = new FakeItemCollection(this)
  }

  get selectedIndex() {
    return this._selectedIndex
  }

  set selectedIndex(value) {
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

  onDropDownOpened(callback) {
    this.dropDownOpenedListeners.add(callback)
    return () => this.dropDownOpenedListeners.delete(callback)
  }

  open() {
    for (const listener of [...this.dropDownOpenedListeners]) {
      listener(this, {})
    }
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
}

class FakeTextBlock {
  text = ''
}

const UI = createControls({
  TextBlock: FakeTextBlock,
})

const selectedIndexProperty = {}

function createComboBox() {
  return createComboBoxControl({
    ComboBox: FakeComboBox,
    selectedIndexProperty,
  })
}

function renderer() {
  return createRenderer({
    onError(error) {
      throw error
    },
  })
}

test('ComboBox owns items and header before applying selectedIndex', () => {
  const ComboBox = createComboBox()
  const selectedIndex = signal(1)
  const window = new FakeWindow()
  const handle = renderer().render(
    jsx(ComboBox, {
      selectedIndex,
      header: jsx(UI.TextBlock, { text: 'Priority' }),
      children: [
        jsx(UI.TextBlock, { text: 'Low' }),
        jsx(UI.TextBlock, { text: 'High' }),
      ],
    }),
    window,
  )
  const comboBox = window.content

  assert.deepEqual(
    comboBox.items.values.map((item) => item.text),
    ['Low', 'High'],
  )
  assert.equal(comboBox.header.text, 'Priority')
  assert.equal(comboBox.selectedIndex, 1)
  assert.equal(comboBox.selectedItem.text, 'High')

  handle.dispose()
  assert.equal(comboBox.items.size, 0)
  assert.equal(comboBox.header, null)
})

test('ComboBox accepts native selection and preserves raw events', () => {
  const ComboBox = createComboBox()
  const selectedIndex = signal(0)
  const changes = []
  const rawEvents = []
  const opened = []
  const window = new FakeWindow()
  renderer().render(
    jsx(ComboBox, {
      selectedIndex,
      onSelectedIndexChange(index) {
        changes.push(index)
        selectedIndex.value = index
      },
      onSelectionChanged() {
        rawEvents.push('selection')
      },
      onDropDownOpened() {
        opened.push('opened')
      },
      children: [
        jsx(UI.TextBlock, { text: 'One' }),
        jsx(UI.TextBlock, { text: 'Two' }),
      ],
    }),
    window,
  )
  const comboBox = window.content
  rawEvents.length = 0

  comboBox.selectedIndex = 1
  comboBox.open()

  assert.equal(selectedIndex.value, 1)
  assert.equal(comboBox.selectedIndex, 1)
  assert.deepEqual(changes, [1])
  assert.deepEqual(rawEvents, ['selection'])
  assert.deepEqual(opened, ['opened'])
})

test('ComboBox restores rejected selection after items finish updating', () => {
  const ComboBox = createComboBox()
  const selectedIndex = signal(1)
  const items = signal([
    { id: 1, label: 'One' },
    { id: 2, label: 'Two' },
  ])
  const changes = []
  const window = new FakeWindow()
  renderer().render(
    jsx(ComboBox, {
      selectedIndex,
      onSelectedIndexChange(index) {
        changes.push(index)
      },
      children: jsx(For, {
        each: items,
        key: (item) => item.id,
        children: (item) =>
          jsx(UI.TextBlock, { text: item.label }),
      }),
    }),
    window,
  )
  const comboBox = window.content

  items.value = [
    { id: 1, label: 'One updated' },
    { id: 2, label: 'Two updated' },
  ]

  assert.equal(selectedIndex.value, 1)
  assert.equal(comboBox.selectedIndex, 1)
  assert.equal(comboBox.selectedItem.text, 'Two updated')
  assert.ok(changes.includes(-1))
})

test('ComboBox applies batched selection after item updates', () => {
  const ComboBox = createComboBox()
  const selectedIndex = signal(0)
  const items = signal([
    { id: 1, label: 'One' },
  ])
  const window = new FakeWindow()
  renderer().render(
    jsx(ComboBox, {
      selectedIndex,
      onSelectedIndexChange() {},
      children: jsx(For, {
        each: items,
        key: (item) => item.id,
        children: (item) =>
          jsx(UI.TextBlock, { text: item.label }),
      }),
    }),
    window,
  )

  batch(() => {
    selectedIndex.value = 1
    items.value = [
      { id: 1, label: 'One' },
      { id: 2, label: 'Two' },
    ]
  })

  assert.equal(window.content.items.size, 2)
  assert.equal(selectedIndex.value, 1)
  assert.equal(window.content.selectedIndex, 1)
  assert.equal(window.content.selectedItem.text, 'Two')
})

test('ComboBox validates selectedIndex and releases subscriptions', () => {
  const ComboBox = createComboBox()
  assert.throws(
    () => renderer().render(
      jsx(ComboBox, {
        selectedIndex: 1.5,
        onSelectedIndexChange() {},
        children: jsx(UI.TextBlock, { text: 'One' }),
      }),
      new FakeWindow(),
    ),
    /ComboBox selectedIndex must be an integer/,
  )
  assert.throws(
    () => renderer().render(
      jsx(ComboBox, {
        selectedItem: {},
        children: jsx(UI.TextBlock, { text: 'One' }),
      }),
      new FakeWindow(),
    ),
    /supports controlled selectedIndex only/,
  )

  const window = new FakeWindow()
  const handle = renderer().render(
    jsx(ComboBox, {
      selectedIndex: 0,
      onSelectedIndexChange() {},
      children: jsx(UI.TextBlock, { text: 'One' }),
    }),
    window,
  )
  const comboBox = window.content
  assert.equal(comboBox.propertyHandlers.size, 1)

  handle.dispose()
  assert.equal(comboBox.propertyHandlers.size, 0)
})
