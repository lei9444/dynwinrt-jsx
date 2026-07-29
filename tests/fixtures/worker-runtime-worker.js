'use strict'

const {
  createWinUIWorkerRuntime,
} = require('../../dist/worker.js')

const runtime = createWinUIWorkerRuntime({
  channel: 'runtime-state',
  moduleId:
    './tests/fixtures/worker-runtime-module.js',
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
        cleanupAttempts,
      },
    })
    return 0
  },
})
