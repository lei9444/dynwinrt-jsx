import {
  createControls,
  thickness,
  type Child,
} from 'dynwinrt-jsx'
import {
  createWinUIAsyncCleanup,
  createWinUICleanup,
  createWinUIWorkerRuntime,
  defineWinUIApp,
  type WinUIWorkerHostStatus,
  type WinUIWorkerRuntimeHotReloadMessage,
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
import { isAppState } from './app-state'
import { createAppNotificationOwner } from './app-notification-owner'
import {
  createGallerySecondaryWindowManager,
} from './secondary-window-manager'
import type { AppContext } from './app'

interface AppModule {
  renderApp(context: AppContext): Child
}

const runtime = createWinUIWorkerRuntime<
  AppState,
  {
    readonly shellCapabilities:
      AppContext['shellCapabilities']
  }
>({
  channel: 'app-state',
  moduleId: './dist/app.js',
  validateState: isAppState,
})
const {
  bridge,
  workerData,
} = runtime
const FallbackUI = createControls({
  StackPanel,
  TextBlock,
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
    window.systemBackdrop =
      new bindings.MicaBackdrop()
    const appNotifications =
      createAppNotificationOwner({
        getManager: () =>
          AppNotificationManager.default_,
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
    const refreshHostDiagnostics = (
      status:
        WinUIWorkerHostStatus | null =
          runtime.readHostStatus(),
    ) => {
      if (!status) {
        return
      }
      if (
        status.timeoutCount > lastTimeoutCount &&
        status.timeoutAt > 0n
      ) {
        lastTimeoutCount = status.timeoutCount
        model.heartbeatTimedOut(
          Number(status.timeoutAt),
        )
      }
      if (
        status.acknowledgedSequence > 0n &&
        status.acknowledgedAt >=
          status.timeoutAt
      ) {
        model.heartbeatAcknowledged(
          Number(status.acknowledgedSequence),
          Number(status.acknowledgedAt),
          status.timeoutCount > 0n,
        )
      }
      if (
        status.exportRevision >
          lastExportRevision
      ) {
        lastExportRevision =
          status.exportRevision
        if (status.exportStatus === 1n) {
          model.inspectorExported(
            runtime.inspectorExportPath ??
              'inspector snapshot',
          )
        }
        else if (status.exportStatus === -1n) {
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
      shellCapabilities:
        workerData.shellCapabilities,
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
          `Export requested: ${
            runtime.inspectorExportPath ??
            'Host evidence path'
          }`
        runtime.requestInspectorExport(
          renderer.inspector.snapshot(),
        )
      },
    }

    let tree: Child
    try {
      tree = loadApp(false).renderApp(context)
    }
    catch (error) {
      tree = errorTree(error)
    }

    const disposeAfterRender =
      createWinUICleanup([
        () => secondaryWindows.dispose(),
        () => model.dispose(),
      ], 'Gallery synchronous cleanup failed.')
    const beforeCloseAsync =
      createWinUIAsyncCleanup([
        () => appNotifications.dispose(),
        () => secondaryWindows.disposeAsync(
          (callback) =>
            window.dispatcherQueue.tryEnqueue(
              DispatcherQueuePriority.Low,
              callback,
            ),
        ),
      ], 'Gallery asynchronous cleanup failed.')

    return {
      child: tree,
      beforeClose() {
        bridge.set(model.snapshot('closed'))
      },
      beforeCloseAsync,
      disposeAfterRender,
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
          onHeartbeat(heartbeat) {
            model.heartbeatSent(
              heartbeat.sequence,
              heartbeat.sentAt,
              heartbeat.snapshot,
            )
          },
          onHeartbeatError(error) {
            model.lastError.value =
              error instanceof Error
                ? error.stack ?? error.message
                : String(error)
          },
          onHostStatus:
            refreshHostDiagnostics,
          beforeDispose() {
            model.heartbeatDisabled()
          },
        })
      },
    }
  },
  ...runtime.appCallbacks,
})

void runtime.run(app)
