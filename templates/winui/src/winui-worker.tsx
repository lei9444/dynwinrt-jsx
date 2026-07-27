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
  runWinUIWorkerApp,
  type FileHotReloadFileSystem,
  type FileHotReloadMessage,
} from 'dynwinrt-jsx/worker'
import { roInitialize } from '@microsoft/dynwinrt'
import * as WinUIBindings from '#winapp/bindings'
import {
  Application,
  ApplicationTheme,
  MicaBackdrop,
  StackPanel,
  TextBlock,
  TitleBarTheme,
  Window,
  createProjectedLifetimeScope,
  releaseProjected,
} from '#winapp/bindings'
import {
  createAppModel,
  type AppState,
} from './app-model'
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
    initialState: AppState
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

void runWinUIWorkerApp({
  application: Application,
  releaseProjectedValue: releaseProjected,
  createRenderer() {
    return winuiRendererPreset.createRenderer({
      releaseNative: releaseProjected,
    })
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
    window.title = 'dynwinrt-jsx'
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
    const model = createAppModel(
      bridge,
      workerData.initialState,
    )
    const context: AppContext = {
      model,
      renderer,
      window,
      refreshDiagnostics() {
        model.diagnostics.value = renderer.diagnostics
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

        return {
          disposeBeforeRender() {
            hotReloadController?.dispose()
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
}).then((exitCode) => {
  bridge.dispose()
  workerData.statePort.close()
  process.exit(exitCode)
})
