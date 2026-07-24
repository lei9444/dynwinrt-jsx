import type {
  RendererInspectionSnapshot,
} from '../renderer/inspector'

export interface RendererHeartbeat {
  readonly sequence: number
  readonly sentAt: number
  readonly snapshot: RendererInspectionSnapshot
}

export const rendererHeartbeatSharedStateIndex =
  Object.freeze({
    acknowledgedSequence: 0,
    acknowledgedAt: 1,
    timeoutAt: 2,
    timeoutCount: 3,
    exportStatus: 4,
    exportRevision: 5,
  } as const)

export const rendererHeartbeatSharedStateLength = 6

export function createRendererHeartbeatSharedState():
SharedArrayBuffer {
  return new SharedArrayBuffer(
    BigInt64Array.BYTES_PER_ELEMENT *
      rendererHeartbeatSharedStateLength,
  )
}

export function getRendererHeartbeatSharedState(
  buffer: SharedArrayBuffer,
): BigInt64Array {
  const state = new BigInt64Array(buffer)
  if (state.length <
    rendererHeartbeatSharedStateLength) {
    throw new RangeError(
      `Renderer heartbeat shared state requires ${rendererHeartbeatSharedStateLength} BigInt64 values.`,
    )
  }
  return state
}

export type RendererHeartbeatState =
  | 'waiting'
  | 'healthy'
  | 'timedOut'
  | 'disposed'

export interface RendererHeartbeatMonitorStatus {
  readonly state: RendererHeartbeatState
  readonly timeoutMs: number
  readonly lastSequence: number
  readonly lastReceivedAt: number | null
  readonly timeoutCount: number
  readonly lastHeartbeat: RendererHeartbeat | null
}

export interface RendererHeartbeatTimeoutSummary {
  readonly suspectedComponent: string | null
  readonly lastHeartbeatSequence: number | null
  readonly lastHeartbeatSentAt: number | null
  readonly lastOperation:
    RendererInspectionSnapshot['operations'][number] | null
  readonly hotOperations: readonly {
    readonly kind: string
    readonly target: string | null
    readonly name: string | null
    readonly count: number
  }[]
  readonly recentOperations:
    RendererInspectionSnapshot['operations']
}

export interface RendererHeartbeatMonitorOptions {
  readonly timeoutMs?: number
  readonly checkIntervalMs?: number
  readonly now?: () => number
  readonly schedule?: (
    callback: () => void,
    intervalMs: number,
  ) => () => void
  readonly onTimeout?: (
    status: RendererHeartbeatMonitorStatus,
  ) => void
  readonly onRecovered?: (
    status: RendererHeartbeatMonitorStatus,
  ) => void
}

export interface RendererHeartbeatMonitor {
  readonly disposed: boolean
  receive(heartbeat: RendererHeartbeat): boolean
  check(): RendererHeartbeatMonitorStatus
  snapshot(): RendererHeartbeatMonitorStatus
  dispose(): void
}

export function summarizeRendererHeartbeatTimeout(
  status: RendererHeartbeatMonitorStatus,
): RendererHeartbeatTimeoutSummary {
  const heartbeat = status.lastHeartbeat
  if (!heartbeat) {
    return {
      suspectedComponent: null,
      lastHeartbeatSequence: null,
      lastHeartbeatSentAt: null,
      lastOperation: null,
      hotOperations: [],
      recentOperations: [],
    }
  }

  const snapshot = heartbeat.snapshot
  const suspectedComponent =
    [...snapshot.nodes]
      .reverse()
      .find(
        (node) =>
          node.kind === 'component' &&
          node.label !== 'Page' &&
          node.label.endsWith('Page'),
      )?.label ?? null
  const recentOperations =
    snapshot.operations.slice(-25)
  const lastOperation =
    snapshot.operations.at(-1) ?? null
  const hotWindowStart =
    (lastOperation?.timestamp ?? snapshot.timestamp) - 2_000
  const groups = new Map<
    string,
    {
      kind: string
      target: string | null
      name: string | null
      count: number
    }
  >()
  for (const operation of snapshot.operations) {
    if (operation.timestamp < hotWindowStart) {
      continue
    }
    const name =
      operation.name ?? operation.property ?? null
    const target = operation.target ?? null
    const key =
      `${operation.kind}\u0000${target ?? ''}\u0000${name ?? ''}`
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
    }
    else {
      groups.set(key, {
        kind: operation.kind,
        target,
        name,
        count: 1,
      })
    }
  }

  return {
    suspectedComponent,
    lastHeartbeatSequence: heartbeat.sequence,
    lastHeartbeatSentAt: heartbeat.sentAt,
    lastOperation,
    hotOperations: [...groups.values()]
      .sort((left, right) => right.count - left.count)
      .slice(0, 10),
    recentOperations,
  }
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

export function createRendererHeartbeatMonitor(
  options: RendererHeartbeatMonitorOptions = {},
): RendererHeartbeatMonitor {
  const timeoutMs = requirePositiveInteger(
    options.timeoutMs ?? 5_000,
    'Renderer heartbeat timeoutMs',
  )
  const checkIntervalMs = requirePositiveInteger(
    options.checkIntervalMs ??
      Math.max(100, Math.floor(timeoutMs / 4)),
    'Renderer heartbeat checkIntervalMs',
  )
  const now = options.now ?? Date.now
  const startedAt = now()
  let state: RendererHeartbeatState = 'waiting'
  let lastSequence = 0
  let lastReceivedAt: number | null = null
  let timeoutCount = 0
  let lastHeartbeat: RendererHeartbeat | null = null
  let disposed = false
  let disposeRequested = false

  const snapshot = (): RendererHeartbeatMonitorStatus => ({
    state,
    timeoutMs,
    lastSequence,
    lastReceivedAt,
    timeoutCount,
    lastHeartbeat,
  })

  const check = () => {
    if (
      !disposed &&
      !disposeRequested &&
      state !== 'timedOut' &&
      now() - (lastReceivedAt ?? startedAt) >= timeoutMs
    ) {
      state = 'timedOut'
      timeoutCount += 1
      options.onTimeout?.(snapshot())
    }
    return snapshot()
  }

  const cancelSchedule = options.schedule?.(
    check,
    checkIntervalMs,
  )
  let scheduleCancelled = cancelSchedule === undefined

  return {
    get disposed() {
      return disposed
    },
    receive(heartbeat) {
      if (
        disposed ||
        disposeRequested ||
        !Number.isInteger(heartbeat.sequence) ||
        heartbeat.sequence <= lastSequence
      ) {
        return false
      }
      const recovered = state === 'timedOut'
      lastSequence = heartbeat.sequence
      lastReceivedAt = now()
      lastHeartbeat = heartbeat
      state = 'healthy'
      if (recovered) {
        options.onRecovered?.(snapshot())
      }
      return true
    },
    check,
    snapshot,
    dispose() {
      if (disposed) {
        return
      }
      disposeRequested = true
      state = 'disposed'
      if (!scheduleCancelled) {
        cancelSchedule?.()
        scheduleCancelled = true
      }
      disposed = true
    },
  }
}
