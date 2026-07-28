import type {
  RouteDefinition,
  RouterParams,
} from './router'
import {
  decodeRouterPathPart,
} from './router-path'

export type RouterSegmentToken =
  | {
      readonly kind: 'static'
      readonly value: string
    }
  | {
      readonly kind: 'param'
      readonly name: string
    }
  | {
      readonly kind: 'splat'
    }

export interface CompiledRoute<
  State,
  Handle,
> {
  readonly id: string
  readonly definition: RouteDefinition<State, Handle>
  readonly parentId: string | null
  readonly navigationId: string
  readonly tokens: readonly RouterSegmentToken[]
  readonly fullTokens: readonly RouterSegmentToken[]
  readonly score: number
  readonly children: readonly CompiledRoute<State, Handle>[]
}

export interface ResolvedRouteMatch<
  State,
  Handle,
> {
  readonly route: CompiledRoute<State, Handle>
  readonly params: RouterParams
  readonly pathname: string
}

interface MatchCandidate<
  State,
  Handle,
> {
  readonly matches: readonly ResolvedRouteMatch<State, Handle>[]
  readonly score: number
}

function requireNonEmptyString(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    throw new TypeError(`${label} must not be empty.`)
  }
  return value
}

function routeTokens(
  path: string | undefined,
  nested: boolean,
): readonly RouterSegmentToken[] {
  if (path !== undefined && typeof path !== 'string') {
    throw new TypeError('Route path must be a string.')
  }
  const source = path ?? ''
  if (source.includes('?') || source.includes('#')) {
    throw new Error(
      `Route path '${source}' must not contain query or hash syntax.`,
    )
  }
  if (nested && source.startsWith('/')) {
    throw new Error(
      `Nested route path '${source}' must be relative.`,
    )
  }
  const normalized = source.replace(/^\/+|\/+$/g, '')
  if (!normalized) {
    return []
  }
  const pathSegments = normalized.split('/')
  if (
    pathSegments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..',
    )
  ) {
    throw new Error(
      `Route path '${source}' contains an invalid segment.`,
    )
  }
  const tokens: RouterSegmentToken[] = []
  for (const segment of pathSegments) {
    if (segment === '*') {
      if (tokens.length !== pathSegments.length - 1) {
        throw new Error(
          `Route wildcard must be the final segment in '${source}'.`,
        )
      }
      tokens.push({ kind: 'splat' })
      continue
    }
    if (segment.startsWith(':')) {
      const name = requireNonEmptyString(
        segment.slice(1),
        `Route parameter in '${source}'`,
      )
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new Error(
          `Route parameter '${name}' is not a valid identifier.`,
        )
      }
      tokens.push({ kind: 'param', name })
      continue
    }
    tokens.push({
      kind: 'static',
      value: decodeRouterPathPart(segment),
    })
  }
  return tokens
}

function tokenScore(token: RouterSegmentToken): number {
  if (token.kind === 'static') {
    return 4
  }
  if (token.kind === 'param') {
    return 2
  }
  return 1
}

export function compileRoutes<
  State,
  Handle,
>(
  definitions: readonly RouteDefinition<State, Handle>[],
): {
  readonly routes: readonly CompiledRoute<State, Handle>[]
  readonly byId: ReadonlyMap<string, CompiledRoute<State, Handle>>
} {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    throw new TypeError(
      'Router routes must contain at least one route.',
    )
  }
  const byId = new Map<string, CompiledRoute<State, Handle>>()
  const seenIds = new Set<string>()

  const compileLevel = (
    values: readonly RouteDefinition<State, Handle>[],
    parentTokens: readonly RouterSegmentToken[],
    nested: boolean,
    structuralParentId: string | null,
  ): readonly CompiledRoute<State, Handle>[] => {
    if (!Array.isArray(values)) {
      throw new TypeError(
        'Route children must be an array.',
      )
    }
    const siblingKeys = new Set<string>()
    return values.map((definition) => {
      const id = requireNonEmptyString(
        definition.id,
        'Route id',
      )
      if (seenIds.has(id)) {
        throw new Error(`Duplicate route id '${id}'.`)
      }
      seenIds.add(id)
      const parentId = definition.parentId === undefined
        ? structuralParentId
        : requireNonEmptyString(
            definition.parentId,
            `Route '${id}' parentId`,
          )
      const navigationId =
        definition.navigationId === undefined
          ? id
          : requireNonEmptyString(
              definition.navigationId,
              `Route '${id}' navigationId`,
            )
      if (typeof definition.render !== 'function') {
        throw new TypeError(
          `Route '${id}' render must be a function.`,
        )
      }
      if (
        definition.index !== undefined &&
        typeof definition.index !== 'boolean'
      ) {
        throw new TypeError(
          `Route '${id}' index must be a boolean.`,
        )
      }
      if (
        definition.children !== undefined &&
        !Array.isArray(definition.children)
      ) {
        throw new TypeError(
          `Route '${id}' children must be an array.`,
        )
      }
      if (definition.index && definition.path !== undefined) {
        throw new Error(
          `Index route '${id}' must not declare a path.`,
        )
      }
      if (
        definition.index &&
        (definition.children?.length ?? 0) > 0
      ) {
        throw new Error(
          `Index route '${id}' must not declare children.`,
        )
      }
      const tokens = routeTokens(definition.path, nested)
      const siblingKey = definition.index
        ? '<index>'
        : tokens.map((token) =>
            token.kind === 'static'
              ? `s:${token.value}`
              : token.kind === 'param'
                ? ':'
                : '*',
          ).join('/')
      if (siblingKeys.has(siblingKey)) {
        throw new Error(
          `Route '${id}' has an ambiguous sibling path.`,
        )
      }
      siblingKeys.add(siblingKey)
      const fullTokens = [...parentTokens, ...tokens]
      const parameterNames = new Set<string>()
      for (const token of fullTokens) {
        if (token.kind === 'static') {
          continue
        }
        const name = token.kind === 'splat'
          ? '*'
          : token.name
        if (parameterNames.has(name)) {
          throw new Error(
            `Route '${id}' repeats parameter '${name}' in its matched path.`,
          )
        }
        parameterNames.add(name)
      }
      const stableDefinition = Object.freeze({
        ...definition,
        id,
      })
      const route: CompiledRoute<State, Handle> = {
        id,
        definition: stableDefinition,
        parentId,
        navigationId,
        tokens,
        fullTokens,
        score:
          tokens.reduce(
            (total, token) => total + tokenScore(token),
            0,
          ) + (definition.index ? 3 : 0),
        children: [],
      }
      const children = compileLevel(
        definition.children ?? [],
        fullTokens,
        true,
        id,
      )
      const compiled = {
        ...route,
        children,
      }
      byId.set(id, compiled)
      return compiled
    })
  }

  const routes = compileLevel(
    definitions,
    [],
    false,
    null,
  )
  for (const route of byId.values()) {
    if (route.parentId && !byId.has(route.parentId)) {
      throw new Error(
        `Route '${route.id}' references unknown parent route '${route.parentId}'.`,
      )
    }
    if (route.parentId === route.id) {
      throw new Error(
        `Route '${route.id}' cannot be its own parent.`,
      )
    }
    const visited = new Set<string>([route.id])
    let parentId = route.parentId
    while (parentId) {
      if (visited.has(parentId)) {
        throw new Error(
          `Route '${route.id}' has a cyclic parent route.`,
        )
      }
      visited.add(parentId)
      parentId = byId.get(parentId)?.parentId ?? null
    }
  }

  return {
    routes,
    byId,
  }
}

function matchRouteTokens(
  tokens: readonly RouterSegmentToken[],
  segments: readonly string[],
  offset: number,
  params: RouterParams,
): {
  readonly offset: number
  readonly params: RouterParams
} | null {
  let nextOffset = offset
  const nextParams = Object.assign(
    Object.create(null) as Record<string, string>,
    params,
  )
  for (const token of tokens) {
    if (token.kind === 'splat') {
      nextParams['*'] = segments
        .slice(nextOffset)
        .map(decodeRouterPathPart)
        .join('/')
      nextOffset = segments.length
      continue
    }
    const segment = segments[nextOffset]
    if (segment === undefined) {
      return null
    }
    const decoded = decodeRouterPathPart(segment)
    if (
      token.kind === 'static' &&
      decoded !== token.value
    ) {
      return null
    }
    if (token.kind === 'param') {
      nextParams[token.name] = decoded
    }
    nextOffset += 1
  }
  return {
    offset: nextOffset,
    params: Object.freeze(nextParams),
  }
}

function betterCandidate<
  State,
  Handle,
>(
  current: MatchCandidate<State, Handle> | null,
  candidate: MatchCandidate<State, Handle>,
): MatchCandidate<State, Handle> {
  if (!current || candidate.score > current.score) {
    return candidate
  }
  return current
}

function matchRouteLevel<
  State,
  Handle,
>(
  routes: readonly CompiledRoute<State, Handle>[],
  segments: readonly string[],
  offset: number,
  params: RouterParams,
  parentMatches: readonly ResolvedRouteMatch<State, Handle>[],
  parentScore: number,
): MatchCandidate<State, Handle> | null {
  let best: MatchCandidate<State, Handle> | null = null
  for (const route of routes) {
    if (route.definition.index && offset !== segments.length) {
      continue
    }
    const matched = matchRouteTokens(
      route.tokens,
      segments,
      offset,
      params,
    )
    if (!matched) {
      continue
    }
    const pathname = matched.offset === 0
      ? '/'
      : `/${segments.slice(0, matched.offset).join('/')}`
    const matches = [
      ...parentMatches,
      {
        route,
        params: matched.params,
        pathname,
      },
    ]
    const score =
      parentScore + route.score + matches.length
    if (matched.offset === segments.length) {
      best = betterCandidate(best, { matches, score })
    }
    const child = matchRouteLevel(
      route.children,
      segments,
      matched.offset,
      matched.params,
      matches,
      score,
    )
    if (child) {
      best = betterCandidate(best, child)
    }
  }
  return best
}

export function resolveRouteMatches<
  State,
  Handle,
>(
  routes: readonly CompiledRoute<State, Handle>[],
  pathname: string,
): readonly ResolvedRouteMatch<State, Handle>[] {
  const segments = pathname === '/'
    ? []
    : pathname.slice(1).split('/')
  const candidate = matchRouteLevel(
    routes,
    segments,
    0,
    Object.freeze(
      Object.create(null) as Record<string, string>,
    ),
    [],
    0,
  )
  if (!candidate) {
    throw new Error(
      `No route matches pathname '${pathname}'.`,
    )
  }
  return candidate.matches
}

export function buildRoutePath(
  tokens: readonly RouterSegmentToken[],
  params: Readonly<Record<string, string | number | boolean>>,
): string {
  const segments: string[] = []
  for (const token of tokens) {
    if (token.kind === 'static') {
      segments.push(encodeURIComponent(token.value))
      continue
    }
    const name = token.kind === 'splat' ? '*' : token.name
    const rawValue = params[name]
    if (rawValue === undefined) {
      throw new Error(
        `Route parameter '${name}' is required.`,
      )
    }
    if (
      typeof rawValue !== 'string' &&
      typeof rawValue !== 'number' &&
      typeof rawValue !== 'boolean'
    ) {
      throw new TypeError(
        `Route parameter '${name}' contains an unsupported value.`,
      )
    }
    if (
      typeof rawValue === 'number' &&
      !Number.isFinite(rawValue)
    ) {
      throw new TypeError(
        `Route parameter '${name}' contains a non-finite number.`,
      )
    }
    const value = String(rawValue)
    if (!value) {
      throw new Error(
        `Route parameter '${name}' must not be empty.`,
      )
    }
    if (token.kind === 'splat') {
      segments.push(
        ...value.split('/').map(encodeURIComponent),
      )
    }
    else {
      segments.push(encodeURIComponent(value))
    }
  }
  return segments.length === 0
    ? '/'
    : `/${segments.join('/')}`
}
