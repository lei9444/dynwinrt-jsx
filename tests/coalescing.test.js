'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createCompositionFrameScheduler,
  createLastValueCoalescer,
  createRoot,
  createScopedLastValueCoalescer,
} = require('../dist')

function createScheduler() {
  const entries = []
  return {
    entries,
    schedule(callback) {
      const entry = {
        active: true,
        callback,
      }
      entries.push(entry)
      return () => {
        entry.active = false
      }
    },
    runNext() {
      const entry = entries.find((value) => value.active)
      if (!entry) {
        return false
      }
      entry.active = false
      entry.callback()
      return true
    },
  }
}

test('last-value coalescers deliver one latest value per schedule', () => {
  const scheduler = createScheduler()
  const values = []
  const coalescer = createLastValueCoalescer(
    scheduler.schedule,
    (value) => values.push(value),
  )

  coalescer.push(1)
  coalescer.push(2)
  coalescer.push(3)
  assert.equal(coalescer.pending, true)
  assert.equal(scheduler.entries.length, 1)

  scheduler.runNext()
  assert.deepEqual(values, [3])
  assert.equal(coalescer.pending, false)

  coalescer.push(4)
  coalescer.cancel()
  scheduler.runNext()
  assert.deepEqual(values, [3])

  coalescer.push(5)
  scheduler.runNext()
  assert.deepEqual(values, [3, 5])

  coalescer.dispose()
  coalescer.push(6)
  assert.deepEqual(values, [3, 5])
})

test('scoped coalescers cancel pending delivery on cleanup', () => {
  const scheduler = createScheduler()
  const values = []
  let dispose

  createRoot((rootDispose) => {
    dispose = rootDispose
    const coalescer = createScopedLastValueCoalescer(
      scheduler.schedule,
      (value) => values.push(value),
    )
    coalescer.push('pending')
  })

  dispose()
  scheduler.runNext()
  assert.deepEqual(values, [])
})

test('composition frame schedulers unsubscribe after one frame', () => {
  const handlers = new Map()
  let nextToken = 1
  const schedule = createCompositionFrameScheduler({
    add_Rendering(callback) {
      const token = nextToken++
      handlers.set(token, callback)
      return token
    },
    remove_Rendering(token) {
      handlers.delete(token)
    },
  })
  let calls = 0
  const cancel = schedule(() => {
    calls += 1
  })
  const handler = [...handlers.values()][0]

  handler()
  assert.equal(calls, 1)
  assert.equal(handlers.size, 0)

  cancel()
  assert.equal(handlers.size, 0)
})
