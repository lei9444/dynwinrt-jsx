import { onCleanup } from '../core/reactive'

export interface ProjectedValueOwner<Value extends object> {
  readonly value: Value
  readonly disposed: boolean
  dispose(): void
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (
      typeof value === 'object' ||
      typeof value === 'function'
    ) &&
    'then' in value &&
    typeof value.then === 'function'
  )
}

export function createProjectedValueOwner<
  Value extends object,
  Result = void,
>(
  value: Value,
  release: Extract<
    Result,
    PromiseLike<unknown>
  > extends never
    ? (value: Value) => Result
    : never,
): ProjectedValueOwner<Value> {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    throw new TypeError(
      'ProjectedValueOwner requires an object value.',
    )
  }
  if (typeof release !== 'function') {
    throw new TypeError(
      'ProjectedValueOwner requires a release callback.',
    )
  }
  let disposed = false
  let disposing = false
  let invalidRelease = false

  return {
    value,
    get disposed() {
      return disposed
    },
    dispose() {
      if (invalidRelease) {
        throw new TypeError(
          'ProjectedValueOwner release must be synchronous.',
        )
      }
      if (disposed || disposing) {
        return
      }
      disposing = true
      try {
        const result = release(value)
        if (isPromiseLike(result)) {
          invalidRelease = true
          try {
            result.then(
              () => {},
              () => {},
            )
          }
          catch {
            // The synchronous ownership contract error remains primary.
          }
          throw new TypeError(
            'ProjectedValueOwner release must be synchronous.',
          )
        }
        disposed = true
      }
      finally {
        disposing = false
      }
    },
  }
}

export function ownProjectedValue<
  Value extends object,
  Result = void,
>(
  value: Value,
  release: Extract<
    Result,
    PromiseLike<unknown>
  > extends never
    ? (value: Value) => Result
    : never,
): Value {
  const owner = createProjectedValueOwner(value, release)
  onCleanup(owner.dispose)
  return value
}
