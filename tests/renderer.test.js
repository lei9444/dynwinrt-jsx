'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  For,
  Show,
  computed,
  createControls,
  createRenderer,
  onCleanup,
  resource,
  signal,
} = require('../dist')
const { jsx, jsxs } = require('../dist/jsx-runtime')
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
