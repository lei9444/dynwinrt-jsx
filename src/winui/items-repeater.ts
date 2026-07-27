import {
  adapter,
  type NativeItemsRepeaterData,
} from '../renderer/adapters'
import { For, type ForProps } from '../core/control-flow'
import {
  native,
  type NativeComponentProps,
  type NativeConstructor,
} from '../renderer/native'
import type { MaybeSignal } from '../core/reactive'
import type { Child, Key } from '../core/vnode'

export interface VirtualizedItemsInstance {
  itemsSource: unknown
  itemTemplate: unknown
  clearValue?(property: unknown): void
}

export type VirtualizedItemsMountHost =
  | { content: unknown }
  | { child: unknown }
  | { readonly children: object }
  | { readonly items: object }

export type VirtualizedItemsHost = VirtualizedItemsMountHost

interface ElementFactoryType {
  create(
    getElement: (args: { readonly data: unknown }) => object,
    recycleElement: (args: {
      readonly element: object | null | undefined
    }) => void,
  ): {
    releaseCallbacks(): void
  }
}

interface MutableObjectVector {
  insertAt(index: number, value: unknown): void
  removeAt(index: number): void
  append(value: unknown): void
  clear(): void
}

interface ObservableObjectVectorType {
  create(items: unknown[]): MutableObjectVector & object
}

interface PropertyValueType {
  createInt32(value: number): unknown
}

interface ReferenceInt32Type {
  from(value: unknown): { readonly value: number }
}

interface VirtualizedItemsControlBindingsBase<
  Instance extends VirtualizedItemsInstance,
  Host extends object,
> {
  readonly Control: NativeConstructor<Instance>
    & {
      readonly itemsSourceProperty?: unknown
      readonly itemTemplateProperty?: unknown
    }
  readonly ItemHost: NativeConstructor<Host>
  readonly initializeItemHost?: (host: Host) => void
  readonly clearItemsSource?: (instance: Instance) => void
  readonly IElementFactory: ElementFactoryType
  readonly IObservableVector_Object:
    ObservableObjectVectorType
  readonly PropertyValue: PropertyValueType
  readonly IReference_Int32: ReferenceInt32Type
}

export type VirtualizedItemsControlBindings<
  Instance extends VirtualizedItemsInstance,
  Host extends object,
  MountHost extends VirtualizedItemsMountHost =
    Extract<Host, VirtualizedItemsMountHost>,
> =
  & VirtualizedItemsControlBindingsBase<Instance, Host>
  & (
    | {
        readonly getItemMountHost: (
          host: Host,
        ) => MountHost
      }
    | (
        Host extends VirtualizedItemsMountHost
          ? {
              readonly getItemMountHost?: undefined
            }
          : never
      )
  )

export type VirtualizedItemsProps<
  Instance extends VirtualizedItemsInstance,
  Item,
> =
  & Omit<
      NativeComponentProps<Instance>,
      'children' | 'itemsSource' | 'itemTemplate'
    >
  & {
      readonly each: MaybeSignal<readonly Item[]>
      readonly children: (
        item: Item,
        index: Parameters<ForProps<Item>['children']>[1],
      ) => Child
      readonly key?: (item: Item, index: number) => Key
    }

interface VirtualizedItemsAdapterProps<Item> {
  readonly virtualizedItems: NativeItemsRepeaterData<Item>
}

export function createVirtualizedItemsControl<
  Instance extends VirtualizedItemsInstance,
  Host extends object,
  MountHost extends VirtualizedItemsMountHost =
    Extract<Host, VirtualizedItemsMountHost>,
>(
  bindings: VirtualizedItemsControlBindings<
    Instance,
    Host,
    MountHost
  >,
  options: {
    readonly displayName?: string
    readonly ownsItemMountHost?: boolean
  } = {},
): <Item>(
  props: VirtualizedItemsProps<Instance, Item>,
) => Child {
  const displayName =
    options.displayName ?? 'VirtualizedItemsControl'
  const RawControl = native<
    Instance,
    VirtualizedItemsAdapterProps<unknown>
  >(bindings.Control, {
    displayName,
    adapters: {
      virtualizedItems: adapter.itemsRepeater<Instance>({
        createElementHost: () => {
          const host = new bindings.ItemHost()
          bindings.initializeItemHost?.(host)
          return host
        },
        ...(bindings.getItemMountHost
          ? {
              getElementMountHost: (host: object) =>
                bindings.getItemMountHost!(host as Host),
              ownsElementMountHost:
                options.ownsItemMountHost === true,
            }
          : {}),
        createElementFactory: (factory) =>
          bindings.IElementFactory.create(
            (args) => factory.getElement(args),
            (args) => factory.recycleElement(args),
          ),
        createItemsSourceValue: (key) =>
          bindings.PropertyValue.createInt32(
            Number.parseInt(key, 10),
          ),
        readItemsSourceKey: (value) =>
          String(
            bindings.IReference_Int32.from(value).value,
          ),
        createItemsSource: (values) =>
          bindings.IObservableVector_Object.create([
            ...values,
          ]),
        setItemsSource: (instance, source) => {
          instance.itemsSource = source
        },
        setItemTemplate: (instance, factory) => {
          instance.itemTemplate = factory
        },
        clearItemsSource: (instance) => {
          if (bindings.clearItemsSource) {
            bindings.clearItemsSource(instance)
            return
          }
          if (
            instance.clearValue &&
            bindings.Control.itemsSourceProperty
          ) {
            instance.clearValue(
              bindings.Control.itemsSourceProperty,
            )
          }
          else {
            instance.itemsSource = null
          }
        },
        releaseElementFactory: (factory) => {
          ;(
            factory as {
              releaseCallbacks(): void
            }
          ).releaseCallbacks()
        },
      }),
    },
  })

  return function VirtualizedItemsControl<Item>(
    props: VirtualizedItemsProps<Instance, Item>,
  ): Child {
    const {
      each,
      children,
      key,
      ...nativeProps
    } = props
    const list = For({ each, children, key })
    return RawControl({
      ...nativeProps,
      virtualizedItems: {
        readItems: list.readItems,
        renderItem: list.renderItem,
        getKey: list.getKey,
      },
    } as NativeComponentProps<
      Instance,
      VirtualizedItemsAdapterProps<unknown>
    >)
  }
}

export interface ItemsRepeaterInstance
  extends VirtualizedItemsInstance {}

export type ItemsRepeaterItemHost = {
  content: unknown
}

export interface ItemsRepeaterControlBindings<
  Instance extends ItemsRepeaterInstance,
  Host extends ItemsRepeaterItemHost,
> {
  readonly ItemsRepeater: NativeConstructor<Instance>
    & {
      readonly itemsSourceProperty?: unknown
      readonly itemTemplateProperty?: unknown
    }
  readonly ContentControl: NativeConstructor<Host>
  readonly IElementFactory: ElementFactoryType
  readonly IObservableVector_Object:
    ObservableObjectVectorType
  readonly PropertyValue: PropertyValueType
  readonly IReference_Int32: ReferenceInt32Type
}

export type ItemsRepeaterProps<
  Instance extends ItemsRepeaterInstance,
  Item,
> = VirtualizedItemsProps<Instance, Item>

export function createItemsRepeaterControl<
  Instance extends ItemsRepeaterInstance,
  Host extends ItemsRepeaterItemHost,
>(
  bindings: ItemsRepeaterControlBindings<Instance, Host>,
): <Item>(
  props: ItemsRepeaterProps<Instance, Item>,
) => Child {
  const virtualizedBindings:
    VirtualizedItemsControlBindings<Instance, Host, Host> = {
    Control: bindings.ItemsRepeater,
    ItemHost: bindings.ContentControl,
    getItemMountHost: (host) => host,
    IElementFactory: bindings.IElementFactory,
    IObservableVector_Object:
      bindings.IObservableVector_Object,
    PropertyValue: bindings.PropertyValue,
    IReference_Int32: bindings.IReference_Int32,
  }
  return createVirtualizedItemsControl(virtualizedBindings, {
    displayName: 'ItemsRepeater',
  })
}
