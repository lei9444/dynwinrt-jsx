import type { Cleanup } from '../core/reactive'
import {
  createVNode,
  type Child,
} from '../core/vnode'
import type {
  RenderHandle,
  Renderer,
} from '../renderer/renderer'

export interface SecondaryWindowSize {
  readonly width: number
  readonly height: number
}

export interface SecondaryWindowClosingArgs {
  cancel: boolean
}

export interface SecondaryAppWindowInstance {
  title: string
  onClosing(
    callback: (
      sender: unknown,
      args: SecondaryWindowClosingArgs,
    ) => void,
  ): Cleanup
  onDestroying(callback: () => void): Cleanup
  resizeClient(size: SecondaryWindowSize): void
  show(): void
  destroy(): void
}

export interface SecondaryXamlWindowInstance<
  AppWindow extends SecondaryAppWindowInstance,
> {
  title: string
  readonly appWindow: AppWindow
  onClosed(callback: () => void): Cleanup
  activate(): void
  close(): void
}

export interface SecondaryWindowManagerOptions<
  Window extends SecondaryXamlWindowInstance<AppWindow>,
  AppWindow extends SecondaryAppWindowInstance,
> {
  readonly renderer: Pick<Renderer, 'render'>
  readonly createWindow: () => Window
  readonly configureWindow?: (
    window: Window,
  ) => void | Cleanup
}

export interface OpenSecondaryXamlWindowOptions<
  Window extends SecondaryXamlWindowInstance<AppWindow>,
  AppWindow extends SecondaryAppWindowInstance,
> {
  readonly title: string
  readonly content: (window: Window) => Child
  readonly configure?: (window: Window) => void | Cleanup
  readonly onClosing?: (
    window: Window,
    args: SecondaryWindowClosingArgs,
  ) => void
  readonly onClosed?: () => void
}

export interface OpenSecondaryAppWindowOptions<
  AppWindow extends SecondaryAppWindowInstance,
> {
  readonly create: () => AppWindow
  readonly title: string
  readonly width: number
  readonly height: number
  readonly onClosing?: (
    appWindow: AppWindow,
    args: SecondaryWindowClosingArgs,
  ) => void
  readonly onClosed?: () => void
}

export interface SecondaryXamlWindowHandle<
  Window extends SecondaryXamlWindowInstance<AppWindow>,
  AppWindow extends SecondaryAppWindowInstance,
> {
  readonly window: Window
  readonly appWindow: AppWindow
  readonly closed: boolean
  close(): void
}

export interface SecondaryAppWindowHandle<
  AppWindow extends SecondaryAppWindowInstance,
> {
  readonly appWindow: AppWindow
  readonly closed: boolean
  close(): void
}

export interface SecondaryWindowScope<
  Window extends SecondaryXamlWindowInstance<AppWindow>,
  AppWindow extends SecondaryAppWindowInstance,
> {
  readonly xamlWindowCount: number
  readonly appWindowCount: number
  readonly disposed: boolean
  openXamlWindow(
    options: OpenSecondaryXamlWindowOptions<
      Window,
      AppWindow
    >,
  ): SecondaryXamlWindowHandle<Window, AppWindow>
  openAppWindow(
    options: OpenSecondaryAppWindowOptions<AppWindow>,
  ): SecondaryAppWindowHandle<AppWindow>
  closeAll(): void
  dispose(): void
}

export interface SecondaryWindowAsyncDisposal {
  then(
    onFulfilled: () => void,
    onRejected: (error: unknown) => void,
  ): void
}

export interface SecondaryWindowManager<
  Window extends SecondaryXamlWindowInstance<AppWindow>,
  AppWindow extends SecondaryAppWindowInstance,
> {
  readonly xamlWindowCount: number
  readonly appWindowCount: number
  readonly disposed: boolean
  createScope(): SecondaryWindowScope<Window, AppWindow>
  closeAll(): void
  disposeAsync(
    enqueue: (callback: () => void) => boolean,
  ): SecondaryWindowAsyncDisposal
  dispose(): void
}

interface ScopeState<
  Window extends SecondaryXamlWindowInstance<AppWindow>,
  AppWindow extends SecondaryAppWindowInstance,
> {
  readonly xamlWindows: Set<XamlWindowRecord<Window, AppWindow>>
  readonly appWindows: Set<
    AppWindowRecord<Window, AppWindow>
  >
  disposed: boolean
}

interface XamlWindowRecord<
  Window extends SecondaryXamlWindowInstance<AppWindow>,
  AppWindow extends SecondaryAppWindowInstance,
> {
  readonly owner: ScopeState<Window, AppWindow>
  readonly title: string
  readonly window: Window
  readonly appWindow: AppWindow
  readonly onClosing:
    | OpenSecondaryXamlWindowOptions<
        Window,
        AppWindow
      >['onClosing']
    | undefined
  readonly onClosed: (() => void) | undefined
  readonly cleanups: Cleanup[]
  renderHandle: RenderHandle | undefined
  closingSubscription: Cleanup | undefined
  destroyingSubscription: Cleanup | undefined
  closedSubscription: Cleanup | undefined
  closeInProgress: boolean
  closingEventActive: boolean
  forcingClose: boolean
  nativeClosed: boolean
  renderDisposed: boolean
  released: boolean
  releaseInProgress: boolean
  creating: boolean
  releasePending: boolean
  ready: boolean
  suppressOnClosed: boolean
}

interface AppWindowRecord<
  Window extends SecondaryXamlWindowInstance<AppWindow>,
  AppWindow extends SecondaryAppWindowInstance,
> {
  readonly owner: ScopeState<Window, AppWindow>
  readonly appWindow: AppWindow
  readonly onClosing:
    | OpenSecondaryAppWindowOptions<AppWindow>['onClosing']
    | undefined
  readonly onClosed: (() => void) | undefined
  closingSubscription: Cleanup | undefined
  destroyingSubscription: Cleanup | undefined
  forcingClose: boolean
  nativeDestroyed: boolean
  released: boolean
  releaseInProgress: boolean
  creating: boolean
  releasePending: boolean
  ready: boolean
  suppressOnClosed: boolean
}

function aggregateFailure(
  primary: unknown,
  cleanup: unknown,
  message: string,
): never {
  if (cleanup === undefined) {
    throw primary
  }
  throw new AggregateError([primary, cleanup], message)
}

export function createSecondaryWindowManager<
  Window extends SecondaryXamlWindowInstance<AppWindow>,
  AppWindow extends SecondaryAppWindowInstance,
>(
  options: SecondaryWindowManagerOptions<Window, AppWindow>,
): SecondaryWindowManager<Window, AppWindow> {
  const xamlWindows = new Set<
    XamlWindowRecord<Window, AppWindow>
  >()
  const appWindows = new Set<
    AppWindowRecord<Window, AppWindow>
  >()
  const scopes = new Set<ScopeState<Window, AppWindow>>()
  let disposed = false

  const ensureManagerActive = () => {
    if (disposed) {
      throw new Error(
        'Cannot create a scope from a disposed secondary window manager.',
      )
    }
  }

  const ensureScopeActive = (
    scope: ScopeState<Window, AppWindow>,
  ) => {
    ensureManagerActive()
    if (scope.disposed) {
      throw new Error(
        'Cannot open a window from a disposed secondary window scope.',
      )
    }
  }

  const disposeXamlRender = (
    record: XamlWindowRecord<Window, AppWindow>,
  ) => {
    if (record.renderDisposed) {
      return
    }
    record.renderHandle?.dispose()
    record.renderHandle = undefined
    record.renderDisposed = true
  }

  const releaseXamlWindow = (
    record: XamlWindowRecord<Window, AppWindow>,
  ) => {
    if (record.released) {
      return
    }
    if (record.creating) {
      record.releasePending = true
      return
    }
    if (record.releaseInProgress) {
      return
    }
    record.releaseInProgress = true
    record.releasePending = false

    let firstError: unknown
    try {
      try {
        disposeXamlRender(record)
      }
      catch (error) {
        firstError ??= error
      }

      const failedCleanups: Cleanup[] = []
      for (const cleanup of [...record.cleanups].reverse()) {
        try {
          cleanup()
        }
        catch (error) {
          firstError ??= error
          failedCleanups.unshift(cleanup)
        }
      }
      record.cleanups.splice(
        0,
        record.cleanups.length,
        ...failedCleanups,
      )

      if (record.closingSubscription) {
        try {
          record.closingSubscription()
          record.closingSubscription = undefined
        }
        catch (error) {
          firstError ??= error
        }
      }
      if (record.destroyingSubscription) {
        try {
          record.destroyingSubscription()
          record.destroyingSubscription = undefined
        }
        catch (error) {
          firstError ??= error
        }
      }
      if (record.closedSubscription) {
        try {
          record.closedSubscription()
          record.closedSubscription = undefined
        }
        catch (error) {
          firstError ??= error
        }
      }

      if (
        record.renderDisposed &&
        record.cleanups.length === 0 &&
        !record.closingSubscription &&
        !record.destroyingSubscription &&
        !record.closedSubscription
      ) {
        record.released = true
        xamlWindows.delete(record)
        record.owner.xamlWindows.delete(record)
        if (record.ready && !record.suppressOnClosed) {
          try {
            record.onClosed?.()
          }
          catch (error) {
            firstError ??= error
          }
        }
      }
    }
    finally {
      record.releaseInProgress = false
    }

    if (firstError !== undefined) {
      throw firstError
    }
  }

  const releaseAppWindow = (
    record: AppWindowRecord<Window, AppWindow>,
  ) => {
    if (record.released) {
      return
    }
    if (record.creating) {
      record.releasePending = true
      return
    }
    if (record.releaseInProgress) {
      return
    }
    record.releaseInProgress = true
    record.releasePending = false

    let firstError: unknown
    try {
      if (record.closingSubscription) {
        try {
          record.closingSubscription()
          record.closingSubscription = undefined
        }
        catch (error) {
          firstError ??= error
        }
      }
      if (record.destroyingSubscription) {
        try {
          record.destroyingSubscription()
          record.destroyingSubscription = undefined
        }
        catch (error) {
          firstError ??= error
        }
      }

      if (
        !record.closingSubscription &&
        !record.destroyingSubscription
      ) {
        record.released = true
        appWindows.delete(record)
        record.owner.appWindows.delete(record)
        if (record.ready && !record.suppressOnClosed) {
          try {
            record.onClosed?.()
          }
          catch (error) {
            firstError ??= error
          }
        }
      }
    }
    finally {
      record.releaseInProgress = false
    }

    if (firstError !== undefined) {
      throw firstError
    }
  }

  const requestXamlWindowClose = (
    record: XamlWindowRecord<Window, AppWindow>,
  ) => {
    if (record.released) {
      return
    }
    if (record.nativeClosed) {
      releaseXamlWindow(record)
      return
    }
    if (record.closeInProgress) {
      return
    }
    record.closeInProgress = true
    try {
      record.window.close()
    }
    finally {
      record.closeInProgress = false
    }
  }

  const forceCloseXamlWindow = (
    record: XamlWindowRecord<Window, AppWindow>,
    finalizeDestroyed = false,
  ) => {
    if (record.released) {
      return
    }

    let firstError: unknown
    let destroySucceeded = false
    record.forcingClose = true
    try {
      if (!record.nativeClosed) {
        try {
          requestXamlWindowClose(record)
        }
        catch (error) {
          firstError ??= error
        }
      }

      if (
        !record.nativeClosed &&
        !record.renderDisposed
      ) {
        try {
          disposeXamlRender(record)
        }
        catch (error) {
          firstError ??= error
        }
      }

      if (
        !record.nativeClosed &&
        record.renderDisposed
      ) {
        try {
          record.appWindow.destroy()
          destroySucceeded = true
        }
        catch (error) {
          firstError ??= error
        }
      }

      if (
        finalizeDestroyed &&
        destroySucceeded &&
        !record.nativeClosed
      ) {
        record.nativeClosed = true
      }
      if (!record.nativeClosed) {
        firstError ??= new Error(
          `Secondary XAML Window '${record.title}' did not close during teardown.`,
        )
      }
      else if (!record.released) {
        try {
          releaseXamlWindow(record)
        }
        catch (error) {
          firstError ??= error
        }
      }
    }
    finally {
      record.forcingClose = false
    }

    if (firstError !== undefined) {
      throw firstError
    }
  }

  const forceCloseAppWindow = (
    record: AppWindowRecord<Window, AppWindow>,
    finalizeDestroyed = false,
  ) => {
    if (record.released) {
      return
    }

    let firstError: unknown
    let destroySucceeded = false
    record.forcingClose = true
    try {
      if (!record.nativeDestroyed) {
        try {
          record.appWindow.destroy()
          destroySucceeded = true
        }
        catch (error) {
          firstError ??= error
        }
      }
      if (
        finalizeDestroyed &&
        destroySucceeded &&
        !record.nativeDestroyed
      ) {
        record.nativeDestroyed = true
      }
      if (record.nativeDestroyed && !record.released) {
        try {
          releaseAppWindow(record)
        }
        catch (error) {
          firstError ??= error
        }
      }
      if (!record.nativeDestroyed) {
        firstError ??= new Error(
          `Secondary AppWindow '${record.appWindow.title}' did not close during teardown.`,
        )
      }
    }
    finally {
      record.forcingClose = false
    }

    if (firstError !== undefined) {
      throw firstError
    }
  }

  const closeScopes = (
    ownedScopes: readonly ScopeState<Window, AppWindow>[],
  ) => {
    const ownedXamlWindows = ownedScopes.flatMap(
      (scope) => [...scope.xamlWindows],
    )
    const ownedAppWindows = ownedScopes.flatMap(
      (scope) => [...scope.appWindows],
    )
    for (const record of ownedXamlWindows) {
      record.suppressOnClosed = true
    }
    for (const record of ownedAppWindows) {
      record.suppressOnClosed = true
    }

    let firstError: unknown
    for (const record of ownedXamlWindows) {
      try {
        forceCloseXamlWindow(record)
      }
      catch (error) {
        firstError ??= error
      }
    }
    for (const record of ownedAppWindows) {
      try {
        forceCloseAppWindow(record)
      }
      catch (error) {
        firstError ??= error
      }
    }
    for (const record of ownedXamlWindows) {
      if (!record.released) {
        record.suppressOnClosed = false
      }
    }
    for (const record of ownedAppWindows) {
      if (!record.released) {
        record.suppressOnClosed = false
      }
    }
    if (firstError !== undefined) {
      throw firstError
    }
  }

  const closeScope = (
    scope: ScopeState<Window, AppWindow>,
  ) => closeScopes([scope])

  const createScope = (): SecondaryWindowScope<
    Window,
    AppWindow
  > => {
    ensureManagerActive()
    const state: ScopeState<Window, AppWindow> = {
      xamlWindows: new Set(),
      appWindows: new Set(),
      disposed: false,
    }
    scopes.add(state)

    const scope: SecondaryWindowScope<Window, AppWindow> = {
      get xamlWindowCount() {
        return state.xamlWindows.size
      },
      get appWindowCount() {
        return state.appWindows.size
      },
      get disposed() {
        return state.disposed
      },
      openXamlWindow(windowOptions) {
        ensureScopeActive(state)
        const window = options.createWindow()
        const record: XamlWindowRecord<Window, AppWindow> = {
          owner: state,
          title: windowOptions.title,
          window,
          appWindow: window.appWindow,
          onClosing: windowOptions.onClosing,
          onClosed: windowOptions.onClosed,
          cleanups: [],
          renderHandle: undefined,
          closingSubscription: undefined,
          destroyingSubscription: undefined,
          closedSubscription: undefined,
          closeInProgress: false,
          closingEventActive: false,
          forcingClose: false,
          nativeClosed: false,
          renderDisposed: true,
          released: false,
          releaseInProgress: false,
          creating: true,
          releasePending: false,
          ready: false,
          suppressOnClosed: false,
        }
        xamlWindows.add(record)
        state.xamlWindows.add(record)

        try {
          record.closedSubscription = window.onClosed(() => {
            record.nativeClosed = true
            releaseXamlWindow(record)
          })
          window.title = windowOptions.title
          const managerCleanup =
            options.configureWindow?.(window)
          if (managerCleanup) {
            record.cleanups.push(managerCleanup)
          }
          const windowCleanup =
            windowOptions.configure?.(window)
          if (windowCleanup) {
            record.cleanups.push(windowCleanup)
          }
          if (record.nativeClosed || record.released) {
            throw new Error(
              `Secondary XAML Window '${record.title}' closed during configuration.`,
            )
          }
          const WindowContent = () =>
            windowOptions.content(window)
          record.renderHandle = options.renderer.render(
            createVNode(WindowContent, {}),
            window,
          )
          record.renderDisposed = false
          if (record.nativeClosed || record.released) {
            throw new Error(
              `Secondary XAML Window '${record.title}' closed during creation.`,
            )
          }
          record.destroyingSubscription =
            record.appWindow.onDestroying(() => {
              disposeXamlRender(record)
            })
          record.closingSubscription =
            record.appWindow.onClosing((_sender, args) => {
              if (record.closingEventActive) {
                args.cancel = true
                return
              }
              record.closingEventActive = true
              try {
                const incomingCancel = args.cancel
                let callbackError: unknown
                if (record.ready) {
                  try {
                    record.onClosing?.(record.window, args)
                  }
                  catch (error) {
                    callbackError = error
                  }
                }
                if (record.forcingClose) {
                  args.cancel = false
                }
                else if (incomingCancel) {
                  args.cancel = true
                }
                if (callbackError !== undefined) {
                  throw callbackError
                }
              }
              finally {
                record.closingEventActive = false
              }
            })
          window.activate()
          if (record.nativeClosed || record.releasePending) {
            throw new Error(
              `Secondary XAML Window '${record.title}' closed during activation.`,
            )
          }
          record.ready = true
          record.creating = false
        }
        catch (error) {
          record.creating = false
          record.suppressOnClosed = true
          let cleanupError: unknown
          try {
            forceCloseXamlWindow(record, true)
          }
          catch (failure) {
            cleanupError = failure
          }
          finally {
            if (!record.released) {
              record.suppressOnClosed = false
            }
          }
          aggregateFailure(
            error,
            cleanupError,
            `Secondary XAML Window '${windowOptions.title}' creation and cleanup failed.`,
          )
        }

        return {
          window,
          appWindow: window.appWindow,
          get closed() {
            return record.nativeClosed
          },
          close() {
            requestXamlWindowClose(record)
          },
        }
      },
      openAppWindow(windowOptions) {
        ensureScopeActive(state)
        const appWindow = windowOptions.create()
        const record: AppWindowRecord<Window, AppWindow> = {
          owner: state,
          appWindow,
          onClosing: windowOptions.onClosing,
          onClosed: windowOptions.onClosed,
          closingSubscription: undefined,
          destroyingSubscription: undefined,
          forcingClose: false,
          nativeDestroyed: false,
          released: false,
          releaseInProgress: false,
          creating: true,
          releasePending: false,
          ready: false,
          suppressOnClosed: false,
        }
        appWindows.add(record)
        state.appWindows.add(record)

        try {
          record.destroyingSubscription =
            appWindow.onDestroying(() => {
              record.nativeDestroyed = true
              releaseAppWindow(record)
            })
          record.closingSubscription =
            appWindow.onClosing((_sender, args) => {
              const incomingCancel = args.cancel
              let callbackError: unknown
              if (record.ready) {
                try {
                  record.onClosing?.(record.appWindow, args)
                }
                catch (error) {
                  callbackError = error
                }
              }
              if (record.forcingClose) {
                args.cancel = false
              }
              else if (incomingCancel) {
                args.cancel = true
              }
              if (callbackError !== undefined) {
                throw callbackError
              }
            })
          appWindow.title = windowOptions.title
          appWindow.resizeClient({
            width: windowOptions.width,
            height: windowOptions.height,
          })
          appWindow.show()
          if (
            record.nativeDestroyed ||
            record.releasePending
          ) {
            throw new Error(
              `Secondary AppWindow '${windowOptions.title}' closed during creation.`,
            )
          }
          record.ready = true
          record.creating = false
        }
        catch (error) {
          record.creating = false
          record.suppressOnClosed = true
          let cleanupError: unknown
          try {
            forceCloseAppWindow(record, true)
          }
          catch (failure) {
            cleanupError = failure
          }
          finally {
            if (!record.released) {
              record.suppressOnClosed = false
            }
          }
          aggregateFailure(
            error,
            cleanupError,
            `Secondary AppWindow '${windowOptions.title}' creation and cleanup failed.`,
          )
        }

        return {
          appWindow,
          get closed() {
            return record.nativeDestroyed
          },
          close() {
            if (record.released) {
              return
            }
            if (record.nativeDestroyed) {
              releaseAppWindow(record)
              return
            }
            record.appWindow.destroy()
          },
        }
      },
      closeAll() {
        closeScope(state)
      },
      dispose() {
        if (state.disposed) {
          return
        }
        closeScope(state)
        if (
          state.xamlWindows.size > 0 ||
          state.appWindows.size > 0
        ) {
          throw new Error(
            'Secondary window scope retained windows after teardown.',
          )
        }
        state.disposed = true
        scopes.delete(state)
      },
    }
    return scope
  }

  const manager: SecondaryWindowManager<Window, AppWindow> = {
    get xamlWindowCount() {
      return xamlWindows.size
    },
    get appWindowCount() {
      return appWindows.size
    },
    get disposed() {
      return disposed
    },
    createScope,
    closeAll() {
      closeScopes([...scopes])
    },
    disposeAsync(enqueue) {
      type Handler = {
        readonly onFulfilled: () => void
        readonly onRejected: (error: unknown) => void
      }
      const handlers: Handler[] = []
      let state: 'pending' | 'fulfilled' | 'rejected' =
        'pending'
      let failure: unknown
      const settle = (
        next: 'fulfilled' | 'rejected',
        error?: unknown,
      ) => {
        if (state !== 'pending') {
          return
        }
        state = next
        failure = error
        for (const handler of handlers.splice(0)) {
          if (next === 'fulfilled') {
            handler.onFulfilled()
          }
          else {
            handler.onRejected(error)
          }
        }
      }
      const operation: SecondaryWindowAsyncDisposal = {
        then(onFulfilled, onRejected) {
          if (state === 'fulfilled') {
            onFulfilled()
            return
          }
          if (state === 'rejected') {
            onRejected(failure)
            return
          }
          handlers.push({ onFulfilled, onRejected })
        },
      }

      if (disposed) {
        settle('fulfilled')
        return operation
      }

      const disposeManager = () => {
        try {
          manager.dispose()
          settle('fulfilled')
        }
        catch (error) {
          settle('rejected', error)
        }
      }
      try {
        if (!enqueue(disposeManager)) {
          settle('rejected', new Error(
            'Secondary window teardown could not be queued.',
          ))
        }
      }
      catch (error) {
        settle('rejected', error)
      }
      return operation
    },
    dispose() {
      if (disposed) {
        return
      }

      let firstError: unknown
      try {
        closeScopes([...scopes])
      }
      catch (error) {
        firstError = error
      }
      if (
        firstError === undefined &&
        (xamlWindows.size > 0 || appWindows.size > 0)
      ) {
        firstError = new Error(
          'Secondary window manager retained windows after teardown.',
        )
      }
      if (firstError !== undefined) {
        throw firstError
      }

      for (const scope of scopes) {
        scope.disposed = true
      }
      scopes.clear()
      disposed = true
    },
  }

  return manager
}
