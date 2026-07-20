'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  adapter,
  createControls,
  createRenderer,
  native,
  signal,
} = require('../dist/index.js')

class TestVector {
  values = []
  failAt = null
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
    if (this.failAt === this.appendIndex) {
      this.failAt = null
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

class TestHost {
  children = new TestVector()
}

class TestControl {
  value = 0
  reference = null
  items = new TestVector()
  header = null
  actions = new TestVector()
}

class TestText {
  text = ''
}

function renderer() {
  return createRenderer({
    asCollection(value) {
      return value instanceof TestVector ? value : null
    },
    onError(error) {
      throw error
    },
  })
}

test('property adapters classify initial/coercing/reference behavior', () => {
  assert.deepEqual(adapter.oneWay(), {
    kind: 'property',
    mode: 'oneWay',
  })
  assert.deepEqual(adapter.controlled(), {
    kind: 'property',
    mode: 'controlled',
  })
  const initial = signal(2)
  const coerced = signal('3')
  const reference = {}
  let control
  const Control = native(TestControl, {
    adapters: {
      initial: adapter.initialOnly(),
      coerced: adapter.coercing((value) => Number(value)),
      reference: adapter.reference((instance, value) => {
        instance.reference = value
      }),
    },
    setProperty(instance, property, value) {
      if (property === 'initial' || property === 'coerced') {
        instance.value = value
        return true
      }
      return false
    },
  })
  const root = new TestHost()
  const handle = renderer().render(
    Control({
      ref(value) {
        control = value
      },
      initial,
      coerced,
      reference,
    }),
    root,
  )

  assert.equal(control.value, 3)
  assert.equal(control.reference, reference)
  initial.value = 9
  assert.equal(control.value, 3)
  coerced.value = '7'
  assert.equal(control.value, 7)
  handle.dispose()
})

test('collection adapters replace transactionally and roll back', () => {
  const items = signal([1, 2])
  let control
  const Control = native(TestControl, {
    adapters: {
      values: adapter.collection({
        get: (instance) => instance.items,
        map: (value) => value * 10,
        label: 'Test values',
      }),
    },
  })
  const handle = renderer().render(
    Control({
      ref(value) {
        control = value
      },
      values: items,
    }),
    new TestHost(),
  )
  assert.deepEqual(control.items.values, [10, 20])

  control.items.failAt = 1
  assert.throws(() => {
    items.value = [3, 4]
  }, /append failed/)
  assert.deepEqual(control.items.values, [10, 20])
  handle.dispose()
})

test('named and default slot adapters own child lifetimes', () => {
  const UI = createControls({ Text: TestText })
  let control
  const Control = native(TestControl, {
    adapters: {
      headerContent: adapter.slot('header'),
    },
    children: adapter.collectionSlot('actions'),
  })
  const root = new TestHost()
  const handle = renderer().render(
    Control({
      ref(value) {
        control = value
      },
      headerContent: UI.Text({ text: 'Header' }),
      children: [
        UI.Text({ text: 'One' }),
        UI.Text({ text: 'Two' }),
      ],
    }),
    root,
  )

  assert.equal(root.children.size, 1)
  control ??= root.children.getAt(0)
  const mountedControl = control
  assert.equal(mountedControl.header.text, 'Header')
  assert.deepEqual(
    mountedControl.actions.values.map((item) => item.text),
    ['One', 'Two'],
  )
  handle.dispose()
  assert.equal(mountedControl.header, null)
  assert.equal(mountedControl.actions.size, 0)
})
