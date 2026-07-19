import {
  native,
  type NativeComponent,
  type NativeConstructor,
} from './native'
import {
  replaceNativeCollection,
  requireNativeArray,
} from './native-collection'
import type { MaybeSignal } from './reactive'
import type { NativeCollection } from './renderer'

export interface NavigationViewCollectionProps<Item> {
  menuItems?: MaybeSignal<readonly Item[]>
  footerMenuItems?: MaybeSignal<readonly Item[]>
}

interface NavigationViewInstance {
  readonly menuItems: NativeCollection
  readonly footerMenuItems: NativeCollection
}

export interface NavigationViewControlBindings<
  NavigationView extends NavigationViewInstance,
> {
  readonly NavigationView: NativeConstructor<NavigationView>
}

export function createNavigationViewControl<
  NavigationView extends NavigationViewInstance,
  Item = unknown,
>(
  bindings: NavigationViewControlBindings<NavigationView>,
): NativeComponent<
  NavigationView,
  NavigationViewCollectionProps<Item>
> {
  return native<
    NavigationView,
    NavigationViewCollectionProps<Item>
  >(bindings.NavigationView, {
    displayName: 'NavigationView',
    setProperty(instance, property, value) {
      if (property === 'menuItems') {
        replaceNativeCollection(
          instance.menuItems,
          requireNativeArray(value, property),
          'NavigationView menuItems',
        )
        return true
      }

      if (property === 'footerMenuItems') {
        replaceNativeCollection(
          instance.footerMenuItems,
          requireNativeArray(value, property),
          'NavigationView footerMenuItems',
        )
        return true
      }

      return false
    },
  })
}

interface NavigationItemInstance {
  name: string
  content: unknown
  icon: unknown
  selectsOnInvoked: boolean
}

interface TextInstance {
  text: string
}

interface AutomationPropertiesBinding {
  setAutomationId(target: object, value: string): void
  setName(target: object, value: string): void
}

export interface NavigationItemBindings<
  Item extends NavigationItemInstance,
  Text extends TextInstance,
> {
  readonly NavigationViewItem: NativeConstructor<Item>
  readonly TextBlock: NativeConstructor<Text>
  readonly AutomationProperties?: AutomationPropertiesBinding
}

export interface NavigationItemOptions<Icon = unknown> {
  readonly name: string
  readonly label: string
  readonly icon?: Icon
  readonly selectsOnInvoked?: boolean
  readonly automationId?: string
  readonly automationName?: string
}

export function createNavigationItem<
  Item extends NavigationItemInstance,
  Text extends TextInstance,
>(
  bindings: NavigationItemBindings<Item, Text>,
  options: NavigationItemOptions<Item['icon']>,
): Item {
  const item = new bindings.NavigationViewItem()
  const label = new bindings.TextBlock()
  label.text = options.label
  item.name = options.name
  item.content = label
  item.selectsOnInvoked = options.selectsOnInvoked ?? true
  if (options.icon !== undefined) {
    item.icon = options.icon
  }
  if (options.automationId !== undefined) {
    if (!bindings.AutomationProperties) {
      throw new Error(
        'Navigation item automationId requires AutomationProperties bindings.',
      )
    }
    bindings.AutomationProperties.setAutomationId(
      item,
      options.automationId,
    )
  }
  if (options.automationName !== undefined) {
    if (!bindings.AutomationProperties) {
      throw new Error(
        'Navigation item automationName requires AutomationProperties bindings.',
      )
    }
    bindings.AutomationProperties.setName(item, options.automationName)
  }
  return item
}
