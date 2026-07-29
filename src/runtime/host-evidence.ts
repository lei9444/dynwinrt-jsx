import type {
  RendererInspectionSnapshot,
} from '../renderer/inspector'
import {
  assertRendererInspectionIdle,
  createDiagnosticBuffer,
  createDiagnosticEvidenceBundle,
  diagnosticEvidenceProtocolName,
  type DiagnosticBuffer,
} from './diagnostic-evidence'
import type {
  DiagnosticProtocolRecord,
} from './diagnostics'
import {
  createRendererHeartbeatMonitor,
  createRendererHeartbeatSharedState,
  getRendererHeartbeatSharedState,
  rendererHeartbeatSharedStateIndex,
  summarizeRendererHeartbeatTimeout,
  type RendererHeartbeat,
  type RendererHeartbeatMonitor,
} from './heartbeat'

interface EvidenceFileSystem {
  mkdirSync(path: string, options: { recursive: true }): void
  writeFileSync(path: string, value: string): void
  renameSync(source: string, destination: string): void
  rmSync(path: string, options: { force: true }): void
}

interface EvidencePath {
  dirname(path: string): string
  join(...parts: string[]): string
}

interface EvidenceTimer {
  unref?(): void
}

interface EvidenceTimers {
  setInterval(
    callback: () => void,
    intervalMs: number,
  ): EvidenceTimer
  clearInterval(timer: EvidenceTimer): void
}

interface EvidenceProcess {
  readonly env: Record<string, string | undefined>
  readonly pid: number
}

declare const process: EvidenceProcess
declare function require(id: string): unknown

export interface WinUIHostEvidenceFileOptions {
  readonly path?: string
}

export interface WinUIHostHeartbeatEvidenceOptions
extends WinUIHostEvidenceFileOptions {
  readonly enabled?: boolean
  readonly timeoutMs?: number
  readonly checkIntervalMs?: number
}

export interface WinUIHostFinalEvidenceOptions
extends WinUIHostEvidenceFileOptions {
  readonly assertIdle?: boolean
  readonly requireRendererSnapshot?: boolean
}

export interface WinUIHostEvidenceOptions {
  readonly directory?: string
  readonly maxDiagnosticRecords?: number
  readonly heartbeat?:
    | boolean
    | WinUIHostHeartbeatEvidenceOptions
  readonly inspector?:
    | boolean
    | WinUIHostEvidenceFileOptions
  readonly diagnostics?:
    | boolean
    | WinUIHostEvidenceFileOptions
  readonly final?:
    | boolean
    | WinUIHostFinalEvidenceOptions
  readonly metadata?:
    | Readonly<Record<string, unknown>>
    | (() => Readonly<Record<string, unknown>>)
}

export interface WinUIHostEvidencePaths {
  readonly heartbeat: string | null
  readonly inspector: string | null
  readonly diagnostics: string | null
  readonly final: string | null
}

export interface WinUIHostEvidenceLogger {
  log(message: string): void
  error(message: unknown): void
}

export interface WinUIHostEvidenceSession {
  readonly paths: WinUIHostEvidencePaths
  readonly workerData: Readonly<Record<string, unknown>>
  recordDiagnostic(record: DiagnosticProtocolRecord): void
  attachWorker(threadId: number): void
  handleWorkerMessage(message: unknown): boolean
  finalize(workerExitCode: number): void
  dispose(): void
}

interface CreateWinUIHostEvidenceSessionOptions {
  readonly options: WinUIHostEvidenceOptions
  readonly statePath: string
  readonly logger: WinUIHostEvidenceLogger
  readonly onError: (error: unknown) => void
}

function isRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null
}

function featurePath(
  feature:
    | boolean
    | WinUIHostEvidenceFileOptions
    | undefined,
  directory: string,
  filename: string,
  environmentPath: string | undefined,
  path: EvidencePath,
): string | null {
  if (!feature) {
    return null
  }
  return (
    typeof feature === 'object' &&
    feature.path !== undefined
      ? feature.path
      : environmentPath ??
        path.join(directory, filename)
  )
}

function positiveEnvironmentInteger(
  name: string,
): number | undefined {
  const raw = process.env[name]
  if (raw === undefined) {
    return undefined
  }
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(
      `${name} must be a positive integer.`,
    )
  }
  return value
}

function writeJsonAtomic(
  fs: EvidenceFileSystem,
  path: EvidencePath,
  filePath: string,
  value: unknown,
): void {
  fs.mkdirSync(
    path.dirname(filePath),
    { recursive: true },
  )
  const temporaryPath =
    `${filePath}.${process.pid}.${Date.now()}.tmp`
  try {
    fs.writeFileSync(
      temporaryPath,
      `${JSON.stringify(value, null, 2)}\n`,
    )
    fs.renameSync(temporaryPath, filePath)
  }
  finally {
    fs.rmSync(temporaryPath, { force: true })
  }
}

function rendererSnapshot(
  value: unknown,
): RendererInspectionSnapshot {
  if (
    !isRecord(value) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.operations) ||
    !Array.isArray(value.subscriptions) ||
    !isRecord(value.reactive) ||
    !isRecord(value.diagnostics)
  ) {
    throw new TypeError(
      'Host evidence requires a renderer inspection snapshot.',
    )
  }
  return value as unknown as RendererInspectionSnapshot
}

function heartbeatMessage(
  value: unknown,
): RendererHeartbeat {
  if (
    !isRecord(value) ||
    typeof value.sequence !== 'number' ||
    !Number.isInteger(value.sequence) ||
    typeof value.sentAt !== 'number' ||
    value.snapshot === undefined
  ) {
    throw new TypeError(
      'Host evidence received an invalid renderer heartbeat.',
    )
  }
  return {
    sequence: value.sequence,
    sentAt: value.sentAt,
    snapshot: rendererSnapshot(value.snapshot),
  }
}

export function createWinUIHostEvidenceSession(
  options: CreateWinUIHostEvidenceSessionOptions,
): WinUIHostEvidenceSession {
  const fs = require('node:fs') as EvidenceFileSystem
  const path = require('node:path') as EvidencePath
  const timers = require('node:timers') as EvidenceTimers
  const evidence = options.options
  const directory =
    evidence.directory ??
    path.dirname(options.statePath)
  const paths: WinUIHostEvidencePaths = {
    heartbeat: featurePath(
      evidence.heartbeat,
      directory,
      'heartbeat-timeout.json',
      process.env.DYNWINRT_JSX_HEARTBEAT_PATH,
      path,
    ),
    inspector: featurePath(
      evidence.inspector,
      directory,
      'inspector-snapshot.json',
      process.env.DYNWINRT_JSX_INSPECTOR_EXPORT_PATH,
      path,
    ),
    diagnostics: featurePath(
      evidence.diagnostics,
      directory,
      'diagnostics-evidence.json',
      process.env.DYNWINRT_JSX_DIAGNOSTICS_PATH,
      path,
    ),
    final: featurePath(
      evidence.final,
      directory,
      'final-evidence.json',
      process.env.DYNWINRT_JSX_FINAL_EVIDENCE_PATH,
      path,
    ),
  }
  const diagnostics: DiagnosticBuffer =
    createDiagnosticBuffer({
      maxRecords:
        evidence.maxDiagnosticRecords ?? 1_000,
    })
  const sharedStateBuffer =
    createRendererHeartbeatSharedState()
  const sharedState =
    getRendererHeartbeatSharedState(
      sharedStateBuffer,
    )
  const heartbeatOptions =
    typeof evidence.heartbeat === 'object'
      ? evidence.heartbeat
      : {}
  const heartbeatEnabled =
    evidence.heartbeat !== false &&
    evidence.heartbeat !== undefined &&
    (
      heartbeatOptions.enabled ??
      process.env.DYNWINRT_JSX_HEARTBEAT !== '0'
    )
  let workerThreadId: number | null = null
  let disposed = false

  const metadata = (
    additional: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> => ({
    ...(typeof evidence.metadata === 'function'
      ? evidence.metadata()
      : evidence.metadata ?? {}),
    processId: process.pid,
    ...(workerThreadId === null
      ? {}
      : { workerThreadId }),
    ...additional,
  })

  const setExportStatus = (status: bigint) => {
    Atomics.store(
      sharedState,
      rendererHeartbeatSharedStateIndex.exportStatus,
      status,
    )
    Atomics.add(
      sharedState,
      rendererHeartbeatSharedStateIndex.exportRevision,
      1n,
    )
  }

  const monitor: RendererHeartbeatMonitor | null =
    heartbeatEnabled
      ? createRendererHeartbeatMonitor({
          timeoutMs:
            heartbeatOptions.timeoutMs ??
            positiveEnvironmentInteger(
              'DYNWINRT_JSX_HEARTBEAT_TIMEOUT_MS',
            ),
          checkIntervalMs:
            heartbeatOptions.checkIntervalMs,
          schedule(callback, intervalMs) {
            const timer = timers.setInterval(
              callback,
              intervalMs,
            )
            timer.unref?.()
            return () => {
              timers.clearInterval(timer)
            }
          },
          onTimeout(status) {
            const detectedAt = Date.now()
            const timeoutSummary =
              summarizeRendererHeartbeatTimeout(status)
            Atomics.store(
              sharedState,
              rendererHeartbeatSharedStateIndex.timeoutAt,
              BigInt(detectedAt),
            )
            Atomics.store(
              sharedState,
              rendererHeartbeatSharedStateIndex.timeoutCount,
              BigInt(status.timeoutCount),
            )
            if (paths.heartbeat === null) {
              return
            }
            try {
              writeJsonAtomic(
                fs,
                path,
                paths.heartbeat,
                createDiagnosticEvidenceBundle({
                  diagnostics: diagnostics.snapshot(),
                  ...(status.lastHeartbeat
                    ? {
                        renderer:
                          status.lastHeartbeat.snapshot,
                      }
                    : {}),
                  heartbeat: {
                    status,
                    timeoutSummary,
                  },
                  metadata: metadata({ detectedAt }),
                }),
              )
              options.logger.error(
                `WinUI heartbeat timed out; evidence: ${paths.heartbeat}`,
              )
            }
            catch (error) {
              options.onError(error)
            }
          },
          onRecovered(status) {
            options.logger.log(
              `WinUI heartbeat recovered at sequence ${status.lastSequence}.`,
            )
          },
        })
      : null

  return {
    paths,
    workerData: {
      heartbeatEnabled,
      heartbeatState: sharedStateBuffer,
      ...(paths.inspector === null
        ? {}
        : { inspectorExportPath: paths.inspector }),
      ...(paths.diagnostics === null
        ? {}
        : {
            diagnosticsExportPath:
              paths.diagnostics,
          }),
    },
    recordDiagnostic(record) {
      diagnostics.append(record)
    },
    attachWorker(threadId) {
      workerThreadId = threadId
    },
    handleWorkerMessage(message) {
      if (!isRecord(message)) {
        return false
      }
      if (message.type === 'heartbeat') {
        if (monitor === null) {
          return true
        }
        const heartbeat =
          heartbeatMessage(message.value)
        if (monitor.receive(heartbeat)) {
          const status = monitor.snapshot()
          Atomics.store(
            sharedState,
            rendererHeartbeatSharedStateIndex.acknowledgedAt,
            BigInt(status.lastReceivedAt ?? 0),
          )
          Atomics.store(
            sharedState,
            rendererHeartbeatSharedStateIndex.acknowledgedSequence,
            BigInt(status.lastSequence),
          )
        }
        return true
      }
      if (message.type === 'heartbeat-error') {
        throw new Error(String(message.message))
      }
      if (message.type === 'heartbeat-suspend') {
        monitor?.dispose()
        return true
      }
      if (
        message.type === 'inspector-export' &&
        paths.inspector !== null
      ) {
        try {
          writeJsonAtomic(
            fs,
            path,
            paths.inspector,
            {
              version: 1,
              type: 'renderer-inspector',
              exportedAt: new Date().toISOString(),
              snapshot:
                rendererSnapshot(message.value),
            },
          )
          setExportStatus(1n)
          options.logger.log(
            `WinUI inspector exported: ${paths.inspector}`,
          )
        }
        catch (error) {
          setExportStatus(-1n)
          throw error
        }
        return true
      }
      if (
        message.type === 'diagnostics-export' &&
        paths.diagnostics !== null
      ) {
        if (
          !isRecord(message.value) ||
          message.value.protocol !==
            diagnosticEvidenceProtocolName
        ) {
          setExportStatus(-1n)
          throw new TypeError(
            'WinUI Worker sent invalid diagnostic evidence.',
          )
        }
        try {
          writeJsonAtomic(
            fs,
            path,
            paths.diagnostics,
            message.value,
          )
          setExportStatus(1n)
          options.logger.log(
            `WinUI diagnostics exported: ${paths.diagnostics}`,
          )
        }
        catch (error) {
          setExportStatus(-1n)
          throw error
        }
        return true
      }
      return false
    },
    finalize(workerExitCode) {
      if (paths.final === null) {
        return
      }
      const snapshot = diagnostics.snapshot()
      const rendererRecord =
        [...snapshot.records]
          .reverse()
          .find(
            (record) =>
              record.kind === 'snapshot' &&
              record.payload.name ===
                'renderer-final',
          )
      const renderer = (
        rendererRecord?.kind === 'snapshot'
      )
        ? rendererSnapshot(
            rendererRecord.payload.data,
          )
        : undefined
      const finalOptions =
        typeof evidence.final === 'object'
          ? evidence.final
          : {}
      if (
        finalOptions.requireRendererSnapshot &&
        renderer === undefined
      ) {
        throw new Error(
          'WinUI Host exited without a final renderer snapshot.',
        )
      }
      if (
        finalOptions.assertIdle !== false &&
        renderer !== undefined
      ) {
        assertRendererInspectionIdle(
          renderer,
          'WinUI Host final renderer',
        )
      }
      writeJsonAtomic(
        fs,
        path,
        paths.final,
        createDiagnosticEvidenceBundle({
          diagnostics: snapshot,
          ...(renderer ? { renderer } : {}),
          ...(monitor
            ? {
                heartbeat: {
                  status: monitor.snapshot(),
                },
              }
            : {}),
          metadata: metadata({ workerExitCode }),
        }),
      )
    },
    dispose() {
      if (disposed) {
        return
      }
      monitor?.dispose()
      disposed = true
    },
  }
}
