'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createAppNotificationOwner,
} = require('../dist/app-notification-owner.js')

function createHarness() {
  const order = []
  let invoked
  let removeFailure = true
  let unregisterFailure = true
  const manager = {
    setting: 0,
    onNotificationInvoked(callback) {
      invoked = callback
      order.push('attach')
      return () => {
        order.push('detach')
        invoked = undefined
      }
    },
    register() {
      order.push('register')
    },
    show(notification) {
      order.push(`show:${notification.tag}`)
    },
    async getAllAsync() {
      return { toArray: () => [] }
    },
    async removeByTagAndGroupAsync(tag) {
      order.push(`remove:${tag}`)
      if (tag === 'first' && removeFailure) {
        removeFailure = false
        throw new Error('first removal failed')
      }
    },
    unregister() {
      order.push('unregister')
      if (unregisterFailure) {
        unregisterFailure = false
        throw new Error('unregister failed')
      }
    },
  }
  return {
    order,
    manager,
    invoke(args) {
      invoked?.(manager, args)
    },
  }
}

test('notification cleanup continues and retries incomplete work', async () => {
  const harness = createHarness()
  const owner = createAppNotificationOwner({
    group: 'test-group',
    getManager: () => harness.manager,
  })
  owner.register((manager) => manager.register())
  owner.show({}, 'first')
  owner.show({}, 'second')

  await assert.rejects(
    owner.releaseRegistration(),
    /first removal failed/,
  )
  assert.deepEqual(harness.order.slice(-4), [
    'remove:first',
    'remove:second',
    'unregister',
    'detach',
  ])
  assert.equal(owner.registered, true)
  assert.match(owner.cleanupFailure.message, /first removal failed/)

  await owner.releaseRegistration()
  assert.deepEqual(harness.order.slice(-2), [
    'remove:first',
    'unregister',
  ])
  assert.equal(owner.registered, false)
  assert.equal(owner.cleanupFailure, undefined)
})

test('page notification leases release synchronously', async () => {
  const harness = createHarness()
  const owner = createAppNotificationOwner({
    getManager: () => harness.manager,
  })
  let invocations = 0
  const lease = owner.acquire(() => {
    invocations += 1
  })
  owner.register((manager) => manager.register())
  harness.invoke({ argument: 'before' })
  lease.dispose()
  harness.invoke({ argument: 'after' })
  assert.equal(invocations, 1)

  harness.manager.unregister = () => {
    harness.order.push('unregister')
  }
  await owner.dispose()
  assert.equal(harness.order.at(-1), 'detach')
})
