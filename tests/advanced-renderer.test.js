'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  ErrorBoundary,
  For,
  Portal,
  VirtualFor,
  computed,
  createContext,
  createControls,
  createHotRoot,
  createRenderer,
  onCleanup,
  onMount,
  signal,
  useContext,
} = require('../dist')
const { jsx } = require('../dist/jsx-runtime')
const {
  FakeButton,
  FakePanel,
  FakeTextBlock,
  FakeWindow,
} = require('./fakes')

class ExplodingTextBlock extends FakeTextBlock {
  get text() {
    return this._text ?? ''
  }

  set text(value) {
    if (value === 'explode') {
      throw new Error('text exploded')
    }
    this._text = value
  }
}

const UI = createControls({
  Button: FakeButton,
  Panel: FakePanel,
  TextBlock: FakeTextBlock,
})
const ErrorUI = createControls({
  Panel: FakePanel,
  TextBlock: ExplodingTextBlock,
})

function renderer() {
  return createRenderer({
    createText(value) {
      const text = new FakeTextBlock()
      text.text = value
      return text
    },
  })
}

test('moves keyed entries without recreating controls', () => {
  const nativeRenderer = renderer()
  const window = new FakeWindow()
  const first = { id: 1, title: 'One' }
  const second = { id: 2, title: 'Two' }
  const third = { id: 3, title: 'Three' }
  const items = signal([first, second, third])

  nativeRenderer.render(
    jsx(UI.Panel, {
      children: jsx(For, {
        each: items,
        key: (item) => item.id,
        children: (item, index) =>
          jsx(UI.TextBlock, {
            text: computed(() => `${index.value}:${item.title}`),
          }),
      }),
    }),
    window,
  )

  const panel = window.content
  const originals = panel.children.toArray()
  items.value = [third, first, second]

  assert.equal(panel.children.getAt(0), originals[2])
  assert.equal(panel.children.getAt(1), originals[0])
  assert.equal(panel.children.getAt(2), originals[1])
  assert.deepEqual(
    panel.children.toArray().map((item) => item.text),
    ['0:Three', '1:One', '2:Two'],
  )
  assert.equal(nativeRenderer.diagnostics.listEntriesCreated, 3)
  assert.equal(nativeRenderer.diagnostics.listEntriesReused, 3)
})

test('event signals swap handlers without resubscribing', () => {
  const nativeRenderer = renderer()
  const window = new FakeWindow()
  const calls = []
  const handler = signal(() => calls.push('first'))

  nativeRenderer.render(
    jsx(UI.Button, {
      onClick: handler,
      children: 'Run',
    }),
    window,
  )

  const button = window.content
  assert.equal(button.listeners.size, 1)
  button.click()

  handler.value = () => calls.push('second')
  assert.equal(button.listeners.size, 1)
  button.click()

  assert.deepEqual(calls, ['first', 'second'])
})

test('render handles support full-tree hot updates', () => {
  const nativeRenderer = renderer()
  const window = new FakeWindow()
  let version = 1
  const root = createHotRoot(
    nativeRenderer,
    window,
    () => jsx(UI.TextBlock, { text: `Version ${version}` }),
  )

  assert.equal(window.content.text, 'Version 1')
  version = 2
  root.refresh()
  assert.equal(window.content.text, 'Version 2')

  root.update(jsx(UI.TextBlock, { text: 'Manual' }))
  assert.equal(window.content.text, 'Manual')
  root.dispose()
  assert.equal(root.disposed, true)
  assert.throws(() => root.refresh(), /disposed render handle/)
})

test('context values flow through dynamic descendants', () => {
  const Theme = createContext('system')
  const visible = signal(true)
  const nativeRenderer = renderer()
  const window = new FakeWindow()

  function Label() {
    return jsx(UI.TextBlock, {
      text: useContext(Theme),
    })
  }

  nativeRenderer.render(
    jsx(Theme.Provider, {
      value: 'dark',
      children: jsx(UI.Panel, {
        children: computed(() =>
          visible.value ? jsx(Label, {}) : null,
        ),
      }),
    }),
    window,
  )

  const panel = window.content
  assert.equal(panel.children.getAt(0).text, 'dark')
  visible.value = false
  visible.value = true
  assert.equal(panel.children.getAt(0).text, 'dark')
})

test('onMount runs child-first and cleanup runs once', () => {
  const nativeRenderer = renderer()
  const window = new FakeWindow()
  const events = []

  function Child() {
    onMount(() => {
      events.push('child mounted')
      return () => events.push('child cleaned')
    })
    return jsx(UI.TextBlock, { text: 'Child' })
  }

  function Parent() {
    onCleanup(() => events.push('parent cleaned'))
    onMount(() => {
      events.push('parent mounted')
    })
    return jsx(UI.Panel, {
      children: jsx(Child, {}),
    })
  }

  const handle = nativeRenderer.render(jsx(Parent, {}), window)
  assert.deepEqual(events, ['child mounted', 'parent mounted'])
  handle.dispose()
  assert.deepEqual(events, [
    'child mounted',
    'parent mounted',
    'child cleaned',
    'parent cleaned',
  ])
})

test('ErrorBoundary catches mount and reactive property failures', () => {
  const nativeRenderer = renderer()
  const window = new FakeWindow()
  const source = signal('safe')
  const reset = signal(0)

  function Broken() {
    throw new Error('mount failed')
  }

  nativeRenderer.render(
    jsx(ErrorBoundary, {
      fallback: (error, context) =>
        jsx(UI.TextBlock, {
          text: `${context.phase}:${error.message}`,
        }),
      children: jsx(Broken, {}),
    }),
    window,
  )
  assert.equal(window.content.text, 'component:mount failed')

  const reactiveWindow = new FakeWindow()
  nativeRenderer.render(
    jsx(ErrorBoundary, {
      reset,
      fallback: (error, context) =>
        jsx(UI.TextBlock, {
          text: `${context.phase}:${error.message}`,
        }),
      children: jsx(ErrorUI.TextBlock, {
        text: source,
      }),
    }),
    reactiveWindow,
  )

  assert.equal(reactiveWindow.content.text, 'safe')
  source.value = 'explode'
  assert.equal(
    reactiveWindow.content.text,
    'property:text exploded',
  )

  source.value = 'recovered'
  reset.value += 1
  assert.equal(reactiveWindow.content.text, 'recovered')
})

test('Portal moves children between native hosts', () => {
  const nativeRenderer = renderer()
  const window = new FakeWindow()
  const first = new FakePanel()
  const second = new FakePanel()
  const target = signal(first)

  const handle = nativeRenderer.render(
    jsx(UI.Panel, {
      children: jsx(Portal, {
        mount: target,
        children: jsx(UI.TextBlock, { text: 'Overlay' }),
      }),
    }),
    window,
  )

  assert.equal(window.content.children.length, 0)
  assert.equal(first.children.getAt(0).text, 'Overlay')

  target.value = second
  assert.equal(first.children.length, 0)
  assert.equal(second.children.getAt(0).text, 'Overlay')

  target.value = null
  assert.equal(second.children.length, 0)
  handle.dispose()
})

test('VirtualFor renders a bounded overscanned window', () => {
  const nativeRenderer = renderer()
  const window = new FakeWindow()
  const start = signal(10)
  const items = Array.from({ length: 100 }, (_, id) => ({ id }))

  nativeRenderer.render(
    jsx(UI.Panel, {
      children: jsx(VirtualFor, {
        each: items,
        start,
        count: 3,
        overscan: 1,
        itemSize: 20,
        key: (item) => item.id,
        renderSpacer: (size, position) =>
          jsx(UI.TextBlock, { text: `${position}:${size}` }),
        children: (item, index) =>
          jsx(UI.TextBlock, {
            text: computed(() => `${index.value}:${item.id}`),
          }),
      }),
    }),
    window,
  )

  const panel = window.content
  assert.deepEqual(
    panel.children.toArray().map((item) => item.text),
    ['before:180', '9:9', '10:10', '11:11', '12:12', '13:13', 'after:1720'],
  )

  const overlap = panel.children.getAt(3)
  start.value = 12
  assert.equal(panel.children.getAt(0).text, 'before:220')
  assert.equal(panel.children.getAt(1), overlap)
  assert.equal(panel.children.length, 7)
})

test('renderer diagnostics return to zero after disposal', () => {
  const nativeRenderer = renderer()
  const window = new FakeWindow()
  const handle = nativeRenderer.render(
    jsx(UI.Panel, {
      children: [
        jsx(UI.TextBlock, { text: 'One' }),
        jsx(UI.Button, { children: 'Two' }),
      ],
    }),
    window,
  )

  assert.equal(nativeRenderer.diagnostics.activeNative, 3)
  handle.dispose()
  assert.equal(nativeRenderer.diagnostics.activeNative, 0)
  assert.equal(nativeRenderer.diagnostics.activeComponents, 0)
})

test('keyed lists preserve identity under large reorder and repeated disposal', () => {
  const nativeRenderer = renderer()
  const panel = new FakePanel()
  const original = Array.from({ length: 1_000 }, (_, id) => ({
    id,
    label: `Item ${id}`,
  }))
  const items = signal(original)
  const handle = nativeRenderer.render(
    jsx(For, {
      each: items,
      key: (item) => item.id,
      children: (item, index) =>
        jsx(UI.TextBlock, {
          text: computed(() => `${index.value}:${item.label}`),
        }),
    }),
    panel,
  )

  assert.equal(panel.children.size, 1_000)
  const identities = new Map(
    original.map((item, index) => [
      item.id,
      panel.children.getAt(index),
    ]),
  )

  items.value = [...original].reverse()
  assert.equal(panel.children.getAt(0), identities.get(999))
  assert.equal(panel.children.getAt(0).text, '0:Item 999')
  assert.equal(panel.children.getAt(999), identities.get(0))

  items.value = items.value.filter((item) => item.id % 2 === 0)
  assert.equal(panel.children.size, 500)
  assert.equal(panel.children.getAt(0), identities.get(998))
  assert.equal(panel.children.getAt(499), identities.get(0))

  handle.dispose()
  handle.dispose()
  assert.equal(panel.children.size, 0)
  assert.equal(nativeRenderer.diagnostics.activeNative, 0)
})

test('duplicate list keys fail before mutating the native collection', () => {
  const nativeRenderer = renderer()
  const panel = new FakePanel()
  const first = { id: 1, label: 'First' }
  const second = { id: 2, label: 'Second' }
  const items = signal([first, second])
  const handle = nativeRenderer.render(
    jsx(For, {
      each: items,
      key: (item) => item.id,
      children: (item) =>
        jsx(UI.TextBlock, { text: item.label }),
    }),
    panel,
  )
  const firstControl = panel.children.getAt(0)
  const secondControl = panel.children.getAt(1)

  assert.throws(
    () => {
      items.value = [first, first]
    },
    /Duplicate For key: 1/,
  )
  assert.equal(panel.children.getAt(0), firstControl)
  assert.equal(panel.children.getAt(1), secondControl)

  items.value = [second, first]
  assert.equal(panel.children.getAt(0), secondControl)
  assert.equal(panel.children.getAt(1), firstControl)
  handle.dispose()
})
