'use strict'

const fs = require('node:fs')
const path = require('node:path')
const {
  capabilityAvailable,
  capabilityUnavailable,
  createRendererHeartbeatSharedState,
  createRendererHeartbeatMonitor,
  defineWinUIHost,
  getRendererHeartbeatSharedState,
  rendererHeartbeatSharedStateIndex,
  summarizeRendererHeartbeatTimeout,
} = require('dynwinrt-jsx/host')
const {
  createDefaultPersistedAppState,
  isPersistedAppState,
} = require('./dist/app-state.js')
const {
  parseGalleryLaunchIntent,
} = require('./dist/launch-intent.js')

const launchIntent = parseGalleryLaunchIntent(
  process.argv.slice(2),
)
const appNotificationAumid =
  process.env.DYNWINRT_JSX_GALLERY_APP_NOTIFICATION_AUMID?.trim() || null
const hasActivationForwarding =
  process.env.DYNWINRT_JSX_GALLERY_APP_NOTIFICATION_FORWARDING === '1'
const hostedBySharedNode =
  path.basename(process.execPath).toLowerCase() === 'node.exe'
const appNotificationLauncherAvailable =
  appNotificationAumid !== null &&
  hasActivationForwarding &&
  !hostedBySharedNode
const shellCapabilities = {
  appNotifications: appNotificationLauncherAvailable
    ? capabilityAvailable(appNotificationAumid)
    : capabilityUnavailable(
        hostedBySharedNode
          ? 'App notifications unavailable: unpackaged registration requires an app-specific launcher/AUMID activation path; this Gallery is hosted by shared node.exe.'
          : 'App notifications unavailable: configure an app-specific AUMID and verified activation forwarding before unpackaged registration.',
      ),
}

function readPositiveInteger(name, fallback) {
  const raw = process.env[name]
  if (raw === undefined) {
    return fallback
  }
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`)
  }
  return value
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.tmp`
  try {
    fs.writeFileSync(
      temporaryPath,
      `${JSON.stringify(value, null, 2)}\n`,
    )
    fs.renameSync(temporaryPath, filePath)
  }
  catch (error) {
    fs.rmSync(temporaryPath, { force: true })
    throw error
  }
}

const heartbeatEnabled =
  process.env.DYNWINRT_JSX_HEARTBEAT !== '0'
const heartbeatTimeoutMs = readPositiveInteger(
  'DYNWINRT_JSX_HEARTBEAT_TIMEOUT_MS',
  5_000,
)
const heartbeatStateBuffer =
  createRendererHeartbeatSharedState()
const heartbeatState =
  getRendererHeartbeatSharedState(
    heartbeatStateBuffer,
  )

let heartbeatMonitor = null
let heartbeatEvidencePath
let inspectorExportPath
const host = defineWinUIHost({
  rootDirectory: __dirname,
  state: {
    channel: 'app-state',
    defaultState: createDefaultPersistedAppState,
    validate: isPersistedAppState,
    initialize(loaded) {
      return {
        ...loaded.state,
        ...(launchIntent ?? {}),
        status: 'starting',
        persistenceError: loaded.error,
      }
    },
    persist(state) {
      return {
        version: 1,
        count: state.count,
        darkTheme: state.darkTheme,
        updatedAt: state.updatedAt,
        recentPageIds: state.recentPageIds ?? [],
        favoritePageIds: state.favoritePageIds ?? [],
        route: state.route ?? 'home',
        searchQuery: state.searchQuery ?? '',
      }
    },
    isReady: (state) => state.status === 'running',
    describe(_state, persisted) {
      return {
        count: persisted.count,
        updatedAt: persisted.updatedAt,
      }
    },
  },
  workerData() {
    return {
      heartbeatEnabled,
      heartbeatState: heartbeatStateBuffer,
      inspectorExportPath,
      shellCapabilities,
    }
  },
  onWorkerMessage(message) {
    if (message?.type === 'heartbeat') {
      if (heartbeatMonitor?.receive(message.value)) {
        const status = heartbeatMonitor.snapshot()
        Atomics.store(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.acknowledgedAt,
          BigInt(status.lastReceivedAt),
        )
        Atomics.store(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.acknowledgedSequence,
          BigInt(status.lastSequence),
        )
      }
    }
    else if (message?.type === 'heartbeat-error') {
      console.error(message.message)
    }
    else if (message?.type === 'heartbeat-suspend') {
      heartbeatMonitor?.dispose()
    }
    else if (message?.type === 'inspector-export') {
      try {
        writeJsonAtomic(inspectorExportPath, {
          version: 1,
          type: 'renderer-inspector',
          exportedAt: new Date().toISOString(),
          snapshot: message.value,
        })
        Atomics.store(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.exportStatus,
          1n,
        )
        Atomics.add(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.exportRevision,
          1n,
        )
      }
      catch (error) {
        const exportError =
          error instanceof Error
            ? error.stack ?? error.message
            : String(error)
        console.error(exportError)
        Atomics.store(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.exportStatus,
          -1n,
        )
        Atomics.add(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.exportRevision,
          1n,
        )
      }
    }
  },
})

heartbeatEvidencePath =
  process.env.DYNWINRT_JSX_HEARTBEAT_PATH ??
  path.join(
    path.dirname(host.statePath),
    'heartbeat-timeout.json',
  )
inspectorExportPath =
  process.env.DYNWINRT_JSX_INSPECTOR_EXPORT_PATH ??
  path.join(
    path.dirname(host.statePath),
    'inspector-snapshot.json',
  )
heartbeatMonitor = heartbeatEnabled
  ? createRendererHeartbeatMonitor({
      timeoutMs: heartbeatTimeoutMs,
      schedule(callback, intervalMs) {
        const timer = setInterval(callback, intervalMs)
        timer.unref()
        return () => clearInterval(timer)
      },
      onTimeout(status) {
        const detectedAt = Date.now()
        const summary =
          summarizeRendererHeartbeatTimeout(status)
        Atomics.store(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.timeoutAt,
          BigInt(detectedAt),
        )
        Atomics.store(
          heartbeatState,
          rendererHeartbeatSharedStateIndex.timeoutCount,
          BigInt(status.timeoutCount),
        )
        try {
          writeJsonAtomic(heartbeatEvidencePath, {
            version: 1,
            type: 'heartbeat-timeout',
            detectedAt:
              new Date(detectedAt).toISOString(),
            summary,
            monitor: status,
          })
          const lastOperation = summary.lastOperation
            ? `${summary.lastOperation.kind} ${
                summary.lastOperation.target ?? 'unknown target'
              } ${
                summary.lastOperation.name ??
                summary.lastOperation.property ??
                ''
              }`.trim()
            : 'no recorded operation'
          console.error(
            `WinUI heartbeat timed out on ${
              summary.suspectedComponent ?? 'unknown page'
            }; last operation: ${lastOperation}; evidence saved to ${heartbeatEvidencePath}.`,
          )
        }
        catch (error) {
          console.error(
            `Failed to save heartbeat evidence: ${
              error instanceof Error
                ? error.stack ?? error.message
                : String(error)
            }`,
          )
        }
      },
      onRecovered(status) {
        console.log(
          `WinUI heartbeat recovered at sequence ${status.lastSequence}.`,
        )
      },
    })
  : null

host.run().then(
  (code) => {
    heartbeatMonitor?.dispose()
    process.exitCode = code
  },
  (error) => {
    heartbeatMonitor?.dispose()
    console.error(error)
    process.exitCode = 1
  },
)
