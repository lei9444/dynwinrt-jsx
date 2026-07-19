import type {
  RenderHandle,
  Renderer,
} from './renderer'
import type { Child } from './vnode'

export interface HotRoot extends RenderHandle {
  refresh(): void
}

export interface HotReloadOptions {
  fallback?: (error: unknown) => Child
  onReload?: (version: number) => void
  onError?: (error: unknown, version: number) => void
}

export interface HotReloadSession {
  readonly version: number
  readonly disposed: boolean
  reload(
    version: number,
    render: () => Child | Promise<Child>,
  ): Promise<boolean>
  dispose(): void
}

function isPromise<Value>(
  value: Value | Promise<Value>,
): value is Promise<Value> {
  return (
    value !== null &&
    (
      typeof value === 'object' ||
      typeof value === 'function'
    ) &&
    typeof (value as Promise<Value>).then === 'function'
  )
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

export function createHotReloadSession(
  handle: RenderHandle,
  options: HotReloadOptions = {},
): HotReloadSession {
  let requestedVersion = 0
  let appliedVersion = 0
  let disposed = false

  return {
    get version() {
      return appliedVersion
    },
    get disposed() {
      return disposed
    },
    async reload(version, render) {
      if (disposed) {
        throw new Error('Cannot reload a disposed hot session.')
      }
      if (version <= requestedVersion) {
        return false
      }
      requestedVersion = version

      try {
        const result = render()
        const child = isPromise(result) ? await result : result
        if (disposed || version !== requestedVersion) {
          return false
        }
        handle.update(child)
        appliedVersion = version
        options.onReload?.(version)
        return true
      } catch (error) {
        if (disposed || version !== requestedVersion) {
          return false
        }
        appliedVersion = version
        options.onError?.(error, version)
        if (options.fallback) {
          handle.update(options.fallback(error))
        }
        return false
      }
    },
    dispose() {
      disposed = true
    },
  }
}
