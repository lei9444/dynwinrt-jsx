'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

test('progressive API entrypoints expose the recommended layers', () => {
  const entrypoints = {
    core: require('dynwinrt-jsx/core'),
    controls: require('dynwinrt-jsx/controls'),
    winui: require('dynwinrt-jsx/winui'),
    native: require('dynwinrt-jsx/native'),
    diagnostics: require('dynwinrt-jsx/diagnostics'),
  }

  assert.equal(typeof entrypoints.core.signal, 'function')
  assert.equal(typeof entrypoints.core.For, 'function')
  assert.equal(
    typeof entrypoints.controls.createControls,
    'function',
  )
  assert.equal(
    typeof entrypoints.controls.createWinUIControls,
    'function',
  )
  assert.equal(
    typeof entrypoints.controls.createListViewControl,
    'function',
  )
  assert.equal(typeof entrypoints.winui.thickness, 'function')
  assert.equal(typeof entrypoints.winui.styles, 'object')
  assert.equal(typeof entrypoints.native.createRenderer, 'function')
  assert.equal(typeof entrypoints.native.adapter, 'object')
  assert.equal(
    typeof entrypoints.diagnostics.createDiagnosticChannel,
    'function',
  )

  for (const name of Object.keys(entrypoints)) {
    assert.equal(
      require.resolve(`dynwinrt-jsx/${name}`),
      require.resolve(`../dist/${name}.js`),
    )
  }
})

test('core entrypoint does not load the compatibility root', () => {
  const rootPath = require.resolve('../dist/index.js')
  const corePath = require.resolve('../dist/core.js')
  const rendererPath = require.resolve(
    '../dist/renderer/renderer.js',
  )
  delete require.cache[rootPath]
  delete require.cache[corePath]
  delete require.cache[rendererPath]

  require('dynwinrt-jsx/core')

  assert.equal(require.cache[rootPath], undefined)
  assert.equal(require.cache[rendererPath], undefined)
})

test('WinUI controls resolve generated constructors lazily', async () => {
  const {
    createWinUIControls,
  } = require('dynwinrt-jsx/controls')
  let reads = 0
  class TestButton {}
  const bindings = {
    get Button() {
      reads += 1
      return TestButton
    },
    NotAControl: 1,
  }

  const UI = createWinUIControls(bindings)

  assert.equal(reads, 0)
  assert.equal(UI.Button.displayName, 'Button')
  assert.equal(reads, 1)
  assert.equal(UI.Button.displayName, 'Button')
  assert.equal(reads, 1)
  assert.equal(await Promise.resolve(UI), UI)
  assert.equal(String(UI), '[object Object]')
  assert.equal(UI.Missing, undefined)
  assert.throws(
    () => UI.NotAControl,
    /is not a native constructor/,
  )
})
