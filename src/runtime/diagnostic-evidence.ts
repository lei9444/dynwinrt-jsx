import type {
  RendererInspectionSnapshot,
} from '../renderer/inspector'
import {
  createRendererOwnershipCounts,
  diagnosticProtocolName,
  diagnosticProtocolVersion,
  isDiagnosticProtocolRecord,
  type DiagnosticProtocolRecord,
  type RendererOwnershipCounts,
} from './diagnostics'
import type {
  RendererHeartbeatMonitorStatus,
  RendererHeartbeatTimeoutSummary,
} from './heartbeat'

export const diagnosticEvidenceProtocolName =
  'dynwinrt-jsx.evidence' as const
export const diagnosticEvidenceProtocolVersion = 1 as const

export interface DiagnosticBufferOptions {
  readonly maxRecords?: number
  readonly now?: () => Date
}

export interface DiagnosticBufferSnapshot {
  readonly protocol: typeof diagnosticProtocolName
  readonly version: typeof diagnosticProtocolVersion
  readonly capturedAt: string
  readonly maxRecords: number
  readonly droppedRecords: number
  readonly records: readonly DiagnosticProtocolRecord[]
}

export interface DiagnosticBuffer {
  readonly maxRecords: number
  readonly size: number
  readonly droppedRecords: number
  append(record: DiagnosticProtocolRecord): void
  snapshot(): DiagnosticBufferSnapshot
  clear(): void
  subscribe(
    listener: (record: DiagnosticProtocolRecord) => void,
  ): () => void
}

export interface DiagnosticProtocolRecordSummary {
  readonly protocol: typeof diagnosticProtocolName
  readonly version: typeof diagnosticProtocolVersion
  readonly sequence: number
  readonly timestamp: string
  readonly source: string
  readonly kind: DiagnosticProtocolRecord['kind']
  readonly level: DiagnosticProtocolRecord['level']
  readonly summary: unknown
}

export interface RendererInspectionIdleSummary {
  readonly idle: boolean
  readonly counts: RendererOwnershipCounts
}

export interface DiagnosticRouteSmokeResult {
  readonly routeId: string
  readonly path?: string
  readonly status: 'passed' | 'failed' | 'skipped'
  readonly durationMs: number
  readonly errorName?: string
  readonly evidence?: Readonly<Record<string, unknown>>
}

export interface DiagnosticHeartbeatEvidence {
  readonly status: RendererHeartbeatMonitorStatus
  readonly timeoutSummary?: RendererHeartbeatTimeoutSummary
}

export interface DiagnosticEvidenceBundleOptions {
  readonly diagnostics: DiagnosticBufferSnapshot
  readonly renderer?: RendererInspectionSnapshot
  readonly heartbeat?: DiagnosticHeartbeatEvidence
  readonly routes?: readonly DiagnosticRouteSmokeResult[]
  readonly metadata?: Readonly<Record<string, unknown>>
  readonly now?: () => Date
}

export interface DiagnosticEvidenceBundle {
  readonly protocol: typeof diagnosticEvidenceProtocolName
  readonly version: typeof diagnosticEvidenceProtocolVersion
  readonly generatedAt: string
  readonly diagnostics: DiagnosticBufferSnapshot
  readonly renderer?: RendererInspectionSnapshot
  readonly rendererIdle?: RendererInspectionIdleSummary
  readonly heartbeat?: DiagnosticHeartbeatEvidence
  readonly routes?: readonly DiagnosticRouteSmokeResult[]
  readonly metadata?: Readonly<Record<string, unknown>>
}

function requirePositiveInteger(
  value: number,
  label: string,
): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(
      `${label} must be a positive integer.`,
    )
  }
  return value
}

function timestamp(now: () => Date, label: string): string {
  const value = now()
  if (
    !(value instanceof Date) ||
    Number.isNaN(value.getTime())
  ) {
    throw new TypeError(
      `${label} must return a valid Date.`,
    )
  }
  return value.toISOString()
}

export function createDiagnosticBuffer(
  options: DiagnosticBufferOptions = {},
): DiagnosticBuffer {
  const maxRecords = requirePositiveInteger(
    options.maxRecords ?? 500,
    'Diagnostic buffer maxRecords',
  )
  const now = options.now ?? (() => new Date())
  const records: DiagnosticProtocolRecord[] = []
  const listeners =
    new Set<(record: DiagnosticProtocolRecord) => void>()
  let droppedRecords = 0

  return {
    maxRecords,
    get size() {
      return records.length
    },
    get droppedRecords() {
      return droppedRecords
    },
    append(record) {
      if (!isDiagnosticProtocolRecord(record)) {
        throw new TypeError(
          'Diagnostic buffer accepts only valid protocol records.',
        )
      }
      if (records.length === maxRecords) {
        records.shift()
        droppedRecords += 1
      }
      records.push(record)
      let firstError: unknown
      for (const listener of [...listeners]) {
        try {
          listener(record)
        }
        catch (error) {
          firstError ??= error
        }
      }
      if (firstError !== undefined) {
        throw firstError
      }
    },
    snapshot() {
      return {
        protocol: diagnosticProtocolName,
        version: diagnosticProtocolVersion,
        capturedAt: timestamp(
          now,
          'Diagnostic buffer now()',
        ),
        maxRecords,
        droppedRecords,
        records: [...records],
      }
    },
    clear() {
      records.length = 0
      droppedRecords = 0
    },
    subscribe(listener) {
      if (typeof listener !== 'function') {
        throw new TypeError(
          'Diagnostic buffer listener must be a function.',
        )
      }
      listeners.add(listener)
      let active = true
      return () => {
        if (!active) {
          return
        }
        active = false
        listeners.delete(listener)
      }
    },
  }
}

export function summarizeDiagnosticProtocolRecord(
  record: DiagnosticProtocolRecord,
): DiagnosticProtocolRecordSummary {
  let summary: unknown
  if (record.kind === 'snapshot') {
    summary = {
      name: record.payload.name,
    }
  }
  else if (record.kind === 'ownership') {
    summary = {
      owner: record.payload.owner,
      resource: record.payload.resource,
      ownership: record.payload.ownership,
      action: record.payload.action,
      activeCount: record.payload.activeCount,
    }
  }
  else {
    summary = record.payload
  }
  return {
    protocol: record.protocol,
    version: record.version,
    sequence: record.sequence,
    timestamp: record.timestamp,
    source: record.source,
    kind: record.kind,
    level: record.level,
    summary,
  }
}

export function formatDiagnosticProtocolRecordSummary(
  record: DiagnosticProtocolRecord,
): string {
  return JSON.stringify(
    summarizeDiagnosticProtocolRecord(record),
  )
}

export function summarizeRendererInspectionIdle(
  snapshot: RendererInspectionSnapshot,
): RendererInspectionIdleSummary {
  const counts = createRendererOwnershipCounts(snapshot)
  return {
    idle: (
      counts.activeNative === 0 &&
      counts.activeComponents === 0 &&
      counts.inspectionNodes === 0 &&
      counts.reactiveScopes === 0 &&
      counts.reactiveObservers === 0 &&
      counts.reactiveDependencies === 0 &&
      counts.subscriptions === 0 &&
      counts.cleanupFailedSubscriptions === 0
    ),
    counts,
  }
}

export function hasActiveRendererInspection(
  snapshot: RendererInspectionSnapshot,
): boolean {
  return !summarizeRendererInspectionIdle(snapshot).idle
}

export function assertRendererInspectionIdle(
  snapshot: RendererInspectionSnapshot,
  label = 'Renderer inspection',
): void {
  const summary = summarizeRendererInspectionIdle(snapshot)
  if (!summary.idle) {
    throw new Error(
      `${label} is not idle: ${JSON.stringify(summary)}`,
    )
  }
}

export function createDiagnosticEvidenceBundle(
  options: DiagnosticEvidenceBundleOptions,
): DiagnosticEvidenceBundle {
  if (
    typeof options !== 'object' ||
    options === null
  ) {
    throw new TypeError(
      'Diagnostic evidence options must be an object.',
    )
  }
  if (
    options.diagnostics.protocol !==
      diagnosticProtocolName ||
    options.diagnostics.version !==
      diagnosticProtocolVersion
  ) {
    throw new TypeError(
      'Diagnostic evidence requires a diagnostic buffer snapshot.',
    )
  }
  const now = options.now ?? (() => new Date())
  return {
    protocol: diagnosticEvidenceProtocolName,
    version: diagnosticEvidenceProtocolVersion,
    generatedAt: timestamp(
      now,
      'Diagnostic evidence now()',
    ),
    diagnostics: options.diagnostics,
    ...(options.renderer
      ? {
          renderer: options.renderer,
          rendererIdle:
            summarizeRendererInspectionIdle(
              options.renderer,
            ),
        }
      : {}),
    ...(options.heartbeat
      ? { heartbeat: options.heartbeat }
      : {}),
    ...(options.routes
      ? { routes: [...options.routes] }
      : {}),
    ...(options.metadata
      ? { metadata: options.metadata }
      : {}),
  }
}

export function formatDiagnosticEvidenceBundle(
  evidence: DiagnosticEvidenceBundle,
): string {
  return JSON.stringify(evidence)
}
