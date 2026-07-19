import type { NativeCollection } from './renderer'

export function requireNativeArray(
  value: unknown,
  property: string,
): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${property} must be an array.`)
  }
  return value
}

export function snapshotNativeCollection(
  collection: NativeCollection,
  label = 'Native collection',
): unknown[] {
  if (typeof collection.toArray === 'function') {
    return [...collection.toArray()]
  }

  const length = collection.length ?? collection.size ?? 0
  if (length > 0 && typeof collection.getAt !== 'function') {
    throw new Error(`${label} cannot be snapshotted.`)
  }

  return Array.from(
    { length },
    (_, index) => collection.getAt?.(index),
  )
}

export function replaceNativeCollection(
  collection: NativeCollection,
  values: readonly unknown[],
  label = 'Native collection',
): void {
  const previous = snapshotNativeCollection(collection, label)
  try {
    collection.clear()
    for (const value of values) {
      collection.append(value)
    }
  } catch (error) {
    try {
      collection.clear()
      for (const value of previous) {
        collection.append(value)
      }
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        `${label} update and rollback both failed.`,
      )
    }
    throw error
  }
}
