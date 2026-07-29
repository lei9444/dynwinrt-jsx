import {
  createControls,
} from 'dynwinrt-jsx'
import {
  createWinUIWorkerRuntime,
  defineWinUIApp,
} from 'dynwinrt-jsx/worker'
import { roInitialize } from '@microsoft/dynwinrt'
import {
  Application,
} from '#winapp/bindings/Application'
import {
  CompositionTarget,
} from '#winapp/bindings/CompositionTarget'
import {
  DispatcherQueuePriority,
} from '#winapp/bindings/DispatcherQueuePriority'
import {
  TextBlock,
} from '#winapp/bindings/TextBlock'
import {
  Window,
} from '#winapp/bindings/Window'
import {
  createProjectedLifetimeScope,
  releaseProjected,
} from '#winapp/bindings/lifetime'
import type { BenchmarkOptions } from './app'

interface BenchmarkState {
  readonly version: 1
}

declare const process: {
  memoryUsage(): {
    readonly rss: number
    readonly heapUsed: number
  }
}

const moduleEnteredAt = Date.now()
const StartupBindings = {
  Application,
  Window,
  TextBlock,
  createProjectedLifetimeScope,
  releaseProjected,
}
const runtime = createWinUIWorkerRuntime<
  BenchmarkState,
  {
    readonly benchmarkOptions: BenchmarkOptions
  }
>({
  moduleId: './dist/app.js',
})
const UI = createControls({ TextBlock })
const app = defineWinUIApp({
  bindings: StartupBindings,
  initializeRuntime() {
    roInitialize(0)
  },
  configureWindow({ window }) {
    window.title = 'DynWinRT JSX Startup'
    window.appWindow.resize({
      width: 1000,
      height: 1000,
    })
  },
  mount({ window }) {
    const startedAt =
      runtime.workerData.benchmarkOptions
        .startupEpochMs
    let renderingToken:
      | ReturnType<
          typeof CompositionTarget.add_Rendering
        >
      | undefined
    let reported = false
    return {
      child: (
        <UI.TextBlock
          text="Blank dynwinrt-jsx startup benchmark"
          fontSize={14}
          onLoaded={() => {
            renderingToken =
              CompositionTarget.add_Rendering(() => {
                if (reported) {
                  return
                }
                reported = true
                const firstFrameAt = Date.now()
                if (renderingToken !== undefined) {
                  CompositionTarget.remove_Rendering(
                    renderingToken,
                  )
                  renderingToken = undefined
                }
                const queued =
                  window.dispatcherQueue.tryEnqueue(
                    DispatcherQueuePriority.Low,
                    () => {
                      const memory =
                        process.memoryUsage()
                      runtime.postMessage({
                        type: 'benchmark-result',
                        value: {
                          app:
                            'DynWinRTJsx.Startup',
                          moduleEnteredMs:
                            moduleEnteredAt -
                            startedAt,
                          firstFrameMs:
                            firstFrameAt -
                            startedAt,
                          interactiveMs:
                            Date.now() -
                            startedAt,
                          rssMB:
                            memory.rss /
                            1_048_576,
                          jsHeapUsedMB:
                            memory.heapUsed /
                            1_048_576,
                        },
                      })
                      window.close()
                    },
                  )
                if (!queued) {
                  throw new Error(
                    'Failed to queue startup idle marker.',
                  )
                }
              })
          }}
        />
      ),
      disposeAfterRender() {
        if (renderingToken !== undefined) {
          CompositionTarget.remove_Rendering(
            renderingToken,
          )
          renderingToken = undefined
        }
      },
    }
  },
  ...runtime.appCallbacks,
})

void runtime.run(app)
