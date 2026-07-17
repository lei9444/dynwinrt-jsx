'use strict'

const fs = require('node:fs')
const path = require('node:path')
const {
  MessageChannel,
  Worker,
} = require('node:worker_threads')
const {
  createMessageTransport,
  createStateBridge,
} = require('dynwinrt-jsx')

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

const { port1, port2 } = new MessageChannel()
const bridge = createStateBridge(
  createMessageTransport(port1),
  {
    role: 'host',
    channel: 'app-state',
    initial: {
      status: 'starting',
      count: 0,
    },
  },
)
const worker = new Worker(
  path.join(__dirname, 'dist', 'winui-worker.js'),
  {
    workerData: { statePort: port2 },
    transferList: [port2],
  },
)

let announcedReady = false
bridge.state.subscribe((state) => {
  if (state.status === 'running' && !announcedReady) {
    announcedReady = true
    console.log('WinUI app is ready.')
  }
})
worker.on('message', (message) => {
  if (message?.type === 'error') {
    console.error(message.message)
    process.exitCode = 1
  }
})
worker.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
worker.on('exit', (code) => {
  bridge.dispose()
  port1.close()
  process.exit(code)
})
