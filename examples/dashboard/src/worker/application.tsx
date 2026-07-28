import {
  createDiagnosticBuffer,
  createDiagnosticChannel,
  createDiagnosticEvidenceBundle,
  type Child,
} from 'dynwinrt-jsx'
import type { StateBridge } from 'dynwinrt-jsx/host'
import {
  createRendererHeartbeatController,
  defineWinUIApp,
  getRendererHeartbeatSharedState,
  rendererHeartbeatSharedStateIndex,
  type FileHotReloadFileSystem,
  type RendererHeartbeat,
} from 'dynwinrt-jsx/worker'
import * as WinUIBindings from '#winapp/bindings'
import {
  ApplicationTheme,
  TitleBarTheme,
  XamlRoot,
} from '#winapp/bindings'
import type {
  DashboardAppContext,
} from '../dashboard-app'
import {
  createDashboardModel,
  type DashboardState,
} from '../dashboard-model'
import type { NativeSelfTest } from '../native-selftest'
import {
  createDashboardAppLoader,
  createDashboardErrorTree,
  createDashboardHotReload,
} from './hot-reload'
import {
  runDashboardSelfTest,
} from './selftest'
import type {
  DashboardStartupStageReporter,
  DashboardWorkerData,
  DashboardWorkerParentPort,
} from './contracts'

interface NodeRequire {
  (id: string): unknown
}

export interface RunDashboardApplicationOptions {
  readonly parentPort: DashboardWorkerParentPort
  readonly workerData: DashboardWorkerData
  readonly stateBridge: StateBridge<DashboardState>
  readonly postStartupStage: DashboardStartupStageReporter
}

declare const require: NodeRequire
declare const performance: {
  now(): number
}

export function runDashboardApplication(
  options: RunDashboardApplicationOptions,
): Promise<number> {
  const {
    parentPort,
    workerData,
    stateBridge,
    postStartupStage,
  } = options
  const loader = createDashboardAppLoader()
  const fileSystem = require('node:fs') as FileHotReloadFileSystem
  const diagnosticBuffer = createDiagnosticBuffer({
    maxRecords: 500,
  })
  const diagnostics = createDiagnosticChannel({
    source: 'dashboard-worker',
    onRecord(record) {
      diagnosticBuffer.append(record)
      parentPort.postMessage({
        type: 'diagnostic',
        value: record,
      })
    },
  })
  const heartbeatState = getRendererHeartbeatSharedState(
    workerData.heartbeatState,
  )

  const app = defineWinUIApp({
    bindings: WinUIBindings,
    diagnostics,
    configureWindow({
      bindings,
      releaseProjected,
      window,
    }) {
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
      window.title = 'DynWinRT JSX Workspace'
      const configuredAppWindow = window.appWindow
      try {
        const titleBar = configuredAppWindow.titleBar
        try {
          titleBar.preferredTheme =
            workerData.initialState.darkTheme
              ? TitleBarTheme.Dark
              : TitleBarTheme.Light
        }
        finally {
          releaseProjected(titleBar)
        }
      }
      finally {
        releaseProjected(configuredAppWindow)
      }
    },
    mount({ bindings, window, renderer }) {
      window.systemBackdrop = new bindings.MicaBackdrop()
      const model = createDashboardModel(
        stateBridge,
        workerData.initialState,
      )
      const updateDiagnosticSummary = (
        kind?: string,
      ) => {
        const last =
          kind ??
          diagnosticBuffer.snapshot().records.at(-1)?.kind ??
          'none'
        model.diagnosticSummary.value =
          `${diagnosticBuffer.size} structured events; ` +
          `${diagnosticBuffer.droppedRecords} dropped; last ${last}.`
      }
      updateDiagnosticSummary()
      const unsubscribeDiagnostics =
        diagnosticBuffer.subscribe((record) => {
          updateDiagnosticSummary(record.kind)
        })
      if (!workerData.heartbeatEnabled) {
        model.heartbeatSummary.value =
          'UI heartbeat is disabled.'
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
          model.heartbeatSummary.value =
            `UI heartbeat timed out ${timeoutCount} time(s).`
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
          model.heartbeatSummary.value =
            `UI heartbeat ${acknowledgedSequence} acknowledged.` +
            (timeoutCount > 0n ? ' Recovered.' : '')
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
          model.diagnosticExportStatus.value =
            exportStatus === 1n
              ? `Diagnostics exported: ${workerData.diagnosticsExportPath}`
              : 'Diagnostics export failed in the Host.'
        }
      }
      parentPort.postMessage({
        type: 'state-initialized',
        value: {
          taskCount: model.tasks.value.length,
          darkTheme: model.darkTheme.value,
          updatedAt: model.updatedAt.value,
          persistenceError: model.persistenceError.value,
        },
      })
      postStartupStage('state-initialized')

      let xamlRoot: XamlRoot | undefined
      const context: DashboardAppContext = {
        model,
        renderer,
        window,
        diagnostics,
        getXamlRoot() {
          xamlRoot ??= window.content.xamlRoot
          return xamlRoot
        },
        refreshDiagnostics() {
          model.diagnostics.value = renderer.diagnostics
          updateDiagnosticSummary()
          refreshHostDiagnostics()
        },
        exportDiagnostics() {
          model.diagnosticExportStatus.value =
            `Export requested: ${workerData.diagnosticsExportPath}`
          Atomics.store(
            heartbeatState,
            rendererHeartbeatSharedStateIndex.exportStatus,
            0n,
          )
          parentPort.postMessage({
            type: 'diagnostics-export',
            value: createDiagnosticEvidenceBundle({
              diagnostics: diagnosticBuffer.snapshot(),
              renderer: renderer.inspector.snapshot(),
              metadata: {
                source: 'dashboard-worker',
              },
            }),
          })
        },
      }

      let nativeSelfTest: NativeSelfTest | undefined
      let initialTree: Child
      if (workerData.selfTest) {
        const selfTestModuleStartedAt = performance.now()
        const {
          createNativeSelfTest,
        } = require('../native-selftest') as typeof import('../native-selftest')
        postStartupStage('native-selftest-loaded', {
          durationMs: Math.round(
            (performance.now() - selfTestModuleStartedAt) * 10,
          ) / 10,
        })
        nativeSelfTest = createNativeSelfTest({
          renderer,
          window,
          failureMode: workerData.selfTestFailure,
        })
        initialTree = nativeSelfTest.tree
      }
      else {
        const appModuleStartedAt = performance.now()
        try {
          initialTree = loader
            .load(false)
            .renderDashboardApp(context)
          postStartupStage('app-module-loaded', {
            durationMs: Math.round(
              (performance.now() - appModuleStartedAt) * 10,
            ) / 10,
          })
        }
        catch (error) {
          model.hotStatus.value = 'error'
          model.lastError.value =
            error instanceof Error
              ? error.stack ?? error.message
              : String(error)
          initialTree = createDashboardErrorTree(error)
        }
      }

      return {
        child: initialTree,
        beforeClose() {
          stateBridge.set(model.snapshot('closed'))
        },
        disposeAfterRender() {
          let firstError: unknown
          try {
            unsubscribeDiagnostics()
          }
          catch (error) {
            firstError = error
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
        onProjectionDisposed() {
          xamlRoot = undefined
        },
        afterRender({ renderHandle }) {
          if (nativeSelfTest) {
            return
          }
          const hotReloadController =
            createDashboardHotReload({
              statePath: workerData.hotStatePath,
              dispatcherQueue: window.dispatcherQueue,
              fileSystem,
              renderHandle,
              context,
              model,
              parentPort,
              loader,
            })
          if (hotReloadController) {
            postStartupStage('hot-session-created')
          }
          let statusTimer:
            | ReturnType<
                typeof window.dispatcherQueue.createTimer
              >
            | undefined
          let statusTimerSubscription:
            | (() => void)
            | undefined
          let statusTimerStopped = false
          let statusTimerUnsubscribed = false
          if (!workerData.heartbeatEnabled) {
            statusTimer =
              window.dispatcherQueue.createTimer()
            statusTimer.interval = { duration: 2_500_000n }
            statusTimer.isRepeating = true
            statusTimerSubscription =
              statusTimer.onTick(refreshHostDiagnostics)
            try {
              statusTimer.start()
            }
            catch (error) {
              statusTimerSubscription()
              throw error
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
                    model.heartbeatSummary.value =
                      `UI heartbeat ${heartbeat.sequence} sent.`
                    refreshHostDiagnostics()
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
              parentPort.postMessage({
                type: 'heartbeat-suspend',
              })
              let firstError: unknown
              const attempt = (dispose: () => void) => {
                try {
                  dispose()
                }
                catch (error) {
                  firstError ??= error
                }
              }
              attempt(() => hotReloadController?.dispose())
              if (statusTimer && !statusTimerStopped) {
                try {
                  statusTimer.stop()
                  statusTimerStopped = true
                }
                catch (error) {
                  firstError ??= error
                }
              }
              if (
                statusTimerSubscription &&
                !statusTimerUnsubscribed
              ) {
                try {
                  statusTimerSubscription()
                  statusTimerUnsubscribed = true
                }
                catch (error) {
                  firstError ??= error
                }
              }
              if (
                statusTimerStopped &&
                statusTimerUnsubscribed
              ) {
                statusTimer = undefined
                statusTimerSubscription = undefined
              }
              attempt(() => heartbeatController?.dispose())
              if (firstError !== undefined) {
                throw firstError
              }
            },
          }
        },
        afterActivate(runtime) {
          if (!nativeSelfTest) {
            return
          }
          runDashboardSelfTest({
            nativeSelfTest,
            renderer,
            window,
            parentPort,
            disposeRender: runtime.disposeRender,
            setExitCode: runtime.setExitCode,
            exitApplication: runtime.exitApplication,
          })
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
    onStage(stage) {
      if (
        stage === 'renderer-created' ||
        stage === 'application-starting' ||
        stage === 'window-created' ||
        stage === 'projection-created' ||
        stage === 'tree-rendered' ||
        stage === 'window-activated'
      ) {
        postStartupStage(stage)
      }
    },
  })
  return app.run()
}
