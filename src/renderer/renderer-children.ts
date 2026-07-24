import type { NativeSlotAdapter } from './adapters'

export interface NativeCollection {
  readonly length?: number
  readonly size?: number
  getAt?(index: number): unknown
  toArray?(): unknown[]
  insertAt(index: number, value: unknown): void
  removeAt(index: number): void
  append(value: unknown): void
  clear(): void
}

export interface ChildAdapter {
  snapshot(): unknown[]
  sync(
    current: unknown[],
    desired: readonly unknown[],
    allowCachedCollectionFallback?: boolean,
  ): unknown[]
}

export interface ChildAdapterOptions {
  readonly asCollection?: (
    value: unknown,
    owner: object,
  ) => NativeCollection | null | undefined
}

export class ChildSyncHookError extends Error {
  constructor(
    readonly synchronized: unknown[],
    readonly originalError: unknown,
  ) {
    super('Child synchronization hook failed.')
  }
}

class CollectionAdapter implements ChildAdapter {
  constructor(readonly collection: NativeCollection) {}

  snapshot(): unknown[] {
    if (typeof this.collection.toArray === 'function') {
      return [...this.collection.toArray()]
    }

    const length =
      this.collection.length ??
      this.collection.size ??
      0
    if (
      length === 0 ||
      typeof this.collection.getAt !== 'function'
    ) {
      return []
    }

    return Array.from(
      { length },
      (_, index) => this.collection.getAt?.(index),
    )
  }

  sync(
    current: unknown[],
    desired: readonly unknown[],
  ): unknown[] {
    for (
      let index = 0;
      index < desired.length;
      index += 1
    ) {
      const desiredNode = desired[index]
      if (current[index] === desiredNode) {
        continue
      }

      const existingIndex = current.indexOf(
        desiredNode,
        index + 1,
      )
      if (existingIndex >= 0) {
        this.collection.removeAt(existingIndex)
        current.splice(existingIndex, 1)
      }

      if (index === current.length) {
        this.collection.append(desiredNode)
      }
      else {
        this.collection.insertAt(index, desiredNode)
      }
      current.splice(index, 0, desiredNode)
    }

    while (current.length > desired.length) {
      const index = current.length - 1
      this.collection.removeAt(index)
      current.pop()
    }

    return current
  }
}

class GetterCollectionAdapter implements ChildAdapter {
  private ownedCollections = new Set<NativeCollection>()

  constructor(
    readonly options: ChildAdapterOptions,
    readonly get: (owner: object) => unknown,
    readonly owner: object,
  ) {}

  snapshot(): unknown[] {
    const adapter = this.resolve()
    this.ownedCollections.add(adapter.collection)
    return adapter.snapshot()
  }

  sync(
    current: unknown[],
    desired: readonly unknown[],
    allowCachedCollectionFallback = false,
  ): unknown[] {
    let collection: NativeCollection
    let resolveError: unknown
    try {
      collection = this.resolve().collection
    }
    catch (error) {
      resolveError = error
      if (
        !allowCachedCollectionFallback ||
        this.ownedCollections.size === 0
      ) {
        throw error
      }
      collection = [...this.ownedCollections].at(-1)!
    }

    try {
      return this.rebuild(collection, current, desired)
    }
    catch (syncError) {
      if (resolveError !== undefined) {
        throw new AggregateError(
          [resolveError, syncError],
          'Collection slot getter resolution and cached synchronization failed.',
        )
      }
      throw syncError
    }
  }

  private rebuild(
    collection: NativeCollection,
    current: readonly unknown[],
    desired: readonly unknown[],
  ): unknown[] {
    const candidates = new Set(this.ownedCollections)
    candidates.add(collection)
    const failedCollections = new Set<NativeCollection>()
    const clearErrors: unknown[] = []
    for (const candidate of candidates) {
      try {
        candidate.clear()
      }
      catch (error) {
        failedCollections.add(candidate)
        clearErrors.push(error)
      }
    }

    if (clearErrors.length > 0) {
      let rollbackError: unknown
      try {
        this.restore(collection, current)
      }
      catch (error) {
        rollbackError = error
      }
      this.ownedCollections = new Set([
        ...failedCollections,
        collection,
      ])
      const clearError = clearErrors.length === 1
        ? clearErrors[0]
        : new AggregateError(
            clearErrors,
            'Clearing previous collection slots failed.',
          )
      if (rollbackError !== undefined) {
        throw new AggregateError(
          [clearError, rollbackError],
          'Collection slot synchronization and rollback failed.',
        )
      }
      throw clearError
    }

    try {
      for (const node of desired) {
        collection.append(node)
      }
    }
    catch (error) {
      try {
        this.restore(collection, current)
        this.ownedCollections = new Set([collection])
      }
      catch (rollbackError) {
        this.ownedCollections.add(collection)
        throw new AggregateError(
          [error, rollbackError],
          'Collection slot synchronization and rollback failed.',
        )
      }
      throw error
    }

    this.ownedCollections = new Set([collection])
    return [...desired]
  }

  private restore(
    collection: NativeCollection,
    nodes: readonly unknown[],
  ): void {
    collection.clear()
    for (const node of nodes) {
      collection.append(node)
    }
  }

  private resolve(): CollectionAdapter {
    const collection = nativeCollection(
      this.options,
      this.get(this.owner),
      this.owner,
    )
    if (!collection) {
      throw new Error(
        `${this.owner.constructor.name} collection slot getter no longer resolves a mutable collection.`,
      )
    }
    return new CollectionAdapter(collection)
  }
}

class SinglePropertyAdapter implements ChildAdapter {
  constructor(
    readonly owner: Record<string, unknown>,
    readonly property: string,
  ) {}

  snapshot(): unknown[] {
    const value = this.owner[this.property]
    return value == null ? [] : [value]
  }

  sync(
    current: unknown[],
    desired: readonly unknown[],
  ): unknown[] {
    if (desired.length > 1) {
      throw new Error(
        `${this.owner.constructor.name}.${this.property} accepts only one JSX child.`,
      )
    }

    const next = desired[0] ?? null
    if (
      current[0] !== next ||
      current.length !== desired.length
    ) {
      this.owner[this.property] = next
    }

    return next == null ? [] : [next]
  }
}

class SyncHookAdapter implements ChildAdapter {
  constructor(
    readonly inner: ChildAdapter,
    readonly beforeSync: (() => void) | undefined,
    readonly afterSync: (() => void) | undefined,
    readonly finallySync: (() => void) | undefined,
  ) {}

  snapshot(): unknown[] {
    return this.inner.snapshot()
  }

  sync(
    current: unknown[],
    desired: readonly unknown[],
    allowCachedCollectionFallback = false,
  ): unknown[] {
    let next: unknown[] | undefined
    let failure: unknown
    try {
      this.beforeSync?.()
      next = this.inner.sync(
        current,
        desired,
        allowCachedCollectionFallback,
      )
      this.afterSync?.()
    }
    catch (error) {
      failure = error
    }
    try {
      this.finallySync?.()
    }
    catch (error) {
      failure = failure === undefined
        ? error
        : new AggregateError(
            [failure, error],
            'Child synchronization and finalization failed.',
          )
    }
    if (failure !== undefined) {
      if (next) {
        throw new ChildSyncHookError(next, failure)
      }
      throw failure
    }
    return next!
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isNativeCollection(
  value: unknown,
): value is NativeCollection {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.insertAt === 'function' &&
    typeof value.removeAt === 'function' &&
    typeof value.append === 'function' &&
    typeof value.clear === 'function'
  )
}

function nativeCollection(
  options: ChildAdapterOptions,
  value: unknown,
  owner: object,
): NativeCollection | null {
  return (
    options.asCollection?.(value, owner) ??
    (isNativeCollection(value) ? value : null)
  )
}

function collectionAdapter(
  options: ChildAdapterOptions,
  value: unknown,
  owner: object,
): ChildAdapter | null {
  const projected = nativeCollection(options, value, owner)
  return projected
    ? new CollectionAdapter(projected)
    : null
}

export function resolveChildAdapter(
  options: ChildAdapterOptions,
  owner: object,
): ChildAdapter | null {
  const record = owner as Record<string, unknown>

  if ('children' in owner) {
    const adapter = collectionAdapter(
      options,
      record.children,
      owner,
    )
    if (adapter) {
      return adapter
    }
  }

  if ('child' in owner) {
    return new SinglePropertyAdapter(record, 'child')
  }

  if ('content' in owner) {
    return new SinglePropertyAdapter(record, 'content')
  }

  if ('items' in owner) {
    const adapter = collectionAdapter(
      options,
      record.items,
      owner,
    )
    if (adapter) {
      return adapter
    }
  }

  return null
}

export function resolveSlotAdapter(
  options: ChildAdapterOptions,
  owner: object,
  descriptor: NativeSlotAdapter<object>,
): ChildAdapter | null {
  const record = owner as Record<string, unknown>
  const resolved = descriptor.strategy === 'single'
    ? new SinglePropertyAdapter(
      record,
      descriptor.property,
    )
    : descriptor.get
      ? nativeCollection(
          options,
          descriptor.get(owner),
          owner,
        )
        ? new GetterCollectionAdapter(
            options,
            descriptor.get,
            owner,
          )
        : null
      : collectionAdapter(
          options,
          record[descriptor.property],
          owner,
        )
  if (
    !resolved ||
    (
      !descriptor.beforeSync &&
      !descriptor.afterSync &&
      !descriptor.finallySync
    )
  ) {
    return resolved
  }
  return new SyncHookAdapter(
    resolved,
    descriptor.beforeSync
      ? () => descriptor.beforeSync?.(owner)
      : undefined,
    descriptor.afterSync
      ? () => descriptor.afterSync?.(owner)
      : undefined,
    descriptor.finallySync
      ? () => descriptor.finallySync?.(owner)
      : undefined,
  )
}
