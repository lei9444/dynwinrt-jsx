import {
  onCleanup,
  type Child,
  type RenderHandle,
  type Renderer,
} from 'dynwinrt-jsx'
import {
  AppWindow,
  MicaBackdrop,
  Window,
  type AppWindowPresenter,
} from '#winapp/bindings'

interface OwnedXamlWindow {
  readonly title: string
  readonly window: Window
  readonly appWindow: AppWindow
  readonly renderHandle: RenderHandle
  configureCleanup: (() => void) | undefined
  closingSubscription: (() => void) | undefined
  closedSubscription: (() => void) | undefined
  forcingClose: boolean
  nativeClosed: boolean
  disposed: boolean
  released: boolean
}

interface OwnedAppWindow {
  readonly appWindow: AppWindow
  closingSubscription: (() => void) | undefined
  destroyingSubscription: (() => void) | undefined
  disposed: boolean
}

export interface SecondaryWindowManager {
  readonly xamlWindowCount: number
  readonly appWindowCount: number
  openXamlWindow(options: {
    readonly title: string
    readonly content: (window: Window) => Child
    readonly configure?: (window: Window) => void | (() => void)
    readonly onClosed?: () => void
  }): OwnedXamlWindow
  openAppWindow(options: {
    readonly title: string
    readonly presenter: AppWindowPresenter
    readonly ownerWindowId: AppWindow['id']
    readonly dispatcherQueue: Window['dispatcherQueue']
    readonly width: number
    readonly height: number
    readonly onClosed?: () => void
  }): OwnedAppWindow
  closeAll(): void
}

export function formatNativeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error)
}

function SecondaryWindowContent(props: {
  readonly window: Window
  readonly content: (window: Window) => Child
}) {
  return props.content(props.window)
}

export function createSecondaryWindowManager(
  renderer: Renderer,
): SecondaryWindowManager {
  const xamlWindows = new Set<OwnedXamlWindow>()
  const appWindows = new Set<OwnedAppWindow>()
  let tearingDown = false

  const disposeXamlRender = (owned: OwnedXamlWindow) => {
    if (owned.disposed) {
      return
    }
    owned.renderHandle.dispose()
    owned.disposed = true
  }

  const releaseXamlWindow = (
    owned: OwnedXamlWindow,
    onClosed?: () => void,
  ) => {
    if (owned.released) {
      return
    }
    disposeXamlRender(owned)
    let firstError: unknown
    try {
      owned.configureCleanup?.()
      owned.configureCleanup = undefined
    }
    catch (error) {
      firstError ??= error
    }
    try {
      owned.closingSubscription?.()
      owned.closingSubscription = undefined
    }
    catch (error) {
      firstError ??= error
    }
    try {
      owned.closedSubscription?.()
      owned.closedSubscription = undefined
    }
    catch (error) {
      firstError ??= error
    }
    owned.released = true
    xamlWindows.delete(owned)
    if (!tearingDown) {
      onClosed?.()
    }
    if (firstError !== undefined) {
      throw firstError
    }
  }

  const releaseAppWindow = (
    owned: OwnedAppWindow,
    onClosed?: () => void,
  ) => {
    if (owned.disposed) {
      return
    }
    let firstError: unknown
    try {
      owned.closingSubscription?.()
      owned.closingSubscription = undefined
    }
    catch (error) {
      firstError ??= error
    }
    try {
      owned.destroyingSubscription?.()
      owned.destroyingSubscription = undefined
    }
    catch (error) {
      firstError ??= error
    }
    owned.disposed = true
    appWindows.delete(owned)
    if (!tearingDown) {
      onClosed?.()
    }
    if (firstError !== undefined) {
      throw firstError
    }
  }

  const manager: SecondaryWindowManager = {
    get xamlWindowCount() {
      return xamlWindows.size
    },
    get appWindowCount() {
      return appWindows.size
    },
    openXamlWindow(options) {
      const window = new Window()
      let renderHandle: RenderHandle | undefined
      let owned: OwnedXamlWindow | undefined
      let configureCleanup: (() => void) | undefined
      try {
        window.title = options.title
        window.systemBackdrop = new MicaBackdrop()
        configureCleanup = options.configure?.(window) ?? undefined
        renderHandle = renderer.render(
          <SecondaryWindowContent
            window={window}
            content={options.content}
          />,
          window,
        )
        owned = {
          title: options.title,
          window,
          appWindow: window.appWindow,
          renderHandle,
          configureCleanup,
          closingSubscription: undefined,
          closedSubscription: undefined,
          forcingClose: false,
          nativeClosed: false,
          disposed: false,
          released: false,
        }
        owned.closingSubscription = owned.appWindow.onClosing(
          (_sender, args) => {
            if (owned!.forcingClose) {
              args.cancel = false
            }
            if (!args.cancel) {
              disposeXamlRender(owned!)
            }
          },
        )
        owned.closedSubscription = window.onClosed(() => {
          owned!.nativeClosed = true
          releaseXamlWindow(owned!, options.onClosed)
        })
        xamlWindows.add(owned)
        window.activate()
        return owned
      }
      catch (error) {
        try {
          if (owned) {
            releaseXamlWindow(owned)
          }
          else {
            renderHandle?.dispose()
            configureCleanup?.()
          }
        }
        catch {
          // Preserve the original creation failure after cleanup continues.
        }
        try {
          window.close()
        }
        catch {
          try {
            window.appWindow.destroy()
          }
          catch {
            // Preserve the original creation failure.
          }
        }
        throw error
      }
    },
    openAppWindow(options) {
      const appWindow = AppWindow.create(
        options.presenter,
        options.ownerWindowId,
        options.dispatcherQueue,
      )
      const owned: OwnedAppWindow = {
        appWindow,
        closingSubscription: undefined,
        destroyingSubscription: undefined,
        disposed: false,
      }
      appWindows.add(owned)
      try {
        owned.closingSubscription = appWindow.onClosing(
          (_sender, args) => {
            if (!args.cancel) {
              releaseAppWindow(owned, options.onClosed)
            }
          },
        )
        owned.destroyingSubscription = appWindow.onDestroying(() => {
          releaseAppWindow(owned, options.onClosed)
        })
        appWindow.title = options.title
        appWindow.resizeClient({
          width: options.width,
          height: options.height,
        })
        appWindow.show()
        return owned
      }
      catch (error) {
        try {
          releaseAppWindow(owned)
        }
        catch {
          // Preserve the original creation failure after cleanup continues.
        }
        try {
          appWindow.destroy()
        }
        catch {
          // Preserve the original creation failure.
        }
        throw error
      }
    },
    closeAll() {
      tearingDown = true
      let firstError: unknown
      try {
        for (const owned of [...xamlWindows]) {
          owned.forcingClose = true
          try {
            owned.window.close()
          }
          catch (error) {
            firstError ??= error
          }
          if (!owned.nativeClosed) {
            try {
              owned.appWindow.destroy()
            }
            catch (error) {
              firstError ??= error
            }
          }
          if (!owned.nativeClosed) {
            firstError ??= new Error(
              `Secondary XAML Window '${owned.title}' did not close during teardown.`,
            )
          }
        }
        for (const owned of [...appWindows]) {
          try {
            owned.appWindow.destroy()
            if (appWindows.has(owned)) {
              releaseAppWindow(owned)
            }
          }
          catch (error) {
            firstError ??= error
            try {
              releaseAppWindow(owned)
            }
            catch (cleanupError) {
              firstError ??= cleanupError
            }
          }
        }
      }
      finally {
        for (const owned of xamlWindows) {
          owned.forcingClose = false
        }
        tearingDown = false
      }
      if (firstError !== undefined) {
        throw firstError
      }
    },
  }

  onCleanup(() => manager.closeAll())
  return manager
}
