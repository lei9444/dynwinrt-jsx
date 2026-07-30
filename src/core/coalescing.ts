import {
  onCleanup,
  type Cleanup,
} from './reactive'

export type CoalescingScheduler = (
  flush: () => void,
) => void | Cleanup

export interface LastValueCoalescer<T> {
  readonly pending: boolean
  push(value: T): void
  flush(): void
  cancel(): void
  dispose(): void
}

export function createLastValueCoalescer<T>(
  schedule: CoalescingScheduler,
  callback: (value: T) => void,
): LastValueCoalescer<T> {
  let latest: T
  let hasValue = false
  let pending = false
  let disposed = false
  let cancelScheduled: Cleanup | undefined

  const cancel = () => {
    cancelScheduled?.()
    cancelScheduled = undefined
    pending = false
    hasValue = false
  }
  const flush = () => {
    if (disposed || !pending) {
      return
    }
    cancelScheduled = undefined
    pending = false
    if (!hasValue) {
      return
    }
    const value = latest
    hasValue = false
    callback(value)
  }

  return {
    get pending() {
      return pending
    },
    push(value) {
      if (disposed) {
        return
      }
      latest = value
      hasValue = true
      if (pending) {
        return
      }
      pending = true
      const cleanup = schedule(flush)
      if (typeof cleanup === 'function') {
        cancelScheduled = cleanup
      }
    },
    flush,
    cancel,
    dispose() {
      if (disposed) {
        return
      }
      cancel()
      disposed = true
    },
  }
}

export function createScopedLastValueCoalescer<T>(
  schedule: CoalescingScheduler,
  callback: (value: T) => void,
): LastValueCoalescer<T> {
  const coalescer =
    createLastValueCoalescer(schedule, callback)
  onCleanup(() => coalescer.dispose())
  return coalescer
}
