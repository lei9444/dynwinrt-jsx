'use strict'

const {
  parentPort,
  workerData,
} = require('node:worker_threads')

const statePort = workerData.statePort
let updated = false
const inspection = {
  timestamp: Date.now(),
  diagnostics: {
    nativeCreated: 0,
    nativeDisposed: 0,
    activeNative: 0,
    componentsMounted: 0,
    componentsDisposed: 0,
    activeComponents: 0,
    listEntriesCreated: 0,
    listEntriesReused: 0,
  },
  nodes: [],
  reactive: {
    scopes: [],
    observers: [],
    dependencies: [],
  },
  subscriptions: [],
  operations: [],
}

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
    if (workerData.heartbeatEnabled) {
      parentPort.postMessage({
        type: 'heartbeat',
        value: {
          sequence: 1,
          sentAt: Date.now(),
          snapshot: inspection,
        },
      })
    }
    if (workerData.inspectorExportPath) {
      parentPort.postMessage({
        type: 'inspector-export',
        value: inspection,
      })
    }
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
