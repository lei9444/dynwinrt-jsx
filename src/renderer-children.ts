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
  ): unknown[]
}

export interface ChildAdapterOptions {
  readonly asCollection?: (
    value: unknown,
    owner: object,
  ) => NativeCollection | null | undefined
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

function collectionAdapter(
  options: ChildAdapterOptions,
  value: unknown,
  owner: object,
): ChildAdapter | null {
  const projected =
    options.asCollection?.(value, owner) ??
    (isNativeCollection(value) ? value : null)

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
  if (descriptor.strategy === 'single') {
    return new SinglePropertyAdapter(
      record,
      descriptor.property,
    )
  }
  return collectionAdapter(
    options,
    record[descriptor.property],
    owner,
  )
}
