import {
  assertRendererIdle,
  createRendererOwnershipCounts,
  type DiagnosticChannel,
  type DiagnosticLifecycleEvent,
} from './runtime/diagnostics'
import {
  assertRendererInspectionIdle,
} from './runtime/diagnostic-evidence'
import {
  createHotReloadSession,
  type HotReloadSession,
} from './renderer/hot'
import type {
  RenderHandle,
  Renderer,
  RendererDiagnostics,
} from './renderer/renderer'
import type {
  RendererInspectionSnapshot,
} from './renderer/inspector'
import type { Child } from './core/vnode'
import type {
  RendererHeartbeat,
} from './runtime/heartbeat'
import {
  createWinUIRendererPreset,
  type WinUIBindings,
  type WinUIRendererCapabilities,
  type WinUIRendererOptions,
} from './winui/winui'
import {
  createProjectedOwnership,
  type ProjectedOwnership,
} from './runtime/projected-owner'

export {
  createDiagnosticChannel,
  createRendererOwnershipCounts,
  describeDiagnosticError,
  diagnosticProtocolName,
  diagnosticProtocolVersion,
  formatDiagnosticProtocolRecord,
  isDiagnosticProtocolRecord,
  type DiagnosticChannel,
  type DiagnosticChannelOptions,
  type DiagnosticErrorDescription,
  type DiagnosticErrorDetail,
  type DiagnosticErrorEvent,
  type DiagnosticErrorInput,
  type DiagnosticLifecycleEvent,
  type DiagnosticLifecycleStateMap,
  type DiagnosticLifecycleTarget,
  type DiagnosticLevel,
  type DiagnosticNativeOwnership,
  type DiagnosticOwnershipAction,
  type DiagnosticOwnershipEvent,
  type DiagnosticProtocolEnvelope,
  type DiagnosticProtocolKind,
  type DiagnosticProtocolRecord,
  type DiagnosticProtocolRecordFor,
  type DiagnosticRouteAction,
  type DiagnosticRouteEvent,
  type DiagnosticRoutePhase,
  type DiagnosticRouteTrigger,
  type DiagnosticSnapshotEvent,
  type RendererOwnershipCounts,
} from './runtime/diagnostics'

export {
  assertRendererInspectionIdle,
  createDiagnosticBuffer,
  createDiagnosticEvidenceBundle,
  diagnosticEvidenceProtocolName,
  diagnosticEvidenceProtocolVersion,
  formatDiagnosticEvidenceBundle,
  formatDiagnosticProtocolRecordSummary,
  hasActiveRendererInspection,
  summarizeDiagnosticProtocolRecord,
  summarizeRendererInspectionIdle,
  type DiagnosticBuffer,
  type DiagnosticBufferOptions,
  type DiagnosticBufferSnapshot,
  type DiagnosticEvidenceBundle,
  type DiagnosticEvidenceBundleOptions,
  type DiagnosticHeartbeatEvidence,
  type DiagnosticProtocolRecordSummary,
  type DiagnosticRouteSmokeResult,
  type RendererInspectionIdleSummary,
} from './runtime/diagnostic-evidence'

export {
  createProjectedOwnership,
  createProjectedValueOwner,
  ownProjectedValue,
  type ProjectedOwnership,
  type ProjectedValueOwner,
} from './runtime/projected-owner'

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
  close(): void
  readonly dispatcherQueue?: {
    tryEnqueue(callback: () => void): boolean
  }
}

export interface WinUIWorkerApplication {
  readonly current: WinUIWorkerApplicationCurrent
}

export interface WinUIWorkerApplicationCurrent {
  exit(): void
}

export interface WinUIWorkerApplicationHost
  extends WinUIWorkerApplication {
  startScheduled(callback: () => void): Promise<void>
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

export interface WinUIAsyncCloseOperation {
  then(
    onFulfilled: () => void,
    onRejected: (error: unknown) => void,
  ): unknown
}

export interface WinUIWorkerMountedApp<
  Window extends WinUIWorkerWindow,
  AppWindow extends WinUIWorkerAppWindow,
  ProjectionScope,
> {
  readonly child: Child
  readonly beforeClose?: () => void
  readonly beforeCloseAsync?: (
  ) => void | WinUIAsyncCloseOperation
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

export type WinUIWorkerStage =
  | 'renderer-created'
  | 'application-starting'
  | 'window-created'
  | 'projection-created'
  | 'tree-rendered'
  | 'window-activated'

export interface RunWinUIWorkerAppOptions<
  Window extends WinUIWorkerActivatableWindow<AppWindow>,
  AppWindow extends WinUIWorkerAppWindow,
  ProjectionScope extends { dispose(): void },
> {
  readonly application: WinUIWorkerApplicationHost
  readonly createRenderer: () => Renderer
  readonly createWindow: () => Window
  readonly releaseProjectedValue?: (value: object) => void
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
  readonly onStage?: (stage: WinUIWorkerStage) => void
}

export interface WinUIProjectedLifetimeScope {
  readonly disposed: boolean
  dispose(): void
}

type WinUIAppApplicationBinding =
  WinUIWorkerApplicationHost &
  NonNullable<WinUIBindings['Application']>

export interface WinUIAppBindingNamespace
  extends WinUIBindings {
  readonly Application: WinUIAppApplicationBinding
  readonly Window: new () =>
    WinUIWorkerActivatableWindow<WinUIWorkerAppWindow>
  readonly createProjectedLifetimeScope:
    () => WinUIProjectedLifetimeScope
  readonly releaseProjected: (value: object) => void
}

type WinUIAppWindow<
  Bindings extends WinUIAppBindingNamespace,
> = InstanceType<Bindings['Window']>

type WinUIAppAppWindow<
  Bindings extends WinUIAppBindingNamespace,
> = WinUIAppWindow<Bindings>['appWindow']

type WinUIAppProjectionScope<
  Bindings extends WinUIAppBindingNamespace,
> = ReturnType<Bindings['createProjectedLifetimeScope']>

export type DefinedWinUIProjectedOwnership =
  ProjectedOwnership

export type DefinedWinUIAppContext<
  Bindings extends WinUIAppBindingNamespace,
> = WinUIWorkerAppContext<
  WinUIAppWindow<Bindings>,
  WinUIAppAppWindow<Bindings>,
  WinUIAppProjectionScope<Bindings>
> & {
  readonly bindings: Bindings
  readonly capabilities: WinUIRendererCapabilities
  readonly releaseProjected: Bindings['releaseProjected']
  readonly createProjectedOwner:
    DefinedWinUIProjectedOwnership['createProjectedOwner']
  readonly ownProjected:
    DefinedWinUIProjectedOwnership['ownProjected']
  readonly createProjected:
    DefinedWinUIProjectedOwnership['createProjected']
  readonly diagnostics: DiagnosticChannel | undefined
}

export type DefinedWinUIAppRenderedContext<
  Bindings extends WinUIAppBindingNamespace,
> = WinUIWorkerRenderedContext<
  WinUIAppWindow<Bindings>,
  WinUIAppAppWindow<Bindings>,
  WinUIAppProjectionScope<Bindings>
> & {
  readonly bindings: Bindings
  readonly capabilities: WinUIRendererCapabilities
  readonly releaseProjected: Bindings['releaseProjected']
  readonly createProjectedOwner:
    DefinedWinUIProjectedOwnership['createProjectedOwner']
  readonly ownProjected:
    DefinedWinUIProjectedOwnership['ownProjected']
  readonly createProjected:
    DefinedWinUIProjectedOwnership['createProjected']
  readonly diagnostics: DiagnosticChannel | undefined
}

export interface DefinedWinUIAppMountedApp<
  Bindings extends WinUIAppBindingNamespace,
> {
  readonly child: Child
  readonly beforeClose?: () => void
  readonly beforeCloseAsync?: (
  ) => void | WinUIAsyncCloseOperation
  readonly disposeAfterRender?: () => void
  readonly onProjectionDisposed?: () => void
  readonly afterRender?: (
    context: DefinedWinUIAppRenderedContext<Bindings>,
  ) => WinUIWorkerRenderedHooks | void
  readonly afterActivate?: (
    context: DefinedWinUIAppRenderedContext<Bindings>,
  ) => void
}

export interface DefineWinUIAppOptions<
  Bindings extends WinUIAppBindingNamespace,
> {
  readonly bindings: Bindings
  readonly initializeRuntime?: () => void
  readonly rendererOptions?: Omit<
    WinUIRendererOptions,
    'releaseNative'
  >
  readonly createWindow?: (
    bindings: Bindings,
  ) => WinUIAppWindow<Bindings>
  readonly configureWindow?: (
    context: DefinedWinUIAppContext<Bindings>,
  ) => void
  readonly mount: (
    context: DefinedWinUIAppContext<Bindings>,
  ) => DefinedWinUIAppMountedApp<Bindings>
  readonly diagnostics?: DiagnosticChannel
  readonly onDiagnostics?: (
    diagnostics: RendererDiagnostics,
  ) => void
  readonly onError: (error: unknown) => void
  readonly onStage?: (stage: WinUIWorkerStage) => void
}

export interface DefinedWinUIApp<
  Bindings extends WinUIAppBindingNamespace,
> {
  readonly bindings: Bindings
  readonly capabilities: WinUIRendererCapabilities
  readonly started: boolean
  run(): Promise<number>
}

function requireWinUIAppBindings(
  bindings: WinUIAppBindingNamespace,
): void {
  if (
    typeof bindings !== 'object' ||
    bindings === null
  ) {
    throw new TypeError(
      'defineWinUIApp bindings must be a generated binding namespace.',
    )
  }
  if (
    typeof bindings.Application?.startScheduled !==
      'function' ||
    typeof bindings.Application?.create !== 'function'
  ) {
    throw new TypeError(
      'defineWinUIApp requires generated Application.startScheduled() and Application.create(). Regenerate the WinUI bindings.',
    )
  }
  if (typeof bindings.Window !== 'function') {
    throw new TypeError(
      'defineWinUIApp requires a generated Window constructor.',
    )
  }
  if (
    typeof bindings.createProjectedLifetimeScope !==
      'function'
  ) {
    throw new TypeError(
      'defineWinUIApp requires generated createProjectedLifetimeScope().',
    )
  }
  if (typeof bindings.releaseProjected !== 'function') {
    throw new TypeError(
      'defineWinUIApp requires generated releaseProjected().',
    )
  }
}

export function defineWinUIApp<
  Bindings extends WinUIAppBindingNamespace,
>(
  options: DefineWinUIAppOptions<Bindings>,
): DefinedWinUIApp<Bindings> {
  requireWinUIAppBindings(options.bindings)
  const {
    bindings,
    diagnostics,
  } = options
  const rendererPreset =
    createWinUIRendererPreset(bindings)
  const projectedOwnership =
    createProjectedOwnership(
      bindings.releaseProjected,
    )
  let started = false

  return {
    bindings,
    capabilities: rendererPreset.capabilities,
    get started() {
      return started
    },
    async run() {
      if (started) {
        throw new Error(
          'A defined WinUI application can only run once.',
        )
      }
      started = true
      let lastStage = 'worker-starting'
      let workerFailed = false
      let renderer: Renderer | undefined
      let applicationStarted = false
      let windowCreated = false
      let windowActivated = false
      let projectionScope:
        | WinUIAppProjectionScope<Bindings>
        | undefined

      const emitLifecycle = (
        event: DiagnosticLifecycleEvent,
      ) => {
        diagnostics?.lifecycle(event)
      }
      const emitOwnershipSnapshot = (
        name: string,
        inspection?: RendererInspectionSnapshot,
      ) => {
        if (!renderer || !diagnostics) {
          return
        }
        const ownershipEnabled =
          diagnostics.isEnabled('ownership')
        const snapshotEnabled =
          diagnostics.isEnabled('snapshot')
        if (!ownershipEnabled && !snapshotEnabled) {
          return
        }
        const snapshot =
          inspection ?? renderer.inspector.snapshot()
        if (ownershipEnabled) {
          const counts =
            createRendererOwnershipCounts(snapshot)
          diagnostics.ownership({
            owner: 'app-host',
            resource: 'renderer-native-tree',
            ownership: 'owned',
            action: 'snapshot',
            activeCount: counts.activeNative,
            counts,
          })
        }
        if (snapshotEnabled) {
          diagnostics.snapshot({
            name,
            data: snapshot,
          })
        }
      }
      const reportError = (error: unknown) => {
        if (!workerFailed) {
          workerFailed = true
          emitLifecycle({
            target: 'worker',
            state: 'failed',
            stage: lastStage,
          })
        }
        diagnostics?.error({
          category: 'app-host',
          operation: lastStage,
          error,
        })
        options.onError(error)
      }
      const reportStage = (stage: WinUIWorkerStage) => {
        lastStage = stage
        switch (stage) {
          case 'renderer-created':
            emitLifecycle({
              target: 'renderer',
              state: 'created',
              stage,
            })
            diagnostics?.ownership({
              owner: 'app-host',
              resource: 'renderer',
              ownership: 'owned',
              action: 'acquired',
              activeCount: 1,
            })
            break
          case 'application-starting':
            applicationStarted = true
            emitLifecycle({
              target: 'application',
              state: 'starting',
              stage,
            })
            break
          case 'window-created':
            windowCreated = true
            emitLifecycle({
              target: 'application',
              state: 'created',
              stage: 'application-created',
            })
            emitLifecycle({
              target: 'window',
              state: 'created',
              stage,
            })
            break
          case 'projection-created':
            emitLifecycle({
              target: 'projection',
              state: 'active',
              stage,
            })
            diagnostics?.ownership({
              owner: 'app-host',
              resource: 'projection-scope',
              ownership: 'owned',
              action: 'acquired',
              activeCount: 1,
            })
            break
          case 'tree-rendered':
            emitLifecycle({
              target: 'renderer',
              state: 'mounted',
              stage,
            })
            emitOwnershipSnapshot('renderer-mounted')
            break
          case 'window-activated':
            windowActivated = true
            emitLifecycle({
              target: 'window',
              state: 'active',
              stage,
            })
            emitLifecycle({
              target: 'application',
              state: 'running',
              stage,
            })
            emitLifecycle({
              target: 'worker',
              state: 'running',
              stage,
            })
            break
        }
        options.onStage?.(stage)
      }

      emitLifecycle({
        target: 'worker',
        state: 'starting',
        stage: lastStage,
      })
      try {
        options.initializeRuntime?.()
      }
      catch (error) {
        reportError(error)
        emitLifecycle({
          target: 'worker',
          state: 'stopped',
          stage: 'worker-stopped',
        })
        return 1
      }

      const exitCode = await runWinUIWorkerApp<
        WinUIAppWindow<Bindings>,
        WinUIAppAppWindow<Bindings>,
        WinUIAppProjectionScope<Bindings>
      >({
        application: bindings.Application,
        releaseProjectedValue: bindings.releaseProjected,
        createRenderer() {
          renderer = rendererPreset.createRenderer({
            ...options.rendererOptions,
            releaseNative: bindings.releaseProjected,
          })
          return renderer
        },
        createWindow() {
          return options.createWindow
            ? options.createWindow(bindings)
            : new bindings.Window() as
                WinUIAppWindow<Bindings>
        },
        configureWindow(context) {
          options.configureWindow?.({
            ...context,
            bindings,
            capabilities: rendererPreset.capabilities,
            releaseProjected: bindings.releaseProjected,
            ...projectedOwnership,
            diagnostics,
          })
        },
        createProjectionScope() {
          const created =
            bindings.createProjectedLifetimeScope() as
              WinUIAppProjectionScope<Bindings>
          if (
            typeof created !== 'object' ||
            created === null ||
            typeof created.dispose !== 'function' ||
            typeof created.disposed !== 'boolean'
          ) {
            throw new TypeError(
              'createProjectedLifetimeScope() must return a scope with disposed and dispose().',
            )
          }
          projectionScope = created
          return created
        },
        mount(context) {
          const mounted = options.mount({
            ...context,
            bindings,
            capabilities: rendererPreset.capabilities,
            releaseProjected: bindings.releaseProjected,
            ...projectedOwnership,
            diagnostics,
          })
          return {
            child: mounted.child,
            beforeClose: mounted.beforeClose,
            beforeCloseAsync: mounted.beforeCloseAsync,
            disposeAfterRender:
              mounted.disposeAfterRender,
            onProjectionDisposed:
              mounted.onProjectionDisposed,
            afterRender(renderedContext) {
              return mounted.afterRender?.({
                ...renderedContext,
                bindings,
                capabilities:
                  rendererPreset.capabilities,
                releaseProjected:
                  bindings.releaseProjected,
                ...projectedOwnership,
                diagnostics,
              })
            },
            afterActivate(renderedContext) {
              mounted.afterActivate?.({
                ...renderedContext,
                bindings,
                capabilities:
                  rendererPreset.capabilities,
                releaseProjected:
                  bindings.releaseProjected,
                ...projectedOwnership,
                diagnostics,
              })
            },
          }
        },
        onDiagnostics: options.onDiagnostics,
        onError: reportError,
        onStage: reportStage,
      })

      const finalInspection =
        renderer?.inspector.snapshot()
      if (finalInspection) {
        emitOwnershipSnapshot(
          'renderer-final',
          finalInspection,
        )
      }
      if (renderer) {
        const counts = createRendererOwnershipCounts(
          finalInspection ??
            renderer.inspector.snapshot(),
        )
        const active =
          counts.activeNative +
          counts.activeComponents +
          counts.reactiveScopes +
          counts.reactiveObservers +
          counts.subscriptions
        emitLifecycle({
          target: 'renderer',
          state: active === 0 ? 'idle' : 'failed',
          stage: 'renderer-final',
        })
        diagnostics?.ownership({
          owner: 'app-host',
          resource: 'renderer',
          ownership: 'owned',
          action: active === 0
            ? 'released'
            : 'release-failed',
          activeCount: active,
        })
      }
      if (projectionScope) {
        emitLifecycle({
          target: 'projection',
          state: projectionScope.disposed
            ? 'disposed'
            : 'failed',
          stage: 'projection-final',
        })
        diagnostics?.ownership({
          owner: 'app-host',
          resource: 'projection-scope',
          ownership: 'owned',
          action: projectionScope.disposed
            ? 'released'
            : 'release-failed',
          activeCount: projectionScope.disposed ? 0 : 1,
        })
      }
      if (windowCreated) {
        const windowClosed =
          windowActivated || !workerFailed
        emitLifecycle({
          target: 'window',
          state: windowClosed ? 'closed' : 'failed',
          stage: windowClosed
            ? 'window-closed'
            : 'window-failed',
        })
      }
      if (applicationStarted) {
        const applicationExited = windowCreated
        emitLifecycle({
          target: 'application',
          state: applicationExited
            ? 'exited'
            : 'failed',
          stage: applicationExited
            ? 'application-exited'
            : 'application-failed',
        })
      }
      emitLifecycle({
        target: 'worker',
        state: 'stopped',
        stage: 'worker-stopped',
      })
      return exitCode
    },
  }
}

export async function runWinUIWorkerApp<
  Window extends WinUIWorkerActivatableWindow<AppWindow>,
  AppWindow extends WinUIWorkerAppWindow,
  ProjectionScope extends { dispose(): void },
>(
  options: RunWinUIWorkerAppOptions<
    Window,
    AppWindow,
    ProjectionScope
  >,
): Promise<number> {
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
  let applicationCurrent:
    | WinUIWorkerApplicationCurrent
    | undefined
  let applicationCurrentReleased = false
  let appWindowReleased = false
  let windowReleased = false
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
  let lifecycleInstalled = false
  let windowLifecycle:
    | WinUIWindowLifecycleController
    | undefined
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

  const releaseApplicationCurrent = () => {
    if (
      applicationCurrentReleased ||
      !applicationCurrent
    ) {
      return
    }
    options.releaseProjectedValue?.(
      applicationCurrent as object,
    )
    applicationCurrentReleased = true
  }

  const releaseAppWindow = () => {
    if (appWindowReleased || !appWindow) {
      return
    }
    options.releaseProjectedValue?.(appWindow as object)
    appWindowReleased = true
  }

  const releaseWindow = () => {
    if (windowReleased || !window) {
      return
    }
    options.releaseProjectedValue?.(window as object)
    windowReleased = true
  }

  const exitApplicationAfterFailure = () => {
    const current =
      applicationCurrent ?? options.application.current
    let firstError: unknown
    const attempt = (action: () => void) => {
      try {
        action()
      }
      catch (error) {
        firstError ??= error
      }
    }
    attempt(releaseAppWindow)
    attempt(releaseWindow)
    attempt(() => current.exit())
    if (current === applicationCurrent) {
      attempt(releaseApplicationCurrent)
    }
    else {
      attempt(() => {
        options.releaseProjectedValue?.(current as object)
      })
    }
    if (firstError !== undefined) {
      options.onError(firstError)
    }
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
    const initializeApplication = () => {
      try {
        options.application.create(() => {
          try {
            applicationCurrent = options.application.current
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
                  applicationCurrent!.exit()
                },
              }
            renderedHooks =
              mounted.afterRender?.(renderedContext) ??
              undefined
            disposeBeforeRender = onceSuccessful(
              renderedHooks?.disposeBeforeRender,
            )

            windowLifecycle = installWinUIWindowLifecycle({
              application: options.application,
              applicationCurrent,
              releaseApplicationCurrent,
              releaseAppWindow,
              releaseWindow,
              window,
              appWindow,
              renderer,
              beforeClose,
              beforeCloseAsync: mounted.beforeCloseAsync,
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
            lifecycleInstalled = true

            window.activate()
            requestedExitCode = 0
            exitCode = 0
            options.onStage?.('window-activated')
            mounted.afterActivate?.(renderedContext)
          }
          catch (error) {
            reportError(error)
            if (lifecycleInstalled && window) {
              try {
                window.close()
                if (
                  !windowLifecycle?.closed &&
                  !windowLifecycle?.closePending
                ) {
                  windowLifecycle?.shutdownAfterCloseFailure()
                }
              }
              catch (closeError) {
                options.onError(closeError)
                windowLifecycle?.shutdownAfterCloseFailure()
              }
            }
            else {
              cleanupStartupFailure()
              exitApplicationAfterFailure()
            }
          }
        })
      }
      catch (error) {
        reportError(error)
        exitApplicationAfterFailure()
      }
    }
    await options.application.startScheduled(
      initializeApplication,
    )
  }
  catch (error) {
    reportError(error)
  }

  return exitCode
}

export interface WinUIWindowLifecycleOptions {
  readonly application: WinUIWorkerApplication
  readonly applicationCurrent?:
    WinUIWorkerApplicationCurrent
  readonly releaseApplicationCurrent?: () => void
  readonly releaseAppWindow?: () => void
  readonly releaseWindow?: () => void
  readonly window: WinUIWorkerWindow
  readonly appWindow: WinUIWorkerAppWindow
  readonly renderer:
    Pick<Renderer, 'diagnostics'> &
    Partial<Pick<Renderer, 'inspector'>>
  readonly beforeClose?: () => void
  readonly beforeCloseAsync?: (
  ) => void | WinUIAsyncCloseOperation
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

export interface WinUIWindowLifecycleController {
  readonly closed: boolean
  readonly closePending: boolean
  shutdownAfterCloseFailure(): void
}

export function installWinUIWindowLifecycle(
  options: WinUIWindowLifecycleOptions,
): WinUIWindowLifecycleController {
  const applicationCurrent =
    options.applicationCurrent ?? options.application.current
  let closingSubscription: (() => void) | undefined
  let closeSubscription: (() => void) | undefined
  let asyncCloseCompleted = false
  let asyncCloseInFlight = false
  let asyncCloseFailed = false
  let closedWhileAsyncCleanup = false
  let finalCloseInProgress = false
  let closedDuringFinalClose = false
  let closedCompleted = false
  let teardownCompleted = false
  let closedRootCompletionAllowed = true
  let closedTeardownRetryAttempted = false
  let closedTeardownRetryQueued = false

  const completeWindowClosed = () => {
    if (closedCompleted) {
      return
    }
    closedCompleted = true
    const unsubscribe = closeSubscription
    closeSubscription = undefined
    let firstError: unknown
    try {
      unsubscribe?.()
    }
    catch (error) {
      firstError ??= error
    }
    try {
      options.releaseAppWindow?.()
    }
    catch (error) {
      firstError ??= error
    }
    try {
      options.releaseWindow?.()
    }
    catch (error) {
      firstError ??= error
    }
    try {
      applicationCurrent.exit()
    }
    catch (error) {
      firstError ??= error
    }
    try {
      options.releaseApplicationCurrent?.()
    }
    catch (error) {
      firstError ??= error
    }
    if (firstError !== undefined) {
      throw firstError
    }
  }

  const performSynchronousTeardown = (
    cancel?: () => void,
    unsubscribeClosing = true,
  ): boolean => {
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
      if (options.renderer.inspector) {
        assertRendererInspectionIdle(
          options.renderer.inspector.snapshot(),
          'Renderer disposal',
        )
      }
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
      if (unsubscribeClosing) {
        if (attempt(closingSubscription)) {
          closingSubscription = undefined
        }
      }
    }
    else {
      cancel?.()
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
      options.setExitCode(
        asyncCloseFailed ? 1 : options.getRequestedExitCode(),
      )
    }
    return projectionError === undefined
  }

  const reportClosedCleanupError = (error: unknown) => {
    options.setExitCode(1)
    options.onError(error)
  }

  const runClosedTeardown = () => {
    if (closedTeardownRetryQueued) {
      return
    }
    try {
      if (!teardownCompleted) {
        if (performSynchronousTeardown(
          undefined,
          false,
        )) {
          teardownCompleted = true
        }
        else {
          if (closedTeardownRetryAttempted) {
            return
          }
          closedTeardownRetryAttempted = true
          const retry = () => {
            closedTeardownRetryQueued = false
            runClosedTeardown()
          }
          if (options.window.dispatcherQueue) {
            try {
              closedTeardownRetryQueued =
                options.window.dispatcherQueue.tryEnqueue(retry)
            }
            catch (error) {
              reportClosedCleanupError(error)
              retry()
              return
            }
            if (!closedTeardownRetryQueued) {
              reportClosedCleanupError(new Error(
                'The Window.Closed teardown retry could not be queued.',
              ))
              retry()
            }
          }
          else {
            retry()
          }
          return
        }
      }
      if (closedRootCompletionAllowed) {
        if (closingSubscription) {
          try {
            closingSubscription()
            closingSubscription = undefined
          }
          catch (error) {
            reportClosedCleanupError(error)
          }
        }
        completeWindowClosed()
      }
    }
    catch (error) {
      reportClosedCleanupError(error)
    }
  }

  const onClosing = (
    _sender: unknown,
    args: WinUIWorkerClosingArgs,
  ) => {
      if (finalCloseInProgress) {
        if (args.cancel) {
          return
        }
        if (performSynchronousTeardown(
          () => {
            args.cancel = true
          },
          false,
        )) {
          teardownCompleted = true
        }
        return
      }
      if (args.cancel) {
        return
      }
      if (
        options.beforeCloseAsync &&
        !asyncCloseCompleted
      ) {
        args.cancel = true
        if (asyncCloseInFlight) {
          return
        }
        asyncCloseInFlight = true
        const failAsyncClose = (error: unknown) => {
          asyncCloseFailed = true
          asyncCloseCompleted = false
          asyncCloseInFlight = false
          options.setExitCode(1)
          options.onError(error)
          if (closedWhileAsyncCleanup) {
            closedRootCompletionAllowed = true
            runClosedTeardown()
          }
        }
        const close = () => {
          asyncCloseCompleted = true
          asyncCloseInFlight = false
          if (
            closedWhileAsyncCleanup ||
            closedCompleted
          ) {
            closedRootCompletionAllowed = true
            runClosedTeardown()
            return
          }
          try {
            if (closingSubscription) {
              closingSubscription()
              closingSubscription =
                options.appWindow.onClosing(onClosing)
            }
            finalCloseInProgress = true
            closedDuringFinalClose = false
            closedRootCompletionAllowed = false
            let closeError: unknown
            try {
              options.window.close()
            }
            catch (error) {
              closeError = error
            }
            if (!closedDuringFinalClose) {
              closedRootCompletionAllowed = true
              failAsyncClose(
                closeError ?? new Error(
                  'The final Window.close() call returned without raising Window.Closed.',
                ),
              )
              return
            }
            let unsubscribeError: unknown
            if (closingSubscription) {
              try {
                closingSubscription()
                closingSubscription = undefined
              }
              catch (error) {
                unsubscribeError = error
              }
            }
            closedRootCompletionAllowed = true
            runClosedTeardown()
            if (
              closeError !== undefined &&
              unsubscribeError !== undefined
            ) {
              failAsyncClose(new AggregateError(
                [closeError, unsubscribeError],
                'Window close and Closing unsubscribe failed.',
              ))
            }
            else if (closeError !== undefined) {
              failAsyncClose(closeError)
            }
            else if (unsubscribeError !== undefined) {
              failAsyncClose(unsubscribeError)
            }
          }
          catch (error) {
            closedRootCompletionAllowed = true
            failAsyncClose(error)
          }
          finally {
            finalCloseInProgress = false
          }
        }
        const finishAsyncClose = () => {
          if (closedWhileAsyncCleanup) {
            asyncCloseCompleted = true
            asyncCloseInFlight = false
            closedRootCompletionAllowed = true
            runClosedTeardown()
            return
          }
          let queued = false
          try {
            queued =
              options.window.dispatcherQueue?.tryEnqueue(close) ??
              false
          }
          catch (error) {
            failAsyncClose(error)
            return
          }
          if (
            options.window.dispatcherQueue &&
            !queued
          ) {
            failAsyncClose(
              new Error(
                'The async close continuation could not be queued.',
              ),
            )
            return
          }
          if (!options.window.dispatcherQueue) {
            close()
          }
        }
        try {
          const result = options.beforeCloseAsync()
          if (result) {
            void result.then(
              finishAsyncClose,
              failAsyncClose,
            )
          }
          else {
            finishAsyncClose()
          }
        }
        catch (error) {
          failAsyncClose(error)
        }
        return
      }
      if (performSynchronousTeardown(() => {
        args.cancel = true
      })) {
        teardownCompleted = true
      }
    }
  closingSubscription = options.appWindow.onClosing(onClosing)

  closeSubscription = options.window.onClosed(() => {
    if (
      asyncCloseInFlight &&
      !finalCloseInProgress
    ) {
      closedWhileAsyncCleanup = true
      return
    }
    if (finalCloseInProgress) {
      closedDuringFinalClose = true
      runClosedTeardown()
      return
    }
    runClosedTeardown()
  })

  return {
    get closed() {
      return closedCompleted
    },
    get closePending() {
      return (
        asyncCloseInFlight ||
        finalCloseInProgress ||
        closedTeardownRetryQueued
      )
    },
    shutdownAfterCloseFailure() {
      if (closedCompleted) {
        return
      }
      if (closingSubscription) {
        try {
          closingSubscription()
          closingSubscription = undefined
        }
        catch (error) {
          reportClosedCleanupError(error)
        }
      }
      closedRootCompletionAllowed = true
      runClosedTeardown()
    },
  }
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
