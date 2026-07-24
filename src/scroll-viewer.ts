import {
  batch,
  computed,
  signal,
  type ReadonlySignal,
} from './reactive'
import type { RefObject } from './native'

export interface ScrollViewerInstance {
  readonly horizontalOffset: number
  readonly verticalOffset: number
  readonly scrollableWidth: number
  readonly scrollableHeight: number
  readonly viewportWidth: number
  readonly viewportHeight: number
  changeView(
    horizontalOffset: number | null,
    verticalOffset: number | null,
    zoomFactor: number | null,
    disableAnimation: boolean,
  ): boolean
  onViewChanged(
    callback: (...args: unknown[]) => void,
  ): () => void
  onSizeChanged?(
    callback: (...args: unknown[]) => void,
  ): () => void
  onLoaded?(
    callback: (...args: unknown[]) => void,
  ): () => void
  onLayoutUpdated?(
    callback: (...args: unknown[]) => void,
  ): () => void
}

export interface ScrollViewerController<
  Instance extends ScrollViewerInstance,
> extends RefObject<Instance> {
  readonly horizontalOffset: ReadonlySignal<number>
  readonly verticalOffset: ReadonlySignal<number>
  readonly scrollableWidth: ReadonlySignal<number>
  readonly scrollableHeight: ReadonlySignal<number>
  readonly viewportWidth: ReadonlySignal<number>
  readonly viewportHeight: ReadonlySignal<number>
  readonly canScrollBackward: ReadonlySignal<boolean>
  readonly canScrollForward: ReadonlySignal<boolean>
  readonly canScrollUp: ReadonlySignal<boolean>
  readonly canScrollDown: ReadonlySignal<boolean>
  readonly disposed: boolean
  refresh(): void
  scrollToHorizontalOffset(
    offset: number,
    disableAnimation?: boolean,
  ): boolean
  scrollToVerticalOffset(
    offset: number,
    disableAnimation?: boolean,
  ): boolean
  scrollHorizontalByViewport(
    direction: -1 | 1,
    disableAnimation?: boolean,
  ): boolean
  scrollVerticalByViewport(
    direction: -1 | 1,
    disableAnimation?: boolean,
  ): boolean
  dispose(): void
}

function metric(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function clamp(
  value: number,
  maximum: number,
): number {
  return Math.max(0, Math.min(maximum, value))
}

export function createScrollViewerController<
  Instance extends ScrollViewerInstance,
>(): ScrollViewerController<Instance> {
  const horizontalOffset = signal(0)
  const verticalOffset = signal(0)
  const scrollableWidth = signal(0)
  const scrollableHeight = signal(0)
  const viewportWidth = signal(0)
  const viewportHeight = signal(0)
  const canScrollBackward = computed(
    () => horizontalOffset.value > 1,
  )
  const canScrollForward = computed(
    () =>
      horizontalOffset.value <
      scrollableWidth.value - 1,
  )
  const canScrollUp = computed(
    () => verticalOffset.value > 1,
  )
  const canScrollDown = computed(
    () =>
      verticalOffset.value <
      scrollableHeight.value - 1,
  )
  let current: Instance | null = null
  let subscriptions: Array<() => void> = []
  let disposed = false

  const refresh = () => {
    if (!current || disposed) {
      return
    }
    batch(() => {
      horizontalOffset.value =
        metric(current!.horizontalOffset)
      verticalOffset.value =
        metric(current!.verticalOffset)
      scrollableWidth.value =
        metric(current!.scrollableWidth)
      scrollableHeight.value =
        metric(current!.scrollableHeight)
      viewportWidth.value =
        metric(current!.viewportWidth)
      viewportHeight.value =
        metric(current!.viewportHeight)
    })
  }

  const detach = () => {
    let firstError: unknown
    const failed: Array<() => void> = []
    for (const unsubscribe of subscriptions.reverse()) {
      try {
        unsubscribe()
      }
      catch (error) {
        firstError ??= error
        failed.unshift(unsubscribe)
      }
    }
    subscriptions = failed
    if (firstError !== undefined) {
      throw firstError
    }
    current = null
  }

  const attach = (instance: Instance) => {
    current = instance
    const nextSubscriptions: Array<() => void> = []
    try {
      nextSubscriptions.push(
        instance.onViewChanged(refresh),
      )
      if (instance.onSizeChanged) {
        nextSubscriptions.push(
          instance.onSizeChanged(refresh),
        )
      }
      if (instance.onLoaded) {
        nextSubscriptions.push(
          instance.onLoaded(refresh),
        )
      }
      if (instance.onLayoutUpdated) {
        nextSubscriptions.push(
          instance.onLayoutUpdated(refresh),
        )
      }
      subscriptions = nextSubscriptions
      refresh()
    }
    catch (error) {
      subscriptions = nextSubscriptions
      let cleanupError: unknown
      try {
        detach()
      }
      catch (failure) {
        cleanupError = failure
      }
      if (cleanupError !== undefined) {
        throw new AggregateError(
          [error, cleanupError],
          'ScrollViewer controller attach and rollback failed.',
        )
      }
      throw error
    }
  }

  const changeView = (
    horizontal: number | null,
    vertical: number | null,
    disableAnimation: boolean,
  ) => {
    if (!current || disposed) {
      return false
    }
    const accepted = current.changeView(
      horizontal,
      vertical,
      null,
      disableAnimation,
    )
    refresh()
    return accepted
  }

  return {
    get current() {
      return current
    },
    set current(value) {
      if (value === current) {
        return
      }
      if (disposed && value !== null) {
        throw new Error(
          'Cannot attach a disposed ScrollViewer controller.',
        )
      }
      if (current !== null || subscriptions.length > 0) {
        detach()
      }
      if (value !== null) {
        attach(value)
      }
    },
    horizontalOffset,
    verticalOffset,
    scrollableWidth,
    scrollableHeight,
    viewportWidth,
    viewportHeight,
    canScrollBackward,
    canScrollForward,
    canScrollUp,
    canScrollDown,
    get disposed() {
      return disposed
    },
    refresh,
    scrollToHorizontalOffset(
      offset,
      disableAnimation = false,
    ) {
      return changeView(
        clamp(offset, scrollableWidth.peek()),
        null,
        disableAnimation,
      )
    },
    scrollToVerticalOffset(
      offset,
      disableAnimation = false,
    ) {
      return changeView(
        null,
        clamp(offset, scrollableHeight.peek()),
        disableAnimation,
      )
    },
    scrollHorizontalByViewport(
      direction,
      disableAnimation = false,
    ) {
      return changeView(
        clamp(
          horizontalOffset.peek() +
            direction * viewportWidth.peek(),
          scrollableWidth.peek(),
        ),
        null,
        disableAnimation,
      )
    },
    scrollVerticalByViewport(
      direction,
      disableAnimation = false,
    ) {
      return changeView(
        null,
        clamp(
          verticalOffset.peek() +
            direction * viewportHeight.peek(),
          scrollableHeight.peek(),
        ),
        disableAnimation,
      )
    },
    dispose() {
      if (disposed) {
        return
      }
      detach()
      disposed = true
    },
  }
}
