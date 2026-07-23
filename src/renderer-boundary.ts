import {
  createScope,
  effect,
  runInScope,
  setReactiveScopeInspection,
  setScopeErrorHandler,
  type ReactiveScope,
} from './reactive'
import {
  RecordState,
  type MountedRecord,
} from './renderer-lifecycle'
import type { RendererErrorContext } from './renderer'
import type {
  BoundaryErrorContext,
  Child,
  ErrorBoundaryNode,
} from './vnode'

export interface RendererBoundaryHost {
  mount(
    child: Child,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord
  mountOwned(
    read: () => Child,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord
  mountEmpty(
    onNodesChanged: (nodes: readonly unknown[]) => void,
  ): MountedRecord
  handleError(
    error: unknown,
    context: RendererErrorContext,
    scope: ReactiveScope,
  ): void
}

export class RendererBoundaryService {
  constructor(
    private readonly host: RendererBoundaryHost,
  ) {}

  mount(
    boundary: ErrorBoundaryNode,
    onNodesChanged: (nodes: readonly unknown[]) => void,
    parentScope: ReactiveScope,
  ): MountedRecord {
    const scope = createScope(parentScope)
    setReactiveScopeInspection(scope, {
      kind: 'boundary',
      label: 'ErrorBoundary',
    })
    let current: MountedRecord | undefined
    let disposed = false
    let mountingPrimary = false
    let transitioning = false
    let showingFallback = false
    let pendingError:
      | {
          error: unknown
          context: BoundaryErrorContext
        }
      | undefined

    const record = new RecordState(
      onNodesChanged,
      () => {
        disposed = true
        transitioning = true
        let firstError: unknown
        try {
          setScopeErrorHandler(scope, undefined)
          try {
            current?.dispose()
          }
          catch (error) {
            firstError = error
          }
          current = undefined
          try {
            scope.dispose()
          }
          catch (error) {
            firstError ??= error
          }
        }
        finally {
          transitioning = false
        }
        if (firstError !== undefined) {
          throw firstError
        }
      },
    )

    const normalizeContext = (
      context: unknown,
    ): BoundaryErrorContext => {
      if (
        typeof context === 'object' &&
        context !== null &&
        'phase' in context &&
        typeof (context as { phase?: unknown }).phase ===
          'string'
      ) {
        return context as BoundaryErrorContext
      }

      return { phase: 'reactive' }
    }

    const mountFallback = (
      error: unknown,
      context: BoundaryErrorContext,
    ) => {
      showingFallback = true
      transitioning = true
      try {
        current = this.host.mountOwned(
          () => boundary.fallback(error, context),
          (nodes) => record.setNodes(nodes),
          scope,
        )
      }
      catch (fallbackError) {
        current = this.host.mountEmpty(
          (nodes) => record.setNodes(nodes),
        )
        this.host.handleError(
          fallbackError,
          { phase: 'component' },
          parentScope,
        )
      }
      finally {
        transitioning = false
      }
    }

    const takePendingError = () => {
      const captured:
        | {
            error: unknown
            context: BoundaryErrorContext
          }
        | undefined = pendingError
      pendingError = undefined
      return captured
    }

    const mountPrimary = () => {
      transitioning = true
      current?.dispose()
      current = undefined
      showingFallback = false
      pendingError = undefined
      transitioning = false

      mountingPrimary = true
      const candidate = this.host.mount(
        boundary.children,
        (nodes) => record.setNodes(nodes),
        scope,
      )
      mountingPrimary = false

      const captured = takePendingError()
      if (captured) {
        candidate.dispose()
        mountFallback(captured.error, captured.context)
      }
      else {
        current = candidate
      }
    }

    setScopeErrorHandler(scope, (error, rawContext) => {
      if (disposed || transitioning) {
        return false
      }

      const captured = {
        error,
        context: normalizeContext(rawContext),
      }

      if (mountingPrimary) {
        pendingError = captured
        return true
      }

      transitioning = true
      try {
        current?.dispose()
        current = undefined
      }
      finally {
        transitioning = false
      }
      mountFallback(captured.error, captured.context)
      return true
    })

    mountPrimary()

    if (boundary.readReset) {
      let initialized = false
      let previous: unknown
      runInScope(scope, () => {
        effect(() => {
          const next = boundary.readReset?.()
          if (
            initialized &&
            showingFallback &&
            !Object.is(previous, next)
          ) {
            mountPrimary()
          }
          previous = next
          initialized = true
        })
      })
    }

    return record
  }
}
