'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createControls,
  createLazyComponent,
  createRenderer,
  onCleanup,
} = require('../dist')
const { jsx } = require('../dist/jsx-runtime')
const {
  FakeTextBlock,
  FakeWindow,
} = require('./fakes')

test('lazy components load once and return component VNodes', () => {
  let loads = 0
  const Page = (props) => props.value
  const LazyPage = createLazyComponent(() => {
    loads += 1
    return Page
  })

  assert.equal(loads, 0)
  const first = LazyPage({ value: 'first' })
  const second = LazyPage({ value: 'second' })

  assert.equal(loads, 1)
  assert.equal(first.type, Page)
  assert.equal(first.props.value, 'first')
  assert.equal(second.type, Page)
  assert.equal(second.props.value, 'second')
})

test('lazy component failures remain retryable', () => {
  let attempts = 0
  const Page = () => null
  const LazyPage = createLazyComponent(() => {
    attempts += 1
    if (attempts === 1) {
      throw new Error('load failed')
    }
    return Page
  })

  assert.throws(() => LazyPage({}), /load failed/)
  assert.equal(LazyPage({}).type, Page)
  assert.equal(attempts, 2)
})

test('lazy component loaders reject non-components', () => {
  const LazyPage = createLazyComponent(() => null)

  assert.throws(
    () => LazyPage({}),
    /must return a component function/,
  )
})

test('lazy components preserve owned component cleanup', () => {
  const UI = createControls({
    TextBlock: FakeTextBlock,
  })
  let cleanups = 0
  const LazyPage = createLazyComponent(() => () => {
    onCleanup(() => {
      cleanups += 1
    })
    return jsx(UI.TextBlock, { text: 'Lazy' })
  })
  const handle = createRenderer().render(
    jsx(LazyPage, {}),
    new FakeWindow(),
  )

  handle.dispose()
  assert.equal(cleanups, 1)
})
