import type { NativeCollection } from './renderer'
import type { ReadonlySignal } from '../core/reactive'
import type { Child, Key } from '../core/vnode'

export type NativePropertyMode =
  | 'oneWay'
  | 'initialOnly'
  | 'controlled'
  | 'coercing'
  | 'reference'

export type NativePropertyPhase =
  | 'beforeChildren'
  | 'afterChildren'
  | 'afterMount'

export type NativeControlledEchoMode =
  | 'synchronous'
  | 'deferred'
  | 'setterScope'

type NativeControlledRollback<Instance> = (
  instance: Instance,
  previous: unknown,
  attempted: unknown,
  error: unknown,
) => void

interface NativeControlledPropertyBase<Instance> {
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
  readonly equals?: (
    expected: unknown,
    actual: unknown,
  ) => boolean
  readonly maxPendingWrites?: number
}

export type NativeControlledPropertyOptions<Instance> =
  NativeControlledPropertyBase<Instance> & (
    | {
        readonly echo?: 'deferred'
        readonly rollback?: never
      }
    | {
        readonly echo: Exclude<
          NativeControlledEchoMode,
          'deferred'
        >
        readonly rollback?: NativeControlledRollback<Instance>
      }
  )

export interface NativePropertyAdapter<Instance> {
  readonly kind: 'property'
  readonly mode: NativePropertyMode
  readonly phase?: NativePropertyPhase
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
  readonly beforeSync?: (instance: Instance) => void
  readonly afterSync?: (instance: Instance) => void
  readonly finallySync?: (instance: Instance) => void
}

export interface NativeItemsRepeaterData<Item = unknown> {
  readonly readItems: () => readonly Item[]
  readonly renderItem: (
    item: Item,
    index: ReadonlySignal<number>,
  ) => Child
  readonly getKey: (item: Item, index: number) => Key
}

export function isNativeItemsRepeaterData(
  value: unknown,
): value is NativeItemsRepeaterData {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate =
    value as Partial<NativeItemsRepeaterData>
  return (
    typeof candidate.readItems === 'function' &&
    typeof candidate.renderItem === 'function' &&
    typeof candidate.getKey === 'function'
  )
}

export interface NativeItemsRepeaterFactory {
  getElement(args: { readonly data: unknown }): object
  recycleElement(args: {
    readonly element: object | null | undefined
  }): void
}

export interface NativeItemsRepeaterAdapter<Instance> {
  readonly kind: 'itemsRepeater'
  readonly createElementHost: () => object
  readonly getElementMountHost?: (
    elementHost: object,
  ) => object
  readonly createElementFactory: (
    factory: NativeItemsRepeaterFactory,
  ) => unknown
  readonly createItemsSourceValue: (key: string) => unknown
  readonly readItemsSourceKey: (value: unknown) => string
  readonly createItemsSource: (
    values: readonly unknown[],
  ) => NativeCollection & object
  readonly setItemsSource: (
    instance: Instance,
    source: unknown,
  ) => void
  readonly setItemTemplate: (
    instance: Instance,
    factory: unknown,
  ) => void
  readonly clearItemsSource: (instance: Instance) => void
  readonly releaseElementFactory: (factory: unknown) => void
}

export type NativeAdapter<Instance> =
  | NativePropertyAdapter<Instance>
  | NativeCollectionAdapter<Instance>
  | NativeSlotAdapter<Instance>
  | NativeItemsRepeaterAdapter<Instance>

export type NativeAdapterMap<
  Instance,
  Props extends object,
> = Partial<Record<Extract<keyof Props, string>, NativeAdapter<Instance>>>

function validateControlledOptions<Instance>(
  controlled: NativeControlledPropertyBase<Instance> & {
    readonly echo?: NativeControlledEchoMode
    readonly rollback?: NativeControlledRollback<Instance>
  },
): void {
  if (
    controlled.rollback &&
    (controlled.echo ?? 'deferred') === 'deferred'
  ) {
    throw new Error(
      'Controlled property rollback requires synchronous or setterScope echo mode.',
    )
  }
}

function validatePropertyPhase(
  phase: NativePropertyPhase,
): void {
  if (
    phase !== 'beforeChildren' &&
    phase !== 'afterChildren' &&
    phase !== 'afterMount'
  ) {
    throw new TypeError(
      `Unknown native property phase "${String(phase)}".`,
    )
  }
}

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
    if (controlled) {
      validateControlledOptions(controlled)
    }
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
    if (controlled) {
      validateControlledOptions(controlled)
    }
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
  withPhase<Instance>(
    property: NativePropertyAdapter<Instance>,
    phase: NativePropertyPhase,
  ): NativePropertyAdapter<Instance> {
    validatePropertyPhase(phase)
    return { ...property, phase }
  },
  collection<Instance>(
    options: Omit<NativeCollectionAdapter<Instance>, 'kind'>,
  ): NativeCollectionAdapter<Instance> {
    return { kind: 'collection', ...options }
  },
  slot<Instance>(
    property: Extract<keyof Instance, string>,
    options: {
      readonly beforeSync?: (instance: Instance) => void
      readonly afterSync?: (instance: Instance) => void
      readonly finallySync?: (instance: Instance) => void
    } = {},
  ): NativeSlotAdapter<Instance> {
    return {
      kind: 'slot',
      strategy: 'single',
      property,
      ...options,
    }
  },
  collectionSlot<Instance>(
    property: Extract<keyof Instance, string>,
    options: {
      readonly beforeSync?: (instance: Instance) => void
      readonly afterSync?: (instance: Instance) => void
      readonly finallySync?: (instance: Instance) => void
    } = {},
  ): NativeSlotAdapter<Instance> {
    return {
      kind: 'slot',
      strategy: 'collection',
      property,
      ...options,
    }
  },
  itemsRepeater<Instance>(
    options: Omit<
      NativeItemsRepeaterAdapter<Instance>,
      'kind'
    >,
  ): NativeItemsRepeaterAdapter<Instance> {
    return { kind: 'itemsRepeater', ...options }
  },
}
