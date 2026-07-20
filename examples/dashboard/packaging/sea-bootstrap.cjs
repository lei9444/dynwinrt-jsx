'use strict'

const fs = require('node:fs')
const path = require('node:path')
const util = require('node:util')
const { createRequire } = require('node:module')

const root = path.dirname(process.execPath)
const mainPath = path.join(root, 'main.js')
const logPath = path.join(
  process.env.LOCALAPPDATA ?? root,
  'dynwinrt-jsx',
  'sea-host.log',
)

function appendLog(level, values) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.appendFileSync(
    logPath,
    `${new Date().toISOString()} ${level} ${util.format(...values)}\n`,
  )
}

for (const level of ['error', 'warn']) {
  const original = console[level].bind(console)
  console[level] = (...values) => {
    appendLog(level, values)
    original(...values)
  }
}

process.on('uncaughtExceptionMonitor', (error) => {
  appendLog('uncaught', [error.stack ?? error.message])
})

process.chdir(root)
process.env.DYNWINRT_JSX_PACKAGED = '1'

try {
  createRequire(mainPath)(mainPath)
} catch (error) {
  appendLog('startup', [
    error instanceof Error ? error.stack ?? error.message : String(error),
  ])
  process.exitCode = 1
}
