import {
  batch,
  color,
  createControls,
  createGridControl,
  createSolidColorBrush,
  gridLength,
  onCleanup,
  signal,
  thickness,
  type Child,
  type ProjectedOwnership,
} from 'dynwinrt-jsx'
import {
  Button,
  ColumnDefinition,
  CompositionTarget,
  Grid,
  Orientation,
  RowDefinition,
  ScrollBarVisibility,
  ScrollViewer,
  Slider,
  SolidColorBrush,
  StackPanel,
  TextBlock,
  TextTrimming,
  VerticalAlignment,
  type Window,
} from '#winapp/bindings'
import {
  StockDataSource,
  formatCell,
} from './workload'

interface MemoryUsage {
  readonly rss: number
  readonly heapTotal: number
  readonly heapUsed: number
  readonly external: number
  readonly arrayBuffers: number
}

interface CpuUsage {
  readonly user: number
  readonly system: number
}

declare const process: {
  memoryUsage(): MemoryUsage
  cpuUsage(previous?: CpuUsage): CpuUsage
}
declare const performance: {
  now(): number
}

export interface BenchmarkOptions {
  readonly scenario: string
  readonly percent: number
  readonly durationSeconds: number
  readonly startupEpochMs: number
  readonly count: number
  readonly withEdits: boolean
  readonly editsPerSecond: number
  readonly iterations: number
  readonly reps: number
}

export interface BenchmarkResult {
  readonly app: string
  readonly percent: number
  readonly durationSeconds: number
  readonly rendersPerSec: number
  readonly totalRenders: number
  readonly avgUpdateMs: number
  readonly maxUpdateMs: number
  readonly p50UpdateMs: number
  readonly p95UpdateMs: number
  readonly avgCombinedMs: number
  readonly avgFps: number
  readonly peakMemoryMB: number
  readonly avgMemoryMB: number
  readonly loadedRssDeltaMB: number
  readonly jsHeapUsedMB: number
  readonly jsHeapDeltaPerRender: number
  readonly cpuMs: number
  readonly cpuPercent: number
  readonly startupToActivatedMs: number
  readonly startupToFirstFrameMs: number | null
  readonly checksum: number
}

export interface BenchmarkController {
  start(): void
}

export interface BenchmarkContext
extends ProjectedOwnership {
  readonly window: Window
  readonly options: BenchmarkOptions
  readonly baselineMemory: MemoryUsage
  readonly report: (result: BenchmarkResult) => void
}

interface CellState {
  readonly text: ReturnType<typeof signal<string>>
  readonly foreground:
    ReturnType<typeof signal<SolidColorBrush>>
}

const UI = createControls({
  Button,
  ScrollViewer,
  Slider,
  StackPanel,
  TextBlock,
})
const LayoutGrid = createGridControl({
  Grid,
  RowDefinition,
  ColumnDefinition,
})

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce(
        (total, value) => total + value,
        0,
      ) / values.length
}

function percentile(
  values: readonly number[],
  percentileValue: number,
): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort(
    (left, right) => left - right,
  )
  const index = Math.min(
    sorted.length - 1,
    Math.max(
      0,
      Math.ceil(
        percentileValue * sorted.length,
      ) - 1,
    ),
  )
  return sorted[index]!
}

function BenchmarkApp(props: {
  readonly context: BenchmarkContext
  readonly onReady: (
    controller: BenchmarkController,
  ) => void
}) {
  const {
    context,
    onReady,
  } = props
  const source = new StockDataSource()
  const greenBrush = context.createProjected(
    () => createSolidColorBrush(
      SolidColorBrush,
      color(50, 205, 50),
    ),
  )
  const redBrush = context.createProjected(
    () => createSolidColorBrush(
      SolidColorBrush,
      color(255, 0, 0),
    ),
  )
  const cells: CellState[] = source.items.map(
    (item) => ({
      text: signal(formatCell(item)),
      foreground: signal(greenBrush),
    }),
  )
  const fpsText = signal('FPS: --')
  const updateText = signal('Update: -- ms')
  const memoryText = signal('Mem: -- MB')
  const updateSamples: number[] = []
  const fpsSamples: number[] = []
  const memorySamples: number[] = []
  let updateTimer:
    | ReturnType<
        Window['dispatcherQueue']['createTimer']
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
  let totalRenders = 0
  let frameCount = 0
  let firstFrameAt: number | null = null
  let activatedEpochMs = 0
  let startedAt = 0
  let lastFrameSampleAt = 0
  let peakRss = 0
  let cpuBaseline: CpuUsage | undefined
  let memoryBaseline: MemoryUsage | undefined

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
    const finishedAt = performance.now()
    const durationMs = finishedAt - startedAt
    const memory = sampleMemory()
    const cpu = process.cpuUsage(cpuBaseline)
    const cpuMs =
      (cpu.user + cpu.system) / 1_000
    const allocationRenders = Math.max(
      1,
      totalRenders - 1,
    )
    context.report({
      app: 'DynWinRTJsx.SignalGrid',
      percent: context.options.percent,
      durationSeconds: durationMs / 1_000,
      rendersPerSec:
        totalRenders / (durationMs / 1_000),
      totalRenders,
      avgUpdateMs: average(updateSamples),
      maxUpdateMs:
        updateSamples.length === 0
          ? 0
          : Math.max(...updateSamples),
      p50UpdateMs: percentile(updateSamples, 0.5),
      p95UpdateMs: percentile(updateSamples, 0.95),
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
          (memoryBaseline?.heapUsed ??
            memory.heapUsed)
        ) /
        allocationRenders,
      cpuMs,
      cpuPercent:
        durationMs <= 0
          ? 0
          : cpuMs / durationMs * 100,
      startupToActivatedMs:
        activatedEpochMs -
        context.options.startupEpochMs,
      startupToFirstFrameMs:
        firstFrameAt === null
          ? null
          : firstFrameAt -
            context.options.startupEpochMs,
      checksum: source.checksum(),
    })
    context.window.close()
  }

  const tick = () => {
    if (!running) {
      return
    }
    const begin = performance.now()
    const changes = source.update(
      context.options.percent,
    )
    batch(() => {
      for (const change of changes) {
        const cell = cells[change.index]!
        cell.text.value = formatCell(change.item)
        cell.foreground.value =
          change.item.isUp
            ? greenBrush
            : redBrush
      }
    })
    const elapsed = performance.now() - begin
    updateSamples.push(elapsed)
    totalRenders += 1
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
      context.options.durationSeconds * 1_000
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
      activatedEpochMs = Date.now()
      startedAt = performance.now()
      lastFrameSampleAt = startedAt
      cpuBaseline = process.cpuUsage()
      memoryBaseline = sampleMemory()
      renderingToken =
        CompositionTarget.add_Rendering(() => {
          const now = performance.now()
          firstFrameAt ??= Date.now()
          frameCount += 1
          const elapsed =
            now - lastFrameSampleAt
          if (elapsed >= 1_000) {
            fpsSamples.push(
              frameCount / elapsed * 1_000,
            )
            frameCount = 0
            lastFrameSampleAt = now
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
          text="Update %:"
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
        <UI.TextBlock
          text={fpsText}
          width={100}
          verticalAlignment={
            VerticalAlignment.Center
          }
        />
        <UI.TextBlock
          text={updateText}
          width={120}
          verticalAlignment={
            VerticalAlignment.Center
          }
        />
        <UI.TextBlock
          text={memoryText}
          width={120}
          verticalAlignment={
            VerticalAlignment.Center
          }
        />
      </UI.StackPanel>
      <UI.ScrollViewer
        gridRow={1}
        horizontalScrollBarVisibility={
          ScrollBarVisibility.Auto
        }
      >
        <LayoutGrid
          columnDefinitions={Array.from(
            { length: StockDataSource.columns },
            () => gridLength.pixel(64),
          )}
          rowDefinitions={Array.from(
            { length: StockDataSource.rows },
            () => gridLength.pixel(18),
          )}
        >
          {cells.map((cell, index) => (
            <UI.TextBlock
              key={index}
              gridRow={Math.floor(
                index / StockDataSource.columns,
              )}
              gridColumn={
                index % StockDataSource.columns
              }
              text={cell.text}
              foreground={cell.foreground}
              fontSize={8}
              padding={thickness(2, 1)}
              textTrimming={
                TextTrimming.CharacterEllipsis
              }
            />
          ))}
        </LayoutGrid>
      </UI.ScrollViewer>
    </LayoutGrid>
  )
}

export function renderBenchmark(
  context: BenchmarkContext,
  onReady: (controller: BenchmarkController) => void,
): Child {
  return (
    <BenchmarkApp
      context={context}
      onReady={onReady}
    />
  )
}
