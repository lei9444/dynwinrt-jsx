import {
  createVNode,
  type Child,
  type Component,
} from './vnode'

export type LazyComponentLoader<Props extends object> =
  () => Component<Props>

export function createLazyComponent<Props extends object>(
  load: LazyComponentLoader<Props>,
): Component<Props> {
  let component: Component<Props> | undefined
  return (props) => {
    if (!component) {
      const loaded = load()
      if (typeof loaded !== 'function') {
        throw new TypeError(
          'A lazy component loader must return a component function.',
        )
      }
      component = loaded
    }
    return createVNode(
      component,
      props as Record<string, unknown>,
      null,
    ) as Child
  }
}
