import type { Renderer } from './renderer'
import type { Child } from './vnode'

type Unsubscribe = () => void

interface ClosedObservable<ClosedArgs> {
  readonly isOpen: boolean
  onClosed?(
    callback: (sender: unknown, args: ClosedArgs) => void,
  ): Unsubscribe
  registerPropertyChangedCallback?(
    property: unknown,
    callback: (sender: unknown, property: unknown) => void,
  ): bigint
  unregisterPropertyChangedCallback?(
    property: unknown,
    token: bigint,
  ): void
}

interface ClosableFlyoutLike<ClosedArgs>
  extends ClosedObservable<ClosedArgs> {
  xamlRoot?: unknown
  hide(): void
}

export interface FlyoutController<Native> {
  readonly flyout: Native
  readonly isOpen: boolean
  readonly disposed: boolean
  hide(): void
  dispose(): void
}

function createFlyoutController<
  Native extends ClosableFlyoutLike<ClosedArgs>,
  ClosedArgs,
>(
  renderer: Renderer,
  flyout: Native,
  content: Child,
  open: () => void,
  observeClose: boolean,
  isOpenProperty: unknown,
  onClosed: ((args: ClosedArgs | undefined) => void) | undefined,
): FlyoutController<Native> {
  const handle = renderer.render(content, flyout)
  let disposed = false
  let unsubscribeClosed: Unsubscribe | undefined

  const disposeOwnedContent = () => {
    if (disposed) {
      return
    }
    disposed = true
    unsubscribeClosed?.()
    unsubscribeClosed = undefined
    handle.dispose()
  }

  try {
    if (observeClose) {
      unsubscribeClosed = subscribeClosed(
        flyout,
        isOpenProperty,
        (args) => {
          disposeOwnedContent()
          onClosed?.(args)
        },
      )
    }
    open()
  } catch (error) {
    disposeOwnedContent()
    throw error
  }

  return {
    flyout,
    get isOpen() {
      return flyout.isOpen
    },
    get disposed() {
      return disposed
    },
    hide() {
      if (!disposed) {
        flyout.hide()
        if (!observeClose) {
          disposeOwnedContent()
        }
      }
    },
    dispose() {
      if (disposed) {
        return
      }
      if (flyout.isOpen) {
        flyout.hide()
      }
      disposeOwnedContent()
    },
  }
}

function subscribeClosed<ClosedArgs>(
  flyout: ClosedObservable<ClosedArgs>,
  isOpenProperty: unknown,
  callback: (args: ClosedArgs | undefined) => void,
): Unsubscribe {
  if (isOpenProperty !== undefined) {
    if (
      !flyout.registerPropertyChangedCallback ||
      !flyout.unregisterPropertyChangedCallback
    ) {
      throw new Error(
        'isOpenProperty requires property-changed callback support.',
      )
    }
    const token = flyout.registerPropertyChangedCallback(
      isOpenProperty,
      () => {
        if (!flyout.isOpen) {
          callback(undefined)
        }
      },
    )
    return () => {
      flyout.unregisterPropertyChangedCallback?.(
        isOpenProperty,
        token,
      )
    }
  }
  if (!flyout.onClosed) {
    throw new Error('Flyout closed-event support is unavailable.')
  }
  return flyout.onClosed((_sender, args) => {
    callback(args)
  })
}

export interface FlyoutLike<
  Target,
  ShowOptions = unknown,
  ClosedArgs = unknown,
>
  extends ClosableFlyoutLike<ClosedArgs> {
  showAt(target: Target): void
  showAt(target: Target, showOptions: ShowOptions): void
}

export interface FlyoutOptions<ShowOptions = unknown, ClosedArgs = unknown> {
  readonly xamlRoot?: unknown
  readonly observeClose?: boolean
  readonly isOpenProperty?: unknown
  readonly showOptions?: ShowOptions
  readonly onClosed?: (args: ClosedArgs | undefined) => void
}

export function showFlyout<
  Native extends FlyoutLike<Target, ShowOptions, ClosedArgs>,
  Target,
  ShowOptions = unknown,
  ClosedArgs = unknown,
>(
  renderer: Renderer,
  flyout: Native,
  target: Target,
  content: Child,
  options: FlyoutOptions<ShowOptions, ClosedArgs> = {},
): FlyoutController<Native> {
  if (options.xamlRoot !== undefined) {
    flyout.xamlRoot = options.xamlRoot
  }

  return createFlyoutController(
    renderer,
    flyout,
    content,
    () => {
      if (options.showOptions !== undefined) {
        flyout.showAt(target, options.showOptions)
      } else {
        flyout.showAt(target)
      }
    },
    options.observeClose ?? true,
    options.isOpenProperty,
    options.onClosed,
  )
}

export interface FlyoutPoint {
  readonly x: number
  readonly y: number
}

export interface MenuFlyoutLike<Target, ClosedArgs = unknown>
  extends ClosableFlyoutLike<ClosedArgs> {
  showAt(target: Target, point: FlyoutPoint): void
}

export interface MenuFlyoutOptions<ClosedArgs = unknown> {
  readonly xamlRoot?: unknown
  readonly observeClose?: boolean
  readonly isOpenProperty?: unknown
  readonly point?: FlyoutPoint
  readonly onClosed?: (args: ClosedArgs | undefined) => void
}

export function showMenuFlyout<
  Native extends MenuFlyoutLike<Target, ClosedArgs>,
  Target,
  ClosedArgs = unknown,
>(
  renderer: Renderer,
  menuFlyout: Native,
  target: Target,
  items: Child,
  options: MenuFlyoutOptions<ClosedArgs> = {},
): FlyoutController<Native> {
  if (options.xamlRoot !== undefined) {
    menuFlyout.xamlRoot = options.xamlRoot
  }

  const point = options.point ?? { x: 0, y: 0 }

  return createFlyoutController(
    renderer,
    menuFlyout,
    items,
    () => {
      menuFlyout.showAt(target, point)
    },
    options.observeClose ?? true,
    options.isOpenProperty,
    options.onClosed,
  )
}

export interface TeachingTipLike<ClosedArgs = unknown>
  extends ClosedObservable<ClosedArgs> {
  xamlRoot?: unknown
  target?: unknown
  isOpen: boolean
}

export interface TeachingTipOptions<Target = unknown, ClosedArgs = unknown> {
  readonly xamlRoot?: unknown
  readonly target?: Target
  readonly isOpenProperty?: unknown
  readonly onClosed?: (args: ClosedArgs | undefined) => void
}

export interface TeachingTipController<Native> {
  readonly teachingTip: Native
  readonly isOpen: boolean
  readonly disposed: boolean
  open(content: Child): void
  close(): void
  dispose(): void
}

export function createTeachingTip<
  Native extends TeachingTipLike<ClosedArgs>,
  ClosedArgs = unknown,
>(
  renderer: Renderer,
  teachingTip: Native,
  options: TeachingTipOptions<
    NonNullable<Native['target']>,
    ClosedArgs
  > = {},
): TeachingTipController<Native> {
  if (options.xamlRoot !== undefined) {
    teachingTip.xamlRoot = options.xamlRoot
  }
  if (options.target !== undefined) {
    teachingTip.target = options.target
  }

  let handle: ReturnType<Renderer['render']> | null = null
  let disposed = false

  const disposeOwnedContent = () => {
    handle?.dispose()
    handle = null
  }

  const unsubscribeClosed = subscribeClosed(
    teachingTip,
    options.isOpenProperty,
    (args) => {
      disposeOwnedContent()
      options.onClosed?.(args)
    },
  )

  return {
    teachingTip,
    get isOpen() {
      return teachingTip.isOpen
    },
    get disposed() {
      return disposed
    },
    open(content) {
      if (disposed) {
        throw new Error('Cannot open a disposed TeachingTip controller.')
      }
      disposeOwnedContent()
      const nextHandle = renderer.render(content, teachingTip)
      try {
        teachingTip.isOpen = true
        handle = nextHandle
      } catch (error) {
        nextHandle.dispose()
        throw error
      }
    },
    close() {
      if (disposed) {
        return
      }
      teachingTip.isOpen = false
    },
    dispose() {
      if (disposed) {
        return
      }
      if (teachingTip.isOpen) {
        teachingTip.isOpen = false
      }
      disposed = true
      unsubscribeClosed()
      disposeOwnedContent()
    },
  }
}
