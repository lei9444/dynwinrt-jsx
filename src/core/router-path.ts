import type {
  RouterQuery,
  RouterQueryInput,
} from './router'

export interface ParsedRouterPath {
  readonly pathname: string
  readonly search: string
  readonly hash: string
  readonly query: RouterQuery
}

export function decodeRouterPathPart(value: string): string {
  try {
    return decodeURIComponent(value)
  }
  catch {
    throw new URIError(
      `Route path segment '${value}' is not valid URI encoding.`,
    )
  }
}

function encodeQueryPart(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+')
}

function decodeQueryPart(value: string): string {
  return decodeRouterPathPart(value.replace(/\+/g, ' '))
}

export function normalizeRouterPathname(
  pathname: string,
): string {
  const segments: string[] = []
  for (const rawSegment of pathname.split('/')) {
    if (!rawSegment || rawSegment === '.') {
      continue
    }
    if (rawSegment === '..') {
      segments.pop()
      continue
    }
    segments.push(rawSegment)
  }
  return segments.length === 0
    ? '/'
    : `/${segments.join('/')}`
}

export function resolveRouterPathname(
  pathname: string,
  currentPathname: string,
): string {
  if (pathname.startsWith('/')) {
    return normalizeRouterPathname(pathname)
  }
  if (pathname.length === 0) {
    return currentPathname
  }
  return normalizeRouterPathname(
    `${currentPathname.replace(/\/$/, '')}/${pathname}`,
  )
}

export function parseRouterQuery(search: string): RouterQuery {
  if (typeof search !== 'string') {
    throw new TypeError(
      'Router query search must be a string.',
    )
  }
  const query = Object.create(null) as
    Record<string, string | string[]>
  const source = search.startsWith('?')
    ? search.slice(1)
    : search
  if (!source) {
    return Object.freeze(query)
  }
  for (const entry of source.split('&')) {
    if (!entry) {
      continue
    }
    const equals = entry.indexOf('=')
    const rawKey = equals < 0
      ? entry
      : entry.slice(0, equals)
    const rawValue = equals < 0
      ? ''
      : entry.slice(equals + 1)
    const key = decodeQueryPart(rawKey)
    const value = decodeQueryPart(rawValue)
    const previous = query[key]
    if (previous === undefined) {
      query[key] = value
    }
    else if (Array.isArray(previous)) {
      previous.push(value)
    }
    else {
      query[key] = [previous, value]
    }
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(query).map(([key, value]) => [
        key,
        Array.isArray(value)
          ? Object.freeze([...value])
          : value,
      ]),
    ),
  )
}

export function stringifyRouterQuery(
  query: RouterQueryInput = {},
): string {
  if (
    typeof query !== 'object' ||
    query === null ||
    Array.isArray(query)
  ) {
    throw new TypeError(
      'Router query must be an object.',
    )
  }
  const entries: string[] = []
  for (const key of Object.keys(query).sort()) {
    const rawValue = query[key]
    if (rawValue === null || rawValue === undefined) {
      continue
    }
    const values = Array.isArray(rawValue)
      ? rawValue
      : [rawValue]
    for (const value of values) {
      if (
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean'
      ) {
        throw new TypeError(
          `Router query '${key}' contains an unsupported value.`,
        )
      }
      if (
        typeof value === 'number' &&
        !Number.isFinite(value)
      ) {
        throw new TypeError(
          `Router query '${key}' contains a non-finite number.`,
        )
      }
      entries.push(
        `${encodeQueryPart(key)}=${encodeQueryPart(String(value))}`,
      )
    }
  }
  return entries.length === 0
    ? ''
    : `?${entries.join('&')}`
}

export function parseRouterPath(
  path: string,
): ParsedRouterPath {
  const hashIndex = path.indexOf('#')
  const hash = hashIndex < 0 ? '' : path.slice(hashIndex)
  const withoutHash = hashIndex < 0
    ? path
    : path.slice(0, hashIndex)
  const searchIndex = withoutHash.indexOf('?')
  const search = searchIndex < 0
    ? ''
    : withoutHash.slice(searchIndex)
  const pathname = normalizeRouterPathname(
    searchIndex < 0
      ? withoutHash
      : withoutHash.slice(0, searchIndex),
  )
  return {
    pathname,
    search,
    hash,
    query: parseRouterQuery(search),
  }
}
