import {
  createControls,
  createMessageTransport,
  createStateBridge,
  thickness,
  type Child,
} from 'dynwinrt-jsx'
import {
  createFileHotReloadController,
  createRendererHeartbeatController,
  defineWinUIApp,
  getRendererHeartbeatSharedState,
  rendererHeartbeatSharedStateIndex,
  type FileHotReloadFileSystem,
  type FileHotReloadMessage,
  type RendererHeartbeat,
} from 'dynwinrt-jsx/worker'
import { roInitialize } from '@microsoft/dynwinrt'
import * as WinUIBindings from '#winapp/bindings'
import {
  ApplicationTheme,
  AppNotificationManager,
  DispatcherQueuePriority,
  StackPanel,
  TextBlock,
  TextWrapping,
  TitleBarHeightOption,
  TitleBarTheme,
} from '#winapp/bindings'
import {
  createAppModel,
  type AppState,
} from './app-model'
import { createAppNotificationOwner } from './app-notification-owner'
import {
  createGallerySecondaryWindowManager,
} from './secondary-window-manager'
import type { AppContext } from './app'

interface ParentPort {
  postMessage(message: unknown): void
}

interface StatePort {
  postMessage(message: unknown): void
  on(type: 'message', listener: (message: unknown) => void): unknown
  off(type: 'message', listener: (message: unknown) => void): unknown
  close(): void
}

interface NodeRequire {
  (id: string): unknown
  readonly cache: Record<string, unknown>
  resolve(id: string): string
}

interface AppModule {
  renderApp(context: AppContext): Child
}

declare const require: NodeRequire
declare const process: {
  exit(code?: number): never
}

const {
  parentPort,
  workerData,
} = require('node:worker_threads') as {
  parentPort: ParentPort | null
  workerData: {
    statePort: StatePort
    hotStatePath: string | null
    heartbeatEnabled: boolean
    heartbeatState: SharedArrayBuffer
    inspectorExportPath: string
    initialState: AppState
    shellCapabilities: AppContext['shellCapabilities']
  }
}

if (!parentPort) {
  throw new Error('The WinUI entry point must run in a Worker.')
}

const bridge = createStateBridge<AppState>(
  createMessageTransport(workerData.statePort),
  {
    role: 'client',
    channel: 'app-state',
    initial: workerData.initialState,
  },
)
const FallbackUI = createControls({
  StackPanel,
  TextBlock,
})
const moduleId = './app.js'
const modulePath = require.resolve(moduleId)
const fileSystem = require('node:fs') as FileHotReloadFileSystem
const heartbeatState = getRendererHeartbeatSharedState(
  workerData.heartbeatState,
)

const loadApp = (invalidate: boolean): AppModule => {
  if (invalidate) {
    delete require.cache[modulePath]
  }
  return require(moduleId) as AppModule
}

const errorTree = (error: unknown): Child => (
  <FallbackUI.StackPanel padding={thickness(24)} spacing={12}>
    <FallbackUI.TextBlock text="Hot reload failed" fontSize={24} />
    <FallbackUI.TextBlock
      automationId="HotReloadError"
      text={error instanceof Error ? error.stack ?? error.message : String(error)}
      textWrapping={TextWrapping.Wrap}
    />
  </FallbackUI.StackPanel>
)

const app = defineWinUIApp({
  bindings: WinUIBindings,
  initializeRuntime() {
    roInitialize(0)
  },
  configureWindow({
    bindings,
    releaseProjected,
    window,
  }) {
    window.extendsContentIntoTitleBar = true
    const application = bindings.Application.current
    try {
      application.requestedTheme =
        workerData.initialState.darkTheme
          ? ApplicationTheme.Dark
          : ApplicationTheme.Light
    }
    finally {
      releaseProjected(application)
    }
    window.title = 'dynwinrt-jsx Gallery'
    const configuredAppWindow = window.appWindow
    try {
      configuredAppWindow.resize({
        width: 1280,
        height: 820,
      })
      const titleBar = configuredAppWindow.titleBar
      try {
        titleBar.preferredTheme =
          workerData.initialState.darkTheme
            ? TitleBarTheme.Dark
            : TitleBarTheme.Light
        titleBar.preferredHeightOption =
          TitleBarHeightOption.Tall
      }
      finally {
        releaseProjected(titleBar)
      }
    }
    finally {
      releaseProjected(configuredAppWindow)
    }
  },
  mount({
    bindings,
    window,
    renderer,
    createProjectedOwner,
    ownProjected,
    createProjected,
  }) {
    window.systemBackdrop = new bindings.MicaBackdrop()
    const appNotifications = createAppNotificationOwner({
      getManager: () => AppNotificationManager.default_,
    })
    const secondaryWindows =
      createGallerySecondaryWindowManager(renderer)
    const model = createAppModel(
      bridge,
      workerData.initialState,
    )
    if (!workerData.heartbeatEnabled) {
      model.heartbeatDisabled()
    }
    let lastTimeoutCount = 0n
    let lastExportRevision = 0n
    const refreshHostDiagnostics = () => {
      const timeoutCount = Atomics.load(
        heartbeatState,
        rendererHeartbeatSharedStateIndex.timeoutCount,
      )
      const timeoutAt = Atomics.load(
        heartbeatState,
        rendererHeartbeatSharedStateIndex.timeoutAt,
      )
      if (
        timeoutCount > lastTimeoutCount &&
        timeoutAt > 0n
      ) {
        lastTimeoutCount = timeoutCount
        model.heartbeatTimedOut(Number(timeoutAt))
      }
      const acknowledgedSequence = Atomics.load(
        heartbeatState,
        rendererHeartbeatSharedStateIndex.acknowledgedSequence,
      )
      const acknowledgedAt = Atomics.load(
        heartbeatState,
        rendererHeartbeatSharedStateIndex.acknowledgedAt,
      )
      if (
        acknowledgedSequence > 0n &&
        acknowledgedAt >= timeoutAt
      ) {
        model.heartbeatAcknowledged(
          Number(acknowledgedSequence),
          Number(acknowledgedAt),
          timeoutCount > 0n,
        )
      }
      const exportRevision = Atomics.load(
        heartbeatState,
        rendererHeartbeatSharedStateIndex.exportRevision,
      )
      if (exportRevision > lastExportRevision) {
        lastExportRevision = exportRevision
        const exportStatus = Atomics.load(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.exportStatus,
        )
        if (exportStatus === 1n) {
          model.inspectorExported(
            workerData.inspectorExportPath,
          )
        }
        else if (exportStatus === -1n) {
          model.inspectorExportFailed(
            'The Host could not write the snapshot.',
          )
        }
      }
    }
    const context: AppContext = {
      model,
      renderer,
      window,
      appNotifications,
      secondaryWindows,
      shellCapabilities: workerData.shellCapabilities,
      createProjectedOwner,
      ownProjected,
      createProjected,
      refreshDiagnostics() {
        model.updateInspection(
          renderer.inspector.snapshot(),
        )
      },
      exportDiagnostics() {
        model.inspectorExportStatus.value =
          `Export requested: ${workerData.inspectorExportPath}`
        Atomics.store(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.exportStatus,
          0n,
        )
        parentPort.postMessage({
          type: 'inspector-export',
          value: renderer.inspector.snapshot(),
        })
      },
    }

    let tree: Child
    try {
      tree = loadApp(false).renderApp(context)
    }
    catch (error) {
      tree = errorTree(error)
    }

    return {
      child: tree,
      beforeClose() {
        bridge.set(model.snapshot('closed'))
      },
      disposeAfterRender() {
        let firstError: unknown
        try {
          secondaryWindows.dispose()
        }
        catch (error) {
          firstError ??= error
        }
        try {
          model.dispose()
        }
        catch (error) {
          firstError ??= error
        }
        if (firstError !== undefined) {
          throw firstError
        }
      },
      beforeCloseAsync() {
        const disposeWindows = () =>
          secondaryWindows.disposeAsync(
            (callback) =>
              window.dispatcherQueue.tryEnqueue(
                DispatcherQueuePriority.Low,
                callback,
              ),
          )
        let notificationCleanup: void | Promise<void>
        try {
          notificationCleanup = appNotifications.dispose()
        }
        catch (notificationError) {
          if (
            secondaryWindows.xamlWindowCount === 0 &&
            secondaryWindows.appWindowCount === 0
          ) {
            throw notificationError
          }
          return {
            then(onFulfilled, onRejected) {
              disposeWindows().then(
                () => onRejected(notificationError),
                (cleanupError) => onRejected(
                  new AggregateError(
                    [notificationError, cleanupError],
                    'Application notification and secondary window cleanup failed.',
                  ),
                ),
              )
            },
          }
        }
        if (
          secondaryWindows.xamlWindowCount === 0 &&
          secondaryWindows.appWindowCount === 0
        ) {
          return notificationCleanup
        }
        if (!notificationCleanup) {
          return disposeWindows()
        }
        return {
          then(onFulfilled, onRejected) {
            const finish = (notificationError?: unknown) => {
              disposeWindows().then(
                () => {
                  if (notificationError === undefined) {
                    onFulfilled()
                  }
                  else {
                    onRejected(notificationError)
                  }
                },
                (cleanupError) => onRejected(
                  notificationError === undefined
                    ? cleanupError
                    : new AggregateError(
                        [notificationError, cleanupError],
                        'Application notification and secondary window cleanup failed.',
                      ),
                ),
              )
            }
            try {
              void notificationCleanup.then(
                () => finish(),
                (error) => finish(error),
              )
            }
            catch (error) {
              finish(error)
            }
          },
        }
      },
      afterRender({ renderHandle }) {
        const hotReloadController =
          createFileHotReloadController({
            statePath: workerData.hotStatePath,
            dispatcherQueue: window.dispatcherQueue,
            fileSystem,
            renderHandle,
            fallback: errorTree,
            beforeReload(message) {
              model.hotStatus.value =
                message.type === 'hot-build-error'
                  ? 'build error'
                  : 'reloading'
            },
            load(message: FileHotReloadMessage) {
              if (message.type === 'hot-build-error') {
                throw new Error(
                  message.message ?? 'TypeScript build failed.',
                )
              }
              return loadApp(true).renderApp(context)
            },
            onReload(version) {
              model.hotStatus.value = 'ready'
              model.hotVersion.value = version
              model.lastError.value = null
              model.diagnostics.value = renderer.diagnostics
              parentPort.postMessage({
                type: 'hot-reload',
                status: 'applied',
                version,
              })
            },
            onError(error, version) {
              model.hotStatus.value = 'error'
              model.hotVersion.value = version
              model.lastError.value =
                error instanceof Error
                  ? error.stack ?? error.message
                  : String(error)
              parentPort.postMessage({
                type: 'hot-reload',
                status: 'error',
                version,
                message: model.lastError.value,
              })
            },
            onPollError(error, version) {
              parentPort.postMessage({
                type: 'hot-reload',
                status: 'error',
                version,
                message:
                  error instanceof Error
                    ? error.stack ?? error.message
                    : String(error),
              })
            },
          })
        let hostStatusController:
          | {
              dispose(): void
            }
          | undefined
        if (!workerData.heartbeatEnabled) {
          const timer =
            window.dispatcherQueue.createTimer()
          timer.interval = { duration: 2_500_000n }
          timer.isRepeating = true
          const unsubscribe =
            timer.onTick(refreshHostDiagnostics)
          try {
            timer.start()
          }
          catch (error) {
            let cleanupError: unknown
            try {
              unsubscribe()
            }
            catch (failure) {
              cleanupError = failure
            }
            if (cleanupError !== undefined) {
              throw new AggregateError(
                [error, cleanupError],
                'Host status timer failed to start and roll back.',
              )
            }
            throw error
          }
          let disposed = false
          let stopCompleted = false
          let unsubscribeCompleted = false
          hostStatusController = {
            dispose() {
              if (disposed) {
                return
              }
              let firstError: unknown
              if (!stopCompleted) {
                try {
                  timer.stop()
                  stopCompleted = true
                }
                catch (error) {
                  firstError ??= error
                }
              }
              if (!unsubscribeCompleted) {
                try {
                  unsubscribe()
                  unsubscribeCompleted = true
                }
                catch (error) {
                  firstError ??= error
                }
              }
              if (
                stopCompleted &&
                unsubscribeCompleted
              ) {
                disposed = true
              }
              if (firstError !== undefined) {
                throw firstError
              }
            },
          }
        }
        const heartbeatController =
          workerData.heartbeatEnabled
            ? createRendererHeartbeatController({
                dispatcherQueue:
                  window.dispatcherQueue,
                renderer,
                onHeartbeat(
                  heartbeat: RendererHeartbeat,
                ) {
                  refreshHostDiagnostics()
                  model.heartbeatSent(
                    heartbeat.sequence,
                    heartbeat.sentAt,
                    heartbeat.snapshot,
                  )
                  parentPort.postMessage({
                    type: 'heartbeat',
                    value: heartbeat,
                  })
                },
                onError(error) {
                  const message =
                    error instanceof Error
                      ? error.stack ?? error.message
                      : String(error)
                  model.lastError.value = message
                  parentPort.postMessage({
                    type: 'heartbeat-error',
                    message,
                  })
                },
              })
            : undefined

        return {
          disposeBeforeRender() {
            model.heartbeatDisabled()
            parentPort.postMessage({
              type: 'heartbeat-suspend',
            })
            let firstError: unknown
            for (const controller of [
              hotReloadController,
              hostStatusController,
              heartbeatController,
            ]) {
              try {
                controller?.dispose()
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
      },
    }
  },
  onDiagnostics(diagnostics) {
    parentPort.postMessage({
      type: 'diagnostics',
      value: diagnostics,
    })
  },
  onError(error) {
    parentPort.postMessage({
      type: 'error',
      message:
        error instanceof Error
          ? error.stack
          : String(error),
    })
  },
})

void app.run().then((exitCode) => {
  bridge.dispose()
  workerData.statePort.close()
  process.exit(exitCode)
})
