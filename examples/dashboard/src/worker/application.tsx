import {
  createWinUIRenderer,
  type Child,
  type RenderHandle,
} from 'dynwinrt-jsx'
import type { StateBridge } from 'dynwinrt-jsx/host'
import {
  installWinUIWindowLifecycle,
  type FileHotReloadController,
  type FileHotReloadFileSystem,
} from 'dynwinrt-jsx/worker'
import {
  AccessibilitySettings,
  Application,
  ApplicationTheme,
  AutomationProperties,
  ElementTheme,
  Grid,
  IMap_Object_Object,
  IReference_Boolean,
  IVector_UIElement,
  MicaBackdrop,
  PropertyValue,
  ResourceDictionary,
  TextBlock,
  TitleBarTheme,
  Window,
  XamlRoot,
  createProjectedLifetimeScope,
} from '#winapp/bindings'
import type {
  DashboardAppContext,
} from '../dashboard-app'
import {
  createDashboardModel,
  type DashboardModel,
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
): number {
  const {
    parentPort,
    workerData,
    stateBridge,
    postStartupStage,
  } = options

  const renderer = createWinUIRenderer({
    AccessibilitySettings,
    Application,
    ApplicationTheme,
    AutomationProperties,
    ElementTheme,
    Grid,
    IMap_Object_Object,
    IReference_Boolean,
    IVector_UIElement,
    PropertyValue,
    ResourceDictionary,
    TextBlock,
  })
  postStartupStage('renderer-created')

  const loader = createDashboardAppLoader()
  const fileSystem = require('node:fs') as FileHotReloadFileSystem
  let model: DashboardModel | undefined
  let renderHandle: RenderHandle | undefined
  let hotReloadController: FileHotReloadController | undefined
  let xamlRoot: XamlRoot | undefined
  let projectionLifetime:
    | ReturnType<typeof createProjectedLifetimeScope>
    | undefined
  let exitCode = 1
  let requestedExitCode = 1

  postStartupStage('application-starting')
  Application.start(() => {
    try {
      Application.create(() => {
        try {
          const window = new Window()
          const appWindow = window.appWindow
          postStartupStage('window-created')
          Application.current.requestedTheme =
            workerData.initialState.darkTheme
              ? ApplicationTheme.Dark
              : ApplicationTheme.Light
          window.title = 'DynWinRT JSX Workspace'
          appWindow.titleBar.preferredTheme =
            workerData.initialState.darkTheme
              ? TitleBarTheme.Dark
              : TitleBarTheme.Light
          projectionLifetime = createProjectedLifetimeScope()
          window.systemBackdrop = new MicaBackdrop()
          model = createDashboardModel(
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

          const context: DashboardAppContext = {
            model,
            renderer,
            window,
            getXamlRoot() {
              xamlRoot ??= window.content.xamlRoot
              return xamlRoot
            },
            refreshDiagnostics() {
              if (model) {
                model.diagnostics.value = renderer.diagnostics
              }
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

          renderHandle = renderer.render(initialTree, window)
          postStartupStage('tree-rendered')
          if (!nativeSelfTest) {
            hotReloadController = createDashboardHotReload({
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
          }

          installWinUIWindowLifecycle({
            application: Application,
            window,
            appWindow,
            renderer,
            beforeClose() {
              stateBridge.set(
                model?.snapshot('closed') ?? {
                  ...workerData.initialState,
                  status: 'closed',
                },
              )
            },
            disposeBeforeRender() {
              hotReloadController?.dispose()
              hotReloadController = undefined
            },
            disposeRender() {
              renderHandle?.dispose()
              renderHandle = undefined
            },
            disposeAfterRender() {
              model?.dispose()
              model = undefined
            },
            disposeProjection() {
              projectionLifetime?.dispose()
              projectionLifetime = undefined
              xamlRoot = undefined
            },
            onDiagnostics(diagnostics) {
              parentPort.postMessage({
                type: 'diagnostics',
                value: diagnostics,
              })
            },
            onError(error) {
              exitCode = 1
              parentPort.postMessage({
                type: 'error',
                message:
                  error instanceof Error
                    ? error.stack
                    : String(error),
              })
            },
            getRequestedExitCode() {
              return requestedExitCode
            },
            setExitCode(value) {
              exitCode = value
            },
          })

          window.activate()
          postStartupStage('window-activated')
          requestedExitCode = 0
          exitCode = 0

          if (nativeSelfTest) {
            runDashboardSelfTest({
              nativeSelfTest,
              renderer,
              window,
              parentPort,
              getRenderHandle() {
                return renderHandle
              },
              clearRenderHandle() {
                renderHandle = undefined
              },
              setExitCode(value) {
                requestedExitCode = value
                exitCode = value
              },
              exitApplication() {
                Application.current.exit()
              },
            })
          }
        }
        catch (error) {
          parentPort.postMessage({
            type: 'error',
            message:
              error instanceof Error
                ? error.stack
                : String(error),
          })
          try {
            projectionLifetime?.dispose()
          }
          catch (releaseError) {
            parentPort.postMessage({
              type: 'error',
              message:
                releaseError instanceof Error
                  ? releaseError.stack
                  : String(releaseError),
            })
          }
          projectionLifetime = undefined
          Application.current?.exit()
        }
      })
    }
    catch (error) {
      parentPort.postMessage({
        type: 'error',
        message:
          error instanceof Error
            ? error.stack
            : String(error),
      })
    }
  })

  return exitCode
}
