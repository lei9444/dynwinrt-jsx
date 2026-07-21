import {
  assertRendererIdle,
} from './diagnostics'
import {
  createHotReloadSession,
  type HotReloadSession,
} from './hot'
import type {
  RenderHandle,
  Renderer,
  RendererDiagnostics,
} from './renderer'
import type { Child } from './vnode'

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
