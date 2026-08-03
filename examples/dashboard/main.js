'use strict'

const startupCandidate = Number(
  process.env.DYNWINRT_JSX_STARTUP_STARTED_AT,
)
const startupStartedAt = Number.isFinite(startupCandidate)
  ? startupCandidate
  : performance.now()
const startupEpochMs = performance.timeOrigin + startupStartedAt

function recordStartup(event, details = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    source: 'dashboard-startup',
    event,
    level: 'info',
    details: {
      elapsedMs: Math.round(
        (performance.now() - startupStartedAt) * 10,
      ) / 10,
      ...details,
    },
  }))
}

recordStartup('main.entered')

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  MessageChannel,
  Worker,
} = require('node:worker_threads')
const hostApiStartedAt = performance.now()
const {
  createMessageTransport,
  createStateBridge,
  assertRendererInspectionIdle,
  createDiagnosticBuffer,
  createDiagnosticEvidenceBundle,
  createDiagnosticRecord,
  createJsonStateStore,
  createRendererHeartbeatMonitor,
  createRendererHeartbeatSharedState,
  diagnosticEvidenceProtocolName,
  formatDiagnosticRecord,
  formatDiagnosticProtocolRecordSummary,
  getRendererHeartbeatSharedState,
  isDiagnosticProtocolRecord,
  rendererHeartbeatSharedStateIndex,
  summarizeRendererHeartbeatTimeout,
} = require('dynwinrt-jsx/host')
recordStartup('host-api.loaded', {
  durationMs: Math.round(
    (performance.now() - hostApiStartedAt) * 10,
  ) / 10,
})
const {
  applyDashboardStatePatch,
  createDefaultPersistedDashboardState,
  isDashboardStatePatch,
  isDashboardState,
  isPersistedDashboardState,
} = require('./dist/dashboard-state.js')

const architecture = {
  arm64: 'arm64',
  x64: 'x64',
}[process.arch]

if (!architecture) {
  throw new Error(`Unsupported Node.js architecture: ${process.arch}`)
}

if (process.env.DYNWINRT_JSX_PACKAGED !== '1') {
  const bootstrapDll =
    process.env.WINAPPSDK_BOOTSTRAP_DLL_PATH ??
    path.join(
      __dirname,
      '.winapp',
      'bin',
      architecture,
      'Microsoft.WindowsAppRuntime.Bootstrap.dll',
    )

  if (!fs.existsSync(bootstrapDll)) {
    throw new Error(
      `Windows App SDK bootstrap DLL was not found at ${bootstrapDll}. Run npm run setup first.`,
    )
  }

  process.env.WINAPPSDK_BOOTSTRAP_DLL_PATH = bootstrapDll

  const { initWinappsdk } = require('@microsoft/dynwinrt')
  initWinappsdk(2, 2)
}

const statePath =
  process.env.DYNWINRT_JSX_STATE_PATH ??
  path.join(
    process.env.LOCALAPPDATA ?? os.homedir(),
    'dynwinrt-jsx',
    'dashboard-state.json',
  )
const diagnosticsExportPath =
  process.env.DYNWINRT_JSX_DIAGNOSTICS_PATH ??
  path.join(
    path.dirname(statePath),
    'diagnostics-evidence.json',
  )
const heartbeatEvidencePath =
  process.env.DYNWINRT_JSX_HEARTBEAT_PATH ??
  path.join(
    path.dirname(statePath),
    'heartbeat-timeout.json',
  )
const finalEvidencePath =
  process.env.DYNWINRT_JSX_FINAL_EVIDENCE_PATH ??
  path.join(
    path.dirname(statePath),
    'final-evidence.json',
  )
const heartbeatEnabled =
  process.env.DYNWINRT_JSX_HEARTBEAT !== '0'
const heartbeatTimeoutCandidate = Number(
  process.env.DYNWINRT_JSX_HEARTBEAT_TIMEOUT_MS,
)
const heartbeatTimeoutMs =
  Number.isInteger(heartbeatTimeoutCandidate) &&
  heartbeatTimeoutCandidate >= 1_000
    ? heartbeatTimeoutCandidate
    : 5_000

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true,
  })
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
    fs.rmSync(temporaryPath, {
      force: true,
    })
  }
}

const stateStore = createJsonStateStore({
  path: statePath,
  defaultState: createDefaultPersistedDashboardState,
  validate: isPersistedDashboardState,
})
const stateLoadStartedAt = performance.now()
const loadedState = stateStore.load()
recordStartup('state.loaded', {
  durationMs: Math.round(
    (performance.now() - stateLoadStartedAt) * 10,
  ) / 10,
  recovered: loadedState.error !== null,
})
const initialState = {
  ...loadedState.state,
  status: 'starting',
  persistenceError: loadedState.error,
}
if (loadedState.error) {
  console.warn(formatDiagnosticRecord(createDiagnosticRecord(
    'dashboard-host',
    'state.recovered',
    {
      path: statePath,
      error: loadedState.error,
      corruptPath: loadedState.corruptPath,
    },
    'warning',
  )))
}

const { port1, port2 } = new MessageChannel()
const diagnosticBuffer = createDiagnosticBuffer({
  maxRecords: 1_000,
})
const heartbeatStateBuffer =
  createRendererHeartbeatSharedState()
const heartbeatState =
  getRendererHeartbeatSharedState(
    heartbeatStateBuffer,
  )
const stateBridge = createStateBridge(
  createMessageTransport(port1),
  {
    role: 'host',
    channel: 'dashboard-state',
    initial: initialState,
    validate: isDashboardState,
    patch: {
      validate: isDashboardStatePatch,
      apply: applyDashboardStatePatch,
    },
  },
)
recordStartup('bridge.created')
const hotEnabled = process.env.DYNWINRT_JSX_HOT === '1'
const selfTestEnabled = process.env.DYNWINRT_JSX_SELFTEST === '1'
const selfTestFailure =
  process.env.DYNWINRT_JSX_SELFTEST_FAILURE ?? null
const hotStatePath = path.join(
  os.tmpdir(),
  `dynwinrt-jsx-hot-${process.pid}.json`,
)
if (hotEnabled) {
  fs.writeFileSync(
    hotStatePath,
    JSON.stringify({ type: 'ready', version: 0 }),
  )
}
const workerCreationStartedAt = performance.now()
const worker = new Worker(
  path.join(__dirname, 'dist', 'winui-worker.js'),
  {
    workerData: {
      statePort: port2,
      hotStatePath: hotEnabled ? hotStatePath : null,
      heartbeatEnabled,
      heartbeatState: heartbeatStateBuffer,
      diagnosticsExportPath,
      initialState,
      selfTest: selfTestEnabled,
      selfTestFailure,
      startupEpochMs,
    },
    transferList: [port2],
  },
)
const heartbeatMonitor = heartbeatEnabled
  ? createRendererHeartbeatMonitor({
      timeoutMs: heartbeatTimeoutMs,
      schedule(callback, intervalMs) {
        const timer = setInterval(callback, intervalMs)
        timer.unref()
        return () => clearInterval(timer)
      },
      onTimeout(status) {
        const detectedAt = Date.now()
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
        const timeoutSummary =
          summarizeRendererHeartbeatTimeout(status)
        try {
          writeJsonAtomic(
            heartbeatEvidencePath,
            createDiagnosticEvidenceBundle({
              diagnostics: diagnosticBuffer.snapshot(),
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
              metadata: {
                processId: process.pid,
                workerThreadId: worker.threadId,
                detectedAt,
              },
            }),
          )
          console.error(
            `Dashboard UI heartbeat timed out; evidence: ${heartbeatEvidencePath}`,
          )
        }
        catch (error) {
          console.error(error)
          process.exitCode = 1
        }
      },
      onRecovered(status) {
        console.log(
          `Dashboard UI heartbeat recovered at sequence ${status.lastSequence}.`,
        )
      },
    })
  : undefined
recordStartup('worker.created', {
  durationMs: Math.round(
    (performance.now() - workerCreationStartedAt) * 10,
  ) / 10,
})
const hotWatchedFiles = []
let hotVersion = 0

function postHotMessage(type, value = {}) {
  hotVersion += 1
  const message = {
    type,
    version: hotVersion,
    ...value,
  }
  const temporaryPath = `${hotStatePath}.tmp`
  fs.writeFileSync(temporaryPath, JSON.stringify(message))
  fs.renameSync(temporaryPath, hotStatePath)
}

if (hotEnabled) {
  const distDirectory = path.join(__dirname, 'dist')
  const watchHotFile = (filename, callback) => {
    const filePath = path.join(distDirectory, filename)
    hotWatchedFiles.push(filePath)
    fs.watchFile(filePath, { interval: 100 }, (current, previous) => {
      if (current.mtimeMs === previous.mtimeMs) {
        return
      }
      callback(filename)
    })
  }
  watchHotFile('dashboard-app.js', (filename) => {
    postHotMessage('hot-reload', {
      changedFiles: [filename],
    })
  })
  for (const boundary of ['winui-worker.js', 'dashboard-model.js']) {
    watchHotFile(boundary, (filename) => {
      console.log(
        `Hot reload boundary changed (${filename}); restart the Worker.`,
      )
    })
  }
  process.on('message', (message) => {
    if (message?.type === 'hot-build-error') {
      postHotMessage('hot-build-error', {
        message: message.message,
      })
    }
  })
  console.log('dynwinrt-jsx dashboard hot reload is active.')
}

let announcedReady = false
let persistedFingerprint = JSON.stringify(loadedState.state)
stateBridge.state.subscribe((state) => {
  if (state.status === 'running' && !announcedReady) {
    announcedReady = true
    console.log('dynwinrt-jsx dashboard is ready.')
    console.log(formatDiagnosticRecord(createDiagnosticRecord(
      'dashboard-host',
      'application.ready',
      {
        taskCount: state.tasks.length,
        statePath,
      },
    )))
  }
  const persistedState = {
    version: 1,
    tasks: state.tasks,
    nextTaskId: state.nextTaskId,
    darkTheme: state.darkTheme,
    updatedAt: state.updatedAt,
  }
  const fingerprint = JSON.stringify(persistedState)
  if (fingerprint === persistedFingerprint) {
    return
  }
  try {
    stateStore.save(persistedState)
    persistedFingerprint = fingerprint
    console.log(formatDiagnosticRecord(createDiagnosticRecord(
      'dashboard-host',
      'state.saved',
      {
        path: statePath,
        taskCount: persistedState.tasks.length,
        updatedAt: persistedState.updatedAt,
      },
    )))
  } catch (error) {
    console.error(formatDiagnosticRecord(createDiagnosticRecord(
      'dashboard-host',
      'state.save-error',
      {
        path: statePath,
        message: error instanceof Error ? error.stack ?? error.message : String(error),
      },
      'error',
    )))
  }
})

worker.on('message', (message) => {
  if (message?.type === 'diagnostic') {
    if (!isDiagnosticProtocolRecord(message.value)) {
      console.error('Dashboard Worker sent an invalid diagnostic record.')
      process.exitCode = 1
      return
    }
    diagnosticBuffer.append(message.value)
    console.log(
      formatDiagnosticProtocolRecordSummary(message.value),
    )
  } else if (message?.type === 'error') {
    console.error(message.message)
    console.error(formatDiagnosticRecord(createDiagnosticRecord(
      'dashboard-worker',
      'worker.error',
      { message: message.message },
      'error',
    )))
    process.exitCode = 1
  } else if (message?.type === 'diagnostics') {
    console.log(
      `dynwinrt-jsx renderer disposed cleanly: ${JSON.stringify(message.value)}`,
    )
    console.log(formatDiagnosticRecord(createDiagnosticRecord(
      'dashboard-worker',
      'renderer.disposed',
      message.value,
    )))
  } else if (message?.type === 'hot-reload') {
    console.log(
      `dynwinrt-jsx hot reload ${message.status} (version ${message.version}).`,
    )
    console.log(formatDiagnosticRecord(createDiagnosticRecord(
      'dashboard-worker',
      `hot-reload.${message.status}`,
      {
        version: message.version,
        message: message.message ?? null,
      },
      message.status === 'error' ? 'error' : 'info',
    )))
    if (message.message) {
      console.error(message.message)
    }
  } else if (message?.type === 'native-selftest') {
    console.log(
      `DYNWINRT_JSX_NATIVE_SELFTEST ${JSON.stringify(message.value)}`,
    )
    if (!message.value?.passed) {
      process.exitCode = 1
    }
  } else if (message?.type === 'state-initialized') {
    console.log(formatDiagnosticRecord(createDiagnosticRecord(
      'dashboard-worker',
      'state.initialized',
      message.value,
    )))
  } else if (message?.type === 'startup-stage') {
    console.log(formatDiagnosticRecord(createDiagnosticRecord(
      'dashboard-worker',
      `startup.${message.stage}`,
      message.value ?? {},
    )))
  } else if (message?.type === 'heartbeat') {
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
  } else if (message?.type === 'heartbeat-error') {
    console.error(message.message)
    process.exitCode = 1
  } else if (message?.type === 'heartbeat-suspend') {
    heartbeatMonitor?.dispose()
  } else if (message?.type === 'diagnostics-export') {
    try {
      if (
        message.value?.protocol !==
          diagnosticEvidenceProtocolName
      ) {
        throw new Error(
          'Dashboard Worker sent invalid diagnostic evidence.',
        )
      }
      writeJsonAtomic(
        diagnosticsExportPath,
        message.value,
      )
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
      console.log(
        `Dashboard diagnostics exported: ${diagnosticsExportPath}`,
      )
    }
    catch (error) {
      console.error(error)
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
      process.exitCode = 1
    }
  }
})

worker.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})

worker.on('exit', (code) => {
  for (const filePath of hotWatchedFiles) {
    fs.unwatchFile(filePath)
  }
  stateBridge.dispose()
  port1.close()
  heartbeatMonitor?.dispose()
  if (hotEnabled) {
    fs.rmSync(hotStatePath, { force: true })
  }
  let finalCode = code !== 0
    ? code
    : Number(process.exitCode ?? 0)
  try {
    const diagnostics = diagnosticBuffer.snapshot()
    const finalSnapshotRecord =
      [...diagnostics.records]
        .reverse()
        .find(
          (record) =>
            record.kind === 'snapshot' &&
            record.payload.name === 'renderer-final',
        )
    const renderer = finalSnapshotRecord?.payload.data
    if (code === 0 && !renderer) {
      throw new Error(
        'Dashboard exited without a final renderer snapshot.',
      )
    }
    if (renderer) {
      assertRendererInspectionIdle(
        renderer,
        'Dashboard final renderer',
      )
    }
    writeJsonAtomic(
      finalEvidencePath,
      createDiagnosticEvidenceBundle({
        diagnostics,
        ...(renderer ? { renderer } : {}),
        ...(heartbeatMonitor
          ? {
              heartbeat: {
                status: heartbeatMonitor.snapshot(),
              },
            }
          : {}),
        metadata: {
          processId: process.pid,
          workerExitCode: code,
        },
      }),
    )
  }
  catch (error) {
    console.error(error)
    finalCode = 1
  }
  process.exit(finalCode)
})
