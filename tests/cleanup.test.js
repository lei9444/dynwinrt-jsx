'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createWinUIAsyncCleanup,
  createWinUICleanup,
} = require('../dist/worker.js')

test('synchronous cleanup continues and retries failures', () => {
  const calls = []
  let failed = false
  const cleanup = createWinUICleanup([
    () => calls.push('first'),
    () => {
      calls.push('second')
      if (!failed) {
        failed = true
        throw new Error('retry')
      }
    },
    () => calls.push('third'),
  ])

  assert.throws(() => cleanup(), /retry/)
  cleanup()
  cleanup()

  assert.deepEqual(calls, [
    'first',
    'second',
    'third',
    'second',
  ])
})

test('synchronous cleanup rejects Promise callbacks', () => {
  const cleanup = createWinUICleanup([
    () => Promise.resolve(),
  ])

  assert.throws(
    () => cleanup(),
    /returned a Promise/,
  )
})

test('asynchronous cleanup continues and retries failures', async () => {
  const calls = []
  let failed = false
  const cleanup = createWinUIAsyncCleanup([
    async () => {
      calls.push('first')
    },
    () => {
      calls.push('second')
      if (!failed) {
        failed = true
        throw new Error('retry')
      }
    },
    async () => {
      calls.push('third')
    },
  ])

  await assert.rejects(cleanup(), /retry/)
  await cleanup()
  await cleanup()

  assert.deepEqual(calls, [
    'first',
    'second',
    'third',
    'second',
  ])
})

test('concurrent asynchronous cleanup shares one run', async () => {
  let resolve
  let calls = 0
  const cleanup = createWinUIAsyncCleanup([
    () => {
      calls += 1
      return new Promise((currentResolve) => {
        resolve = currentResolve
      })
    },
  ])

  const first = cleanup()
  const second = cleanup()
  assert.equal(first, second)
  resolve()
  await first
  assert.equal(calls, 1)
})
