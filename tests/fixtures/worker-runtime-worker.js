'use strict'

const fs = require('node:fs')
const {
  workerData,
} = require('node:worker_threads')
const {
  createWinUIWorkerRuntime,
} = require('../../dist/worker.js')

const runtime = createWinUIWorkerRuntime({
  channel: 'runtime-state',
  moduleId:
    workerData.runtimeModuleId ??
    './tests/fixtures/worker-runtime-module.js',
  validateState(value) {
    return (
      typeof value === 'object' &&
      value !== null &&
      value.version === 1 &&
      Number.isInteger(value.count) &&
      typeof value.status === 'string'
    )
  },
})

void runtime.run({
  async run() {
    await runtime.bridge.ready
    const acknowledged = new Promise((resolve) => {
      const unsubscribe =
        runtime.bridge.revision.subscribe((revision) => {
          if (revision > 0) {
            unsubscribe()
            resolve()
          }
        })
    })
    runtime.bridge.update((state) => ({
      ...state,
      status: 'running',
      count: state.count + 1,
    }))
    await acknowledged
    const loaded = runtime.loadModule()
    let reloaded
    if (workerData.runtimeReloadProbe) {
      fs.writeFileSync(
        workerData.runtimeReloadProbe.childPath,
        workerData.runtimeReloadProbe.source,
      )
      reloaded = runtime.loadModule(true)
    }
    let cleanupAttempts = 0
    const hooks = runtime.createRenderedHooks({
      dispatcherQueue: {
        createTimer() {
          throw new Error('Timer should not be created.')
        },
      },
      renderer: {},
      renderHandle: {},
      load: () => null,
      beforeDispose() {
        cleanupAttempts += 1
        if (cleanupAttempts === 1) {
          throw new Error('retry cleanup')
        }
      },
    })
    try {
      hooks.disposeBeforeRender()
      return 1
    }
    catch (error) {
      if (!String(error).includes('retry cleanup')) {
        return 1
      }
    }
    hooks.disposeBeforeRender()
    runtime.postMessage({
      type: 'runtime-test',
      value: {
        module: loaded.value,
        reloadedModule: reloaded?.value,
        cleanupAttempts,
      },
    })
    return 0
  },
})
