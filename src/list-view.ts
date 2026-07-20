import {
  native,
  setRef,
  type NativeComponentProps,
  type NativeConstructor,
  type Ref,
  type RefObject,
} from './native'
import { adapter } from './adapters'
import {
  onMount,
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

interface ListViewAdapterProps {
  header?: Child
  footer?: Child
  selectedIndex?: MaybeSignal<number>
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
  & NativeComponentProps<Instance, Pick<ListViewAdapterProps, 'header' | 'footer'>>
  & ListViewSelectionProps<Instance>

const maxPendingSelections = 8
const pendingSelections = new WeakMap<object, number[]>()

function recordPendingSelection(instance: object, value: number): void {
  const pending = pendingSelections.get(instance) ?? []
  pending.push(value)
  if (pending.length > maxPendingSelections) {
    pending.shift()
  }
  pendingSelections.set(instance, pending)
}

function consumePendingSelectionEcho(
  instance: object,
  value: number,
): boolean {
  const pending = pendingSelections.get(instance)
  if (!pending || pending.length === 0) {
    return false
  }
  const match = pending.indexOf(value)
  if (match >= 0) {
    pending.splice(0, match + 1)
    if (pending.length === 0) {
      pendingSelections.delete(instance)
    }
    return true
  }
  pendingSelections.delete(instance)
  return false
}

export function createListViewControl<Instance extends ListViewInstance>(
  bindings: ListViewControlBindings<Instance>,
): Component<ListViewProps<Instance>> {
  const RawListView = native<Instance, ListViewAdapterProps>(
    bindings.ListView,
    {
      displayName: 'ListView',
      adapters: {
        header: adapter.slot<ListViewInstance>('header'),
        footer: adapter.slot<ListViewInstance>('footer'),
        selectedIndex: adapter.coercing<Instance>((value, instance) => {
          if (
            typeof value !== 'number' ||
            !Number.isInteger(value) ||
            value < -1
          ) {
            throw new RangeError(
              'ListView selectedIndex must be an integer greater than or equal to -1.',
            )
          }
          recordPendingSelection(instance, value)
          return value
        }),
      },
    },
  )

  const MountedListView = (props: ListViewProps<Instance>): Child => {
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

    if (
      onSelectedIndexChange &&
      bindings.selectedIndexProperty !== undefined
    ) {
      onMount(() => {
        const current = instance
        if (!current) {
          throw new Error('ListView did not mount before onMount.')
        }
        if (
          !current.registerPropertyChangedCallback ||
          !current.unregisterPropertyChangedCallback
        ) {
          throw new Error(
            'selectedIndexProperty requires property-changed callback support.',
          )
        }
        const token = current.registerPropertyChangedCallback(
          bindings.selectedIndexProperty,
          () => {
            handleControlledSelectionChanged(current)
          },
        )
        return () => {
          current.unregisterPropertyChangedCallback?.(
            bindings.selectedIndexProperty,
            token,
          )
        }
      })
    }

    return RawListView({
      ...(rest as NativeComponentProps<Instance, ListViewAdapterProps>),
      ref: handleRef,
      ...(onSelectedIndexChange &&
        bindings.selectedIndexProperty === undefined
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
