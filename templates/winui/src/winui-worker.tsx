import {
  createControls,
  createMessageTransport,
  createStateBridge,
  createWinUIRenderer,
  thickness,
  type Child,
  type RenderHandle,
} from 'dynwinrt-jsx'
import {
  createFileHotReloadController,
  installWinUIWindowLifecycle,
  type FileHotReloadController,
  type FileHotReloadFileSystem,
  type FileHotReloadMessage,
} from 'dynwinrt-jsx/worker'
import { roInitialize } from '@microsoft/dynwinrt'
import {
  AccessibilitySettings,
  Application,
  ApplicationTheme,
  AutomationProperties,
  ElementTheme,
  Grid,
  IMap_Object_Object,
  IVector_UIElement,
  MicaBackdrop,
  PropertyValue,
  ResourceDictionary,
  StackPanel,
  TextBlock,
  TitleBarTheme,
  Window,
  createProjectedLifetimeScope,
} from '#winapp/bindings'
import { createAppModel, type AppModel, type AppState } from './app-model'
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
declare const process: { exit(code?: number): never }
const {
  parentPort,
  workerData,
} = require('node:worker_threads') as {
  parentPort: ParentPort | null
  workerData: {
    statePort: StatePort
    hotStatePath: string | null
    initialState: AppState
  }
}
if (!parentPort) {
  throw new Error('The WinUI entry point must run in a Worker.')
}
roInitialize(0)

const bridge = createStateBridge<AppState>(
  createMessageTransport(workerData.statePort),
  {
    role: 'client',
    channel: 'app-state',
    initial: workerData.initialState,
  },
)
const renderer = createWinUIRenderer({
  AccessibilitySettings,
  Application,
  ApplicationTheme,
  AutomationProperties,
  ElementTheme,
  Grid,
  IMap_Object_Object,
  IVector_UIElement,
  PropertyValue,
  ResourceDictionary,
  TextBlock,
})
const FallbackUI = createControls({ StackPanel, TextBlock })
const moduleId = './app.js'
const modulePath = require.resolve(moduleId)
const fs = require('node:fs') as FileHotReloadFileSystem
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
      textWrapping={1}
    />
  </FallbackUI.StackPanel>
)

let model: AppModel | undefined
let renderHandle: RenderHandle | undefined
let hotReloadController: FileHotReloadController | undefined
let projectionLifetime:
  | ReturnType<typeof createProjectedLifetimeScope>
  | undefined
let exitCode = 1

Application.start(() => {
  try {
    Application.create(() => {
      try {
        const window = new Window()
        const appWindow = window.appWindow
        Application.current.requestedTheme =
          workerData.initialState.darkTheme
            ? ApplicationTheme.Dark
            : ApplicationTheme.Light
        window.title = 'dynwinrt-jsx'
        appWindow.titleBar.preferredTheme =
          workerData.initialState.darkTheme
            ? TitleBarTheme.Dark
            : TitleBarTheme.Light
        projectionLifetime = createProjectedLifetimeScope()
        window.systemBackdrop = new MicaBackdrop()
        model = createAppModel(bridge, workerData.initialState)
        const context: AppContext = {
          model,
          renderer,
          window,
          refreshDiagnostics() {
            if (model) {
              model.diagnostics.value = renderer.diagnostics
            }
          },
        }
        let tree: Child
        try {
          tree = loadApp(false).renderApp(context)
        } catch (error) {
          tree = errorTree(error)
        }
        renderHandle = renderer.render(tree, window)
        hotReloadController = createFileHotReloadController({
          statePath: workerData.hotStatePath,
          dispatcherQueue: window.dispatcherQueue,
          fileSystem: fs,
          renderHandle,
          fallback: errorTree,
          beforeReload(message) {
            if (!model) {
              return
            }
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
            if (!model) return
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
            if (!model) return
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

        installWinUIWindowLifecycle({
          application: Application,
          window,
          appWindow,
          renderer,
          beforeClose() {
            bridge.set(
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
            return 0
          },
          setExitCode(value) {
            exitCode = value
          },
        })
        window.activate()
        exitCode = 0
      } catch (error) {
        parentPort.postMessage({
          type: 'error',
          message: error instanceof Error ? error.stack : String(error),
        })
        try {
          projectionLifetime?.dispose()
        } catch (releaseError) {
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
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      message: error instanceof Error ? error.stack : String(error),
    })
  }
})

bridge.dispose()
workerData.statePort.close()
process.exit(exitCode)
