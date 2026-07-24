import {
  assertRendererIdle,
} from './runtime/diagnostics'
import {
  createHotReloadSession,
  type HotReloadSession,
} from './renderer/hot'
import type {
  RenderHandle,
  Renderer,
  RendererDiagnostics,
} from './renderer/renderer'
import type { Child } from './core/vnode'
import type {
  RendererHeartbeat,
} from './runtime/heartbeat'

export type {
  RendererHeartbeat,
} from './runtime/heartbeat'
export {
  getRendererHeartbeatSharedState,
  rendererHeartbeatSharedStateIndex,
  rendererHeartbeatSharedStateLength,
} from './runtime/heartbeat'

export interface WinUIWorkerClosingArgs {
  cancel: boolean
}

export interface WinUIWorkerAppWindow {
  onClosing(
    callback: (
      sender: unknown,
      args: WinUIWorkerClosingArgs,
    ) => void,
  ): () => void
}

export interface WinUIWorkerWindow {
  onClosed(callback: () => void): () => void
}

export interface WinUIWorkerApplication {
  readonly current: {
    exit(): void
  }
}

export interface WinUIWorkerApplicationHost
  extends WinUIWorkerApplication {
  start(callback: () => void): void
  create(callback: () => void): void
}

export interface WinUIWorkerActivatableWindow<
  AppWindow extends WinUIWorkerAppWindow,
> extends WinUIWorkerWindow {
  readonly appWindow: AppWindow
  activate(): void
}

export interface WinUIWorkerAppContext<
  Window extends WinUIWorkerWindow,
  AppWindow extends WinUIWorkerAppWindow,
  ProjectionScope,
> {
  readonly window: Window
  readonly appWindow: AppWindow
  readonly renderer: Renderer
  readonly projectionScope: ProjectionScope | undefined
}

export interface WinUIWorkerRenderedContext<
  Window extends WinUIWorkerWindow,
  AppWindow extends WinUIWorkerAppWindow,
  ProjectionScope,
> extends WinUIWorkerAppContext<
  Window,
  AppWindow,
  ProjectionScope
> {
  readonly renderHandle: RenderHandle
  getRenderHandle(): RenderHandle | undefined
  disposeRender(): void
  setExitCode(value: number): void
  exitApplication(): void
}

export interface WinUIWorkerRenderedHooks {
  readonly disposeBeforeRender?: () => void
}

export interface WinUIWorkerMountedApp<
  Window extends WinUIWorkerWindow,
  AppWindow extends WinUIWorkerAppWindow,
  ProjectionScope,
> {
  readonly child: Child
  readonly beforeClose?: () => void
  readonly disposeAfterRender?: () => void
  readonly onProjectionDisposed?: () => void
  readonly afterRender?: (
    context: WinUIWorkerRenderedContext<
      Window,
      AppWindow,
      ProjectionScope
    >,
  ) => WinUIWorkerRenderedHooks | void
  readonly afterActivate?: (
    context: WinUIWorkerRenderedContext<
      Window,
      AppWindow,
      ProjectionScope
    >,
  ) => void
}

export interface RunWinUIWorkerAppOptions<
  Window extends WinUIWorkerActivatableWindow<AppWindow>,
  AppWindow extends WinUIWorkerAppWindow,
  ProjectionScope extends { dispose(): void },
> {
  readonly application: WinUIWorkerApplicationHost
  readonly createRenderer: () => Renderer
  readonly createWindow: () => Window
  readonly configureWindow?: (
    context: WinUIWorkerAppContext<
      Window,
      AppWindow,
      ProjectionScope
    >,
  ) => void
  readonly createProjectionScope?: (
    context: WinUIWorkerAppContext<
      Window,
      AppWindow,
      ProjectionScope
    >,
  ) => ProjectionScope
  readonly mount: (
    context: WinUIWorkerAppContext<
      Window,
      AppWindow,
      ProjectionScope
    >,
  ) => WinUIWorkerMountedApp<
    Window,
    AppWindow,
    ProjectionScope
  >
  readonly onDiagnostics?: (
    diagnostics: RendererDiagnostics,
  ) => void
  readonly onError: (error: unknown) => void
  readonly onStage?: (
    stage:
      | 'renderer-created'
      | 'application-starting'
      | 'window-created'
      | 'projection-created'
      | 'tree-rendered'
      | 'window-activated',
  ) => void
}

export function runWinUIWorkerApp<
  Window extends WinUIWorkerActivatableWindow<AppWindow>,
  AppWindow extends WinUIWorkerAppWindow,
  ProjectionScope extends { dispose(): void },
>(
  options: RunWinUIWorkerAppOptions<
    Window,
    AppWindow,
    ProjectionScope
  >,
): number {
  let renderer: Renderer
  try {
    renderer = options.createRenderer()
    options.onStage?.('renderer-created')
  }
  catch (error) {
    options.onError(error)
    return 1
  }

  let exitCode = 1
  let requestedExitCode = 1
  let window: Window | undefined
  let appWindow: AppWindow | undefined
  let projectionScope: ProjectionScope | undefined
  let renderHandle: RenderHandle | undefined
  let mounted:
    | WinUIWorkerMountedApp<
        Window,
        AppWindow,
        ProjectionScope
      >
    | undefined
  let renderedHooks: WinUIWorkerRenderedHooks | undefined
  let beforeClose: (() => void) | undefined
  let disposeBeforeRender: (() => void) | undefined
  let disposeAfterRender: (() => void) | undefined
  let onProjectionDisposed: (() => void) | undefined

  const onceSuccessful = (
    action: (() => void) | undefined,
  ): (() => void) | undefined => {
    if (!action) {
      return undefined
    }

    let completed = false
    return () => {
      if (completed) {
        return
      }
      action()
      completed = true
    }
  }

  const onceAttempted = (
    action: (() => void) | undefined,
  ): (() => void) | undefined => {
    if (!action) {
      return undefined
    }
    let attempted = false
    return () => {
      if (attempted) {
        return
      }
      attempted = true
      action()
    }
  }

  const reportError = (error: unknown) => {
    exitCode = 1
    requestedExitCode = 1
    options.onError(error)
  }

  const reportLifecycleError = (error: unknown) => {
    exitCode = 1
    options.onError(error)
  }

  const cleanupStartupFailure = () => {
    let firstError: unknown
    for (const cleanup of [
      beforeClose,
      disposeBeforeRender,
      () => {
        renderHandle?.dispose()
        renderHandle = undefined
      },
      disposeAfterRender,
      () => {
        projectionScope?.dispose()
        projectionScope = undefined
        onProjectionDisposed?.()
      },
    ]) {
      if (!cleanup) {
        continue
      }
      try {
        cleanup()
      }
      catch (error) {
        firstError ??= error
      }
    }
    if (firstError !== undefined) {
      options.onError(firstError)
    }
  }

  try {
    options.onStage?.('application-starting')
    options.application.start(() => {
      try {
        options.application.create(() => {
          try {
            window = options.createWindow()
            appWindow = window.appWindow
            options.onStage?.('window-created')

            const baseContext: WinUIWorkerAppContext<
              Window,
              AppWindow,
              ProjectionScope
            > = {
              window,
              appWindow,
              renderer,
              projectionScope,
            }
            options.configureWindow?.(baseContext)
            projectionScope =
              options.createProjectionScope?.(baseContext)
            if (projectionScope) {
              options.onStage?.('projection-created')
            }

            const mountedContext: WinUIWorkerAppContext<
              Window,
              AppWindow,
              ProjectionScope
            > = {
              window,
              appWindow,
              renderer,
              projectionScope,
            }
            mounted = options.mount(mountedContext)
            beforeClose = onceAttempted(
              mounted.beforeClose,
            )
            disposeAfterRender = onceSuccessful(
              mounted.disposeAfterRender,
            )
            onProjectionDisposed = onceSuccessful(
              mounted.onProjectionDisposed,
            )
            renderHandle = renderer.render(
              mounted.child,
              window,
            )
            options.onStage?.('tree-rendered')

            const renderedContext:
              WinUIWorkerRenderedContext<
                Window,
                AppWindow,
                ProjectionScope
              > = {
                ...mountedContext,
                renderHandle,
                getRenderHandle() {
                  return renderHandle
                },
                disposeRender() {
                  renderHandle?.dispose()
                  renderHandle = undefined
                },
                setExitCode(value) {
                  requestedExitCode = value
                  exitCode = value
                },
                exitApplication() {
                  options.application.current.exit()
                },
              }
            renderedHooks =
              mounted.afterRender?.(renderedContext) ??
              undefined
            disposeBeforeRender = onceSuccessful(
              renderedHooks?.disposeBeforeRender,
            )

            installWinUIWindowLifecycle({
              application: options.application,
              window,
              appWindow,
              renderer,
              beforeClose,
              disposeBeforeRender,
              disposeRender() {
                renderHandle?.dispose()
                renderHandle = undefined
              },
              disposeAfterRender,
              disposeProjection() {
                projectionScope?.dispose()
                projectionScope = undefined
                onProjectionDisposed?.()
              },
              onDiagnostics: options.onDiagnostics,
              onError: reportLifecycleError,
              getRequestedExitCode() {
                return requestedExitCode
              },
              setExitCode(value) {
                exitCode = value
              },
            })

            window.activate()
            requestedExitCode = 0
            exitCode = 0
            options.onStage?.('window-activated')
            mounted.afterActivate?.(renderedContext)
          }
          catch (error) {
            reportError(error)
            cleanupStartupFailure()
            options.application.current.exit()
          }
        })
      }
      catch (error) {
        reportError(error)
        options.application.current.exit()
      }
    })
  }
  catch (error) {
    reportError(error)
  }

  return exitCode
}

export interface WinUIWindowLifecycleOptions {
  readonly application: WinUIWorkerApplication
  readonly window: WinUIWorkerWindow
  readonly appWindow: WinUIWorkerAppWindow
  readonly renderer: Pick<Renderer, 'diagnostics'>
  readonly beforeClose?: () => void
  readonly disposeBeforeRender?: () => void
  readonly disposeRender: () => void
  readonly disposeAfterRender?: () => void
  readonly disposeProjection?: () => void
  readonly onDiagnostics?: (
    diagnostics: RendererDiagnostics,
  ) => void
  readonly onError: (error: unknown) => void
  readonly getRequestedExitCode: () => number
  readonly setExitCode: (value: number) => void
}

export function installWinUIWindowLifecycle(
  options: WinUIWindowLifecycleOptions,
): void {
  let closingSubscription: (() => void) | undefined
  let closeSubscription: (() => void) | undefined

  closingSubscription = options.appWindow.onClosing(
    (_sender, args) => {
      if (args.cancel) {
        return
      }

      let firstError: unknown
      const attempt = (action: (() => void) | undefined) => {
        if (!action) {
          return true
        }
        try {
          action()
          return true
        }
        catch (error) {
          firstError ??= error
          return false
        }
      }

      attempt(options.beforeClose)
      attempt(options.disposeBeforeRender)
      attempt(options.disposeRender)
      attempt(options.disposeAfterRender)

      const diagnostics = options.renderer.diagnostics
      attempt(() => {
        assertRendererIdle(diagnostics)
      })
      attempt(() => {
        options.onDiagnostics?.(diagnostics)
      })

      let projectionError: unknown
      try {
        options.disposeProjection?.()
      }
      catch (error) {
        projectionError = error
        firstError ??= error
      }

      if (projectionError === undefined) {
        if (attempt(closingSubscription)) {
          closingSubscription = undefined
        }
      }
      else {
        args.cancel = true
      }

      if (firstError !== undefined) {
        options.setExitCode(1)
        options.onError(firstError)
      }
      if (
        projectionError !== undefined &&
        projectionError !== firstError
      ) {
        options.onError(projectionError)
      }
      if (firstError === undefined) {
        options.setExitCode(options.getRequestedExitCode())
      }
    },
  )

  closeSubscription = options.window.onClosed(() => {
    const unsubscribe = closeSubscription
    closeSubscription = undefined
    try {
      unsubscribe?.()
    }
    finally {
      options.application.current.exit()
    }
  })
}

export interface FileHotReloadMessage {
  readonly type?: string
  readonly version?: number
  readonly message?: string
}

export interface FileHotReloadFileSystem {
  existsSync(path: string): boolean
  readFileSync(path: string, encoding: 'utf8'): string
}

export interface FileHotReloadTimer {
  interval: {
    duration: bigint
  }
  isRepeating: boolean
  onTick(callback: () => void): () => void
  start(): void
  stop(): void
}

export interface FileHotReloadDispatcherQueue {
  createTimer(): FileHotReloadTimer
}

export interface RendererHeartbeatOptions {
  readonly dispatcherQueue: FileHotReloadDispatcherQueue
  readonly renderer: Renderer
  readonly onHeartbeat: (
    heartbeat: RendererHeartbeat,
  ) => void
  readonly onError: (error: unknown) => void
  readonly intervalDuration?: bigint
  readonly now?: () => number
}

export interface RendererHeartbeatController {
  readonly sequence: number
  readonly disposed: boolean
  readonly lastHeartbeat: RendererHeartbeat | null
  emit(): void
  dispose(): void
}

export function createRendererHeartbeatController(
  options: RendererHeartbeatOptions,
): RendererHeartbeatController {
  const intervalDuration =
    options.intervalDuration ?? 10_000_000n
  if (intervalDuration <= 0n) {
    throw new RangeError(
      'Renderer heartbeat intervalDuration must be positive.',
    )
  }
  const now = options.now ?? Date.now
  const timer = options.dispatcherQueue.createTimer()
  timer.interval = { duration: intervalDuration }
  timer.isRepeating = true
  let sequence = 0
  let disposed = false
  let disposeRequested = false
  let timerStopped = false
  let timerUnsubscribed = false
  let lastHeartbeat: RendererHeartbeat | null = null

  const emit = () => {
    if (disposed || disposeRequested) {
      return
    }
    try {
      sequence += 1
      lastHeartbeat = {
        sequence,
        sentAt: now(),
        snapshot: options.renderer.inspector.snapshot(),
      }
      options.onHeartbeat(lastHeartbeat)
    }
    catch (error) {
      options.onError(error)
    }
  }
  const timerSubscription = timer.onTick(emit)
  try {
    timer.start()
    emit()
  }
  catch (error) {
    let cleanupError: unknown
    for (const cleanup of [
      () => timer.stop(),
      timerSubscription,
    ]) {
      try {
        cleanup()
      }
      catch (failure) {
        cleanupError ??= failure
      }
    }
    if (cleanupError !== undefined) {
      throw new AggregateError(
        [error, cleanupError],
        'Renderer heartbeat failed to start and roll back.',
      )
    }
    throw error
  }

  return {
    get sequence() {
      return sequence
    },
    get disposed() {
      return disposed
    },
    get lastHeartbeat() {
      return lastHeartbeat
    },
    emit,
    dispose() {
      if (disposed) {
        return
      }
      disposeRequested = true
      let firstError: unknown
      if (!timerStopped) {
        try {
          timer.stop()
          timerStopped = true
        }
        catch (error) {
          firstError ??= error
        }
      }
      if (!timerUnsubscribed) {
        try {
          timerSubscription()
          timerUnsubscribed = true
        }
        catch (error) {
          firstError ??= error
        }
      }
      if (timerStopped && timerUnsubscribed) {
        disposed = true
      }
      if (firstError !== undefined) {
        throw firstError
      }
    },
  }
}

export interface FileHotReloadOptions {
  readonly statePath: string | null
  readonly dispatcherQueue: FileHotReloadDispatcherQueue
  readonly fileSystem: FileHotReloadFileSystem
  readonly renderHandle: RenderHandle
  readonly load: (message: FileHotReloadMessage) => Child
  readonly fallback?: (error: unknown) => Child
  readonly beforeReload?: (
    message: FileHotReloadMessage,
  ) => void
  readonly onReload?: (version: number) => void
  readonly onError: (error: unknown, version: number) => void
  readonly onPollError?: (
    error: unknown,
    version: number,
  ) => void
  readonly intervalDuration?: bigint
}

export interface FileHotReloadController {
  readonly version: number
  readonly disposed: boolean
  dispose(): void
}

export function createFileHotReloadController(
  options: FileHotReloadOptions,
): FileHotReloadController | undefined {
  if (!options.statePath) {
    return undefined
  }

  const session: HotReloadSession = createHotReloadSession(
    options.renderHandle,
    {
      fallback: options.fallback,
      onReload: options.onReload,
      onError: options.onError,
    },
  )
  const timer = options.dispatcherQueue.createTimer()
  timer.interval = {
    duration: options.intervalDuration ?? 2_500_000n,
  }
  timer.isRepeating = true
  let disposed = false

  const handleTick = () => {
    if (
      disposed ||
      !options.fileSystem.existsSync(options.statePath!)
    ) {
      return
    }

    try {
      const message = JSON.parse(
        options.fileSystem.readFileSync(
          options.statePath!,
          'utf8',
        ),
      ) as FileHotReloadMessage
      const version = message.version ?? 0
      if (version <= session.version) {
        return
      }
      options.beforeReload?.(message)
      void session.reload(version, () => options.load(message))
    }
    catch (error) {
      ;(options.onPollError ?? options.onError)(
        error,
        session.version,
      )
    }
  }

  const timerSubscription = timer.onTick(handleTick)
  try {
    timer.start()
  }
  catch (error) {
    let cleanupError: unknown
    try {
      timerSubscription()
    }
    catch (failure) {
      cleanupError = failure
    }
    session.dispose()
    if (cleanupError !== undefined) {
      throw new AggregateError(
        [error, cleanupError],
        'Hot reload timer failed to start and roll back.',
      )
    }
    throw error
  }

  return {
    get version() {
      return session.version
    },
    get disposed() {
      return disposed
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true

      let firstError: unknown
      for (const cleanup of [
        () => timer.stop(),
        timerSubscription,
        () => session.dispose(),
      ]) {
        try {
          cleanup()
        }
        catch (error) {
          firstError ??= error
        }
      }
      if (firstError !== undefined) {
        throw firstError
      }
    },
  }
}
