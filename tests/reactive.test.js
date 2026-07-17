'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  batch,
  computed,
  createRoot,
  createScope,
  effect,
  onCleanup,
  runInScope,
  signal,
} = require('../dist')

test('signals update effects and computed values', () => {
  const count = signal(2)
  const doubled = computed(() => count.value * 2)
  const values = []

  const dispose = effect(() => {
    values.push(doubled.value)
  })

  assert.deepEqual(values, [4])

  count.value = 3
  assert.deepEqual(values, [4, 6])

  batch(() => {
    count.value = 4
    count.value = 5
  })
  assert.deepEqual(values, [4, 6, 10])

  dispose()
  count.value = 6
  assert.deepEqual(values, [4, 6, 10])
})

test('signal subscriptions can be removed', () => {
  const value = signal('initial')
  const changes = []
  const unsubscribe = value.subscribe((next, previous) => {
    changes.push([previous, next])
  })

  value.value = 'next'
  unsubscribe()
  value.value = 'ignored'

  assert.deepEqual(changes, [['initial', 'next']])
})

test('effect and scope cleanups run exactly once', () => {
  const scope = createScope()
  const value = signal(0)
  let effectCleanups = 0
  let scopeCleanups = 0

  const disposeEffect = runInScope(scope, () => {
    onCleanup(() => {
      scopeCleanups += 1
    })

    return effect(() => {
      value.value
      return () => {
        effectCleanups += 1
      }
    })
  })

  value.value = 1
  assert.equal(effectCleanups, 1)

  disposeEffect()
  disposeEffect()
  scope.dispose()
  scope.dispose()

  assert.equal(effectCleanups, 2)
  assert.equal(scopeCleanups, 1)
})

test('subscriptions created in a scope are removed with it', () => {
  const scope = createScope()
  const value = signal(0)
  const changes = []

  runInScope(scope, () => {
    value.subscribe((next) => {
      changes.push(next)
    })
  })

  value.value = 1
  scope.dispose()
  value.value = 2

  assert.deepEqual(changes, [1])
})

test('effects observe a consistent computed graph', () => {
  const source = signal(1)
  const doubled = computed(() => source.value * 2)
  const summary = computed(() => source.value + doubled.value)
  const values = []

  effect(() => {
    values.push([source.value, doubled.value, summary.value])
  })

  source.value = 2

  assert.deepEqual(values, [
    [1, 2, 3],
    [2, 4, 6],
  ])
})

test('computed subscribers receive one settled mixed-depth value', () => {
  const source = signal(1)
  const plusOne = computed(() => source.value + 1)
  const timesTen = computed(() => source.value * 10)
  const combined = computed(() => plusOne.value + timesTen.value)
  let computeCount = 0
  const summary = computed(() => {
    computeCount += 1
    return source.value + combined.value
  })
  const values = []
  summary.subscribe((value) => values.push(value))
  computeCount = 0

  source.value = 2

  assert.deepEqual(values, [25])
  assert.equal(computeCount, 1)
})

test('computed values settle when switching to a pending deeper branch', () => {
  const source = signal(1)
  const useDeep = signal(false)
  let deep
  const selected = computed(() =>
    useDeep.value ? deep.value : source.value,
  )
  const doubled = computed(() => source.value * 2)
  deep = computed(() => doubled.value + 1)
  const values = []
  selected.subscribe((value) => values.push(value))

  batch(() => {
    source.value = 2
    useDeep.value = true
  })

  assert.deepEqual(values, [5])
})

test('self-updating effects settle synchronously', () => {
  const value = signal(0)
  const values = []

  effect(() => {
    values.push(value.value)
    if (value.value < 3) {
      value.value += 1
    }
  })

  assert.deepEqual(values, [0, 1, 2, 3])
})

test('createRoot owns reactive cleanup', () => {
  const source = signal(0)
  const values = []
  let dispose

  createRoot((rootDispose) => {
    dispose = rootDispose
    effect(() => {
      values.push(source.value)
    })
  })

  source.value = 1
  dispose()
  source.value = 2

  assert.deepEqual(values, [0, 1])
})
