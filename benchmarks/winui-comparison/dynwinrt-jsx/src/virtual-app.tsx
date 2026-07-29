import {
  color,
  computed,
  cornerRadius,
  createItemsRepeaterControl,
  createSolidColorBrush,
  onCleanup,
  signal,
  thickness,
  type Child,
  type ReadonlySignal,
} from 'dynwinrt-jsx'
import {
  CompositionTarget,
  ContentControl,
  HorizontalAlignment,
  IElementFactory,
  IObservableVector_Object,
  IReference_Int32,
  ItemsRepeater,
  Orientation,
  PropertyValue,
  SolidColorBrush,
  StackLayout,
  VerticalAlignment,
  type ScrollViewer,
} from '#winapp/bindings'
import type {
  BenchmarkContext,
  BenchmarkController,
} from './app'
import { DotNetRandom } from './workload'
import {
  generateVirtualItems,
  virtualItemAt,
  virtualRowHeight,
  type VirtualListItem,
} from './virtual-workload'
import { UI } from './ui'

declare const process: {
  memoryUsage(): {
    readonly rss: number
    readonly heapUsed: number
  }
}
declare const performance: { now(): number }

const Repeater = createItemsRepeaterControl({
  ItemsRepeater,
  ContentControl,
  IElementFactory,
  IObservableVector_Object,
  PropertyValue,
  IReference_Int32,
})

function hslColor(hueDegrees: number) {
  const hue = mod(hueDegrees, 360) / 360
  const saturation = 0.55
  const lightness = 0.45
  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation -
      lightness * saturation
  const p = 2 * lightness - q
  const channel = (value: number) => {
    let normalized = value
    if (normalized < 0) normalized += 1
    if (normalized > 1) normalized -= 1
    if (normalized < 1 / 6) {
      return p + (q - p) * 6 * normalized
    }
    if (normalized < 1 / 2) return q
    if (normalized < 2 / 3) {
      return p +
        (q - p) *
        (2 / 3 - normalized) *
        6
    }
    return p
  }
  return color(
    Math.round(channel(hue + 1 / 3) * 255),
    Math.round(channel(hue) * 255),
    Math.round(channel(hue - 1 / 3) * 255),
  )
}

function mod(value: number, length: number): number {
  const result = value % length
  return result < 0 ? result + length : result
}

function VirtualRow(props: {
  readonly item: VirtualListItem
  readonly index: ReadonlySignal<number>
  readonly context: BenchmarkContext
  readonly whiteRow: SolidColorBrush
  readonly alternateRow: SolidColorBrush
  readonly dimText: SolidColorBrush
  readonly pillBackground: SolidColorBrush
  readonly whiteText: SolidColorBrush
}) {
  const {
    item,
    index,
    context,
  } = props
  const avatar = context.createProjected(
    () => createSolidColorBrush(
      SolidColorBrush,
      hslColor(item.avatarHue),
    ),
  )
  return (
    <UI.Border
      height={virtualRowHeight}
      background={computed(() =>
        (index.value & 1) === 0
          ? props.whiteRow
          : props.alternateRow,
      )}
    >
      <UI.StackPanel
        orientation={Orientation.Horizontal}
        spacing={12}
        padding={thickness(12, 8)}
      >
        <UI.Border
          width={48}
          height={48}
          background={avatar}
          cornerRadius={cornerRadius(6)}
        >
          <UI.TextBlock
            text={item.initial}
            fontSize={18}
            foreground={props.whiteText}
            horizontalAlignment={
              HorizontalAlignment.Center
            }
            verticalAlignment={
              VerticalAlignment.Center
            }
          />
        </UI.Border>
        <UI.StackPanel spacing={2}>
          <UI.TextBlock
            text={`${item.name} • ${item.category}`}
            fontSize={14}
          />
          <UI.TextBlock
            text={item.message}
            fontSize={14}
          />
          <UI.TextBlock
            text={`${item.timestamp} • #${item.tag}`}
            fontSize={12}
            foreground={props.dimText}
          />
        </UI.StackPanel>
        <UI.Border
          background={props.pillBackground}
          cornerRadius={cornerRadius(10)}
          verticalAlignment={
            VerticalAlignment.Center
          }
        >
          <UI.TextBlock
            text={`♥ ${item.likes}`}
            fontSize={12}
            padding={thickness(8, 2)}
          />
        </UI.Border>
      </UI.StackPanel>
    </UI.Border>
  )
}

function percentile(
  values: readonly number[],
  fraction: number,
) {
  const sorted = [...values].sort(
    (left, right) => left - right,
  )
  return sorted[Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * fraction),
  )] ?? 0
}

function VirtualBenchmark(props: {
  readonly context: BenchmarkContext
  readonly onReady: (
    controller: BenchmarkController,
  ) => void
}) {
  const {
    context,
    onReady,
  } = props
  const items = signal(
    generateVirtualItems(context.options.count),
  )
  const layout = context.createProjected(
    () => {
      const value = new StackLayout()
      value.orientation = Orientation.Vertical
      value.spacing = 0
      return value
    },
  )
  const brushes = {
    dimText: context.createProjected(
      () => createSolidColorBrush(
        SolidColorBrush,
        color(110, 110, 110),
      ),
    ),
    alternateRow: context.createProjected(
      () => createSolidColorBrush(
        SolidColorBrush,
        color(245, 245, 245),
      ),
    ),
    whiteRow: context.createProjected(
      () => createSolidColorBrush(
        SolidColorBrush,
        color(255, 255, 255),
      ),
    ),
    pillBackground: context.createProjected(
      () => createSolidColorBrush(
        SolidColorBrush,
        color(240, 240, 240),
      ),
    ),
    whiteText: context.createProjected(
      () => createSolidColorBrush(
        SolidColorBrush,
        color(255, 255, 255),
      ),
    ),
  }
  let scrollViewer: ScrollViewer | null = null
  let renderingToken:
    | ReturnType<
        typeof CompositionTarget.add_Rendering
      >
    | undefined
  let editTimer:
    | ReturnType<
        BenchmarkContext['window']['dispatcherQueue']['createTimer']
      >
    | undefined
  let unsubscribeEdit: (() => void) | undefined
  let startedAt = 0
  let lastFrameAt = 0
  let running = false
  let editOps = 0
  let nextSyntheticId = 2_147_483_647
  const frameSamples: number[] = []
  const editRandom = new DotNetRandom(1_234_567)

  const stop = () => {
    if (!running) return
    running = false
    if (renderingToken !== undefined) {
      CompositionTarget.remove_Rendering(
        renderingToken,
      )
      renderingToken = undefined
    }
    editTimer?.stop()
    unsubscribeEdit?.()
    unsubscribeEdit = undefined
  }
  const finish = () => {
    stop()
    const memory = process.memoryUsage()
    context.report({
      app: 'DynWinRTJsx.VirtualList',
      count: items.peek().length,
      edits: editOps,
      frames: frameSamples.length,
      avgFrameMs:
        frameSamples.reduce(
          (sum, value) => sum + value,
          0,
        ) / Math.max(1, frameSamples.length),
      p50FrameMs:
        percentile(frameSamples, 0.50),
      p95FrameMs:
        percentile(frameSamples, 0.95),
      p99FrameMs:
        percentile(frameSamples, 0.99),
      peakMemoryMB:
        memory.rss / 1_048_576,
      jsHeapUsedMB:
        memory.heapUsed / 1_048_576,
    })
    context.window.close()
  }
  const startEdits = () => {
    if (!context.options.withEdits) {
      return
    }
    editTimer =
      context.window.dispatcherQueue.createTimer()
    editTimer.interval = {
      duration: BigInt(
        Math.round(
          10_000_000 /
          Math.max(
            1,
            context.options.editsPerSecond,
          ),
        ),
      ),
    }
    editTimer.isRepeating = true
    unsubscribeEdit = editTimer.onTick(() => {
      const current = [...items.peek()]
      if (
        editRandom.nextDouble() < 0.5 ||
        current.length < 100
      ) {
        current.splice(
          editRandom.next(current.length + 1),
          0,
          virtualItemAt(nextSyntheticId--),
        )
      }
      else {
        current.splice(
          editRandom.next(current.length),
          1,
        )
      }
      items.value = current
      editOps += 1
    })
    editTimer.start()
  }
  onReady({
    start() {
      const delayed =
        context.window.dispatcherQueue.createTimer()
      delayed.interval = { duration: 2_500_000n }
      delayed.isRepeating = false
      let unsubscribe: (() => void) | undefined
      unsubscribe = delayed.onTick(() => {
        delayed.stop()
        unsubscribe?.()
        if (!scrollViewer) {
          throw new Error(
            'VirtualList ScrollViewer is unavailable.',
          )
        }
        scrollViewer.changeView(
          null,
          0,
          null,
          true,
        )
        const maximum = Math.max(
          0,
          virtualRowHeight *
            items.peek().length -
            (
              scrollViewer.viewportHeight > 0
                ? scrollViewer.viewportHeight
                : 600
            ),
        )
        startedAt = performance.now()
        lastFrameAt = 0
        running = true
        startEdits()
        renderingToken =
          CompositionTarget.add_Rendering(() => {
            if (!running || !scrollViewer) {
              return
            }
            const now = performance.now()
            if (lastFrameAt !== 0) {
              frameSamples.push(
                now - lastFrameAt,
              )
            }
            lastFrameAt = now
            const progress = Math.min(
              1,
              (
                now - startedAt
              ) /
              (
                context.options
                  .durationSeconds *
                1000
              ),
            )
            scrollViewer.changeView(
              null,
              maximum * progress,
              null,
              true,
            )
            if (progress >= 1) {
              finish()
            }
          })
      })
      delayed.start()
    },
  })
  onCleanup(stop)

  return (
    <UI.ScrollViewer
      ref={(value) => {
        scrollViewer = value
      }}
    >
      <Repeater
        each={items}
        key={(item) => item.id}
        layout={layout}
      >
        {(item, index) => (
          <VirtualRow
            item={item}
            index={index}
            context={context}
            {...brushes}
          />
        )}
      </Repeater>
    </UI.ScrollViewer>
  )
}

export function renderVirtualBenchmark(
  context: BenchmarkContext,
  onReady: (
    controller: BenchmarkController,
  ) => void,
): Child {
  return (
    <VirtualBenchmark
      context={context}
      onReady={onReady}
    />
  )
}
