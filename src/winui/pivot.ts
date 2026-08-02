import type { MaybeSignal } from '../core/reactive'
import type { Child, Component } from '../core/vnode'
import { adapter } from '../renderer/adapters'
import {
  native,
  type NativeComponentProps,
  type NativeConstructor,
} from '../renderer/native'
import type { NativeCollection } from '../renderer/renderer'
import {
  createSelectedIndexAdapter,
  type SelectorInstance,
} from './selector'

export interface PivotInstance extends SelectorInstance {
  readonly items: NativeCollection
  selectedItem: unknown
}

export interface PivotControlBindings<
  Instance extends PivotInstance,
> {
  readonly Pivot: NativeConstructor<Instance>
  readonly selectedIndexProperty: unknown
}

interface PivotAdapterProps<
  Instance extends PivotInstance,
> {
  readonly onSelectedIndexChange?: (
    index: number,
    sender: Instance,
  ) => void
}

export type PivotProps<
  Instance extends PivotInstance,
> =
  & Omit<
      NativeComponentProps<
        Instance,
        PivotAdapterProps<Instance>
      >,
      'selectedIndex' | 'selectedItem'
    >
  & {
      readonly selectedIndex?: MaybeSignal<number>
    }

export function createPivotControl<
  Instance extends PivotInstance,
>(
  bindings: PivotControlBindings<Instance>,
): Component<PivotProps<Instance>> {
  const RawPivot = native<
    Instance,
    PivotAdapterProps<Instance>
  >(bindings.Pivot, {
    displayName: 'Pivot',
    adapters: {
      selectedIndex: createSelectedIndexAdapter({
        property: bindings.selectedIndexProperty,
        label: 'Pivot',
        maxPendingWrites: 8,
      }),
    },
    children:
      adapter.collectionSlot<PivotInstance>('items'),
  })

  return function Pivot(
    props: PivotProps<Instance>,
  ): Child {
    const rawSelectedItem = (
      props as PivotProps<Instance> & {
        selectedItem?: unknown
      }
    ).selectedItem
    if (rawSelectedItem !== undefined) {
      throw new TypeError(
        'createPivotControl() supports controlled selectedIndex only; use a raw native Pivot for selectedItem.',
      )
    }
    return RawPivot(props as NativeComponentProps<
      Instance,
      PivotAdapterProps<Instance>
    >)
  }
}
