'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  computed,
  createControls,
  createItemsRepeaterControl,
  createVirtualizedItemsControl,
  createRenderer,
  signal,
} = require('../dist')
const { jsx } = require('../dist/jsx-runtime')
const { FakeWindow } = require('./fakes')

class FakeItemsSource {
  failAtMutation = null
  mutationCount = 0

  constructor(items) {
    this.items = [...items]
  }

  mutate(action) {
    const mutation = this.mutationCount
    this.mutationCount += 1
    if (this.failAtMutation === mutation) {
      this.failAtMutation = null
      throw new Error('items source failed')
    }
    action()
  }

  insertAt(index, value) {
    this.mutate(() => {
      this.items.splice(index, 0, value)
    })
  }

  removeAt(index) {
    this.mutate(() => {
      this.items.splice(index, 1)
    })
  }

  append(value) {
    this.mutate(() => {
      this.items.push(value)
    })
  }

  clear() {
    this.mutate(() => {
      this.items.length = 0
    })
  }
}

class FakeContentControl {
  content = null
}

class FakeItemContainer {
  child = null
}

class FakeItemsRepeater {
  _itemsSource = null
  _itemTemplate = null
  active = new Map()

  get itemsSource() {
    return this._itemsSource
  }

  set itemsSource(value) {
    if (this._itemTemplate) {
      for (const element of this.active.values()) {
        this._itemTemplate.recycleElement({ element })
      }
    }
    this.active.clear()
    this._itemsSource = value
  }

  get itemTemplate() {
    return this._itemTemplate
  }

  set itemTemplate(value) {
    this._itemTemplate = value
  }

  realize(index) {
    const data = this._itemsSource.items[index]
    const element = this._itemTemplate.getElement({ data })
    this.active.set(index, element)
    return element
  }

  recycle(index) {
    const element = this.active.get(index)
    if (!element) {
      return
    }
    this.active.delete(index)
    this._itemTemplate.recycleElement({ element })
  }
}

class FakeTextBlock {
  text = ''
}

const UI = createControls({
  TextBlock: FakeTextBlock,
})

function createRepeater(
  ItemsRepeater = FakeItemsRepeater,
) {
  return createItemsRepeaterControl({
    ItemsRepeater,
    ContentControl: FakeContentControl,
    IElementFactory: {
      create(getElement, recycleElement) {
        let released = false
        return {
          getElement,
          recycleElement,
          get released() {
            return released
          },
          releaseCallbacks() {
            released = true
          },
        }

      },
    },
    IObservableVector_Object: {
      create(items) {
        return new FakeItemsSource(items)
      },
    },
    PropertyValue: {
      createInt32(value) {
        return { value }
      },
    },
    IReference_Int32: {
      from(value) {
        return value
      },
    },
  })
}

function createItemsView() {
  return createVirtualizedItemsControl({
    Control: FakeItemsRepeater,
    ItemHost: FakeItemContainer,
    initializeItemHost(host) {
      host.child = new FakeContentControl()
    },
    getItemMountHost(host) {
      return host.child
    },
    IElementFactory: {
      create(getElement, recycleElement) {
        let released = false
        return {
          getElement,
          recycleElement,
          get released() {
            return released
          },
          releaseCallbacks() {
            released = true
          },
        }
      },
    },
    IObservableVector_Object: {
      create(items) {
        return new FakeItemsSource(items)
      },
    },
    PropertyValue: {
      createInt32(value) {
        return { value }
      },
    },
    IReference_Int32: {
      from(value) {
        return value
      },
    },
  }, {
    displayName: 'ItemsView',
  })
}

function renderer() {
  return createRenderer({
    onError(error) {
      throw error
    },
  })
}

test('ItemsRepeater setup failure releases synchronously realized entries', () => {
  class FailingItemsRepeater extends FakeItemsRepeater {
    failAssignment = true

    get itemsSource() {
      return super.itemsSource
    }

    set itemsSource(value) {
      super.itemsSource = value
      if (value && this.failAssignment) {
        this.failAssignment = false
        this.realize(0)
        throw new Error('assignment failed')
      }
    }
  }

  const ItemsRepeater =
    createRepeater(FailingItemsRepeater)
  const nativeRenderer = renderer()
  assert.throws(
    () => nativeRenderer.render(
      jsx(ItemsRepeater, {
        each: [{ id: 1, label: 'One' }],
        key: (item) => item.id,
        children: (item) =>
          jsx(UI.TextBlock, { text: item.label }),
      }),
      new FakeWindow(),
    ),
    /assignment failed/,
  )

  const snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(snapshot.nodes.length, 0)
  assert.equal(snapshot.diagnostics.activeNative, 0)
})

test('ItemsRepeater realizes a bounded native working set', () => {
  const ItemsRepeater = createRepeater()
  const items = signal(
    Array.from({ length: 1000 }, (_, id) => ({
      id,
      label: `Item ${id}`,
    })),
  )
  const window = new FakeWindow()
  const nativeRenderer = renderer()
  const handle = nativeRenderer.render(
    jsx(ItemsRepeater, {
      each: items,
      key: (item) => item.id,
      children: (item, index) =>
        jsx(UI.TextBlock, {
          text: computed(
            () => `${index.value}:${item.label}`,
          ),
        }),
    }),
    window,
  )
  const repeater = window.content

  assert.equal(nativeRenderer.diagnostics.activeNative, 1)
  const hosts = Array.from(
    { length: 5 },
    (_, index) => repeater.realize(index),
  )
  assert.equal(nativeRenderer.diagnostics.activeNative, 11)
  assert.deepEqual(
    hosts.map((host) => host.content.text),
    [
      '0:Item 0',
      '1:Item 1',
      '2:Item 2',
      '3:Item 3',
      '4:Item 4',
    ],
  )

  for (let index = 0; index < 5; index += 1) {
    repeater.recycle(index)
  }
  const scrolledHosts = Array.from(
    { length: 5 },
    (_, offset) => repeater.realize(100 + offset),
  )
  assert.equal(nativeRenderer.diagnostics.activeNative, 11)
  assert.ok(
    scrolledHosts.every((host) => hosts.includes(host)),
  )

  handle.dispose()
  assert.equal(nativeRenderer.diagnostics.activeNative, 0)
  assert.equal(repeater.itemsSource, null)
  assert.equal(repeater.itemTemplate.released, true)
  assert.ok(hosts.every((host) => host.content === null))
})

test('virtualized items controls support persistent element hosts', () => {
  const ItemsView = createItemsView()
  const window = new FakeWindow()
  const nativeRenderer = renderer()
  const handle = nativeRenderer.render(
    jsx(ItemsView, {
      each: [{ id: 1, label: 'One' }],
      key: (item) => item.id,
      children: (item) =>
        jsx(UI.TextBlock, { text: item.label }),
    }),
    window,
  )
  const itemsView = window.content
  const host = itemsView.realize(0)

  assert.equal(host.child.content.text, 'One')
  handle.dispose()
  assert.ok(host.child instanceof FakeContentControl)
  assert.equal(host.child.content, null)
  assert.equal(itemsView.itemsSource, null)
  assert.equal(itemsView.itemTemplate.released, true)
})

test('ItemsRepeater preserves keyed hosts and item scope across reorder', () => {
  const ItemsRepeater = createRepeater()
  const initial = Array.from({ length: 20 }, (_, id) => ({
    id,
    label: `Item ${id}`,
  }))
  const items = signal(initial)
  const window = new FakeWindow()
  const handle = renderer().render(
    jsx(ItemsRepeater, {
      each: items,
      key: (item) => item.id,
      children: (item, index) =>
        jsx(UI.TextBlock, {
          text: computed(
            () => `${index.value}:${item.label}`,
          ),
        }),
    }),
    window,
  )
  const repeater = window.content
  const host = repeater.realize(0)
  const content = host.content
  const source = repeater.itemsSource

  items.value = [...initial].reverse()
  repeater.recycle(0)
  repeater.realize(0)
  const moved = repeater.realize(initial.length - 1)

  assert.equal(repeater.itemsSource, source)
  assert.equal(moved, host)
  assert.equal(moved.content, content)
  assert.equal(content.text, '19:Item 0')
  handle.dispose()
})

test('ItemsRepeater resets item scope when the keyed item identity changes', () => {
  const ItemsRepeater = createRepeater()
  const items = signal([{ id: 1, label: 'Before' }])
  const window = new FakeWindow()
  const handle = renderer().render(
    jsx(ItemsRepeater, {
      each: items,
      key: (item) => item.id,
      children: (item) =>
        jsx(UI.TextBlock, { text: item.label }),
    }),
    window,
  )
  const repeater = window.content
  const host = repeater.realize(0)
  const previousContent = host.content

  items.value = [{ id: 1, label: 'After' }]
  const updated = repeater.realize(0)

  assert.equal(updated, host)
  assert.notEqual(updated.content, previousContent)
  assert.equal(updated.content.text, 'After')
  handle.dispose()
})

test('ItemsRepeater rolls back content when an incremental source mutation fails', () => {
  const ItemsRepeater = createRepeater()
  const before = { id: 1, label: 'Before' }
  const second = { id: 2, label: 'Second' }
  const items = signal([before, second])
  const window = new FakeWindow()
  const handle = renderer().render(
    jsx(ItemsRepeater, {
      each: items,
      key: (item) => item.id,
      children: (item) =>
        jsx(UI.TextBlock, { text: item.label }),
    }),
    window,
  )
  const repeater = window.content
  const host = repeater.realize(0)
  const previousSource = repeater.itemsSource
  const previousValues = [...previousSource.items]
  previousSource.failAtMutation = 1

  assert.throws(() => {
    items.value = [
      second,
      { id: 1, label: 'After' },
    ]
  }, /items source failed/)
  assert.equal(repeater.itemsSource, previousSource)
  assert.deepEqual(previousSource.items, previousValues)
  assert.equal(host.content.text, 'Before')
  handle.dispose()
})

test('ItemsRepeater rejects duplicate keys before mutating the source', () => {
  const ItemsRepeater = createRepeater()
  const items = signal([{ id: 1 }, { id: 2 }])
  const window = new FakeWindow()
  const handle = renderer().render(
    jsx(ItemsRepeater, {
      each: items,
      key: (item) => item.id,
      children: (item) =>
        jsx(UI.TextBlock, { text: String(item.id) }),
    }),
    window,
  )
  const repeater = window.content
  const previousSource = repeater.itemsSource

  assert.throws(() => {
    items.value = [{ id: 1 }, { id: 1 }]
  }, /Duplicate ItemsRepeater key/)
  assert.equal(repeater.itemsSource, previousSource)
  handle.dispose()
})
