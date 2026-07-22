import {
  adapter,
  type NativeItemsRepeaterData,
} from './adapters'
import { For, type ForProps } from './control-flow'
import {
  native,
  type NativeComponentProps,
  type NativeConstructor,
} from './native'
import type { MaybeSignal } from './reactive'
import type { Child, Key } from './vnode'

export interface ItemsRepeaterInstance {
  itemsSource: unknown
  itemTemplate: unknown
  clearValue?(property: unknown): void
}

export interface ItemsRepeaterItemHost {
  content: unknown
}

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

interface ItemsRepeaterAdapterProps<Item> {
  readonly virtualizedItems: NativeItemsRepeaterData<Item>
}

export function createItemsRepeaterControl<
  Instance extends ItemsRepeaterInstance,
  Host extends ItemsRepeaterItemHost,
>(
  bindings: ItemsRepeaterControlBindings<Instance, Host>,
): <Item>(
  props: ItemsRepeaterProps<Instance, Item>,
) => Child {
  const RawItemsRepeater = native<
    Instance,
    ItemsRepeaterAdapterProps<unknown>
  >(bindings.ItemsRepeater, {
    displayName: 'ItemsRepeater',
    adapters: {
      virtualizedItems: adapter.itemsRepeater<Instance>({
        createElementHost: () => new bindings.ContentControl(),
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
          if (
            instance.clearValue &&
            bindings.ItemsRepeater.itemsSourceProperty
          ) {
            instance.clearValue(
              bindings.ItemsRepeater.itemsSourceProperty,
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

  return function ItemsRepeater<Item>(
    props: ItemsRepeaterProps<Instance, Item>,
  ): Child {
    const {
      each,
      children,
      key,
      ...nativeProps
    } = props
    const list = For({ each, children, key })
    return RawItemsRepeater({
      ...nativeProps,
      virtualizedItems: {
        readItems: list.readItems,
        renderItem: list.renderItem,
        getKey: list.getKey,
      },
    } as NativeComponentProps<
      Instance,
      ItemsRepeaterAdapterProps<unknown>
    >)
  }
}
