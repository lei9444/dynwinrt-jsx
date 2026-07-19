'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  assertRendererIdle,
  createControls,
  createFocusTarget,
  createFontIcon,
  createHotReloadSession,
  createRenderer,
  createSymbolIcon,
  formatRendererDiagnostics,
  hasActiveRendererRecords,
  showContentDialog,
} = require('../dist/index.js')

class TestVector {
  values = []
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
    this.values.push(value)
  }
  clear() {
    this.values.length = 0
  }
}

class TestPanel {
  children = new TestVector()
}

class TestDialog {
  content = null
  xamlRoot = null
  result = 1
  closed = new Set()
  onClosed(callback) {
    this.closed.add(callback)
    return () => this.closed.delete(callback)
  }
  async showAsync() {
    assert.notEqual(this.content, null)
    for (const callback of this.closed) {
      callback()
    }
    return this.result
  }
}

class TestSymbolIcon {
  constructor(symbol) {
    this.symbol = symbol
  }
}

class TestFontIcon {
  glyph = ''
  fontFamily = null
  fontSize = 16
}

test('dialog content is scoped to the asynchronous show operation', async () => {
  const nativeRenderer = createRenderer({
    asCollection(value) {
      return value instanceof TestVector ? value : null
    },
  })
  const UI = createControls({ Panel: TestPanel })
  const dialog = new TestDialog()
  const root = { id: 'xaml-root' }
  const result = await showContentDialog(
    nativeRenderer,
    dialog,
    root,
    UI.Panel({}),
  )

  assert.equal(result, 1)
  assert.equal(dialog.xamlRoot, root)
  assert.equal(dialog.content, null)
})

test('focus targets retain refs and invoke native focus', () => {
  const calls = []
  const target = createFocusTarget(3)
  target.current = {
    focus(state) {
      calls.push(state)
      return true
    },
  }

  assert.equal(target.focus(), true)
  assert.equal(target.focus(2), true)
  target.current = null
  assert.equal(target.focus(), false)
  assert.deepEqual(calls, [3, 2])
})

test('icon helpers create validated native icon instances', () => {
  assert.equal(createSymbolIcon(TestSymbolIcon, 42).symbol, 42)
  const font = { family: 'Segoe Fluent Icons' }
  const icon = createFontIcon(TestFontIcon, '\uE10F', {
    fontFamily: font,
    fontSize: 20,
  })
  assert.equal(icon.glyph, '\uE10F')
  assert.equal(icon.fontFamily, font)
  assert.equal(icon.fontSize, 20)
  assert.throws(
    () => createFontIcon(TestFontIcon, '', {}),
    /cannot be empty/,
  )
})

test('hot reload sessions reject stale versions and render fallbacks', async () => {
  const updates = []
  const errors = []
  const handle = {
    container: {},
    roots: [],
    disposed: false,
    update(child) {
      updates.push(child)
    },
    dispose() {},
  }
  const session = createHotReloadSession(handle, {
    fallback: (error) => `failed:${error.message}`,
    onError(error, version) {
      errors.push([error.message, version])
    },
  })

  assert.equal(await session.reload(1, () => 'version-1'), true)
  assert.equal(await session.reload(1, () => 'stale'), false)
  assert.equal(
    await session.reload(2, () => {
      throw new Error('compile failed')
    }),
    false,
  )
  assert.deepEqual(updates, [
    'version-1',
    'failed:compile failed',
  ])
  assert.deepEqual(errors, [['compile failed', 2]])
  assert.equal(session.version, 2)
  session.dispose()
  await assert.rejects(
    session.reload(3, () => 'disposed'),
    /disposed hot session/,
  )
})

test('renderer diagnostic helpers report and reject active records', () => {
  const idle = {
    nativeCreated: 2,
    nativeDisposed: 2,
    activeNative: 0,
    componentsMounted: 1,
    componentsDisposed: 1,
    activeComponents: 0,
    listEntriesCreated: 3,
    listEntriesReused: 4,
  }
  assert.equal(hasActiveRendererRecords(idle), false)
  assert.doesNotThrow(() => assertRendererIdle(idle))
  assert.match(formatRendererDiagnostics(idle), /0 active/)
  assert.throws(
    () => assertRendererIdle({ ...idle, activeNative: 1 }),
    /left active records/,
  )
})
