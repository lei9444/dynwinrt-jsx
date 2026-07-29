export type WinUICleanup = () => void

export interface WinUIAsyncCleanupOperation {
  then(
    onFulfilled: () => void,
    onRejected: (error: unknown) => void,
  ): unknown
}

export type WinUIAsyncCleanup = (
) =>
  | void
  | PromiseLike<void>
  | WinUIAsyncCleanupOperation

function isPromiseLike(
  value: unknown,
): value is PromiseLike<unknown> {
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

function throwCleanupFailures(
  failures: readonly unknown[],
  label: string,
): void {
  if (failures.length === 1) {
    throw failures[0]
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, label)
  }
}

export function createWinUICleanup(
  cleanups: readonly WinUICleanup[],
  label = 'WinUI cleanup failed.',
): WinUICleanup {
  if (!Array.isArray(cleanups)) {
    throw new TypeError(
      'createWinUICleanup() requires a cleanup array.',
    )
  }
  const completed = cleanups.map(() => false)
  return () => {
    const failures: unknown[] = []
    for (
      let index = 0;
      index < cleanups.length;
      index += 1
    ) {
      if (completed[index]) {
        continue
      }
      try {
        const result = cleanups[index]!()
        if (isPromiseLike(result)) {
          try {
            result.then(
              () => {},
              () => {},
            )
          }
          catch {
            // The synchronous cleanup contract error remains primary.
          }
          throw new TypeError(
            'WinUI synchronous cleanup returned a Promise.',
          )
        }
        completed[index] = true
      }
      catch (error) {
        failures.push(error)
      }
    }
    throwCleanupFailures(failures, label)
  }
}

export function createWinUIAsyncCleanup(
  cleanups: readonly WinUIAsyncCleanup[],
  label = 'WinUI asynchronous cleanup failed.',
): () => Promise<void> {
  if (!Array.isArray(cleanups)) {
    throw new TypeError(
      'createWinUIAsyncCleanup() requires a cleanup array.',
    )
  }
  const completed = cleanups.map(() => false)
  let inFlight: Promise<void> | null = null

  return () => {
    if (inFlight !== null) {
      return inFlight
    }
    inFlight = (async () => {
      const failures: unknown[] = []
      for (
        let index = 0;
        index < cleanups.length;
        index += 1
      ) {
        if (completed[index]) {
          continue
        }
        try {
          await cleanups[index]!()
          completed[index] = true
        }
        catch (error) {
          failures.push(error)
        }
      }
      throwCleanupFailures(failures, label)
    })().finally(() => {
      inFlight = null
    })
    return inFlight
  }
}
