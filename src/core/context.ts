import {
  provideScopeValue,
  readScopeValue,
} from './reactive'
import type { Child, Component } from './vnode'

const contextBrand = Symbol.for('dynwinrt-jsx.context')

export interface ContextProviderProps<Value> {
  readonly value: Value
  readonly children?: Child
}

export interface Context<Value> {
  readonly [contextBrand]: true
  readonly defaultValue: Value
  readonly Provider: Component<ContextProviderProps<Value>>
}

interface InternalContext<Value> extends Context<Value> {
  readonly key: symbol
}

export function createContext<Value>(
  defaultValue: Value,
): Context<Value> {
  const key = Symbol('dynwinrt-jsx.context-value')
  const context = {
    [contextBrand]: true as const,
    key,
    defaultValue,
    Provider(props: ContextProviderProps<Value>): Child {
      provideScopeValue(key, props.value)
      return props.children
    },
  } satisfies InternalContext<Value>

  return context
}

export function useContext<Value>(
  context: Context<Value>,
): Value {
  const internal = context as InternalContext<Value>
  return readScopeValue(internal.key, context.defaultValue)
}
