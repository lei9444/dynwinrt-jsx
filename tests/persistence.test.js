'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  createJsonStateStore,
} = require('../dist/index.js')

function createStore(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'dynwinrt-state-'),
  )
  t.after(() => {
    fs.rmSync(directory, { recursive: true, force: true })
  })
  return createJsonStateStore({
    path: path.join(directory, 'state.json'),
    defaultState: () => ({ version: 1, count: 0 }),
    validate(value) {
      return (
        typeof value === 'object' &&
        value !== null &&
        value.version === 1 &&
        Number.isInteger(value.count) &&
        value.count >= 0
      )
    },
  })
}

test('JSON state store atomically saves and restores state', (t) => {
  const store = createStore(t)
  assert.deepEqual(store.load(), {
    state: { version: 1, count: 0 },
    recovered: false,
    error: null,
    corruptPath: null,
  })

  store.save({ version: 1, count: 4 })
  assert.deepEqual(store.load().state, {
    version: 1,
    count: 4,
  })
  assert.equal(
    fs.readdirSync(path.dirname(store.path))
      .some((name) => name.endsWith('.tmp')),
    false,
  )
})

test('JSON state store preserves invalid data and reports recovery', (t) => {
  const store = createStore(t)
  fs.mkdirSync(path.dirname(store.path), { recursive: true })
  fs.writeFileSync(store.path, '{"version":2,"count":"bad"}')

  const result = store.load()
  assert.deepEqual(result.state, { version: 1, count: 0 })
  assert.equal(result.recovered, true)
  assert.match(result.error, /schema validation/)
  assert.notEqual(result.corruptPath, null)
  assert.equal(fs.existsSync(result.corruptPath), true)
  assert.equal(fs.existsSync(store.path), false)
})

test('JSON state store rejects invalid writes', (t) => {
  const store = createStore(t)
  assert.throws(
    () => store.save({ version: 1, count: -1 }),
    /fails validation/,
  )
  assert.equal(fs.existsSync(store.path), false)
})

test('JSON state store never renames unreadable paths', (t) => {
  const store = createStore(t)
  fs.mkdirSync(store.path, { recursive: true })

  const result = store.load()
  assert.equal(result.recovered, true)
  assert.match(result.error, /Failed to read persisted state/)
  assert.equal(result.corruptPath, null)
  assert.equal(fs.statSync(store.path).isDirectory(), true)
})
