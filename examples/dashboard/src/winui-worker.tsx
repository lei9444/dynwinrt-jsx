import {
  createMessageTransport,
  createStateBridge,
} from 'dynwinrt-jsx/host'
import { roInitialize } from '@microsoft/dynwinrt'
import type { DashboardState } from './dashboard-model'
import {
  applyDashboardStatePatch,
  isDashboardState,
  isDashboardStatePatch,
  type DashboardStatePatch,
} from './dashboard-state'
import {
  runDashboardApplication,
} from './worker/application'
import type {
  DashboardWorkerData,
  DashboardWorkerParentPort,
} from './worker/contracts'

interface NodeRequire {
  (id: string): unknown
}

declare const require: NodeRequire
declare const performance: {
  readonly timeOrigin: number
  now(): number
}
declare const process: {
  exit(code?: number): never
}

const {
  parentPort,
  workerData,
} = require('node:worker_threads') as {
  parentPort: DashboardWorkerParentPort | null
  workerData: DashboardWorkerData
}

if (!parentPort) {
  throw new Error('The WinUI entry point must run in a Worker.')
}

const workerPort = parentPort
const workerStartedAt = performance.now()
const postStartupStage = (
  stage: string,
  details: Record<string, unknown> = {},
) => {
  workerPort.postMessage({
    type: 'startup-stage',
    stage,
    value: {
      processElapsedMs: Math.round(
        (
          performance.timeOrigin +
          performance.now() -
          workerData.startupEpochMs
        ) * 10,
      ) / 10,
      workerElapsedMs: Math.round(
        (performance.now() - workerStartedAt) * 10,
      ) / 10,
      ...details,
    },
  })
}

roInitialize(0)
postStartupStage('ro-initialized')
if (workerData.selfTestFailure === 'worker') {
  throw new Error('Intentional native selftest Worker failure.')
}

const stateBridge = createStateBridge<
  DashboardState,
  DashboardStatePatch
>(
  createMessageTransport(workerData.statePort),
  {
    role: 'client',
    channel: 'dashboard-state',
    initial: workerData.initialState,
    validate: isDashboardState,
    patch: {
      validate: isDashboardStatePatch,
      apply: applyDashboardStatePatch,
    },
  },
)
postStartupStage('bridge-created')

void stateBridge.ready.then(
  () => runDashboardApplication({
    parentPort: workerPort,
    workerData,
    stateBridge,
    postStartupStage,
  }),
).then(
  (exitCode) => {
    stateBridge.dispose()
    workerData.statePort.close()
    process.exit(exitCode)
  },
  (error) => {
    workerPort.postMessage({
      type: 'error',
      message: String(error),
    })
    stateBridge.dispose()
    workerData.statePort.close()
    process.exit(1)
  },
)
