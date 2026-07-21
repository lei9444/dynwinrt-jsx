import {
  createControls,
  thickness,
  type Child,
  type RenderHandle,
} from 'dynwinrt-jsx'
import {
  createFileHotReloadController,
  type FileHotReloadController,
  type FileHotReloadDispatcherQueue,
  type FileHotReloadFileSystem,
  type FileHotReloadMessage,
} from 'dynwinrt-jsx/worker'
import {
  StackPanel,
  TextBlock,
} from '#winapp/bindings'
import type {
  DashboardAppContext,
} from '../dashboard-app'
import type { DashboardModel } from '../dashboard-model'
import type { DashboardWorkerParentPort } from './contracts'

interface NodeRequire {
  (id: string): unknown
  readonly cache: Record<string, unknown>
  resolve(id: string): string
}

interface DashboardAppModule {
  renderDashboardApp(context: DashboardAppContext): Child
}

export interface DashboardAppLoader {
  load(invalidate: boolean): DashboardAppModule
}

export interface DashboardHotReloadOptions {
  readonly statePath: string | null
  readonly dispatcherQueue: FileHotReloadDispatcherQueue
  readonly fileSystem: FileHotReloadFileSystem
  readonly renderHandle: RenderHandle
  readonly context: DashboardAppContext
  readonly model: DashboardModel
  readonly parentPort: DashboardWorkerParentPort
  readonly loader: DashboardAppLoader
}

declare const require: NodeRequire

const FallbackUI = createControls({
  StackPanel,
  TextBlock,
})

export function createDashboardAppLoader(): DashboardAppLoader {
  const moduleId = '../dashboard-app.js'
  const modulePath = require.resolve(moduleId)

  return {
    load(invalidate) {
      if (invalidate) {
        delete require.cache[modulePath]
      }
      return require(moduleId) as DashboardAppModule
    },
  }
}

export function createDashboardErrorTree(error: unknown): Child {
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

export function createDashboardHotReload(
  options: DashboardHotReloadOptions,
): FileHotReloadController | undefined {
  return createFileHotReloadController({
    statePath: options.statePath,
    dispatcherQueue: options.dispatcherQueue,
    fileSystem: options.fileSystem,
    renderHandle: options.renderHandle,
    fallback: createDashboardErrorTree,
    beforeReload(message) {
      options.model.hotStatus.value =
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
      return options.loader
        .load(true)
        .renderDashboardApp(options.context)
    },
    onReload(version) {
      options.model.hotStatus.value = 'ready'
      options.model.hotVersion.value = version
      options.model.lastError.value = null
      options.model.diagnostics.value =
        options.context.renderer.diagnostics
      options.parentPort.postMessage({
        type: 'hot-reload',
        status: 'applied',
        version,
      })
    },
    onError(error, version) {
      options.model.hotStatus.value = 'error'
      options.model.hotVersion.value = version
      options.model.lastError.value =
        error instanceof Error
          ? error.stack ?? error.message
          : String(error)
      options.model.diagnostics.value =
        options.context.renderer.diagnostics
      options.parentPort.postMessage({
        type: 'hot-reload',
        status: 'error',
        version,
        message: options.model.lastError.value,
      })
    },
    onPollError(error, version) {
      options.parentPort.postMessage({
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
}
