'use strict'

const path = require('node:path')
const {
  fork,
  spawn,
} = require('node:child_process')

const root = __dirname
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')
const watcher = spawn(
  process.execPath,
  [
    tsc,
    '-p',
    path.join(root, 'tsconfig.json'),
    '--watch',
    '--preserveWatchOutput',
    '--pretty',
    'false',
  ],
  {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
  },
)

let app
let compilerOutput = ''

function startApp() {
  if (app) {
    return
  }
  app = fork(path.join(root, 'main.js'), {
    cwd: root,
    env: {
      ...process.env,
      DYNWINRT_JSX_HOT: '1',
    },
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  })
  app.on('exit', (code) => {
    watcher.kill()
    process.exit(code ?? 0)
  })
}

watcher.stdout.setEncoding('utf8')
watcher.stdout.on('data', (chunk) => {
  process.stdout.write(chunk)
  compilerOutput += chunk
  if (compilerOutput.includes('Found 0 errors. Watching for file changes.')) {
    compilerOutput = ''
    startApp()
    return
  }
  if (/Found [1-9][0-9]* errors?\. Watching for file changes\./.test(
    compilerOutput,
  )) {
    app?.send({
      type: 'hot-build-error',
      message: compilerOutput.trim(),
    })
    compilerOutput = ''
  }
})

function stop() {
  watcher.kill()
  if (app?.connected) {
    app.disconnect()
  }
}
watcher.on('exit', (code) => {
  if (code && app?.connected) {
    app.send({
      type: 'hot-build-error',
      message: `TypeScript watcher exited with code ${code}.`,
    })
  }
})
process.on('SIGINT', () => {
  app?.kill('SIGINT')
  stop()
})
process.on('SIGTERM', () => {
  app?.kill('SIGTERM')
  stop()
})
