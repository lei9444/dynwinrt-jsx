'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  For,
  Portal,
  computed,
  createControls,
  createRenderer,
  createRoot,
  effect,
  onCleanup,
  onMount,
  resource,
  signal,
} = require('../dist')
const { jsx } = require('../dist/jsx-runtime')
const {
  FakeButton,
  FakePanel,
  FakeTextBlock,
  FakeVector,
  FakeWindow,
} = require('./fakes')

const UI = createControls({
  Button: FakeButton,
  Panel: FakePanel,
  TextBlock: FakeTextBlock,
})

test('renderer inspector exposes bounded privacy-safe runtime snapshots', () => {
  let now = 100
  const secret = signal('private-value')
  const nativeRenderer = createRenderer({
    inspector: {
      maxOperations: 8,
      now: () => {
        now += 1
        return now
      },
    },
    createText(value) {
      const text = new FakeTextBlock()
      text.text = value
      return text
    },
  })

  function App() {
    secret.subscribe(() => {})
    const label = computed(() => `Label: ${secret.value}`)
    return jsx(UI.Panel, {
      children: [
        jsx(UI.TextBlock, { text: label }),
        jsx(UI.Button, {
          onClick() {},
          children: 'Run',
        }),
      ],
    })
  }

  const handle = nativeRenderer.render(
    jsx(App, {}),
    new FakeWindow(),
  )
  let snapshot = nativeRenderer.inspector.snapshot()

  assert.equal(snapshot.operations.length, 8)
  assert.ok(snapshot.operations[0].sequence > 1)
  assert.ok(
    snapshot.nodes.some(
      (node) =>
        node.kind === 'component' &&
        node.label === 'App',
    ),
  )
  assert.ok(
    snapshot.nodes.some(
      (node) =>
        node.kind === 'native' &&
        node.label === 'TextBlock',
    ),
  )
  assert.ok(
    snapshot.reactive.scopes.some(
      (scope) => scope.kind === 'component',
    ),
  )
  assert.ok(snapshot.reactive.observers.length >= 2)
  assert.ok(snapshot.reactive.dependencies.length >= 2)
  assert.ok(
    snapshot.reactive.dependencies.some(
      (dependency) => dependency.listenerCount === 1,
    ),
  )
  assert.ok(
    snapshot.subscriptions.some(
      (subscription) =>
        subscription.kind === 'event' &&
        subscription.name === 'onClick',
    ),
  )
  assert.equal(
    JSON.stringify(snapshot).includes('private-value'),
    false,
  )

  const panel = handle.roots[0]
  panel.children.getAt(1).click()
  secret.value = 'another-private-value'
  snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(snapshot.operations.length, 8)
  assert.ok(
    snapshot.operations.some(
      (operation) => operation.kind === 'event.invoke',
    ),
  )
  assert.equal(
    JSON.stringify(snapshot).includes(
      'another-private-value',
    ),
    false,
  )

  nativeRenderer.inspector.clearOperations()
  assert.deepEqual(
    nativeRenderer.inspector.getOperations(),
    [],
  )

  handle.dispose()
  snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(snapshot.nodes.length, 0)
  assert.equal(snapshot.reactive.scopes.length, 0)
  assert.equal(snapshot.subscriptions.length, 0)
  assert.equal(snapshot.diagnostics.activeNative, 0)
  assert.equal(snapshot.diagnostics.activeComponents, 0)
  assert.ok(
    snapshot.operations.some(
      (operation) => operation.kind === 'render.dispose',
    ),
  )
  handle.dispose()
})

test('renderer inspector records resource lookup metadata without values', () => {
  const nativeRenderer = createRenderer({
    inspector: { maxOperations: 20 },
    resolveResource(key, fallback) {
      return `${key}:${String(fallback)}`
    },
  })
  const handle = nativeRenderer.render(
    jsx(UI.TextBlock, {
      text: resource('InspectorResource', 'secret-fallback'),
    }),
    new FakeWindow(),
  )
  const snapshot = nativeRenderer.inspector.snapshot()
  const operation = snapshot.operations.find(
    (entry) => entry.kind === 'resource.resolve',
  )

  assert.equal(operation.name, 'static:InspectorResource')
  assert.equal(
    JSON.stringify(snapshot).includes('secret-fallback'),
    false,
  )
  handle.dispose()
})

test('renderer inspector validates its operation bound', () => {
  assert.throws(
    () => createRenderer({
      inspector: { maxOperations: -1 },
    }),
    /integer between 0 and 10000/,
  )
  assert.throws(
    () => createRenderer({
      inspector: { maxOperations: 10_001 },
    }),
    /integer between 0 and 10000/,
  )
})

test('renderer inspector can disable detailed tracking', () => {
  const renderer = createRenderer({
    inspector: {
      maxOperations: 0,
      trackNodes: false,
      trackSubscriptions: false,
    },
  })
  const UI = createControls({
    TextBlock: FakeTextBlock,
  })
  const window = new FakeWindow()
  const handle = renderer.render(
    jsx(UI.TextBlock, {
      text: 'Production',
    }),
    window,
  )

  const mounted = renderer.inspector.snapshot()
  assert.deepEqual(mounted.nodes, [])
  assert.deepEqual(mounted.subscriptions, [])
  assert.deepEqual(mounted.operations, [])
  assert.equal(
    mounted.diagnostics.activeNative,
    1,
  )

  handle.dispose()
  assert.equal(
    renderer.inspector.snapshot()
      .diagnostics.activeNative,
    0,
  )
})

test('renderer inspector rolls back partially mounted nodes', () => {
  const nativeRenderer = createRenderer({
    createText(value) {
      if (value === 'broken') {
        throw new Error('text failed')
      }
      const text = new FakeTextBlock()
      text.text = value
      return text
    },
  })

  assert.throws(
    () => nativeRenderer.render(
      [
        jsx(UI.Button, {}),
        'broken',
      ],
      new FakePanel(),
    ),
    /text failed/,
  )

  const snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(snapshot.nodes.length, 0)
  assert.equal(snapshot.reactive.scopes.length, 0)
  assert.equal(snapshot.diagnostics.activeNative, 0)
})

test('renderer inspector restores partially synchronized hosts', () => {
  class FailingVector extends FakeVector {
    append(value) {
      if (this.length === 1) {
        throw new Error('append failed')
      }
      super.append(value)
    }
  }
  class FailingPanel {
    children = new FailingVector()
  }

  const nativeRenderer = createRenderer()
  const panel = new FailingPanel()
  assert.throws(
    () => nativeRenderer.render(
      [
        jsx(UI.Button, {}),
        jsx(UI.Button, {}),
      ],
      panel,
    ),
    /append failed/,
  )

  assert.equal(panel.children.length, 0)
  const snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(snapshot.nodes.length, 0)
  assert.equal(snapshot.diagnostics.activeNative, 0)
})

test('renderer rollback supports write-only native collections', () => {
  class WriteOnlyCollection {
    values = []

    insertAt(index, value) {
      this.values.splice(index, 0, value)
    }
    removeAt(index) {
      this.values.splice(index, 1)
    }
    append(value) {
      if (this.values.length === 1) {
        throw new Error('append failed')
      }
      this.values.push(value)
    }
    clear() {
      this.values.length = 0
    }
  }
  class WriteOnlyPanel {
    children = new WriteOnlyCollection()
  }

  const nativeRenderer = createRenderer()
  const panel = new WriteOnlyPanel()
  assert.throws(
    () => nativeRenderer.render(
      [
        jsx(UI.Button, {}),
        jsx(UI.Button, {}),
      ],
      panel,
    ),
    /append failed/,
  )
  assert.deepEqual(panel.children.values, [])
  assert.equal(
    nativeRenderer.inspector.snapshot().nodes.length,
    0,
  )
})

test('handled initial child sync failures return a consistent empty tree', () => {
  class FailingVector extends FakeVector {
    append(value) {
      if (this.length === 1) {
        throw new Error('append failed')
      }
      super.append(value)
    }
  }
  class FailingPanel {
    children = new FailingVector()
  }

  const errors = []
  const nativeRenderer = createRenderer({
    onError(error, context) {
      errors.push([error.message, context.phase])
    },
  })
  const panel = new FailingPanel()
  const handle = nativeRenderer.render(
    [
      jsx(UI.Button, {}),
      jsx(UI.Button, {}),
    ],
    panel,
  )

  assert.deepEqual(errors, [['append failed', 'children']])
  assert.equal(panel.children.length, 0)
  assert.equal(handle.roots.length, 0)
  assert.equal(
    nativeRenderer.inspector.snapshot().nodes.length,
    1,
  )
  assert.ok(
    nativeRenderer.inspector.getOperations().some(
      (operation) =>
        operation.kind === 'error' &&
        operation.name === 'children',
    ),
  )
  handle.dispose()
})

test('empty failed handles preserve restored foreign children on dispose', () => {
  class FailingInsertVector extends FakeVector {
    failInsert = true

    insertAt(index, value) {
      if (this.failInsert) {
        this.failInsert = false
        throw new Error('insert failed')
      }
      super.insertAt(index, value)
    }
  }
  class ExistingPanel {
    constructor(existing) {
      this.children =
        new FailingInsertVector([existing])
    }
  }

  const foreign = new FakeTextBlock()
  foreign.text = 'Foreign'
  const panel = new ExistingPanel(foreign)
  const errors = []
  const nativeRenderer = createRenderer({
    onError(error) {
      errors.push(error.message)
    },
  })
  const handle = nativeRenderer.render(
    jsx(UI.Button, {}),
    panel,
  )

  assert.deepEqual(errors, ['insert failed'])
  assert.deepEqual(handle.roots, [])
  assert.equal(panel.children.getAt(0), foreign)

  handle.dispose()

  assert.equal(handle.disposed, true)
  assert.equal(panel.children.length, 1)
  assert.equal(panel.children.getAt(0), foreign)
})

test('renderer inspector finalizes failed component fragments', () => {
  const nativeRenderer = createRenderer({
    createText() {
      throw new Error('text failed')
    },
  })
  let button = null
  function Broken() {
    return [
      jsx(UI.Button, {
        ref(value) {
          button = value
        },
      }),
      'broken',
    ]
  }

  assert.throws(
    () => nativeRenderer.render(
      jsx(Broken, {}),
      new FakeWindow(),
    ),
    /text failed/,
  )
  assert.equal(button, null)
  const snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(snapshot.nodes.length, 0)
  assert.equal(snapshot.diagnostics.activeNative, 0)
  assert.equal(snapshot.diagnostics.activeComponents, 0)
})

test('failed root updates leave a consistent empty native tree', () => {
  const nativeRenderer = createRenderer({
    createText(value) {
      if (value === 'broken') {
        throw new Error('text failed')
      }
      const text = new FakeTextBlock()
      text.text = value
      return text
    },
  })
  const window = new FakeWindow()
  const handle = nativeRenderer.render(
    jsx(UI.Button, {}),
    window,
  )
  assert.throws(
    () => handle.update([
      jsx(UI.Button, {}),
      'broken',
    ]),
    /text failed/,
  )

  assert.equal(window.content, null)
  assert.deepEqual(handle.roots, [])
  const snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(
    snapshot.nodes.filter(
      (node) => node.kind === 'native',
    ).length,
    0,
  )
  handle.dispose()
})

test('failed replacement sync rolls back to an empty native tree', () => {
  class FailingUpdateVector extends FakeVector {
    failUpdates = false
    updateMutations = 0

    append(value) {
      if (this.failUpdates) {
        this.updateMutations += 1
        if (this.updateMutations === 2) {
          throw new Error('append failed')
        }
      }
      super.append(value)
    }
  }
  class FailingUpdatePanel {
    children = new FailingUpdateVector()
  }

  const nativeRenderer = createRenderer()
  const panel = new FailingUpdatePanel()
  const handle = nativeRenderer.render(
    jsx(UI.Button, {}),
    panel,
  )
  panel.children.failUpdates = true

  assert.throws(
    () => handle.update([
      jsx(UI.Button, {}),
      jsx(UI.Button, {}),
    ]),
    /append failed/,
  )

  assert.equal(panel.children.length, 0)
  assert.deepEqual(handle.roots, [])
  handle.dispose()
})

test('renderer inspector disposes child records after onMount failure', () => {
  const source = signal('before')
  let textBlock = null
  function BrokenMount() {
    onMount(() => {
      throw new Error('mount failed')
    })
    return jsx(UI.TextBlock, {
      ref(value) {
        textBlock = value
      },
      text: source,
    })
  }
  const nativeRenderer = createRenderer()

  assert.throws(
    () => nativeRenderer.render(
      jsx(BrokenMount, {}),
      new FakeWindow(),
    ),
    /mount failed/,
  )
  assert.equal(textBlock, null)
  source.value = 'after'
  const snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(snapshot.nodes.length, 0)
  assert.equal(snapshot.reactive.scopes.length, 0)
  assert.equal(snapshot.diagnostics.activeNative, 0)
  assert.equal(snapshot.diagnostics.activeComponents, 0)
})

test('renderer inspector finalizes components when cleanup fails', () => {
  const nativeRenderer = createRenderer()
  function BrokenCleanup() {
    onCleanup(() => {
      throw new Error('cleanup failed')
    })
    throw new Error('mount failed')
  }

  assert.throws(
    () => nativeRenderer.render(
      jsx(BrokenCleanup, {}),
      new FakeWindow(),
    ),
    /mount and cleanup failed/,
  )
  const snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(snapshot.nodes.length, 0)
  assert.equal(snapshot.diagnostics.activeComponents, 0)
})

test('renderer inspector does not register roots before adapter resolution', () => {
  const nativeRenderer = createRenderer({
    asCollection() {
      throw new Error('adapter failed')
    },
  })
  assert.throws(
    () => nativeRenderer.render(
      jsx(UI.Button, {}),
      new FakePanel(),
    ),
    /adapter failed/,
  )
  const snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(snapshot.nodes.length, 0)
  assert.equal(snapshot.reactive.scopes.length, 0)
})

test('renderer inspector retains failed native unsubscriptions', () => {
  class LeakyButton extends FakeButton {
    onClick(callback) {
      this.listeners.add(callback)
      return () => {
        throw new Error('unsubscribe failed')
      }
    }
  }

  const LeakyUI = createControls({ Button: LeakyButton })
  const nativeRenderer = createRenderer()
  const handle = nativeRenderer.render(
    jsx(LeakyUI.Button, { onClick() {} }),
    new FakeWindow(),
  )
  const button = handle.roots[0]

  assert.throws(
    () => handle.dispose(),
    /unsubscribe failed/,
  )
  assert.equal(button.listeners.size, 1)
  const snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(snapshot.subscriptions.length, 1)
  assert.equal(
    snapshot.subscriptions[0].status,
    'cleanupFailed',
  )
  assert.ok(
    snapshot.operations.some(
      (operation) =>
        operation.kind === 'error' &&
        operation.name === 'event.unsubscribe',
    ),
  )
})

test('portal detachment failures keep disposal retryable', () => {
  class RetryVector extends FakeVector {
    failRemove = true

    removeAt(index) {
      if (this.failRemove) {
        this.failRemove = false
        throw new Error('portal remove failed')
      }
      super.removeAt(index)
    }
  }
  class RetryPanel {
    children = new RetryVector()
  }

  const target = new RetryPanel()
  const nativeRenderer = createRenderer()
  const handle = nativeRenderer.render(
    jsx(Portal, {
      mount: target,
      children: jsx(UI.Button, {}),
    }),
    new FakePanel(),
  )
  const button = target.children.getAt(0)

  assert.throws(
    () => handle.dispose(),
    /portal remove failed/,
  )
  assert.equal(handle.disposed, false)
  assert.equal(target.children.getAt(0), button)

  handle.dispose()

  assert.equal(handle.disposed, true)
  assert.equal(target.children.length, 0)
})

test('renderer inspector finalizes siblings after cleanup failures', () => {
  class LeakyButton extends FakeButton {
    onClick(callback) {
      this.listeners.add(callback)
      return () => {
        throw new Error('unsubscribe failed')
      }
    }
  }

  const LeakyUI = createControls({ Button: LeakyButton })
  const nativeRenderer = createRenderer()
  const panel = new FakePanel()
  const handle = nativeRenderer.render(
    [
      jsx(LeakyUI.Button, { onClick() {} }),
      jsx(LeakyUI.Button, { onClick() {} }),
    ],
    panel,
  )
  const buttons = panel.children.toArray()

  assert.throws(
    () => handle.dispose(),
    /unsubscribe failed/,
  )
  assert.deepEqual(
    buttons.map((button) => button.listeners.size),
    [1, 1],
  )
  const snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(handle.disposed, false)
  assert.equal(snapshot.subscriptions.length, 2)
  assert.ok(
    snapshot.subscriptions.every(
      (subscription) =>
        subscription.status === 'cleanupFailed',
    ),
  )
  handle.dispose()
  assert.equal(handle.disposed, true)
  assert.equal(
    nativeRenderer.inspector.snapshot().nodes.length,
    0,
  )
})

test('renderer inspector finalizes every keyed entry after cleanup failures', () => {
  class LeakyButton extends FakeButton {
    onClick(callback) {
      this.listeners.add(callback)
      return () => {
        throw new Error('unsubscribe failed')
      }
    }
  }

  const LeakyUI = createControls({ Button: LeakyButton })
  const nativeRenderer = createRenderer()
  const handle = nativeRenderer.render(
    jsx(UI.Panel, {
      children: jsx(For, {
        each: [1, 2],
        key: (item) => item,
        children: () =>
          jsx(LeakyUI.Button, { onClick() {} }),
      }),
    }),
    new FakeWindow(),
  )

  assert.throws(
    () => handle.dispose(),
    /unsubscribe failed/,
  )
  assert.equal(handle.disposed, false)
  assert.equal(
    nativeRenderer.inspector.snapshot().subscriptions.length,
    2,
  )
  handle.dispose()
  const snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(handle.disposed, true)
  assert.equal(snapshot.nodes.length, 0)
  assert.equal(snapshot.diagnostics.activeNative, 0)
})

test('failed child cleanup still disposes the component scope', () => {
  class LeakyButton extends FakeButton {
    onClick(callback) {
      this.listeners.add(callback)
      return () => {
        throw new Error('unsubscribe failed')
      }
    }
  }

  const LeakyUI = createControls({ Button: LeakyButton })
  const source = signal(0)
  let effectRuns = 0
  function Parent() {
    effect(() => {
      source.value
      effectRuns += 1
    })
    return jsx(LeakyUI.Button, { onClick() {} })
  }

  const nativeRenderer = createRenderer()
  const handle = nativeRenderer.render(
    jsx(Parent, {}),
    new FakeWindow(),
  )
  assert.equal(effectRuns, 1)

  assert.throws(
    () => handle.update(
      jsx(UI.TextBlock, { text: 'Replacement' }),
    ),
    /unsubscribe failed/,
  )
  source.value = 1
  assert.equal(effectRuns, 1)
  const snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(
    snapshot.nodes.some(
      (node) =>
        node.kind === 'component' &&
        node.label === 'Parent',
    ),
    false,
  )
  assert.equal(
    snapshot.reactive.scopes.some(
      (scope) =>
        scope.kind === 'component' &&
        scope.label === 'Parent',
    ),
    false,
  )
  handle.dispose()
})

test('renderer inspector follows external computed producers', () => {
  const source = signal(2)
  let external
  const disposeOwner = createRoot((dispose) => {
    external = computed(() => source.value * 2)
    return dispose
  })
  const nativeRenderer = createRenderer()
  const handle = nativeRenderer.render(
    jsx(UI.TextBlock, { fontSize: external }),
    new FakeWindow(),
  )
  const snapshot = nativeRenderer.inspector.snapshot()
  const computedObserver = snapshot.reactive.observers.find(
    (observer) =>
      observer.kind === 'computed' &&
      observer.scopeId === undefined,
  )

  assert.ok(computedObserver)
  assert.ok(
    snapshot.reactive.dependencies.some(
      (dependency) =>
        dependency.producerObserverId === computedObserver.id,
    ),
  )

  handle.dispose()
  disposeOwner()
})

test('renderer inspector sanitizes mutable error names', () => {
  const nativeRenderer = createRenderer({
    onError() {},
  })
  const error = new Error('private-message')
  error.name = 'private-token'

  nativeRenderer.handleError(error, { phase: 'render' })

  const snapshot = nativeRenderer.inspector.snapshot()
  assert.equal(snapshot.operations.at(-1).errorName, 'Error')
  assert.equal(
    JSON.stringify(snapshot).includes('private-token'),
    false,
  )
  assert.equal(
    JSON.stringify(snapshot).includes('private-message'),
    false,
  )
})

test('failed native detachment keeps the render handle retryable', () => {
  class RetryVector extends FakeVector {
    failRemove = true

    removeAt(index) {
      if (this.failRemove) {
        this.failRemove = false
        throw new Error('remove failed')
      }
      super.removeAt(index)
    }
  }
  class RetryPanel {
    children = new RetryVector()
  }

  const nativeRenderer = createRenderer()
  const panel = new RetryPanel()
  const handle = nativeRenderer.render(
    jsx(UI.Button, {}),
    panel,
  )
  const button = panel.children.getAt(0)

  assert.throws(
    () => handle.dispose(),
    /remove failed/,
  )
  assert.equal(handle.disposed, false)
  assert.deepEqual(handle.roots, [button])
  assert.equal(panel.children.length, 1)
  assert.throws(
    () => handle.update(jsx(UI.TextBlock, {})),
    /retry dispose/,
  )
  assert.equal(
    nativeRenderer.inspector.snapshot().nodes.length,
    1,
  )

  handle.dispose()

  assert.equal(handle.disposed, true)
  assert.equal(handle.roots.length, 0)
  assert.equal(panel.children.length, 0)
  assert.equal(
    nativeRenderer.inspector.snapshot().nodes.length,
    0,
  )
})

test('failed update detachment requires disposal retry', () => {
  class RetryVector extends FakeVector {
    failRemove = true

    removeAt(index) {
      if (this.failRemove) {
        this.failRemove = false
        throw new Error('remove failed')
      }
      super.removeAt(index)
    }
  }
  class RetryPanel {
    children = new RetryVector()
  }

  const nativeRenderer = createRenderer()
  const panel = new RetryPanel()
  const handle = nativeRenderer.render(
    jsx(UI.Button, {}),
    panel,
  )
  const button = panel.children.getAt(0)

  assert.throws(
    () => handle.update(jsx(UI.TextBlock, {})),
    /remove failed/,
  )
  assert.equal(handle.disposed, false)
  assert.deepEqual(handle.roots, [button])
  assert.equal(panel.children.getAt(0), button)
  assert.throws(
    () => handle.update(jsx(UI.TextBlock, {})),
    /retry dispose/,
  )

  handle.dispose()

  assert.equal(handle.disposed, true)
  assert.equal(panel.children.length, 0)
})

test('nested native detachment failures propagate to the root handle', () => {
  class RetryVector extends FakeVector {
    failRemove = true

    removeAt(index) {
      if (this.failRemove) {
        this.failRemove = false
        throw new Error('nested remove failed')
      }
      super.removeAt(index)
    }
  }
  class RetryPanel {
    children = new RetryVector()
  }

  const NestedUI = createControls({ Panel: RetryPanel })
  const nativeRenderer = createRenderer()
  const handle = nativeRenderer.render(
    jsx(UI.Panel, {
      children: jsx(NestedUI.Panel, {
        children: jsx(UI.Button, {}),
      }),
    }),
    new FakeWindow(),
  )
  const outer = handle.roots[0]
  const nested = outer.children.getAt(0)
  const button = nested.children.getAt(0)

  assert.throws(
    () => handle.dispose(),
    /nested remove failed/,
  )
  assert.equal(handle.disposed, false)
  assert.equal(nested.children.getAt(0), button)
  assert.ok(
    nativeRenderer.inspector.snapshot().nodes.length >= 2,
  )

  handle.dispose()

  assert.equal(handle.disposed, true)
  assert.equal(nested.children.length, 0)
  assert.equal(
    nativeRenderer.inspector.snapshot().nodes.length,
    0,
  )
})

test('failed keyed reconciliation does not reuse disposed entries', () => {
  const first = { id: 'a', label: 'A' }
  const second = { id: 'b', label: 'B' }
  const items = signal([first, second])
  const nativeRenderer = createRenderer()
  const handle = nativeRenderer.render(
    jsx(UI.Panel, {
      children: jsx(For, {
        each: items,
        key: (item) => item.id,
        children: (item) => {
          if (item.fail) {
            throw new Error('item failed')
          }
          return jsx(UI.Button, {
            children: item.label,
          })
        },
      }),
    }),
    new FakeWindow(),
  )
  const panel = handle.roots[0]

  assert.throws(
    () => {
      items.value = [
        { id: 'a', label: 'A2' },
        { id: 'b', label: 'B2', fail: true },
      ]
    },
    /item failed/,
  )
  assert.equal(panel.children.length, 0)

  items.value = [first, second]

  assert.equal(panel.children.length, 2)
  const nativeNodes =
    nativeRenderer.inspector.snapshot().nodes.filter(
      (node) => node.kind === 'native',
    )
  assert.equal(nativeNodes.length, 3)
  handle.dispose()
})
