import {
  createWinUIRendererPreset,
  type Child,
} from 'dynwinrt-jsx'
import type { StateBridge } from 'dynwinrt-jsx/host'
import {
  runWinUIWorkerApp,
  type FileHotReloadFileSystem,
} from 'dynwinrt-jsx/worker'
import * as WinUIBindings from '#winapp/bindings'
import {
  Application,
  ApplicationTheme,
  MicaBackdrop,
  TitleBarTheme,
  Window,
  XamlRoot,
  createProjectedLifetimeScope,
  releaseProjected,
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

const winuiRendererPreset =
  createWinUIRendererPreset(WinUIBindings)

export function runDashboardApplication(
  options: RunDashboardApplicationOptions,
): number {
  const {
    parentPort,
    workerData,
    stateBridge,
    postStartupStage,
  } = options
  const loader = createDashboardAppLoader()
  const fileSystem = require('node:fs') as FileHotReloadFileSystem

  return runWinUIWorkerApp({
    application: Application,
    releaseProjectedValue: releaseProjected,
    createRenderer() {
      return winuiRendererPreset.createRenderer()
    },
    createWindow() {
      return new Window()
    },
    configureWindow({ window }) {
      const application = Application.current
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
    createProjectionScope() {
      return createProjectedLifetimeScope()
    },
    mount({ window, renderer }) {
      window.systemBackdrop = new MicaBackdrop()
      const model = createDashboardModel(
        stateBridge,
        workerData.initialState,
      )
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
        getXamlRoot() {
          xamlRoot ??= window.content.xamlRoot
          return xamlRoot
        },
        refreshDiagnostics() {
          model.diagnostics.value = renderer.diagnostics
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
          model.dispose()
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
          return {
            disposeBeforeRender() {
              hotReloadController?.dispose()
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
}
