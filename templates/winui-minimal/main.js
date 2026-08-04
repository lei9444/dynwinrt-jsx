'use strict'

const {
  defineWinUIHost,
} = require('dynwinrt-jsx/host')
const {
  createDefaultPersistedAppState,
  isAppState,
  isPersistedAppState,
} = require('./dist/app-state.js')

const host = defineWinUIHost({
  rootDirectory: __dirname,
  state: {
    channel: 'app-state',
    defaultState: createDefaultPersistedAppState,
    validate: isPersistedAppState,
    validateState: isAppState,
    initialize(loaded) {
      return {
        ...loaded.state,
        status: 'starting',
        persistenceError: loaded.error,
      }
    },
    persist(state) {
      return {
        version: 1,
        count: state.count,
      }
    },
    isReady: (state) => state.status === 'running',
  },
})

host.run().then(
  (code) => {
    process.exitCode = code
  },
  (error) => {
    console.error(error)
    process.exitCode = 1
  },
)
