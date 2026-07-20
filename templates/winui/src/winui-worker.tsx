import {
  assertRendererIdle,
  createControls,
  createHotReloadSession,
  createMessageTransport,
  createStateBridge,
  createWinUIRenderer,
  thickness,
  type Child,
  type HotReloadSession,
  type RenderHandle,
} from 'dynwinrt-jsx'
import { roInitialize } from '@microsoft/dynwinrt'
import {
  AccessibilitySettings,
  Application,
  ApplicationTheme,
  AutomationProperties,
  DispatcherQueueTimer,
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
interface FileSystem {
  existsSync(path: string): boolean
  readFileSync(path: string, encoding: 'utf8'): string
}
interface HotMessage {
  readonly type?: string
  readonly version?: number
  readonly message?: string
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
const fs = require('node:fs') as FileSystem
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
let hotSession: HotReloadSession | undefined
let timer: DispatcherQueueTimer | undefined
let timerSubscription: (() => void) | undefined
let closingSubscription: (() => void) | undefined
let closeSubscription: (() => void) | undefined
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
        hotSession = createHotReloadSession(renderHandle, {
          fallback: errorTree,
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
        })
        if (workerData.hotStatePath) {
          timer = window.dispatcherQueue.createTimer()
          timer.interval = { duration: 2_500_000n }
          timerSubscription = timer.onTick(() => {
            if (
              !workerData.hotStatePath ||
              !fs.existsSync(workerData.hotStatePath)
            ) {
              return
            }
            const message = JSON.parse(
              fs.readFileSync(workerData.hotStatePath, 'utf8'),
            ) as HotMessage
            const version = message.version ?? 0
            if (!hotSession || !model || version <= hotSession.version) {
              return
            }
            model.hotStatus.value =
              message.type === 'hot-build-error'
                ? 'build error'
                : 'reloading'
            void hotSession.reload(version, () => {
              if (message.type === 'hot-build-error') {
                throw new Error(message.message ?? 'TypeScript build failed.')
              }
              return loadApp(true).renderApp(context)
            })
          })
          timer.start()
        }
        closingSubscription = appWindow.onClosing((_sender, args) => {
          // App-owned closing handlers mount before this final teardown handler.
          if (args.cancel) {
            return
          }
          let firstError: unknown
          const attempt = (action: () => void) => {
            try {
              action()
              return true
            } catch (error) {
              firstError ??= error
              return false
            }
          }
          attempt(() => {
            bridge.set(
              model?.snapshot('closed') ?? {
                ...workerData.initialState,
                status: 'closed',
              },
            )
          })
          if (attempt(() => {
            timer?.stop()
          })) {
            timer = undefined
          }
          if (attempt(() => {
            timerSubscription?.()
          })) {
            timerSubscription = undefined
          }
          if (attempt(() => {
            hotSession?.dispose()
          })) {
            hotSession = undefined
          }
          if (attempt(() => {
            renderHandle?.dispose()
          })) {
            renderHandle = undefined
          }
          if (attempt(() => {
            model?.dispose()
          })) {
            model = undefined
          }
          const diagnostics = renderer.diagnostics
          attempt(() => {
            assertRendererIdle(diagnostics)
          })
          attempt(() => {
            parentPort.postMessage({
              type: 'diagnostics',
              value: diagnostics,
            })
          })
          let projectionError: unknown
          try {
            projectionLifetime?.dispose()
          } catch (error) {
            projectionError = error
            firstError ??= error
          }
          if (projectionError === undefined) {
            projectionLifetime = undefined
            if (attempt(() => {
              closingSubscription?.()
            })) {
              closingSubscription = undefined
            }
          } else {
            args.cancel = true
          }
          if (firstError !== undefined) {
            exitCode = 1
            parentPort.postMessage({
              type: 'error',
              message:
                firstError instanceof Error
                  ? firstError.stack
                  : String(firstError),
            })
          }
          if (
            projectionError !== undefined &&
            projectionError !== firstError
          ) {
            parentPort.postMessage({
              type: 'error',
              message:
                projectionError instanceof Error
                  ? projectionError.stack
                  : String(projectionError),
            })
          }
          if (firstError === undefined) {
            exitCode = 0
          }
        })
        closeSubscription = window.onClosed(() => {
          const unsubscribe = closeSubscription
          closeSubscription = undefined
          try {
            unsubscribe?.()
          } finally {
            Application.current.exit()
          }
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
