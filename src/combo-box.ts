import { adapter } from './adapters'
import {
  native,
  type NativeComponentProps,
  type NativeConstructor,
} from './native'
import {
  computed,
  onMount,
  readSignal,
  signal,
  type MaybeSignal,
} from './reactive'
import type { NativeCollection } from './renderer'
import {
  createSelectedIndexAdapter,
  type SelectorInstance,
} from './selector'
import type { Child, Component } from './vnode'

export interface ComboBoxInstance extends SelectorInstance {
  readonly items: NativeCollection
  header: unknown
  selectedItem: unknown
  onSelectionChanged(
    callback: (...args: unknown[]) => void,
  ): () => void
}

export interface ComboBoxControlBindings<
  Instance extends ComboBoxInstance,
> {
  readonly ComboBox: NativeConstructor<Instance>
  readonly selectedIndexProperty: unknown
}

interface ComboBoxAdapterProps<
  Instance extends ComboBoxInstance,
> {
  readonly header?: Child
  readonly onSelectedIndexChange?: (
    index: number,
    sender: Instance,
  ) => void
}

export type ComboBoxProps<
  Instance extends ComboBoxInstance,
> =
  & Omit<
      NativeComponentProps<
        Instance,
        ComboBoxAdapterProps<Instance>
      >,
      'selectedIndex' | 'selectedItem'
    >
  & {
      readonly selectedIndex?: MaybeSignal<number>
    }

export function createComboBoxControl<
  Instance extends ComboBoxInstance,
>(
  bindings: ComboBoxControlBindings<Instance>,
): Component<ComboBoxProps<Instance>> {
  const RawComboBox = native<
    Instance,
    ComboBoxAdapterProps<Instance>
  >(bindings.ComboBox, {
    displayName: 'ComboBox',
    adapters: {
      header: adapter.slot<ComboBoxInstance>('header'),
      selectedIndex: createSelectedIndexAdapter({
        property: bindings.selectedIndexProperty,
        label: 'ComboBox',
        maxPendingWrites: 8,
      }),
    },
    children:
      adapter.collectionSlot<ComboBoxInstance>('items'),
  })

  return function ComboBox(
    props: ComboBoxProps<Instance>,
  ): Child {
    const {
      selectedIndex,
      ...rest
    } = props
    const rawSelectedItem = (
      props as ComboBoxProps<Instance> & {
        selectedItem?: unknown
      }
    ).selectedItem
    if (rawSelectedItem !== undefined) {
      throw new TypeError(
        'createComboBoxControl() supports controlled selectedIndex only; use a raw native ComboBox for selectedItem.',
      )
    }
    if (selectedIndex === undefined) {
      return RawComboBox(
        rest as NativeComponentProps<
          Instance,
          ComboBoxAdapterProps<Instance>
        >,
      )
    }

    const mounted = signal(false)
    const delayedSelectedIndex =
      computed(() =>
        mounted.value
          ? readSignal(selectedIndex)
          : -1,
      )
    onMount(() => {
      mounted.value = true
    })

    return RawComboBox({
      ...rest,
      selectedIndex: delayedSelectedIndex,
    } as NativeComponentProps<
      Instance,
      ComboBoxAdapterProps<Instance>
    >)
  }
}
