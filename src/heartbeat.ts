import type {
  RendererInspectionSnapshot,
} from './inspector'

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
