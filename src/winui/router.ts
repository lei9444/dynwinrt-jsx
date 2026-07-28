import type {
  Router,
  RouterTarget,
} from '../core/router'
import {
  createNavigationHost,
  createNavigationItem,
  type NavigationHost,
  type NavigationItemBindings,
  type NavigationItemOptions,
} from './navigation'
import type { Child } from '../core/vnode'
import type { NativeCollection } from '../renderer/renderer'
import {
  createProjectedValueOwner,
  type ProjectedValueOwner,
} from '../runtime/projected-owner'

export interface RouterNavigationHostOptions {
  readonly enqueue: (callback: () => void) => boolean
  readonly selectRoute: (routeId: string) => void
  readonly describeRoute?: (routeId: string) => string
  readonly targetForRoute?: (
    routeId: string,
  ) => RouterTarget
}

export function createRouterNavigationHost<
  State = unknown,
  Handle = unknown,
>(
  router: Router<State, Handle>,
  options: RouterNavigationHostOptions,
): NavigationHost<string> {
  if (
    typeof options !== 'object' ||
    options === null ||
    typeof options.enqueue !== 'function' ||
    typeof options.selectRoute !== 'function'
  ) {
    throw new TypeError(
      'createRouterNavigationHost() requires enqueue and selectRoute callbacks.',
    )
  }
  return createNavigationHost({
    route: router.navigationRouteId,
    navigate(routeId) {
      router.navigate(
        options.targetForRoute?.(routeId) ??
          { routeId },
        {
        trigger: 'native',
        },
      )
    },
    enqueue: options.enqueue,
    selectRoute: options.selectRoute,
    describeRoute: options.describeRoute,
  })
}

interface RouterNavigationItemInstance {
  readonly menuItems?: NativeCollection
  name: string
  content: unknown
  icon: unknown
  selectsOnInvoked: boolean
  isExpanded?: boolean
}

interface RouterNavigationTextInstance {
  text: string
}

export interface RouterNavigationViewInstance {
  selectedItem: unknown
  readonly settingsItem?: unknown
}

export interface RouterNavigationSelectionChangedEvent {
  readonly isSettingsSelected: boolean
  readonly selectedItemContainer: {
    readonly name: string
  } | null
}

export interface RouterNavigationViewItemDefinition<
  RouteId extends string = string,
  Icon = unknown,
> extends Omit<
  NavigationItemOptions<Icon>,
  'name' | 'selectsOnInvoked'
> {
  readonly name?: string
  readonly routeId?: RouteId
  readonly selectable?: boolean
  readonly children?: readonly RouterNavigationViewItemDefinition<
    RouteId,
    Icon
  >[]
}

export interface RouterNavigationViewShellOptions<
  RouteId extends string,
  State,
  Handle,
  Item extends RouterNavigationItemInstance,
  Text extends RouterNavigationTextInstance,
  ReleaseResult = void,
> {
  readonly router: Router<State, Handle>
  readonly bindings: NavigationItemBindings<Item, Text>
  readonly items: readonly RouterNavigationViewItemDefinition<
    RouteId,
    Item['icon']
  >[]
  readonly footerItems?: readonly RouterNavigationViewItemDefinition<
    RouteId,
    Item['icon']
  >[]
  readonly settingsRouteId?: RouteId
  readonly enqueue: (callback: () => void) => boolean
  readonly releaseProjected: Extract<
    ReleaseResult,
    PromiseLike<unknown>
  > extends never
    ? (value: object) => ReleaseResult
    : never
  readonly targetForRoute?: (
    routeId: string,
  ) => RouterTarget
  readonly describeRoute?: (routeId: string) => string
}

export interface RouterNavigationViewShell<
  RouteId extends string,
  Item,
> {
  readonly menuItems: readonly Item[]
  readonly footerMenuItems: readonly Item[]
  readonly host: NavigationHost<string>
  readonly navigation: RouterNavigationViewInstance | null
  readonly disposed: boolean
  ref(value: RouterNavigationViewInstance | null): void
  onSelectionChanged(
    sender: RouterNavigationViewInstance,
    event: RouterNavigationSelectionChangedEvent,
  ): void
  itemForRoute(routeId: RouteId): Item | null
  render(renderRoute: (routeId: string) => Child): Child
  dispose(): void
}

export function createRouterNavigationViewShell<
  RouteId extends string,
  State = unknown,
  Handle = unknown,
  Item extends RouterNavigationItemInstance =
    RouterNavigationItemInstance,
  Text extends RouterNavigationTextInstance =
    RouterNavigationTextInstance,
  ReleaseResult = void,
>(
  options: RouterNavigationViewShellOptions<
    RouteId,
    State,
    Handle,
    Item,
    Text,
    ReleaseResult
  >,
): RouterNavigationViewShell<RouteId, Item> {
  if (
    typeof options !== 'object' ||
    options === null ||
    typeof options.enqueue !== 'function' ||
    typeof options.releaseProjected !== 'function' ||
    !Array.isArray(options.items) ||
    (
      options.footerItems !== undefined &&
      !Array.isArray(options.footerItems)
    )
  ) {
    throw new TypeError(
      'createRouterNavigationViewShell() requires router, bindings, items, and enqueue options.',
    )
  }

  const routeItems = new Map<string, Item>()
  const itemRoutes = new Map<object, string>()
  const nameRoutes = new Map<string, string>()
  const parentItems = new Map<Item, Item>()
  const names = new Set<string>()
  const projectedOwners: ProjectedValueOwner<object>[] = []
  const disposeProjectedOwners = (): unknown => {
    let firstError: unknown
    for (
      let index = projectedOwners.length - 1;
      index >= 0;
      index -= 1
    ) {
      try {
        projectedOwners[index]!.dispose()
      }
      catch (error) {
        firstError ??= error
      }
    }
    return firstError
  }

  const createItems = (
    definitions: readonly RouterNavigationViewItemDefinition<
      RouteId,
      Item['icon']
    >[],
    parent: Item | null,
  ): Item[] => definitions.map((definition) => {
    const name = definition.name ?? definition.routeId
    if (
      typeof name !== 'string' ||
      name.length === 0
    ) {
      throw new TypeError(
        'Router navigation items require a non-empty name or routeId.',
      )
    }
    if (names.has(name)) {
      throw new Error(
        `Duplicate router navigation item name '${name}'.`,
      )
    }
    names.add(name)
    if (
      definition.routeId !== undefined &&
      routeItems.has(definition.routeId)
    ) {
      throw new Error(
        `Duplicate router navigation route '${definition.routeId}'.`,
      )
    }

    const children = definition.children ?? []
    const selectable =
      definition.selectable ??
      definition.routeId !== undefined
    const item = createNavigationItem(
      options.bindings,
      {
        ...definition,
        name,
        selectsOnInvoked: selectable,
      },
    )
    if (
      typeof item.content === 'object' &&
      item.content !== null
    ) {
      projectedOwners.push(
        createProjectedValueOwner(
          item.content,
          options.releaseProjected,
        ),
      )
    }
    projectedOwners.push(
      createProjectedValueOwner(
        item,
        options.releaseProjected,
      ),
    )
    if (parent !== null) {
      parentItems.set(item, parent)
    }
    if (definition.routeId !== undefined) {
      routeItems.set(definition.routeId, item)
      itemRoutes.set(item, definition.routeId)
      nameRoutes.set(name, definition.routeId)
    }
    if (children.length > 0) {
      if (!item.menuItems) {
        throw new Error(
          `Router navigation item '${name}' has children but does not expose menuItems.`,
        )
      }
      for (const child of createItems(children, item)) {
        item.menuItems.append(child)
      }
    }
    return item
  })

  let menuItems: Item[]
  let footerMenuItems: Item[]
  try {
    menuItems = createItems(options.items, null)
    footerMenuItems = createItems(
      options.footerItems ?? [],
      null,
    )
  }
  catch (error) {
    const releaseError = disposeProjectedOwners()
    if (releaseError !== undefined) {
      throw new AggregateError(
        [error, releaseError],
        'Router navigation item creation and cleanup failed.',
      )
    }
    throw error
  }
  let navigation: RouterNavigationViewInstance | null = null
  let disposed = false
  let disposing = false

  const itemForRoute = (routeId: RouteId): Item | null =>
    routeItems.get(routeId) ?? null

  const selectRoute = (routeId: string) => {
    if (navigation === null) {
      return
    }
    const settingsItem = navigation.settingsItem
    const item =
      options.settingsRouteId === routeId
        ? (
            typeof settingsItem === 'object' &&
            settingsItem !== null
              ? settingsItem as Item
              : null
          )
        : routeItems.get(routeId) ?? null
    if (item === null) {
      return
    }
    navigation.selectedItem = item
    let parent = parentItems.get(item)
    while (parent !== undefined) {
      parent.isExpanded = true
      parent = parentItems.get(parent)
    }
  }

  const host = createRouterNavigationHost(
    options.router,
    {
      enqueue: options.enqueue,
      selectRoute,
      describeRoute: options.describeRoute,
      targetForRoute: options.targetForRoute,
    },
  )

  const ensureActive = (operation: string) => {
    if (disposed || host.disposed) {
      throw new Error(
        `Cannot ${operation} on a disposed RouterNavigationViewShell.`,
      )
    }
  }

  const shell: RouterNavigationViewShell<
    RouteId,
    Item
  > = {
    menuItems,
    footerMenuItems,
    host,
    get navigation() {
      return navigation
    },
    get disposed() {
      return disposed
    },
    ref(value) {
      ensureActive('set the navigation ref')
      navigation = value
      if (value !== null) {
        host.synchronizeSelection()
      }
    },
    onSelectionChanged(_sender, event) {
      ensureActive('handle navigation selection')
      if (event.isSettingsSelected) {
        if (options.settingsRouteId !== undefined) {
          host.requestNativeNavigation(
            options.settingsRouteId,
          )
        }
        return
      }
      const selected = event.selectedItemContainer
      if (selected === null) {
        return
      }
      const routeId =
        itemRoutes.get(selected) ??
        nameRoutes.get(selected.name)
      if (routeId !== undefined) {
        host.requestNativeNavigation(routeId)
      }
    },
    itemForRoute,
    render(renderRoute) {
      ensureActive('render the navigation outlet')
      return host.render(renderRoute)
    },
    dispose() {
      if (disposed || disposing) {
        return
      }
      disposing = true
      let firstError: unknown
      try {
        navigation = null
        host.dispose()
        firstError = disposeProjectedOwners()
        if (firstError === undefined) {
          disposed = true
        }
      }
      finally {
        disposing = false
      }
      if (firstError !== undefined) {
        throw firstError
      }
    },
  }
  return shell
}
