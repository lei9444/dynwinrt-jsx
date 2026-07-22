import {
  native,
  setRef,
  type NativeComponentProps,
  type NativeConstructor,
  type Ref,
  type RefObject,
} from './native'
import { adapter } from './adapters'
import { ChangeEchoSuppressor } from './change-echo'
import {
  readSignal,
  type MaybeSignal,
} from './reactive'
import type { NativeCollection } from './renderer'
import { createVNode, type Child, type Component } from './vnode'
import type { Focusable } from './focus'

export interface ListViewInstance extends Focusable {
  readonly items: NativeCollection
  header: unknown
  footer: unknown
  selectedIndex: number
  selectedItem: unknown
  scrollIntoView(item: unknown, alignment?: number): void
  onSelectionChanged(callback: (...args: unknown[]) => void): () => void
  registerPropertyChangedCallback?(
    property: unknown,
    callback: (sender: unknown, property: unknown) => void,
  ): bigint
  unregisterPropertyChangedCallback?(
    property: unknown,
    token: bigint,
  ): void
}

export interface ListViewControlBindings<
  Instance extends ListViewInstance,
> {
  readonly ListView: NativeConstructor<Instance>
  readonly selectedIndexProperty?: unknown
}

interface ListViewAdapterProps<
  Instance extends ListViewInstance,
> {
  header?: Child
  footer?: Child
  selectedIndex?: MaybeSignal<number>
  onSelectedIndexChange?: (
    index: number,
    sender: Instance,
  ) => void
}

export interface ListViewSelectionProps<
  Instance extends ListViewInstance,
> {
  onSelectedIndexChange?: (index: number, sender: Instance) => void
}

type ListViewSelectionChangedCallback<Instance> = (
  sender: Instance,
  ...args: unknown[]
) => void

export type ListViewProps<Instance extends ListViewInstance> =
  & NativeComponentProps<
      Instance,
      Pick<
        ListViewAdapterProps<Instance>,
        'header' | 'footer' | 'onSelectedIndexChange'
      >
    >
  & ListViewSelectionProps<Instance>

const maxPendingSelections = 8
const pendingSelections = new WeakMap<
  object,
  ChangeEchoSuppressor<number>
>()

function recordPendingSelection(instance: object, value: number): void {
  let suppressor = pendingSelections.get(instance)
  if (!suppressor) {
    suppressor = new ChangeEchoSuppressor<number>({
      mode: 'synchronous',
      maxPending: maxPendingSelections,
    })
    pendingSelections.set(instance, suppressor)
  }
  suppressor.record(value)
}

function consumePendingSelectionEcho(
  instance: object,
  value: number,
): boolean {
  return pendingSelections.get(instance)?.consume(value) ?? false
}

export function createListViewControl<Instance extends ListViewInstance>(
  bindings: ListViewControlBindings<Instance>,
): Component<ListViewProps<Instance>> {
  const coerceSelectedIndex = (value: unknown): number => {
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < -1
    ) {
      throw new RangeError(
        'ListView selectedIndex must be an integer greater than or equal to -1.',
      )
    }
    return value
  }

  const selectedIndexAdapter =
    bindings.selectedIndexProperty !== undefined
      ? adapter.controlled<Instance>(
          {
            changeProperty: 'onSelectedIndexChange',
            read: (instance) => instance.selectedIndex,
            write: (instance, value) => {
              instance.selectedIndex = value as number
            },
            subscribe: (instance, callback) => {
              if (
                !instance.registerPropertyChangedCallback ||
                !instance.unregisterPropertyChangedCallback
              ) {
                throw new Error(
                  'selectedIndexProperty requires property-changed callback support.',
                )
              }
              const token =
                instance.registerPropertyChangedCallback(
                  bindings.selectedIndexProperty,
                  callback,
                )
              return () => {
                instance.unregisterPropertyChangedCallback?.(
                  bindings.selectedIndexProperty,
                  token,
                )
              }
            },
            echo: 'setterScope',
            maxPendingWrites: maxPendingSelections,
          },
          coerceSelectedIndex,
        )
      : adapter.coercing<Instance>((value, instance) => {
          const selectedIndex = coerceSelectedIndex(value)
          recordPendingSelection(instance, selectedIndex)
          return selectedIndex
        })

  const RawListView = native<
    Instance,
    ListViewAdapterProps<Instance>
  >(
    bindings.ListView,
    {
      displayName: 'ListView',
      adapters: {
        header: adapter.slot<ListViewInstance>('header'),
        footer: adapter.slot<ListViewInstance>('footer'),
        selectedIndex: selectedIndexAdapter,
      },
    },
  )

  const MountedListView = (props: ListViewProps<Instance>): Child => {
    if (bindings.selectedIndexProperty !== undefined) {
      return RawListView(
        props as NativeComponentProps<
          Instance,
          ListViewAdapterProps<Instance>
        >,
      )
    }

    const {
      onSelectedIndexChange,
      onSelectionChanged,
      ref: userRef,
      ...rest
    } = props as ListViewProps<Instance> & {
      ref?: Ref<Instance>
      onSelectionChanged?: MaybeSignal<
        ListViewSelectionChangedCallback<Instance>
      >
    }

    let instance: Instance | null = null
    const handleRef: Ref<Instance> = (value) => {
      instance = value
      setRef(userRef, value)
    }

    const handleControlledSelectionChanged = (current: Instance) => {
      const next = current.selectedIndex
      if (consumePendingSelectionEcho(current, next)) {
        return
      }
      onSelectedIndexChange?.(next, current)
    }
    const handleSelectionChanged = (
      sender: Instance,
      ...args: unknown[]
    ) => {
      readSignal(onSelectionChanged)?.(sender, ...args)
      handleControlledSelectionChanged(instance ?? sender)
    }

    return RawListView({
      ...(rest as NativeComponentProps<
        Instance,
        ListViewAdapterProps<Instance>
      >),
      ref: handleRef,
      ...(onSelectedIndexChange
        ? { onSelectionChanged: handleSelectionChanged }
        : onSelectionChanged === undefined
          ? {}
          : { onSelectionChanged }),
    })
  }

  return function ListView(props: ListViewProps<Instance>): Child {
    return createVNode(
      MountedListView,
      props as ListViewProps<Instance> & Record<string, unknown>,
      props.key ?? null,
    )
  }
}

export interface ListViewScrollTarget<Instance extends ListViewInstance>
  extends RefObject<Instance> {
  scrollIntoView(item: unknown, alignment?: number): void
}

export function createListViewScrollTarget<
  Instance extends ListViewInstance,
>(): ListViewScrollTarget<Instance> {
  let current: Instance | null = null
  return {
    get current() {
      return current
    },
    set current(value) {
      current = value
    },
    scrollIntoView(item, alignment) {
      current?.scrollIntoView(item, alignment)
    },
  }
}
