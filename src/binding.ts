import type { ReadonlySignal, Signal } from './reactive'

export type BindingEquals<Value> = (
  expected: Value,
  actual: Value,
) => boolean

const maxPendingNativeWrites = 64

function valuesEqual(
  expected: unknown,
  actual: unknown,
  seen = new WeakMap<object, object>(),
): boolean {
  if (Object.is(expected, actual)) {
    return true
  }
  if (
    typeof expected !== 'object' ||
    expected === null ||
    typeof actual !== 'object' ||
    actual === null
  ) {
    return false
  }
  if (seen.get(expected) === actual) {
    return true
  }
  seen.set(expected, actual)

  if (expected instanceof Date && actual instanceof Date) {
    return expected.getTime() === actual.getTime()
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    return (
      expected.length === actual.length &&
      expected.every((value, index) =>
        valuesEqual(value, actual[index], seen),
      )
    )
  }

  const expectedPrototype = Object.getPrototypeOf(expected)
  const actualPrototype = Object.getPrototypeOf(actual)
  if (expectedPrototype !== actualPrototype) {
    return false
  }

  if (
    expectedPrototype === Object.prototype ||
    expectedPrototype === null
  ) {
    const expectedKeys = Object.keys(expected)
    const actualKeys = Object.keys(actual)
    return (
      expectedKeys.length === actualKeys.length &&
      expectedKeys.every(
        (key) =>
          Object.hasOwn(actual, key) &&
          valuesEqual(
            (expected as Record<string, unknown>)[key],
            (actual as Record<string, unknown>)[key],
            seen,
          ),
      )
    )
  }

  return (
    'value' in expected &&
    'value' in actual &&
    valuesEqual(expected.value, actual.value, seen)
  )
}

export function oneWay<
  Value,
  Property extends PropertyKey,
>(
  state: ReadonlySignal<Value>,
  property: Property,
): Record<Property, ReadonlySignal<Value>> {
  return {
    [property]: state,
  } as Record<Property, ReadonlySignal<Value>>
}

export function twoWay<
  Value,
  Property extends PropertyKey,
  Event extends `on${string}`,
  Sender extends Record<Property, Value> = Record<Property, Value>,
>(
  state: Signal<Value>,
  property: Property,
  event: Event,
  read: (sender: Sender) => Value = (sender) => sender[property],
  equals: BindingEquals<Value> = valuesEqual,
): Record<Property, ReadonlySignal<Value>> &
  Record<Event, (sender: Sender, ...args: unknown[]) => void> {
  const pendingNativeValues: Value[] = []
  const propertySignal: ReadonlySignal<Value> = {
    __dynwinrtSignal: true,
    get value() {
      const value = state.value
      pendingNativeValues.push(value)
      if (pendingNativeValues.length > maxPendingNativeWrites) {
        pendingNativeValues.shift()
      }
      return value
    },
    peek() {
      return state.peek()
    },
    subscribe(listener, options) {
      return state.subscribe(listener, options)
    },
  }

  return {
    [property]: propertySignal,
    [event]: (sender: Sender) => {
      const next = read(sender)
      if (
        pendingNativeValues.some((pending) => equals(pending, next))
      ) {
        pendingNativeValues.shift()
        return
      }
      pendingNativeValues.length = 0
      state.value = next
    },
  } as Record<Property, ReadonlySignal<Value>> &
    Record<Event, (sender: Sender, ...args: unknown[]) => void>
}

export const bind = {
  oneWay,
  twoWay,
}
