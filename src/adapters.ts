import type { NativeCollection } from './renderer'

export type NativePropertyMode =
  | 'oneWay'
  | 'initialOnly'
  | 'controlled'
  | 'coercing'
  | 'reference'

export type NativeControlledEchoMode =
  | 'synchronous'
  | 'deferred'
  | 'setterScope'

export interface NativeControlledPropertyOptions<Instance> {
  readonly changeProperty: string
  readonly read: (instance: Instance) => unknown
  readonly write: (
    instance: Instance,
    value: unknown,
  ) => void
  readonly subscribe: (
    instance: Instance,
    callback: () => void,
  ) => void | (() => void)
  readonly rollback?: (
    instance: Instance,
    previous: unknown,
    attempted: unknown,
    error: unknown,
  ) => void
  readonly echo?: NativeControlledEchoMode
  readonly equals?: (
    expected: unknown,
    actual: unknown,
  ) => boolean
  readonly maxPendingWrites?: number
}

export interface NativePropertyAdapter<Instance> {
  readonly kind: 'property'
  readonly mode: NativePropertyMode
  readonly controlled?:
    NativeControlledPropertyOptions<Instance>
  readonly coerce?: (
    value: unknown,
    instance: Instance,
  ) => unknown
  readonly set?: (
    instance: Instance,
    value: unknown,
  ) => void
}

export interface NativeCollectionAdapter<Instance> {
  readonly kind: 'collection'
  readonly get: (instance: Instance) => NativeCollection
  readonly map?: (
    value: unknown,
    index: number,
    instance: Instance,
  ) => unknown
  readonly label?: string
}

export interface NativeSlotAdapter<Instance> {
  readonly kind: 'slot'
  readonly strategy: 'single' | 'collection'
  readonly property: Extract<keyof Instance, string>
}

export type NativeAdapter<Instance> =
  | NativePropertyAdapter<Instance>
  | NativeCollectionAdapter<Instance>
  | NativeSlotAdapter<Instance>

export type NativeAdapterMap<
  Instance,
  Props extends object,
> = Partial<Record<Extract<keyof Props, string>, NativeAdapter<Instance>>>

export const adapter = {
  oneWay<Instance>(): NativePropertyAdapter<Instance> {
    return { kind: 'property', mode: 'oneWay' }
  },
  initialOnly<Instance>(): NativePropertyAdapter<Instance> {
    return { kind: 'property', mode: 'initialOnly' }
  },
  controlled<Instance>(
    controlled?: NativeControlledPropertyOptions<Instance>,
    coerce?: NativePropertyAdapter<Instance>['coerce'],
  ): NativePropertyAdapter<Instance> {
    return controlled
      ? {
          kind: 'property',
          mode: 'controlled',
          controlled,
          ...(coerce ? { coerce } : {}),
        }
      : { kind: 'property', mode: 'controlled' }
  },
  coercing<Instance>(
    coerce: NativePropertyAdapter<Instance>['coerce'],
    controlled?: NativeControlledPropertyOptions<Instance>,
  ): NativePropertyAdapter<Instance> {
    return {
      kind: 'property',
      mode: 'coercing',
      coerce,
      ...(controlled ? { controlled } : {}),
    }
  },
  reference<Instance>(
    set?: NativePropertyAdapter<Instance>['set'],
  ): NativePropertyAdapter<Instance> {
    return { kind: 'property', mode: 'reference', set }
  },
  collection<Instance>(
    options: Omit<NativeCollectionAdapter<Instance>, 'kind'>,
  ): NativeCollectionAdapter<Instance> {
    return { kind: 'collection', ...options }
  },
  slot<Instance>(
    property: Extract<keyof Instance, string>,
  ): NativeSlotAdapter<Instance> {
    return { kind: 'slot', strategy: 'single', property }
  },
  collectionSlot<Instance>(
    property: Extract<keyof Instance, string>,
  ): NativeSlotAdapter<Instance> {
    return { kind: 'slot', strategy: 'collection', property }
  },
}
