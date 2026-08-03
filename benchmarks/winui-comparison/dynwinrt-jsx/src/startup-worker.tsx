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
  validateState(value): value is BenchmarkState {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as { version?: unknown }).version === 1
    )
  },
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
const UI = createControls({ TextBlock })
const app = defineWinUIApp({
  bindings: StartupBindings,
  initializeRuntime() {
    markStartup('runtimeInitializeStarted')
    roInitialize(0)
    markStartup('runtimeInitialized')
  },
  configureWindow({ window }) {
    markStartup('windowConfigureStarted')
    window.title = 'DynWinRT JSX Startup'
    window.appWindow.resize({
      width: 1000,
      height: 1000,
    })
    markStartup('windowConfigured')
  },
  mount({ window }) {
    markStartup('mountEntered')
    let renderingToken:
      | ReturnType<
          typeof CompositionTarget.add_Rendering
        >
      | undefined
    let reported = false
    const child = (
      <UI.TextBlock
        text="Blank dynwinrt-jsx startup benchmark"
        fontSize={14}
        onLoaded={() => {
          markStartup('rootLoaded')
          renderingToken =
            CompositionTarget.add_Rendering(() => {
              if (reported) {
                return
              }
              reported = true
              const firstFrameAt = Date.now()
              markStartup('firstFrame')
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
                    markStartup('idle')
                    const memory =
                      process.memoryUsage()
                    runtime.postMessage({
                      type: 'benchmark-result',
                      value: {
                        app:
                          'DynWinRTJsx.Startup',
                        moduleEnteredMs:
                          moduleEnteredAt -
                          startupEpochMs,
                        firstFrameMs:
                          firstFrameAt -
                          startupEpochMs,
                        interactiveMs:
                          Date.now() -
                          startupEpochMs,
                        rssMB:
                          memory.rss /
                          1_048_576,
                        jsHeapUsedMB:
                          memory.heapUsed /
                          1_048_576,
                        startupMilestones: {
                          ...startupMilestones,
                        },
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
    )
    markStartup('jsxBuilt')
    return {
      child,
      afterRender() {
        markStartup('afterRender')
      },
      afterActivate() {
        markStartup('afterActivate')
      },
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
  onStage(stage) {
    markStartup(stage)
  },
  ...runtime.appCallbacks,
})
markStartup('appDefined')

void runtime.run(app)
