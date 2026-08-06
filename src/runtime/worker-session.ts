import type { Child } from '../core/vnode'
import type {
  RenderHandle,
  Renderer,
  RendererDiagnostics,
} from '../renderer/renderer'
import {
  createMessageTransport,
  createStateBridge,
  type MessageEndpoint,
  type StateBridge,
  type StateBridgeCommandOptions,
  type StateBridgeEventOptions,
  type StateBridgePatchOptions,
  type StateBridgeValidator,
} from './bridge'
import { createWinUICleanup } from './cleanup'
import {
  getRendererHeartbeatSharedState,
  rendererHeartbeatSharedStateIndex,
  type RendererHeartbeat,
} from './heartbeat'

interface WorkerFileSystem {
  existsSync(path: string): boolean
  readFileSync(path: string, encoding: 'utf8'): string
}

interface WorkerParentPort {
  postMessage(message: unknown): void
}

export interface WinUIWorkerStatePort
extends MessageEndpoint {
  close(): void
}

export interface WinUIWorkerRuntimeData<State> {
  readonly statePort: WinUIWorkerStatePort
  readonly initialState: State
  readonly rootDirectory: string
  readonly hotStatePath: string | null
  readonly heartbeatEnabled?: boolean
  readonly heartbeatState?: SharedArrayBuffer
  readonly inspectorExportPath?: string
}

interface CachedNodeModule {
  readonly filename?: string
  readonly children?: readonly CachedNodeModule[]
}

interface NodeRequire {
  (id: string): unknown
  readonly cache: Record<string, CachedNodeModule | undefined>
  resolve(id: string): string
}

interface WorkerModule {
  createRequire(filename: string): NodeRequire
}

interface WorkerPath {
  readonly sep: string
  isAbsolute(path: string): boolean
  join(...parts: string[]): string
  relative(from: string, to: string): string
}

interface WorkerProcess {
  exit(code?: number): never
}

declare const require: NodeRequire
declare const process: WorkerProcess

export interface WinUIWorkerHostStatus {
  readonly timeoutCount: bigint
  readonly timeoutAt: bigint
  readonly acknowledgedSequence: bigint
  readonly acknowledgedAt: bigint
  readonly exportRevision: bigint
  readonly exportStatus: bigint
}

interface RuntimeTimer {
  interval: { duration: bigint }
  isRepeating: boolean
  onTick(callback: () => void): () => void
  start(): void
  stop(): void
}

export interface WinUIWorkerRuntimeDispatcherQueue {
  createTimer(): RuntimeTimer
}

export interface WinUIWorkerRuntimeHotReloadMessage {
  readonly type?: string
  readonly version?: number
  readonly message?: string
}

interface RuntimeHotReloadOptions {
  readonly statePath: string | null
  readonly dispatcherQueue:
    WinUIWorkerRuntimeDispatcherQueue
  readonly fileSystem: WorkerFileSystem
  readonly renderHandle: RenderHandle
  readonly load: (
    message: WinUIWorkerRuntimeHotReloadMessage,
  ) => Child
  readonly fallback?: (error: unknown) => Child
  readonly beforeReload?: (
    message: WinUIWorkerRuntimeHotReloadMessage,
  ) => void
  readonly onReload?: (version: number) => void
  readonly onError: (
    error: unknown,
    version: number,
  ) => void
  readonly onPollError?: (
    error: unknown,
    version: number,
  ) => void
  readonly intervalDuration?: bigint
}

interface RuntimeDisposable {
  dispose(): void
}

interface RuntimeHeartbeatOptions {
  readonly dispatcherQueue:
    WinUIWorkerRuntimeDispatcherQueue
  readonly renderer: Renderer
  readonly onHeartbeat: (
    heartbeat: RendererHeartbeat,
  ) => void
  readonly onError: (error: unknown) => void
  readonly intervalDuration?: bigint
}

interface WinUIWorkerRuntimeFactories {
  readonly createHotReload: (
    options: RuntimeHotReloadOptions,
  ) => RuntimeDisposable | undefined
  readonly createHeartbeat: (
    options: RuntimeHeartbeatOptions,
  ) => RuntimeDisposable
}

export interface WinUIWorkerRenderedRuntimeOptions {
  readonly dispatcherQueue:
    WinUIWorkerRuntimeDispatcherQueue
  readonly renderer: Renderer
  readonly renderHandle: RenderHandle
  readonly fallback?: (error: unknown) => Child
  readonly load: (
    message: WinUIWorkerRuntimeHotReloadMessage,
  ) => Child
  readonly beforeReload?: (
    message: WinUIWorkerRuntimeHotReloadMessage,
  ) => void
  readonly onReload?: (version: number) => void
  readonly onReloadError?: (
    error: unknown,
    version: number,
  ) => void
  readonly onHeartbeat?: (
    heartbeat: RendererHeartbeat,
  ) => void
  readonly onHeartbeatError?: (
    error: unknown,
  ) => void
  readonly onHostStatus?: (
    status: WinUIWorkerHostStatus,
  ) => void
  readonly beforeDispose?: () => void
  readonly hotReloadIntervalDuration?: bigint
  readonly heartbeatIntervalDuration?: bigint
  readonly hostStatusIntervalDuration?: bigint
}

export interface WinUIWorkerRuntimeApp {
  run(): Promise<number>
}

export interface WinUIWorkerRuntime<
  State,
  Data extends WinUIWorkerRuntimeData<State>,
  Patch = never,
  Command = never,
  Event = never,
> {
  readonly workerData: Data
  readonly bridge: StateBridge<State, Patch, Command, Event>
  readonly inspectorExportPath: string | null
  readonly appCallbacks: {
    readonly onDiagnostics: (
      diagnostics: RendererDiagnostics,
    ) => void
    readonly onError: (error: unknown) => void
  }
  postMessage(message: unknown): void
  postError(error: unknown): void
  loadModule<Module>(invalidate?: boolean): Module
  readHostStatus(): WinUIWorkerHostStatus | null
  requestInspectorExport(
    snapshot: unknown,
  ): void
  createRenderedHooks(
    options: WinUIWorkerRenderedRuntimeOptions,
  ): {
    readonly disposeBeforeRender: () => void
  }
  complete(app: WinUIWorkerRuntimeApp): Promise<number>
  run(app: WinUIWorkerRuntimeApp): Promise<never>
  dispose(): void
}

export interface CreateWinUIWorkerRuntimeOptions<
  State,
  Patch = never,
  Command = never,
  Event = never,
> {
  readonly channel?: string
  readonly moduleId: string
  readonly validateState: StateBridgeValidator<State>
  readonly patch?: StateBridgePatchOptions<State, Patch>
  readonly commands?: StateBridgeCommandOptions<Command>
  readonly events?: StateBridgeEventOptions<Event>
}

function invalidateApplicationModuleGraph(
  cache: NodeRequire['cache'],
  entryPath: string,
  applicationDirectory: string,
  path: WorkerPath,
): void {
  const visited = new Set<string>()
  const isApplicationModule = (filename: string) => {
    const relative = path.relative(
      applicationDirectory,
      filename,
    )
    return (
      relative.length > 0 &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  }
  const invalidate = (filename: string) => {
    if (visited.has(filename)) {
      return
    }
    visited.add(filename)
    const cached = cache[filename]
    if (!cached) {
      return
    }
    for (const child of cached.children ?? []) {
      if (
        child.filename &&
        isApplicationModule(child.filename)
      ) {
        invalidate(child.filename)
      }
    }
    delete cache[filename]
  }

  invalidate(entryPath)
}

function describeError(error: unknown): string {
  return error instanceof Error
    ? error.stack ?? error.message
    : String(error)
}

function createTimerController(
  dispatcherQueue: WinUIWorkerRuntimeDispatcherQueue,
  intervalDuration: bigint,
  callback: () => void,
): RuntimeDisposable {
  if (intervalDuration <= 0n) {
    throw new RangeError(
      'Worker runtime timer interval must be positive.',
    )
  }
  const timer = dispatcherQueue.createTimer()
  timer.interval = { duration: intervalDuration }
  timer.isRepeating = true
  const unsubscribe = timer.onTick(callback)
  try {
    timer.start()
  }
  catch (error) {
    let cleanupError: unknown
    try {
      unsubscribe()
    }
    catch (failure) {
      cleanupError = failure
    }
    if (cleanupError !== undefined) {
      throw new AggregateError(
        [error, cleanupError],
        'Worker runtime timer failed to start and roll back.',
      )
    }
    throw error
  }
  const cleanup = createWinUICleanup([
    () => timer.stop(),
    unsubscribe,
  ], 'Worker runtime timer cleanup failed.')
  let disposed = false
  return {
    dispose() {
      if (disposed) {
        return
      }
      cleanup()
      disposed = true
    },
  }
}

export function createWinUIWorkerRuntimeBase<
  State,
  Extra extends object = Record<string, never>,
  Patch = never,
  Command = never,
  Event = never,
>(
  options: CreateWinUIWorkerRuntimeOptions<
    State,
    Patch,
    Command,
    Event
  >,
  factories: WinUIWorkerRuntimeFactories,
): WinUIWorkerRuntime<
  State,
  WinUIWorkerRuntimeData<State> & Extra,
  Patch,
  Command,
  Event
> {
  if (
    typeof options !== 'object' ||
    options === null ||
    typeof options.moduleId !== 'string' ||
    options.moduleId.length === 0 ||
    typeof options.validateState !== 'function'
  ) {
    throw new TypeError(
      'createWinUIWorkerRuntime() requires a moduleId and state validator.',
    )
  }
  const workerThreads = require(
    'node:worker_threads',
  ) as {
    readonly parentPort: WorkerParentPort | null
    readonly workerData:
      WinUIWorkerRuntimeData<State> & Extra
  }
  if (!workerThreads.parentPort) {
    throw new Error(
      'The WinUI entry point must run in a Worker.',
    )
  }
  const workerData = workerThreads.workerData
  if (
    typeof workerData !== 'object' ||
    workerData === null ||
    typeof workerData.rootDirectory !== 'string' ||
    workerData.rootDirectory.length === 0 ||
    typeof workerData.statePort !== 'object' ||
    workerData.statePort === null
  ) {
    throw new TypeError(
      'WinUI Worker data requires rootDirectory and statePort.',
    )
  }
  const parentPort = workerThreads.parentPort
  const bridge = createStateBridge<
    State,
    Patch,
    Command,
    Event
  >(
    createMessageTransport(workerData.statePort),
    {
      role: 'client',
      channel: options.channel ?? 'app-state',
      initial: workerData.initialState,
      validate: options.validateState,
      patch: options.patch,
      commands: options.commands,
      events: options.events,
      onDiagnostic(diagnostic) {
        parentPort.postMessage({
          type: 'state-bridge-diagnostic',
          value: diagnostic,
        })
      },
    },
  )
  const fileSystem = require(
    'node:fs',
  ) as WorkerFileSystem
  const module = require('node:module') as WorkerModule
  const path = require('node:path') as WorkerPath
  const requireFromApplication =
    module.createRequire(
      path.join(
        workerData.rootDirectory,
        'package.json',
      ),
    )
  const modulePath =
    requireFromApplication.resolve(options.moduleId)
  const heartbeatState = workerData.heartbeatState
    ? getRendererHeartbeatSharedState(
        workerData.heartbeatState,
      )
    : null
  let disposed = false

  const postMessage = (message: unknown) => {
    if (disposed) {
      throw new Error(
        'Cannot post through a disposed WinUI Worker runtime.',
      )
    }
    parentPort.postMessage(message)
  }

  const readHostStatus =
    (): WinUIWorkerHostStatus | null => {
      if (heartbeatState === null) {
        return null
      }
      return {
        timeoutCount: Atomics.load(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.timeoutCount,
        ),
        timeoutAt: Atomics.load(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.timeoutAt,
        ),
        acknowledgedSequence: Atomics.load(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.acknowledgedSequence,
        ),
        acknowledgedAt: Atomics.load(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.acknowledgedAt,
        ),
        exportRevision: Atomics.load(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.exportRevision,
        ),
        exportStatus: Atomics.load(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.exportStatus,
        ),
      }
    }

  const runtime: WinUIWorkerRuntime<
    State,
    WinUIWorkerRuntimeData<State> & Extra,
    Patch,
    Command,
    Event
  > = {
    workerData,
    bridge,
    inspectorExportPath:
      workerData.inspectorExportPath ?? null,
    appCallbacks: {
      onDiagnostics(diagnostics) {
        postMessage({
          type: 'diagnostics',
          value: diagnostics,
        })
      },
      onError(error) {
        postMessage({
          type: 'error',
          message: describeError(error),
        })
      },
    },
    postMessage,
    postError(error) {
      runtime.appCallbacks.onError(error)
    },
    loadModule<Module>(invalidate = false): Module {
      if (invalidate) {
        invalidateApplicationModuleGraph(
          requireFromApplication.cache,
          modulePath,
          path.join(
            workerData.rootDirectory,
            'dist',
          ),
          path,
        )
      }
      return requireFromApplication(
        modulePath,
      ) as Module
    },
    readHostStatus,
    requestInspectorExport(snapshot) {
      if (heartbeatState !== null) {
        Atomics.store(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.exportStatus,
          0n,
        )
      }
      postMessage({
        type: 'inspector-export',
        value: snapshot,
      })
    },
    createRenderedHooks(renderedOptions) {
      const cleanups: (() => void)[] = []
      try {
        const hotReload =
          factories.createHotReload({
            statePath: workerData.hotStatePath,
            dispatcherQueue:
              renderedOptions.dispatcherQueue,
            fileSystem,
            renderHandle:
              renderedOptions.renderHandle,
            fallback: renderedOptions.fallback,
            beforeReload:
              renderedOptions.beforeReload,
            load: renderedOptions.load,
            intervalDuration:
              renderedOptions
                .hotReloadIntervalDuration,
            onReload(version) {
              renderedOptions.onReload?.(version)
              postMessage({
                type: 'hot-reload',
                status: 'applied',
                version,
              })
            },
            onError(error, version) {
              renderedOptions.onReloadError?.(
                error,
                version,
              )
              postMessage({
                type: 'hot-reload',
                status: 'error',
                version,
                message: describeError(error),
              })
            },
            onPollError(error, version) {
              renderedOptions.onReloadError?.(
                error,
                version,
              )
              postMessage({
                type: 'hot-reload',
                status: 'error',
                version,
                message: describeError(error),
              })
            },
          })
        if (hotReload) {
          cleanups.push(() => hotReload.dispose())
        }

        const notifyHostStatus = () => {
          const status = readHostStatus()
          if (status) {
            renderedOptions.onHostStatus?.(status)
          }
        }
        if (workerData.heartbeatEnabled) {
          const heartbeat =
            factories.createHeartbeat({
              dispatcherQueue:
                renderedOptions.dispatcherQueue,
              renderer: renderedOptions.renderer,
              intervalDuration:
                renderedOptions
                  .heartbeatIntervalDuration,
              onHeartbeat(value) {
                notifyHostStatus()
                renderedOptions.onHeartbeat?.(value)
                postMessage({
                  type: 'heartbeat',
                  value,
                })
              },
              onError(error) {
                renderedOptions
                  .onHeartbeatError?.(error)
                postMessage({
                  type: 'heartbeat-error',
                  message: describeError(error),
                })
              },
            })
          cleanups.push(() => heartbeat.dispose())
        }
        else if (heartbeatState !== null) {
          const hostStatus = createTimerController(
            renderedOptions.dispatcherQueue,
            renderedOptions
              .hostStatusIntervalDuration ??
              2_500_000n,
            () => {
              try {
                notifyHostStatus()
              }
              catch (error) {
                renderedOptions
                  .onHeartbeatError?.(error)
                postMessage({
                  type: 'heartbeat-error',
                  message: describeError(error),
                })
              }
            },
          )
          cleanups.push(() => hostStatus.dispose())
        }

        const disposeControllers =
          createWinUICleanup(
            cleanups,
            'WinUI Worker runtime controller cleanup failed.',
          )
        const disposeRuntime =
          createWinUICleanup([
            () => {
              renderedOptions.beforeDispose?.()
            },
            () => {
              postMessage({
                type: 'heartbeat-suspend',
              })
            },
            disposeControllers,
          ], 'WinUI Worker rendered cleanup failed.')
        return {
          disposeBeforeRender() {
            disposeRuntime()
          },
        }
      }
      catch (error) {
        const rollback = createWinUICleanup(
          cleanups,
          'WinUI Worker runtime rollback failed.',
        )
        try {
          rollback()
        }
        catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            'WinUI Worker runtime setup and rollback failed.',
          )
        }
        throw error
      }
    },
    async complete(app) {
      let exitCode = 1
      try {
        await bridge.ready
        exitCode = await app.run()
      }
      catch (error) {
        runtime.postError(error)
      }
      try {
        runtime.dispose()
      }
      catch (error) {
        exitCode = 1
        runtime.postError(error)
      }
      return exitCode
    },
    async run(app) {
      const exitCode = await runtime.complete(app)
      return process.exit(exitCode)
    },
    dispose() {
      if (disposed) {
        return
      }
      const cleanup = createWinUICleanup([
        () => bridge.dispose(),
        () => workerData.statePort.close(),
      ], 'WinUI Worker runtime cleanup failed.')
      cleanup()
      disposed = true
    },
  }
  return runtime
}
