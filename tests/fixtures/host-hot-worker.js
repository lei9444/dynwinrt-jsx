'use strict'

const fs = require('node:fs')
const {
  parentPort,
  workerData,
} = require('node:worker_threads')

const statePort = workerData.statePort
const timeout = setTimeout(() => {
  parentPort.postMessage({
    type: 'hot-reload-probe-timeout',
  })
  statePort.close()
  parentPort.close()
}, 5_000)
const interval = setInterval(() => {
  if (!fs.existsSync(workerData.hotStatePath)) {
    return
  }
  const message = JSON.parse(
    fs.readFileSync(workerData.hotStatePath, 'utf8'),
  )
  if (message.type !== 'hot-reload') {
    return
  }
  clearInterval(interval)
  clearTimeout(timeout)
  parentPort.postMessage({
    type: 'hot-reload-probe',
    value: message,
  })
  statePort.close()
  parentPort.close()
}, 10)
