import {
  type Child,
} from 'dynwinrt-jsx/core'
import {
  createWinUIControls,
} from 'dynwinrt-jsx/controls'
import {
  thickness,
} from 'dynwinrt-jsx/winui'
import {
  createDiagnosticChannel,
} from 'dynwinrt-jsx/diagnostics'
import {
  createWinUIWorkerRuntime,
  defineWinUIApp,
  type WinUIWorkerRuntimeHotReloadMessage,
} from 'dynwinrt-jsx/worker'
import { roInitialize } from '@microsoft/dynwinrt'
import * as WinUIBindings from '#winapp/bindings'
import {
  ApplicationTheme,
  TitleBarTheme,
} from '#winapp/bindings'
import {
  createAppModel,
  type AppState,
} from './app-model'
import { isAppState } from './app-state'
import type { AppContext } from './app-shell'

interface AppModule {
  renderApp(context: AppContext): Child
}

const runtime =
  createWinUIWorkerRuntime<AppState>({
    channel: 'app-state',
    moduleId: './dist/app.js',
    validateState: isAppState,
  })
const {
  bridge,
  workerData,
} = runtime
const FallbackUI = createWinUIControls(WinUIBindings)
const diagnostics = createDiagnosticChannel({
  source: 'app-worker',
  onRecord(record) {
    runtime.postMessage({
      type: 'diagnostic',
      value: record,
    })
  },
})

const loadApp = (
  invalidate: boolean,
): AppModule =>
  runtime.loadModule<AppModule>(invalidate)

const errorTree = (error: unknown): Child => (
  <FallbackUI.StackPanel
    padding={thickness(24)}
    spacing={12}
  >
    <FallbackUI.TextBlock
      text="Hot reload failed"
      fontSize={24}
    />
    <FallbackUI.TextBlock
      automationId="HotReloadError"
      text={
        error instanceof Error
          ? error.stack ?? error.message
          : String(error)
      }
      textWrapping={1}
    />
  </FallbackUI.StackPanel>
)

const app = defineWinUIApp({
  bindings: WinUIBindings,
  diagnostics,
  initializeRuntime() {
    roInitialize(0)
  },
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
  mount({
    bindings,
    window,
    renderer,
    createProjectedOwner,
    ownProjected,
    createProjected,
  }) {
    window.systemBackdrop =
      new bindings.MicaBackdrop()
    const model = createAppModel(
      bridge,
      workerData.initialState,
    )
    const context: AppContext = {
      model,
      renderer,
      window,
      createProjectedOwner,
      ownProjected,
      createProjected,
      refreshDiagnostics() {
        model.diagnostics.value =
          renderer.diagnostics
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
      disposeAfterRender: model.dispose,
      afterRender({ renderHandle }) {
        return runtime.createRenderedHooks({
          dispatcherQueue:
            window.dispatcherQueue,
          renderer,
          renderHandle,
          fallback: errorTree,
          beforeReload(message) {
            model.hotStatus.value =
              message.type === 'hot-build-error'
                ? 'build error'
                : 'reloading'
          },
          load(
            message:
              WinUIWorkerRuntimeHotReloadMessage,
          ) {
            if (
              message.type ===
                'hot-build-error'
            ) {
              throw new Error(
                message.message ??
                'TypeScript build failed.',
              )
            }
            return loadApp(true).renderApp(context)
          },
          onReload(version) {
            model.hotStatus.value = 'ready'
            model.hotVersion.value = version
            model.lastError.value = null
            model.diagnostics.value =
              renderer.diagnostics
          },
          onReloadError(error, version) {
            model.hotStatus.value = 'error'
            model.hotVersion.value = version
            model.lastError.value =
              error instanceof Error
                ? error.stack ?? error.message
                : String(error)
          },
        })
      },
    }
  },
  ...runtime.appCallbacks,
})

void runtime.run(app)
