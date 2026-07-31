import {
  batch,
  computed,
  registerScopedCleanup,
  signal,
  type Cleanup,
  type ReadonlySignal,
} from './reactive'
import {
  createDynamicNode,
  type Child,
} from './vnode'

export type AsyncActionStatus =
  | 'idle'
  | 'pending'
  | 'success'
  | 'error'
  | 'disposed'

export type AsyncActionConcurrency =
  | 'drop'
  | 'replace'

export interface AsyncOperationScope {
  own<Value extends object>(
    value: Value,
    release: (value: Value) => void,
  ): Value
  closeable<Value extends { close(): void }>(
    value: Value,
  ): Value
  disposable<Value extends { dispose(): void }>(
    value: Value,
  ): Value
}

export interface AsyncActionContext {
  readonly signal: AbortSignal
  readonly scope: AsyncOperationScope
}

export type AsyncActionOperation<Input, Value> = (
  input: Input,
  context: AsyncActionContext,
) => Value | PromiseLike<Value>

export interface AsyncActionOptions<Value> {
  readonly concurrency?: AsyncActionConcurrency
  readonly dispose?: (value: Value) => void
  readonly onError?: (error: unknown) => void
}

export interface AsyncState<Value> {
  readonly status: ReadonlySignal<AsyncActionStatus>
  readonly pending: ReadonlySignal<boolean>
  readonly value: ReadonlySignal<Value | undefined>
  readonly error: ReadonlySignal<unknown | undefined>
}

export interface AsyncAction<Input, Value>
extends AsyncState<Value> {
  readonly disposed: boolean
  run(
    ...args: [Input] extends [void]
      ? [] | [Input]
      : [Input]
  ): void
  cancel(): void
  dispose(): void
}

interface OwnedValue<Value> {
  readonly value: Value
  readonly cleanups: Cleanup[]
  readonly ownsResult: boolean
}

interface OperationOwnership {
  readonly cleanups: Cleanup[]
  readonly values: Set<object>
  active: boolean
}

function disposeCleanups(
  cleanups: Cleanup[],
): void {
  const errors: unknown[] = []
  for (const cleanup of cleanups.reverse()) {
    try {
      cleanup()
    }
    catch (error) {
      errors.push(error)
    }
  }
  cleanups.length = 0
  if (errors.length === 1) {
    throw errors[0]
  }
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      'Async resource cleanup failed.',
    )
  }
}

function createOperationScope(
  ownership: OperationOwnership,
): AsyncOperationScope {
  const own = <Value extends object>(
    value: Value,
    release: (value: Value) => void,
  ): Value => {
    if (
      typeof value !== 'object' ||
      value === null
    ) {
      throw new TypeError(
        'Async operation ownership requires object values.',
      )
    }
    if (!ownership.active) {
      release(value)
      return value
    }
    ownership.cleanups.push(() => release(value))
    ownership.values.add(value)
    return value
  }
  return {
    own,
    closeable(value) {
      return own(value, (owned) => owned.close())
    },
    disposable(value) {
      return own(value, (owned) => owned.dispose())
    },
  }
}

export function createAsyncAction<Input = void, Value = void>(
  operation: AsyncActionOperation<Input, Value>,
  options: AsyncActionOptions<Value> = {},
): AsyncAction<Input, Value> {
  const status = signal<AsyncActionStatus>('idle')
  const value = signal<Value | undefined>(undefined)
  const error = signal<unknown | undefined>(undefined)
  const pending = computed(
    () => status.value === 'pending',
  )
  const concurrency = options.concurrency ?? 'drop'
  let current:
    | {
        readonly revision: number
        readonly controller: AbortController
        readonly ownership: OperationOwnership
      }
    | undefined
  let ownedValue: OwnedValue<Value> | undefined
  let nextRevision = 0
  let disposed = false

  const releaseOwned = (
    owned: OwnedValue<Value> | undefined,
  ) => {
    if (!owned) {
      return
    }
    const cleanups = [...owned.cleanups]
    if (options.dispose && !owned.ownsResult) {
      cleanups.push(() =>
        options.dispose!(owned.value),
      )
    }
    else if (
      !owned.ownsResult &&
      typeof owned.value === 'object' &&
      owned.value !== null
    ) {
      const disposable = owned.value as {
        dispose?: unknown
      }
      if (typeof disposable.dispose === 'function') {
        const disposeValue = disposable.dispose
        cleanups.push(() => {
          disposeValue.call(owned.value)
        })
      }
    }
    disposeCleanups(cleanups)
  }
  const reportBackgroundError = (
    backgroundError: unknown,
  ) => {
    if (options.onError) {
      options.onError(backgroundError)
      return
    }
    void Promise.resolve().then(() => {
      throw backgroundError
    })
  }

  const cancelCurrent = () => {
    if (!current) {
      return
    }
    const active = current
    current = undefined
    nextRevision += 1
    active.controller.abort()
    active.ownership.active = false
    disposeCleanups(active.ownership.cleanups)
  }

  const disposeInternal = () => {
    if (disposed) {
      return
    }
    disposed = true
    const previous = ownedValue
    ownedValue = undefined
    const errors: unknown[] = []
    try {
      cancelCurrent()
    }
    catch (cleanupError) {
      errors.push(cleanupError)
    }
    batch(() => {
      status.value = 'disposed'
      value.value = undefined
      error.value = undefined
    })
    try {
      releaseOwned(previous)
    }
    catch (cleanupError) {
      errors.push(cleanupError)
    }
    if (errors.length === 1) {
      throw errors[0]
    }
    if (errors.length > 1) {
      throw new AggregateError(
        errors,
        'Async action disposal failed.',
      )
    }
  }
  registerScopedCleanup(disposeInternal)

  const run = (...args: [Input] extends [void]
    ? [] | [Input]
    : [Input]) => {
    if (disposed) {
      throw new Error(
        'Cannot run a disposed async action.',
      )
    }
    if (current) {
      if (concurrency === 'drop') {
        return
      }
      try {
        cancelCurrent()
      }
      catch (cleanupError) {
        batch(() => {
          status.value = 'error'
          error.value = cleanupError
        })
        return
      }
    }

    const revision = ++nextRevision
    const controller = new AbortController()
    const ownership: OperationOwnership = {
      cleanups: [],
      values: new Set(),
      active: true,
    }
    const scope = createOperationScope(ownership)
    current = {
      revision,
      controller,
      ownership,
    }
    batch(() => {
      status.value = 'pending'
      error.value = undefined
    })

    let result: Value | PromiseLike<Value>
    try {
      result = operation(
        args[0] as Input,
        {
          signal: controller.signal,
          scope,
        },
      )
    }
    catch (operationError) {
      result = Promise.reject(operationError)
    }

    void Promise.resolve(result).then(
      (nextValue) => {
        const nextOwned: OwnedValue<Value> = {
          value: nextValue,
          cleanups: ownership.cleanups,
          ownsResult:
            typeof nextValue === 'object' &&
            nextValue !== null &&
            ownership.values.has(nextValue),
        }
        if (
          disposed ||
          current?.revision !== revision
        ) {
          ownership.active = false
          try {
            releaseOwned(nextOwned)
          }
          catch (cleanupError) {
            reportBackgroundError(cleanupError)
          }
          return
        }
        current = undefined
        ownership.active = false
        const previous = ownedValue
        ownedValue = nextOwned
        batch(() => {
          value.value = nextValue
          status.value = 'success'
          error.value = undefined
        })
        if (
          previous &&
          !Object.is(previous.value, nextValue)
        ) {
          try {
            releaseOwned(previous)
          }
          catch (cleanupError) {
            batch(() => {
              status.value = 'error'
              error.value = cleanupError
            })
          }
        }
      },
      (operationError) => {
        let cleanupError: unknown
        try {
          ownership.active = false
          disposeCleanups(ownership.cleanups)
        }
        catch (cleanupFailure) {
          cleanupError = cleanupFailure
        }
        if (
          disposed ||
          current?.revision !== revision
        ) {
          if (cleanupError !== undefined) {
            reportBackgroundError(cleanupError)
          }
          return
        }
        current = undefined
        const failure =
          cleanupError === undefined
            ? operationError
            : new AggregateError(
                [operationError, cleanupError],
                'Async action and cleanup failed.',
              )
        batch(() => {
          status.value = 'error'
          error.value = failure
        })
      },
    )
  }

  return {
    status,
    pending,
    value,
    error,
    get disposed() {
      return disposed
    },
    run,
    cancel() {
      if (disposed || !current) {
        return
      }
      try {
        cancelCurrent()
      }
      catch (cleanupError) {
        batch(() => {
          status.value = 'error'
          error.value = cleanupError
        })
        return
      }
      batch(() => {
        status.value =
          ownedValue === undefined
            ? 'idle'
            : 'success'
        error.value = undefined
      })
    },
    dispose: disposeInternal,
  }
}

export interface AsyncViewProps<Value> {
  readonly state: AsyncState<Value>
  readonly children: (value: Value) => Child
  readonly idle?: Child
  readonly pending?: Child
  readonly error?:
    | Child
    | ((error: unknown) => Child)
}

export function AsyncView<Value>(
  props: AsyncViewProps<Value>,
): Child {
  return createDynamicNode(() => {
    switch (props.state.status.value) {
      case 'idle':
      case 'disposed':
        return props.idle
      case 'pending':
        return props.pending
      case 'error': {
        const failure = props.state.error.value
        if (typeof props.error === 'function') {
          return props.error(failure)
        }
        if (props.error !== undefined) {
          return props.error
        }
        throw failure
      }
      case 'success':
        return props.children(
          props.state.value.value as Value,
        )
    }
  })
}
