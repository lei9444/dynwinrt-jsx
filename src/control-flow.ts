import {
  isSignal,
  readSignal,
  type MaybeSignal,
  type ReadonlySignal,
} from './reactive'
import {
  createErrorBoundaryNode,
  createDynamicNode,
  createListNode,
  createPortalNode,
  type BoundaryErrorContext,
  type Child,
  type Key,
  type ListNode,
} from './vnode'

export interface ShowProps<Value> {
  when: MaybeSignal<Value>
  children: Child | ((value: NonNullable<Value>) => Child)
  fallback?: Child
}

export interface ForProps<Item> {
  each: MaybeSignal<readonly Item[]>
  children: (item: Item, index: ReadonlySignal<number>) => Child
  key?: (item: Item, index: number) => Key
  fallback?: Child
}

export interface ErrorBoundaryProps {
  readonly children?: Child
  readonly fallback:
    | Child
    | ((error: unknown, context: BoundaryErrorContext) => Child)
  readonly reset?: MaybeSignal<unknown>
}

export interface PortalProps {
  readonly mount: MaybeSignal<object | null | undefined>
  readonly children?: Child
}

export interface VirtualForProps<Item> extends ForProps<Item> {
  readonly start: MaybeSignal<number>
  readonly count: MaybeSignal<number>
  readonly itemSize: number
  readonly overscan?: number
  readonly renderSpacer: (
    size: number,
    position: 'before' | 'after',
  ) => Child
}

function singleChild<Value>(value: Value | readonly Value[]): Value {
  return Array.isArray(value) ? (value[0] as Value) : (value as Value)
}

export function Show<Value>(props: ShowProps<Value>): Child {
  const children = singleChild(
    props.children as ShowProps<Value>['children'] | readonly ShowProps<Value>['children'][],
  )

  return createDynamicNode(() => {
    const value = readSignal(props.when)
    if (!value) {
      return props.fallback
    }

    return typeof children === 'function'
      ? children(value as NonNullable<Value>)
      : children
  })
}

export function For<Item>(props: ForProps<Item>): ListNode<Item> {
  const renderItem = singleChild(
    props.children as ForProps<Item>['children'] | readonly ForProps<Item>['children'][],
  )

  if (typeof renderItem !== 'function') {
    throw new TypeError('For expects a function as its child.')
  }

  return createListNode(
    () => {
      const value = isSignal<readonly Item[]>(props.each)
        ? props.each.value
        : props.each
      return value
    },
    renderItem,
    props.key ?? ((item, index) => {
      if (
        (typeof item === 'object' && item !== null) ||
        typeof item === 'symbol'
      ) {
        return item as Key
      }
      return `${String(item)}:${index}`
    }),
    props.fallback,
  )
}

export function ErrorBoundary(
  props: ErrorBoundaryProps,
): Child {
  let fallback: (
    error: unknown,
    context: BoundaryErrorContext,
  ) => Child
  if (typeof props.fallback === 'function') {
    fallback = props.fallback
  } else {
    const fallbackChild = props.fallback
    fallback = () => fallbackChild
  }

  return createErrorBoundaryNode(
    props.children,
    fallback,
    props.reset === undefined
      ? undefined
      : () => readSignal(props.reset),
  )
}

export function Portal(props: PortalProps): Child {
  return createPortalNode(
    props.children,
    () => readSignal(props.mount),
  )
}

export function VirtualFor<Item>(
  props: VirtualForProps<Item>,
): Child {
  const renderItem = singleChild(
    props.children as
      | VirtualForProps<Item>['children']
      | readonly VirtualForProps<Item>['children'][],
  )

  if (typeof renderItem !== 'function') {
    throw new TypeError('VirtualFor expects a function as its child.')
  }
  if (!Number.isFinite(props.itemSize) || props.itemSize <= 0) {
    throw new RangeError('VirtualFor itemSize must be a positive number.')
  }

  const overscan = Math.max(0, Math.trunc(props.overscan ?? 2))
  const readItems = () => readSignal(props.each)
  const readWindow = () => {
    const items = readItems()
    const requestedStart = Math.max(
      0,
      Math.trunc(readSignal(props.start)),
    )
    const requestedCount = Math.max(
      0,
      Math.trunc(readSignal(props.count)),
    )
    const start = Math.min(
      items.length,
      Math.max(0, requestedStart - overscan),
    )
    const end = Math.min(
      items.length,
      requestedStart + requestedCount + overscan,
    )

    return {
      items,
      start,
      end: Math.max(start, end),
    }
  }

  const list = createListNode(
    () => {
      const window = readWindow()
      return window.items.slice(window.start, window.end)
    },
    renderItem,
    props.key ?? ((item, index) => {
      if (
        (typeof item === 'object' && item !== null) ||
        typeof item === 'symbol'
      ) {
        return item as Key
      }
      return `${String(item)}:${index}`
    }),
    props.fallback,
    (_item, visibleIndex) => readWindow().start + visibleIndex,
  )

  return [
    createDynamicNode(() => {
      const before = readWindow().start * props.itemSize
      return before > 0
        ? props.renderSpacer(before, 'before')
        : null
    }),
    list,
    createDynamicNode(() => {
      const window = readWindow()
      const after = (window.items.length - window.end) * props.itemSize
      return after > 0
        ? props.renderSpacer(after, 'after')
        : null
    }),
  ]
}
