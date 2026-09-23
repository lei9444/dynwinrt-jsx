'use strict'

const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const test = require('node:test')

const {
  batch,
  computed,
  createRoot,
  createScope,
  effect,
  onCleanup,
  onMount,
  runInScope,
  signal,
} = require('../dist')
const {
  flushScopeMounts,
  inspectReactiveScopes,
} = require('../dist/core/reactive')

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

test('scope inspection stays stable after owned work is removed', () => {
  const scope = createScope()
  const source = signal(0)
  let child
  let disposeCleanup
  let disposeEffect
  let unsubscribe

  runInScope(scope, () => {
    child = createScope()
    disposeCleanup = onCleanup(() => {})
    disposeEffect = effect(() => {
      source.value
    })
    unsubscribe = source.subscribe(() => {})
    onMount(() => {})
  })

  disposeCleanup()
  disposeEffect()
  unsubscribe()
  child.dispose()
  flushScopeMounts(scope)

  const inspection = inspectReactiveScopes([scope])
  assert.equal(inspection.scopes.length, 1)
  assert.deepEqual(inspection.scopes[0].childIds, [])
  assert.deepEqual(inspection.scopes[0].observerIds, [])
  assert.deepEqual(inspection.scopes[0].dependencyIds, [])
  assert.equal(inspection.scopes[0].cleanupCount, 0)
  assert.equal(inspection.scopes[0].pendingMountCount, 0)

  scope.dispose()
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

test('throwing effect cleanup still detaches dependencies', () => {
  const source = signal(0)
  let runs = 0
  const dispose = effect(() => {
    source.value
    runs += 1
    return () => {
      throw new Error('cleanup failed')
    }
  })

  assert.throws(dispose, /cleanup failed/)
  source.value = 1
  assert.equal(runs, 1)
})

test('scheduler drains pending work after errors and remains reusable', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict')
    const {
      afterReactiveFlush, batch, computed, createRoot, effect, signal,
    } = require(${JSON.stringify(require.resolve('../dist/core/reactive'))})

    for (const kind of ['computed', 'effect', 'cleanup', 'afterFlush']) {
      createRoot((dispose) => {
        const source = signal(0)
        const firstError = new Error(kind + ' failed')
        const laterError = new Error('later failure')
        const values = []
        const recoveredValues = []
        const fail = () => {
          if (source.value === 1) throw firstError
          recoveredValues.push(source.value)
          return source.value
        }
        if (kind === 'computed') computed(fail)
        if (kind === 'effect') effect(fail)
        if (kind === 'cleanup') {
          effect(() => {
            const previous = source.value
            recoveredValues.push(previous)
            return () => {
              if (previous === 0) throw firstError
            }
          })
        }
        const doubled = computed(() => source.value * 2)
        effect(() => values.push(doubled.value))
        effect(() => {
          if (source.value === 1 && kind !== 'afterFlush') {
            throw laterError
          }
        })
        let flushed = 0

        assert.throws(() => batch(() => {
          if (kind === 'afterFlush') {
            afterReactiveFlush(() => {
              source.value = 1
              throw firstError
            })
          } else {
            source.value = 1
          }
          afterReactiveFlush(() => { flushed += 1 })
        }), (error) => error === firstError)

        assert.deepEqual(values, [0, 2])
        assert.equal(flushed, 1)
        source.value = 2
        assert.deepEqual(values, [0, 2, 4])
        if (kind !== 'afterFlush') {
          assert.deepEqual(recoveredValues, [0, 2])
        }
        dispose()
      })
    }
  `], {
    encoding: 'utf8',
    timeout: 10_000,
  })

  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
})

test('batched observer queues do not repeatedly scan pending observers', () => {
  const count = 512
  createRoot((dispose) => {
    const sources = Array.from({ length: count }, () => signal(0))
    const values = []
    for (const source of sources) {
      const doubled = computed(() => source.value * 2)
      effect(() => {
        if (doubled.value !== 0) values.push(doubled.value)
      })
    }

    const originalIterator = Set.prototype[Symbol.iterator]
    const originalValues = Set.prototype.values
    let visited = 0
    const countedValues = function* () {
      for (const value of originalValues.call(this)) {
        visited += 1
        yield value
      }
    }
    try {
      Set.prototype[Symbol.iterator] = countedValues
      Set.prototype.values = countedValues
      batch(() => {
        for (const source of sources) source.value = 1
      })
    }
    finally {
      Set.prototype[Symbol.iterator] = originalIterator
      Set.prototype.values = originalValues
    }

    assert.equal(values.length, count)
    assert.ok(values.every((value) => value === 2))
    assert.ok(visited < count * 20, `Visited ${visited} Set entries`)
    dispose()
  })
})

test('queued effects can dispose and reschedule later work without losing order', () => {
  createRoot((dispose) => {
    const first = signal(0)
    const second = signal(0)
    const values = []
    let stopLast = () => {}
    effect(() => {
      if (first.value === 1) {
        stopLast()
        second.value = second.peek() + 1
      }
    })
    effect(() => { values.push(`second:${second.value}`) })
    stopLast = effect(() => { values.push(`last:${first.value}`) })
    values.length = 0

    batch(() => {
      first.value = 1
      second.value = 1
    })

    assert.deepEqual(values, ['second:2'])
    dispose()
  })
})
