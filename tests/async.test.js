'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  AsyncView,
  ErrorBoundary,
  createControls,
  createAsyncAction,
  createRenderer,
  createRoot,
} = require('../dist')
const { jsx } = require('../dist/jsx-runtime')
const {
  FakeTextBlock,
  FakeWindow,
} = require('./fakes')

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolveValue, rejectValue) => {
    resolve = resolveValue
    reject = rejectValue
  })
  return { promise, resolve, reject }
}

async function settle() {
  await Promise.resolve()
  await Promise.resolve()
}

test('async actions expose pending and successful state', async () => {
  const pending = deferred()
  const action = createAsyncAction(
    async (input) => {
      await pending.promise
      return input * 2
    },
  )

  action.run(3)
  assert.equal(action.status.value, 'pending')
  assert.equal(action.pending.value, true)

  pending.resolve()
  await settle()
  assert.equal(action.status.value, 'success')
  assert.equal(action.pending.value, false)
  assert.equal(action.value.value, 6)
})

test('drop concurrency ignores duplicate pending runs', async () => {
  const pending = deferred()
  let calls = 0
  const action = createAsyncAction(
    async (input) => {
      calls += 1
      await pending.promise
      return input
    },
  )

  action.run('first')
  action.run('ignored')
  assert.equal(calls, 1)

  pending.resolve()
  await settle()
  assert.equal(action.value.value, 'first')
})

test('async action context exposes abort checks', () => {
  let context
  const action = createAsyncAction(
    (_input, operationContext) => {
      context = operationContext
      context.throwIfAborted()
      return new Promise(() => {})
    },
  )

  action.run()
  action.cancel()

  assert.throws(
    () => context.throwIfAborted(),
    { name: 'AbortError' },
  )
})

test('replace concurrency aborts and releases stale work', async () => {
  const operations = new Map()
  const released = []
  const signals = []
  const action = createAsyncAction(
    (input, { signal, scope }) => {
      signals.push(signal)
      const pending = deferred()
      operations.set(input, pending)
      scope.own(
        { label: `owned:${input}` },
        (value) => released.push(value.label),
      )
      return pending.promise
    },
    {
      concurrency: 'replace',
      dispose(value) {
        released.push(`value:${value}`)
      },
    },
  )

  action.run('first')
  action.run('second')
  assert.equal(signals[0].aborted, true)
  assert.deepEqual(released, ['owned:first'])

  operations.get('first').resolve('stale')
  operations.get('second').resolve('current')
  await settle()

  assert.equal(action.value.value, 'current')
  assert.deepEqual(released, [
    'owned:first',
    'value:stale',
  ])

  action.dispose()
  assert.deepEqual(released, [
    'owned:first',
    'value:stale',
    'value:current',
    'owned:second',
  ])
})

test('operation ownership cleans up failures in reverse order', async () => {
  const order = []
  const action = createAsyncAction(
    async (_input, { scope }) => {
      scope.own(
        { label: 'first' },
        (value) => order.push(value.label),
      )
      scope.own(
        { label: 'second' },
        (value) => order.push(value.label),
      )
      throw new Error('failed')
    },
  )

  action.run()
  await settle()

  assert.equal(action.status.value, 'error')
  assert.match(String(action.error.value), /failed/)
  assert.deepEqual(order, ['second', 'first'])
})

test('scope-owned result values dispose exactly once', async () => {
  let disposals = 0
  const action = createAsyncAction(
    async (_input, { scope }) =>
      scope.disposable({
        dispose() {
          disposals += 1
        },
      }),
  )

  action.run()
  await settle()
  action.dispose()

  assert.equal(disposals, 1)
})

test('component scopes abort actions and release late results', async () => {
  const pending = deferred()
  const released = []
  let action
  let dispose

  createRoot((rootDispose) => {
    dispose = rootDispose
    action = createAsyncAction(
      async (_input, { signal, scope }) => {
        await pending.promise
        assert.equal(signal.aborted, true)
        scope.own(
          { label: 'late-owned' },
          (value) => released.push(value.label),
        )
        return 'late'
      },
      {
        dispose(value) {
          released.push(value)
        },
      },
    )
    action.run()
  })

  dispose()
  assert.equal(action.disposed, true)
  pending.resolve()
  await settle()
  assert.deepEqual(released, ['late-owned', 'late'])
  assert.equal(action.status.value, 'disposed')
})

test('replacement cleanup failures enter the action error state', async () => {
  const action = createAsyncAction(
    async (value) => value,
    {
      concurrency: 'replace',
      dispose(value) {
        if (value === 'first') {
          throw new Error('release failed')
        }
      },
    },
  )

  action.run('first')
  await settle()
  action.run('second')
  await settle()

  assert.equal(action.value.value, 'second')
  assert.equal(action.status.value, 'error')
  assert.match(String(action.error.value), /release failed/)
})

test('stale cleanup failures use the background error callback', async () => {
  const operations = new Map()
  const errors = []
  const action = createAsyncAction(
    (input) => {
      const pending = deferred()
      operations.set(input, pending)
      return pending.promise
    },
    {
      concurrency: 'replace',
      dispose(value) {
        if (value === 'stale') {
          throw new Error('stale release failed')
        }
      },
      onError(error) {
        errors.push(error)
      },
    },
  )

  action.run('first')
  action.run('second')
  operations.get('first').resolve('stale')
  operations.get('second').resolve('current')
  await settle()

  assert.equal(action.value.value, 'current')
  assert.equal(errors.length, 1)
  assert.match(String(errors[0]), /stale release failed/)
})

test('replacement cleanup failures block the next run visibly', () => {
  const pending = deferred()
  const action = createAsyncAction(
    (_input, { scope }) => {
      scope.own({ resource: true }, () => {
        throw new Error('cancel cleanup failed')
      })
      return pending.promise
    },
    { concurrency: 'replace' },
  )

  action.run('first')
  action.run('second')

  assert.equal(action.status.value, 'error')
  assert.match(
    String(action.error.value),
    /cancel cleanup failed/,
  )
})

test('AsyncView selects state branches and rethrows unrendered errors', async () => {
  const pending = deferred()
  const action = createAsyncAction(
    async () => pending.promise,
  )
  const view = AsyncView({
    state: action,
    idle: 'idle',
    pending: 'pending',
    error: (error) => `error:${error.message}`,
    children: (value) => `value:${value}`,
  })

  assert.equal(view.read(), 'idle')
  action.run()
  assert.equal(view.read(), 'pending')
  pending.resolve('ready')
  await settle()
  assert.equal(view.read(), 'value:ready')

  const failure = createAsyncAction(async () => {
    throw new Error('visible')
  })
  const unhandled = AsyncView({
    state: failure,
    children: () => null,
  })
  failure.run()
  await settle()
  assert.throws(() => unhandled.read(), /visible/)
})

test('AsyncView errors reach the nearest ErrorBoundary', async () => {
  const UI = createControls({
    TextBlock: FakeTextBlock,
  })
  const pending = deferred()
  const action = createAsyncAction(
    async () => pending.promise,
  )
  const window = new FakeWindow()
  const handle = createRenderer().render(
    jsx(ErrorBoundary, {
      fallback(error) {
        return jsx(UI.TextBlock, {
          text: `caught:${error.message}`,
        })
      },
      children: jsx(AsyncView, {
        state: action,
        idle: jsx(UI.TextBlock, { text: 'idle' }),
        pending: jsx(UI.TextBlock, { text: 'pending' }),
        children(value) {
          return jsx(UI.TextBlock, {
            text: `value:${value}`,
          })
        },
      }),
    }),
    window,
  )

  action.run()
  assert.equal(window.content.text, 'pending')
  pending.reject(new Error('async failed'))
  await settle()
  assert.equal(window.content.text, 'caught:async failed')

  handle.dispose()
})
