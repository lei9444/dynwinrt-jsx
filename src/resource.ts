import {
  computed,
  type ReadonlySignal,
} from './reactive'

export interface ResourceReference<Value = unknown> {
  readonly __dynwinrtResource: true
  readonly key: string
  readonly fallback?: Value
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
    return createResourceReference(key, fallback)
  }

  return computed(() => {
    refresh.value
    return createResourceReference(key, fallback)
  })
}

function createResourceReference<Value>(
  key: string,
  fallback: Value | undefined,
): ResourceReference<Value> {
  return {
    __dynwinrtResource: true,
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
