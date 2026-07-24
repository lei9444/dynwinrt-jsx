import {
  adapter,
} from '../renderer/adapters'
import {
  native,
  type NativeComponentProps,
  type NativeConstructor,
  type Ref,
  setRef,
} from '../renderer/native'
import {
  computed,
  effect,
  readSignal,
  signal,
  type MaybeSignal,
} from '../core/reactive'
import type { NativeCollection } from '../renderer/renderer'
import { coerceSelectedIndex } from './selector'
import type { Child, Component } from '../core/vnode'

export interface SelectorBarInstance<Item extends object> {
  readonly items: NativeCollection
  selectedItem: Item | null
  onSelectionChanged(
    callback: (...args: unknown[]) => void,
  ): () => void
}

export interface SelectorBarControlBindings<
  Instance extends SelectorBarInstance<Item>,
  Item extends object,
> {
  readonly SelectorBar: NativeConstructor<Instance>
}

interface SelectorBarAdapterProps<
  Instance extends SelectorBarInstance<Item>,
  Item extends object,
> {
  readonly selectedIndex?: MaybeSignal<number>
  readonly onSelectedIndexChange?: MaybeSignal<
    (index: number, sender: Instance) => void
  >
}

export type SelectorBarProps<
  Instance extends SelectorBarInstance<Item>,
  Item extends object,
> =
  & Omit<
      NativeComponentProps<
        Instance,
        SelectorBarAdapterProps<Instance, Item>
      >,
      'selectedItem'
    >
  & SelectorBarAdapterProps<Instance, Item>

function requireCollectionSize(
  collection: NativeCollection,
): number {
  const size = collection.size ?? collection.length
  if (typeof size !== 'number') {
    throw new Error(
      'SelectorBar items must expose size or length.',
    )
  }
  return size
}

function requireItemAt<Item extends object>(
  collection: NativeCollection,
  index: number,
): Item {
  if (!collection.getAt) {
    throw new Error(
      'SelectorBar items must expose getAt(index).',
    )
  }
  return collection.getAt(index) as Item
}

function selectedIndexOf<Item extends object>(
  instance: SelectorBarInstance<Item>,
): number {
  const selected = instance.selectedItem
  if (selected === null) {
    return -1
  }
  const indexOf = (
    instance.items as NativeCollection & {
      indexOf?(value: Item): number
    }
  ).indexOf
  if (indexOf) {
    return indexOf.call(instance.items, selected)
  }
  const size = requireCollectionSize(instance.items)
  for (let index = 0; index < size; index += 1) {
    if (requireItemAt<Item>(instance.items, index) === selected) {
      return index
    }
  }
  return -1
}

export function createSelectorBarControl<
  Instance extends SelectorBarInstance<Item>,
  Item extends object,
>(
  bindings: SelectorBarControlBindings<Instance, Item>,
): Component<SelectorBarProps<Instance, Item>> {
  const desiredIndexes = new WeakMap<Instance, number>()
  const applyingSelection = new WeakSet<Instance>()
  const mutatingItems = new WeakSet<Instance>()
  const modelBindings = new WeakMap<
    Instance,
    {
      readonly read: () => number
      readonly callback:
        | MaybeSignal<
            (index: number, sender: Instance) => void
          >
        | undefined
    }
  >()
  const applySelection = (
    instance: Instance,
    desired: number,
  ) => {
    desiredIndexes.set(instance, desired)
    if (desired < 0) {
      applyingSelection.add(instance)
      try {
        instance.selectedItem = null
      }
      finally {
        applyingSelection.delete(instance)
      }
      return
    }
    const size = requireCollectionSize(instance.items)
    if (size === 0) {
      return
    }
    if (desired >= size) {
      throw new RangeError(
        `SelectorBar selectedIndex ${desired} exceeds the last item index ${size - 1}.`,
      )
    }
    applyingSelection.add(instance)
    try {
      instance.selectedItem =
        requireItemAt<Item>(instance.items, desired)
    }
    finally {
      applyingSelection.delete(instance)
    }
  }
  const notifyModel = (
    instance: Instance,
    index: number,
  ) => {
    const binding = modelBindings.get(instance)
    if (!binding) {
      return
    }
    let callbackError: unknown
    try {
      readSignal(binding.callback)?.(index, instance)
    }
    catch (error) {
      callbackError = error
    }
    let reassertError: unknown
    try {
      const latest = binding.read()
      desiredIndexes.set(instance, latest)
      if (latest !== index) {
        applySelection(instance, latest)
      }
    }
    catch (error) {
      reassertError = error
    }
    if (
      callbackError !== undefined &&
      reassertError !== undefined
    ) {
      throw new AggregateError(
        [callbackError, reassertError],
        'SelectorBar change callback and model reassertion failed.',
      )
    }
    if (callbackError !== undefined) {
      throw callbackError
    }
    if (reassertError !== undefined) {
      throw reassertError
    }
  }
  const reapplySelection = (instance: Instance) => {
    const binding = modelBindings.get(instance)
    const desired =
      binding?.read() ?? desiredIndexes.get(instance)
    if (desired !== undefined) {
      desiredIndexes.set(instance, desired)
    }
    if (
      desired === undefined ||
      selectedIndexOf(instance) === desired
    ) {
      return
    }
    if (desired < 0) {
      applyingSelection.add(instance)
      try {
        instance.selectedItem = null
      }
      finally {
        applyingSelection.delete(instance)
      }
      return
    }
    const size = requireCollectionSize(instance.items)
    if (size === 0) {
      return
    }
    if (desired >= size) {
      notifyModel(instance, -1)
      return
    }
    applySelection(instance, desired)
  }
  const RawSelectorBar = native<
    Instance,
    SelectorBarAdapterProps<Instance, Item>
  >(bindings.SelectorBar, {
    displayName: 'SelectorBar',
    children:
      adapter.collectionSlot<
        SelectorBarInstance<Item>
      >('items', {
        beforeSync: (instance) => {
          mutatingItems.add(instance as Instance)
        },
        afterSync: (instance) =>
          reapplySelection(instance as Instance),
        finallySync: (instance) => {
          mutatingItems.delete(instance as Instance)
        },
      }),
  })

  return function SelectorBar(
    props: SelectorBarProps<Instance, Item>,
  ): Child {
    const rawSelectedItem = (
      props as SelectorBarProps<Instance, Item> & {
        readonly selectedItem?: unknown
      }
    ).selectedItem
    if (rawSelectedItem !== undefined) {
      throw new TypeError(
        'createSelectorBarControl() controls selection by selectedIndex; use the raw native SelectorBar for selectedItem.',
      )
    }
    const {
      selectedIndex,
      onSelectedIndexChange,
      onSelectionChanged,
      ref: userRef,
      ...rest
    } = props as SelectorBarProps<Instance, Item> & {
      readonly ref?: Ref<Instance>
      readonly onSelectionChanged?: MaybeSignal<
        (sender: Instance, ...args: unknown[]) => void
      >
    }
    if (selectedIndex === undefined) {
      return RawSelectorBar({
        ...(rest as NativeComponentProps<
          Instance,
          SelectorBarAdapterProps<Instance, Item>
        >),
        ...(userRef === undefined ? {} : { ref: userRef }),
        ...(onSelectionChanged === undefined
          ? {}
          : { onSelectionChanged }),
      })
    }

    const instance = signal<Instance | null>(null)
    const resolvedIndex = computed(() =>
      coerceSelectedIndex(
        readSignal(selectedIndex),
        'SelectorBar',
      ),
    )
    const handleRef: Ref<Instance> = (value) => {
      const previous = instance.peek()
      if (previous) {
        modelBindings.delete(previous)
        desiredIndexes.delete(previous)
      }
      if (value) {
        modelBindings.set(value, {
          read: () => resolvedIndex.peek(),
          callback: onSelectedIndexChange,
        })
        desiredIndexes.set(
          value,
          resolvedIndex.peek(),
        )
      }
      instance.value = value
      setRef(userRef, value)
    }
    effect(() => {
      const current = instance.value
      const desired = resolvedIndex.value
      if (!current) {
        return
      }
      desiredIndexes.set(current, desired)
      if (!mutatingItems.has(current)) {
        applySelection(current, desired)
      }
    })
    const handleSelectionChanged = (
      sender: Instance,
      ...args: unknown[]
    ) => {
      let rawEventError: unknown
      try {
        readSignal(onSelectionChanged)?.(sender, ...args)
      }
      catch (error) {
        rawEventError = error
      }
      const current = instance.peek() ?? sender
      if (
        applyingSelection.has(current) ||
        mutatingItems.has(current)
      ) {
        if (rawEventError !== undefined) {
          throw rawEventError
        }
        return
      }
      let controlledError: unknown
      try {
        notifyModel(current, selectedIndexOf(current))
      }
      catch (error) {
        controlledError = error
      }
      if (
        rawEventError !== undefined &&
        controlledError !== undefined
      ) {
        throw new AggregateError(
          [rawEventError, controlledError],
          'SelectorBar raw and controlled selection callbacks failed.',
        )
      }
      if (rawEventError !== undefined) {
        throw rawEventError
      }
      if (controlledError !== undefined) {
        throw controlledError
      }
    }

    return RawSelectorBar({
      ...(rest as NativeComponentProps<
        Instance,
        SelectorBarAdapterProps<Instance, Item>
      >),
      ref: handleRef,
      onSelectionChanged: handleSelectionChanged,
    })
  }
}
