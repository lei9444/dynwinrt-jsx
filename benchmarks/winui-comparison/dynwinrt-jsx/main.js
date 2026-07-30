'use strict'

const startupEpochMs = performance.timeOrigin
const hostMilestones = {
  processTimeOrigin: 0,
  mainEntered:
    Date.now() - startupEpochMs,
}
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  defineWinUIHost,
} = require('dynwinrt-jsx/host')
hostMilestones.hostModuleLoaded =
  Date.now() - startupEpochMs

function parseArguments(arguments_) {
  const options = {
    scenario: 'stock-grid',
    percent: 50,
    durationSeconds: 10,
    count: 5000,
    withEdits: false,
    editsPerSecond: 4,
    iterations: 1000,
    reps: 5,
    inspectorMode: 'full',
    cellBindingMode: 'split',
    outputPath: path.join(
      __dirname,
      '.winapp',
      'results',
      'DynWinRTJsx.SignalGrid.metrics.json',
    ),
  }
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]
    if (argument === '--scenario') {
      options.scenario = arguments_[++index]
    }
    else if (argument === '--percent') {
      options.percent = Number(arguments_[++index])
    }
    else if (argument === '--duration') {
      options.durationSeconds = Number(arguments_[++index])
    }
    else if (argument === '--out') {
      options.outputPath = path.resolve(arguments_[++index])
    }
    else if (argument === '--count') {
      options.count = Number(arguments_[++index])
    }
    else if (argument === '--with-edits') {
      options.withEdits = true
    }
    else if (argument === '--edits-per-second') {
      options.editsPerSecond = Number(arguments_[++index])
    }
    else if (argument === '--iterations') {
      options.iterations = Number(arguments_[++index])
    }
    else if (argument === '--reps') {
      options.reps = Number(arguments_[++index])
    }
    else if (argument === '--inspector') {
      options.inspectorMode = arguments_[++index]
    }
    else if (argument === '--cell-binding') {
      options.cellBindingMode = arguments_[++index]
    }
  }
  if (
    !Number.isFinite(options.percent) ||
    options.percent < 0 ||
    options.percent > 100
  ) {
    throw new RangeError('--percent must be between 0 and 100.')
  }
  if (
    !Number.isFinite(options.durationSeconds) ||
    options.durationSeconds <= 0
  ) {
    throw new RangeError('--duration must be positive.')
  }
  if (![
    'stock-grid',
    'keyed-list',
    'virtual-list',
    'micro',
    'startup',
  ].includes(options.scenario)) {
    throw new RangeError(
      '--scenario must be stock-grid, keyed-list, virtual-list, micro, or startup.',
    )
  }
  if (!['full', 'minimal'].includes(
    options.inspectorMode,
  )) {
    throw new RangeError(
      '--inspector must be full or minimal.',
    )
  }
  if (!['split', 'grouped'].includes(
    options.cellBindingMode,
  )) {
    throw new RangeError(
      '--cell-binding must be split or grouped.',
    )
  }
  return options
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporaryPath =
    `${filePath}.${process.pid}.tmp`
  try {
    fs.writeFileSync(
      temporaryPath,
      `${JSON.stringify(value, null, 2)}\n`,
    )
    fs.renameSync(temporaryPath, filePath)
  }
  finally {
    fs.rmSync(temporaryPath, { force: true })
  }
}

const benchmarkOptions = parseArguments(
  process.argv.slice(2),
)
hostMilestones.argumentsParsed =
  Date.now() - startupEpochMs
const statePath = path.join(
  os.tmpdir(),
  `dynwinrt-jsx-perf-${process.pid}.json`,
)
const host = defineWinUIHost({
  rootDirectory: __dirname,
  applicationName: 'dynwinrt-jsx-signal-grid',
  workerPath: path.join(
    __dirname,
    'dist',
    benchmarkOptions.scenario === 'startup'
      ? 'startup-worker.js'
      : benchmarkOptions.scenario === 'micro'
        ? 'micro-worker.js'
        : 'winui-worker.js',
  ),
  state: {
    path: statePath,
    defaultState: () => ({ version: 1 }),
    validate(value) {
      return (
        typeof value === 'object' &&
        value !== null &&
        value.version === 1
      )
    },
    initialize: (loaded) => loaded.state,
    persist: (state) => state,
  },
  workerData: {
    benchmarkOptions: {
      ...benchmarkOptions,
      startupEpochMs,
    },
  },
  onWorkerCreated() {
    hostMilestones.workerCreated =
      Date.now() - startupEpochMs
  },
  onWorkerMessage(message) {
    if (message?.type !== 'benchmark-result') {
      return
    }
    hostMilestones.resultReceived =
      Date.now() - startupEpochMs
    const value = {
      ...message.value,
      hostMilestones: {
        ...hostMilestones,
      },
    }
    writeJsonAtomic(
      benchmarkOptions.outputPath,
      value,
    )
    console.log(
      `DYNWINRT_JSX_PERF_JSON ${JSON.stringify(value)}`,
    )
  },
})
hostMilestones.hostDefined =
  Date.now() - startupEpochMs

hostMilestones.hostRunCalled =
  Date.now() - startupEpochMs
host.run().then(
  (code) => {
    fs.rmSync(statePath, { force: true })
    process.exitCode = code
  },
  (error) => {
    fs.rmSync(statePath, { force: true })
    console.error(error)
    process.exitCode = 1
  },
)
