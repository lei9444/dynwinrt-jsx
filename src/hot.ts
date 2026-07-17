import type {
  RenderHandle,
  Renderer,
} from './renderer'
import type { Child } from './vnode'

export interface HotRoot extends RenderHandle {
  refresh(): void
}

export function createHotRoot(
  renderer: Renderer,
  container: object,
  render: () => Child,
): HotRoot {
  const handle = renderer.render(render(), container)

  return {
    get container() {
      return handle.container
    },
    get roots() {
      return handle.roots
    },
    get disposed() {
      return handle.disposed
    },
    update(child) {
      handle.update(child)
    },
    refresh() {
      handle.update(render())
    },
    dispose() {
      handle.dispose()
    },
  }
}
