'use strict'

const path = require('node:path')
const {
  capabilityAvailable,
  capabilityUnavailable,
  defineWinUIHost,
} = require('dynwinrt-jsx/host')
const {
  createDefaultPersistedAppState,
  isPersistedAppState,
} = require('./dist/app-state.js')
const {
  parseGalleryLaunchIntent,
} = require('./dist/launch-intent.js')

const launchIntent = parseGalleryLaunchIntent(
  process.argv.slice(2),
)
const appNotificationAumid =
  process.env.DYNWINRT_JSX_GALLERY_APP_NOTIFICATION_AUMID?.trim() || null
const hasActivationForwarding =
  process.env.DYNWINRT_JSX_GALLERY_APP_NOTIFICATION_FORWARDING === '1'
const hostedBySharedNode =
  path.basename(process.execPath).toLowerCase() === 'node.exe'
const appNotificationLauncherAvailable =
  appNotificationAumid !== null &&
  hasActivationForwarding &&
  !hostedBySharedNode
const shellCapabilities = {
  appNotifications: appNotificationLauncherAvailable
    ? capabilityAvailable(appNotificationAumid)
    : capabilityUnavailable(
        hostedBySharedNode
          ? 'App notifications unavailable: unpackaged registration requires an app-specific launcher/AUMID activation path; this Gallery is hosted by shared node.exe.'
          : 'App notifications unavailable: configure an app-specific AUMID and verified activation forwarding before unpackaged registration.',
      ),
}

const host = defineWinUIHost({
  rootDirectory: __dirname,
  state: {
    channel: 'app-state',
    defaultState: createDefaultPersistedAppState,
    validate: isPersistedAppState,
    initialize(loaded) {
      return {
        ...loaded.state,
        ...(launchIntent ?? {}),
        status: 'starting',
        persistenceError: loaded.error,
      }
    },
    persist(state) {
      return {
        version: 1,
        count: state.count,
        darkTheme: state.darkTheme,
        updatedAt: state.updatedAt,
        recentPageIds: state.recentPageIds ?? [],
        favoritePageIds: state.favoritePageIds ?? [],
        route: state.route ?? 'home',
        searchQuery: state.searchQuery ?? '',
      }
    },
    isReady: (state) => state.status === 'running',
    describe(_state, persisted) {
      return {
        count: persisted.count,
        updatedAt: persisted.updatedAt,
      }
    },
  },
  evidence: {
    heartbeat: true,
    inspector: true,
  },
  workerData: {
    shellCapabilities,
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
