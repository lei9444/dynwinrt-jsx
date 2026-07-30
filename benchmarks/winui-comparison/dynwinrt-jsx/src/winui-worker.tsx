import {
  createWinUIWorkerRuntime,
  defineWinUIApp,
} from 'dynwinrt-jsx/worker'
import { roInitialize } from '@microsoft/dynwinrt'
import * as WinUIBindings from '#winapp/bindings'
import {
  AppWindowPresenterKind,
} from '#winapp/bindings'
import {
  renderBenchmark,
  type BenchmarkController,
  type BenchmarkOptions,
} from './app'
import { renderKeyedBenchmark } from './keyed-app'
import { renderVirtualBenchmark } from './virtual-app'

interface BenchmarkState {
  readonly version: 1
}

declare const process: {
  memoryUsage(): {
    readonly rss: number
    readonly heapTotal: number
    readonly heapUsed: number
    readonly external: number
    readonly arrayBuffers: number
  }
}

const moduleEnteredAt = Date.now()
const baselineMemory = process.memoryUsage()
const runtime = createWinUIWorkerRuntime<
  BenchmarkState,
  {
    readonly benchmarkOptions: BenchmarkOptions
  }
>({
  moduleId: './dist/app.js',
})
const startupEpochMs =
  runtime.workerData.benchmarkOptions.startupEpochMs
const startupMilestones: Record<string, number> = {
  moduleEntered: moduleEnteredAt - startupEpochMs,
  runtimeCreated: Date.now() - startupEpochMs,
}
const markStartup = (name: string) => {
  startupMilestones[name] ??=
    Date.now() - startupEpochMs
}
const app = defineWinUIApp({
  bindings: WinUIBindings,
  rendererOptions:
    runtime.workerData.benchmarkOptions
      .inspectorMode === 'minimal'
      ? {
          inspector: {
            maxOperations: 0,
            trackNodes: false,
          },
        }
      : {},
  initializeRuntime() {
    markStartup('runtimeInitializeStarted')
    roInitialize(0)
    markStartup('runtimeInitialized')
  },
  configureWindow({ window }) {
    markStartup('windowConfigureStarted')
    window.title = 'DynWinRT JSX SignalGrid'
    window.appWindow.setPresenter(
      AppWindowPresenterKind.FullScreen,
    )
    markStartup('windowConfigured')
  },
  mount({
    window,
    renderer,
    createProjectedOwner,
    ownProjected,
    createProjected,
  }) {
    markStartup('mountEntered')
    let controller: BenchmarkController | null =
      null
    const report = (
      result: object,
    ) => {
      runtime.postMessage({
        type: 'benchmark-result',
        value: {
          ...result,
          startupMilestones: {
            ...startupMilestones,
          },
          rendererDiagnostics: {
            ...renderer.diagnostics,
          },
        },
      })
    }
    const child = (
      runtime.workerData.benchmarkOptions.scenario ===
        'keyed-list'
        ? renderKeyedBenchmark
        : runtime.workerData.benchmarkOptions.scenario ===
            'virtual-list'
          ? renderVirtualBenchmark
          : renderBenchmark
    )(
      {
        window,
        options:
          runtime.workerData.benchmarkOptions,
        baselineMemory,
        report,
        markStartup,
        createProjectedOwner,
        ownProjected,
        createProjected,
      },
      (value) => {
        controller = value
      },
    )
    markStartup('jsxBuilt')
    return {
      child,
      afterRender() {
        markStartup('afterRender')
      },
      afterActivate() {
        markStartup('afterActivate')
        if (!controller) {
          throw new Error(
            'Benchmark controller was not mounted.',
          )
        }
        controller.start()
      },
    }
  },
  onStage(stage) {
    markStartup(stage)
  },
  ...runtime.appCallbacks,
})
markStartup('appDefined')

void runtime.run(app)
