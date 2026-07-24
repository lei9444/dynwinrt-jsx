'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  batch,
  createControls,
  createRenderer,
  createSelectorBarControl,
  signal,
} = require('../dist')
const { jsx } = require('../dist/jsx-runtime')
const { FakeWindow } = require('./fakes')

class FakeItems {
  values = []

  get size() {
    return this.values.length
  }

  getAt(index) {
    return this.values[index]
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
    this.values.push(value)
  }

  clear() {
    this.values.length = 0
  }
}

class FakeSelectorBar {
  items = new FakeItems()
  listeners = new Set()
  _selectedItem = null

  get selectedItem() {
    return this._selectedItem
  }

  set selectedItem(value) {
    if (this._selectedItem === value) {
      return
    }
    this._selectedItem = value
    for (const listener of [...this.listeners]) {
      listener(this, {})
    }
  }

  onSelectionChanged(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }
}

class FakeSelectorBarItem {
  text = ''
}

const UI = createControls({
  SelectorBarItem: FakeSelectorBarItem,
})

function createSelectorBar() {
  return createSelectorBarControl({
    SelectorBar: FakeSelectorBar,
  })
}

function renderer() {
  return createRenderer({
    onError(error) {
      throw error
    },
  })
}

test('SelectorBar owns items before applying selectedIndex', () => {
  const SelectorBar = createSelectorBar()
  const selectedIndex = signal(1)
  const window = new FakeWindow()
  const handle = renderer().render(
    jsx(SelectorBar, {
      selectedIndex,
      onSelectedIndexChange() {},
      children: [
        jsx(UI.SelectorBarItem, { text: 'Recent' }),
        jsx(UI.SelectorBarItem, { text: 'Favorites' }),
      ],
    }),
    window,
  )
  const selector = window.content

  assert.deepEqual(
    selector.items.values.map((item) => item.text),
    ['Recent', 'Favorites'],
  )
  assert.equal(selector.selectedItem.text, 'Favorites')
  assert.equal(selector.listeners.size, 1)

  handle.dispose()
  assert.equal(selector.items.size, 0)
  assert.equal(selector.listeners.size, 0)
})

test('SelectorBar accepts native selection and reasserts rejected changes', () => {
  const SelectorBar = createSelectorBar()
  const selectedIndex = signal(0)
  const accepted = []
  const rejected = []
  const acceptedWindow = new FakeWindow()
  renderer().render(
    jsx(SelectorBar, {
      selectedIndex,
      onSelectedIndexChange(index) {
        accepted.push(index)
        selectedIndex.value = index
      },
      children: [
        jsx(UI.SelectorBarItem, { text: 'Recent' }),
        jsx(UI.SelectorBarItem, { text: 'Favorites' }),
      ],
    }),
    acceptedWindow,
  )
  const acceptedSelector = acceptedWindow.content

  acceptedSelector.selectedItem =
    acceptedSelector.items.getAt(1)
  assert.equal(selectedIndex.value, 1)
  assert.deepEqual(accepted, [1])

  const rejectedIndex = signal(0)
  const rejectedWindow = new FakeWindow()
  renderer().render(
    jsx(SelectorBar, {
      selectedIndex: rejectedIndex,
      onSelectedIndexChange(index) {
        rejected.push(index)
      },
      children: [
        jsx(UI.SelectorBarItem, { text: 'Recent' }),
        jsx(UI.SelectorBarItem, { text: 'Favorites' }),
      ],
    }),
    rejectedWindow,
  )
  const rejectedSelector = rejectedWindow.content
  rejectedSelector.selectedItem =
    rejectedSelector.items.getAt(1)

  assert.deepEqual(rejected, [1])
  assert.equal(rejectedIndex.value, 0)
  assert.equal(
    rejectedSelector.selectedItem,
    rejectedSelector.items.getAt(0),
  )
})

test('SelectorBar preserves raw events and validates selection', () => {
  const SelectorBar = createSelectorBar()
  const rawEvents = []
  const window = new FakeWindow()
  renderer().render(
    jsx(SelectorBar, {
      selectedIndex: 0,
      onSelectedIndexChange() {},
      onSelectionChanged() {
        rawEvents.push('raw')
      },
      children: [
        jsx(UI.SelectorBarItem, { text: 'Recent' }),
        jsx(UI.SelectorBarItem, { text: 'Favorites' }),
      ],
    }),
    window,
  )
  const selector = window.content
  selector.selectedItem = selector.items.getAt(1)
  assert.deepEqual(rawEvents, ['raw', 'raw'])

  assert.throws(
    () => renderer().render(
      jsx(SelectorBar, {
        selectedIndex: 2,
        children: [
          jsx(UI.SelectorBarItem, { text: 'Only' }),
        ],
      }),
      new FakeWindow(),
    ),
    /exceeds the last item index/,
  )
  assert.throws(
    () => renderer().render(
      jsx(SelectorBar, {
        selectedIndex: 1.5,
      }),
      new FakeWindow(),
    ),
    /selectedIndex must be an integer/,
  )
  assert.throws(
    () => SelectorBar({ selectedItem: {} }),
    /controls selection by selectedIndex/,
  )
})

test('SelectorBar reapplies model selection after item updates', () => {
  const SelectorBar = createSelectorBar()
  const selectedIndex = signal(1)
  const children = signal([
    jsx(UI.SelectorBarItem, { text: 'A' }),
    jsx(UI.SelectorBarItem, { text: 'B' }),
  ])
  const changes = []
  const window = new FakeWindow()
  const handle = renderer().render(
    jsx(SelectorBar, {
      selectedIndex,
      onSelectedIndexChange(index) {
        changes.push(index)
      },
      children,
    }),
    window,
  )
  const selector = window.content
  assert.equal(selector.selectedItem.text, 'B')

  children.value = [
    jsx(UI.SelectorBarItem, { text: 'C' }),
    jsx(UI.SelectorBarItem, { text: 'A' }),
    jsx(UI.SelectorBarItem, { text: 'B' }),
  ]

  assert.equal(selectedIndex.value, 1)
  assert.equal(selector.selectedItem.text, 'A')
  assert.deepEqual(changes, [])

  handle.dispose()
  assert.deepEqual(changes, [])
})

test('SelectorBar applies deferred selection when items arrive', () => {
  const SelectorBar = createSelectorBar()
  const children = signal([])
  const window = new FakeWindow()
  renderer().render(
    jsx(SelectorBar, {
      selectedIndex: 0,
      onSelectedIndexChange() {},
      children,
    }),
    window,
  )
  const selector = window.content
  assert.equal(selector.selectedItem, null)

  children.value = [
    jsx(UI.SelectorBarItem, { text: 'Recent' }),
  ]

  assert.equal(selector.selectedItem.text, 'Recent')
})

test('SelectorBar accepts batched item shrink and selection updates', () => {
  const SelectorBar = createSelectorBar()
  const selectedIndex = signal(1)
  const children = signal([
    jsx(UI.SelectorBarItem, { text: 'A' }),
    jsx(UI.SelectorBarItem, { text: 'B' }),
  ])
  const window = new FakeWindow()
  renderer().render(
    jsx(SelectorBar, {
      selectedIndex,
      onSelectedIndexChange(index) {
        selectedIndex.value = index
      },
      children,
    }),
    window,
  )
  const selector = window.content

  batch(() => {
    children.value = [
      jsx(UI.SelectorBarItem, { text: 'Only' }),
    ]
    selectedIndex.value = 0
  })

  assert.equal(selectedIndex.value, 0)
  assert.equal(selector.selectedItem.text, 'Only')
})

test('SelectorBar reports final invalid selection as -1', () => {
  const SelectorBar = createSelectorBar()
  const selectedIndex = signal(1)
  const children = signal([
    jsx(UI.SelectorBarItem, { text: 'A' }),
    jsx(UI.SelectorBarItem, { text: 'B' }),
  ])
  const changes = []
  const window = new FakeWindow()
  renderer().render(
    jsx(SelectorBar, {
      selectedIndex,
      onSelectedIndexChange(index) {
        changes.push(index)
        selectedIndex.value = index
      },
      children,
    }),
    window,
  )

  children.value = [
    jsx(UI.SelectorBarItem, { text: 'Only' }),
  ]

  assert.deepEqual(changes, [-1])
  assert.equal(selectedIndex.value, -1)
  assert.equal(window.content.selectedItem, null)
})

test('SelectorBar restores model selection when callbacks throw', () => {
  const SelectorBar = createSelectorBar()
  const selectedIndex = signal(0)
  const window = new FakeWindow()
  renderer().render(
    jsx(SelectorBar, {
      selectedIndex,
      onSelectedIndexChange() {
        throw new Error('selection callback failed')
      },
      children: [
        jsx(UI.SelectorBarItem, { text: 'Recent' }),
        jsx(UI.SelectorBarItem, { text: 'Favorites' }),
      ],
    }),
    window,
  )
  const selector = window.content

  assert.throws(
    () => {
      selector.selectedItem = selector.items.getAt(1)
    },
    /selection callback failed/,
  )
  assert.equal(selectedIndex.value, 0)
  assert.equal(
    selector.selectedItem,
    selector.items.getAt(0),
  )
})
