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
    '--listEmittedFiles',
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

function emittedJavaScriptFiles(output) {
  const distDirectory = path.join(root, 'dist')
  return [...output.matchAll(/^TSFILE:\s+(.+)$/gm)]
    .map((match) => path.relative(distDirectory, match[1]))
    .filter((filename) =>
      filename.endsWith('.js') &&
      filename !== '..' &&
      !filename.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(filename),
    )
    .map((filename) => filename.split(path.sep).join('/'))
}

function startApp() {
  if (app) return
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
    const changedFiles =
      emittedJavaScriptFiles(compilerOutput)
    compilerOutput = ''
    if (!app) {
      startApp()
    }
    else if (app.connected && changedFiles.length > 0) {
      app.send({
        type: 'hot-build-complete',
        changedFiles,
      })
    }
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
process.on('SIGINT', () => {
  app?.kill('SIGINT')
  stop()
})
process.on('SIGTERM', () => {
  app?.kill('SIGTERM')
  stop()
})
