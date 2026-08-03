import {
  batch,
  createControls,
  signal,
  type Child,
} from 'dynwinrt-jsx'
import {
  createWinUIWorkerRuntime,
  defineWinUIApp,
} from 'dynwinrt-jsx/worker'
import { roInitialize } from '@microsoft/dynwinrt'
import * as WinUIBindings from '#winapp/bindings'
import {
  Button,
  StackPanel,
  TextBlock,
  ToggleSwitch,
  type StackPanel as StackPanelInstance,
} from '#winapp/bindings'
import type { BenchmarkOptions } from './app'

interface BenchmarkState {
  readonly version: 1
}

interface MicroResult {
  readonly benchId: string
  readonly benchName: string
  readonly variant: 'DynWinRTJsx'
  readonly iterations: number
  readonly repetition: number
  readonly totalMs: number
  readonly meanNs: number
  readonly heapDeltaBytes: number
}

declare const process: {
  hrtime: {
    bigint(): bigint
  }
  memoryUsage(): {
    readonly heapUsed: number
  }
}
declare const globalThis: {
  gc?: () => void
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
const UI = createControls({
  Button,
  StackPanel,
  TextBlock,
  ToggleSwitch,
})

function measure(
  benchId: string,
  benchName: string,
  iterations: number,
  repetition: number,
  callback: () => void,
): MicroResult {
  globalThis.gc?.()
  const heapBefore = process.memoryUsage().heapUsed
  const startedAt = process.hrtime.bigint()
  for (let index = 0; index < iterations; index += 1) {
    callback()
  }
  const elapsedNs =
    process.hrtime.bigint() - startedAt
  const heapAfter = process.memoryUsage().heapUsed
  const totalMs = Number(elapsedNs) / 1_000_000
  return {
    benchId,
    benchName,
    variant: 'DynWinRTJsx',
    iterations,
    repetition,
    totalMs,
    meanNs: Number(elapsedNs) / iterations,
    heapDeltaBytes: heapAfter - heapBefore,
  }
}

function mountFixture(
  renderer: Parameters<
    Parameters<typeof defineWinUIApp>[0]['mount']
  >[0]['renderer'],
  host: StackPanelInstance,
  size: number,
) {
  const values = Array.from(
    { length: size },
    () => signal('a'),
  )
  const child: Child = (
    <UI.StackPanel>
      {values.map((value, index) => (
        <UI.TextBlock
          key={index}
          text={value}
        />
      ))}
    </UI.StackPanel>
  )
  const handle = renderer.render(child, host)
  return {
    values,
    dispose: () => handle.dispose(),
  }
}

const app = defineWinUIApp({
  bindings: WinUIBindings,
  initializeRuntime() {
    roInitialize(0)
  },
  configureWindow({ window }) {
    window.title = 'DynWinRT JSX Micro'
  },
  mount({ renderer, window }) {
    let host: StackPanelInstance | null = null
    return {
      child: (
        <UI.StackPanel
          ref={(value) => {
            host = value
          }}
        />
      ),
      afterActivate() {
        if (!host) {
          throw new Error('Micro benchmark host is unavailable.')
        }
        const options =
          runtime.workerData.benchmarkOptions
        const iterations = Math.max(
          1,
          options.iterations,
        )
        const repetitions = Math.max(
          1,
          options.reps,
        )
        const results: MicroResult[] = []
        const runRepeated = (
          benchId: string,
          benchName: string,
          callbackFactory: () => {
            readonly run: () => void
            readonly dispose?: () => void
          },
        ) => {
          for (let warmup = 0; warmup < 2; warmup += 1) {
            const fixture = callbackFactory()
            for (
              let index = 0;
              index < iterations;
              index += 1
            ) {
              fixture.run()
            }
            fixture.dispose?.()
          }
          for (
            let repetition = 0;
            repetition < repetitions;
            repetition += 1
          ) {
            const fixture = callbackFactory()
            results.push(measure(
              benchId,
              benchName,
              iterations,
              repetition,
              fixture.run,
            ))
            fixture.dispose?.()
          }
        }

        runRepeated(
          'M1',
          'Mount_Leaf_NoCallback',
          () => ({
            run() {
              const handle = renderer.render(
                <UI.TextBlock text="hi" />,
                host!,
              )
              handle.dispose()
            },
          }),
        )
        runRepeated(
          'M2',
          'Mount_Leaf_OneCallback',
          () => ({
            run() {
              const handle = renderer.render(
                <UI.ToggleSwitch
                  isOn={false}
                  onToggled={() => {}}
                />,
                host!,
              )
              handle.dispose()
            },
          }),
        )
        runRepeated(
          'M3',
          'Mount_Leaf_ThreeCallbacks',
          () => ({
            run() {
              const handle = renderer.render(
                <UI.Button
                  content="x"
                  onClick={() => {}}
                  onPointerPressed={() => {}}
                  onTapped={() => {}}
                />,
                host!,
              )
              handle.dispose()
            },
          }),
        )
        runRepeated(
          'M7',
          'Update_NoChange',
          () => {
            const fixture =
              mountFixture(renderer, host!, 1000)
            return {
              run() {
                batch(() => {
                  for (const value of fixture.values) {
                    value.value = value.peek()
                  }
                })
              },
              dispose: fixture.dispose,
            }
          },
        )
        runRepeated(
          'M8',
          'Update_OneLeafChanged',
          () => {
            const fixture =
              mountFixture(renderer, host!, 1000)
            let iteration = 0
            return {
              run() {
                const index =
                  iteration % fixture.values.length
                fixture.values[index]!.value =
                  (iteration & 1) === 0 ? 'a' : 'b'
                iteration += 1
              },
              dispose: fixture.dispose,
            }
          },
        )
        runRepeated(
          'M9',
          'Update_AllChanged',
          () => {
            const fixture =
              mountFixture(renderer, host!, 1000)
            let iteration = 0
            return {
              run() {
                const label =
                  (iteration & 1) === 0 ? 'a' : 'b'
                batch(() => {
                  for (const value of fixture.values) {
                    value.value = label
                  }
                })
                iteration += 1
              },
              dispose: fixture.dispose,
            }
          },
        )
        runRepeated(
          'M10',
          'EventHandlerState_Alloc',
          () => ({
            run() {
              const handle = renderer.render(
                <UI.ToggleSwitch
                  isOn={false}
                  onToggled={() => {}}
                />,
                host!,
              )
              handle.dispose()
            },
          }),
        )

        runtime.postMessage({
          type: 'benchmark-result',
          value: {
            app: 'DynWinRTJsx.ControlModel',
            results,
          },
        })
        window.close()
      },
    }
  },
  ...runtime.appCallbacks,
})

void runtime.run(app)
