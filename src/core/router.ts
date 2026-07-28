import {
  batch,
  computed,
  createRoot,
  onCleanup,
  signal,
  type Cleanup,
  type ReadonlySignal,
  type Signal,
} from './reactive'
import {
  createContext,
  useContext,
} from './context'
import {
  createDynamicNode,
  createVNode,
  type Child,
} from './vnode'
import {
  parseRouterPath,
  resolveRouterPathname,
  stringifyRouterQuery,
} from './router-path'
import {
  buildRoutePath,
  compileRoutes,
  resolveRouteMatches,
  type CompiledRoute,
  type ResolvedRouteMatch,
} from './router-matcher'
import type {
  DiagnosticChannel,
  DiagnosticRouteAction,
  DiagnosticRouteEvent,
  DiagnosticRouteTrigger,
} from '../runtime/diagnostics'

export {
  parseRouterQuery,
  stringifyRouterQuery,
} from './router-path'

export type RouterParams =
  Readonly<Record<string, string>>

export type RouterQueryValue =
  string | readonly string[]

export type RouterQuery =
  Readonly<Record<string, RouterQueryValue>>

export type RouterQueryInputValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number | boolean)[]

export type RouterQueryInput =
  Readonly<Record<string, RouterQueryInputValue>>

export interface RouterLocation<State = unknown> {
  readonly key: string
  readonly pathname: string
  readonly search: string
  readonly hash: string
  readonly query: RouterQuery
  readonly state: State | undefined
}

export interface RouterHistorySnapshot<State = unknown> {
  readonly index: number
  readonly entries: readonly RouterLocation<State>[]
}

export interface RouteDefinition<
  State = unknown,
  Handle = unknown,
> {
  readonly id: string
  readonly path?: string
  readonly index?: boolean
  readonly parentId?: string
  readonly navigationId?: string
  readonly handle?: Handle
  readonly render: (
    context: RouteRenderContext<State, Handle>,
  ) => Child
  readonly children?: readonly RouteDefinition<State, Handle>[]
}

export interface RouteMatch<
  State = unknown,
  Handle = unknown,
> {
  readonly id: string
  readonly route: RouteDefinition<State, Handle>
  readonly handle: Handle | undefined
  readonly parentId: string | null
  readonly navigationId: string
  readonly params: ReadonlySignal<RouterParams>
  readonly pathname: ReadonlySignal<string>
}

export interface RouteRenderContext<
  State = unknown,
  Handle = unknown,
> {
  readonly router: Router<State, Handle>
  readonly match: RouteMatch<State, Handle>
  readonly depth: number
  readonly params: ReadonlySignal<RouterParams>
  readonly query: ReadonlySignal<RouterQuery>
  readonly state: ReadonlySignal<State | undefined>
  readonly location: ReadonlySignal<RouterLocation<State>>
}

export interface RouterInitialEntry<State = unknown> {
  readonly path: string
  readonly state?: State
}

export interface RouterPathTarget {
  readonly pathname?: string
  readonly routeId?: string
  readonly params?: Readonly<Record<string, string | number | boolean>>
  readonly query?: RouterQueryInput
  readonly search?: string
  readonly hash?: string
}

export type RouterTarget = string | RouterPathTarget

export interface RouterNavigationOptions<State = unknown> {
  readonly replace?: boolean
  readonly state?: State
  readonly trigger?: DiagnosticRouteTrigger
}

export interface RouterUpOptions {
  readonly replace?: boolean
  readonly trigger?: DiagnosticRouteTrigger
}

export interface RouterOptions<
  State = unknown,
  Handle = unknown,
> {
  readonly routes: readonly RouteDefinition<State, Handle>[]
  readonly initialEntries?: readonly (
    string | RouterInitialEntry<State>
  )[]
  readonly initialIndex?: number
  readonly initialRouteId?: string
  readonly initialRouteParams?: Readonly<
    Record<string, string | number | boolean>
  >
  readonly diagnostics?: DiagnosticChannel
  readonly onTransition?: (
    transition: DiagnosticRouteEvent,
  ) => void
}

export interface Router<
  State = unknown,
  Handle = unknown,
> {
  readonly location: ReadonlySignal<RouterLocation<State>>
  readonly pathname: ReadonlySignal<string>
  readonly query: ReadonlySignal<RouterQuery>
  readonly state: ReadonlySignal<State | undefined>
  readonly matches: ReadonlySignal<
    readonly RouteMatch<State, Handle>[]
  >
  readonly leafMatch: ReadonlySignal<
    RouteMatch<State, Handle> | null
  >
  readonly routeId: ReadonlySignal<string>
  readonly navigationRouteId: ReadonlySignal<string>
  readonly history: ReadonlySignal<RouterHistorySnapshot<State>>
  readonly canGoBack: ReadonlySignal<boolean>
  readonly canGoForward: ReadonlySignal<boolean>
  readonly canGoUp: ReadonlySignal<boolean>
  readonly lastTransition: ReadonlySignal<
    DiagnosticRouteEvent | null
  >
  readonly disposed: boolean
  navigate(
    target: RouterTarget,
    options?: RouterNavigationOptions<State>,
  ): void
  replace(
    target: RouterTarget,
    options?: Omit<RouterNavigationOptions<State>, 'replace'>,
  ): void
  back(): boolean
  forward(): boolean
  go(delta: number): boolean
  up(options?: RouterUpOptions): boolean
  pathFor(
    routeId: string,
    params?: Readonly<Record<string, string | number | boolean>>,
    query?: RouterQueryInput,
  ): string
  outlet(depth?: number, fallback?: Child): Child
  dispose(): void
}

export interface RouterProviderProps<
  State = unknown,
  Handle = unknown,
> {
  readonly router: Router<State, Handle>
  readonly children?: Child
  readonly disposeOnUnmount?: boolean
}

export interface OutletProps {
  readonly fallback?: Child
}

interface ActiveRouteMatch<
  State,
  Handle,
> extends RouteMatch<State, Handle> {
  readonly routeNode: CompiledRoute<State, Handle>
  readonly paramsSignal: Signal<RouterParams>
  readonly pathnameSignal: Signal<string>
}

interface HistoryEntry<State> {
  readonly key: string
  readonly path: string
  readonly state: State | undefined
}

const RouterContext =
  createContext<Router<unknown, unknown> | null>(null)
const RouteContext =
  createContext<RouteRenderContext<unknown, unknown> | null>(null)

function createLocation<State>(
  entry: HistoryEntry<State>,
): RouterLocation<State> {
  const parsed = parseRouterPath(entry.path)
  return Object.freeze({
    key: entry.key,
    ...parsed,
    state: entry.state,
  })
}

function createActiveMatch<
  State,
  Handle,
>(
  resolved: ResolvedRouteMatch<State, Handle>,
): ActiveRouteMatch<State, Handle> {
  const paramsSignal = signal(resolved.params)
  const pathnameSignal = signal(resolved.pathname)
  return {
    id: resolved.route.id,
    route: resolved.route.definition,
    routeNode: resolved.route,
    handle: resolved.route.definition.handle,
    parentId: resolved.route.parentId,
    navigationId: resolved.route.navigationId,
    params: paramsSignal,
    paramsSignal,
    pathname: pathnameSignal,
    pathnameSignal,
  }
}

function requireInteger(value: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer.`)
  }
  return value
}

function RouteRenderer<
  State,
  Handle,
>(
  props: {
    readonly context: RouteRenderContext<State, Handle>
  },
): Child {
  return props.context.match.route.render(props.context)
}

function RouteScope<
  State,
  Handle,
>(
  props: {
    readonly context: RouteRenderContext<State, Handle>
  },
): Child {
  return createVNode(
    RouteContext.Provider,
    {
      value: props.context as
        RouteRenderContext<unknown, unknown>,
      children: createVNode(RouteRenderer, props),
    },
  )
}

export function createRouter<
  State = unknown,
  Handle = unknown,
>(
  options: RouterOptions<State, Handle>,
): Router<State, Handle> {
  if (
    typeof options !== 'object' ||
    options === null
  ) {
    throw new TypeError(
      'createRouter() options must be an object.',
    )
  }
  const compiled = compileRoutes(options.routes)
  if (
    options.initialEntries !== undefined &&
    options.initialRouteId !== undefined
  ) {
    throw new Error(
      'Router initialEntries and initialRouteId are mutually exclusive.',
    )
  }
  let initialEntries = options.initialEntries
  if (options.initialRouteId !== undefined) {
    const route = compiled.byId.get(options.initialRouteId)
    if (!route) {
      throw new Error(
        `Unknown initial route id '${options.initialRouteId}'.`,
      )
    }
    initialEntries = [
      buildRoutePath(
        route.fullTokens,
        options.initialRouteParams ?? {},
      ),
    ]
  }
  initialEntries ??= ['/']
  if (
    !Array.isArray(initialEntries) ||
    initialEntries.length === 0
  ) {
    throw new Error(
      'Router initialEntries must not be empty.',
    )
  }

  return createRoot((disposeRoot: Cleanup) => {
    let nextLocationKey = 1
    let nextTransitionId = 1
    let disposed = false
    let transitionInProgress = false
    const entries: HistoryEntry<State>[] =
      initialEntries.map((entry) => {
        let value: RouterInitialEntry<State>
        if (typeof entry === 'string') {
          value = { path: entry, state: undefined }
        }
        else if (
          typeof entry === 'object' &&
          entry !== null &&
          typeof entry.path === 'string'
        ) {
          value = entry
        }
        else {
          throw new TypeError(
            'Router initial entry must be a path string or { path, state }.',
          )
        }
        const parsed = parseRouterPath(value.path)
        resolveRouteMatches(compiled.routes, parsed.pathname)
        return {
          key: `location-${nextLocationKey++}`,
          path: `${parsed.pathname}${parsed.search}${parsed.hash}`,
          state: value.state,
        }
      })
    let historyIndex = options.initialIndex ??
      entries.length - 1
    if (
      !Number.isInteger(historyIndex) ||
      historyIndex < 0 ||
      historyIndex >= entries.length
    ) {
      throw new RangeError(
        'Router initialIndex is outside initialEntries.',
      )
    }
    let currentResolved = resolveRouteMatches(
      compiled.routes,
      createLocation(entries[historyIndex]!).pathname,
    )
    let activeMatches =
      currentResolved.map(createActiveMatch)
    const matchSlots = activeMatches.map(
      (match) => signal<ActiveRouteMatch<State, Handle> | null>(match),
    )
    const location = signal(
      createLocation(entries[historyIndex]!),
    )
    const matches = signal<
      readonly RouteMatch<State, Handle>[]
    >([...activeMatches])
    const history = signal<RouterHistorySnapshot<State>>({
      index: historyIndex,
      entries: entries.map(createLocation),
    })
    const lastTransition =
      signal<DiagnosticRouteEvent | null>(null)
    const pathname = computed(() => location.value.pathname)
    const query = computed(() => location.value.query)
    const state = computed(() => location.value.state)
    const leafMatch = computed(() =>
      matches.value.at(-1) ?? null,
    )
    const routeId = computed(() =>
      leafMatch.value?.id ?? '',
    )
    const navigationRouteId = computed(() =>
      leafMatch.value?.navigationId ?? '',
    )
    const canGoBack = computed(() => history.value.index > 0)
    const canGoForward = computed(() =>
      history.value.index <
        history.value.entries.length - 1,
    )
    const canGoUp = computed(() =>
      leafMatch.value?.parentId !== null &&
      leafMatch.value?.parentId !== undefined,
    )

    const ensureActive = (operation: string) => {
      if (disposed) {
        throw new Error(
          `Cannot ${operation} on a disposed Router.`,
        )
      }
    }

    const publishTransition = (
      transition: DiagnosticRouteEvent,
    ) => {
      lastTransition.value = transition
      options.diagnostics?.route(transition)
      options.onTransition?.(transition)
    }

    const createTransition = (
      phase: DiagnosticRouteEvent['phase'],
      action: DiagnosticRouteAction,
      trigger: DiagnosticRouteTrigger,
      fromRoute: string | null,
      toRoute: string,
      transitionId: string,
      reason?: string,
    ): DiagnosticRouteEvent => ({
      transitionId,
      phase,
      action,
      trigger,
      fromRoute,
      toRoute,
      ...(reason === undefined ? {} : { reason }),
    })

    const applyResolved = (
      nextLocation: RouterLocation<State>,
      resolved: readonly ResolvedRouteMatch<State, Handle>[],
    ) => {
      const reusedUpdates: Array<{
        readonly match: ActiveRouteMatch<State, Handle>
        readonly params: RouterParams
        readonly pathname: string
      }> = []
      const nextActive = resolved.map((next, depth) => {
        const previous = activeMatches[depth]
        if (
          previous &&
          previous.routeNode === next.route
        ) {
          reusedUpdates.push({
            match: previous,
            params: next.params,
            pathname: next.pathname,
          })
          return previous
        }
        return createActiveMatch(next)
      })
      batch(() => {
        for (const update of reusedUpdates) {
          update.match.paramsSignal.value = update.params
          update.match.pathnameSignal.value =
            update.pathname
        }
        for (
          let depth = 0;
          depth < Math.max(
            matchSlots.length,
            nextActive.length,
          );
          depth += 1
        ) {
          let slot = matchSlots[depth]
          if (!slot) {
            slot = signal<ActiveRouteMatch<State, Handle> | null>(
              null,
            )
            matchSlots.push(slot)
          }
          const next = nextActive[depth] ?? null
          if (slot.peek() !== next) {
            slot.value = next
          }
        }
        location.value = nextLocation
        matches.value = [...nextActive]
      })
      activeMatches = nextActive
      currentResolved = resolved
    }

    const publishHistory = () => {
      history.value = {
        index: historyIndex,
        entries: entries.map(createLocation),
      }
    }

    const transitionToEntry = (
      entry: HistoryEntry<State>,
      action: DiagnosticRouteAction,
      trigger: DiagnosticRouteTrigger,
      commitHistory: () => void,
    ) => {
      if (transitionInProgress) {
        throw new Error(
          'Router navigation cannot re-enter an active transition.',
        )
      }
      transitionInProgress = true
      try {
        const from = location.peek()
        const targetLocation = createLocation(entry)
        const fromRoute =
          activeMatches.at(-1)?.id ?? null
        const transitionId =
          `route-${nextTransitionId++}`

        let resolved:
          readonly ResolvedRouteMatch<State, Handle>[]
        try {
          resolved = resolveRouteMatches(
            compiled.routes,
            targetLocation.pathname,
          )
        }
        catch (error) {
          publishTransition(createTransition(
            'requested',
            action,
            trigger,
            fromRoute,
            '<unmatched>',
            transitionId,
          ))
          publishTransition(createTransition(
            'failed',
            action,
            trigger,
            fromRoute,
            '<unmatched>',
            transitionId,
            'no-match',
          ))
          throw error
        }
        const toRoute =
          resolved.at(-1)!.route.id
        publishTransition(createTransition(
          'requested',
          action,
          trigger,
          fromRoute,
          toRoute,
          transitionId,
        ))

        publishTransition(createTransition(
          'committing',
          action,
          trigger,
          fromRoute,
          toRoute,
          transitionId,
        ))
        const previousResolved = currentResolved
        const previousEntries = [...entries]
        const previousIndex = historyIndex
        try {
          applyResolved(targetLocation, resolved)
          commitHistory()
          publishHistory()
        }
        catch (error) {
          let rollbackError: unknown
          try {
            entries.splice(
              0,
              entries.length,
              ...previousEntries,
            )
            historyIndex = previousIndex
            applyResolved(from, previousResolved)
            publishHistory()
          }
          catch (failure) {
            rollbackError = failure
          }
          publishTransition(createTransition(
            'failed',
            action,
            trigger,
            fromRoute,
            toRoute,
            transitionId,
            'commit-failed',
          ))
          if (rollbackError !== undefined) {
            throw new AggregateError(
              [error, rollbackError],
              'Route transition and rollback failed.',
            )
          }
          throw error
        }
        publishTransition(createTransition(
          'completed',
          action,
          trigger,
          fromRoute,
          toRoute,
          transitionId,
        ))
      }
      finally {
        transitionInProgress = false
      }
    }

    const pathFor = (
      routeId: string,
      params: Readonly<
        Record<string, string | number | boolean>
      > = {},
      queryInput?: RouterQueryInput,
    ) => {
      ensureActive('generate a route path')
      const route = compiled.byId.get(routeId)
      if (!route) {
        throw new Error(`Unknown route id '${routeId}'.`)
      }
      if (
        typeof params !== 'object' ||
        params === null ||
        Array.isArray(params)
      ) {
        throw new TypeError(
          'Router path params must be an object.',
        )
      }
      return (
        buildRoutePath(route.fullTokens, params) +
        stringifyRouterQuery(queryInput)
      )
    }

    const resolveTarget = (
      target: RouterTarget,
      navigationState: State | undefined,
    ): HistoryEntry<State> => {
      let path: string
      if (typeof target === 'string') {
        const rawPath = target || location.peek().pathname
        const hashIndex = rawPath.indexOf('#')
        const searchIndex = rawPath.indexOf('?')
        const pathEnd = Math.min(
          searchIndex < 0 ? rawPath.length : searchIndex,
          hashIndex < 0 ? rawPath.length : hashIndex,
        )
        const rawPathname = rawPath.slice(0, pathEnd)
        const suffix = rawPath.slice(pathEnd)
        path =
          resolveRouterPathname(
            rawPathname,
            location.peek().pathname,
          ) + suffix
      }
      else {
        if (
          typeof target !== 'object' ||
          target === null ||
          Array.isArray(target)
        ) {
          throw new TypeError(
            'Router target must be a path string or target object.',
          )
        }
        if (
          target.routeId !== undefined &&
          target.pathname !== undefined
        ) {
          throw new Error(
            'Router target cannot contain both routeId and pathname.',
          )
        }
        if (
          target.query !== undefined &&
          target.search !== undefined
        ) {
          throw new Error(
            'Router target cannot contain both query and search.',
          )
        }
        const pathnameValue = target.routeId !== undefined
          ? pathFor(
              target.routeId,
              target.params,
            )
          : resolveRouterPathname(
              target.pathname ?? '',
              location.peek().pathname,
            )
        const searchValue = target.query !== undefined
          ? stringifyRouterQuery(target.query)
          : target.search === undefined
            ? ''
            : target.search
              ? target.search.startsWith('?')
                ? target.search
                : `?${target.search}`
              : ''
        const hashValue = target.hash === undefined
          ? ''
          : target.hash
            ? target.hash.startsWith('#')
              ? target.hash
              : `#${target.hash}`
            : ''
        path = `${pathnameValue}${searchValue}${hashValue}`
      }
      const parsed = parseRouterPath(path)
      return {
        key: `location-${nextLocationKey++}`,
        path: `${parsed.pathname}${parsed.search}${parsed.hash}`,
        state: navigationState,
      }
    }

    const router: Router<State, Handle> = {
      location,
      pathname,
      query,
      state,
      matches,
      leafMatch,
      routeId,
      navigationRouteId,
      history,
      canGoBack,
      canGoForward,
      canGoUp,
      lastTransition,
      get disposed() {
        return disposed
      },
      navigate(target, navigationOptions = {}) {
        ensureActive('navigate')
        const entry = resolveTarget(
          target,
          navigationOptions.state,
        )
        const replace = navigationOptions.replace ?? false
        transitionToEntry(
          entry,
          replace ? 'replace' : 'push',
          navigationOptions.trigger ?? 'programmatic',
          () => {
            if (replace) {
              entries[historyIndex] = entry
              return
            }
            entries.splice(
              historyIndex + 1,
              entries.length,
              entry,
            )
            historyIndex += 1
          },
        )
      },
      replace(target, navigationOptions = {}) {
        router.navigate(target, {
          ...navigationOptions,
          replace: true,
        })
      },
      back() {
        return router.go(-1)
      },
      forward() {
        return router.go(1)
      },
      go(delta) {
        ensureActive('navigate history')
        requireInteger(delta, 'Router history delta')
        if (delta === 0) {
          return false
        }
        const nextIndex = historyIndex + delta
        if (
          nextIndex < 0 ||
          nextIndex >= entries.length
        ) {
          const currentRoute =
            activeMatches.at(-1)?.id ?? null
          publishTransition(createTransition(
            'cancelled',
            delta < 0 ? 'back' : 'forward',
            'history',
            currentRoute,
            currentRoute ?? '<unmatched>',
            `route-${nextTransitionId++}`,
            'history-boundary',
          ))
          return false
        }
        const entry = entries[nextIndex]!
        transitionToEntry(
          entry,
          delta < 0 ? 'back' : 'forward',
          'history',
          () => {
            historyIndex = nextIndex
          },
        )
        return true
      },
      up(upOptions = {}) {
        ensureActive('navigate to a parent route')
        const match = activeMatches.at(-1)
        const parentId = match?.parentId
        if (!match || !parentId) {
          return false
        }
        const parentPath = pathFor(
          parentId,
          match.params.peek(),
        )
        const previousIndex = historyIndex - 1
        const previous = previousIndex >= 0
          ? createLocation(entries[previousIndex]!)
          : undefined
        if (previous?.pathname === parentPath) {
          transitionToEntry(
            entries[previousIndex]!,
            'up',
            upOptions.trigger ?? 'history',
            () => {
              historyIndex = previousIndex
            },
          )
          return true
        }
        const entry = resolveTarget(
          {
            routeId: parentId,
            params: match.params.peek(),
          },
          undefined,
        )
        const replace = upOptions.replace ?? true
        transitionToEntry(
          entry,
          'up',
          upOptions.trigger ?? 'history',
          () => {
            if (replace) {
              entries[historyIndex] = entry
              return
            }
            entries.splice(
              historyIndex + 1,
              entries.length,
              entry,
            )
            historyIndex += 1
          },
        )
        return true
      },
      pathFor,
      outlet(depth = 0, fallback) {
        ensureActive('create a route outlet')
        requireInteger(depth, 'Router outlet depth')
        if (depth < 0) {
          throw new RangeError(
            'Router outlet depth must not be negative.',
          )
        }
        let slot = matchSlots[depth]
        if (!slot) {
          slot = signal<ActiveRouteMatch<State, Handle> | null>(
            null,
          )
          matchSlots.push(slot)
        }
        return createDynamicNode(() => {
          const match = slot!.value
          if (!match) {
            return fallback
          }
          const context: RouteRenderContext<State, Handle> = {
            router,
            match,
            depth,
            params: match.params,
            query,
            state,
            location,
          }
          return createVNode(RouteScope, { context })
        })
      },
      dispose() {
        if (disposed) {
          return
        }
        disposed = true
        batch(() => {
          for (const slot of matchSlots) {
            slot.value = null
          }
          activeMatches = []
          matches.value = []
        })
        disposeRoot()
      },
    }

    return router
  })
}

export function RouterProvider<
  State = unknown,
  Handle = unknown,
>(
  props: RouterProviderProps<State, Handle>,
): Child {
  if (props.disposeOnUnmount) {
    onCleanup(() => props.router.dispose())
  }
  return createVNode(
    RouterContext.Provider,
    {
      value: props.router as Router<unknown, unknown>,
      children:
        props.children ??
        createVNode(Outlet, {}),
    },
  )
}

export function useRouter<
  State = unknown,
  Handle = unknown,
>(): Router<State, Handle> {
  const router = useContext(RouterContext)
  if (!router) {
    throw new Error(
      'useRouter() requires a RouterProvider.',
    )
  }
  return router as Router<State, Handle>
}

export function useRoute<
  State = unknown,
  Handle = unknown,
>(): RouteRenderContext<State, Handle> {
  const route = useContext(RouteContext)
  if (!route) {
    throw new Error(
      'useRoute() requires a mounted route outlet.',
    )
  }
  return route as RouteRenderContext<State, Handle>
}

export function useRouteParams(): ReadonlySignal<RouterParams> {
  return useRoute().params
}

export function useRouteQuery(): ReadonlySignal<RouterQuery> {
  return useRouter().query
}

export function useRouteState<State = unknown>():
ReadonlySignal<State | undefined> {
  return useRouter<State>().state
}

export function Outlet(props: OutletProps = {}): Child {
  const router = useRouter()
  const parent = useContext(RouteContext)
  const depth =
    parent?.router === router
      ? parent.depth + 1
      : 0
  return router.outlet(depth, props.fallback)
}
