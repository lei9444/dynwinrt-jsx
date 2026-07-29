import {
  createMessageTransport,
  createStateBridge,
  type MessageEndpoint,
  type StateBridge,
} from './bridge'
import {
  createDiagnosticRecord,
  formatDiagnosticRecord,
  isDiagnosticProtocolRecord,
} from './diagnostics'
import {
  formatDiagnosticProtocolRecordSummary,
} from './diagnostic-evidence'
import {
  createJsonStateStore,
  type JsonStateLoadResult,
} from './persistence'
import {
  createWinUIHostEvidenceSession,
  type WinUIHostEvidenceOptions,
  type WinUIHostEvidencePaths,
  type WinUIHostEvidenceSession,
} from './host-evidence'

interface FileStats {
  readonly mtimeMs: number
}

interface HostFileSystem {
  existsSync(path: string): boolean
  mkdirSync(path: string, options: { recursive: true }): void
  writeFileSync(path: string, value: string): void
  renameSync(source: string, destination: string): void
  rmSync(path: string, options: { force: true }): void
  watchFile(
    path: string,
    options: { interval: number },
    listener: (
      current: FileStats,
      previous: FileStats,
    ) => void,
  ): void
  unwatchFile(path: string): void
}

interface HostOperatingSystem {
  homedir(): string
  tmpdir(): string
}

interface HostPath {
  basename(path: string): string
  dirname(path: string): string
  join(...parts: string[]): string
}

interface HostModule {
  createRequire(filename: string): (id: string) => unknown
}

interface HostMessagePort extends MessageEndpoint {
  close(): void
}

interface HostMessageChannel {
  readonly port1: HostMessagePort
  readonly port2: HostMessagePort
}

interface HostMessageChannelConstructor {
  new(): HostMessageChannel
}

export interface WinUIHostWorker {
  readonly threadId: number
  on(
    type: 'message',
    listener: (message: unknown) => void,
  ): this
  on(
    type: 'error',
    listener: (error: Error) => void,
  ): this
  on(
    type: 'exit',
    listener: (code: number) => void,
  ): this
  terminate(): Promise<number>
}

interface HostWorkerConstructor {
  new(
    filename: string,
    options: {
      readonly workerData: Readonly<Record<string, unknown>>
      readonly transferList: readonly HostMessagePort[]
    },
  ): WinUIHostWorker
}

interface HostWorkerThreads {
  readonly MessageChannel: HostMessageChannelConstructor
  readonly Worker: HostWorkerConstructor
}

interface HostProcess {
  readonly arch: string
  readonly pid: number
  readonly env: Record<string, string | undefined>
  exitCode: number | undefined
  on?(
    type: 'message',
    listener: (message: unknown) => void,
  ): unknown
  off?(
    type: 'message',
    listener: (message: unknown) => void,
  ): unknown
  removeListener?(
    type: 'message',
    listener: (message: unknown) => void,
  ): unknown
}

export interface WinUIHostLogger {
  log(message: string): void
  warn(message: string): void
  error(message: unknown): void
}

declare const process: HostProcess
declare const console: WinUIHostLogger
declare function require(id: string): unknown

export interface WinUIHostBootstrapOptions {
  readonly major?: number
  readonly minor?: number
  readonly dllPath?: string
  readonly skipWhenPackaged?: boolean
}

export interface WinUIHostStateOptions<State, PersistedState> {
  readonly channel?: string
  readonly path?: string
  readonly defaultState: () => PersistedState
  readonly validate: (
    value: unknown,
  ) => value is PersistedState
  readonly initialize: (
    loaded: JsonStateLoadResult<PersistedState>,
  ) => State
  readonly persist: (state: State) => PersistedState
  readonly isReady?: (state: State) => boolean
  readonly describe?: (
    state: State,
    persisted: PersistedState,
  ) => Readonly<Record<string, unknown>>
}

export interface WinUIHostHotReloadOptions {
  readonly enabled?: boolean
  readonly statePath?: string
  readonly directory?: string
  readonly reloadFiles?: readonly string[]
  readonly restartFiles?: readonly string[]
  readonly intervalMs?: number
}

export interface WinUIHostWorkerContext<State> {
  readonly statePort: MessageEndpoint
  readonly initialState: State
  readonly hotStatePath: string | null
  readonly evidencePaths: WinUIHostEvidencePaths | null
}

export interface DefineWinUIHostOptions<
  State,
  PersistedState,
> {
  readonly rootDirectory: string
  readonly applicationName?: string
  readonly workerPath?: string
  readonly bootstrap?: false | WinUIHostBootstrapOptions
  readonly state: WinUIHostStateOptions<
    State,
    PersistedState
  >
  readonly workerData?:
    | Readonly<Record<string, unknown>>
    | ((
      context: WinUIHostWorkerContext<State>,
    ) => Readonly<Record<string, unknown>>)
  readonly hotReload?: WinUIHostHotReloadOptions
  readonly evidence?: WinUIHostEvidenceOptions
  readonly logger?: WinUIHostLogger
  readonly diagnosticSource?: string
  readonly workerDiagnosticSource?: string
  readonly onWorkerMessage?: (message: unknown) => void
  readonly onWorkerCreated?: (
    worker: WinUIHostWorker,
  ) => void
}

export interface DefinedWinUIHost<State> {
  readonly statePath: string
  readonly bridge: StateBridge<State> | null
  readonly worker: WinUIHostWorker | null
  readonly evidencePaths: WinUIHostEvidencePaths | null
  readonly started: boolean
  readonly disposed: boolean
  run(): Promise<number>
  dispose(): Promise<void>
}

interface HostRuntimeModules {
  readonly fs: HostFileSystem
  readonly module: HostModule
  readonly os: HostOperatingSystem
  readonly path: HostPath
  readonly workerThreads: HostWorkerThreads
}

function loadHostRuntime(): HostRuntimeModules {
  return {
    fs: require('node:fs') as HostFileSystem,
    module: require('node:module') as HostModule,
    os: require('node:os') as HostOperatingSystem,
    path: require('node:path') as HostPath,
    workerThreads: require(
      'node:worker_threads',
    ) as HostWorkerThreads,
  }
}

function isRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null
}

function describeError(error: unknown): string {
  return error instanceof Error
    ? error.stack ?? error.message
    : String(error)
}

function requireArchitecture(architecture: string): string {
  const supported: Readonly<Record<string, string>> = {
    arm64: 'arm64',
    x64: 'x64',
  }
  const directory = supported[architecture]
  if (!directory) {
    throw new Error(
      `Unsupported Node.js architecture: ${architecture}`,
    )
  }
  return directory
}

function initializeWindowsAppSdk(
  options: false | WinUIHostBootstrapOptions,
  rootDirectory: string,
  runtime: HostRuntimeModules,
): void {
  if (options === false) {
    return
  }
  if (
    options.skipWhenPackaged !== false &&
    process.env.DYNWINRT_JSX_PACKAGED === '1'
  ) {
    return
  }
  const architecture = requireArchitecture(process.arch)
  const bootstrapDll =
    options.dllPath ??
    process.env.WINAPPSDK_BOOTSTRAP_DLL_PATH ??
    runtime.path.join(
      rootDirectory,
      '.winapp',
      'bin',
      architecture,
      'Microsoft.WindowsAppRuntime.Bootstrap.dll',
    )
  if (!runtime.fs.existsSync(bootstrapDll)) {
    throw new Error(
      `Windows App SDK bootstrap DLL was not found at ${bootstrapDll}. Run npm run setup first.`,
    )
  }
  process.env.WINAPPSDK_BOOTSTRAP_DLL_PATH =
    bootstrapDll
  const requireFromApplication =
    runtime.module.createRequire(
      runtime.path.join(
        rootDirectory,
        'package.json',
      ),
    )
  const dynwinrt =
    requireFromApplication('@microsoft/dynwinrt')
  if (
    !isRecord(dynwinrt) ||
    typeof dynwinrt.initWinappsdk !== 'function'
  ) {
    throw new TypeError(
      '@microsoft/dynwinrt does not export initWinappsdk().',
    )
  }
  dynwinrt.initWinappsdk(
    options.major ?? 2,
    options.minor ?? 2,
  )
}

function writeHotMessage(
  runtime: HostRuntimeModules,
  statePath: string,
  value: Readonly<Record<string, unknown>>,
): void {
  const temporaryPath = `${statePath}.tmp`
  try {
    runtime.fs.mkdirSync(
      runtime.path.dirname(statePath),
      { recursive: true },
    )
    runtime.fs.writeFileSync(
      temporaryPath,
      JSON.stringify(value),
    )
    runtime.fs.renameSync(temporaryPath, statePath)
  }
  finally {
    runtime.fs.rmSync(temporaryPath, { force: true })
  }
}

export function defineWinUIHost<State, PersistedState>(
  options: DefineWinUIHostOptions<State, PersistedState>,
): DefinedWinUIHost<State> {
  if (
    typeof options !== 'object' ||
    options === null ||
    typeof options.rootDirectory !== 'string' ||
    options.rootDirectory.length === 0 ||
    typeof options.state !== 'object' ||
    options.state === null ||
    typeof options.state.defaultState !== 'function' ||
    typeof options.state.validate !== 'function' ||
    typeof options.state.initialize !== 'function' ||
    typeof options.state.persist !== 'function'
  ) {
    throw new TypeError(
      'defineWinUIHost() requires rootDirectory and state options.',
    )
  }
  const runtime = loadHostRuntime()
  const logger = options.logger ?? console
  const applicationName =
    options.applicationName ??
    runtime.path.basename(options.rootDirectory)
  const statePath =
    options.state.path ??
    process.env.DYNWINRT_JSX_STATE_PATH ??
    runtime.path.join(
      process.env.LOCALAPPDATA ??
        runtime.os.homedir(),
      'dynwinrt-jsx',
      applicationName,
      'state.json',
    )
  let bridge: StateBridge<State> | null = null
  let worker: WinUIHostWorker | null = null
  let hostPort: HostMessagePort | null = null
  let pendingWorkerPort: HostMessagePort | null = null
  let started = false
  let disposed = false
  let disposing = false
  let cleanupComplete = false
  let hotStatePath: string | null = null
  let watchedFiles: string[] = []
  let processMessageListener:
    | ((message: unknown) => void)
    | null = null
  let resolveExit: ((code: number) => void) | null = null
  let runPromise: Promise<number> | null = null
  let workerFailed = false
  let stateSubscription: (() => void) | null = null
  let evidenceSession: WinUIHostEvidenceSession | null =
    null
  let evidencePaths: WinUIHostEvidencePaths | null =
    null

  const diagnosticSource =
    options.diagnosticSource ?? 'app-host'
  const workerDiagnosticSource =
    options.workerDiagnosticSource ?? 'app-worker'
  const writeDiagnostic = (
    level: 'log' | 'warn' | 'error',
    source: string,
    event: string,
    details: Readonly<Record<string, unknown>>,
  ) => {
    const message = formatDiagnosticRecord(
      createDiagnosticRecord(
        source,
        event,
        details,
        level === 'warn'
          ? 'warning'
          : level === 'error'
            ? 'error'
            : 'info',
      ),
    )
    logger[level](message)
  }

  const cleanup = (): unknown => {
    if (cleanupComplete) {
      return undefined
    }
    let firstError: unknown
    const attempt = (callback: () => void): boolean => {
      try {
        callback()
        return true
      }
      catch (error) {
        firstError ??= error
        logger.error(error)
        return false
      }
    }
    if (
      stateSubscription !== null &&
      attempt(stateSubscription)
    ) {
      stateSubscription = null
    }
    const remainingWatchedFiles: string[] = []
    for (const filePath of watchedFiles) {
      if (
        !attempt(() => {
          runtime.fs.unwatchFile(filePath)
        })
      ) {
        remainingWatchedFiles.push(filePath)
      }
    }
    watchedFiles = remainingWatchedFiles
    if (processMessageListener) {
      const listener = processMessageListener
      if (
        attempt(() => {
          if (process.off) {
            process.off('message', listener)
          } else {
            process.removeListener?.(
              'message',
              listener,
            )
          }
        })
      ) {
        processMessageListener = null
      }
    }
    if (
      bridge !== null &&
      attempt(() => {
        bridge?.dispose()
      })
    ) {
      bridge = null
    }
    if (
      hostPort !== null &&
      attempt(() => {
        hostPort?.close()
      })
    ) {
      hostPort = null
    }
    if (
      pendingWorkerPort !== null &&
      attempt(() => {
        pendingWorkerPort?.close()
      })
    ) {
      pendingWorkerPort = null
    }
    if (
      evidenceSession !== null &&
      attempt(() => {
        evidenceSession?.dispose()
      })
    ) {
      evidenceSession = null
    }
    if (hotStatePath !== null) {
      const currentHotStatePath = hotStatePath
      if (
        attempt(() => {
          runtime.fs.rmSync(
            currentHotStatePath,
            { force: true },
          )
        })
      ) {
        hotStatePath = null
      }
    }
    cleanupComplete =
      stateSubscription === null &&
      watchedFiles.length === 0 &&
      processMessageListener === null &&
      bridge === null &&
      hostPort === null &&
      pendingWorkerPort === null &&
      evidenceSession === null &&
      hotStatePath === null
    return firstError
  }

  const host: DefinedWinUIHost<State> = {
    statePath,
    get bridge() {
      return bridge
    },
    get worker() {
      return worker
    },
    get evidencePaths() {
      return evidencePaths
    },
    get started() {
      return started
    },
    get disposed() {
      return disposed
    },
    run() {
      if (started) {
        throw new Error(
          'A defined WinUI Host can only run once.',
        )
      }
      if (disposed) {
        throw new Error(
          'Cannot run a disposed WinUI Host.',
        )
      }
      started = true
      runPromise = new Promise<number>((resolve) => {
        resolveExit = resolve
      })
      try {
        initializeWindowsAppSdk(
          options.bootstrap ?? {},
          options.rootDirectory,
          runtime,
        )
        const stateStore = createJsonStateStore({
          path: statePath,
          defaultState: options.state.defaultState,
          validate: options.state.validate,
        })
        const loadedState = stateStore.load()
        const initialState =
          options.state.initialize(loadedState)
        if (loadedState.error) {
          writeDiagnostic(
            'warn',
            diagnosticSource,
            'state.recovered',
            {
              path: statePath,
              error: loadedState.error,
              corruptPath: loadedState.corruptPath,
            },
          )
        }

        const {
          port1,
          port2,
        } = new runtime.workerThreads.MessageChannel()
        hostPort = port1
        pendingWorkerPort = port2
        bridge = createStateBridge(
          createMessageTransport(port1),
          {
            role: 'host',
            channel:
              options.state.channel ?? 'app-state',
            initial: initialState,
          },
        )

        const hotOptions = options.hotReload ?? {}
        const hotEnabled =
          hotOptions.enabled ??
          process.env.DYNWINRT_JSX_HOT === '1'
        let hotVersion = 0
        if (hotEnabled) {
          hotStatePath =
            hotOptions.statePath ??
            runtime.path.join(
              runtime.os.tmpdir(),
              `dynwinrt-jsx-hot-${process.pid}.json`,
            )
          writeHotMessage(runtime, hotStatePath, {
            type: 'ready',
            version: hotVersion,
          })
        }
        if (options.evidence) {
          evidenceSession =
            createWinUIHostEvidenceSession({
              options: options.evidence,
              statePath,
              logger,
              onError(error) {
                logger.error(error)
                workerFailed = true
              },
            })
          evidencePaths = evidenceSession.paths
        }

        const workerContext: WinUIHostWorkerContext<State> = {
          statePort: port2,
          initialState,
          hotStatePath,
          evidencePaths:
            evidenceSession?.paths ?? null,
        }
        const additionalWorkerData =
          typeof options.workerData === 'function'
            ? options.workerData(workerContext)
            : options.workerData ?? {}
        worker = new runtime.workerThreads.Worker(
          options.workerPath ??
            runtime.path.join(
              options.rootDirectory,
              'dist',
              'winui-worker.js',
            ),
          {
            workerData: {
              ...additionalWorkerData,
              ...evidenceSession?.workerData,
              statePort: port2,
              hotStatePath,
              initialState,
              rootDirectory:
                options.rootDirectory,
            },
            transferList: [port2],
          },
        )
        pendingWorkerPort = null
        evidenceSession?.attachWorker(worker.threadId)
        worker.on('message', (message) => {
          if (
            isRecord(message) &&
            message.type === 'diagnostic'
          ) {
            if (!isDiagnosticProtocolRecord(message.value)) {
              logger.error(
                'The WinUI Worker sent an invalid diagnostic record.',
              )
              workerFailed = true
            } else {
              evidenceSession?.recordDiagnostic(
                message.value,
              )
              logger.log(
                formatDiagnosticProtocolRecordSummary(
                  message.value,
                ),
              )
            }
          } else if (
            isRecord(message) &&
            message.type === 'error'
          ) {
            const errorMessage = String(message.message)
            logger.error(errorMessage)
            writeDiagnostic(
              'error',
              workerDiagnosticSource,
              'worker.error',
              { message: errorMessage },
            )
            workerFailed = true
          } else if (
            isRecord(message) &&
            message.type === 'diagnostics'
          ) {
            logger.log(
              `dynwinrt-jsx renderer disposed cleanly: ${JSON.stringify(message.value)}`,
            )
            writeDiagnostic(
              'log',
              workerDiagnosticSource,
              'renderer.disposed',
              isRecord(message.value)
                ? message.value
                : { value: message.value },
            )
          } else if (
            isRecord(message) &&
            message.type === 'hot-reload'
          ) {
            const status = String(message.status)
            logger.log(
              `dynwinrt-jsx hot reload ${status} (version ${String(message.version)}).`,
            )
            if (message.message !== undefined) {
              logger.error(String(message.message))
            }
          }
          try {
            evidenceSession?.handleWorkerMessage(
              message,
            )
          }
          catch (error) {
            logger.error(error)
            workerFailed = true
          }
          try {
            options.onWorkerMessage?.(message)
          }
          catch (error) {
            logger.error(error)
            workerFailed = true
          }
        })
        worker.on('error', (error) => {
          logger.error(error)
          writeDiagnostic(
            'error',
            workerDiagnosticSource,
            'worker.thread-error',
            { message: describeError(error) },
          )
          workerFailed = true
        })
        worker.on('exit', (code) => {
          try {
            evidenceSession?.finalize(code)
          }
          catch (error) {
            logger.error(error)
            workerFailed = true
          }
          const cleanupError = cleanup()
          if (cleanupError !== undefined) {
            workerFailed = true
          }
          worker = null
          disposed = cleanupComplete
          const exitCode =
            workerFailed && code === 0 ? 1 : code
          resolveExit?.(exitCode)
          resolveExit = null
        })
        options.onWorkerCreated?.(worker)

        let announcedReady = false
        let persistedFingerprint = JSON.stringify(
          loadedState.state,
        )
        const handleState = (state: State) => {
          if (!announcedReady) {
            try {
              const ready =
                options.state.isReady?.(state) ??
                (
                  isRecord(state) &&
                  state.status === 'running'
                )
              if (ready) {
                announcedReady = true
                logger.log('WinUI app is ready.')
                writeDiagnostic(
                  'log',
                  diagnosticSource,
                  'application.ready',
                  { statePath },
                )
              }
            }
            catch (error) {
              workerFailed = true
              writeDiagnostic(
                'error',
                diagnosticSource,
                'state.ready-error',
                { message: describeError(error) },
              )
            }
          }
          let persisted: PersistedState
          let fingerprint: string
          try {
            persisted = options.state.persist(state)
            fingerprint = JSON.stringify(persisted)
          }
          catch (error) {
            workerFailed = true
            writeDiagnostic(
              'error',
              diagnosticSource,
              'state.persist-error',
              {
                path: statePath,
                message: describeError(error),
              },
            )
            return
          }
          if (fingerprint === persistedFingerprint) {
            return
          }
          let description: Readonly<Record<
            string,
            unknown
          >> = {}
          try {
            description =
              options.state.describe?.(
                state,
                persisted,
              ) ?? {}
          }
          catch (error) {
            workerFailed = true
            writeDiagnostic(
              'error',
              diagnosticSource,
              'state.describe-error',
              { message: describeError(error) },
            )
          }
          try {
            stateStore.save(persisted)
            persistedFingerprint = fingerprint
            writeDiagnostic(
              'log',
              diagnosticSource,
              'state.saved',
              {
                path: statePath,
                ...description,
              },
            )
          }
          catch (error) {
            workerFailed = true
            writeDiagnostic(
              'error',
              diagnosticSource,
              'state.save-error',
              {
                path: statePath,
                message: describeError(error),
              },
            )
          }
        }
        stateSubscription =
          bridge.state.subscribe(handleState)
        handleState(initialState)

        if (hotEnabled && hotStatePath !== null) {
          const directory =
            hotOptions.directory ??
            runtime.path.join(
              options.rootDirectory,
              'dist',
            )
          const postHotMessage = (
            type: string,
            value: Readonly<Record<string, unknown>>,
          ) => {
            hotVersion += 1
            writeHotMessage(runtime, hotStatePath!, {
              type,
              version: hotVersion,
              ...value,
            })
          }
          const watch = (
            filename: string,
            reload: boolean,
          ) => {
            const filePath = runtime.path.join(
              directory,
              filename,
            )
            watchedFiles.push(filePath)
            runtime.fs.watchFile(
              filePath,
              { interval: hotOptions.intervalMs ?? 100 },
              (current, previous) => {
                if (current.mtimeMs === previous.mtimeMs) {
                  return
                }
                if (reload) {
                  try {
                    postHotMessage('hot-reload', {
                      changedFiles: [filename],
                    })
                  }
                  catch (error) {
                    workerFailed = true
                    writeDiagnostic(
                      'error',
                      diagnosticSource,
                      'hot-reload.write-error',
                      {
                        message: describeError(error),
                      },
                    )
                  }
                } else {
                  logger.log(
                    `Hot reload boundary changed (${filename}); restart the Worker.`,
                  )
                }
              },
            )
          }
          for (
            const filename of
              hotOptions.reloadFiles ?? ['app.js']
          ) {
            watch(filename, true)
          }
          for (
            const filename of
              hotOptions.restartFiles ?? [
                'winui-worker.js',
                'app-model.js',
              ]
          ) {
            watch(filename, false)
          }
          processMessageListener = (message) => {
            if (
              isRecord(message) &&
              message.type === 'hot-build-error'
            ) {
              try {
                postHotMessage('hot-build-error', {
                  message: message.message,
                })
              }
              catch (error) {
                workerFailed = true
                writeDiagnostic(
                  'error',
                  diagnosticSource,
                  'hot-reload.write-error',
                  { message: describeError(error) },
                )
              }
            }
          }
          process.on?.(
            'message',
            processMessageListener,
          )
          logger.log(
            'dynwinrt-jsx hot reload is active.',
          )
        }

      }
      catch (error) {
        const failedWorker = worker
        worker = null
        let cleanupError = cleanup()
        disposed = cleanupComplete
        resolveExit?.(1)
        resolveExit = null
        runPromise = (
          async () => {
            let terminationError: unknown
            if (failedWorker !== null) {
              try {
                await failedWorker.terminate()
              }
              catch (error) {
                terminationError = error
              }
            }
            if (cleanupComplete) {
              cleanupError = undefined
              disposed = true
            }
            const failures = [
              error,
              cleanupError,
              terminationError,
            ].filter(
              (failure) => failure !== undefined,
            )
            if (failures.length > 1) {
              throw new AggregateError(
                failures,
                'WinUI Host startup and cleanup failed.',
              )
            }
            throw error
          }
        )()
      }
      return runPromise
    },
    async dispose() {
      if (disposed || disposing) {
        return
      }
      disposing = true
      try {
        const currentWorker = worker
        let cleanupError = cleanup()
        let terminationError: unknown
        try {
          if (currentWorker !== null) {
            await currentWorker.terminate()
          }
        }
        catch (error) {
          terminationError = error
        }
        if (!cleanupComplete) {
          cleanupError = cleanup() ?? cleanupError
        }
        if (cleanupComplete) {
          cleanupError = undefined
        }
        worker = null
        resolveExit?.(1)
        resolveExit = null
        disposed =
          cleanupError === undefined &&
          terminationError === undefined
        if (
          cleanupError !== undefined &&
          terminationError !== undefined
        ) {
          throw new AggregateError(
            [cleanupError, terminationError],
            'WinUI Host disposal failed.',
          )
        }
        if (cleanupError !== undefined) {
          throw cleanupError
        }
        if (terminationError !== undefined) {
          throw terminationError
        }
      }
      finally {
        disposing = false
      }
    },
  }
  return host
}
