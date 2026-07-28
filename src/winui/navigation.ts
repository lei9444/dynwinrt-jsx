import {
  native,
  type NativeComponent,
  type NativeConstructor,
} from '../renderer/native'
import { adapter } from '../renderer/adapters'
import {
  createRoot,
  effect,
  signal,
  type Cleanup,
  type MaybeSignal,
  type ReadonlySignal,
} from '../core/reactive'
import {
  createDynamicNode,
  type Child,
} from '../core/vnode'
import type { NativeCollection } from '../renderer/renderer'

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

export interface NavigationHostOptions<Route> {
  readonly route: ReadonlySignal<Route>
  readonly navigate: (route: Route) => void
  readonly enqueue: (callback: () => void) => boolean
  readonly selectRoute: (route: Route) => void
  readonly equals?: (left: Route, right: Route) => boolean
  readonly describeRoute?: (route: Route) => string
}

export interface NavigationHost<Route> {
  readonly renderedRoute: ReadonlySignal<Route | null>
  readonly disposed: boolean
  requestNativeNavigation(route: Route): void
  synchronizeSelection(): void
  render(renderRoute: (route: Route) => Child): Child
  dispose(): void
}

export function createNavigationHost<Route>(
  options: NavigationHostOptions<Route>,
): NavigationHost<Route> {
  return createRoot((disposeRoot: Cleanup) => {
    const equals = options.equals ?? Object.is
    const describeRoute =
      options.describeRoute ?? ((route: Route) => String(route))
    const renderedRoute = signal<Route | null>(
      options.route.peek(),
    )
    let pendingNavigation: { readonly route: Route } | null =
      null
    let nativeSelection: { readonly route: Route } | null =
      null
    let navigationQueued = false
    let nativeRenderPending = false
    let selectionWriteInProgress = false
    let committingNativeNavigation = false
    let renderGeneration = 0
    let outletCreated = false
    let disposed = false

    const ensureActive = (operation: string) => {
      if (disposed) {
        throw new Error(
          `Cannot ${operation} on a disposed NavigationHost.`,
        )
      }
    }

    const synchronizeRouteSelection = (route: Route) => {
      selectionWriteInProgress = true
      try {
        options.selectRoute(route)
      }
      finally {
        selectionWriteInProgress = false
      }
    }

    const cancelPendingNativeTransition = (route: Route) => {
      pendingNavigation = null
      if (!nativeRenderPending) {
        return
      }
      nativeRenderPending = false
      renderGeneration += 1
      renderedRoute.value = route
    }

    const restoreAfterTransitionFailure = (
      requestedRoute: Route,
      error: unknown,
    ): never => {
      if (disposed) {
        throw error
      }
      const currentRoute = options.route.peek()
      const shouldRestoreSelection =
        nativeSelection !== null &&
        !equals(requestedRoute, currentRoute)
      nativeSelection = null
      nativeRenderPending = false
      renderedRoute.value = currentRoute
      if (
        disposed ||
        !equals(options.route.peek(), currentRoute) ||
        navigationQueued ||
        pendingNavigation !== null
      ) {
        throw error
      }
      if (!shouldRestoreSelection) {
        throw error
      }
      try {
        synchronizeRouteSelection(currentRoute)
      }
      catch (selectionError) {
        throw new AggregateError(
          [error, selectionError],
          `Navigation route '${describeRoute(requestedRoute)}' failed and selection restoration also failed.`,
        )
      }
      throw error
    }

    const failInitialNavigation = (
      requestedRoute: Route,
      error: unknown,
    ): never => {
      navigationQueued = false
      pendingNavigation = null
      nativeSelection = null
      if (disposed) {
        throw error
      }
      try {
        synchronizeRouteSelection(options.route.peek())
      }
      catch (selectionError) {
        throw new AggregateError(
          [error, selectionError],
          `Navigation route '${describeRoute(requestedRoute)}' could not be queued and selection restoration also failed.`,
        )
      }
      throw error
    }

    const commitNavigation = () => {
      navigationQueued = false
      const pending = pendingNavigation
      pendingNavigation = null
      if (disposed || pending === null) {
        return
      }

      const requestedRoute = pending.route
      if (equals(requestedRoute, options.route.peek())) {
        if (
          nativeSelection !== null &&
          equals(nativeSelection.route, requestedRoute)
        ) {
          nativeSelection = null
        }
        if (nativeRenderPending) {
          nativeRenderPending = false
          renderedRoute.value = options.route.peek()
        }
        return
      }

      nativeRenderPending = true
      const generation = ++renderGeneration
      renderedRoute.value = null
      if (
        disposed ||
        generation !== renderGeneration
      ) {
        return
      }
      committingNativeNavigation = true
      try {
        options.navigate(requestedRoute)
      }
      catch (error) {
        if (disposed) {
          throw error
        }
        restoreAfterTransitionFailure(requestedRoute, error)
      }
      finally {
        committingNativeNavigation = false
      }
      if (
        disposed ||
        generation !== renderGeneration
      ) {
        return
      }

      const mount = () => {
        if (
          disposed ||
          generation !== renderGeneration ||
          navigationQueued ||
          pendingNavigation !== null
        ) {
          return
        }

        const currentRoute = options.route.peek()
        const shouldRestoreSelection =
          nativeSelection !== null &&
          !equals(nativeSelection.route, currentRoute)
        nativeSelection = null
        let selectionError: unknown
        if (shouldRestoreSelection) {
          try {
            synchronizeRouteSelection(currentRoute)
          }
          catch (error) {
            selectionError = error
          }
        }
        if (
          disposed ||
          generation !== renderGeneration
        ) {
          if (selectionError !== undefined) {
            throw selectionError
          }
          return
        }
        nativeRenderPending = false
        renderedRoute.value = currentRoute
        if (selectionError !== undefined) {
          throw selectionError
        }
      }
      let mountQueued = false
      try {
        mountQueued = options.enqueue(mount)
      }
      catch (error) {
        restoreAfterTransitionFailure(requestedRoute, error)
      }
      if (!mountQueued) {
        restoreAfterTransitionFailure(
          requestedRoute,
          new Error(
            `Failed to mount navigation route '${describeRoute(requestedRoute)}'.`,
          ),
        )
      }
    }

    effect(() => {
      const route = options.route.value
      if (!nativeRenderPending) {
        renderedRoute.value = route
      }
    })

    effect(() => {
      const route = options.route.value
      if (nativeSelection !== null) {
        const selectedRoute = nativeSelection.route
        nativeSelection = null
        if (equals(selectedRoute, route)) {
          return
        }
        if (!committingNativeNavigation) {
          cancelPendingNativeTransition(route)
        }
      }
      else if (
        nativeRenderPending &&
        !committingNativeNavigation
      ) {
        cancelPendingNativeTransition(route)
      }
      synchronizeRouteSelection(route)
    })

    const controller: NavigationHost<Route> = {
      renderedRoute,
      get disposed() {
        return disposed
      },
      requestNativeNavigation(route) {
        ensureActive('request native navigation')
        if (selectionWriteInProgress) {
          return
        }

        nativeSelection = { route }
        pendingNavigation = { route }
        if (navigationQueued) {
          return
        }

        navigationQueued = true
        let queued = false
        try {
          queued = options.enqueue(commitNavigation)
        }
        catch (error) {
          failInitialNavigation(route, error)
        }
        if (!queued) {
          failInitialNavigation(
            route,
            new Error(
              `Failed to queue navigation route '${describeRoute(route)}'.`,
            ),
          )
        }
      },
      synchronizeSelection() {
        ensureActive('synchronize selection')
        synchronizeRouteSelection(options.route.peek())
      },
      render(renderRoute) {
        ensureActive('create a navigation outlet')
        if (outletCreated) {
          throw new Error(
            'NavigationHost supports one owned navigation outlet.',
          )
        }
        outletCreated = true
        return createDynamicNode(
          () => {
            const route = renderedRoute.value
            return route === null ? null : renderRoute(route)
          },
          () => controller.dispose(),
        )
      },
      dispose() {
        if (disposed) {
          return
        }
        disposed = true
        pendingNavigation = null
        nativeSelection = null
        renderGeneration += 1
        disposeRoot()
      },
    }
    return controller
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

export interface NavigationItemRecord<
  Item,
  Text,
> {
  readonly item: Item
  readonly label: Text
}

export function createNavigationItemRecord<
  Item extends NavigationItemInstance,
  Text extends TextInstance,
>(
  bindings: NavigationItemBindings<Item, Text>,
  options: NavigationItemOptions<Item['icon']>,
): NavigationItemRecord<Item, Text> {
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
  return {
    item,
    label,
  }
}

export function createNavigationItem<
  Item extends NavigationItemInstance,
  Text extends TextInstance,
>(
  bindings: NavigationItemBindings<Item, Text>,
  options: NavigationItemOptions<Item['icon']>,
): Item {
  return createNavigationItemRecord(
    bindings,
    options,
  ).item
}
