import {
  registerScopedCleanup,
  type Cleanup,
} from '../core/reactive'

interface NativeResourceEntry<Value extends object> {
  readonly value: Value
  readonly cleanup: Cleanup
  completed: boolean
}

export interface NativeResourceOwnerOptions {
  readonly releaseProjected?: (value: object) => void
}

export interface NativeResourceOwner {
  readonly disposed: boolean
  own<Value extends object>(
    value: Value,
    release: (value: Value) => void,
  ): Value
  ownCloseable<Value extends { close(): void }>(
    value: Value,
  ): Value
  ownDisposable<Value extends { dispose(): void }>(
    value: Value,
  ): Value
  ownProjected<Value extends object>(
    value: Value,
  ): Value
  defer(cleanup: Cleanup): Cleanup
  release(value: object): void
  dispose(): void
}

export function createNativeResourceOwner(
  options: NativeResourceOwnerOptions = {},
): NativeResourceOwner {
  const entries: NativeResourceEntry<object>[] = []
  const byValue = new Map<
    object,
    NativeResourceEntry<object>
  >()
  let disposed = false

  const runEntry = (
    entry: NativeResourceEntry<object>,
  ) => {
    if (entry.completed) {
      return
    }
    entry.cleanup()
    entry.completed = true
    byValue.delete(entry.value)
  }
  const own = <Value extends object>(
    value: Value,
    release: (value: Value) => void,
  ): Value => {
    if (
      typeof value !== 'object' ||
      value === null
    ) {
      throw new TypeError(
        'Native resource owners require object values.',
      )
    }
    if (disposed) {
      release(value)
      return value
    }
    const existing = byValue.get(value)
    if (existing) {
      return value
    }
    const entry: NativeResourceEntry<Value> = {
      value,
      cleanup: () => release(value),
      completed: false,
    }
    entries.push(entry)
    byValue.set(
      value,
      entry as NativeResourceEntry<object>,
    )
    return value
  }
  const defer = (cleanup: Cleanup): Cleanup => {
    const marker = {}
    own(marker, cleanup)
    return () => {
      const entry = byValue.get(marker)
      if (entry) {
        runEntry(entry)
      }
    }
  }
  const disposeInternal = () => {
    if (disposed) {
      return
    }
    const failures: unknown[] = []
    for (const entry of [...entries].reverse()) {
      try {
        runEntry(entry)
      }
      catch (error) {
        failures.push(error)
      }
    }
    if (failures.length === 0) {
      disposed = true
    }
    if (failures.length === 1) {
      throw failures[0]
    }
    if (failures.length > 1) {
      throw new AggregateError(
        failures,
        'Native resource cleanup failed.',
      )
    }
  }
  registerScopedCleanup(disposeInternal)

  return {
    get disposed() {
      return disposed
    },
    own,
    ownCloseable(value) {
      return own(value, (owned) => owned.close())
    },
    ownDisposable(value) {
      return own(value, (owned) => owned.dispose())
    },
    ownProjected(value) {
      if (!options.releaseProjected) {
        throw new Error(
          'ownProjected() requires releaseProjected.',
        )
      }
      return own(value, options.releaseProjected)
    },
    defer,
    release(value) {
      const entry = byValue.get(value)
      if (entry) {
        runEntry(entry)
      }
    },
    dispose: disposeInternal,
  }
}
