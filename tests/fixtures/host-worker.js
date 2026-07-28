'use strict'

const {
  parentPort,
  workerData,
} = require('node:worker_threads')

const statePort = workerData.statePort
let updated = false

statePort.on('message', (message) => {
  if (
    message?.protocol !== 'dynwinrt-jsx.state.v1' ||
    message?.type !== 'state'
  ) {
    return
  }
  if (!updated) {
    updated = true
    statePort.postMessage({
      protocol: message.protocol,
      channel: message.channel,
      type: 'set',
      value: {
        ...message.value,
        status: 'running',
        count: message.value.count + 1,
      },
    })
    return
  }
  if (
    message.value?.status === 'running' &&
    message.value?.count === 4
  ) {
    parentPort.postMessage({
      type: 'diagnostics',
      value: {
        native: 0,
        components: 0,
      },
    })
    statePort.close()
    parentPort.close()
  }
})
