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
  Application,
  ApplicationTheme,
  AutomationProperties,
  DispatcherQueueTimer,
  Grid,
  IMap_Object_Object,
  IReference_Boolean,
  IVector_UIElement,
  MicaBackdrop,
  PropertyValue,
  StackPanel,
  TextBlock,
  TitleBarTheme,
  Window,
} from '#winapp/bindings'
import {
  createDashboardModel,
  type DashboardModel,
  type DashboardState,
} from './dashboard-model'
import type {
  DashboardAppContext,
} from './dashboard-app'

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

interface WorkerMessage {
  readonly type?: string
  readonly version?: number
  readonly message?: string
}

interface DashboardAppModule {
  renderDashboardApp(context: DashboardAppContext): Child
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
    initialState: DashboardState
  }
}

if (!parentPort) {
  throw new Error('The WinUI entry point must run in a Worker.')
}

roInitialize(0)
parentPort.postMessage({ type: 'startup-stage', stage: 'ro-initialized' })

const stateBridge = createStateBridge<DashboardState>(
  createMessageTransport(workerData.statePort),
  {
    role: 'client',
    channel: 'dashboard-state',
    initial: workerData.initialState,
  },
)
parentPort.postMessage({ type: 'startup-stage', stage: 'bridge-created' })

const renderer = createWinUIRenderer({
  Application,
  AutomationProperties,
  Grid,
  IMap_Object_Object,
  IReference_Boolean,
  IVector_UIElement,
  PropertyValue,
  TextBlock,
})
const FallbackUI = createControls({
  StackPanel,
  TextBlock,
})
const appModuleId = './dashboard-app.js'
const appModulePath = require.resolve(appModuleId)
const fileSystem = require('node:fs') as FileSystem

function loadAppModule(invalidate: boolean): DashboardAppModule {
  if (invalidate) {
    delete require.cache[appModulePath]
  }
  return require(appModuleId) as DashboardAppModule
}

function errorTree(error: unknown): Child {
  return (
    <FallbackUI.StackPanel padding={thickness(24)} spacing={12}>
      <FallbackUI.TextBlock
        text="Dashboard hot reload failed"
        fontSize={24}
        fontWeight={{ weight: 700 }}
      />
      <FallbackUI.TextBlock
        automationId="HotReloadError"
        text={error instanceof Error ? error.stack ?? error.message : String(error)}
        textWrapping={1}
      />
    </FallbackUI.StackPanel>
  )
}

let model: DashboardModel | undefined
let renderHandle: RenderHandle | undefined
let hotSession: HotReloadSession | undefined
let closeSubscription: (() => void) | undefined
let reloadTimer: DispatcherQueueTimer | undefined
let reloadTimerSubscription: (() => void) | undefined
let exitCode = 1

parentPort.postMessage({ type: 'startup-stage', stage: 'application-starting' })
Application.start(() => {
  try {
    Application.create(() => {
      try {
        const window = new Window()
        Application.current.requestedTheme =
          workerData.initialState.darkTheme
            ? ApplicationTheme.Dark
            : ApplicationTheme.Light
        window.title = 'DynWinRT JSX Workspace'
        window.systemBackdrop = new MicaBackdrop()
        window.appWindow.titleBar.preferredTheme =
          workerData.initialState.darkTheme
            ? TitleBarTheme.Dark
            : TitleBarTheme.Light
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
        const context: DashboardAppContext = {
          model,
          renderer,
          window,
          refreshDiagnostics() {
            if (model) {
              model.diagnostics.value = renderer.diagnostics
            }
          },
        }

        let initialTree: Child
        try {
          initialTree = loadAppModule(false).renderDashboardApp(context)
        } catch (error) {
          model.hotStatus.value = 'error'
          model.lastError.value =
            error instanceof Error ? error.stack ?? error.message : String(error)
          initialTree = errorTree(error)
        }

        renderHandle = renderer.render(initialTree, window)
        hotSession = createHotReloadSession(renderHandle, {
          fallback: errorTree,
          onReload(version) {
            if (!model) {
              return
            }
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
            if (!model) {
              return
            }
            model.hotStatus.value = 'error'
            model.hotVersion.value = version
            model.lastError.value =
              error instanceof Error
                ? error.stack ?? error.message
                : String(error)
            model.diagnostics.value = renderer.diagnostics
            parentPort.postMessage({
              type: 'hot-reload',
              status: 'error',
              version,
              message: model.lastError.value,
            })
          },
        })

        const handleHotMessage = (message: WorkerMessage) => {
          const version = message.version ?? 0
          if (
            !hotSession ||
            !model ||
            version <= hotSession.version
          ) {
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
            return loadAppModule(true).renderDashboardApp(context)
          })
        }
        if (workerData.hotStatePath) {
          reloadTimer = window.dispatcherQueue.createTimer()
          reloadTimer.interval = { duration: 2_500_000n }
          reloadTimer.isRepeating = true
          reloadTimerSubscription = reloadTimer.onTick(() => {
            if (
              !workerData.hotStatePath ||
              !fileSystem.existsSync(workerData.hotStatePath)
            ) {
              return
            }
            try {
              handleHotMessage(JSON.parse(
                fileSystem.readFileSync(
                  workerData.hotStatePath,
                  'utf8',
                ),
              ) as WorkerMessage)
            } catch (error) {
              parentPort.postMessage({
                type: 'hot-reload',
                status: 'error',
                version: hotSession?.version ?? 0,
                message:
                  error instanceof Error
                    ? error.stack ?? error.message
                    : String(error),
              })
            }
          })
          reloadTimer.start()
        }

        closeSubscription = window.onClosed(() => {
          try {
            stateBridge.set(
              model?.snapshot('closed') ?? {
                ...workerData.initialState,
                status: 'closed',
              },
            )
            reloadTimer?.stop()
            reloadTimerSubscription?.()
            reloadTimerSubscription = undefined
            reloadTimer = undefined
            hotSession?.dispose()
            hotSession = undefined
            renderHandle?.dispose()
            renderHandle = undefined
            model?.dispose()
            model = undefined
            const diagnostics = renderer.diagnostics
            assertRendererIdle(diagnostics)
            parentPort.postMessage({
              type: 'diagnostics',
              value: diagnostics,
            })
            closeSubscription?.()
            closeSubscription = undefined
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

stateBridge.dispose()
workerData.statePort.close()
process.exit(exitCode)
