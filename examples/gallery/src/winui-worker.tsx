import {
  createControls,
  createMessageTransport,
  createStateBridge,
  createWinUIRendererPreset,
  thickness,
  type Child,
} from 'dynwinrt-jsx'
import {
  createFileHotReloadController,
  createRendererHeartbeatController,
  getRendererHeartbeatSharedState,
  rendererHeartbeatSharedStateIndex,
  runWinUIWorkerApp,
  type FileHotReloadFileSystem,
  type FileHotReloadMessage,
  type RendererHeartbeat,
} from 'dynwinrt-jsx/worker'
import { roInitialize } from '@microsoft/dynwinrt'
import * as WinUIBindings from '#winapp/bindings'
import {
  Application,
  ApplicationTheme,
  AppNotificationManager,
  MicaBackdrop,
  StackPanel,
  TextBlock,
  TextWrapping,
  TitleBarHeightOption,
  TitleBarTheme,
  Window,
  createProjectedLifetimeScope,
} from '#winapp/bindings'
import {
  createAppModel,
  type AppState,
} from './app-model'
import { createAppNotificationOwner } from './app-notification-owner'
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

roInitialize(0)
const winuiRendererPreset =
  createWinUIRendererPreset(WinUIBindings)

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

const exitCode = runWinUIWorkerApp({
  application: Application,
  createRenderer() {
    return winuiRendererPreset.createRenderer()
  },
  createWindow() {
    return new Window()
  },
  configureWindow({ window }) {
    window.extendsContentIntoTitleBar = true
    Application.current.requestedTheme =
      workerData.initialState.darkTheme
        ? ApplicationTheme.Dark
        : ApplicationTheme.Light
    window.title = 'dynwinrt-jsx Gallery'
    window.appWindow.resize({
      width: 1280,
      height: 820,
    })
    window.appWindow.titleBar.preferredTheme =
      workerData.initialState.darkTheme
        ? TitleBarTheme.Dark
        : TitleBarTheme.Light
    window.appWindow.titleBar.preferredHeightOption =
      TitleBarHeightOption.Tall
  },
  createProjectionScope() {
    return createProjectedLifetimeScope()
  },
  mount({ window, renderer }) {
    window.systemBackdrop = new MicaBackdrop()
    const appNotifications = createAppNotificationOwner({
      getManager: () => AppNotificationManager.default_,
    })
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
      shellCapabilities: workerData.shellCapabilities,
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
        model.dispose()
      },
      beforeCloseAsync() {
        return appNotifications.dispose()
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

bridge.dispose()
workerData.statePort.close()
process.exit(exitCode)
