import {
  native,
  type NativeComponent,
  type NativeConstructor,
} from './native'
import { adapter } from './adapters'
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
    adapters: {
      menuItems: adapter.collection<NavigationView>({
        get: (instance) => instance.menuItems,
        label: 'NavigationView menuItems',
      }),
      footerMenuItems: adapter.collection<NavigationView>({
        get: (instance) => instance.footerMenuItems,
        label: 'NavigationView footerMenuItems',
      }),
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
  setPositionInSet?(target: object, value: number): void
  setSizeOfSet?(target: object, value: number): void
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
  readonly automationPositionInSet?: number
  readonly automationSizeOfSet?: number
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
  if (options.automationPositionInSet !== undefined) {
    if (!bindings.AutomationProperties?.setPositionInSet) {
      throw new Error(
        'Navigation item automationPositionInSet requires AutomationProperties bindings.',
      )
    }
    bindings.AutomationProperties.setPositionInSet(
      item,
      options.automationPositionInSet,
    )
  }
  if (options.automationSizeOfSet !== undefined) {
    if (!bindings.AutomationProperties?.setSizeOfSet) {
      throw new Error(
        'Navigation item automationSizeOfSet requires AutomationProperties bindings.',
      )
    }
    bindings.AutomationProperties.setSizeOfSet(
      item,
      options.automationSizeOfSet,
    )
  }
  return item
}
