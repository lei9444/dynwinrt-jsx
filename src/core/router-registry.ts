import type {
  RouteDefinition,
  Router,
  RouterPathTarget,
  RouterQueryInput,
} from './router'

type SegmentParameter<Segment extends string> =
  Segment extends `:${infer Parameter}`
    ? Parameter
    : Segment extends '*'
      ? '*'
      : never

export type RoutePathParameterNames<
  Path extends string,
> = Path extends `${infer Head}/${infer Tail}`
  ? SegmentParameter<Head> |
    RoutePathParameterNames<Tail>
  : SegmentParameter<Path>

export type RouteParamsForPath<
  Path extends string,
> = {
  readonly [Parameter in RoutePathParameterNames<Path>]:
    string | number | boolean
}

export type RouteRegistryEntry<
  State = unknown,
  Handle = unknown,
  Path extends string = string,
> = Omit<
  RouteDefinition<State, Handle>,
  'id' | 'path' | 'children'
> & {
  readonly path: Path
}

export type RouteRegistryDefinitionMap<
  State = unknown,
  Handle = unknown,
> = Readonly<Record<
  string,
  RouteRegistryEntry<State, Handle>
>>

type RegistryRouteId<
  Definitions,
> = Extract<keyof Definitions, string>

type RegistryRoutePath<
  Definitions,
  Id extends RegistryRouteId<Definitions>,
> = Definitions[Id] extends {
  readonly path: infer Path extends string
}
  ? Path
  : never

type RouteRegistryTargetOptions<
  Path extends string,
> = [RoutePathParameterNames<Path>] extends [never]
  ? {
      readonly query?: RouterQueryInput
      readonly hash?: string
    }
  : {
      readonly params: RouteParamsForPath<Path>
      readonly query?: RouterQueryInput
      readonly hash?: string
    }

type RouteRegistryTargetArguments<
  Path extends string,
> = [RoutePathParameterNames<Path>] extends [never]
  ? [options?: RouteRegistryTargetOptions<Path>]
  : [options: RouteRegistryTargetOptions<Path>]

export interface RouteRegistry<
  State,
  Handle,
  Definitions extends RouteRegistryDefinitionMap<
    State,
    Handle
  >,
> {
  readonly ids: readonly RegistryRouteId<Definitions>[]
  readonly routes: readonly RouteDefinition<State, Handle>[]
  target<Id extends RegistryRouteId<Definitions>>(
    id: Id,
    ...options: RouteRegistryTargetArguments<
      RegistryRoutePath<Definitions, Id>
    >
  ): RouterPathTarget
  pathFor<Id extends RegistryRouteId<Definitions>>(
    router: Router<State, Handle>,
    id: Id,
    ...options: RouteRegistryTargetArguments<
      RegistryRoutePath<Definitions, Id>
    >
  ): string
}

interface RuntimeTargetOptions {
  readonly params?: Readonly<
    Record<string, string | number | boolean>
  >
  readonly query?: RouterQueryInput
  readonly hash?: string
}

function normalizeHash(hash: string | undefined): string {
  if (!hash) {
    return ''
  }
  return hash.startsWith('#') ? hash : `#${hash}`
}

export function defineRouteRegistry<
  State = unknown,
  Handle = unknown,
  const Definitions extends RouteRegistryDefinitionMap<
    State,
    Handle
  > = RouteRegistryDefinitionMap<State, Handle>,
>(
  definitions: Definitions,
): RouteRegistry<State, Handle, Definitions> {
  if (
    typeof definitions !== 'object' ||
    definitions === null ||
    Array.isArray(definitions)
  ) {
    throw new TypeError(
      'Route registry definitions must be an object.',
    )
  }
  const ids = Object.keys(definitions) as
    RegistryRouteId<Definitions>[]
  if (ids.length === 0) {
    throw new Error(
      'Route registry definitions must not be empty.',
    )
  }
  const routes = ids.map((id) => {
    const definition = definitions[id]
    if (
      typeof definition !== 'object' ||
      definition === null
    ) {
      throw new TypeError(
        `Route registry entry '${id}' must be an object.`,
      )
    }
    return {
      ...definition,
      id,
    }
  }) as readonly RouteDefinition<State, Handle>[]

  const requireRoute = (id: string) => {
    if (!Object.hasOwn(definitions, id)) {
      throw new Error(
        `Unknown route registry id '${id}'.`,
      )
    }
  }
  const target = (
    id: string,
    options: RuntimeTargetOptions = {},
  ): RouterPathTarget => {
    requireRoute(id)
    return {
      routeId: id,
      ...(options.params
        ? { params: options.params }
        : {}),
      ...(options.query
        ? { query: options.query }
        : {}),
      ...(options.hash
        ? { hash: options.hash }
        : {}),
    }
  }

  return Object.freeze({
    ids: Object.freeze([...ids]),
    routes: Object.freeze([...routes]),
    target,
    pathFor(
      router: Router<State, Handle>,
      id: string,
      options: RuntimeTargetOptions = {},
    ) {
      requireRoute(id)
      return (
        router.pathFor(
          id,
          options.params,
          options.query,
        ) + normalizeHash(options.hash)
      )
    },
  }) as RouteRegistry<State, Handle, Definitions>
}
