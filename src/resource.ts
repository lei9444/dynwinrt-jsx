import {
  computed,
  type ReadonlySignal,
} from './reactive'

export interface ResourceReference<Value = unknown> {
  readonly __dynwinrtResource: true
  readonly kind: 'static' | 'theme'
  readonly key: string
  readonly fallback?: Value
}

export interface ThemeResourceReference<Value = unknown>
  extends ResourceReference<Value> {
  readonly kind: 'theme'
}

export function resource<Value = unknown>(
  key: string,
  fallback?: Value,
): ResourceReference<Value>
export function resource<Value = unknown>(
  key: string,
  fallback: Value | undefined,
  refresh: ReadonlySignal<unknown>,
): ReadonlySignal<ResourceReference<Value>>
export function resource<Value = unknown>(
  key: string,
  fallback?: Value,
  refresh?: ReadonlySignal<unknown>,
): ResourceReference<Value> | ReadonlySignal<ResourceReference<Value>> {
  if (!refresh) {
    return createResourceReference('static', key, fallback)
  }

  return computed(() => {
    refresh.value
    return createResourceReference('static', key, fallback)
  })
}

export function themeResource<Value = unknown>(
  key: string,
  fallback?: Value,
): ThemeResourceReference<Value> {
  return createResourceReference('theme', key, fallback)
}

function createResourceReference<Value>(
  kind: 'theme',
  key: string,
  fallback: Value | undefined,
): ThemeResourceReference<Value>
function createResourceReference<Value>(
  kind: 'static',
  key: string,
  fallback: Value | undefined,
): ResourceReference<Value>
function createResourceReference<Value>(
  kind: ResourceReference<Value>['kind'],
  key: string,
  fallback: Value | undefined,
): ThemeResourceReference<Value> | ResourceReference<Value> {
  if (!key.trim()) {
    throw new TypeError('Resource keys cannot be empty.')
  }
  return {
    __dynwinrtResource: true,
    kind,
    key,
    fallback,
  }
}

export function isResourceReference(
  value: unknown,
): value is ResourceReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<ResourceReference>).__dynwinrtResource === true
  )
}

export function isThemeResourceReference(
  value: unknown,
): value is ThemeResourceReference {
  return isResourceReference(value) && value.kind === 'theme'
}
