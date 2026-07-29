'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createControls,
  createProjectedOwnership,
  createProjectedValueOwner,
  createRenderer,
  ownProjectedValue,
} = require('../dist/index.js')
const { jsx } = require('../dist/jsx-runtime.js')
const {
  FakeTextBlock,
  FakeWindow,
} = require('./fakes')

test('projected owners are idempotent and retry failures', () => {
  const value = {}
  let attempts = 0
  const owner = createProjectedValueOwner(value, () => {
    attempts += 1
    if (attempts === 1) {
      throw new Error('release failed')
    }
  })

  assert.equal(owner.value, value)
  assert.throws(() => owner.dispose(), /release failed/)
  assert.equal(owner.disposed, false)
  owner.dispose()
  owner.dispose()
  assert.equal(owner.disposed, true)
  assert.equal(attempts, 2)
})

test('projected owners reject asynchronous release', () => {
  const owner = createProjectedValueOwner(
    {},
    () => Promise.resolve(),
  )
  assert.throws(
    () => owner.dispose(),
    /must be synchronous/,
  )
  assert.equal(owner.disposed, false)
  assert.throws(
    () => owner.dispose(),
    /must be synchronous/,
  )
})

test('owned projected values release with component scope', () => {
  const UI = createControls({
    TextBlock: FakeTextBlock,
  })
  const released = []
  const projected = {}
  function App() {
    const value = ownProjectedValue(
      projected,
      (current) => released.push(current),
    )
    assert.equal(value, projected)
    return jsx(UI.TextBlock, { text: 'Owned' })
  }
  const renderer = createRenderer()
  const handle = renderer.render(
    jsx(App, {}),
    new FakeWindow(),
  )

  handle.dispose()
  handle.dispose()

  assert.deepEqual(released, [projected])
})

test('bound projected ownership creates and releases values', () => {
  const released = []
  const ownership = createProjectedOwnership(
    (value) => released.push(value),
  )
  const value = {}
  const owner =
    ownership.createProjectedOwner(value)

  owner.dispose()
  assert.deepEqual(released, [value])
})

test('scoped ownership releases when no scope is active', () => {
  const released = []
  const ownership = createProjectedOwnership(
    (value) => released.push(value),
  )
  const value = {}

  assert.throws(
    () => ownership.ownProjected(value),
    /onCleanup\(\) must be called/,
  )
  assert.deepEqual(released, [value])
})
