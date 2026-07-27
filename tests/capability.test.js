'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  capabilityAvailable,
  capabilityUnavailable,
  createCapabilityOwner,
  mapCapability,
} = require('../dist/index.js')

test('capability values preserve explicit availability state', () => {
  const available = capabilityAvailable(
    { name: 'camera' },
    { source: 'device' },
  )
  const unavailable = capabilityUnavailable(
    'Camera access denied.',
    { source: 'permission' },
  )

  assert.deepEqual(available, {
    available: true,
    value: { name: 'camera' },
    details: { source: 'device' },
  })
  assert.deepEqual(unavailable, {
    available: false,
    reason: 'Camera access denied.',
    details: { source: 'permission' },
  })
})

test('unavailable capabilities require a reason', () => {
  assert.throws(
    () => capabilityUnavailable('   '),
    /non-empty reason/,
  )
})

test('mapCapability maps values and preserves failures', () => {
  const available = mapCapability(
    capabilityAvailable(2, 'count'),
    (value) => value * 3,
  )
  const unavailable = capabilityUnavailable(
    'Service unavailable.',
    'service',
  )

  assert.deepEqual(available, {
    available: true,
    value: 6,
    details: 'count',
  })
  assert.equal(
    mapCapability(unavailable, () => 1),
    unavailable,
  )
})

test('CapabilityOwner disposes available resources once', () => {
  const released = []
  const owner = createCapabilityOwner(
    capabilityAvailable({ id: 7 }),
    (value) => released.push(value.id),
  )

  owner.dispose()
  owner.dispose()

  assert.equal(owner.disposed, true)
  assert.deepEqual(released, [7])
})

test('CapabilityOwner requires cleanup for available resources', () => {
  assert.throws(
    () => createCapabilityOwner(
      capabilityAvailable({ close() {} }),
    ),
    /require an owned cleanup callback/,
  )
})

test('CapabilityOwner cleanup failure remains retryable', () => {
  let attempts = 0
  const owner = createCapabilityOwner(
    capabilityAvailable('camera'),
    () => {
      attempts += 1
      if (attempts === 1) {
        throw new Error('cleanup failed')
      }
    },
  )

  assert.throws(() => owner.dispose(), /cleanup failed/)
  assert.equal(owner.disposed, false)
  owner.dispose()
  assert.equal(owner.disposed, true)
  assert.equal(attempts, 2)
})

test('CapabilityOwner rejects asynchronous cleanup', async () => {
  const owner = createCapabilityOwner(
    capabilityAvailable('camera'),
    async () => {
      throw new Error('async cleanup failed')
    },
  )

  assert.throws(
    () => owner.dispose(),
    /must be synchronous/,
  )
  await Promise.resolve()
  assert.equal(owner.disposed, false)
})

test('CapabilityOwner ignores reentrant disposal', () => {
  let attempts = 0
  let owner
  owner = createCapabilityOwner(
    capabilityAvailable('island'),
    () => {
      attempts += 1
      owner.dispose()
    },
  )

  owner.dispose()

  assert.equal(attempts, 1)
  assert.equal(owner.disposed, true)
})

test('CapabilityOwner accepts unavailable capability values', () => {
  const owner = createCapabilityOwner(
    capabilityUnavailable('No package identity.'),
  )

  owner.dispose()

  assert.equal(owner.disposed, true)
})
