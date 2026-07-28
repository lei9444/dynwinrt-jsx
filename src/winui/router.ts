import type {
  Router,
  RouterTarget,
} from '../core/router'
import {
  createNavigationHost,
  type NavigationHost,
} from './navigation'

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
