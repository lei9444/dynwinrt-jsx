'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  MessageChannel,
  Worker,
} = require('node:worker_threads')
const {
  createMessageTransport,
  createStateBridge,
  createDiagnosticRecord,
  createJsonStateStore,
  formatDiagnosticRecord,
} = require('dynwinrt-jsx')
const {
  createDefaultPersistedDashboardState,
  isPersistedDashboardState,
} = require('./dist/dashboard-state.js')

const architecture = {
  arm64: 'arm64',
  x64: 'x64',
}[process.arch]

if (!architecture) {
  throw new Error(`Unsupported Node.js architecture: ${process.arch}`)
}

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

const statePath =
  process.env.DYNWINRT_JSX_STATE_PATH ??
  path.join(
    process.env.LOCALAPPDATA ?? os.homedir(),
    'dynwinrt-jsx',
    'dashboard-state.json',
  )
const stateStore = createJsonStateStore({
  path: statePath,
  defaultState: createDefaultPersistedDashboardState,
  validate: isPersistedDashboardState,
})
const loadedState = stateStore.load()
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
const stateBridge = createStateBridge(
  createMessageTransport(port1),
  {
    role: 'host',
    channel: 'dashboard-state',
    initial: initialState,
  },
)
const hotEnabled = process.env.DYNWINRT_JSX_HOT === '1'
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
const worker = new Worker(
  path.join(__dirname, 'dist', 'winui-worker.js'),
  {
    workerData: {
      statePort: port2,
      hotStatePath: hotEnabled ? hotStatePath : null,
      initialState,
    },
    transferList: [port2],
  },
)
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
  if (message?.type === 'error') {
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
    )))
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
  if (hotEnabled) {
    fs.rmSync(hotStatePath, { force: true })
  }
  process.exit(code)
})
