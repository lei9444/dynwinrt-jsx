'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createCompositionOwner,
  createNativeResourceOwner,
  createRoot,
} = require('../dist')

test('native resource owners release in reverse order', () => {
  const order = []
  const owner = createNativeResourceOwner({
    releaseProjected(value) {
      order.push(`projected:${value.name}`)
    },
  })
  const projected = owner.ownProjected({
    name: 'projected',
  })
  owner.ownCloseable({
    close() {
      order.push('close')
    },
  })
  owner.ownDisposable({
    dispose() {
      order.push('dispose')
    },
  })
  owner.defer(() => {
    order.push('defer')
  })

  owner.release(projected)
  assert.deepEqual(order, ['projected:projected'])
  owner.dispose()
  assert.deepEqual(order, [
    'projected:projected',
    'defer',
    'dispose',
    'close',
  ])
  assert.equal(owner.disposed, true)
})

test('native resource cleanup retries only failed entries', () => {
  let firstAttempts = 0
  let secondAttempts = 0
  const owner = createNativeResourceOwner()
  owner.defer(() => {
    firstAttempts += 1
    if (firstAttempts === 1) {
      throw new Error('first failed')
    }
  })
  owner.defer(() => {
    secondAttempts += 1
  })

  assert.throws(() => owner.dispose(), /first failed/)
  assert.equal(owner.disposed, false)
  assert.equal(firstAttempts, 1)
  assert.equal(secondAttempts, 1)

  owner.dispose()
  assert.equal(owner.disposed, true)
  assert.equal(firstAttempts, 2)
  assert.equal(secondAttempts, 1)
})

test('scoped native resource owners dispose with their root', () => {
  let closes = 0
  let dispose

  createRoot((rootDispose) => {
    dispose = rootDispose
    createNativeResourceOwner().ownCloseable({
      close() {
        closes += 1
      },
    })
  })

  dispose()
  assert.equal(closes, 1)
})

test('composition owners stop animations before releasing resources', () => {
  const order = []
  const owner = createCompositionOwner({
    releaseProjected(value) {
      order.push(`release:${value.name}`)
    },
  })
  const animation = owner.ownProjected({
    name: 'animation',
  })
  const target = {
    startAnimation(value) {
      order.push(`start:${value.name}`)
    },
    stopAnimation(value) {
      order.push(`stop:${value.name}`)
    },
  }

  owner.start(target, animation)
  owner.dispose()
  assert.deepEqual(order, [
    'start:animation',
    'stop:animation',
    'release:animation',
  ])
})

test('composition owners replace property animations', () => {
  const order = []
  const owner = createCompositionOwner()
  const target = {
    startAnimation(property, animation) {
      order.push(`start:${property}:${animation.name}`)
    },
    stopAnimation(property) {
      order.push(`stop:${property}`)
    },
  }

  owner.startProperty(target, 'Opacity', { name: 'first' })
  owner.startProperty(target, 'Opacity', { name: 'second' })
  owner.dispose()

  assert.deepEqual(order, [
    'start:Opacity:first',
    'stop:Opacity',
    'start:Opacity:second',
    'stop:Opacity',
  ])
})

test('composition owners stop a target before native release', () => {
  const order = []
  const owner = createCompositionOwner({
    releaseProjected(value) {
      order.push(`release:${value.name}`)
    },
  })
  const animation = owner.ownProjected({
    name: 'animation',
  })
  const target = {
    startAnimation(value) {
      order.push(`start:${value.name}`)
    },
    stopAnimation(value) {
      order.push(`stop:${value.name}`)
    },
  }

  owner.start(target, animation)
  owner.stopAll(target)
  order.push('native-release')
  owner.dispose()

  assert.deepEqual(order, [
    'start:animation',
    'stop:animation',
    'native-release',
    'release:animation',
  ])
})
