import type { RefObject } from './native'

export interface Focusable {
  focus(state: number): boolean
}

export interface FocusTarget<Value extends Focusable>
  extends RefObject<Value> {
  focus(state?: number): boolean
}

export function createFocusTarget<Value extends Focusable>(
  defaultState: number,
): FocusTarget<Value> {
  let current: Value | null = null
  return {
    get current() {
      return current
    },
    set current(value) {
      current = value
    },
    focus(state = defaultState) {
      return current?.focus(state) ?? false
    },
  }
}
