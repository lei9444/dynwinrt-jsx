'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { ComputedQueue } = require('../dist/core/observer-queue')

test('computed queue preserves depth and insertion order through arbitrary removal', () => {
  const queue = new ComputedQueue()
  const values = Array.from({ length: 64 }, (_, id) => ({
    id,
    depth: id % 7,
  }))
  const expected = new Map()
  let order = 0
  let seed = 42
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed
  }
  const takeExpected = () => {
    const next = [...expected.keys()].sort((left, right) =>
      left.depth - right.depth || expected.get(left) - expected.get(right),
    )[0]
    expected.delete(next)
    return next
  }

  for (let step = 0; step < 4_000; step += 1) {
    const value = values[random() % values.length]
    switch (random() % 3) {
      case 0:
        if (!expected.has(value)) {
          value.depth = random() % 16
          expected.set(value, order++)
        }
        queue.add(value)
        break
      case 1:
        assert.equal(queue.delete(value), expected.delete(value))
        break
      case 2:
        assert.equal(queue.take(), takeExpected())
        break
    }
    assert.equal(queue.size, expected.size)
    assert.equal(queue.has(value), expected.has(value))
  }
  while (expected.size > 0) {
    assert.equal(queue.take(), takeExpected())
  }
  assert.equal(queue.take(), undefined)
  assert.equal(queue.size, 0)
})

test('computed queue avoids quadratic priority comparisons', () => {
  const queue = new ComputedQueue()
  const count = 1_024
  let reads = 0
  for (let depth = count; depth > 0; depth -= 1) {
    queue.add({
      get depth() {
        reads += 1
        return depth
      },
    })
  }
  for (let depth = 1; depth <= count; depth += 1) {
    assert.equal(queue.take().depth, depth)
  }
  assert.ok(reads < count * 100, `Read ${reads} priorities`)
})
