import {
  Fragment,
  createVNode,
  type Child,
  type Key,
  type VNode,
} from './vnode'

export { Fragment }

export function jsx(
  type: VNode['type'],
  props: Record<string, unknown> | null,
  key?: Key,
): VNode {
  const actualProps = props ?? {}
  const actualKey =
    key ??
    (Object.prototype.hasOwnProperty.call(actualProps, 'key')
      ? (actualProps.key as Key)
      : null)

  return createVNode(
    type,
    actualProps as Record<string, unknown> & {
      children?: Child
    },
    actualKey,
  )
}

export const jsxs = jsx

export namespace JSX {
  export type Element = Child

  export interface ElementChildrenAttribute {
    children: unknown
  }

  export interface IntrinsicAttributes {
    key?: Key
  }
}
