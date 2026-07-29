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
  type BenchmarkResult,
} from './app'
import { renderKeyedBenchmark } from './keyed-app'

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

const baselineMemory = process.memoryUsage()
const runtime = createWinUIWorkerRuntime<
  BenchmarkState,
  {
    readonly benchmarkOptions: BenchmarkOptions
  }
>({
  moduleId: './dist/app.js',
})
const app = defineWinUIApp({
  bindings: WinUIBindings,
  initializeRuntime() {
    roInitialize(0)
  },
  configureWindow({ window }) {
    window.title = 'DynWinRT JSX SignalGrid'
    window.appWindow.setPresenter(
      AppWindowPresenterKind.FullScreen,
    )
  },
  mount({
    window,
    createProjectedOwner,
    ownProjected,
    createProjected,
  }) {
    let controller: BenchmarkController | null =
      null
    const report = (result: BenchmarkResult) => {
      runtime.postMessage({
        type: 'benchmark-result',
        value: result,
      })
    }
    return {
      child: (
        runtime.workerData.benchmarkOptions.scenario ===
          'keyed-list'
          ? renderKeyedBenchmark
          : renderBenchmark
      )(
        {
          window,
          options:
            runtime.workerData.benchmarkOptions,
          baselineMemory,
          report,
          createProjectedOwner,
          ownProjected,
          createProjected,
        },
        (value) => {
          controller = value
        },
      ),
      afterActivate() {
        if (!controller) {
          throw new Error(
            'Benchmark controller was not mounted.',
          )
        }
        controller.start()
      },
    }
  },
  ...runtime.appCallbacks,
})

void runtime.run(app)
