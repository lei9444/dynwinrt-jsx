import type { NativeCollection } from './renderer'

export type NativePropertyMode =
  | 'oneWay'
  | 'initialOnly'
  | 'controlled'
  | 'coercing'
  | 'reference'

export interface NativePropertyAdapter<Instance> {
  readonly kind: 'property'
  readonly mode: NativePropertyMode
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
  controlled<Instance>(): NativePropertyAdapter<Instance> {
    return { kind: 'property', mode: 'controlled' }
  },
  coercing<Instance>(
    coerce: NativePropertyAdapter<Instance>['coerce'],
  ): NativePropertyAdapter<Instance> {
    return { kind: 'property', mode: 'coercing', coerce }
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
