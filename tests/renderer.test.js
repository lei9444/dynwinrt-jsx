'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  ErrorBoundary,
  For,
  Portal,
  Show,
  computed,
  createControls,
  createRenderer,
  onCleanup,
  resource,
  signal,
} = require('../dist')
const { Fragment, jsx, jsxs } = require('../dist/jsx-runtime')
const {
  FakeBorder,
  FakeButton,
  FakePanel,
  FakeTextBlock,
  FakeWindow,
} = require('./fakes')

const Controls = createControls({
  Border: FakeBorder,
  Button: FakeButton,
  Panel: FakePanel,
  TextBlock: FakeTextBlock,
})

function createFakeRenderer() {
  return createRenderer({
    createText(value) {
      const text = new FakeTextBlock()
      text.text = value
      return text
    },
    propertySetters: {
      gridRow(target, value) {
        target.gridRow = value
      },
    },
    resolveResource(key, fallback) {
      if (key === 'AccentSize') {
        return 24
      }
      return fallback
    },
  })
}

test('mounts native controls, props, children, refs, and events', () => {
  const renderer = createFakeRenderer()
  const window = new FakeWindow()
  const label = signal('Ready')
  const enabled = signal(true)
  const buttonRef = { current: null }
  let clicks = 0

  const tree = jsxs(Controls.Panel, {
    spacing: 12,
    children: [
      jsx(Controls.TextBlock, {
        text: label,
        fontSize: resource('AccentSize'),
        gridRow: 2,
      }),
      jsx(Controls.Button, {
        ref: buttonRef,
        isEnabled: enabled,
        onClick: () => {
          clicks += 1
        },
        children: 'Add task',
      }),
    ],
  })

  test('tracked resources resolve again when their refresh signal changes', () => {
    const theme = signal('dark')
    const renderer = createRenderer({
      resolveResource(key) {
        return `${key}:${theme.peek()}`
      },
    })
    const window = new FakeWindow()
    renderer.render(
      jsx(Controls.TextBlock, {
        text: resource('Foreground', undefined, theme),
      }),
      window,
    )

    assert.equal(window.content.text, 'Foreground:dark')
    theme.value = 'light'
    assert.equal(window.content.text, 'Foreground:light')
  })

  const handle = renderer.render(tree, window)
  const panel = window.content
  const [text, button] = panel.children.toArray()

  assert.equal(panel.spacing, 12)
  assert.equal(text.text, 'Ready')
  assert.equal(text.fontSize, 24)
  assert.equal(text.gridRow, 2)
  assert.equal(button.content.text, 'Add task')
  assert.equal(buttonRef.current, button)

  label.value = 'Updated'
  enabled.value = false
  assert.equal(text.text, 'Updated')
  assert.equal(button.isEnabled, false)

  button.click()
  assert.equal(clicks, 1)

  handle.dispose()
  assert.equal(window.content, null)
  assert.equal(buttonRef.current, null)
  assert.equal(button.listeners.size, 0)
})

test('releases renderer-owned native instances after subtree cleanup', () => {
  const released = []
  let buttonRefCleared = false
  const renderer = createRenderer({
    releaseNative(value) {
      if (value instanceof FakePanel) {
        assert.equal(value.children.size, 0)
      }
      if (value instanceof FakeButton) {
        assert.equal(value.listeners.size, 0)
        assert.equal(buttonRefCleared, true)
      }
      released.push(value)
    },
  })
  const window = new FakeWindow()
  const handle = renderer.render(
    jsx(Controls.Panel, {
      children: jsx(Controls.Button, {
        onClick() {},
        ref(value) {
          if (value === null) {
            buttonRefCleared = true
          }
        },
      }),
    }),
    window,
  )
  const panel = window.content
  const [button] = panel.children.toArray()

  handle.dispose()
  handle.dispose()

  assert.deepEqual(released, [button, panel])
})

test('retries renderer-owned native release failures', () => {
  let attempts = 0
  const renderer = createRenderer({
    releaseNative() {
      attempts += 1
      if (attempts === 1) {
        throw new Error('release failed')
      }
    },
  })
  const handle = renderer.render(
    jsx(Controls.Button, {}),
    new FakeWindow(),
  )

  assert.throws(() => handle.dispose(), /release failed/)
  assert.equal(handle.disposed, false)
  assert.equal(renderer.diagnostics.activeNative, 1)

  handle.dispose()
  assert.equal(attempts, 2)
  assert.equal(handle.disposed, true)
  assert.equal(renderer.diagnostics.activeNative, 0)
})

for (const [name, wrap] of [
  ['fragment', (child) => jsx(Fragment, { children: child })],
  ['dynamic', (child) => signal(child)],
  ['Show', (child) => jsx(Show, { when: signal(true), children: child })],
  ['ErrorBoundary', (child) => jsx(ErrorBoundary, {
    fallback: null,
    children: child,
  })],
  ['Portal', (child) => jsx(Portal, {
    mount: new FakePanel(),
    children: child,
  })],
  ['For', (child) => jsx(For, {
    each: [1],
    children: () => child,
  })],
]) {
  test(`retries native release through ${name} without repeating cleanup`, () => {
    let attempts = 0
    let cleanups = 0
    let refClears = 0
    let button
    const enabled = signal(true)
    const renderer = createRenderer({
      releaseNative() {
        attempts += 1
        if (attempts === 1) throw new Error('release failed')
      },
    })
    function Managed() {
      onCleanup(() => { cleanups += 1 })
      return jsx(Controls.Button, {
        isEnabled: enabled,
        onClick() {},
        ref(value) {
          if (value) button = value
          else refClears += 1
        },
      })
    }
    const handle = renderer.render(
      wrap(jsx(Managed, {})),
      new FakePanel(),
    )

    assert.throws(() => handle.dispose(), /release failed/)
    assert.equal(handle.disposed, false)
    assert.equal(renderer.diagnostics.activeNative, 1)
    assert.equal(button.listeners.size, 0)
    assert.equal(cleanups, 1)
    enabled.value = false
    assert.equal(button.isEnabled, true)

    handle.dispose()
    handle.dispose()
    assert.equal(attempts, 2)
    assert.equal(refClears, 1)
    assert.equal(cleanups, 1)
    assert.equal(handle.disposed, true)
    assert.equal(renderer.diagnostics.activeNative, 0)
    assert.equal(renderer.diagnostics.activeComponents, 0)
    const snapshot = renderer.inspector.snapshot()
    assert.deepEqual(snapshot.nodes, [])
    assert.deepEqual(snapshot.subscriptions, [])
    assert.deepEqual(snapshot.reactive.scopes, [])
  })
}

test('fragment disposal retains only failed children and continues sibling cleanup', () => {
  const attempts = new Map()
  const released = []
  const renderer = createRenderer({
    releaseNative(value) {
      const count = (attempts.get(value) ?? 0) + 1
      attempts.set(value, count)
      if (value.text === 'retry' && count === 1) {
        throw new Error('release failed')
      }
      released.push(value)
    },
  })
  const panel = new FakePanel()
  const handle = renderer.render(
    jsx(Fragment, {
      children: [
        jsx(Controls.TextBlock, { text: 'done' }),
        jsx(Controls.TextBlock, { text: 'retry' }),
      ],
    }),
    panel,
  )
  const [done, retry] = panel.children.toArray()

  assert.throws(() => handle.dispose(), /release failed/)
  assert.deepEqual(released, [done])
  assert.equal(handle.disposed, false)
  assert.equal(panel.children.size, 0)
  assert.equal(renderer.diagnostics.activeNative, 1)
  assert.equal(
    renderer.inspector.snapshot().nodes.filter(
      (node) => node.kind === 'native',
    ).length,
    1,
  )

  handle.dispose()
  assert.deepEqual(released, [done, retry])
  assert.equal(attempts.get(done), 1)
  assert.equal(attempts.get(retry), 2)
  assert.equal(panel.children.size, 0)
})

test('implicit native text is tracked and released on replacement and disposal', () => {
  const created = []
  const released = []
  const renderer = createRenderer({
    createText(value) {
      const text = new FakeTextBlock()
      text.text = value
      created.push(text)
      return text
    },
    releaseNative(value) {
      released.push(value)
    },
  })
  const content = signal('private-first')
  const window = new FakeWindow()
  const handle = renderer.render(content, window)

  assert.equal(renderer.diagnostics.activeNative, 1)
  const snapshot = renderer.inspector.snapshot()
  assert.equal(snapshot.nodes.filter((node) => node.kind === 'native').length, 1)
  assert.equal(JSON.stringify(snapshot).includes('private-first'), false)

  content.value = 2
  content.value = 3n
  assert.equal(window.content.text, '3')
  assert.deepEqual(released, created.slice(0, 2))
  assert.equal(renderer.diagnostics.nativeCreated, 3)
  assert.equal(renderer.diagnostics.activeNative, 1)

  handle.dispose()
  handle.dispose()
  assert.deepEqual(released, created)
  assert.equal(window.content, null)
  assert.equal(renderer.diagnostics.nativeDisposed, 3)
  assert.equal(renderer.diagnostics.activeNative, 0)
  assert.deepEqual(renderer.inspector.snapshot().nodes, [])
})

test('implicit native text release remains retryable', () => {
  let attempts = 0
  const renderer = createRenderer({
    createText(value) {
      const text = new FakeTextBlock()
      text.text = value
      return text
    },
    releaseNative() {
      attempts += 1
      if (attempts === 1) throw new Error('text release failed')
    },
  })
  const handle = renderer.render('text', new FakeWindow())
  assert.throws(() => handle.dispose(), /text release failed/)
  assert.equal(handle.disposed, false)
  assert.equal(renderer.diagnostics.activeNative, 1)

  handle.dispose()
  assert.equal(attempts, 2)
  assert.equal(handle.disposed, true)
  assert.equal(renderer.diagnostics.activeNative, 0)
})

test('primitive children without a native text factory remain unowned values', () => {
  const released = []
  const renderer = createRenderer({
    releaseNative(value) { released.push(value) },
  })
  const window = new FakeWindow()
  const handle = renderer.render('text', window)
  assert.equal(window.content, 'text')
  assert.equal(renderer.diagnostics.nativeCreated, 0)
  handle.dispose()
  assert.deepEqual(released, [])
  assert.equal(window.content, null)
})

test('failed dynamic text attachment releases the staged native object', () => {
  class FailingWindow extends FakeWindow {
    get content() {
      return this._content ?? null
    }
    set content(value) {
      if (value?.text === 'broken') throw new Error('attachment failed')
      this._content = value
    }
  }
  const released = []
  const renderer = createRenderer({
    createText(value) {
      const text = new FakeTextBlock()
      text.text = value
      return text
    },
    releaseNative(value) { released.push(value.text) },
  })
  const content = signal('initial')
  const handle = renderer.render(content, new FailingWindow())

  assert.throws(() => { content.value = 'broken' }, /attachment failed/)
  assert.deepEqual(released, ['initial', 'broken'])
  assert.equal(renderer.diagnostics.activeNative, 0)
  content.value = 'recovered'
  assert.equal(renderer.diagnostics.activeNative, 1)
  handle.dispose()
  assert.deepEqual(released, ['initial', 'broken', 'recovered'])
})

test('mounted record disposal is retryable and guards reentrant cleanup', () => {
  const { RecordState } = require('../dist/renderer/renderer-lifecycle')
  let attempts = 0
  const nodes = []
  const record = new RecordState(
    (value) => nodes.push(value),
    () => {
      attempts += 1
      record.dispose()
      if (attempts === 1) throw new Error('cleanup failed')
    },
  )
  const native = {}
  record.setNodes([native])
  assert.throws(() => record.dispose(), /cleanup failed/)
  assert.equal(record.disposed, false)
  assert.deepEqual(record.nodes, [native])
  record.dispose()
  record.dispose()
  assert.equal(record.disposed, true)
  assert.equal(attempts, 2)
  assert.deepEqual(nodes, [[native], []])
})

test('supports function components and reactive Show branches', () => {
  const renderer = createFakeRenderer()
  const window = new FakeWindow()
  const visible = signal(true)

  function Status(props) {
    return jsx(Controls.TextBlock, {
      text: props.text,
    })
  }

  const tree = jsx(Controls.Panel, {
    children: jsx(Show, {
      when: visible,
      fallback: jsx(Status, { text: 'Hidden' }),
      children: jsx(Status, { text: 'Visible' }),
    }),
  })

  renderer.render(tree, window)
  const panel = window.content

  assert.equal(panel.children.getAt(0).text, 'Visible')

  visible.value = false
  assert.equal(panel.children.getAt(0).text, 'Hidden')

  visible.value = true
  assert.equal(panel.children.getAt(0).text, 'Visible')
})

test('updates keyed For children while preserving unchanged controls', () => {
  const renderer = createFakeRenderer()
  const window = new FakeWindow()
  const first = { id: 1, title: 'One' }
  const second = { id: 2, title: 'Two' }
  const items = signal([first, second])

  const tree = jsx(Controls.Panel, {
    children: jsx(For, {
      each: items,
      key: (item) => item.id,
      children: (item) =>
        jsx(Controls.TextBlock, {
          text: item.title,
        }),
    }),
  })

  renderer.render(tree, window)
  const panel = window.content
  const originalFirst = panel.children.getAt(0)
  const originalSecond = panel.children.getAt(1)

  const third = { id: 3, title: 'Three' }
  items.value = [first, second, third]

  assert.equal(panel.children.getAt(0), originalFirst)
  assert.equal(panel.children.getAt(1), originalSecond)
  assert.equal(panel.children.getAt(2).text, 'Three')

  items.value = [second, third]
  assert.equal(panel.children.length, 2)
  assert.equal(panel.children.getAt(0), originalSecond)
  assert.equal(panel.children.getAt(0).text, 'Two')
  assert.equal(panel.children.getAt(1).text, 'Three')
})

test('reactive values can drive primitive content', () => {
  const renderer = createFakeRenderer()
  const window = new FakeWindow()
  const count = signal(1)
  const text = computed(() => `Count: ${count.value}`)

  renderer.render(
    jsx(Controls.Button, {
      children: text,
    }),
    window,
  )

  assert.equal(window.content.content.text, 'Count: 1')
  count.value = 2
  assert.equal(window.content.content.text, 'Count: 2')
})

test('rejects multiple children for single-child controls', () => {
  const renderer = createFakeRenderer()
  const window = new FakeWindow()

  assert.throws(
    () =>
      renderer.render(
        jsxs(Controls.Border, {
          children: [
            jsx(Controls.TextBlock, { text: 'One' }),
            jsx(Controls.TextBlock, { text: 'Two' }),
          ],
        }),
        window,
      ),
    /accepts only one JSX child/,
  )
})

test('disposes component lifecycle work and rejects unknown props', () => {
  const renderer = createFakeRenderer()
  const window = new FakeWindow()
  let cleanups = 0

  function ManagedText() {
    onCleanup(() => {
      cleanups += 1
    })
    return jsx(Controls.TextBlock, { text: 'Managed' })
  }

  const handle = renderer.render(jsx(ManagedText, {}), window)
  handle.dispose()
  handle.dispose()
  assert.equal(cleanups, 1)

  assert.throws(
    () =>
      renderer.render(
        jsx(Controls.TextBlock, {
          unsupportedProperty: true,
        }),
        window,
      ),
    /Unknown JSX property FakeTextBlock\.unsupportedProperty/,
  )
})
