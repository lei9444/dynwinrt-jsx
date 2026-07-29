import {
  For,
  batch,
  gridLength,
  onCleanup,
  signal,
  thickness,
  type Child,
} from 'dynwinrt-jsx'
import {
  CompositionTarget,
  Orientation,
  ScrollBarVisibility,
  VerticalAlignment,
} from '#winapp/bindings'
import {
  type BenchmarkContext,
  type BenchmarkController,
  type BenchmarkResult,
} from './app'
import { KeyedListSource } from './keyed-workload'
import {
  LayoutGrid,
  UI,
} from './ui'

declare const process: {
  memoryUsage(): {
    readonly rss: number
    readonly heapUsed: number
  }
  cpuUsage(previous?: {
    readonly user: number
    readonly system: number
  }): {
    readonly user: number
    readonly system: number
  }
}
declare const performance: { now(): number }

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce(
        (sum, value) => sum + value,
        0,
      ) / values.length
}

function percentile(
  values: readonly number[],
  fraction: number,
): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort(
    (left, right) => left - right,
  )
  return sorted[Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * fraction) - 1,
  )]!
}

function KeyedBenchmark(props: {
  readonly context: BenchmarkContext
  readonly onReady: (
    controller: BenchmarkController,
  ) => void
}) {
  const {
    context,
    onReady,
  } = props
  const source = new KeyedListSource()
  const rows = signal(source.snapshot())
  const fpsText = signal('FPS: --')
  const updateText = signal('Update: -- ms')
  const memoryText = signal('Mem: -- MB')
  const updateSamples: number[] = []
  const fpsSamples: number[] = []
  const memorySamples: number[] = []
  let updateTimer:
    | ReturnType<
        BenchmarkContext['window']['dispatcherQueue']['createTimer']
      >
    | undefined
  let unsubscribeUpdate: (() => void) | undefined
  let renderingToken:
    | ReturnType<
        typeof CompositionTarget.add_Rendering
      >
    | undefined
  let running = false
  let completed = false
  let renders = 0
  let frameCount = 0
  let startedAt = 0
  let lastFrameAt = 0
  let firstFrameAt: number | null = null
  let activatedAt = 0
  let peakRss = 0
  let memoryBaseline:
    | ReturnType<typeof process.memoryUsage>
    | undefined
  let cpuBaseline:
    | ReturnType<typeof process.cpuUsage>
    | undefined

  const sampleMemory = () => {
    const memory = process.memoryUsage()
    peakRss = Math.max(peakRss, memory.rss)
    memorySamples.push(memory.rss)
    return memory
  }
  const stop = () => {
    if (!running) {
      return
    }
    running = false
    updateTimer?.stop()
    unsubscribeUpdate?.()
    unsubscribeUpdate = undefined
    if (renderingToken !== undefined) {
      CompositionTarget.remove_Rendering(
        renderingToken,
      )
      renderingToken = undefined
    }
  }
  const finish = () => {
    if (completed) {
      return
    }
    completed = true
    stop()
    const durationMs =
      performance.now() - startedAt
    const memory = sampleMemory()
    const cpu = process.cpuUsage(cpuBaseline)
    const cpuMs =
      (cpu.user + cpu.system) / 1000
    const result: BenchmarkResult = {
      app: 'DynWinRTJsx.KeyedList',
      percent: context.options.percent,
      durationSeconds: durationMs / 1000,
      rendersPerSec:
        renders / (durationMs / 1000),
      totalRenders: renders,
      avgUpdateMs: average(updateSamples),
      maxUpdateMs: Math.max(
        0,
        ...updateSamples,
      ),
      p50UpdateMs:
        percentile(updateSamples, 0.5),
      p95UpdateMs:
        percentile(updateSamples, 0.95),
      avgCombinedMs: average(updateSamples),
      avgFps: average(fpsSamples),
      peakMemoryMB: peakRss / 1_048_576,
      avgMemoryMB:
        average(memorySamples) / 1_048_576,
      loadedRssDeltaMB:
        (
          (memoryBaseline?.rss ?? memory.rss) -
          context.baselineMemory.rss
        ) / 1_048_576,
      jsHeapUsedMB:
        memory.heapUsed / 1_048_576,
      jsHeapDeltaPerRender:
        (
          memory.heapUsed -
          (
            memoryBaseline?.heapUsed ??
            memory.heapUsed
          )
        ) / Math.max(1, renders - 1),
      cpuMs,
      cpuPercent:
        cpuMs / Math.max(1, durationMs) * 100,
      startupToActivatedMs:
        activatedAt -
        context.options.startupEpochMs,
      startupToFirstFrameMs:
        firstFrameAt === null
          ? null
          : firstFrameAt -
            context.options.startupEpochMs,
      checksum: source.checksum(),
    }
    context.report(result)
    context.window.close()
  }
  const tick = () => {
    const begin = performance.now()
    source.update(context.options.percent)
    rows.value = source.snapshot()
    const elapsed = performance.now() - begin
    updateSamples.push(elapsed)
    renders += 1
    const memory = process.memoryUsage()
    batch(() => {
      fpsText.value =
        `FPS: ${average(fpsSamples).toFixed(0)}`
      updateText.value =
        `Update: ${elapsed.toFixed(1)} ms`
      memoryText.value =
        `Mem: ${(memory.rss / 1_048_576).toFixed(0)} MB`
    })
    if (
      performance.now() - startedAt >=
      context.options.durationSeconds * 1000
    ) {
      finish()
    }
  }
  onReady({
    start() {
      if (running || completed) {
        return
      }
      running = true
      activatedAt = Date.now()
      startedAt = performance.now()
      lastFrameAt = startedAt
      memoryBaseline = sampleMemory()
      cpuBaseline = process.cpuUsage()
      renderingToken =
        CompositionTarget.add_Rendering(() => {
          const now = performance.now()
          firstFrameAt ??= Date.now()
          frameCount += 1
          const elapsed = now - lastFrameAt
          if (elapsed >= 1000) {
            fpsSamples.push(
              frameCount / elapsed * 1000,
            )
            frameCount = 0
            lastFrameAt = now
            sampleMemory()
          }
        })
      updateTimer =
        context.window.dispatcherQueue.createTimer()
      updateTimer.interval = {
        duration: 330_000n,
      }
      updateTimer.isRepeating = true
      unsubscribeUpdate =
        updateTimer.onTick(tick)
      updateTimer.start()
    },
  })
  onCleanup(stop)

  return (
    <LayoutGrid
      rowDefinitions={[
        gridLength.auto(),
        gridLength.star(),
      ]}
    >
      <UI.StackPanel
        orientation={Orientation.Horizontal}
        spacing={12}
        padding={thickness(8)}
      >
        <UI.Button content="Stop" />
        <UI.TextBlock
          text="Move %:"
          verticalAlignment={
            VerticalAlignment.Center
          }
        />
        <UI.Slider
          minimum={0}
          maximum={100}
          value={context.options.percent}
          width={200}
        />
        <UI.TextBlock text={fpsText} width={100} />
        <UI.TextBlock
          text={updateText}
          width={120}
        />
        <UI.TextBlock
          text={memoryText}
          width={120}
        />
      </UI.StackPanel>
      <UI.ScrollViewer
        gridRow={1}
        horizontalScrollBarVisibility={
          ScrollBarVisibility.Disabled
        }
      >
        <UI.StackPanel>
          <For
            each={rows}
            key={(row) => row.key}
          >
            {(row) => (
              <UI.TextBlock
                text={row.label}
                fontSize={12}
              />
            )}
          </For>
        </UI.StackPanel>
      </UI.ScrollViewer>
    </LayoutGrid>
  )
}

export function renderKeyedBenchmark(
  context: BenchmarkContext,
  onReady: (
    controller: BenchmarkController,
  ) => void,
): Child {
  return (
    <KeyedBenchmark
      context={context}
      onReady={onReady}
    />
  )
}
