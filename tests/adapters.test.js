'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  ErrorBoundary,
  For,
  Show,
  adapter,
  createControls,
  createRenderer,
  native,
  onMount,
  signal,
} = require('../dist/index.js')
const { jsx } = require('../dist/jsx-runtime.js')

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
  assert.deepEqual(
    adapter.withPhase(adapter.oneWay(), 'afterChildren'),
    {
      kind: 'property',
      mode: 'oneWay',
      phase: 'afterChildren',
    },
  )
  assert.throws(
    () => adapter.withPhase(adapter.oneWay(), 'later'),
    /Unknown native property phase/,
  )
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

test('property adapter phases bracket children and native mount', () => {
  const events = []
  const root = new TestHost()

  class PhaseControl {
    children = new TestVector()

    set before(value) {
      events.push(['before', value, this.children.size, root.children.size])
    }
    set afterChildren(value) {
      events.push([
        'afterChildren',
        value,
        this.children.size,
        root.children.size,
      ])
    }
    set afterMount(value) {
      events.push([
        'afterMount',
        value,
        this.children.size,
        root.children.size,
      ])
    }
  }

  const UI = createControls({ Text: TestText })
  const Control = native(PhaseControl, {
    adapters: {
      before: adapter.oneWay(),
      afterChildren: adapter.withPhase(
        adapter.oneWay(),
        'afterChildren',
      ),
      afterMount: adapter.withPhase(
        adapter.oneWay(),
        'afterMount',
      ),
    },
  })
  function Screen() {
    onMount(() => {
      events.push(['componentMount', root.children.size])
    })
    return Control({
      before: 1,
      afterChildren: 2,
      afterMount: 3,
      children: UI.Text({ text: 'Child' }),
    })
  }

  const handle = renderer().render(jsx(Screen, {}), root)

  assert.deepEqual(events, [
    ['before', 1, 0, 0],
    ['afterChildren', 2, 1, 0],
    ['afterMount', 3, 1, 0],
    ['componentMount', 0],
  ])
  handle.dispose()
})

test('deferred property conversion errors reach ErrorBoundary', () => {
  class PhaseControl {
    value = ''
  }

  const source = signal('safe')
  const UI = createControls({ Text: TestText })
  const Control = native(PhaseControl, {
    adapters: {
      value: adapter.withPhase(
        adapter.oneWay(),
        'afterChildren',
      ),
    },
  })
  const root = new TestHost()
  const nativeRenderer = createRenderer({
    asCollection(value) {
      return value instanceof TestVector ? value : null
    },
    propertyConverters: {
      value(_target, value) {
        if (value === 'broken') {
          throw new Error('convert failed')
        }
        return value
      },
    },
    onError(error) {
      throw error
    },
  })

  const handle = nativeRenderer.render(
    jsx(ErrorBoundary, {
      fallback: (error, context) =>
        UI.Text({
          text: `${context.phase}:${error.message}`,
        }),
      children: Control({ value: source }),
    }),
    root,
  )
  assert.equal(root.children.getAt(0).value, 'safe')

  source.value = 'broken'

  assert.equal(
    root.children.getAt(0).text,
    'property:convert failed',
  )
  handle.dispose()
})

test('initial phased signal writes stay inside dynamic mount ordering', () => {
  class EventControl {
    listeners = new Set()
    current = ''

    set value(value) {
      this.current = value
      events.push('set')
      for (const listener of [...this.listeners]) {
        listener()
      }
    }

    onValueChanged(callback) {
      this.listeners.add(callback)
      return () => this.listeners.delete(callback)
    }
  }

  const events = []
  const visible = signal(false)
  const value = signal('ready')
  const Control = native(EventControl, {
    adapters: {
      value: adapter.withPhase(
        adapter.oneWay(),
        'afterChildren',
      ),
    },
  })
  const root = new TestHost()
  const handle = renderer().render(
    jsx(Show, {
      when: visible,
      children: Control({
        value,
        onValueChanged() {
          events.push('event')
        },
      }),
    }),
    root,
  )

  visible.value = true

  assert.deepEqual(events, ['set'])
  handle.dispose()
})

test('initial phased fallback failures propagate to outer boundaries', () => {
  class PhaseControl {
    value = ''
  }

  const visible = signal(false)
  const UI = createControls({ Text: TestText })
  const Control = native(PhaseControl, {
    adapters: {
      value: adapter.withPhase(
        adapter.oneWay(),
        'afterChildren',
      ),
    },
  })
  const root = new TestHost()
  const nativeRenderer = createRenderer({
    asCollection(value) {
      return value instanceof TestVector ? value : null
    },
    propertyConverters: {
      value() {
        throw new Error('phase failed')
      },
    },
    onError(error) {
      throw error
    },
  })
  const handle = nativeRenderer.render(
    jsx(ErrorBoundary, {
      fallback: (error) =>
        UI.Text({ text: `outer:${error.message}` }),
      children: jsx(ErrorBoundary, {
        fallback: () => Control({ value: 'fallback' }),
        children: jsx(Show, {
          when: visible,
          children: Control({ value: 'child' }),
        }),
      }),
    }),
    root,
  )

  visible.value = true

  assert.equal(root.children.getAt(0).text, 'outer:phase failed')
  handle.dispose()
})

test('controlled adapters reject deferred transactional rollback', () => {
  const controlled = {
    changeProperty: 'onValueChange',
    read: (instance) => instance.value,
    write: (instance, value) => {
      instance.value = value
    },
    subscribe: () => () => {},
    rollback: (instance, previous) => {
      instance.value = previous
    },
    echo: 'deferred',
  }

  assert.throws(
    () => adapter.controlled(controlled),
    /rollback requires synchronous or setterScope/,
  )
  assert.throws(
    () => adapter.coercing((value) => value, controlled),
    /rollback requires synchronous or setterScope/,
  )
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

test('collection slots synchronize dynamic keyed children', () => {
  const UI = createControls({ Text: TestText })
  const items = signal([
    { id: 1, label: 'One' },
    { id: 2, label: 'Two' },
  ])
  let control
  const Control = native(TestControl, {
    children: adapter.collectionSlot('actions'),
  })
  const handle = renderer().render(
    Control({
      ref(value) {
        control = value
      },
      children: For({
        each: items,
        key: (item) => item.id,
        children: (item) => UI.Text({ text: item.label }),
      }),
    }),
    new TestHost(),
  )

  assert.deepEqual(
    control.actions.values.map((item) => item.text),
    ['One', 'Two'],
  )
  items.value = [
    ...items.value,
    { id: 3, label: 'Three' },
  ]
  assert.deepEqual(
    control.actions.values.map((item) => item.text),
    ['One', 'Two', 'Three'],
  )
  const mountedControl = control
  handle.dispose()
  assert.equal(mountedControl.actions.size, 0)
})

test('self collection slots own children on collection objects', () => {
  class SelfCollection extends TestVector {}
  const UI = createControls({ Text: TestText })
  let collection
  const Collection = native(SelfCollection, {
    children: adapter.selfCollection(),
  })
  const root = new TestHost()
  const handle = renderer().render(
    Collection({
      ref(value) {
        collection = value
      },
      children: [
        UI.Text({ text: 'One' }),
        UI.Text({ text: 'Two' }),
      ],
    }),
    root,
  )

  assert.deepEqual(
    collection.values.map((item) => item.text),
    ['One', 'Two'],
  )
  const mountedCollection = collection
  handle.dispose()
  assert.equal(mountedCollection.size, 0)
})

test('collection slot getters resolve mutable collection views', () => {
  class IndirectCollectionControl {
    observableItems = {}
    mutableItems = new TestVector()
  }
  const UI = createControls({ Text: TestText })
  let control
  const Control = native(IndirectCollectionControl, {
    children: adapter.collectionSlotFrom(
      (instance) => instance.mutableItems,
    ),
  })
  const root = new TestHost()
  const handle = renderer().render(
    Control({
      ref(value) {
        control = value
      },
      children: UI.Text({ text: 'Item' }),
    }),
    root,
  )

  assert.equal(control.mutableItems.getAt(0).text, 'Item')
  const mountedControl = control
  handle.dispose()
  assert.equal(mountedControl.mutableItems.size, 0)
})

test('collection slot getters re-resolve replaced native views', () => {
  let nextNativeId = 0
  class NativeText {
    _obj = `native-${nextNativeId++}`
    text = ''
  }
  class NativeVector extends TestVector {
    constructor(values = []) {
      super()
      this.values = [...values]
    }
    insertAt(index, value) {
      this.values.splice(index, 0, value._obj ?? value)
    }
    append(value) {
      this.values.push(value._obj ?? value)
    }
  }
  class ReplacingCollectionControl {
    mutableItems = new NativeVector()
  }
  const UI = createControls({ Text: NativeText })
  const items = signal([
    { id: 1, label: 'One' },
    { id: 2, label: 'Two' },
  ])
  let control
  const Control = native(ReplacingCollectionControl, {
    children: adapter.collectionSlotFrom(
      (instance) => instance.mutableItems,
    ),
  })
  const handle = renderer().render(
    Control({
      ref(value) {
        control = value
      },
      children: For({
        each: items,
        key: (item) => item.id,
        children: (item) => UI.Text({ text: item.label }),
      }),
    }),
    new TestHost(),
  )
  const original = control.mutableItems
  const replacement = new NativeVector([
    'foreign-a',
    'foreign-b',
  ])
  control.mutableItems = replacement

  const nextItems = [
    items.value[1],
    items.value[0],
    { id: 3, label: 'Three' },
  ]
  items.value = nextItems
  assert.equal(replacement.size, 3)
  assert.deepEqual(
    replacement.values,
    ['native-1', 'native-0', 'native-2'],
  )
  assert.equal(original.size, 0)
  control.mutableItems = null
  assert.throws(
    () => {
      items.value = [
        ...items.value,
        { id: 4, label: 'Four' },
      ]
    },
    /no longer resolves a mutable collection/,
  )
  handle.dispose()
  assert.equal(original.size, 0)
  assert.equal(replacement.size, 0)
})

test('failed previous collection cleanup remains retryable', () => {
  class ClearFailVector extends TestVector {
    failClear = false
    clear() {
      if (this.failClear) {
        this.failClear = false
        throw new Error('clear failed')
      }
      super.clear()
    }
  }
  class ReplacingCollectionControl {
    mutableItems = new ClearFailVector()
  }
  const UI = createControls({ Text: TestText })
  const items = signal([
    { id: 1, label: 'One' },
    { id: 2, label: 'Two' },
  ])
  let control
  const Control = native(ReplacingCollectionControl, {
    children: adapter.collectionSlotFrom(
      (instance) => instance.mutableItems,
    ),
  })
  const handle = renderer().render(
    Control({
      ref(value) {
        control = value
      },
      children: For({
        each: items,
        key: (item) => item.id,
        children: (item) => UI.Text({ text: item.label }),
      }),
    }),
    new TestHost(),
  )
  const original = control.mutableItems
  const replacement = new ClearFailVector()
  original.failClear = true
  control.mutableItems = replacement

  assert.throws(
    () => {
      items.value = [
        ...items.value,
        { id: 3, label: 'Three' },
      ]
    },
    /clear failed/,
  )
  assert.equal(original.size, 2)
  assert.equal(replacement.size, 2)
  handle.dispose()
  assert.equal(original.size, 0)
  assert.equal(replacement.size, 0)
})

test('slot afterSync failures leave native ownership consistent', () => {
  const UI = createControls({ Text: TestText })
  class SingleSlotControl {
    content = null
  }
  let fail = false
  const Control = native(SingleSlotControl, {
    children: adapter.slot('content', {
      afterSync() {
        if (fail) {
          throw new Error('after sync failed')
        }
      },
    }),
  })
  const root = new TestHost()
  const content = signal(
    UI.Text({ text: 'Original' }),
  )
  const handle = renderer().render(
    Control({
      children: content,
    }),
    root,
  )
  const control = root.children.getAt(0)
  fail = true
  assert.throws(
    () => {
      content.value =
        UI.Text({ text: 'Replacement' })
    },
    /after sync failed/,
  )
  assert.equal(control.content, null)
  fail = false
  handle.dispose()
})
